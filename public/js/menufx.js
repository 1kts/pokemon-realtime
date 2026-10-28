// Skins y partículas en los menús (retratos y avatar). La skin es el mismo shader que en combate (skinshader.js):
// un renderer WebGL fuera de la página pinta el fotograma que enseña el retrato (c.sprite, ver sprites.js) con su
// skin, a la resolución del pixel art y con un margen para las llamas y el contorno de la Elemental, y se copia
// escalado al canvas del retrato en lugar del sprite. Los retratos que se ven van todos en una pasada (un atlas),
// a FPS. Las partículas (otro premio, con cualquier skin) son pequeñas de pixel art por encima (brasas, burbujas,
// chispas, hojas, copos, humo o destellos). Sin WebGL, la skin es el filtro CSS skin-* (skinCss).
import * as THREE from 'three';
import { elementalPalette } from './skinfx.js';
import { skinUniforms, skinMaterial, setSkin, skinClock } from './skinshader.js';

const FPS = 24;
const M = 3;            // margen alrededor del fotograma, en píxeles de arte (llamas y contorno de la Elemental)
const ATLAS_W = 1024;   // ancho del atlas: los fotogramas se colocan por filas
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Partícula de cada tipo: forma (celdas de [dx, dy, 0 borde | 1 centro]), colores y movimiento.
// Cada tipo tiene las suyas (normal, las genéricas), aunque de momento solo se reparten las del tipo de la línea
const DOT = [[0, 0, 1]], PLUS = [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
const RING = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [-1, -1, 1]];
const LEAF = [[0, 0, 1], [1, -1, 0], [-1, 1, 0]];
const EMBER = [[0, 0, 1], [0, -1, 0], [1, 0, 0]];
const PEBBLE = [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
const DIAMOND = [[0, 0, 1], [0, -1, 1], [0, -2, 0], [0, 1, 0], [-1, -1, 0], [1, -1, 0]];
const HEART = [[-1, -1, 0], [1, -1, 0], [-1, 0, 1], [0, 0, 1], [1, 0, 1], [0, 1, 0]];
const FEATHER = [[0, 0, 1], [1, -1, 0], [-1, 1, 0], [2, -2, 0]];
function kind(type) {
  switch (type) {
    case 'fuego': return { shapes: [EMBER, DOT, PLUS], vy: -1, vx: 0.15 };
    case 'agua': return { shapes: [RING, DOT], vy: -0.6, vx: 0.1, wobble: true };
    case 'electrico': return { shapes: [PLUS, DOT], vy: -0.3, vx: 1.2 };
    case 'planta': case 'bicho': return { shapes: [LEAF, DOT], vy: 0.35, vx: 0.4, wobble: true };
    case 'hielo': return { shapes: [PLUS, DOT], vy: 0.3, vx: 0.2, wobble: true };
    case 'fantasma': case 'siniestro': case 'veneno': return { shapes: [RING, DOT], vy: -0.4, vx: 0.15 };
    case 'lucha': return { shapes: [PLUS, DOT], vy: -0.2, vx: 1.4 };
    case 'tierra': case 'roca': return { shapes: [PEBBLE, DOT], vy: 0.6, vx: 0.25 };
    case 'volador': return { shapes: [FEATHER, DOT], vy: 0.3, vx: 0.5, wobble: true };
    case 'psiquico': return { shapes: [RING, PLUS], vy: -0.3, vx: 0.3 };
    case 'dragon': return { shapes: [DIAMOND, EMBER], vy: -0.7, vx: 0.2 };
    case 'acero': return { shapes: [DIAMOND, PLUS], vy: -0.2, vx: 0.1 };
    case 'hada': return { shapes: [HEART, PLUS], vy: -0.5, vx: 0.2, wobble: true };
    default: return { shapes: [PLUS, DOT], vy: -0.4, vx: 0.2 };
  }
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

// Partículas de un retrato: nacen en un punto del sprite y se mueven un poco, sin salir de él apenas
function particles(e, g, dt) {
  const { k, ppal, parts, c } = e, s = c.sprite, size = c.width;
  const px = Math.max(1, Math.round(size / 40));   // un píxel de arte, más o menos
  const cells = solidCells(s), sc = s.dw / s.sw;
  if (cells.length && Math.random() < dt * 14) {
    const i = cells[Math.floor(Math.random() * cells.length)];
    parts.push({ x: s.dx + (i % s.sw + Math.random()) * sc, y: s.dy + (Math.floor(i / s.sw) + Math.random()) * sc, life: 0.45 + Math.random() * 0.3, t: 0,
      shape: k.shapes[Math.floor(Math.random() * k.shapes.length)],
      vx: (Math.random() - 0.5) * 2 * k.vx * size * 0.15, vy: k.vy * size * 0.15 * (0.6 + Math.random() * 0.6), seed: Math.random() * 6 });
  }
  for (let n = parts.length - 1; n >= 0; n--) {
    const q = parts[n];
    q.t += dt;
    if (q.t >= q.life) { parts.splice(n, 1); continue; }
    q.x += (q.vx + (k.wobble ? Math.sin((q.t + q.seed) * 8) * size * 0.05 : 0)) * dt;
    q.y += q.vy * dt;
    g.globalAlpha = Math.min(1, (1 - q.t / q.life) * 2);
    for (const [dx, dy, core] of q.shape) {
      const col = core ? ppal[3] : ppal[2];
      g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      g.fillRect(Math.round(q.x + dx * px), Math.round(q.y + dy * px), px, px);
    }
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
