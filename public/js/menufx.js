// Skin Elemental en los menús (retratos y avatar): lo mismo que el shader del combate (actors.js) pero
// en el canvas del retrato: recolorea el sprite con la paleta del tipo de su línea, con parpadeo y vetas
// que suben, un contorno fino que brilla y partículas pequeñas de pixel art por encima (brasas, burbujas,
// chispas, hojas, copos, humo o destellos). Los retratos animados (animatedPortrait) llaman a c.fx tras
// cada fotograma; los fijos (portrait) se repintan aquí desde su primer dibujo.
import { elementalPalette } from './skinfx.js';

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

// Partícula de cada tipo: forma (celdas de [dx, dy, 0 borde | 1 centro]), colores y movimiento
const DOT = [[0, 0, 1]], PLUS = [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
const RING = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [-1, -1, 1]];
const LEAF = [[0, 0, 1], [1, -1, 0], [-1, 1, 0]];
const EMBER = [[0, 0, 1], [0, -1, 0], [1, 0, 0]];
function kind(type) {
  switch (type) {
    case 'fuego': return { shapes: [EMBER, DOT, PLUS], vy: -1, vx: 0.15 };
    case 'agua': return { shapes: [RING, DOT], vy: -0.6, vx: 0.1, wobble: true };
    case 'electrico': return { shapes: [PLUS, DOT], vy: -0.3, vx: 1.2 };
    case 'planta': case 'bicho': return { shapes: [LEAF, DOT], vy: 0.35, vx: 0.4, wobble: true };
    case 'hielo': return { shapes: [PLUS, DOT], vy: 0.3, vx: 0.2, wobble: true };
    case 'fantasma': case 'siniestro': case 'veneno': return { shapes: [RING, DOT], vy: -0.4, vx: 0.15 };
    default: return { shapes: [PLUS, DOT], vy: -0.4, vx: 0.2 };
  }
}

// Pone el efecto a un canvas de retrato (o al que haya dentro del nodo)
export function elementalFx(node, type, typeColor) {
  const c = node instanceof HTMLCanvasElement ? node : node.querySelector && node.querySelector('canvas');
  if (!c || c.dataset.fx) return;
  c.dataset.fx = '1';
  const pal = elementalPalette(type, typeColor).map(hex);
  const k = kind(type);
  const parts = [];
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
      if (solid[i]) {
        opaque.push(i);
        const l = Math.min(1, Math.max(0, ((0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255 - 0.08) / 0.84));
        const r = l * 3, j = Math.min(2, Math.floor(r));
        let col = mix(pal[j], pal[j + 1], r - j);
        col = mix(col, pal[3], 0.3 * l * (0.5 + 0.5 * Math.sin(cy * 0.45 + t * 9 + cx * 0.21)));
        // En pantalla, y crece hacia abajo: las vetas suben con +t
        const v = noise(cx * 0.3, cy * 0.25 + t * 6) + 0.5 * noise(cx * 0.7 + 2, cy * 0.5 + t * 10);
        if (v > 1.12) col = pal[3].map(x => x * 1.15); else if (v > 0.92) col = mix(col, pal[2].map(x => x * 1.2), 0.6);
        d[p] = Math.min(255, col[0]); d[p + 1] = Math.min(255, col[1]); d[p + 2] = Math.min(255, col[2]);
      } else if (on(x - px, y) || on(x + px, y) || on(x, y - px) || on(x, y + px)) {
        const v = noise(cx * 0.6, cy * 0.4 + t * 7);
        if (v > 0.45) { const col = v > 0.75 ? pal[3] : pal[2]; d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
    // Partículas: nacen en un punto del sprite y se mueven un poco, sin salir de él apenas
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    if (opaque.length && Math.random() < dt * 14) {
      const i = opaque[Math.floor(Math.random() * opaque.length)];
      parts.push({ x: i % w, y: Math.floor(i / w), life: 0.45 + Math.random() * 0.3, t: 0, shape: k.shapes[Math.floor(Math.random() * k.shapes.length)],
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
        const col = core ? pal[3] : pal[2];
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
