// Mapa de región montado con tiles pixel art (arte propio a partir de packs CC0, no el mapa oficial).
// Suelo, agua, costa y acantilados: "Zelda-like tilesets" de ArMM1998 (public/maptiles/overworld.png).
// Árboles, bosques y casas: "Tiny Town" de Kenney (public/maptiles/tinytown.png). Caminos y rutas
// marinas se pintan píxel a píxel con la paleta de los packs. Los nombres van en HTML.
// Coordenadas en % (las mismas que los nodos de tools/regions-src.js).

export const REGION_ART = {
  kanto: {
    shape: 'M2,10 Q4,2 18,3 L60,2 Q80,1 92,8 Q99,18 97,40 Q99,62 94,78 Q88,92 70,94 L58,99 Q40,100 30,92 Q14,99 6,92 Q0,80 3,60 Q0,40 2,26 Z',
    islands: [[12, 96, 4, 3], [26, 96, 3, 2]],
    cities: [['Pueblo Paleta', 18, 86, 3], ['Ciudad Verde', 18, 64, 4], ['Ciudad Plateada', 18, 28, 4], ['Ciudad Celeste', 64, 22, 5], ['Ciudad Azafrán', 64, 44, 7],
      ['Ciudad Carmín', 64, 70, 5], ['Pueblo Lavanda', 88, 46, 3], ['Ciudad Azulona', 40, 46, 6], ['Ciudad Fucsia', 48, 84, 5], ['Isla Canela', 12, 96, 3], ['Meseta Añil', 6, 10, 3]],
    roads: [[[18, 86], [18, 64], [18, 42], [18, 28]], [[18, 64], [8, 62], [6, 46], [6, 32], [6, 10]], [[18, 28], [30, 26], [42, 20], [52, 24], [64, 22]],
      [[64, 22], [64, 10], [76, 8]], [[64, 22], [64, 44], [64, 70]], [[64, 22], [76, 22], [88, 28], [88, 46]], [[88, 46], [76, 46], [64, 44], [50, 46], [40, 46]],
      [[64, 70], [76, 70], [88, 64], [88, 46]], [[88, 64], [82, 80], [72, 86], [60, 86], [48, 84]], [[40, 46], [30, 46], [26, 62], [34, 80], [48, 84]], [[18, 64], [44, 64], [64, 70]]],
    sea: [[[48, 84], [48, 98], [36, 96], [26, 96], [12, 96]], [[12, 96], [14, 86], [18, 86]]],
    mountains: [[42, 17, 1.2], [37, 21, 0.9], [47, 22, 0.8], [6, 30, 1.1], [10, 35, 0.8], [3, 22, 0.8], [88, 37, 1], [92, 41, 0.8], [30, 14, 0.7], [80, 14, 0.8]],
    forests: [[18, 42, 5], [48, 93, 4], [30, 60, 3], [80, 58, 3], [52, 32, 3]],
    lakes: [[48, 94, 2.5, 1.8], [72, 60, 2, 1.4]],
  },
  johto: {
    shape: 'M6,10 Q8,3 18,4 L46,2 Q70,0 86,4 Q99,8 98,26 Q100,46 96,66 Q99,84 90,96 L60,98 Q40,96 30,92 Q24,86 25,76 Q22,62 24,52 Q20,42 19,36 Q12,34 8,26 Q4,18 6,10 Z',
    islands: [[4, 52, 4, 5], [16, 66, 3, 2.5]],
    cities: [['Pueblo Primavera', 90, 74, 3], ['Ciudad Cerezo', 74, 68, 3], ['Ciudad Malva', 58, 42, 5], ['Pueblo Azalea', 44, 78, 3], ['Ciudad Trigal', 32, 52, 8], ['Ciudad Iris', 42, 12, 5],
      ['Ciudad Olivo', 16, 32, 5], ['Ciudad Orquídea', 4, 52, 3], ['Pueblo Caoba', 72, 22, 3], ['Ciudad Endrino', 92, 26, 4], ['Liga Pokémon', 82, 92, 3]],
    roads: [[[90, 74], [82, 72], [74, 68], [72, 60], [66, 46], [58, 42]], [[58, 42], [58, 58], [56, 70], [50, 80], [44, 78]], [[44, 78], [32, 76], [32, 64], [32, 52]],
      [[32, 52], [32, 40], [42, 34], [48, 28], [58, 42]], [[42, 34], [42, 22], [42, 12]], [[42, 12], [28, 14], [18, 20], [16, 32]], [[42, 12], [56, 14], [62, 20], [72, 22]],
      [[72, 22], [72, 12], [74, 6]], [[72, 22], [80, 22], [88, 14], [92, 26]], [[92, 26], [92, 42], [88, 58], [82, 72]], [[90, 74], [96, 62], [96, 82], [82, 92]], [[58, 42], [48, 50], [32, 52]]],
    sea: [[[16, 32], [12, 44], [8, 60], [4, 52]], [[8, 60], [16, 66]]],
    mountains: [[62, 16, 1.1], [57, 19, 0.8], [67, 21, 0.8], [86, 12, 1], [91, 15, 0.9], [96, 9, 1], [98, 40, 0.8], [93, 46, 0.7], [24, 8, 0.8], [12, 14, 0.9]],
    forests: [[32, 76, 5], [42, 34, 3], [70, 50, 3], [28, 40, 3], [84, 84, 3]],
    lakes: [[74, 6, 4, 2.6], [96, 13, 2.2, 1.6], [48, 50, 1.6, 1.1]],
  },
};

// ---------- Mapa real (opcional) ----------
// Si existe public/maps/{región}.png (lo genera tools/fetch-maps.js a partir del mapa del Pokégear
// de HeartGold/SoulSilver; no se sube al repo), se usa como fondo con estas posiciones, en píxeles
// del mapa original. crop = [x, y, ancho, alto] igual que en tools/fetch-maps.js.
const REAL_MAPS = {
  kanto: {
    crop: [190, 24, 186, 124],
    cities: [['Pueblo Paleta', 260, 108], ['Ciudad Verde', 256, 80], ['Ciudad Plateada', 264, 40], ['Ciudad Celeste', 328, 48], ['Ciudad Azafrán', 328, 72],
      ['Ciudad Carmín', 328, 96], ['Pueblo Lavanda', 356, 76], ['Ciudad Azulona', 304, 80], ['Ciudad Fucsia', 304, 120], ['Isla Canela', 260, 140]],
    nodes: {
      'k-ruta1': [260, 95], giovanni: [256, 80], 'k-ruta2': [262, 59], brock: [264, 40], 'k-ruta3': [292, 43], misty: [328, 48], 'k-ruta24': [345, 28],
      'k-ruta6': [324, 84], surge: [328, 96], 'k-ruta11': [356, 56], 'k-tunelroca': [344, 76], erika: [304, 80], 'k-torre': [356, 100],
      'k-ruta15': [284, 104], koga: [304, 120], 'k-safari': [304, 104], sabrina: [328, 72], 'k-ruta19': [284, 140], 'k-espuma': [260, 124],
      blaine: [260, 140], 'k-ruta23': [228, 78], lorelei: [228, 58], bruno: [214, 55], agatha: [201, 50], lance: [197, 39], azul: [208, 31],
    },
  },
  johto: {
    crop: [0, 8, 236, 152],
    cities: [['Pueblo Primavera', 172, 116], ['Ciudad Cerezo', 136, 116], ['Ciudad Malva', 120, 80], ['Pueblo Azalea', 104, 132], ['Ciudad Trigal', 84, 104],
      ['Ciudad Iris', 96, 56], ['Ciudad Olivo', 72, 80], ['Ciudad Orquídea', 44, 104], ['Pueblo Caoba', 132, 60], ['Ciudad Endrino', 168, 56]],
    nodes: {
      'j-ruta29': [154, 116], 'j-oscura': [150, 94], falkner: [120, 80], 'j-ruta32': [115, 104], 'j-ruta33': [117, 122], bugsy: [104, 132],
      'j-encinar': [90, 121], whitney: [84, 104], 'j-ruta35': [107, 88], 'j-ruta37': [100, 70], morty: [96, 56], 'j-ruta38': [76, 58],
      'j-ruta41': [60, 104], chuck: [44, 104], jasmine: [72, 80], 'j-ruta42': [116, 60], 'j-ruta43': [132, 32], pryce: [132, 60],
      'j-ruta44': [150, 60], clair: [168, 56], 'j-guarida': [164, 80], 'j-ruta46': [208, 110],
      will: [227, 58], kogaj: [215, 48], brunoj: [203, 38], karen: [191, 28], lancej: [179, 19],
    },
  },
};
const realOk = {};
const realProbe = {};
// Comprueba (una vez) si la imagen del mapa real está disponible. Devuelve una promesa de true/false.
export function probeRealMap(region) {
  if (!REAL_MAPS[region]) return Promise.resolve(false);
  return realProbe[region] || (realProbe[region] = new Promise(ok => {
    const i = new Image();
    i.onload = () => ok(realOk[region] = true);
    i.onerror = () => ok(realOk[region] = false);
    i.src = `/maps/${region}.png`;
  }));
}
// Disposición del mapa real ya comprobado: { src, cities: [[nombre, x%, y%]], pos(node) -> [x%, y%] }.
// undefined = aún sin comprobar, null = no hay mapa real (se usa el de tiles).
export function realMapLayout(region) {
  if (realOk[region] === undefined) return undefined;
  if (!realOk[region]) return null;
  const m = REAL_MAPS[region], [x0, y0, w, h] = m.crop;
  const pct = ([x, y]) => [+((x - x0) / w * 100).toFixed(2), +((y - y0) / h * 100).toFixed(2)];
  return {
    src: `/maps/${region}.png`,
    cities: m.cities.map(([name, x, y]) => [name, ...pct([x, y])]),
    pos: n => (m.nodes[n.id] ? pct(m.nodes[n.id]) : [n.x, n.y]),
  };
}
for (const r of Object.keys(REAL_MAPS)) probeRealMap(r);

const TILE = 16, COLS = 64, ROWS = 40, OUT = 2;   // rejilla de 64x40 tiles; se exporta a 2x
const W = COLS * TILE, H = ROWS * TILE;
const SHEETS = { ow: ['/maptiles/overworld.png', 40], tt: ['/maptiles/tinytown.png', 12] };

// Tiles (índice dentro de su hoja)
const OW = {
  water: 283, ripples: [123, 124, 125, 163, 164, 165], waves: [41, 42, 81, 82],
  grass: [0, 0, 0, 405, 365], flowers: [320, 321, 443, 483],
  // Costa por esquinas (tl,tr,bl,br; 1 = tierra): orilla de estanque y esquinas de isla
  coast: { 12: 243, 3: 323, 10: 282, 5: 284, 14: 242, 13: 244, 11: 322, 7: 324, 1: 362, 2: 363, 4: 402, 8: 403 },
};
const TT = {
  forest: { nw: 6, n: 7, ne: 8, w: 18, c: 19, e: 20, sw: 30, s: 31, se: 32 },
  trees: [16, 16, 28, 4, 5, 15, 27],
  big: [[[48, 51, 50], [60, 63, 62], [84, 85, 75]], [[52, 51, 54], [64, 63, 66], [84, 85, 75]]],   // casas con buhardilla
  small: [[[52, 54], [64, 66], [86, 75]], [[48, 50], [60, 62], [86, 75]]],
  center: [[52, 55, 54], [64, 67, 66], [88, 89, 79]],   // edificio grande con tejado rojo (Centro Pokémon)
};
const PATH = { fill: [232, 196, 132], light: [246, 218, 160], dark: [196, 150, 96], edge: [98, 140, 52] };

// Monte pixel art de w x h: ladera izquierda iluminada, derecha en sombra, nieve opcional y contorno.
const MCOL = { out: [61, 42, 50], light: [204, 168, 120], mid: [168, 128, 88], shade: [124, 90, 64], snow: [248, 250, 255], snowShade: [192, 206, 226] };
function mountainSprite(w, h, snow, r) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const peak = w * (0.42 + r() * 0.16);
  const jag = Array.from({ length: h }, () => (r() - 0.5) * 2);
  const inShape = (x, y) => {
    if (y < 1 || y >= h) return false;
    const t = y / h, half = t * w / 2 + jag[y] * t;
    return x >= peak - half * (peak / (w / 2)) && x <= peak + half * ((w - peak) / (w / 2)) && x >= 0 && x < w;
  };
  const snowLine = h * (0.28 + r() * 0.08);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inShape(x, y)) continue;
    const edge = !inShape(x - 1, y) || !inShape(x + 1, y) || !inShape(x, y - 1) || y === h - 1;
    const ridge = peak + (y / h) * w * 0.08;
    const left = x < ridge;
    let col = edge ? MCOL.out : left ? (x < ridge - w * 0.18 * (y / h) - 2 ? MCOL.light : MCOL.mid) : MCOL.shade;
    if (!edge && snow && y < snowLine + Math.sin(x * 1.3) * 2) col = left ? MCOL.snow : MCOL.snowShade;
    if (!edge && !snow && y > h * 0.55 && (x * 7 + y * 13) % 29 === 0) col = MCOL.shade;
    const o = (y * w + x) * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const imgs = {};
const loadImg = src => imgs[src] || (imgs[src] = new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; }));
const cache = new Map();

// Devuelve (promesa) una URL con el mapa de la región. Se genera una vez y se cachea.
export function regionMapImage(region) {
  if (!cache.has(region)) cache.set(region, build(region));
  return cache.get(region);
}

async function build(region) {
  const [ow, tt] = await Promise.all([loadImg(SHEETS.ow[0]), loadImg(SHEETS.tt[0])]);
  const art = REGION_ART[region];
  const r = rng(region.length * 977 + 13);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const put = (sheet, idx, cx, cy) => {
    const [img, cols] = sheet === 'ow' ? [ow, SHEETS.ow[1]] : [tt, SHEETS.tt[1]];
    g.drawImage(img, (idx % cols) * TILE, Math.floor(idx / cols) * TILE, TILE, TILE, cx * TILE, cy * TILE, TILE, TILE);
  };
  const pick = a => a[(r() * a.length) | 0];
  const at = (x, y) => [Math.round(x / 100 * COLS), Math.round(y / 100 * ROWS)];   // % -> celda
  const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
  const key = (cx, cy) => cy * COLS + cx;

  // 1) Tierra en los vértices de la rejilla: forma de la región + islas, menos lagos
  const land = new Path2D();
  land.addPath(new Path2D(art.shape), new DOMMatrix().scale(W / 100, H / 100));
  const inEll = (px, py, [x, y, rx, ry], grow = 0) => ((px - x) / (rx + grow)) ** 2 + ((py - y) / (ry * 2.24 + grow * 1.6)) ** 2 < 1;
  const V = new Uint8Array((COLS + 1) * (ROWS + 1));
  const vk = (vx, vy) => vy * (COLS + 1) + vx;
  for (let vy = 0; vy <= ROWS; vy++) for (let vx = 0; vx <= COLS; vx++) {
    const px = vx / COLS * 100, py = vy / ROWS * 100;
    let l = g.isPointInPath(land, vx * TILE, vy * TILE) || art.islands.some(i => inEll(px, py, i, 0.6));
    if (l && art.lakes.some(k => inEll(px, py, k, 0.8))) l = false;
    V[vk(vx, vy)] = l ? 1 : 0;
  }
  // Sin diagonales (no hay tile para ellas): se rellenan con tierra
  for (let pass = 0; pass < 4; pass++) for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const a = vk(cx, cy), b = vk(cx + 1, cy), d = vk(cx, cy + 1), e = vk(cx + 1, cy + 1);
    if (V[a] === V[e] && V[b] === V[d] && V[a] !== V[b]) V[a] = V[b] = V[d] = V[e] = 1;
  }
  const corners = (cx, cy) => V[vk(cx, cy)] << 3 | V[vk(cx + 1, cy)] << 2 | V[vk(cx, cy + 1)] << 1 | V[vk(cx + 1, cy + 1)];
  const K = new Uint8Array(COLS * ROWS);
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) K[key(cx, cy)] = corners(cx, cy);
  const solid = (cx, cy) => inside(cx, cy) && K[key(cx, cy)] === 15;
  const used = new Uint8Array(COLS * ROWS);   // celdas ocupadas (camino, ciudad, monte, bosque...)

  // 2) Suelo: agua, costa y hierba
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    const k = K[key(cx, cy)];
    if (k === 15) put('ow', pick(OW.grass), cx, cy);
    else if (k === 0) put('ow', r() < 0.06 ? pick(OW.ripples) : OW.water, cx, cy);
    else { put('ow', OW.water, cx, cy); put('ow', OW.coast[k], cx, cy); }
  }
  // Mar profundo: más oscuro cuanto más lejos de la costa (bandas, como en los mapas de GBA)
  const dist = new Int16Array(COLS * ROWS).fill(-1);
  const queue = [];
  for (let i = 0; i < COLS * ROWS; i++) if (K[i]) { dist[i] = 0; queue.push(i); }
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], cx = i % COLS, cy = (i / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (inside(nx, ny) && dist[key(nx, ny)] < 0) { dist[key(nx, ny)] = dist[i] + 1; queue.push(key(nx, ny)); }
    }
  }
  for (let i = 0; i < COLS * ROWS; i++) {
    const d = dist[i];
    if (d < 2) continue;
    g.fillStyle = `rgba(8,30,90,${Math.min(0.32, (d - 1) * 0.08)})`;
    g.fillRect((i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
    if (d >= 3 && r() < 0.035) put('ow', pick(OW.waves), i % COLS, (i / COLS) | 0);
  }

  // 3) Caminos (píxel a píxel): tierra con borde y motas, solo sobre tierra
  const segs = [];
  for (const l of art.roads) for (let i = 1; i < l.length; i++) segs.push([l[i - 1][0] / 100 * W, l[i - 1][1] / 100 * H, l[i][0] / 100 * W, l[i][1] / 100 * H]);
  const img = g.getImageData(0, 0, W, H), px = img.data;
  const RW = 3.2;   // medio ancho del camino en píxeles
  const mask = new Uint8Array(W * H);   // 2 = camino, 1 = borde
  for (const [ax, ay, bx, by] of segs) {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - 6)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + 6));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - 6)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + 6));
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = K[key((x / TILE) | 0, (y / TILE) | 0)];
      if (k !== 15) continue;
      const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / L));
      const d = Math.hypot(ax + t * dx - x - 0.5, ay + t * dy - y - 0.5);
      const o = (y * W + x) * 4;
      if (d < RW) {
        mask[y * W + x] = 2;
        const h = (x * 73856093 ^ y * 19349663) >>> 0;
        const col = h % 23 === 0 ? PATH.dark : h % 17 === 0 ? PATH.light : PATH.fill;
        px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2];
        used[key((x / TILE) | 0, (y / TILE) | 0)] = 1;
      } else if (d < RW + 1.2 && !mask[y * W + x]) {
        mask[y * W + x] = 1;
        px[o] = PATH.edge[0]; px[o + 1] = PATH.edge[1]; px[o + 2] = PATH.edge[2];
      }
    }
  }
  g.putImageData(img, 0, 0);

  // 4) Ciudades: plaza de tierra clara y una fila (o dos) de casas pegadas, como una calle
  const towns = art.cities.map(([name, x, y, size]) => {
    const rows = size >= 7 ? [[TT.center, TT.big[0]], [TT.big[1], TT.small[0]]]
      : size >= 5 ? [[TT.center, TT.big[0], TT.small[1]]]
      : size >= 4 ? [[TT.big[1], TT.small[0]]] : [[pick(TT.small)]];
    const w = Math.max(...rows.map(rw => rw.reduce((s2, hs) => s2 + hs[0].length, 0))), h = rows.length * 3;
    const [cx, cy] = at(x, y);
    return { rows, x0: cx - (w >> 1), y0: cy - (h >> 1), w, h };
  });
  for (const t of towns) {
    for (let y = t.y0 - 1; y <= t.y0 + t.h; y++) for (let x = t.x0 - 1; x <= t.x0 + t.w; x++) if (inside(x, y)) used[key(x, y)] = 1;
    const bx = t.x0 * TILE - 7, by = t.y0 * TILE - 5, bw = t.w * TILE + 14, bh = t.h * TILE + 12;
    g.fillStyle = `rgb(${PATH.edge})`; g.fillRect(bx - 1, by, bw + 2, bh); g.fillRect(bx, by - 1, bw, bh + 2);
    g.fillStyle = `rgb(${PATH.fill})`; g.fillRect(bx, by, bw, bh);
    g.fillStyle = `rgb(${PATH.light})`;
    for (let i = 0; i < bw * bh / 50; i++) g.fillRect(bx + ((r() * bw) | 0), by + ((r() * bh) | 0), 1, 1);
  }

  // 5) Montes: sprites pixel art (cara iluminada, cara en sombra, nieve y contorno oscuro)
  const peaks = [];
  for (const [x, y, k] of art.mountains) {
    const n = 2 + Math.round(k * 2);
    for (let i = 0; i < n; i++) {
      const s2 = i === 0 ? 1 : 0.55 + r() * 0.3;
      const pw = Math.round(66 * k * s2), ph = Math.round(50 * k * s2);
      const bx = x / 100 * W + (i === 0 ? 0 : (r() - 0.5) * 80 * k), by = y / 100 * H + 14 * k + (i === 0 ? 0 : (r() - 0.3) * 14 * k);
      const cx = (bx / TILE) | 0, cy = ((by - 2) / TILE) | 0;
      if (!solid(cx, cy)) continue;
      peaks.push({ x: Math.round(bx - pw / 2), y: Math.round(by - ph), w: pw, h: ph, snow: s2 > 0.7 && k >= 0.8 });
    }
  }
  for (const pk of peaks) for (let y = Math.floor(pk.y / TILE); y <= Math.floor((pk.y + pk.h) / TILE); y++)
    for (let x = Math.floor((pk.x + pk.w * 0.15) / TILE); x <= Math.floor((pk.x + pk.w * 0.85) / TILE); x++) if (inside(x, y)) used[key(x, y)] = 1;

  // 6) Bosques: árboles densos y solapados; árboles sueltos y flores por el resto
  const trees = [];
  for (const [x, y, n] of art.forests) {
    const fx = x / 100 * W, fy = y / 100 * H, ra = n * 0.9 / 100 * W + 6, rb = n * 0.75 / 100 * W + 4;
    for (let ty = fy - rb; ty <= fy + rb; ty += 8) for (let tx = fx - ra; tx <= fx + ra; tx += 9) {
      const jx = tx + (r() - 0.5) * 6 + ((ty / 8) & 1) * 4, jy = ty + (r() - 0.5) * 4;
      if (((jx - fx) / ra) ** 2 + ((jy - fy) / rb) ** 2 > 1 - r() * 0.25) continue;
      const cx = (jx / TILE) | 0, cy = (jy / TILE) | 0;
      if (!solid(cx, cy) || used[key(cx, cy)] === 1) continue;
      trees.push([Math.round(jx), Math.round(jy), r() < 0.75 ? 16 : pick([4, 28])]);
      used[key(cx, cy)] = 2;
    }
  }
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    if (!solid(cx, cy) || used[key(cx, cy)]) continue;
    const v = r();
    if (v < 0.07) trees.push([cx * TILE + 8, cx * 0 + cy * TILE + 12, pick(TT.trees)]);
    else if (v < 0.11) put('ow', pick(OW.flowers), cx, cy);
  }
  // Se dibujan montes y árboles juntos, de arriba abajo, para que se solapen bien
  const sprites = [...peaks.map(pk => ({ y: pk.y + pk.h, draw: () => g.drawImage(mountainSprite(pk.w, pk.h, pk.snow, r), pk.x, pk.y) })),
    ...trees.map(([tx, ty, idx]) => ({ y: ty + 2, draw: () => g.drawImage(tt, (idx % 12) * TILE, Math.floor(idx / 12) * TILE, TILE, TILE, tx - 8, ty - 13, TILE, TILE) }))];
  sprites.sort((m, n) => m.y - n.y).forEach(sp => sp.draw());

  // 7) Casas (encima de la plaza)
  for (const t of towns) t.rows.forEach((row, ri) => {
    const rw = row.reduce((s2, hs) => s2 + hs[0].length, 0);
    let hx = t.x0 + ((t.w - rw) >> 1);
    const hy = t.y0 + ri * 3;
    for (const house of row) {
      house.forEach((line, dy) => line.forEach((idx, dx) => { if (inside(hx + dx, hy + dy)) put('tt', idx, hx + dx, hy + dy); }));
      g.fillStyle = '#3d2a32'; g.fillRect(hx * TILE, hy * TILE, 1, 3 * TILE);   // contorno izquierdo
      hx += house[0].length;
    }
  });

  // 8) Rutas marinas: puntos blancos sobre el agua
  g.fillStyle = '#eaf6ff';
  for (const l of art.sea) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = [l[i - 1][0] / 100 * W, l[i - 1][1] / 100 * H], [bx, by] = [l[i][0] / 100 * W, l[i][1] / 100 * H];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 7);
    for (let j = 0; j <= n; j++) g.fillRect(Math.round(ax + (bx - ax) * j / n) - 1, Math.round(ay + (by - ay) * j / n) - 1, 3, 3);
  }

  // Exporta a 2x sin suavizado (píxeles nítidos) con una viñeta suave
  const o = document.createElement('canvas');
  o.width = W * OUT; o.height = H * OUT;
  const og = o.getContext('2d');
  og.imageSmoothingEnabled = false;
  og.drawImage(c, 0, 0, o.width, o.height);
  const vg = og.createRadialGradient(o.width / 2, o.height / 2, o.height * 0.4, o.width / 2, o.height / 2, o.width * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  og.fillStyle = vg; og.fillRect(0, 0, o.width, o.height);
  const blob = await new Promise(ok => o.toBlob(ok, 'image/png'));
  return URL.createObjectURL(blob);
}
