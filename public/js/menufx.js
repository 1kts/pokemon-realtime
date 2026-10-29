// Skins y partículas en los menús (retratos y avatar). La skin es el mismo shader que en combate (skinshader.js):
// un renderer WebGL fuera de la página pinta el fotograma que enseña el retrato (c.sprite, ver sprites.js) con su
// skin, a la resolución del pixel art y con un margen para las llamas y el contorno de la Elemental, y se copia
// escalado al canvas del retrato en lugar del sprite. Los retratos que se ven van todos en una pasada (un atlas),
// a FPS. Las partículas (otro premio, con cualquier skin) son pequeñas de pixel art por encima (brasas, burbujas,
// chispas, hojas, copos, humo o destellos). Sin WebGL, la skin es el filtro CSS skin-* (skinCss).
import * as THREE from 'three';
import { elementalPalette } from './skinfx.js';
import { SHAPES } from './pixshapes.js';
import { skinUniforms, skinMaterial, setSkin, skinClock } from './skinshader.js';

const FPS = 24;
const M = 3;            // margen alrededor del fotograma, en píxeles de arte (llamas y contorno de la Elemental)
const ATLAS_W = 1024;   // ancho del atlas: los fotogramas se colocan por filas
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Partículas de cada tipo, con las mismas formas de pixel art de 16×16 que en combate (pixshapes.js), en capas: cada
// tipo suelta dos o tres cosas a la vez (el fuego, llamas y brasas; el agua, burbujas que estallan y gotas; el
// eléctrico, rayos y chispazos…), cada una con un brillo suave de su color por detrás (luz que se suma, mientras la
// forma sigue nítida) y, en algunos, un resplandor a los pies del Pokémon. Cada capa:
//   shapes: formas con el color de cada nivel (1, el borde, a 4, el centro), como índice de la paleta del tipo (0
//     oscuro a 3 claro) o un color fijo; rate: cuántas por segundo; size: su tamaño en píxeles de arte; life: segundos
//   vx/vy: hacia dónde va (vy < 0, sube; burst: en todas direcciones); wobble: hace eses; gravity: cae como una piedra
//   grow: crece (humo, anillos); spin: gira de cuarto en cuarto (hojas, copos); flip: se da la vuelta (llamas)
//   flash: parpadea en blanco (rayos, destellos); pop: al final estalla en un anillo (burbujas); glow: su brillo
// aura: resplandor a los pies ([índice de la paleta, fuerza, parpadeo])
const F = (name, pal) => ({ name, pal });
const W = '#ffffff';
function kind(type) {
  switch (type) {
    case 'fuego': return { aura: [2, 0.45, 9], layers: [
      { shapes: [F('flame', [0, 1, 2, 3]), F('flame', [1, 2, 3, W])], rate: 9, vy: -1, vx: 0.12, size: 10, life: 0.6, flip: true, glow: 0.55 },
      { shapes: [F('spark', [2, 3, 3, W])], rate: 7, vy: -1.6, vx: 0.4, size: 5, life: 0.9, wobble: true, glow: 0.8 }] };
    case 'agua': return { aura: [2, 0.25, 0], layers: [
      { shapes: [F('bubble', [1, 3, 3, W])], rate: 5, vy: -0.55, vx: 0.1, size: 10, life: 1, wobble: true, pop: true, glow: 0.3 },
      { shapes: [F('spark', [1, 2, 3, W])], rate: 4, vy: -0.6, vx: 0.4, size: 4, life: 0.8, gravity: true, glow: 0.4 },
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 2, vy: -0.1, vx: 0, size: 7, life: 0.4, flash: true, glow: 0.6 }] };
    case 'electrico': return { aura: [3, 0.25, 14], layers: [
      { shapes: [F('bolt', [3, 3, 3, 3]), F('bolt', [W, W, W, W])], rate: 5, vy: -0.1, vx: 0.3, size: 12, life: 0.28, flip: true, flash: true, glow: 0.9 },
      { shapes: [F('spark', [2, 3, 3, W])], rate: 12, burst: 1.6, size: 4, life: 0.35, glow: 0.7 }] };
    case 'planta': case 'bicho': return { layers: [
      { shapes: [F('leaf', [0, 1, 2, 3])], rate: 4, vy: 0.35, vx: 0.4, size: 9, life: 1.2, wobble: true, spin: true, glow: 0.2 },
      { shapes: [F('twinkle', [2, 3, 3, W])], rate: 4, vy: -0.25, vx: 0.2, size: 5, life: 0.8, flash: true, glow: 0.6 }] };
    case 'hielo': return { aura: [3, 0.3, 0], layers: [
      { shapes: [F('flake', [1, 2, 3, W])], rate: 5, vy: 0.28, vx: 0.2, size: 8, life: 1.3, wobble: true, spin: true, glow: 0.45 },
      { shapes: [F('diamond', [2, 3, W, W])], rate: 2, vy: 0, vx: 0, size: 6, life: 0.45, flash: true, glow: 0.8 }] };
    case 'fantasma': case 'siniestro': case 'veneno': return { aura: [0, 0.5, 3], layers: [
      { shapes: [F('puff', [0, 1, 2, 3])], rate: 5, vy: -0.4, vx: 0.15, size: 9, life: 1.1, grow: true, alpha: 0.7, glow: 0.35 },
      { shapes: [F('spark', [2, 3, 3, W])], rate: 3, vy: -0.7, vx: 0.2, size: 4, life: 0.8, wobble: true, glow: 0.8 }] };
    case 'lucha': return { layers: [
      { shapes: [F('spark', [2, 3, 3, W])], rate: 11, burst: 1.8, size: 5, life: 0.3, glow: 0.7 },
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 2, vy: 0, vx: 0, size: 12, life: 0.25, flash: true, glow: 0.9 }] };
    case 'tierra': case 'roca': return { layers: [
      { shapes: [F('pebble', [0, 1, 2, 3])], rate: 5, vy: -0.6, vx: 0.45, size: 7, life: 0.9, gravity: true, spin: true },
      { shapes: [F('puff', [1, 2, 3, 3])], rate: 2, vy: -0.15, vx: 0.3, size: 7, life: 0.8, grow: true, alpha: 0.5, low: true }] };
    case 'volador': return { layers: [
      { shapes: [F('feather', [W, 3, 2, W])], rate: 3, vy: 0.25, vx: 0.5, size: 10, life: 1.4, wobble: true, spin: true, glow: 0.2 },
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 4, vy: -0.1, vx: 1.6, size: 5, life: 0.5, glow: 0.6 }] };
    case 'psiquico': return { aura: [2, 0.35, 4], layers: [
      { shapes: [F('ring', [2, 3, 3, 3])], rate: 2, vy: 0, vx: 0, size: 8, life: 0.9, grow: 2.2, glow: 0.6 },
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 6, vy: -0.3, vx: 0.3, size: 6, life: 0.7, flash: true, glow: 0.7 }] };
    case 'dragon': return { aura: [1, 0.4, 5], layers: [
      { shapes: [F('diamond', [1, 2, 3, W])], rate: 5, vy: -0.7, vx: 0.2, size: 8, life: 0.8, wobble: true, glow: 0.7 },
      { shapes: [F('flame', [0, 1, 2, 3])], rate: 5, vy: -0.9, vx: 0.1, size: 9, life: 0.5, flip: true, glow: 0.5 }] };
    case 'acero': return { layers: [
      { shapes: [F('diamond', [1, 2, 3, W])], rate: 3, vy: 0, vx: 0, size: 9, life: 0.4, flash: true, glow: 0.9 },
      { shapes: [F('spark', [2, 3, 3, W])], rate: 6, vy: -0.3, vx: 0.3, size: 5, life: 0.6, glow: 0.6 }] };
    case 'hada': return { aura: [3, 0.3, 2], layers: [
      { shapes: [F('heart', [1, 2, 3, W])], rate: 4, vy: -0.5, vx: 0.2, size: 9, life: 1, wobble: true, glow: 0.5 },
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 7, vy: -0.3, vx: 0.3, size: 6, life: 0.6, flash: true, glow: 0.8 }] };
    default: return { layers: [
      { shapes: [F('twinkle', [2, 3, W, W])], rate: 6, vy: -0.4, vx: 0.2, size: 7, life: 0.7, flash: true, glow: 0.6 },
      { shapes: [F('spark', [2, 3, 3, W])], rate: 4, vy: -0.8, vx: 0.3, size: 4, life: 0.7, glow: 0.5 }] };
  }
}
// El brillo de un color: un degradado redondo, pintado una vez y sumado detrás de cada partícula
const glowCache = new Map();
function glowCanvas(col) {
  const key = col.join();
  let cv = glowCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16), c = col.map(v => v | 0).join(',');
  gr.addColorStop(0, `rgba(${c},0.85)`); gr.addColorStop(0.35, `rgba(${c},0.3)`); gr.addColorStop(0.75, `rgba(${c},0.05)`); gr.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  if (glowCache.size > 100) glowCache.clear();
  glowCache.set(key, cv);
  return cv;
}
// Cada forma con sus colores, pintada una vez en un canvas de 16×16 (luego se copia escalada, sin suavizar)
const shapeCache = new Map();
function shapeCanvas(shape, ppal) {
  const key = shape.name + shape.pal.join() + ppal.join();
  let cv = shapeCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  SHAPES[shape.name].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const v = shape.pal[+ch - 1], col = typeof v === 'number' ? ppal[v] : v;
    g.fillStyle = typeof col === 'string' ? col : `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
    g.fillRect(x, y, 1, 1);
  }));
  if (shapeCache.size > 300) shapeCache.clear();
  shapeCache.set(key, cv);
  return cv;
}

// Skin con filtro CSS: para las ilustraciones (sin canvas) y si no hay WebGL
export function skinCss(node, skin, type) {
  if (skin === 'elemental') { node.classList.add('skin-elemental'); node.style.setProperty('--fx', Data.TYPE_COLOR[type]); }
  else if (skin) node.classList.add('skin-' + skin);
}

// ---------- El renderer de las skins: uno para todos los retratos, creado al primero que lleva skin ----------
let GL = null, noGL = false;
// El renderer (o null si no hay WebGL)
export function skinGL() {
  if (GL || noGL) return GL;
  try {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    const u = skinUniforms();
    const mat = skinMaterial(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, toneMapped: false }), u);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat));
    // copy: el atlas pasado a 2D (una sola lectura de la GPU por pasada; de ahí se copia a cada retrato)
    GL = { canvas, renderer, u, mat, scene, camera: new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 1), copy: document.createElement('canvas'), textures: new Map() };
    // Si se pierde el contexto, las skins pasan al filtro CSS
    canvas.addEventListener('webglcontextlost', () => {
      noGL = true; GL = null;
      for (const e of entries) if (e.skin) { e.node.classList.remove('skinfx-' + e.skin); skinCss(e.node, e.skin, e.type); e.skin = null; }
    });
  } catch { noGL = true; }
  return GL;
}

// Textura de una hoja de sprites (como texFor de actors.js); las que no se usan en un rato se liberan
function texture(img, now) {
  let t = GL.textures.get(img);
  if (!t) {
    t = new THREE.Texture(img);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    GL.textures.set(img, t);
  }
  t.userData.used = now;
  return t;
}

// Pinta con su skin el fotograma de cada retrato de la lista en el atlas. Devuelve dónde quedó cada uno
// ({ x, y, w, h } en GL.copy); los que enseñan lo mismo comparten sitio
function skinPass(list, now) {
  const out = new Map();
  if (!list.length || !skinGL()) return out;
  const { renderer, u, mat, scene, camera, canvas, copy } = GL;
  const tiles = new Map();
  let x = 0, y = 0, rowH = 0, w = 0;
  for (const e of list) {
    const s = e.c.sprite, key = `${s.img.src}|${s.sx}|${s.sy}|${s.sw}|${s.sh}|${e.skin}|${e.type}`;
    let tile = tiles.get(key);
    if (!tile) {
      const tw = s.sw + 2 * M, th = s.sh + 2 * M;
      if (x + tw > ATLAS_W) { x = 0; y += rowH; rowH = 0; }
      tile = { s, e, x, y, w: tw, h: th };
      tiles.set(key, tile);
      x += tw; rowH = Math.max(rowH, th); w = Math.max(w, x);
    }
    out.set(e, tile);
  }
  const h = y + rowH;
  if (canvas.width < w || canvas.height < h) renderer.setSize(Math.max(canvas.width, w), Math.max(canvas.height, h), false);
  const H = canvas.height;
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  u.uTime.value = skinClock(now);
  for (const { s, e, x, y, w, h } of tiles.values()) {
    const iw = s.img.naturalWidth, ih = s.img.naturalHeight, tex = texture(s.img, now);
    // El plano enseña el fotograma con M píxeles de más por cada lado (uFrame: solo el fotograma)
    tex.offset.set((s.sx - M) / iw, 1 - (s.sy + s.sh + M) / ih);
    tex.repeat.set(w / iw, h / ih);
    mat.map = tex;
    setSkin(u, e.skin, e.type);
    u.uTexel.value.set(1 / iw, 1 / ih);
    u.uFrame.value.set(s.sx / iw, 1 - (s.sy + s.sh) / ih, s.sw / iw, s.sh / ih);
    renderer.setViewport(x, H - y - h, w, h);   // (en WebGL, y desde abajo)
    renderer.setScissor(x, H - y - h, w, h);
    renderer.render(scene, camera);
  }
  if (copy.width !== canvas.width || copy.height !== canvas.height) { copy.width = canvas.width; copy.height = canvas.height; }
  const g = copy.getContext('2d');
  g.clearRect(0, 0, copy.width, copy.height);
  g.drawImage(canvas, 0, 0);
  for (const [img, t] of GL.textures) if (now - t.userData.used > 20000) { t.dispose(); GL.textures.delete(img); }
  return out;
}

// Píxeles opacos de un fotograma (en píxeles de arte), para que las partículas nazcan sobre el sprite
const solid = new Map();
let scratch = null;
function solidCells(s) {
  const key = `${s.img.src}|${s.sx}|${s.sy}`;
  let list = solid.get(key);
  if (!list) {
    scratch = scratch || document.createElement('canvas');
    scratch.width = s.sw; scratch.height = s.sh;
    const g = scratch.getContext('2d', { willReadFrequently: true });
    g.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, 0, 0, s.sw, s.sh);
    const d = g.getImageData(0, 0, s.sw, s.sh).data;
    list = [];
    for (let i = 0; i < s.sw * s.sh; i++) if (d[i * 4 + 3] >= 128) list.push(i);
    if (solid.size > 600) solid.clear();
    solid.set(key, list);
  }
  return list;
}

// Partículas de un retrato: cada capa nace en puntos del sprite (las de los pies, abajo) y se mueve a su manera, sin
// salir apenas de él; el resplandor de los pies, debajo de todo
function particles(e, g, dt) {
  const { k, ppal, parts, c } = e, s = c.sprite, size = c.width;
  const cells = solidCells(s), sc = s.dw / s.sw;
  e.t = (e.t || 0) + dt;
  g.imageSmoothingEnabled = false;
  const prev = g.globalCompositeOperation;
  if (k.aura) {
    const [ci, power, flick] = k.aura, w = s.dw * 0.85, h = s.dh * 0.35;
    const a = power * (flick ? 0.75 + 0.25 * Math.sin(e.t * flick) * Math.sin(e.t * flick * 0.37 + 1) : 1);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
    g.drawImage(glowCanvas(ppal[ci]), s.dx + s.dw / 2 - w / 2, s.dy + s.dh - h * 0.65, w, h);
    g.globalAlpha = 1; g.globalCompositeOperation = prev;
  }
  if (cells.length) for (const L of k.layers) if (Math.random() < dt * L.rate) {
    const i = cells[Math.floor(Math.random() * cells.length)], a = Math.random() * Math.PI * 2;
    const x = s.dx + (i % s.sw + Math.random()) * sc, y = L.low ? s.dy + s.dh - Math.random() * s.dh * 0.15 : s.dy + (Math.floor(i / s.sw) + Math.random()) * sc;
    parts.push({ L, x, y, t: 0, life: L.life * (0.8 + Math.random() * 0.5), shape: L.shapes[Math.floor(Math.random() * L.shapes.length)], flip: Math.random() < 0.5, rot: Math.floor(Math.random() * 4),
      vx: L.burst ? Math.cos(a) * L.burst * size * 0.15 : (Math.random() - 0.5) * 2 * L.vx * size * 0.15,
      vy: L.burst ? Math.sin(a) * L.burst * size * 0.15 : L.vy * size * 0.15 * (0.6 + Math.random() * 0.6), seed: Math.random() * 6 });
  }
  for (let n = parts.length - 1; n >= 0; n--) {
    const q = parts[n], L = q.L;
    q.t += dt;
    if (q.t >= q.life) { parts.splice(n, 1); continue; }
    const f = q.t / q.life;
    if (L.gravity) q.vy += size * 1.2 * dt;
    q.x += (q.vx + (L.wobble ? Math.sin((q.t + q.seed) * 8) * size * 0.05 : 0)) * dt;
    q.y += q.vy * dt;
    // (al final, la burbuja estalla: un anillo que se abre)
    const popping = L.pop && f > 0.82;
    const grow = popping ? 1.6 + (f - 0.82) * 6 : L.grow ? 0.6 + f * (L.grow === true ? 0.8 : L.grow) : 1 - Math.max(0, f - 0.6);
    const art = Math.max(3, Math.round(L.size * grow)), w = Math.round(art * sc);
    let alpha = Math.min(1, (1 - f) * 2) * (L.alpha || 1);
    if (L.flash) alpha *= (Math.floor(q.t * 18 + q.seed) % 3 === 0) ? 0.35 : 1;
    const x = Math.round(q.x - w / 2), y = Math.round(q.y - w / 2);
    // brillo detrás (luz sumada) y la forma encima, nítida
    if (L.glow) {
      const col = ppal[typeof q.shape.pal[2] === 'number' ? q.shape.pal[2] : 3], gw = w * 1.7;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * L.glow * 0.75;
      g.drawImage(glowCanvas(col), q.x - gw / 2, q.y - gw / 2, gw, gw);
      g.globalCompositeOperation = prev;
    }
    g.globalAlpha = alpha;
    const cv = shapeCanvas(popping ? F('ring', [W, 3, 3, W]) : q.shape, ppal);
    const rot = L.spin ? (q.rot + Math.floor(q.t * 5)) % 4 : 0, flip = L.flip ? (Math.floor(q.t * 8 + q.seed) % 2 === 0) !== q.flip : q.flip && !L.spin;
    if (rot || flip) {
      g.save(); g.translate(x + w / 2, y + w / 2);
      if (rot) g.rotate(rot * Math.PI / 2);
      if (flip) g.scale(-1, 1);
      g.drawImage(cv, -w / 2, -w / 2, w, w); g.restore();
    } else g.drawImage(cv, x, y, w, w);
    g.globalAlpha = 1;
  }
}

// ---------- Los retratos con efectos: un bucle para todos, solo los que están en la página y se ven ----------
const entries = new Set();
const byCanvas = new WeakMap();
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(list => {
  for (const x of list) { const e = byCanvas.get(x.target); if (e) e.visible = x.isIntersecting; }
}) : null;
let running = false, last = 0;
function loop(now) {
  if (!entries.size) { running = false; return; }
  requestAnimationFrame(loop);
  if (now - last < 1000 / FPS) return;
  last = now;
  const live = [];
  for (const e of entries) {
    if (!e.c.isConnected) {
      if (now - e.t0 > 1500) { entries.delete(e); if (io) io.unobserve(e.c); }
      continue;
    }
    if (e.visible && e.c.sprite && e.c.sprite.img.naturalWidth) live.push(e);
  }
  const tiles = skinPass(live.filter(e => e.skin), now);
  for (const e of live) {
    const { c } = e, s = c.sprite, g = c.getContext('2d'), tile = tiles.get(e);
    const dt = e.last ? Math.min(0.1, (now - e.last) / 1000) : 0;
    e.last = now;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    if (tile && GL) {
      const k = s.dw / s.sw;
      g.drawImage(GL.copy, tile.x, tile.y, tile.w, tile.h, s.dx - M * k, s.dy - M * k, tile.w * k, tile.h * k);
    } else g.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, s.dx, s.dy, s.dw, s.dh);
    if (e.k) particles(e, g, dt);
  }
}

// Pone los efectos a un canvas de retrato (o al que haya dentro del nodo). skin: 'elemental', 'oro', 'holo',
// 'galaxia' o null (se pinta en el propio canvas, para que el filtro no toque las partículas); skinType: el
// tipo de la línea (paleta y dibujo de la Elemental); parts: el tipo de las partículas o null. Sus colores son
// siempre los de su tipo, con cualquier skin. Con skin hace falta WebGL (skinGL): si no, la pone applySkin con CSS
export function portraitFx(node, { skin = null, skinType = null, parts = null } = {}) {
  const c = node instanceof HTMLCanvasElement ? node : node.querySelector && node.querySelector('canvas');
  if (!c || c.dataset.fx) return;
  if (skin && !skinGL()) skin = null;
  if (!skin && !parts) return;
  c.dataset.fx = '1';
  const e = { c, node, skin, type: skinType, k: parts ? kind(parts) : null, ppal: parts ? elementalPalette(parts, Data.TYPE_COLOR[parts]).map(hex) : null,
    parts: [], t0: performance.now(), last: 0, visible: true };
  entries.add(e);
  byCanvas.set(c, e);
  if (io) io.observe(c);
  if (!running) { running = true; requestAnimationFrame(loop); }
}
