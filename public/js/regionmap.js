// Mapa de región pintado por código (arte propio, no el mapa oficial): mar con oleaje, costa con
// playa, tierra con vegetación, montañas, bosques, lagos, caminos, rutas marinas y ciudades.
// Se dibuja una vez por región en un canvas y se usa como fondo; los nombres van en HTML.
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
    shape: 'M3,12 Q4,3 16,4 L46,2 Q70,0 86,4 Q99,8 98,26 Q100,46 96,66 Q99,84 90,96 L60,98 Q40,96 28,92 Q12,90 4,74 Q-1,58 3,40 Z',
    islands: [[4, 52, 4, 5], [16, 66, 3, 2.5]],
    cities: [['Pueblo Primavera', 90, 74, 3], ['Ciudad Cerezo', 74, 68, 3], ['Ciudad Malva', 58, 42, 5], ['Pueblo Azalea', 44, 78, 3], ['Ciudad Trigal', 32, 52, 8], ['Ciudad Iris', 42, 12, 5],
      ['Ciudad Olivo', 16, 32, 5], ['Ciudad Orquídea', 4, 52, 3], ['Pueblo Caoba', 72, 22, 3], ['Ciudad Endrino', 92, 26, 4], ['Liga Pokémon', 82, 92, 3]],
    roads: [[[90, 74], [82, 72], [74, 68], [72, 60], [66, 46], [58, 42]], [[58, 42], [58, 58], [56, 70], [50, 80], [44, 78]], [[44, 78], [32, 76], [32, 64], [32, 52]],
      [[32, 52], [32, 40], [42, 34], [48, 28], [58, 42]], [[42, 34], [42, 22], [42, 12]], [[42, 12], [28, 14], [18, 20], [16, 32]], [[42, 12], [56, 14], [62, 20], [72, 22]],
      [[72, 22], [72, 12], [74, 6]], [[72, 22], [80, 22], [88, 14], [92, 26]], [[92, 26], [92, 42], [88, 58], [82, 72]], [[90, 74], [96, 62], [96, 82], [82, 92]], [[58, 42], [48, 50], [32, 52]]],
    sea: [[[16, 32], [12, 44], [8, 60], [4, 52]], [[8, 60], [16, 66]]],
    mountains: [[62, 16, 1.1], [57, 19, 0.8], [67, 21, 0.8], [86, 12, 1], [91, 15, 0.9], [96, 9, 1], [98, 40, 0.8], [93, 46, 0.7], [24, 8, 0.8], [6, 18, 0.9]],
    forests: [[32, 76, 5], [42, 34, 3], [70, 50, 3], [20, 46, 3], [84, 84, 3]],
    lakes: [[74, 6, 4, 2.6], [96, 13, 2.2, 1.6], [48, 50, 1.6, 1.1]],
  },
};

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const cache = new Map();

// Devuelve un dataURL con el mapa pintado de la región (se cachea).
export function regionMapImage(region, W = 1600, H = 1000) {
  const key = region + W + 'x' + H;
  if (cache.has(key)) return cache.get(key);
  const art = REGION_ART[region];
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(region.length * 977 + 13);
  const X = x => x / 100 * W, Y = y => y / 100 * H, S = W / 100;
  const shapeOf = d => { const p = new Path2D(); p.addPath(new Path2D(d), new DOMMatrix().scale(W / 100, H / 100)); return p; };
  const land = shapeOf(art.shape);

  // Mar: profundidad y oleaje
  const sea = g.createLinearGradient(0, 0, W, H);
  sea.addColorStop(0, '#2f7cc8'); sea.addColorStop(1, '#1b4f92');
  g.fillStyle = sea; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2;
  for (let i = 0; i < 420; i++) {
    const x = r() * W, y = r() * H, w = 10 + r() * 22;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke();
  }
  // Islas
  const islands = new Path2D();
  for (const [x, y, rx, ry] of art.islands) islands.ellipse(X(x), Y(y), rx * S, ry * S * 1.4, 0, 0, Math.PI * 2);
  // Agua poco profunda alrededor de la costa
  g.save();
  g.strokeStyle = 'rgba(120,210,255,0.35)'; g.lineWidth = 34; g.lineJoin = 'round';
  g.stroke(land); g.stroke(islands);
  g.strokeStyle = 'rgba(160,230,255,0.35)'; g.lineWidth = 16; g.stroke(land); g.stroke(islands);
  g.restore();
  // Playa
  g.strokeStyle = '#e9d9a0'; g.lineWidth = 12; g.lineJoin = 'round';
  g.stroke(land); g.stroke(islands);
  // Tierra
  const grad = g.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, W * 0.65);
  grad.addColorStop(0, '#86c862'); grad.addColorStop(0.7, '#62a847'); grad.addColorStop(1, '#4d8f3a');
  g.fillStyle = grad; g.fill(land); g.fill(islands);
  // Vegetación: manchas claras y oscuras + briznas, recortadas a la tierra
  g.save(); g.clip(land);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(160,215,110,0.18)' : 'rgba(40,100,40,0.16)';
    g.beginPath(); g.ellipse(r() * W, r() * H, 20 + r() * 70, 12 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(40,90,30,0.25)'; g.lineWidth = 1.2;
  for (let i = 0; i < 2600; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 4); g.stroke(); }
  // Tierras altas alrededor de las montañas
  for (const [x, y, k] of art.mountains) {
    const hg = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), 9 * S * k);
    hg.addColorStop(0, 'rgba(150,130,90,0.55)'); hg.addColorStop(1, 'rgba(150,130,90,0)');
    g.fillStyle = hg; g.fillRect(X(x) - 10 * S * k, Y(y) - 10 * S * k, 20 * S * k, 20 * S * k);
  }
  g.restore();
  // Lagos
  for (const [x, y, rx, ry] of art.lakes) {
    g.fillStyle = '#e9d9a0'; g.beginPath(); g.ellipse(X(x), Y(y), rx * S + 5, ry * S * 1.4 + 5, 0, 0, Math.PI * 2); g.fill();
    const lg = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), rx * S);
    lg.addColorStop(0, '#2a6cc0'); lg.addColorStop(1, '#4a9be8');
    g.fillStyle = lg; g.beginPath(); g.ellipse(X(x), Y(y), rx * S, ry * S * 1.4, 0, 0, Math.PI * 2); g.fill();
  }
  // Rutas marinas
  g.setLineDash([10, 9]); g.lineCap = 'round'; g.strokeStyle = 'rgba(220,245,255,0.85)'; g.lineWidth = 4;
  for (const l of art.sea) { g.beginPath(); l.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke(); }
  g.setLineDash([]);
  // Caminos: borde oscuro, tierra y una línea central clara
  const roadPath = () => { g.beginPath(); for (const l of art.roads) l.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  roadPath(); g.strokeStyle = 'rgba(70,50,25,0.55)'; g.lineWidth = 15; g.stroke();
  roadPath(); g.strokeStyle = '#d8bf86'; g.lineWidth = 10; g.stroke();
  roadPath(); g.strokeStyle = 'rgba(255,245,210,0.6)'; g.lineWidth = 3; g.stroke();
  // Bosques: árboles con sombra, copa y brillo
  for (const [x, y, n] of art.forests) {
    const trees = [];
    for (let i = 0; i < n * 6; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * n * S * 0.9; trees.push([X(x) + Math.cos(a) * d, Y(y) + Math.sin(a) * d * 0.8]); }
    trees.sort((a, b) => a[1] - b[1]);
    for (const [tx, ty] of trees) {
      const s = 7 + r() * 5;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(tx + 3, ty + s * 0.8, s * 0.9, s * 0.35, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3e24'; g.fillRect(tx - 1.5, ty, 3, s * 0.7);
      g.fillStyle = r() < 0.5 ? '#2f7a2c' : '#286a26'; g.beginPath(); g.arc(tx, ty - s * 0.2, s, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(160,230,110,0.45)'; g.beginPath(); g.arc(tx - s * 0.35, ty - s * 0.55, s * 0.45, 0, Math.PI * 2); g.fill();
    }
  }
  // Montañas: cara iluminada, cara en sombra y nieve
  const mounts = [...art.mountains].sort((a, b) => a[1] - b[1]);
  for (const [x, y, k] of mounts) {
    const cx = X(x), by = Y(y) + 3 * S * k, h = 7 * S * k, w = 5.5 * S * k;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx + w * 0.3, by, w * 1.1, w * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a8916c'; g.beginPath(); g.moveTo(cx - w, by); g.lineTo(cx, by - h); g.lineTo(cx, by); g.fill();
    g.fillStyle = '#7c6648'; g.beginPath(); g.moveTo(cx, by - h); g.lineTo(cx + w, by); g.lineTo(cx, by); g.fill();
    g.fillStyle = '#f4f6fb'; g.beginPath(); g.moveTo(cx - w * 0.3, by - h * 0.7); g.lineTo(cx, by - h); g.lineTo(cx + w * 0.3, by - h * 0.7); g.lineTo(cx + w * 0.1, by - h * 0.62); g.lineTo(cx - w * 0.08, by - h * 0.72); g.fill();
  }
  // Ciudades: plaza y casitas con tejados de colores
  const roofs = ['#d8483a', '#3b78d8', '#e8a020', '#7a4ab8', '#2f9a5a'];
  for (const [, x, y, size] of art.cities) {
    const cx = X(x), cy = Y(y);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 3, cy + 4, size * 6 + 10, size * 3 + 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9cfb4'; g.beginPath(); g.ellipse(cx, cy, size * 6 + 8, size * 3 + 5, 0, 0, Math.PI * 2); g.fill();
    const houses = [];
    for (let i = 0; i < size * 2 + 2; i++) houses.push([cx + (r() - 0.5) * size * 10, cy + (r() - 0.5) * size * 5]);
    houses.sort((a, b) => a[1] - b[1]);
    for (const [hx, hy] of houses) {
      const w = 9 + r() * 5, h = 7 + r() * 4;
      g.fillStyle = '#f2ead8'; g.fillRect(hx - w / 2, hy - h / 2, w, h);
      g.fillStyle = roofs[(r() * roofs.length) | 0];
      g.beginPath(); g.moveTo(hx - w / 2 - 2, hy - h / 2 + 1); g.lineTo(hx, hy - h / 2 - 6); g.lineTo(hx + w / 2 + 2, hy - h / 2 + 1); g.fill();
      g.fillStyle = '#4a3a2a'; g.fillRect(hx - 1.5, hy + h / 2 - 4, 3, 4);
    }
  }
  // Viñeta y textura de papel
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(r() * W, r() * H, 2, 2); }
  const url = c.toDataURL('image/jpeg', 0.9);
  cache.set(key, url);
  return url;
}
