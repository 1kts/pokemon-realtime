// Escena 3D de la arena: luces, suelo, decorado, terreno dinámico (hierba alta, fuego, agua,
// vapor, quemado, hielo, veneno, telarañas, lava) y obstáculos. 1 unidad 3D = 40 px de juego.
// Cada mapa tiene su tema (suelo, luz, alrededores, rocas) y las arenas de gimnasio además sus
// elementos propios: placas eléctricas, teletransportes, baldosas de curación, faro, cascadas...
import * as THREE from 'three';
import { buildScenery, preloadScenery, WIND, mat } from './scenery.js';
import { buildMechProps, pillarMesh } from './arenamech.js';

const { CELL, COLS, ROWS, T } = Shared;
export const U = 1 / CELL;                  // px de juego -> unidades 3D
export const toWorld = (x, y, h = 0) => new THREE.Vector3(x * U, h, y * U);

// Generador pseudoaleatorio con semilla (el decorado sale igual en todos los clientes)
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

export function softDisc(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, inner); grad.addColorStop(1, outer);
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
}

// ---------- Temas ----------
// Lo lejos que está la cámara del combate (1 = la de antes; la niebla se escala igual)
const CAM_ZOOM = 1.35;
// light: fondo/niebla, cielo (degradado: arriba, horizonte), luz ambiental (cielo, suelo, intensidad) y sol (color,
// intensidad). El sol, algo cálido y fuerte, con un relleno hemisférico más suave: sombras con contraste. Cada tema
// tiñe un poco la luz (más cálida en el fuego, más fría en el hielo): es la gradación de color de la escena, y no
// toca a los ataques, que no se iluminan.
const LIGHT = {
  day: { bg: '#a9cfe8', sky: ['#6fa6d8', '#d4e6ee'], fog: [24, 62], hemi: ['#dceaf6', '#5a6a3a', 0.95], sun: ['#ffe6c4', 2.7] },
  forest: { bg: '#a8c4a0', sky: ['#7fa8c8', '#cadcc4'], fog: [20, 52], hemi: ['#d8ecd0', '#2e4a28', 0.85], sun: ['#ffe8c0', 2.4] },
  cave: { bg: '#2a2420', sky: ['#141110', '#3a302a'], fog: [18, 44], hemi: ['#c8b8a0', '#3a3028', 0.75], sun: ['#ffd8a8', 1.8] },
  lake: { bg: '#b4d8ee', sky: ['#6aa2d6', '#d8eaf2'], fog: [24, 64], hemi: ['#e0f0fa', '#5a6a5a', 1.0], sun: ['#ffecd0', 2.6] },
  indoor: { bg: '#262a36', sky: ['#1c1f2a', '#3a3e4c'], fog: [24, 58], hemi: ['#eef0ff', '#4a4a5a', 0.95], sun: ['#fff2e2', 2.3] },
  night: { bg: '#0d1122', sky: ['#05070f', '#1a2038'], fog: [16, 40], hemi: ['#6a7ab4', '#22223a', 0.8], sun: ['#8a98ff', 1] },
  sky: { bg: '#9cc8f4', sky: ['#4a8ad8', '#e0f0fa'], fog: [32, 80], hemi: ['#ffffff', '#9cc0e8', 1.15], sun: ['#fff0d8', 2.6] },
  volcano: { bg: '#2a1310', sky: ['#120808', '#5a2418'], fog: [18, 46], hemi: ['#ffb890', '#3a1010', 0.8], sun: ['#ffa070', 2.1] },
  snow: { bg: '#c4d8ea', sky: ['#8eb2d8', '#e4eef6'], fog: [20, 54], hemi: ['#eef4ff', '#7a98b8', 0.9], sun: ['#f4f6ff', 1.9] },
  glacier: { bg: '#8fb2d8', sky: ['#5a86b8', '#c8dcee'], fog: [20, 50], hemi: ['#e0eeff', '#5a7898', 0.85], sun: ['#e4eeff', 1.7] },
  dusk: { bg: '#3a2a48', sky: ['#1e1630', '#6a4a5a'], fog: [18, 46], hemi: ['#d0b0ff', '#2a2038', 0.72], sun: ['#ffc8a0', 1.7] },
};

// ground: pintor del suelo · palette: colores base · lines: líneas del campo · emblem: color del
// emblema central · outside: color de los alrededores · decor: tipo de decorado · rock: estilo y color
// de las rocas del mapa · curb: colores del bordillo · light: iluminación · dark: arena a oscuras
const THEMES = {
  pradera: { ground: 'grass', palette: ['#6aa847', '#5c9a3e'], lines: true, outside: '#4c7a35', decor: 'trees', rock: ['boulder', '#9a948a'], curb: ['#b8b0a0', '#8e8678'], light: 'day' },
  bosque: { ground: 'grass', palette: ['#4f9038', '#437f30'], lines: true, flowers: 20, outside: '#355f28', decor: 'forest', rock: ['boulder', '#857e70'], curb: ['#9a8f78', '#76705e'], light: 'forest' },
  cueva: { ground: 'rock', palette: ['#867664', '#6c5e4e'], outside: '#3e352d', decor: 'rocks', rock: ['boulder', '#8a7c6a'], curb: ['#7a6e60', '#5e5448'], light: 'cave' },
  lago: { ground: 'sand', palette: ['#d9c58e', '#c9b27a'], lines: true, outside: '#3d6f9c', water: true, decor: 'reeds', rock: ['boulder', '#a49c8c'], curb: ['#d8cdb0', '#b4a88a'], light: 'lake' },
  'g-roca': { ground: 'rock', palette: ['#8e7d68', '#6f5f4c'], emblem: '#c0a060', outside: '#3a3029', decor: 'rocks', rock: ['boulder', '#94846c'], curb: ['#7e705e', '#5e5446'], light: 'cave' },
  'g-agua': { ground: 'tiles', palette: ['#c8dae4', '#b8ccd8'], tile: ['#ccdee8', '#b8ccd8'], grout: '#8fb0c4', emblem: '#3a8fe0', outside: '#4f8aa2', water: true, decor: 'pool', rock: ['pillar', '#e8eef4'], curb: ['#f2f6fa', '#c4d4e0'], light: 'indoor' },
  'g-electrico': { ground: 'metal', palette: ['#8c939c', '#737a84'], emblem: '#ffd23a', outside: '#3a3f46', decor: 'machines', rock: ['crate', '#5c6470'], curb: ['#e8c030', '#2a2a2a'], light: 'indoor' },
  'g-planta': { ground: 'grass', palette: ['#5fae46', '#4f9a3a'], flowers: 60, emblem: '#ff8ac0', outside: '#3c7a30', decor: 'flowers', rock: ['boulder', '#9aa08a'], curb: ['#e8dcc0', '#c4b494'], light: 'day' },
  'g-veneno': { ground: 'tatami', palette: ['#4a3a50', '#3c2e44'], emblem: '#b060e0', outside: '#22182a', decor: 'lanterns', rock: ['grave', '#5a4a64'], curb: ['#5a3a20', '#3a2414'], light: 'dusk' },
  'g-psiquico': { ground: 'marble', palette: ['#c6b6da', '#ae9cc8'], emblem: '#ff5ab0', outside: '#2a1e3a', decor: 'crystals', crystal: '#ff7ad0', rock: ['pillar', '#e8e0f4'], curb: ['#e0d4f0', '#a090c0'], light: 'dusk' },
  'g-fuego': { ground: 'volcanic', palette: ['#3a2a26', '#2a1e1a'], emblem: '#ff6020', outside: '#1e1210', decor: 'volcano', rock: ['boulder', '#4a3a34'], curb: ['#4a3430', '#2a1c18'], light: 'volcano' },
  'g-tierra': { ground: 'sand', palette: ['#c8a46e', '#b08c58'], emblem: '#8a5a2a', outside: '#6a5034', decor: 'rocks', rock: ['boulder', '#9a7a56'], curb: ['#a88a62', '#86684a'], light: 'day' },
  'g-volador': { ground: 'planks', palette: ['#b88a58', '#9c7244'], emblem: '#7ab0ff', outside: null, decor: 'clouds', rock: ['crate', '#8a643c'], curb: ['#8a643c', '#6a4a2a'], light: 'sky' },
  'g-bicho': { ground: 'moss', palette: ['#5a8f3a', '#4a7a30'], flowers: 40, emblem: '#a0d040', outside: '#2e5222', decor: 'forest', rock: ['boulder', '#7a8a60'], curb: ['#c8d8b8', '#90a880'], light: 'forest' },
  'g-normal': { ground: 'tiles', palette: ['#e2c4d1', '#d8b6c5'], tile: ['#e6cad6', '#d8b6c5'], grout: '#c0909f', emblem: '#ff70a0', outside: '#5a3a48', decor: 'stands', rock: ['pillar', '#fff0f6'], curb: ['#ffffff', '#e8c0d0'], light: 'indoor' },
  'g-fantasma': { ground: 'rock', palette: ['#4a4258', '#3a3448'], emblem: '#8a60e0', outside: '#1a1624', decor: 'graves', rock: ['grave', '#6a6478'], curb: ['#5a5468', '#3a3448'], light: 'night', dark: true },
  'g-siniestro': { ground: 'marble', palette: ['#30303c', '#24242e'], emblem: '#6a5aa0', outside: '#121218', decor: 'lanterns', rock: ['pillar', '#3a3a48'], curb: ['#3a3a48', '#24242e'], light: 'night', dark: true },
  'g-lucha': { ground: 'stone', palette: ['#a8a090', '#8e8676'], emblem: '#e05030', outside: '#3a5a3a', decor: 'cliffs', rock: ['boulder', '#8c8476'], curb: ['#a09888', '#7a7262'], light: 'day' },
  'g-acero': { ground: 'metal', palette: ['#a6b0ba', '#8c96a2'], emblem: '#c0c8d8', outside: '#24466e', water: true, decor: 'harbor', rock: ['crate', '#7a8694'], curb: ['#c8d0d8', '#8a96a4'], light: 'dusk' },
  'g-hielo': { ground: 'snow', palette: ['#dfeaf3', '#ccdcea'], emblem: '#7ac8ff', outside: '#dce8f2', decor: 'snow', rock: ['ice', '#bfe6ff'], curb: ['#ffffff', '#c4d8e8'], light: 'snow' },
  'g-dragon': { ground: 'volcanic', palette: ['#2e2638', '#221c2a'], emblem: '#8a60ff', outside: '#140f1a', decor: 'volcano', rock: ['boulder', '#3e3448'], curb: ['#3e3448', '#241e2c'], light: 'volcano' },
};
Object.assign(THEMES, {
  'e-lorelei': { ground: 'snow', palette: ['#d2e0ed', '#bccfe2'], emblem: '#4aa8ff', outside: '#b8d0e6', decor: 'snow', rock: ['ice', '#9fd4ff'], curb: ['#e8f2fa', '#a8c4dc'], light: 'glacier' },
  'e-bruno': { ground: 'stone', palette: ['#8e8272', '#746a5c'], emblem: '#e05030', outside: '#3a322a', decor: 'rocks', rock: ['boulder', '#7e7262'], curb: ['#6a5e50', '#4a4238'], light: 'cave' },
  'e-agatha': { ground: 'rock', palette: ['#3e3650', '#30293e'], emblem: '#a070ff', outside: '#15111e', decor: 'graves', rock: ['grave', '#5e5670'], curb: ['#4a4458', '#2e2a3a'], light: 'night', dark: true },
  'e-lance': { ground: 'volcanic', palette: ['#2a2036', '#1c1626'], emblem: '#7a50ff', outside: '#120c18', decor: 'volcano', rock: ['boulder', '#3a3046'], curb: ['#3a3046', '#201a2a'], light: 'volcano' },
  'e-azul': { ground: 'marble', palette: ['#ddd0b0', '#c8b890'], emblem: '#ffc020', outside: '#3a2e1a', decor: 'stands', standColors: ['#ffc020', '#ffffff'], rock: ['pillar', '#f4ecd8'], curb: ['#ffe080', '#c8a040'], light: 'indoor' },
  'e-will': { ground: 'marble', palette: ['#d0b4da', '#b89ac8'], emblem: '#ff4ab0', outside: '#24142e', decor: 'crystals', crystal: '#ff4ad0', rock: ['pillar', '#f0e0f8'], curb: ['#e8d0f4', '#a080c0'], light: 'dusk' },
  'e-kogaj': { ground: 'tatami', palette: ['#3a3040', '#2c2434'], emblem: '#c060ff', outside: '#140f18', decor: 'lanterns', rock: ['grave', '#4a3e54'], curb: ['#4a2e1a', '#2a1a10'], light: 'night', dark: true },
  'e-brunoj': { ground: 'stone', palette: ['#9c9888', '#827e70'], emblem: '#ff7030', outside: '#2e4a30', decor: 'cliffs', rock: ['boulder', '#8a8474'], curb: ['#9a9484', '#726c5e'], light: 'forest' },
  'e-karen': { ground: 'marble', palette: ['#2a2830', '#1e1c24'], emblem: '#8070c0', outside: '#0e0d12', decor: 'lanterns', rock: ['pillar', '#34323e'], curb: ['#34323e', '#1e1c24'], light: 'night', dark: true },
  'e-lancej': { ground: 'volcanic', palette: ['#3a2220', '#28161a'], emblem: '#ff4020', outside: '#180c0c', decor: 'volcano', rock: ['boulder', '#4a3030'], curb: ['#4a3030', '#2a1818'], light: 'volcano' },
});
// Las rutas usan el tema de su tipo de lugar con el toque de su región (Johto, en otoño)
const REGION_LOOK = {
  johto: {
    pradera: { palette: ['#86a84a', '#76973e'], leaves: ['#c8742a', '#d89a3a', '#a85a24', '#7a9a38'] },
    bosque: { palette: ['#6f8f38', '#5f7e30'], leaves: ['#b8642a', '#d08a30', '#8a4a22', '#5a7a2e'] },
    lago: { leaves: ['#c8742a', '#d89a3a', '#7a9a38', '#5a8a3a'] },
    cueva: {},
  },
};
const themeOf = name => {
  if (name.startsWith('r:')) {
    const node = Data.NODES[name.slice(2)];
    const base = THEMES[(node && node.map) || 'pradera'] || THEMES.pradera;
    const look = node && REGION_LOOK[node.region] && REGION_LOOK[node.region][node.map];
    return look ? { ...base, ...look } : base;
  }
  return THEMES[name] || THEMES.pradera;
};
const seedOf = (name, salt) => Shared.hashStr(name + ':' + salt) % 2147483646 + 1;

// ---------- Pintores del suelo (lienzo de 1024x640: una casilla = 42,7 x 42,7 px) ----------
const GW = 1024, GH = 640, CW = GW / COLS, CH = GH / ROWS;
const PAINT = {
  grass(g, w, h, r, th) {
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '120,180,80' : '60,120,45'},${0.1 + r() * 0.12})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 12 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 6;
      g.strokeStyle = `rgba(${r() < 0.5 ? '150,205,95' : '55,110,40'},${0.22 + r() * 0.25})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke();
    }
    flowers(g, w, h, r, th.flowers ?? 25);
  },
  moss(g, w, h, r, th) {
    PAINT.grass(g, w, h, r, { flowers: 0 });
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,80,30' : '140,190,80'},0.25)`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 10, 0, 7); g.fill(); }
    flowers(g, w, h, r, th.flowers);
  },
  rock(g, w, h, r) {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '20,15,10'},${0.03 + r() * 0.05})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 50, 8 + r() * 30, r() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(20,14,8,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
      let x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      const x = r() * w, y = r() * h, s = 1.5 + r() * 3.5;
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(x + 1, y + 1, s, s * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(${170 + r() * 50},${150 + r() * 40},${120 + r() * 40},0.5)`; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 7); g.fill();
    }
  },
  stone(g, w, h, r, th) {
    // Losas de piedra irregulares
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const k = 0.85 + r() * 0.3;
      g.fillStyle = shade(th.palette[(x + y) % 2], k);
      g.fillRect(x * CW + 1.5, y * CH + 1.5, CW - 3, CH - 3);
    }
    PAINT.rock(g, w, h, r);
  },
  sand(g, w, h, r) {
    for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,250,230' : '120,90,50'},${0.15 + r() * 0.25})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    g.strokeStyle = 'rgba(120,90,50,0.18)'; g.lineWidth = 2;
    for (let i = 0; i < 90; i++) { const x = r() * w, y = r() * h, l = 30 + r() * 60; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 6, x + l, y); g.stroke(); }
  },
  tiles(g, w, h, r, th) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      g.fillStyle = th.tile[(x + y) % 2];
      g.fillRect(x * CW, y * CH, CW, CH);
      const gl = g.createLinearGradient(x * CW, y * CH, x * CW + CW, y * CH + CH);
      gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillRect(x * CW, y * CH, CW, CH);
    }
    g.strokeStyle = th.grout; g.lineWidth = 2.5;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * CW, 0); g.lineTo(x * CW, h); g.stroke(); }
    for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * CH); g.lineTo(w, y * CH); g.stroke(); }
  },
  planks(g, w, h, r, th) {
    const bh = CH / 2;
    for (let row = 0; row * bh < h; row++) {
      let x = -r() * 120;
      while (x < w) {
        const len = 90 + r() * 140;
        g.fillStyle = shade(th.palette[r() < 0.5 ? 0 : 1], 0.85 + r() * 0.3);
        g.fillRect(x, row * bh, len - 2, bh - 2);
        g.strokeStyle = 'rgba(60,35,15,0.25)'; g.lineWidth = 1;
        for (let k = 0; k < 4; k++) { const yy = row * bh + 3 + r() * (bh - 6); g.beginPath(); g.moveTo(x + 2, yy); g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 4, x + len * 0.6, yy + (r() - 0.5) * 4, x + len - 4, yy); g.stroke(); }
        g.fillStyle = 'rgba(40,30,20,0.6)';
        g.beginPath(); g.arc(x + 5, row * bh + bh / 2, 1.6, 0, 7); g.arc(x + len - 7, row * bh + bh / 2, 1.6, 0, 7); g.fill();
        x += len;
      }
    }
  },
  metal(g, w, h, r) {
    const pw = CW * 2, ph = CH * 2;
    for (let y = 0; y < h; y += ph) for (let x = 0; x < w; x += pw) {
      const k = 0.92 + r() * 0.12;
      const gl = g.createLinearGradient(x, y, x + pw, y + ph);
      gl.addColorStop(0, `rgba(255,255,255,${0.12 * k})`); gl.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = gl; g.fillRect(x + 1, y + 1, pw - 2, ph - 2);
      g.strokeStyle = 'rgba(30,34,40,0.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
      g.fillStyle = 'rgba(220,226,232,0.8)';
      for (const [rx, ry] of [[6, 6], [pw - 6, 6], [6, ph - 6], [pw - 6, ph - 6]]) { g.beginPath(); g.arc(x + rx, y + ry, 2.2, 0, 7); g.fill(); }
    }
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
    for (let i = 0; i < 160; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 10); g.stroke(); }
  },
  marble(g, w, h, r, th) {
    for (let y = 0; y < ROWS; y += 2) for (let x = 0; x < COLS; x += 2) {
      g.fillStyle = shade(th.palette[((x + y) / 2) % 2 ? 1 : 0], 0.96 + r() * 0.08);
      g.fillRect(x * CW, y * CH, CW * 2, CH * 2);
    }
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.12 + r() * 0.2})`; g.lineWidth = 0.8 + r() * 1.6;
      let x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { const nx = x + (r() - 0.5) * 160, ny = y + (r() - 0.5) * 160; g.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
    for (let x = 0; x <= COLS; x += 2) { g.beginPath(); g.moveTo(x * CW, 0); g.lineTo(x * CW, h); g.stroke(); }
    for (let y = 0; y <= ROWS; y += 2) { g.beginPath(); g.moveTo(0, y * CH); g.lineTo(w, y * CH); g.stroke(); }
  },
  snow(g, w, h, r) {
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '160,190,220'},${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  },
  volcanic(g, w, h, r) {
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,70,60' : '10,6,6'},${0.2 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 30, 4 + r() * 18, r() * 3, 0, 7); g.fill(); }
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = r() * w, y = r() * h;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; pts.push([x, y]); }
      for (const [lw, col] of [[6, 'rgba(10,4,4,0.35)'], [2.5, 'rgba(150,60,30,0.3)']]) {
        g.strokeStyle = col; g.lineWidth = lw;
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      }
    }
  },
  tatami(g, w, h, r, th) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x += 2) {
      const vert = (x / 2 + y) % 2;
      const bx = vert ? x * CW : x * CW, by = y * CH;
      g.fillStyle = shade(th.palette[(x / 2 + y) % 2], 0.95 + r() * 0.1);
      g.fillRect(bx + 2, by + 2, CW * 2 - 4, CH - 4);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
      for (let k = 4; k < CH - 4; k += 3) { g.beginPath(); g.moveTo(bx + 3, by + k); g.lineTo(bx + CW * 2 - 3, by + k); g.stroke(); }
      g.strokeStyle = '#1e1422'; g.lineWidth = 3; g.strokeRect(bx + 1.5, by + 1.5, CW * 2 - 3, CH - 3);
    }
  },
};
function shade(hex, k) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}
function flowers(g, w, h, r, n) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h;
    g.fillStyle = ['#fff6e0', '#ffd84a', '#ff9ec0', '#c8a8ff', '#ff6a6a'][(r() * 5) | 0];
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 2.2, y + Math.sin(k * 1.26) * 2.2, 1.7, 0, 7); g.fill(); }
    g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill();
  }
}
function fieldLines(g, w, h, color) {
  g.strokeStyle = color; g.lineWidth = 5;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 80, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 10, 0, Math.PI * 2); g.fillStyle = color; g.fill();
}
// Emblema del gimnasio: anillo con el color del tipo (apagado hacia el del suelo, para que no compita
// con los ataques) y una Poké Ball estilizada
function emblem(g, w, h, color) {
  g.save();
  g.globalAlpha = 0.32;
  g.strokeStyle = color; g.lineWidth = 7;
  g.strokeRect(16, 16, w - 32, h - 32);
  g.beginPath(); g.arc(w / 2, h / 2, 110, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2 - 110, h / 2); g.lineTo(w / 2 - 26, h / 2); g.moveTo(w / 2 + 26, h / 2); g.lineTo(w / 2 + 110, h / 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 26, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.08; g.fillStyle = color;
  g.beginPath(); g.arc(w / 2, h / 2, 110, Math.PI, 0); g.fill();
  g.restore();
}
function groundTexture(name) {
  const th = themeOf(name);
  return canvasTexture(GW, GH, (g, w, h) => {
    const r = rng(seedOf(name, 'suelo'));
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, th.palette[0]); grad.addColorStop(1, th.palette[1]);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    PAINT[th.ground](g, w, h, r, th);
    // borde trabajado: una sombra suave hacia dentro y un filo claro junto al bordillo (el centro sigue igual)
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, 30, 0, 0, w, 30], [0, h, 0, h - 30, 0, h - 30, w, 30], [0, 0, 30, 0, 0, 0, 30, h], [w, 0, w - 30, 0, w - 30, 0, 30, h]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    }
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
    if (th.lines) fieldLines(g, w, h, 'rgba(255,255,255,0.22)');
    if (th.emblem) emblem(g, w, h, `#${new THREE.Color(th.emblem).lerp(new THREE.Color(th.palette[0]), 0.45).getHexString()}`);
  });
}
// Suelo de fuera: manchas grandes y suaves (claras y oscuras, que también se repiten en los bordes para que la
// textura case al repetirse) y un grano fino
function outsideTexture(color) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 50, light = r() < 0.5;
      for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        gr.addColorStop(0, light ? 'rgba(255,250,230,0.1)' : 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 2, 3 + r() * 3);
    }
  }, 8);
}

// Agua de fuera (lago, piscina, mar): mate, con dos capas de ondas que se deslizan despacio en sentidos distintos
function waterMaterial() {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    const r = rng(31);
    g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y0 = r() * h, x0 = r() * w, len = 30 + r() * 70, amp = 1.5 + r() * 3, light = r() < 0.6;
      g.strokeStyle = light ? `rgba(255,255,255,${0.25 + r() * 0.25})` : `rgba(70,70,70,${0.12 + r() * 0.12})`;
      g.lineWidth = 1 + r() * 2;
      for (const [dx, dy] of [[0, 0], [-w, 0], [0, -h], [-w, -h]]) {
        g.beginPath();
        for (let t = 0; t <= len; t += 4) { const x = x0 + t + dx, y = y0 + dy + Math.sin(t * 0.12) * amp; t ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(16, 12);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = WIND;
    sh.fragmentShader = 'uniform float uWind;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 wa = texture2D(map, vMapUv + vec2(uWind * 0.004, uWind * 0.006));
      vec4 wb = texture2D(map, vMapUv * 1.31 + vec2(-uWind * 0.005, uWind * 0.003));
      diffuseColor.rgb *= (wa.rgb + wb.rgb) * 0.62;`);
  };
  m.customProgramCacheKey = () => 'agua-lejana';
  return m;
}

// Briznas de hierba alta (textura con transparencia para planos cruzados)
function bladeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (w - 16), top = 10 + r() * 50, bend = (r() - 0.5) * 30;
      const grad = g.createLinearGradient(0, h, 0, top);
      grad.addColorStop(0, '#2f6e23'); grad.addColorStop(1, r() < 0.3 ? '#b8e070' : '#7cc24a');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x - 4, h); g.quadraticCurveTo(x + bend * 0.5, (h + top) / 2, x + bend, top); g.quadraticCurveTo(x + bend * 0.4, (h + top) / 2, x + 4, h); g.fill();
    }
  });
}
// Rayas de corriente (cascadas)
function flowTexture() {
  const t = canvasTexture(64, 128, (g, w, h) => {
    const r = rng(23);
    for (let i = 0; i < 22; i++) {
      const x = r() * w, y = r() * h, l = 14 + r() * 30;
      const gr = g.createLinearGradient(0, y, 0, y + l);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(230,248,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 2, l);
      if (y + l > h) g.fillRect(x, y - h, 2, l);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Brillo de los elementos de juego (faro, teletransportes): esos sí brillan, son mecánica
const glowMat = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

export class World {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 120);
    this.renderer = renderer;
    this.time = 0;
    this.bladeTex = bladeTexture();
    this.steamTex = softDisc('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.glowTex = softDisc('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.flowTex = flowTexture();
    this.textures = new Map();
    this.lights();
    this.ground();
    this.decorGroup = new THREE.Group(); this.scene.add(this.decorGroup);
    this.props = new THREE.Group(); this.scene.add(this.props);
    this.cells = new Array(COLS * ROWS).fill(null);
    this.types = new Array(COLS * ROWS).fill(T.NONE);
    this.paintLayer();
    this.obstacles = new Map();
    this.rocks = [];
    this.fireLight = new THREE.PointLight('#ff8030', 0, 9, 1.6);
    this.fireLight.position.y = 1.2;
    this.scene.add(this.fireLight);
    // Luz que acompaña al Pokémon propio en las arenas a oscuras
    this.focusLight = new THREE.PointLight('#c8d4ff', 0, 9, 1.4);
    this.focusLight.position.y = 2.2;
    this.scene.add(this.focusLight);
    this.placeCamera(16 / 9);
    // Modelos del decorado: al acabar de cargar se vuelve a montar el de la arena que haya
    preloadScenery().then(ok => { if (ok && this.mapName) this.buildDecor(this.mapName, this.theme); });
  }

  placeCamera(aspect) {
    // Cámara inclinada estilo Battlerite, lo bastante lejos para ver el campo entero por encima del HUD
    // (las esquinas de abajo no quedan tapadas); más alta si la ventana es estrecha
    const cx = COLS / 2, cz = ROWS / 2;
    const fit = Math.max(1, 1.62 / aspect) * CAM_ZOOM;
    this.camera.aspect = aspect;
    this.camera.position.set(cx, 17.5 * fit, cz + 11.5 * fit);
    this.camera.lookAt(cx, 0, cz + 1.4);   // el campo, centrado en vertical
    this.camera.updateProjectionMatrix();
  }

  lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#d8ecff', '#4a6a30', 1.15);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff0d8', 2.3);
    sun.position.set(COLS / 2 - 7, 16, ROWS / 2 - 5);
    sun.target.position.set(COLS / 2, 0, ROWS / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 50 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);
    this.sun = sun;
    this.scene.background = new THREE.Color('#9cc8ec');
    this.scene.fog = new THREE.Fog('#9cc8ec', 28 * CAM_ZOOM, 60 * CAM_ZOOM);
    // Cielo: cúpula con un degradado del color de arriba al del horizonte (que es el de la niebla); por debajo del
    // horizonte vuelve hacia el de arriba (se ve bajo la plataforma del cielo)
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(85, 24, 12), new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color('#6fa6d8') }, uBottom: { value: new THREE.Color('#d4e6ee') } },
      vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uTop, uBottom; varying float vY; void main(){ gl_FragColor = vec4(mix(uBottom, uTop, smoothstep(0.0, 0.55, abs(vY)) * (vY < 0.0 ? 0.6 : 1.0)), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.sky.position.set(COLS / 2, 0, ROWS / 2);
    this.sky.renderOrder = -1;
    s.add(this.sky);
  }

  ground() {
    this.arena = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    this.arena.rotation.x = -Math.PI / 2;
    this.arena.position.set(COLS / 2, 0, ROWS / 2);
    this.arena.receiveShadow = true;
    this.scene.add(this.arena);
    this.land = new THREE.MeshStandardMaterial({ roughness: 1 });
    this.water = waterMaterial();
    this.outside = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), this.land);
    this.outside.rotation.x = -Math.PI / 2;
    this.outside.position.set(COLS / 2, -0.02, ROWS / 2);
    this.outside.receiveShadow = true;
    this.scene.add(this.outside);
    // Bordillo alrededor de la arena (los colores cambian con el tema)
    this.curbMats = [new THREE.MeshStandardMaterial({ color: '#b8b0a0', roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: '#8e8678', roughness: 0.9 })];
    const r = rng(9);
    const curb = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32 + r() * 0.06, d), this.curbMats[r() < 0.5 ? 0 : 1]);
      m.position.set(x, 0.16, z);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    };
    for (let x = -0.25; x < COLS + 0.5; x += 1) { curb(x + 0.5, -0.25, 0.96, 0.5); curb(x + 0.5, ROWS + 0.25, 0.96, 0.5); }
    for (let z = 0.25; z < ROWS; z += 1) { curb(-0.25, z + 0.5, 0.5, 0.96); curb(COLS + 0.25, z + 0.5, 0.5, 0.96); }
  }

  tex(key, make) {
    if (!this.textures.has(key)) this.textures.set(key, make());
    return this.textures.get(key);
  }

  // ---------- Tema del mapa ----------
  applyTheme(name) {
    const th = themeOf(name);
    this.theme = th;
    // Suelo claro (hielo, baldosas, mármol, arena): los efectos cambian para verse bien sobre él
    const fl = new THREE.Color(th.palette[0]);
    this.bright = 0.2126 * fl.r + 0.7152 * fl.g + 0.0722 * fl.b > 0.5;
    if (this.onTheme) this.onTheme(this.bright);
    const L = LIGHT[th.light] || LIGHT.day;
    this.scene.background = new THREE.Color(L.bg);
    this.sky.material.uniforms.uTop.value.set(L.sky[0]); this.sky.material.uniforms.uBottom.value.set(L.sky[1]);
    this.scene.fog.color.set(L.sky[1]); this.scene.fog.near = L.fog[0] * CAM_ZOOM; this.scene.fog.far = L.fog[1] * CAM_ZOOM;
    this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    this.sun.color.set(L.sun[0]); this.sun.intensity = L.sun[1];
    this.arena.material.map = this.tex('g:' + name, () => groundTexture(name));
    this.arena.material.roughness = ['tiles', 'marble', 'metal'].includes(th.ground) ? 0.45 : 0.95;
    this.arena.material.metalness = th.ground === 'metal' ? 0.35 : 0;
    this.arena.material.needsUpdate = true;
    this.outside.visible = !!th.outside;
    if (th.outside) {
      // fuera, tierra con su textura o agua mate con ondas que se mueven muy despacio
      this.outside.material = th.water ? this.water : this.land;
      if (th.water) this.water.color.set(th.outside);
      else { this.land.map = this.tex('o:' + th.outside, () => outsideTexture(th.outside)); this.land.needsUpdate = true; }
    }
    this.curbMats[0].color.set(th.curb[0]); this.curbMats[1].color.set(th.curb[1]);
    this.dark = !!th.dark;
    // A oscuras, la luz del Pokémon propio llega justo hasta donde se ve al rival (antes llegaba más lejos y el
    // rival, ya iluminado, seguía sin verse), con un anillo tenue en el suelo que marca ese borde
    const darkR = ((Data.ARENAS[name] || {}).mech || {}).dark || 0;
    this.focusLight.distance = darkR ? darkR * U * 1.05 : 9;
    if (!this.darkRing) {
      this.darkRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), new THREE.MeshBasicMaterial({ color: '#c8d4ff', transparent: true, opacity: 0.05, depthWrite: false }));
      this.darkRing.rotation.x = -Math.PI / 2;
      this.scene.add(this.darkRing);
    }
    this.darkRing.scale.setScalar(Math.max(0.01, darkR * U));
    this.darkRing.visible = false;
    this.buildDecor(name, th);
  }

  clearGroup(g) {
    for (const o of [...g.children]) {
      g.remove(o);
      // (los modelos del Nature Kit comparten su geometría entre arenas: esa no se libera)
      o.traverse(x => { if (x.isInstancedMesh) x.dispose(); if (x.geometry && !x.userData.shared) x.geometry.dispose(); });
    }
  }

  // Decorado alrededor de la arena (no se puede pisar): scenery.js. Los modelos se cargan una vez; mientras tanto
  // sale solo lo hecho a mano y, cuando acaban de cargar, se vuelve a montar.
  buildDecor(name, th) {
    this.clearGroup(this.decorGroup);
    this.animated = buildScenery(this.decorGroup, name, th, { seed: seedOf(name, 'decorado'), flowTex: this.flowTex, world: this });
  }

  // ---------- Elementos de las arenas ----------
  buildProps(name, mod = null) {
    this.clearGroup(this.props);
    this.panels = null; this.pads = null; this.healPads = null; this.beam = null;
    const mech = Shared.mechFor(name, mod);
    const marks = Shared.parseMap(name);
    // Cintas, niebla, espejos, flores y pozo de gravedad (arenamech.js)
    this.mechAnim = buildMechProps(this.props, mech, marks);
    if (marks.panels.length) {   // placas eléctricas: dos grupos en damero
      const mats = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: '#4a4e56', emissive: '#ffd23a', emissiveIntensity: 0.05, metalness: 0.5, roughness: 0.4 }));
      const geo = new THREE.BoxGeometry(0.9, 0.05, 0.9);
      for (const i of marks.panels) {
        const g = (((i % COLS) >> 1) + ((Math.floor(i / COLS)) >> 1)) % 2;
        const p = new THREE.Mesh(geo, mats[g]);
        p.position.set((i % COLS) + 0.5, 0.025, Math.floor(i / COLS) + 0.5);
        p.receiveShadow = true;
        this.props.add(p);
      }
      this.panels = { mats, state: [{ ph: 'idle', t: 0 }, { ph: 'idle', t: 0 }] };
    }
    if (marks.pads.length) {   // teletransportes: cada pareja de un color
      const cols = ['#ff5ab0', '#40e0ff', '#ffd040'];
      this.pads = marks.pads.map(([a, b], k) => {
        const out = [];
        for (const p of [a, b]) {
          const g = new THREE.Group();
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 32), glowMat(cols[k], 2));
          ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
          const disc = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshBasicMaterial({ color: cols[k], transparent: true, opacity: 0.35, depthWrite: false }));
          disc.rotation.x = -Math.PI / 2; disc.position.y = 0.025; g.add(disc);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: cols[k], transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
          glow.scale.set(1.2, 1.2, 1); glow.position.y = 0.4; g.add(glow);
          g.position.copy(toWorld(p.x, p.y));
          this.props.add(g);
          out.push({ g, ring, color: cols[k] });
        }
        return out;
      });
    }
    if (marks.heal.length) {   // baldosas de curación: cruz rosa que brilla según su carga
      this.healPads = marks.heal.map(h => {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.92), mat('#ffffff', { roughness: 0.3 }));
        base.position.y = 0.025; g.add(base);
        const crossMat = new THREE.MeshStandardMaterial({ color: '#ff5a8a', emissive: '#ff5a8a', emissiveIntensity: 1 });
        for (const [w, d] of [[0.62, 0.2], [0.2, 0.62]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), crossMat); c.position.y = 0.05; g.add(c); }
        g.position.copy(toWorld(h.x, h.y));
        this.props.add(g);
        return { g, crossMat, c: 1 };
      });
    }
    if (marks.flow.size) {   // corriente: rayas que se mueven sobre el agua
      const down = new THREE.MeshBasicMaterial({ map: this.flowTex, transparent: true, opacity: 0.7, depthWrite: false });
      const up = new THREE.MeshBasicMaterial({ map: this.flowTex.clone(), transparent: true, opacity: 0.7, depthWrite: false });
      up.map.needsUpdate = true; up.map.wrapS = up.map.wrapT = THREE.RepeatWrapping;
      const geo = new THREE.PlaneGeometry(1, 1);
      for (const [i, [, dy]] of marks.flow) {
        const p = new THREE.Mesh(geo, dy > 0 ? down : up);
        p.rotation.x = -Math.PI / 2;
        p.position.set((i % COLS) + 0.5, 0.04, Math.floor(i / COLS) + 0.5);
        this.props.add(p);
      }
      this.flowMats = [down, up];
    } else this.flowMats = null;
    if (mech.beam) {   // en el centro, el faro (acero) o un obelisco del tipo del haz, y su haz doble
      const ty = mech.beam.ty || 'acero';
      const beamColor = ty === 'acero' ? '#fff4b0' : Data.TYPE_COLOR[ty];
      const g = new THREE.Group();
      if (ty === 'acero') {
        const white = mat('#f4f4f4'), red = mat('#d83a3a');
        for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.7 - k * 0.06, 0.76 - k * 0.06, 0.6, 16), k % 2 ? red : white); s.position.y = 0.3 + k * 0.6; g.add(s); }
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12), glowMat('#fff2a0', 3)); lamp.position.y = 3.25; g.add(lamp);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 12), red); roof.position.y = 3.75; g.add(roof);
      } else {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1, 0.5, 8), mat('#3a3448', { flatShading: true })); base.position.y = 0.25; g.add(base);
        const obel = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), mat(beamColor, { emissive: beamColor, emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }));
        obel.scale.set(0.8, 2.2, 0.8); obel.position.y = 2; g.add(obel);
        this.animated = this.animated || [];
        this.animated.push(() => { obel.rotation.y = this.time * 0.8; obel.position.y = 2 + Math.sin(this.time * 2) * 0.12; });
      }
      g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      g.position.set(COLS / 2, 0, ROWS / 2);
      this.props.add(g);
      const len = mech.beam.len * U, w = mech.beam.width * 2 * U;
      // El haz: un rayo fino a media altura (núcleo blanco y halo del color) y, en el suelo, una franja tenue del
      // ancho que quema (lo que cuenta para el golpe)
      const add = (color, opacity) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
      const floorMat = add(beamColor, 0.14), glowMat2 = add(beamColor, 0.35), coreMat = add('#ffffff', 0.8);
      const pivot = new THREE.Group();
      pivot.position.set(COLS / 2, 0.06, ROWS / 2);
      for (const s of [1, -1]) {
        const arm = new THREE.Group();
        arm.rotation.y = s < 0 ? Math.PI : 0;
        const b = new THREE.Mesh(new THREE.PlaneGeometry(len, w).translate(len / 2 + 1, 0, 0), floorMat);
        b.rotation.x = -Math.PI / 2;
        arm.add(b);
        for (const [r, m] of [[0.03, coreMat], [0.09, glowMat2]]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10, 1, true), m);
          c.rotation.z = Math.PI / 2; c.position.set(len / 2 + 1, 0.75, 0);
          arm.add(c);
        }
        pivot.add(arm);
      }
      this.props.add(pivot);
      this.beam = { pivot, a: Math.PI / 2, target: Math.PI / 2 };   // empieza en vertical, como en el servidor
      pivot.rotation.y = -Math.PI / 2;
    }
  }

  // Estado continuo de la arena que llega en cada instantánea (haz del faro, baldosas)
  setArena(ar) {
    if (!ar) return;
    if (this.beam && ar.ba !== undefined) this.beam.target = ar.ba;
    if (this.healPads && ar.hl) ar.hl.forEach((c, k) => { if (this.healPads[k]) this.healPads[k].c = c; });
  }

  // Placas eléctricas: aviso (parpadeo) y descarga (destello)
  panelFlash(g, ph, d) {
    if (!this.panels) return;
    this.panels.state[g] = { ph, t: ph === 'warn' ? d : 0.35 };
  }

  // Posición del Pokémon propio (luz en las arenas a oscuras)
  setFocus(x, y) { this.focus = { x, y }; }

  // Agua, fuego, hielo, veneno, telarañas, lava y suelo quemado se pintan en una capa sobre el
  // suelo (formas orgánicas que se funden entre casillas); el fuego y la lava además brillan.
  paintLayer() {
    const P = 32;
    this.paintPx = P;
    const mk = () => { const c = document.createElement('canvas'); c.width = COLS * P; c.height = ROWS * P; return c; };
    this.paintCanvas = mk(); this.fireCanvas = mk(); this.waterCanvas = mk(); this.lavaCanvas = mk();
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    this.paintTex = tex(this.paintCanvas); this.fireTex = tex(this.fireCanvas);
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({
      map: this.paintTex, emissiveMap: this.fireTex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6,
      transparent: true, roughness: 0.55, metalness: 0.02, depthWrite: false,
    }));
    this.overlay.rotation.x = -Math.PI / 2;
    this.overlay.position.set(COLS / 2, 0.02, ROWS / 2);
    this.overlay.receiveShadow = true;
    this.scene.add(this.overlay);
    this.paintDirty = true;
  }

  redrawPaint() {
    this.paintDirty = false;
    const P = this.paintPx;
    const g = this.paintCanvas.getContext('2d'), f = this.fireCanvas.getContext('2d'), w = this.waterCanvas.getContext('2d'), l = this.lavaCanvas.getContext('2d');
    for (const c of [g, f, w, l]) c.clearRect(0, 0, COLS * P, ROWS * P);
    l.fillStyle = '#ff6a10';
    let lava = false;
    const blob = (c, i, r, inner, outer) => {
      const x = (i % COLS) * P + P / 2, y = Math.floor(i / COLS) * P + P / 2;
      const grad = c.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, inner); grad.addColorStop(1, outer);
      c.fillStyle = grad;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const r = rng(77);
    w.fillStyle = '#3a7fd6';
    for (let i = 0; i < this.types.length; i++) {
      const t = this.types[i];
      const x = (i % COLS) * P, y = Math.floor(i / COLS) * P;
      if (t === T.BURNT) blob(g, i, P * 0.85, 'rgba(38,30,20,0.85)', 'rgba(38,30,20,0)');
      else if (t === T.FIRE) {
        blob(g, i, P * 0.8, 'rgba(60,30,10,0.8)', 'rgba(60,30,10,0)');
        blob(f, i, P * 0.75, 'rgba(255,140,40,1)', 'rgba(255,60,0,0)');
      } else if (t === T.WATER) {
        w.fillRect(x + 3, y + 3, P - 6, P - 6);
        w.beginPath(); w.arc(x + P / 2, y + P / 2, P * 0.66, 0, Math.PI * 2); w.fill();
      } else if (t === T.ICE) {
        g.fillStyle = 'rgba(150,205,245,0.72)'; g.fillRect(x, y, P, P);
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + 4 + r() * 8, y + P - 6); g.lineTo(x + P - 6, y + 4 + r() * 8); g.stroke();
        g.strokeStyle = 'rgba(120,175,225,0.25)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, P - 1, P - 1);
      } else if (t === T.POISON) {
        blob(g, i, P * 0.78, 'rgba(160,60,210,0.92)', 'rgba(110,30,160,0)');
        blob(f, i, P * 0.5, 'rgba(120,40,160,0.12)', 'rgba(120,40,160,0)');
        g.fillStyle = 'rgba(230,180,255,0.7)';
        for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 6 + r() * (P - 12), y + 6 + r() * (P - 12), 1.5 + r() * 2, 0, 7); g.fill(); }
      } else if (t === T.WEB) {
        const cx = x + P / 2, cy = y + P / 2;
        g.strokeStyle = 'rgba(250,250,250,0.85)'; g.lineWidth = 1.1;
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * P * 0.6, cy + Math.sin(a) * P * 0.6); g.stroke(); }
        for (const rr of [5, 10, 15]) { g.beginPath(); for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4; const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); }
      } else if (t === T.LAVA) {
        // como el agua: unión de formas redondeadas; luego vetas y costra encima
        lava = true;
        l.fillRect(x + 3, y + 3, P - 6, P - 6);
        l.beginPath(); l.arc(x + P / 2, y + P / 2, P * 0.68, 0, Math.PI * 2); l.fill();
      }
    }
    if (lava) {
      l.globalCompositeOperation = 'source-atop';
      for (let k = 0; k < 220; k++) {
        const x = r() * COLS * P, y = r() * ROWS * P;
        l.fillStyle = r() < 0.55 ? 'rgba(70,20,8,0.55)' : 'rgba(255,230,120,0.75)';
        l.beginPath(); l.ellipse(x, y, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 7); l.fill();
      }
      l.globalCompositeOperation = 'source-over';
      // borde de roca fría alrededor (en la capa de color) y la lava brillando (capa emisiva)
      g.save(); g.shadowColor = 'rgba(20,8,4,0.95)'; g.shadowBlur = 10; g.drawImage(this.lavaCanvas, 0, 0); g.restore();
      f.drawImage(this.lavaCanvas, 0, 0);
    }
    // Agua: unión opaca de todas las casillas, luego un brillo interior, y se compone con transparencia
    w.globalCompositeOperation = 'source-atop';
    const shine = w.createLinearGradient(0, 0, 0, ROWS * P);
    shine.addColorStop(0, 'rgba(150,210,255,0.35)'); shine.addColorStop(1, 'rgba(20,60,140,0.25)');
    w.fillStyle = shine; w.fillRect(0, 0, COLS * P, ROWS * P);
    w.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.88;
    g.drawImage(this.waterCanvas, 0, 0);
    g.globalAlpha = 1;
    this.paintTex.needsUpdate = true;
    this.fireTex.needsUpdate = true;
  }

  // ---------- Mapa y terreno ----------
  // mod: la mecánica extra del combate (Práctica), que también se ve (niebla, pozo...)
  loadMap(mapName, terrain, mod = null) {
    if (this.mapName !== mapName || this.mod !== mod) { if (this.mapName !== mapName) this.applyTheme(mapName); this.buildProps(mapName, mod); }
    this.mapName = mapName; this.mod = mod;
    for (const o of this.rocks) this.scene.remove(o);
    this.rocks = [];
    for (let i = 0; i < this.cells.length; i++) this.setCell(i, T.NONE);
    for (const [, o] of this.obstacles) this.scene.remove(o.mesh);
    this.obstacles.clear();
    const { rocks } = Shared.parseMap(mapName);
    this.mapRocks = rocks;
    const [style, color] = this.theme.rock;
    const r = rng(seedOf(mapName, 'rocas'));
    const beam = !!Shared.mechOf(mapName).beam;
    for (const rk of rocks) {
      // en el faro, las rocas del centro son la base de la torre
      if (beam && Math.hypot(rk.x - Shared.ARENA.w / 2, rk.y - Shared.ARENA.h / 2) < 40) continue;
      const m = this.rockMesh(style, color, rk.r * U, r);
      m.position.copy(toWorld(rk.x, rk.y, 0));
      this.scene.add(m);
      this.rocks.push(m);
    }
    terrain.forEach((t, i) => this.setCell(i, t));
  }

  rockMesh(style, color, rad, r) {
    const g = new THREE.Group();
    let m;
    if (style === 'crate') {
      m = new THREE.Mesh(new THREE.BoxGeometry(rad * 1.6, rad * 1.6, rad * 1.6), mat(color, { roughness: 0.7, metalness: 0.2 }));
      m.position.y = rad * 0.8; m.rotation.y = r() * 0.6;
      const band = new THREE.Mesh(new THREE.BoxGeometry(rad * 1.65, rad * 0.25, rad * 1.65), mat(shade(color, 0.6)));
      band.position.y = rad * 0.8; band.rotation.y = m.rotation.y;
      g.add(band);
    } else if (style === 'pillar') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.85, rad * 0.95, rad * 3.2, 14), mat(color, { roughness: 0.4 }));
      m.position.y = rad * 1.6;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(rad * 2.1, rad * 0.35, rad * 2.1), mat(color, { roughness: 0.4 }));
      cap.position.y = rad * 3.3; g.add(cap);
    } else if (style === 'ice') {
      m = new THREE.Mesh(new THREE.OctahedronGeometry(rad * 1.2, 0), mat(color, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, emissive: '#3a7ab0', emissiveIntensity: 0.25 }));
      m.scale.y = 1.4; m.position.y = rad * 1.1; m.rotation.y = r() * 3;
    } else if (style === 'grave') {
      m = new THREE.Mesh(new THREE.BoxGeometry(rad * 1.5, rad * 2.2, rad * 0.5), mat(color, { flatShading: true }));
      m.position.y = rad * 1.1; m.rotation.y = (r() - 0.5) * 0.4;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.75, rad * 0.75, rad * 0.5, 12, 1, false, 0, Math.PI), m.material);
      top.rotation.set(Math.PI / 2, 0, Math.PI / 2 + m.rotation.y); top.position.y = rad * 2.2; g.add(top);
    } else {
      m = new THREE.Mesh(new THREE.DodecahedronGeometry(rad * 1.15, 0), mat(color, { roughness: 0.9, flatShading: true }));
      m.position.y = rad * 0.7; m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = 0.85;
    }
    g.add(m);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  setCell(i, type) {
    if (this.types[i] === type && (this.cells[i] || ![T.GRASS, T.STEAM].includes(type))) return;
    const old = this.cells[i];
    if (old) { this.scene.remove(old); old.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); }
    this.cells[i] = null;
    const painted = [T.WATER, T.FIRE, T.BURNT, T.ICE, T.POISON, T.WEB, T.LAVA];
    if (this.types[i] !== type && (painted.includes(type) || painted.includes(this.types[i]))) this.paintDirty = true;
    this.types[i] = type;
    const cx = (i % COLS) + 0.5, cz = Math.floor(i / COLS) + 0.5;
    let g = null;
    if (type === T.GRASS) {
      g = new THREE.Group();
      const m = this.grassMat || (this.grassMat = new THREE.MeshLambertMaterial({ map: this.bladeTex, alphaTest: 0.4, side: THREE.DoubleSide }));
      const geo = this.grassGeo || (this.grassGeo = new THREE.PlaneGeometry(0.75, 0.75).translate(0, 0.37, 0));
      for (let k = 0; k < 4; k++) {
        const tuft = new THREE.Group();
        for (let j = 0; j < 2; j++) {
          const p = new THREE.Mesh(geo, m);
          p.rotation.y = j * Math.PI / 2 + k;
          p.castShadow = true;
          tuft.add(p);
        }
        tuft.position.set(cx + ((k % 2) - 0.5) * 0.45, 0, cz + ((k >> 1) - 0.5) * 0.45);
        tuft.scale.setScalar(0.9 + ((i * 7 + k * 3) % 5) * 0.06);
        tuft.userData.phase = i * 0.7 + k;
        g.add(tuft);
      }
      g.userData.sway = true;
    } else if (type === T.STEAM) {
      g = new THREE.Group();
      const m = this.steamMat || (this.steamMat = new THREE.SpriteMaterial({ map: this.steamTex, transparent: true, opacity: 0.75, depthWrite: false, color: '#f4f8ff' }));
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(m);
        sp.scale.setScalar(1.5 + k * 0.3);
        sp.position.set(cx + (k - 1) * 0.3, 0.5 + k * 0.35, cz + ((k * 5) % 3 - 1) * 0.2);
        sp.userData.phase = i + k * 2;
        g.add(sp);
      }
      g.userData.steam = true;
    }
    if (g) { this.scene.add(g); this.cells[i] = g; }
  }

  // ---------- Obstáculos dinámicos (Barrera, Tumba Rocas, rocas caídas, muros invisibles) ----------
  syncObstacles(list) {
    const seen = new Set();
    for (const o of list) {
      seen.add(o.id);
      if (this.obstacles.has(o.id)) continue;
      let mesh;
      if (o.k === 'barrier') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.r * U, o.r * U, 1.1, 6, 1, true),
          new THREE.MeshBasicMaterial({ color: '#ff8cc8', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
        mesh.position.copy(toWorld(o.x, o.y, 0.55));
      } else if (o.k === 'ghost') {
        // Muro invisible: apenas un brillo que se nota de cerca
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.r * U, o.r * U, 1.2, 6, 1, true),
          new THREE.MeshBasicMaterial({ color: '#c890ff', transparent: true, opacity: 0, depthWrite: false }));
        mesh.position.copy(toWorld(o.x, o.y, 0.6));
        mesh.userData.ghost = true;
      } else if (o.k === 'mirror') {
        mesh = new THREE.Object3D();   // el cristal ya lo dibuja la arena: esto solo choca
      } else if (o.k === 'pillar') {
        mesh = pillarMesh(o.r, this.theme ? this.theme.rock[1] : '#8a8478');
        mesh.position.copy(toWorld(o.x, o.y, -1.7));
        mesh.userData.rise = true; mesh.userData.riseTo = 0;
      } else {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * U * 1.1, 0), new THREE.MeshStandardMaterial({ color: this.theme ? this.theme.rock[1] : '#a08868', roughness: 0.9, flatShading: true }));
        mesh.position.copy(toWorld(o.x, o.y, -0.6));
        mesh.userData.rise = true;
        mesh.castShadow = mesh.receiveShadow = true;
      }
      this.scene.add(mesh);
      this.obstacles.set(o.id, { mesh, data: o });
    }
    for (const [id, o] of this.obstacles) if (!seen.has(id)) { this.scene.remove(o.mesh); o.mesh.traverse(m => m.geometry && m.geometry.dispose()); this.obstacles.delete(id); }
  }

  // Obstáculos para la predicción de movimiento (rocas del mapa + dinámicos)
  collisionList() {
    return [...(this.mapRocks || []), ...[...this.obstacles.values()].map(o => o.data)];
  }

  update(dt, particles) {
    this.time += dt;
    const t = this.time;
    WIND.value = t;
    if (this.paintDirty) this.redrawPaint();
    let fx = 0, fz = 0, fires = 0;
    for (let i = 0; i < this.types.length; i++) {
      const c = this.cells[i];
      const ty = this.types[i];
      if (c && c.userData.sway) for (const tuft of c.children) tuft.rotation.z = Math.sin(t * 1.8 + tuft.userData.phase) * 0.06;
      else if (c && c.userData.steam) for (const s of c.children) {
        s.position.y = 0.5 + Math.sin(t * 0.8 + s.userData.phase) * 0.15 + s.userData.phase % 1;
        s.material.rotation = t * 0.1;
      } else if (ty === T.FIRE) {
        const x = (i % COLS) + 0.5, z = Math.floor(i / COLS) + 0.5;
        fires++; fx += x; fz += z;
        particles.trickle(16, dt, x, 0.1, z, { colors: ['#fff6a0', '#ffc040', '#ff7a20', '#ff4010'], layer: 'glow', dir: [0, 1, 0], spread: 0.25, speed: 1.6, life: 0.7, size: 0.55, jitter: 0.8 });
        particles.trickle(3, dt, x, 0.6, z, { colors: ['#555', '#666', '#777'], layer: 'soft', dir: [0, 1, 0], spread: 0.2, speed: 0.8, life: 1.6, size: 0.9, grow: 1.5, alpha: 0.35, jitter: 0.6 });
      } else if (ty === T.LAVA) {
        particles.trickle(0.8, dt, (i % COLS) + 0.5, 0.1, Math.floor(i / COLS) + 0.5, { colors: ['#ffe080', '#ff9030', '#ff5010'], layer: 'glow', dir: [0, 1, 0], spread: 0.3, speed: 1.4, life: 0.9, size: 0.18, jitter: 0.9 });
      } else if (ty === T.POISON) {
        particles.trickle(0.7, dt, (i % COLS) + 0.5, 0.05, Math.floor(i / COLS) + 0.5, { colors: ['#e0a0ff', '#b060e0'], layer: 'solid', dir: [0, 1, 0], spread: 0.1, speed: 0.6, life: 0.6, size: 0.1, jitter: 0.8 });
      }
    }
    const flick = Math.sin(t * 13) * 0.3;
    this.overlay.material.emissiveIntensity = 1.3 + flick;
    this.fireLight.intensity = fires ? Math.min(6, 1.5 + fires * 0.4) * (0.85 + Math.sin(t * 17) * 0.15) : 0;
    if (fires) this.fireLight.position.set(fx / fires, 1.2, fz / fires);
    for (const [, o] of this.obstacles) {
      if (o.mesh.userData.rise && o.mesh.position.y < (o.mesh.userData.riseTo ?? o.data.r * U * 0.6)) o.mesh.position.y = Math.min(o.mesh.userData.riseTo ?? Infinity, o.mesh.position.y + dt * 6);
      if (o.mesh.userData.ghost) {
        // el muro invisible brilla un poco cuando el Pokémon propio está pegado a él
        const near = this.focus ? Math.hypot(this.focus.x - o.data.x, this.focus.y - o.data.y) < o.data.r + 40 : false;
        o.mesh.material.opacity += ((near ? 0.3 : 0.008 + Math.max(0, Math.sin(t * 1.3 + o.data.x)) * 0.02) - o.mesh.material.opacity) * Math.min(1, dt * 6);
      }
    }
    // Luz del Pokémon propio en las arenas a oscuras
    this.focusLight.intensity = this.dark && this.focus ? 9 : 0;
    if (this.focus) this.focusLight.position.set(this.focus.x * U, 2.2, this.focus.y * U);
    if (this.darkRing) { this.darkRing.visible = this.dark && !!this.focus; if (this.focus) this.darkRing.position.set(this.focus.x * U, 0.05, this.focus.y * U); }
    // Elementos de la arena
    for (const a of this.animated || []) a(dt);
    for (const a of this.mechAnim || []) a(dt, this.time);
    if (this.panels) this.panels.mats.forEach((m, g) => {
      const s = this.panels.state[g];
      s.t -= dt;
      if (s.ph === 'warn' && s.t > 0) m.emissiveIntensity = 0.12 + (Math.sin(t * 22) > 0 ? 0.38 : 0);
      else if (s.ph === 'zap' && s.t > 0) m.emissiveIntensity = 1.6 * (s.t / 0.35);
      else { s.ph = 'idle'; m.emissiveIntensity = 0.05; }
    });
    if (this.pads) for (const pair of this.pads) for (const p of pair) { p.ring.rotation.z = t * 1.5; p.g.children[2].material.opacity = 0.35 + Math.sin(t * 3 + p.g.position.x) * 0.15; }
    if (this.healPads) for (const h of this.healPads) h.crossMat.emissiveIntensity = h.c < 0 ? 0 : 0.3 + h.c * (1.4 + Math.sin(t * 4) * 0.4);
    if (this.flowMats) { this.flowMats[0].map.offset.y += dt * 1.4; this.flowMats[1].map.offset.y -= dt * 1.4; }
    if (this.beam) {
      let d = this.beam.target - this.beam.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.beam.a += d * Math.min(1, dt * 10);
      this.beam.pivot.rotation.y = -this.beam.a;
    }
  }
}
