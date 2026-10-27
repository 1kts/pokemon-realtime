// Skins y partículas en los menús (retratos y avatar): lo mismo que el combate (actors.js) pero en el canvas
// del retrato. La Elemental recolorea el sprite con la paleta del tipo de su línea, con parpadeo y vetas que
// suben y un contorno fino que brilla; Oro (con su reflejo que sube), Holo y Galaxia, como en el shader; las partículas (otro premio, con cualquier skin) son
// pequeñas de pixel art por encima (brasas, burbujas, chispas, hojas, copos, humo o destellos). Los retratos animados (animatedPortrait) llaman a c.fx tras
// cada fotograma; los fijos (portrait) se repintan aquí desde su primer dibujo.
import { elementalPalette, ELEM_FAMILY } from './skinfx.js';

const FPS = 24;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const mix = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];

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

// Color de un píxel con la skin, a partir de su color original (0-255) y su luminosidad l (0-1): lo mismo
// que el shader del combate (actors.js). x, y: el píxel de arte; t: segundos; w, h: tamaño en píxeles de arte
const ORO_LO = [41, 18, 0], ORO_MID = [242, 153, 13], ORO_HI = [255, 237, 140];
const GAL_LO = [5, 8, 31], GAL_HI = [46, 61, 133], GAL_PINK = [242, 64, 191], GAL_CYAN = [51, 217, 255];
// Ruido por capas (el skinFbm del shader): las nubes de la Galaxia
const fbm = (x, y) => (0.5 * noise(x, y) + 0.25 * noise(x * 2, y * 2) + 0.125 * noise(x * 4, y * 4)) / 0.875;
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
function skinColor(skin, rgb, l, x, y, t, w, h) {
  if (skin === 'oro') {
    const g = sstep(0.05, 0.9, l);
    let c = mix(mix(ORO_LO, ORO_MID, sstep(0, 0.55, g)), ORO_HI, sstep(0.55, 1, g));
    // El reflejo: una franja blanca algo inclinada que sube por el sprite cada 2,5 s
    const band = Math.pow(Math.max(0, Math.sin(((h - y) + x * 0.5) / (h * 1.5) * Math.PI * 2 - t * 2.5)), 10);
    return mix(c, [255, 250, 225], band * 0.85);
  }
  if (skin === 'holo') {
    const k = l * 1.2 + (x + y) / (w + h) + t * 0.35;
    return [0, 0.33, 0.67].map((o, i) => rgb[i] * 0.45 + (0.5 + 0.5 * Math.cos(6.2831 * (o + k))) * 255 * 0.7);
  }
  // galaxia: cielo de noche azul, nubes de nebulosa magenta y cian que se desplazan, estrellas que parpadean
  // y alguna grande en cruz (como el shader: y hacia arriba)
  const qx = x, qy = Math.round(h) - y;
  let c = mix(GAL_LO, GAL_HI, l);
  const n1 = fbm(qx * 0.08 + t * 0.15, qy * 0.08 - t * 0.05), n2 = fbm(qx * 0.11 - t * 0.1 + 5, qy * 0.09 + t * 0.07 + 3);
  c = mix(c, GAL_PINK.map(v => v * (0.55 + 0.6 * l)), sstep(0.5, 0.85, n1) * 0.75);
  c = mix(c, GAL_CYAN.map(v => v * (0.55 + 0.6 * l)), sstep(0.55, 0.9, n2) * 0.6);
  const hs = hash(qx, qy);
  if (hs > 0.965) c = mix(c, [255, 255, 255], 0.5 + 0.5 * Math.sin(t * 4 + hs * 40));
  const bx = Math.floor(qx / 5), by = Math.floor(qy / 5), hb = hash(bx + 31.7, by + 31.7);
  if (hb > 0.82) {
    const k = Math.max(0, Math.sin(t * 2 + hb * 50)), m = Math.abs(qx - bx * 5 - 2) + Math.abs(qy - by * 5 - 2);
    if (m === 0) c = mix(c, [255, 255, 255], k); else if (m === 1) c = mix(c, [217, 242, 255], k * 0.65);
  }
  return c;
}

// Color de un píxel con la Elemental (el shader de actors.js): paleta según la luz l y el dibujo de su familia.
// qx, qy: píxel de arte con y hacia arriba
function elementalColor(pal, fam, l, qx, qy, t) {
  const r = l * 3, j = Math.min(2, Math.floor(r));
  let c = mix(pal[j], pal[j + 1], r - j);
  c = mix(c, pal[3], 0.3 * l * (0.5 + 0.5 * Math.sin(qy * 0.45 + t * 9 + qx * 0.21)));
  const up = k => pal[k].map(v => v * (k === 3 ? 1.15 : 1.1));
  if (fam === 0) {
    const v = noise(qx * 0.3, qy * 0.25 - t * 6) + 0.5 * noise(qx * 0.7 + 2, qy * 0.5 - t * 10);
    if (v > 1.12) c = up(3); else if (v > 0.92) c = mix(c, pal[2].map(x => x * 1.2), 0.6);
  } else if (fam === 1) {
    const n = noise(qx * 0.18 + t * 0.6, qy * 0.18 + t * 0.4) + noise(qx * 0.23 - t * 0.5 + 7, qy * 0.21 + t * 0.3 + 7);
    const line = 1 - Math.abs(n - 1) * 4;
    if (line > 0.6) c = mix(c, up(3), 0.8); else if (line > 0.3) c = mix(c, up(2), 0.4);
  } else if (fam === 2) {
    const s6 = Math.floor(t * 6);
    const r2 = 1 - Math.abs(noise(qx * 0.22 + s6 * 3.7, qy * 0.22) * 2 - 1);
    if (hash(s6, 1) > 0.45) { if (r2 > 0.93) c = mix(pal[3], [255, 255, 255], 0.6).map(v => v * 1.1); else if (r2 > 0.84) c = mix(c, pal[3].map(v => v * 1.2), 0.7); }
    c = mix(c, pal[3], 0.15 * (0.5 + 0.5 * Math.sin(t * 14 + qx * 0.9)));
  } else if (fam === 3) {
    const r2 = 1 - Math.abs(noise(qx * 0.2, qy * 0.2) * 2 - 1), pulse = 0.5 + 0.5 * Math.sin(qy * 0.35 - t * 3);
    if (r2 > 0.88) c = mix(c, up(3), 0.35 + 0.65 * pulse); else if (r2 > 0.8) c = mix(c, pal[2], 0.3 * pulse);
  } else {
    const n = fbm(qx * 0.1 + Math.sin(t * 0.8) * 0.6, qy * 0.1 - t * 0.4);
    c = mix(c, pal[0], sstep(0.55, 0.8, n) * 0.75);
    if (n < 0.28) c = mix(c, up(3).map(v => v * 1.04), 0.6);
  }
  return c;
}

// Pone los efectos a un canvas de retrato (o al que haya dentro del nodo). skin: 'elemental', 'oro', 'holo',
// 'galaxia' o null (se pinta en el propio canvas, para que el filtro no toque las partículas); skinType: el
// tipo de la paleta Elemental; parts: el tipo de las partículas o null. Sus colores son siempre los de su
// tipo, con cualquier skin
export function portraitFx(node, { skin = null, skinType = null, parts = null } = {}) {
  const c = node instanceof HTMLCanvasElement ? node : node.querySelector && node.querySelector('canvas');
  if (!c || c.dataset.fx) return;
  c.dataset.fx = '1';
  const pal = skin === 'elemental' ? elementalPalette(skinType, Data.TYPE_COLOR[skinType]).map(hex) : null;
  const fam = ELEM_FAMILY[skinType] ?? 2;
  const ppal = parts ? elementalPalette(parts, Data.TYPE_COLOR[parts]).map(hex) : null;
  const k = parts ? kind(parts) : null;
  const recolor = !!skin;
  const particles = [];
  const size = c.width;
  const px = Math.max(1, Math.round(size / 40));   // un píxel de arte, más o menos
  let base = null, last = 0, t0 = performance.now();

  const paint = (g, now) => {
    const w = c.width, h = c.height, t = (now - t0) / 1000;
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1;
    const opaque = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, p = i * 4;
      const cx = Math.floor(x / px), cy = Math.floor(y / px);
      if (solid[i] && !recolor) { opaque.push(i); continue; }
      if (solid[i]) {
        opaque.push(i);
        const l = Math.min(1, Math.max(0, ((0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255 - 0.08) / 0.84));
        let col;
        col = pal ? elementalColor(pal, fam, l, cx, Math.round(h / px) - cy, t) : skinColor(skin, [d[p], d[p + 1], d[p + 2]], l, cx, cy, t, w / px, h / px);
        d[p] = Math.min(255, col[0]); d[p + 1] = Math.min(255, col[1]); d[p + 2] = Math.min(255, col[2]);
      } else if (pal) {
        // Fuera de la silueta: llamas y espíritu, lenguas hacia arriba (hasta 3 px de arte); el resto, contorno de 1 px
        const qx = cx, qy = Math.round(h / px) - cy;
        let below = 0;
        if (fam === 0 || fam === 4) for (let k = 1; k <= 3 && !below; k++) if (on(x, y + k * px)) below = k;
        if (below) {
          const f = fam === 0 ? noise(qx * 0.55, qy * 0.35 - t * 9) : noise(qx * 0.4 + t * 0.7, qy * 0.25 - t * 3);
          if (f > 0.28 + 0.17 * below) {
            const col = fam === 4 ? (below === 1 ? pal[2] : pal[1]) : below === 1 ? pal[3] : below === 2 ? pal[2].map(v => v * 1.2) : pal[1].map(v => v * 1.3);
            d[p] = Math.min(255, col[0]); d[p + 1] = Math.min(255, col[1]); d[p + 2] = Math.min(255, col[2]); d[p + 3] = fam === 4 ? 190 : 255;
          }
        } else if (on(x - px, y) || on(x + px, y) || on(x, y - px) || on(x, y + px)) {
          const v = noise(qx * 0.6, qy * 0.4 - t * 7);
          if (v > 0.45) { const col = v > 0.75 ? pal[3] : pal[2]; d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255; }
        }
      }
    }
    if (recolor) g.putImageData(img, 0, 0);
    // Partículas: nacen en un punto del sprite y se mueven un poco, sin salir de él apenas
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    if (k && opaque.length && Math.random() < dt * 14) {
      const i = opaque[Math.floor(Math.random() * opaque.length)];
      particles.push({ x: i % w, y: Math.floor(i / w), life: 0.45 + Math.random() * 0.3, t: 0, shape: k.shapes[Math.floor(Math.random() * k.shapes.length)],
        vx: (Math.random() - 0.5) * 2 * k.vx * size * 0.15, vy: k.vy * size * 0.15 * (0.6 + Math.random() * 0.6), seed: Math.random() * 6 });
    }
    for (let n = particles.length - 1; n >= 0; n--) {
      const q = particles[n];
      q.t += dt;
      if (q.t >= q.life) { particles.splice(n, 1); continue; }
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
    last = now;
  };

  if (c.dataset.anim) {
    // Retrato animado: tras cada fotograma (como mucho a FPS: si no, el fotograma queda sin efecto)
    let prev = null;
    c.fx = (g, now) => {
      if (prev && now - last < 1000 / FPS) { g.putImageData(prev, 0, 0); return; }
      paint(g, now);
      prev = g.getImageData(0, 0, c.width, c.height);
    };
    return;
  }
  // Retrato fijo: se guarda su primer dibujo y se repinta encima mientras esté en la página
  const loop = now => {
    if (!c.isConnected && now - t0 > 1500) return;
    requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    const g = c.getContext('2d');
    if (!base) {
      const probe = g.getImageData(0, 0, c.width, c.height).data;
      let any = false;
      for (let i = 3; i < probe.length; i += 4) if (probe[i]) { any = true; break; }
      if (!any) return;
      base = g.getImageData(0, 0, c.width, c.height);
    }
    g.putImageData(base, 0, 0);
    paint(g, now);
  };
  requestAnimationFrame(loop);
}
