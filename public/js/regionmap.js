// Mapa de región genérico en SVG (arte propio, con rocas, árboles, flores y palmeras del tileset de Scarloxy):
// mar, costa con playa, tierra, montes, bosques, lagos, caminos, rutas marinas y ciudades. Al ser vectorial se ve nítido a
// cualquier tamaño. Se dibuja en un lienzo de 160x100 que la UI encaja sin deformarlo; el mar se
// extiende más allá para rellenar el hueco que sobre. Los nombres y nodos van en HTML encima.
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

export const MAP_W = 160, MAP_H = 100;   // proporción del lienzo (16:10)

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const f = n => +n.toFixed(2);
const X = x => f(x * MAP_W / 100);
// Convierte un path en % ("M2,10 Q4,2 18,3 ...") a unidades del lienzo
const scalePath = d => d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${X(+x)},${f(+y)}`);
const pts = l => l.map(([x, y]) => `${X(x)},${f(y)}`).join(' ');
// Radio de las elipses (islas, lagos): mismo criterio que el mapa anterior (1 % ancho = 16 px, 1 % alto = 10 px)
const ell = (x, y, rx, ry, grow = 0) => `<ellipse cx="${X(x)}" cy="${f(y)}" rx="${f(rx * 1.6 + grow)}" ry="${f(ry * 2.24 + grow)}"/>`;

const cache = new Map();

// Devuelve el SVG (texto) del mapa de la región. Se cachea.
export function regionMapSVG(region) {
  if (cache.has(region)) return cache.get(region);
  const a = REGION_ART[region];
  const r = rng(region.length * 977 + 13);
  const land = `<path d="${scalePath(a.shape)}"/>` + a.islands.map(([x, y, rx, ry]) => ell(x, y, rx, ry)).join('');
  const out = [];
  out.push(`<svg class="mapart" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sea-${region}" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#4fa6e8"/><stop offset="1" stop-color="#2a6fc0"/></linearGradient>
  <radialGradient id="land-${region}" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="#9edb78"/><stop offset="0.65" stop-color="#7cc45d"/><stop offset="1" stop-color="#5fa848"/></radialGradient>
  <linearGradient id="town-${region}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7b7b"/><stop offset="1" stop-color="#d9434f"/></linearGradient>
  <pattern id="waves-${region}" width="14" height="9" patternUnits="userSpaceOnUse"><path d="M1,3 q1.5,-1.2 3,0 M8,7.5 q1.5,-1.2 3,0" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width=".35" stroke-linecap="round"/></pattern>
  <pattern id="grass-${region}" width="7" height="6" patternUnits="userSpaceOnUse"><path d="M1,2 l.3,-.9 M1.6,2 l-.1,-1 M4.5,5 l.3,-.9 M5.1,5 l-.1,-1" stroke="#3f8a35" stroke-opacity=".35" stroke-width=".25" stroke-linecap="round"/></pattern>
  <clipPath id="clip-${region}">${land}</clipPath>
  <filter id="soft-${region}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="drop-${region}" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx=".25" dy=".45" stdDeviation=".3" flood-color="#000" flood-opacity=".35"/></filter>
</defs>`);
  // Mar (se sale del lienzo para rellenar el hueco de alrededor)
  out.push(`<rect x="-400" y="-400" width="${MAP_W + 800}" height="${MAP_H + 800}" fill="url(#sea-${region})"/><rect x="-400" y="-400" width="${MAP_W + 800}" height="${MAP_H + 800}" fill="url(#waves-${region})"/>`);
  // Agua poco profunda, playa y tierra
  out.push(`<g fill="none" stroke="#9fe0ff" stroke-opacity=".35" stroke-width="5" stroke-linejoin="round">${land}</g>`);
  out.push(`<g fill="none" stroke="#c4efff" stroke-opacity=".45" stroke-width="2.6" stroke-linejoin="round">${land}</g>`);
  out.push(`<g fill="#f3e2a4" stroke="#f3e2a4" stroke-width="1.4" stroke-linejoin="round">${land}</g>`);
  out.push(`<g fill="url(#land-${region})">${land}</g>`);
  // Dentro de la tierra: manchas de relieve y de bosque, textura de hierba
  const inner = [];
  for (const [x, y, k] of a.mountains) inner.push(`<ellipse cx="${X(x)}" cy="${f(y + 1)}" rx="${f(9 * k)}" ry="${f(6 * k)}" fill="#c9b07a" fill-opacity=".7" filter="url(#soft-${region})"/>`);
  for (const [x, y, n] of a.forests) inner.push(`<ellipse cx="${X(x)}" cy="${f(y)}" rx="${f(n * 1.7)}" ry="${f(n * 1.25)}" fill="#3f8f3a" fill-opacity=".45" filter="url(#soft-${region})"/>`);
  inner.push(`<rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="url(#grass-${region})"/>`);
  out.push(`<g clip-path="url(#clip-${region})">${inner.join('')}</g>`);
  // Lagos
  for (const [x, y, rx, ry] of a.lakes) out.push(`<g fill="#f3e2a4">${ell(x, y, rx, ry, 0.7)}</g><g fill="#4aa0e6">${ell(x, y, rx, ry)}</g><g fill="#7cc4f6">${ell(x - rx * 0.15, y - ry * 0.25, rx * 0.55, ry * 0.4)}</g>`);
  // Rutas marinas y caminos
  // Bien visibles: sombra, borde oscuro, cuneta y firme claro (sin línea discontinua: las líneas a dónde
  // puedes ir las pone la UI encima). Por mar, una franja de agua clara.
  const sea = a.sea.map(l => `<polyline points="${pts(l)}"/>`).join('');
  out.push(`<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#9fe0ff" stroke-opacity=".55" stroke-width="2.6">${sea}</g><g stroke="#c4efff" stroke-opacity=".7" stroke-width="1.2">${sea}</g></g>`);
  const roads = a.roads.map(l => `<polyline points="${pts(l)}"/>`).join('');
  out.push(`<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#000" stroke-opacity=".22" stroke-width="4.4" transform="translate(.25 .35)">${roads}</g><g stroke="#5a3a1a" stroke-width="3.6">${roads}</g><g stroke="#c9974e" stroke-width="2.8">${roads}</g><g stroke="#f8de98" stroke-width="2.1">${roads}</g></g>`);
  // Iconos ordenados de arriba abajo: árboles, montes y ciudades
  const icons = [];
  // Árboles y montes con los dibujos del tileset de Scarloxy (CC BY 4.0): pinos y árboles en los bosques, y cada
  // monte, un montón de rocas apiladas (las de delante, más grandes)
  const sprite = (src, x, y, w, h) => `<image href="tiles/${src}.png" x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" style="image-rendering:pixelated"/>`;
  for (const [x, y, n] of a.forests) {
    for (let i = 0; i < n * 6; i++) {
      const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * n * 0.95;
      const tx = X(x) + Math.cos(ang) * d * 1.7, ty = y + Math.sin(ang) * d * 1.2 + 2, s = 0.85 + r() * 0.4;
      icons.push([ty, sprite(r() < 0.6 ? 'pine' : 'tree', tx, ty, 3.4 * s, 5.1 * s)]);
    }
  }
  for (const [x, y, k] of a.mountains) {
    for (const [row, cnt] of [[0, 1], [1, 2], [2, 3]]) for (let i = 0; i < cnt; i++) {   // de arriba abajo: 1, 2 y 3 rocas
      const w = (4.6 + cnt * 0.6) * k, cx = X(x) + (i - (cnt - 1) / 2) * w * 0.6, by = y + row * 2.2 * k;
      icons.push([by, sprite(r() < 0.5 ? 'rock1' : 'rock2', cx, by, w, w)]);
    }
  }
  // Relleno por el campo: árboles sueltos, flores y, en la costa, palmeras; nunca sobre caminos, ciudades,
  // lagos, bosques ni montes (para no tapar nada ni amontonarse)
  if (typeof document !== 'undefined') {
    const g = document.createElement('canvas').getContext('2d'), shape = new Path2D(scalePath(a.shape));
    const onLand = (x, y) => g.isPointInPath(shape, x, y) || a.islands.some(([ix, iy, rx, ry]) => ((x - X(ix)) / (rx * 1.6)) ** 2 + ((y - iy) / (ry * 2.24)) ** 2 <= 1);
    const segDist = (px, py, [x0, y0], [x1, y1]) => {
      const ax = X(x0), bx = X(x1), dx = bx - ax, dy = y1 - y0, l = dx * dx + dy * dy;
      const k = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - y0) * dy) / l)) : 0;
      return Math.hypot(px - ax - k * dx, py - y0 - k * dy);
    };
    const free = (x, y) => onLand(x, y) &&
      a.roads.every(l => l.every((q, i) => !i || segDist(x, y, l[i - 1], q) > 3.2)) &&
      a.cities.every(([, cx, cy]) => Math.hypot(x - X(cx), y - cy) > 7) &&
      a.lakes.every(([lx, ly, rx, ry]) => Math.hypot((x - X(lx)) / (rx * 1.6 + 2), (y - ly) / (ry * 2.24 + 2)) > 1) &&
      a.forests.every(([fx, fy, n]) => Math.hypot((x - X(fx)) / (n * 1.9 + 1), (y - fy) / (n * 1.4 + 1)) > 1) &&
      a.mountains.every(([mx, my, k]) => Math.hypot((x - X(mx)) / (9 * k), (y - my - 2 * k) / (6 * k)) > 1);
    const coast = (x, y) => [[4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dy]) => !onLand(x + dx, y + dy));
    for (let i = 0, placed = 0; i < 900 && placed < 60; i++) {
      const x = r() * MAP_W, y = 4 + r() * (MAP_H - 6);
      if (!free(x, y)) continue;
      placed++;
      const c = r();
      if (coast(x, y)) { if (c < 0.6) icons.push([y, sprite('palm', x, y, 3.2, 4.8)]); continue; }
      if (c < 0.3) icons.push([y, r() < 0.4 ? sprite('pine-s', x, y, 2.2, 4.4) : sprite(r() < 0.6 ? 'pine' : 'tree', x, y, 3.2, 4.8)]);
      else if (c < 0.5) for (let t = 0; t < 3; t++) icons.push([y + (t % 2) * 1.2, sprite(['pine', 'tree'][t % 2], x + (t - 1) * 2.2, y + (t % 2) * 1.2, 3.2, 4.8)]);
      else for (let t = 0, col = Math.floor(r() * 3); t < 3 + Math.floor(r() * 3); t++) {   // macizo de flores de un color
        const fx = x + (r() - 0.5) * 3.4, fy = y + (r() - 0.5) * 2;
        icons.push([fy, sprite('flower' + (1 + col + (r() < 0.5 ? 3 : 0)), fx, fy, 2.4, 2.4)]);
      }
    }
  }
  for (const [, x, y, size] of a.cities) {
    const w = 2.6 + size * 0.55, h = 1.9 + size * 0.32, cx = X(x), cy = y;
    icons.push([cy + h / 2, `<g filter="url(#drop-${region})"><rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx=".7" fill="url(#town-${region})" stroke="#7b2431" stroke-width=".3"/><rect x="${f(cx - w / 2 + 0.45)}" y="${f(cy - h / 2 + 0.4)}" width="${f(w - 0.9)}" height="${f(h * 0.32)}" rx=".35" fill="#ffffff" fill-opacity=".28"/></g>`]);
  }
  icons.sort((m, n) => m[0] - n[0]);
  out.push(icons.map(i => i[1]).join(''));
  out.push('</svg>');
  const svg = out.join('\n');
  cache.set(region, svg);
  return svg;
}
