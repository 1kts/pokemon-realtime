/* Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
 *
 * Formas pixel art de los ataques de PokéSurvivor (js/entities/vfx.js, 23-10-2026), con licencia
 * PolyForm Noncommercial 1.0.0: https://polyformproject.org/licenses/noncommercial/1.0.0
 * (texto completo en LICENSES/PolyForm-Noncommercial-1.0.0.md). Uso no comercial.
 * Adaptado a PokéArenas: tipos en español, texturas para Three.js y forma de cada movimiento.
 *
 *   texture(shape, type, frame)   THREE.CanvasTexture pixelada (en caché)
 *   lookOf(moveKey)               { shape, pal, scale }
 *   SHAPES[shape]                 { w, h, frames, dir, spin }
 */
import * as THREE from 'three';

const H = (x, y, seed = 0) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
  const PAL = {
    fire:     ['#6b1200', '#b8300a', '#ff6a1f', '#ffb22e', '#fff2a0'],
    water:    ['#0f2f78', '#1f56c4', '#3d8bff', '#8ccaff', '#eaf7ff'],
    grass:    ['#14400f', '#24721e', '#45b23c', '#97e36c', '#eaffd0'],
    electric: ['#6b4300', '#c48a00', '#ffd21a', '#fff36a', '#ffffff'],
    psychic:  ['#5e0a3a', '#b0246e', '#ff4f9a', '#ff9fcf', '#ffe8f3'],
    ice:      ['#134a60', '#2f8aa8', '#62d2ea', '#bff3ff', '#ffffff'],
    fighting: ['#561208', '#9a2a16', '#e04a2e', '#ff9c6c', '#ffe2cc'],
    poison:   ['#2e0a3c', '#5e1f7e', '#a043d0', '#d995f2', '#f7e2ff'],
    ground:   ['#3a250c', '#6e4c1e', '#aa7c3c', '#dcb66c', '#f6e6b8'],
    flying:   ['#283c66', '#5672b0', '#93b2ff', '#d2e2ff', '#ffffff'],
    bug:      ['#2e3a06', '#5b7414', '#90b82a', '#cbe86c', '#f4ffd2'],
    rock:     ['#2e2418', '#5a4a34', '#8e7a5a', '#c6b08a', '#f0e4c6'],
    ghost:    ['#160e2c', '#33256a', '#5c48aa', '#9e8aea', '#e8deff'],
    dragon:   ['#160a50', '#2e1ea0', '#5a3cff', '#a490ff', '#e8e2ff'],
    dark:     ['#0e0a0c', '#2a2026', '#463840', '#7c6a74', '#d4c4cc'],
    steel:    ['#232d38', '#56667a', '#8c9caf', '#cad6e2', '#ffffff'],
    fairy:    ['#6a2050', '#b04a8a', '#ff8acb', '#ffc4e6', '#ffffff'],
    normal:   ['#3e3834', '#7a7068', '#c4bcb0', '#ece6dc', '#ffffff'],
    aura:     ['#0c2460', '#1c4cb0', '#3a7cff', '#90d2ff', '#ffffff']
  };
  const IDX = { o: 0, d: 1, m: 2, l: 3, w: 4 };

  function grid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(null));
    return {
      w, h, g,
      set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : null; },
      fill(fn) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) g[y][x] = c; } },
      // Contorno de 1 px alrededor de lo opaco, como en los sprites de PMD.
      outline() {
        const marks = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (g[y][x]) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = this.get(x + a, y + b); return c && c !== 'o'; })) marks.push([x, y]);
        }
        for (const [x, y] of marks) g[y][x] = 'o';
      },
      line(x0, y0, x1, y1, c, thick = 0, side = null) {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) {
          const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
          if (thick) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.get(Math.round(x + a), Math.round(y + b))) this.set(x + a, y + b, side || c);
          this.set(x, y, c);
        }
      },
      arc(cx, cy, r, a0, a1, c) {
        const n = Math.ceil(r * Math.abs(a1 - a0) * 2) + 2;
        for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
      }
    };
  }

  // ---------------- formas ----------------
  // Todas miran hacia la DERECHA (se rotan al dibujar si son direccionales).

  const SHAPES = {
    fire: { w: 15, h: 11, frames: 3, dir: true, gen(P, f) {
      const cx = 10.5, cy = 5;
      for (let x = 1; x <= 9; x++) {                               // cola que parpadea
        const t = (x - 1) / 8;
        const th = 0.5 + t * 2.6 + (H(x, f, 3) - 0.5) * 1.3;
        const yc = cy + Math.sin(x * 1.4 + f * 2.1) * 0.8 * (1 - t);
        for (let y = 0; y < P.h; y++) {
          const d = Math.abs(y - yc);
          if (d > th || (t < 0.3 && H(x, y + f * 7, 5) < 0.4)) continue;
          P.set(x, y, d < th * 0.4 && t > 0.3 ? 'l' : 'm');
        }
      }
      P.fill((x, y) => {                                           // cabeza
        const d = Math.hypot(x - cx, (y - cy) * 1.1);
        return d < 1.3 ? 'w' : d < 2.4 ? 'l' : d < 3.5 ? 'm' : null;
      });
      P.outline();
    } },
    drop: { w: 13, h: 9, dir: true, gen(P) {
      for (let x = 2; x <= 7; x++) {
        const th = (x - 2) / 5 * 2.6;
        for (let y = 0; y < P.h; y++) { const d = Math.abs(y - 4); if (d <= th) P.set(x, y, d < th * 0.5 ? 'l' : 'm'); }
      }
      P.fill((x, y) => { const d = Math.hypot(x - 8.5, y - 4); return d < 1.6 ? 'l' : d < 3.3 ? 'm' : null; });
      P.set(9, 2, 'w'); P.set(10, 3, 'w');
      P.outline();
    } },
    bubble: { w: 11, h: 11, frames: 2, gen(P, f) {
      const rx = 4.3 + f * 0.3, ry = 4.3 - f * 0.3;
      P.fill((x, y) => { const e = Math.hypot((x - 5) / rx, (y - 5) / ry); return e <= 1 ? (e > 0.76 ? 'm' : 'L') : null; });
      P.set(3, 3, 'w'); P.set(4, 3, 'w'); P.set(3, 4, 'w'); P.set(7, 7, 'l');
      P.outline();
    } },
    leaf: { w: 12, h: 7, spin: true, gen(P) {
      P.fill((x, y) => { const dx = Math.abs(x - 5.5) / 5.6, dy = (y - 3) / 2.7; return dx + dy * dy <= 1 ? (y < 3 ? 'l' : 'm') : null; });
      for (let x = 2; x <= 9; x++) P.set(x, 3, 'd');
      P.set(4, 2, 'w');
      P.outline();
    } },
    bolt: { w: 15, h: 10, frames: 2, dir: true, gen(P, f) {
      const pts = f ? [[0, 3], [4, 7], [7, 2], [10, 7], [14, 4]] : [[0, 6], [4, 2], [7, 7], [10, 2], [14, 5]];
      for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'w', 1, 'l');
      P.outline();
    } },
    shard: { w: 13, h: 7, dir: true, gen(P) {
      P.fill((x, y) => Math.abs(x - 6) / 6.2 + Math.abs(y - 3) / 3.4 <= 1 ? (y < 3 ? 'l' : 'm') : null);
      for (let x = 6; x <= 11; x++) P.set(x, 3, 'w');
      P.set(4, 2, 'w');
      P.outline();
    } },
    rock: { w: 12, h: 11, frames: 3, spin: true, gen(P, f) {
      const r = [0, 1, 2, 3, 4, 5, 6].map(i => 3.6 + H(i, f, 9) * 1.4);
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 5, a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 6;
        const i = Math.floor(a), t = a - i;
        const R = r[i] * (1 - t) + r[(i + 1) % 6] * t;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.35 ? 'l' : lit > -0.3 ? 'm' : 'd';
      });
      P.set(6, 5, 'd'); P.set(7, 6, 'd'); P.set(4, 3, 'w');
      P.outline();
    } },
    blob: { w: 12, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const dx = x - 5.5, dy = y - 4.8, a = Math.atan2(dy, dx);
        const R = 3.9 + Math.sin(a * 3 + f * 2) * 0.5;
        const d = Math.hypot(dx, dy);
        if (d > R) return null;
        const lit = (-dx * 0.6 - dy * 0.8) / R;
        return lit > 0.4 ? 'l' : lit > -0.35 ? 'm' : 'd';
      });
      P.set(4, 3, 'w'); P.set(3, 3, 'w');
      P.set(6, 9, 'm'); if (f) P.set(6, 10, 'm');                   // gota que cuelga
      P.outline();
    } },
    needle: { w: 13, h: 5, dir: true, gen(P) {
      for (let x = 1; x <= 9; x++) P.set(x, 2, 'm');
      for (let x = 3; x <= 8; x++) P.set(x, 1, 'l');
      P.set(10, 2, 'w'); P.set(11, 2, 'w');
      P.set(1, 1, 'd'); P.set(1, 3, 'd');
      P.outline();
    } },
    star: { w: 11, h: 11, frames: 2, spin: true, gen(P, f) {
      const L = f ? 3 : 4;
      for (let i = -L; i <= L; i++) { P.set(5 + i, 5, Math.abs(i) === L ? 'm' : 'l'); P.set(5, 5 + i, Math.abs(i) === L ? 'm' : 'l'); }
      const D = f ? 2 : 1;
      for (let i = 1; i <= D; i++) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) P.set(5 + a * i, 5 + b * i, 'l');
      P.set(5, 5, 'w'); P.set(4, 5, 'w'); P.set(6, 5, 'w'); P.set(5, 4, 'w'); P.set(5, 6, 'w');
    } },
    streak: { w: 15, h: 5, dir: true, gen(P) {
      for (let x = 0; x < 15; x++) P.set(x, 2, x < 4 ? 'd' : x < 8 ? 'm' : x < 12 ? 'l' : 'w');
      for (let x = 7; x <= 12; x++) { P.set(x, 1, 'l'); P.set(x, 3, 'm'); }
      P.set(13, 1, 'w'); P.set(13, 3, 'w');
    } },
    wind: { w: 13, h: 11, frames: 2, spin: true, gen(P, f) {
      P.arc(6, 5, 4.6, -0.6 + f * 0.7, 2.9 + f * 0.7, 'l');
      P.arc(6, 5, 3.6, -0.3 + f * 0.7, 2.2 + f * 0.7, 'w');
      P.arc(6, 5, 2.2, 1.8 + f, 4.6 + f, 'l');
    } },
    web: { w: 11, h: 11, spin: true, gen(P) {
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; P.line(5, 5, 5 + Math.cos(a) * 5, 5 + Math.sin(a) * 5, 'l'); }
      for (const r of [2.4, 4.4]) for (let k = 0; k < 8; k++) {
        const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
        P.line(5 + Math.cos(a0) * r, 5 + Math.sin(a0) * r, 5 + Math.cos(a1) * r, 5 + Math.sin(a1) * r, 'w');
      }
    } },
    ring: { w: 13, h: 13, frames: 2, gen(P, f) {
      P.fill((x, y) => {
        const d = Math.hypot(x - 6, y - 6);
        if (Math.abs(d - (5 + f * 0.6)) < 0.75) return 'm';
        if (Math.abs(d - (3 + f * 0.5)) < 0.7) return 'l';
        return null;
      });
      P.set(6, 6, 'w');
    } },
    crescent: { w: 12, h: 11, dir: true, gen(P) {
      P.fill((x, y) => {
        const a = Math.hypot(x - 6.5, y - 5), b = Math.hypot(x - 3.8, y - 5);
        if (a > 4.8 || b < 4.2) return null;
        return b < 5.1 ? 'l' : 'm';
      });
      P.outline();
    } },
    note: { w: 11, h: 11, dir: true, gen(P) {
      P.arc(1, 5, 2.2, -0.7, 0.7, 'w');
      P.arc(1, 5, 4.6, -0.6, 0.6, 'l');
      P.arc(1, 5, 7.2, -0.5, 0.5, 'm');
    } },
    impact: { w: 15, h: 15, frames: 2, gen(P, f) {
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + (f ? Math.PI / 8 : 0), L = (k % 2 ? 3.5 : 6) * (f ? 1 : 0.75);
        P.line(7, 7, 7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'l');
        P.set(7 + Math.cos(a) * L, 7 + Math.sin(a) * L, 'm');
      }
      P.fill((x, y) => Math.hypot(x - 7, y - 7) < 1.8 ? 'w' : null);
    } },
    claw: { w: 13, h: 13, gen(P) {
      for (let i = 0; i < 3; i++) P.line(1 + i * 3.5, 11, 6 + i * 3.5, 1, 'w', 1, 'l');
      P.outline();
    } },
    jaws: { w: 13, h: 11, frames: 2, gen(P, f) {
      const gap = f ? 0 : 2;
      for (let x = 1; x <= 11; x++) { P.set(x, 1, 'm'); P.set(x, 9, 'm'); }
      for (let t = 0; t < 4; t++) {
        const x = 2 + t * 3;
        P.set(x, 2, 'w'); P.set(x + 1, 2, 'w'); P.set(x, 3, 'w'); P.set(x + 1, 3, 'l');
        if (!gap) { P.set(x, 4, 'w'); }
        P.set(x + 1, 8, 'w'); P.set(x + 2, 8, 'w'); P.set(x + 1, 7, 'w'); P.set(x + 2, 7, 'l');
        if (!gap) P.set(x + 1, 6, 'w');
      }
      P.outline();
    } },
    arrow: { w: 7, h: 9, gen(P) {
      for (let y = 0; y < 4; y++) for (let x = 3 - y; x <= 3 + y; x++) P.set(x, y, x === 3 - y ? 'w' : 'l');
      for (let y = 4; y < 9; y++) for (let x = 2; x <= 4; x++) P.set(x, y, x === 2 ? 'w' : 'm');
      P.outline();
    } },
    ball: { w: 11, h: 11, frames: 2, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 5, y - 5); return d < 1.5 ? 'w' : d < 2.9 ? 'l' : d < 4.2 + f * 0.3 ? 'm' : null; });
      P.set(3, 3, 'w');
      P.outline();
    } },
    shadow: { w: 13, h: 13, frames: 3, gen(P, f) {
      P.fill((x, y) => { const d = Math.hypot(x - 6, y - 6); return d < 1.6 ? 'l' : d < 3 ? 'm' : d < 4.4 ? 'd' : null; });
      for (let k = 0; k < 6; k++) {                                 // jirones de sombra
        const a = k * 1.05 + f * 0.7, r = 4.8 + H(k, f, 4) * 1.4;
        P.set(6 + Math.cos(a) * r, 6 + Math.sin(a) * r, 'm');
      }
      P.set(5, 5, 'w');
      P.outline();
    } },
    heart: { w: 9, h: 8, gen(P) {
      ['.ll...ll.', 'lwll.llll', 'lllllllll', 'lllllllll', '.lllllll.', '..lllll..', '...lll...', '....l....']
        .forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') P.set(x, y, c === 'w' ? 'w' : 'l'); }));
      P.outline();
    } }
  };


// Nuestros tipos (español) -> paleta
const TYPE_EN = { normal: 'normal', fuego: 'fire', agua: 'water', planta: 'grass', electrico: 'electric', hielo: 'ice',
  lucha: 'fighting', veneno: 'poison', tierra: 'ground', volador: 'flying', psiquico: 'psychic', bicho: 'bug', roca: 'rock',
  fantasma: 'ghost', dragon: 'dragon', siniestro: 'dark', acero: 'steel', hada: 'fairy' };
// Forma por defecto de cada tipo y la de cada movimiento concreto
const TYPE_SHAPE = { fuego: 'fire', agua: 'drop', planta: 'leaf', electrico: 'bolt', psiquico: 'ring', hielo: 'shard',
  lucha: 'impact', veneno: 'blob', tierra: 'blob', volador: 'wind', bicho: 'needle', roca: 'rock', fantasma: 'shadow',
  dragon: 'fire', siniestro: 'crescent', acero: 'shard', hada: 'star', normal: 'star' };
const MOVE_LOOK = {
  ascuas: { shape: 'fire' }, llamarada: { shape: 'fire', scale: 1.9 }, fuegoFatuo: { shape: 'fire', pal: 'ghost' },
  pistolaAgua: { shape: 'drop' }, rayoBurbuja: { shape: 'bubble' },
  impactrueno: { shape: 'bolt' }, ondaTrueno: { shape: 'bolt', scale: 1.2 },
  tornado: { shape: 'wind' }, aireAfilado: { shape: 'crescent', pal: 'flying' },
  confusion: { shape: 'ring' }, furiaDragon: { shape: 'fire', pal: 'dragon' }, ciclon: { shape: 'wind', pal: 'dragon' },
  pulsoDragon: { shape: 'ring', pal: 'dragon', scale: 1.4 }, acido: { shape: 'blob' }, bombaLodo: { shape: 'blob', scale: 1.4 },
  toxico: { shape: 'blob', scale: 1.1 }, lanzaMugre: { shape: 'blob', scale: 1.6 }, bolaSombra: { shape: 'shadow', scale: 1.4 },
  pulsoUmbrio: { shape: 'crescent', scale: 1.4 }, fuerzaLunar: { shape: 'star', scale: 1.6, pal: 'fairy' },
  disparoDemora: { shape: 'web' }, lanzarrocas: { shape: 'rock' },
};
export function lookOf(key, type) {
  const v = MOVE_LOOK[key] || {};
  return { shape: v.shape || TYPE_SHAPE[type] || 'ball', pal: v.pal || TYPE_EN[type] || 'normal', scale: v.scale || 1 };
}

const cache = new Map();
export function texture(shape, pal, frame = 0) {
  const S = SHAPES[shape] || SHAPES.ball;
  const f = (frame | 0) % (S.frames || 1);
  const k = shape + '|' + pal + '|' + f;
  let tex = cache.get(k);
  if (tex) return tex;
  const P = grid(S.w, S.h);
  S.gen(P, f);
  const cv = document.createElement('canvas');
  cv.width = S.w; cv.height = S.h;
  const c = cv.getContext('2d');
  const colors = PAL[pal] || PAL.normal;
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const ch = P.g[y][x];
    if (!ch) continue;
    c.fillStyle = ch === 'L' ? colors[3] + '80' : colors[IDX[ch]];
    c.fillRect(x, y, 1, 1);
  }
  tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, tex);
  return tex;
}
export { SHAPES, PAL };
