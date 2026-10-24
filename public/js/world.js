// Escena 3D de la arena: luces, suelo, decorado, terreno dinámico (hierba alta, fuego, agua,
// vapor, quemado, hielo, veneno, telarañas, lava) y obstáculos. 1 unidad 3D = 40 px de juego.
// Cada mapa tiene su tema (suelo, luz, alrededores, rocas) y las arenas de gimnasio además sus
// elementos propios: placas eléctricas, teletransportes, baldosas de curación, faro, cascadas...
import * as THREE from 'three';

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
// light: fondo/niebla, luz ambiental (cielo, suelo, intensidad) y sol (color, intensidad)
const LIGHT = {
  day: { bg: '#9cc8ec', fog: [28, 60], hemi: ['#d8ecff', '#4a6a30', 1.15], sun: ['#fff0d8', 2.3] },
  forest: { bg: '#a8cfa0', fog: [22, 50], hemi: ['#e0f4d8', '#30502a', 1.0], sun: ['#fff4d0', 2.0] },
  cave: { bg: '#2c2622', fog: [20, 44], hemi: ['#c8b8a0', '#3a3028', 0.8], sun: ['#ffe2b8', 1.6] },
  lake: { bg: '#a6d4f2', fog: [28, 62], hemi: ['#e0f2ff', '#507060', 1.2], sun: ['#fff6e0', 2.3] },
  indoor: { bg: '#262a36', fog: [26, 56], hemi: ['#eef0ff', '#4a4a5a', 1.05], sun: ['#ffffff', 2.1] },
  night: { bg: '#0d1122', fog: [18, 40], hemi: ['#6a7ab4', '#22223a', 0.5], sun: ['#8a98ff', 0.7] },
  sky: { bg: '#8cc4ff', fog: [32, 75], hemi: ['#ffffff', '#9cc0e8', 1.3], sun: ['#fff4e0', 2.4] },
  volcano: { bg: '#2a1310', fog: [20, 46], hemi: ['#ffb890', '#3a1010', 0.85], sun: ['#ffa070', 1.9] },
  snow: { bg: '#bcd6ee', fog: [24, 56], hemi: ['#f0f6ff', '#7a98b8', 0.95], sun: ['#eef6ff', 1.7] },
  glacier: { bg: '#7fa8d4', fog: [22, 52], hemi: ['#e0eeff', '#5a7898', 0.9], sun: ['#dfeaff', 1.5] },
  dusk: { bg: '#3a2a48', fog: [20, 48], hemi: ['#d0b0ff', '#2a2038', 0.75], sun: ['#ffc8a0', 1.5] },
};

// ground: pintor del suelo · palette: colores base · lines: líneas del campo · emblem: color del
// emblema central · outside: color de los alrededores · decor: tipo de decorado · rock: estilo y color
// de las rocas del mapa · curb: colores del bordillo · light: iluminación · dark: arena a oscuras
const THEMES = {
  pradera: { ground: 'grass', palette: ['#6aa847', '#5c9a3e'], lines: true, outside: '#4c7a35', decor: 'trees', rock: ['boulder', '#9a948a'], curb: ['#b8b0a0', '#8e8678'], light: 'day' },
  bosque: { ground: 'grass', palette: ['#4f9038', '#437f30'], lines: true, flowers: 20, outside: '#355f28', decor: 'forest', rock: ['boulder', '#857e70'], curb: ['#9a8f78', '#76705e'], light: 'forest' },
  cueva: { ground: 'rock', palette: ['#867664', '#6c5e4e'], outside: '#3e352d', decor: 'rocks', rock: ['boulder', '#8a7c6a'], curb: ['#7a6e60', '#5e5448'], light: 'cave' },
  lago: { ground: 'sand', palette: ['#d9c58e', '#c9b27a'], lines: true, outside: '#3f7fc0', water: true, decor: 'reeds', rock: ['boulder', '#a49c8c'], curb: ['#d8cdb0', '#b4a88a'], light: 'lake' },
  'g-roca': { ground: 'rock', palette: ['#8e7d68', '#6f5f4c'], emblem: '#c0a060', outside: '#3a3029', decor: 'rocks', rock: ['boulder', '#94846c'], curb: ['#7e705e', '#5e5446'], light: 'cave' },
  'g-agua': { ground: 'tiles', palette: ['#e8f4fa', '#d4e8f2'], tile: ['#eef8fc', '#cfe6f2'], grout: '#9cc4dc', emblem: '#3a8fe0', outside: '#2f6fb8', water: true, decor: 'pool', rock: ['pillar', '#e8eef4'], curb: ['#f2f6fa', '#c4d4e0'], light: 'indoor' },
  'g-electrico': { ground: 'metal', palette: ['#8c939c', '#737a84'], emblem: '#ffd23a', outside: '#3a3f46', decor: 'machines', rock: ['crate', '#5c6470'], curb: ['#e8c030', '#2a2a2a'], light: 'indoor' },
  'g-planta': { ground: 'grass', palette: ['#5fae46', '#4f9a3a'], flowers: 260, emblem: '#ff8ac0', outside: '#3c7a30', decor: 'flowers', rock: ['boulder', '#9aa08a'], curb: ['#e8dcc0', '#c4b494'], light: 'day' },
  'g-veneno': { ground: 'tatami', palette: ['#4a3a50', '#3c2e44'], emblem: '#b060e0', outside: '#22182a', decor: 'lanterns', rock: ['grave', '#5a4a64'], curb: ['#5a3a20', '#3a2414'], light: 'dusk' },
  'g-psiquico': { ground: 'marble', palette: ['#d8c8ec', '#bca8d8'], emblem: '#ff5ab0', outside: '#2a1e3a', decor: 'crystals', crystal: '#ff7ad0', rock: ['pillar', '#e8e0f4'], curb: ['#e0d4f0', '#a090c0'], light: 'dusk' },
  'g-fuego': { ground: 'volcanic', palette: ['#3a2a26', '#2a1e1a'], emblem: '#ff6020', outside: '#1e1210', decor: 'volcano', rock: ['boulder', '#4a3a34'], curb: ['#4a3430', '#2a1c18'], light: 'volcano' },
  'g-tierra': { ground: 'sand', palette: ['#c8a46e', '#b08c58'], emblem: '#8a5a2a', outside: '#6a5034', decor: 'rocks', rock: ['boulder', '#9a7a56'], curb: ['#a88a62', '#86684a'], light: 'day' },
  'g-volador': { ground: 'planks', palette: ['#b88a58', '#9c7244'], emblem: '#7ab0ff', outside: null, decor: 'clouds', rock: ['crate', '#8a643c'], curb: ['#8a643c', '#6a4a2a'], light: 'sky' },
  'g-bicho': { ground: 'moss', palette: ['#5a8f3a', '#4a7a30'], flowers: 40, emblem: '#a0d040', outside: '#2e5222', decor: 'forest', rock: ['boulder', '#7a8a60'], curb: ['#c8d8b8', '#90a880'], light: 'forest' },
  'g-normal': { ground: 'tiles', palette: ['#f6d8e4', '#eec4d4'], tile: ['#fae4ee', '#f0ccdc'], grout: '#d8a0b8', emblem: '#ff70a0', outside: '#5a3a48', decor: 'stands', rock: ['pillar', '#fff0f6'], curb: ['#ffffff', '#e8c0d0'], light: 'indoor' },
  'g-fantasma': { ground: 'rock', palette: ['#4a4258', '#3a3448'], emblem: '#8a60e0', outside: '#1a1624', decor: 'graves', rock: ['grave', '#6a6478'], curb: ['#5a5468', '#3a3448'], light: 'night', dark: true },
  'g-siniestro': { ground: 'marble', palette: ['#30303c', '#24242e'], emblem: '#6a5aa0', outside: '#121218', decor: 'lanterns', rock: ['pillar', '#3a3a48'], curb: ['#3a3a48', '#24242e'], light: 'night', dark: true },
  'g-lucha': { ground: 'stone', palette: ['#a8a090', '#8e8676'], emblem: '#e05030', outside: '#3a5a3a', decor: 'cliffs', rock: ['boulder', '#8c8476'], curb: ['#a09888', '#7a7262'], light: 'day' },
  'g-acero': { ground: 'metal', palette: ['#a6b0ba', '#8c96a2'], emblem: '#c0c8d8', outside: '#24466e', water: true, decor: 'harbor', rock: ['crate', '#7a8694'], curb: ['#c8d0d8', '#8a96a4'], light: 'dusk' },
  'g-hielo': { ground: 'snow', palette: ['#eef6fc', '#d8e8f4'], emblem: '#7ac8ff', outside: '#dce8f2', decor: 'snow', rock: ['ice', '#bfe6ff'], curb: ['#ffffff', '#c4d8e8'], light: 'snow' },
  'g-dragon': { ground: 'volcanic', palette: ['#2e2638', '#221c2a'], emblem: '#8a60ff', outside: '#140f1a', decor: 'volcano', rock: ['boulder', '#3e3448'], curb: ['#3e3448', '#241e2c'], light: 'volcano' },
};
Object.assign(THEMES, {
  'e-lorelei': { ground: 'snow', palette: ['#dceaf6', '#c4d8ea'], emblem: '#4aa8ff', outside: '#b8d0e6', decor: 'snow', rock: ['ice', '#9fd4ff'], curb: ['#e8f2fa', '#a8c4dc'], light: 'glacier' },
  'e-bruno': { ground: 'stone', palette: ['#8e8272', '#746a5c'], emblem: '#e05030', outside: '#3a322a', decor: 'rocks', rock: ['boulder', '#7e7262'], curb: ['#6a5e50', '#4a4238'], light: 'cave' },
  'e-agatha': { ground: 'rock', palette: ['#3e3650', '#30293e'], emblem: '#a070ff', outside: '#15111e', decor: 'graves', rock: ['grave', '#5e5670'], curb: ['#4a4458', '#2e2a3a'], light: 'night', dark: true },
  'e-lance': { ground: 'volcanic', palette: ['#2a2036', '#1c1626'], emblem: '#7a50ff', outside: '#120c18', decor: 'volcano', rock: ['boulder', '#3a3046'], curb: ['#3a3046', '#201a2a'], light: 'volcano' },
  'e-azul': { ground: 'marble', palette: ['#efe4c8', '#d8c8a0'], emblem: '#ffc020', outside: '#3a2e1a', decor: 'stands', standColors: ['#ffc020', '#ffffff'], rock: ['pillar', '#f4ecd8'], curb: ['#ffe080', '#c8a040'], light: 'indoor' },
  'e-will': { ground: 'marble', palette: ['#e4c8ec', '#c8a4d8'], emblem: '#ff4ab0', outside: '#24142e', decor: 'crystals', crystal: '#ff4ad0', rock: ['pillar', '#f0e0f8'], curb: ['#e8d0f4', '#a080c0'], light: 'dusk' },
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
      g.fillStyle = `rgba(${r() < 0.5 ? '120,180,80' : '60,120,45'},${0.15 + r() * 0.2})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 12 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 6;
      g.strokeStyle = `rgba(${r() < 0.5 ? '150,205,95' : '55,110,40'},${0.35 + r() * 0.4})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke();
    }
    flowers(g, w, h, r, th.flowers ?? 70);
  },
  moss(g, w, h, r, th) {
    PAINT.grass(g, w, h, r, { flowers: 0 });
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,80,30' : '140,190,80'},0.25)`; g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 10, 0, 7); g.fill(); }
    flowers(g, w, h, r, th.flowers);
  },
  rock(g, w, h, r) {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '20,15,10'},${0.05 + r() * 0.08})`;
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
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 1, y + 1, s, s * 0.7, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(${170 + r() * 50},${150 + r() * 40},${120 + r() * 40},0.9)`; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 7); g.fill();
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
      for (const [lw, col] of [[7, 'rgba(255,90,20,0.18)'], [3, 'rgba(255,120,30,0.55)'], [1.2, 'rgba(255,220,120,0.9)']]) {
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
// Emblema del gimnasio: anillo con el color del tipo y una Poké Ball estilizada
function emblem(g, w, h, color) {
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = color; g.lineWidth = 7;
  g.strokeRect(16, 16, w - 32, h - 32);
  g.beginPath(); g.arc(w / 2, h / 2, 110, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2 - 110, h / 2); g.lineTo(w / 2 - 26, h / 2); g.moveTo(w / 2 + 26, h / 2); g.lineTo(w / 2 + 110, h / 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 26, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.18; g.fillStyle = color;
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
    if (th.lines) fieldLines(g, w, h, 'rgba(255,255,255,0.35)');
    if (th.emblem) emblem(g, w, h, th.emblem);
  });
}
function outsideTexture(color) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.06 + r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 2, 3 + r() * 3);
    }
  }, 8);
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

// Materiales compartidos por color y opciones (el decorado repite los mismos cientos de veces)
const matCache = new Map();
const mat = (color, o = {}) => {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  return matCache.get(key);
};
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
  }

  placeCamera(aspect) {
    // Cámara inclinada estilo Battlerite; más alta si la ventana es estrecha
    const cx = COLS / 2, cz = ROWS / 2;
    const fit = Math.max(1, 1.62 / aspect);
    this.camera.aspect = aspect;
    this.camera.position.set(cx, 17.5 * fit, cz + 11.5 * fit);
    this.camera.lookAt(cx, 0, cz + 0.6);
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
    this.scene.fog = new THREE.Fog('#9cc8ec', 28, 60);
  }

  ground() {
    this.arena = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({ roughness: 0.95 }));
    this.arena.rotation.x = -Math.PI / 2;
    this.arena.position.set(COLS / 2, 0, ROWS / 2);
    this.arena.receiveShadow = true;
    this.scene.add(this.arena);
    this.outside = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ roughness: 1 }));
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
    const L = LIGHT[th.light] || LIGHT.day;
    this.scene.background = new THREE.Color(L.bg);
    this.scene.fog.color.set(L.bg); this.scene.fog.near = L.fog[0]; this.scene.fog.far = L.fog[1];
    this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    this.sun.color.set(L.sun[0]); this.sun.intensity = L.sun[1];
    this.arena.material.map = this.tex('g:' + name, () => groundTexture(name));
    this.arena.material.roughness = ['tiles', 'marble', 'metal'].includes(th.ground) ? 0.45 : 0.95;
    this.arena.material.metalness = th.ground === 'metal' ? 0.35 : 0;
    this.arena.material.needsUpdate = true;
    this.outside.visible = !!th.outside;
    if (th.outside) {
      this.outside.material.map = th.water ? null : this.tex('o:' + th.outside, () => outsideTexture(th.outside));
      this.outside.material.color.set(th.water ? th.outside : '#ffffff');
      this.outside.material.roughness = th.water ? 0.2 : 1;
      this.outside.material.metalness = th.water ? 0.1 : 0;
      this.outside.material.needsUpdate = true;
    }
    this.curbMats[0].color.set(th.curb[0]); this.curbMats[1].color.set(th.curb[1]);
    this.dark = !!th.dark;
    this.buildDecor(name, th);
  }

  clearGroup(g) {
    for (const o of [...g.children]) {
      g.remove(o);
      o.traverse(x => { if (x.geometry) x.geometry.dispose(); });
    }
  }

  // Decorado alrededor de la arena (no se puede pisar)
  buildDecor(name, th) {
    this.clearGroup(this.decorGroup);
    this.animated = [];
    const r = rng(seedOf(name, 'decorado'));
    const add = (o, x, z) => { o.position.set(x, o.position.y, z); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); this.decorGroup.add(o); return o; };
    const free = (x, z) => !(x > -1.2 && x < COLS + 1.2 && z > -1.2 && z < ROWS + 1.2);
    const spots = n => { const out = []; let k = 0; while (out.length < n && k++ < n * 6) { const x = -14 + r() * (COLS + 28), z = -12 + r() * (ROWS + 24); if (free(x, z)) out.push([x, z]); } return out; };
    const leaves = (th.leaves || ['#3f7f35', '#4a8f3a', '#356f2c', '#5a9a40']).map(c => mat(c, { roughness: 0.9, flatShading: true }));
    const trunk = mat('#6a4a30', { roughness: 1 });
    const tree = (scale = 1, cols = leaves) => {
      const g = new THREE.Group(), h = (1.2 + r() * 1.2) * scale;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, h, 6), trunk); t.position.y = h / 2; g.add(t);
      for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 - i * 0.18 + r() * 0.2) * scale, 0), cols[(r() * cols.length) | 0]); f.position.set((r() - 0.5) * 0.4, h + i * 0.55 * scale, (r() - 0.5) * 0.4); g.add(f); }
      return g;
    };
    const boulder = (c, s = 1) => { const b = new THREE.Mesh(new THREE.DodecahedronGeometry((0.35 + r() * 0.5) * s, 0), mat(c, { flatShading: true, roughness: 0.95 })); b.position.y = 0.2 * s; b.rotation.set(r() * 3, r() * 3, r() * 3); return b; };
    const kind = th.decor;
    if (kind === 'trees' || kind === 'forest' || kind === 'reeds' || kind === 'flowers') {
      const n = kind === 'forest' ? 340 : 240;
      for (const [x, z] of spots(n)) {
        const k = r();
        if (kind === 'reeds' && k < 0.5) {   // juncos de lago
          const g = new THREE.Group();
          for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8 + r() * 0.6, 4), mat('#6a8a3a')); c.position.set((r() - 0.5) * 0.5, 0.5, (r() - 0.5) * 0.5); c.rotation.z = (r() - 0.5) * 0.3; g.add(c); }
          add(g, x, z);
        } else if (kind === 'flowers' && k < 0.45) {   // arbustos con flores
          const g = new THREE.Group();
          const fc = ['#ff6a9a', '#ffd84a', '#ffffff', '#c890ff', '#ff5a40'][(r() * 5) | 0];
          for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + r() * 0.25, 0), leaves[(r() * 4) | 0]); b.position.set((r() - 0.5) * 0.7, 0.3, (r() - 0.5) * 0.7); g.add(b); }
          for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(fc, { emissive: fc, emissiveIntensity: 0.15 })); f.position.set((r() - 0.5) * 0.9, 0.5 + r() * 0.3, (r() - 0.5) * 0.9); g.add(f); }
          add(g, x, z);
        } else if (k < 0.7) add(tree(kind === 'forest' ? 1.2 : 1), x, z);
        else if (k < 0.9) { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + r() * 0.25, 0), leaves[(r() * 4) | 0]); b.position.set((r() - 0.5) * 0.7, 0.25, (r() - 0.5) * 0.7); g.add(b); } add(g, x, z); }
        else add(boulder('#8f8a80'), x, z);
      }
    } else if (kind === 'rocks' || kind === 'cliffs') {
      const rc = th.rock[1];
      for (const [x, z] of spots(200)) {
        const k = r();
        if (k < 0.55) add(boulder(rc, 1 + r() * 1.4), x, z);
        else if (k < 0.85) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.3 + r() * 0.4, 1.2 + r() * 2.2, 6), mat(rc, { flatShading: true })); c.position.y = 0.6; add(c, x, z); }
        else if (kind === 'cliffs') add(tree(1.1), x, z);
        else add(boulder(shade(rc, 0.8), 0.6), x, z);
      }
      if (kind === 'cliffs') {   // acantilado al fondo de donde caen las cascadas
        for (let x = -6; x < COLS + 6; x += 1.6) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3 + r() * 2.5, 2.2), mat(shade(rc, 0.9 + r() * 0.2), { flatShading: true })); c.position.y = 1.5; add(c, x, -2.4 - r()); }
        const fcols = [...new Set([...Shared.parseMap(name).flow.keys()].map(i => i % COLS))].sort((a, b) => a - b);
        const falls = fcols.filter((c, k) => k === 0 || fcols[k - 1] !== c - 1).map(c => c + (fcols.includes(c + 1) ? 0.5 : 0));
        for (const x of falls) {
          const fall = new THREE.Mesh(new THREE.PlaneGeometry(2, 4.5), new THREE.MeshBasicMaterial({ map: this.flowTex, color: '#cfeeff', transparent: true, opacity: 0.85, depthWrite: false }));
          fall.position.set(x + 0.5, 2.2, -1.1);
          this.decorGroup.add(fall);
          this.animated.push(dt => { fall.material.map.offset.y += dt * 1.6; });
        }
      }
    } else if (kind === 'pool') {   // piscina: gradas blancas y focos
      for (const [x, z] of spots(60)) { const b = new THREE.Mesh(new THREE.BoxGeometry(1 + r(), 0.5, 1 + r()), mat('#f0f4f8')); b.position.y = 0.25; add(b, x, z); }
      this.stands('#3a8fe0', '#ffffff');
    } else if (kind === 'stands') {
      this.stands(...(th.standColors || ['#ff70a0', '#ffd0e0']));
    } else if (kind === 'machines') {
      const stripe = mat('#e8c030'), dark = mat('#2c3036', { metalness: 0.4, roughness: 0.5 });
      for (const [x, z] of spots(110)) {
        const k = r();
        if (k < 0.5) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 + r() * 1.2, 0.6 + r() * 1.4, 0.8 + r() * 1.2), dark); b.position.y = b.geometry.parameters.height / 2; add(b, x, z); }
        else if (k < 0.75) {   // torre eléctrica con luz
          const g = new THREE.Group();
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), dark); p.position.y = 1.5; g.add(p);
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat('#ffe060', 2.5)); l.position.y = 3.1; g.add(l);
          add(g, x, z);
          this.animated.push(() => { l.visible = Math.sin(this.time * 6 + x) > -0.6; });
        } else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), stripe); b.position.y = 0.45; add(b, x, z); }
      }
    } else if (kind === 'lanterns') {
      for (const [x, z] of spots(90)) {
        const k = r();
        if (k < 0.35) {
          const g = new THREE.Group();
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), mat('#2a1a10')); p.position.y = 0.8; g.add(p);
          const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 10), glowMat(name === 'g-siniestro' ? '#a080ff' : '#ff6a3a', 1.6)); l.position.y = 1.7; g.add(l);
          add(g, x, z);
        } else if (k < 0.7) add(boulder('#3a3044', 1.2), x, z);
        else add(tree(1, [mat('#2a3a2a', { flatShading: true }), mat('#20301f', { flatShading: true })]), x, z);
      }
    } else if (kind === 'crystals') {
      const c1 = glowMat(th.crystal, 1.4), c2 = mat('#c8b0e8', { emissive: th.crystal, emissiveIntensity: 0.4, roughness: 0.2 });
      for (const [x, z] of spots(120)) {
        const k = r();
        if (k < 0.5) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.25 + r() * 0.5, 0), r() < 0.4 ? c1 : c2); c.scale.y = 1.8; c.position.y = 0.5; c.rotation.y = r() * 3; add(c, x, z); }
        else if (k < 0.8) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2.4 + r() * 1.5, 10), mat('#e8e0f4')); p.position.y = 1.4; add(p, x, z); }
        else add(boulder('#4a3a5a'), x, z);
      }
    } else if (kind === 'volcano') {
      const lava = glowMat('#ff5a10', 2.2);
      for (const [x, z] of spots(170)) {
        const k = r();
        if (k < 0.55) add(boulder(r() < 0.5 ? '#2a2020' : '#3a2c28', 1 + r() * 1.5), x, z);
        else if (k < 0.75) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.5 + r() * 0.6, 1.5 + r() * 2.5, 7), mat('#2a1e1e', { flatShading: true })); c.position.y = 0.8; add(c, x, z); }
        else { const p = new THREE.Mesh(new THREE.CircleGeometry(0.3 + r() * 0.6, 10), lava); p.rotation.x = -Math.PI / 2; p.position.y = 0.01; add(p, x, z); }
      }
    } else if (kind === 'clouds') {   // plataforma en el cielo: nubes por debajo y alrededor
      const cm = mat('#ffffff', { roughness: 1 });
      for (const [x, z] of spots(70)) {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.8 + r() * 0.9, 10, 8), cm); s.position.set((r() - 0.5) * 2.2, (r() - 0.5) * 0.4, (r() - 0.5) * 1.2); g.add(s); }
        g.position.y = -2.5 - r() * 3;
        add(g, x, z);
        const ph = r() * 6;
        this.animated.push(() => { g.position.y = -2.5 - Math.sin(this.time * 0.3 + ph) * 0.3; });
      }
      // Pilares de madera que sostienen la plataforma
      for (const [x, z] of [[0, 0], [COLS, 0], [0, ROWS], [COLS, ROWS], [COLS / 2, 0], [COLS / 2, ROWS]]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 8), mat('#6a4a2a')); p.position.y = -4; add(p, x, z);
      }
    } else if (kind === 'graves') {
      const stone = mat('#6a6478', { flatShading: true });
      for (const [x, z] of spots(130)) {
        const k = r();
        if (k < 0.45) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.16), stone); s.position.y = 0.4; s.rotation.y = (r() - 0.5) * 0.4; s.rotation.z = (r() - 0.5) * 0.2; add(s, x, z); }
        else if (k < 0.65) {   // vela
          const g = new THREE.Group();
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), mat('#e8e0d0')); c.position.y = 0.2; g.add(c);
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat('#b080ff', 3)); f.position.y = 0.48; g.add(f);
          add(g, x, z);
          const ph = r() * 6;
          this.animated.push(() => { f.scale.setScalar(0.8 + Math.sin(this.time * 9 + ph) * 0.25); });
        } else add(tree(1.1, [mat('#2a2438', { flatShading: true }), mat('#1e1a2a', { flatShading: true })]), x, z);
      }
    } else if (kind === 'snow') {
      const snowL = [mat('#e8f2fa', { flatShading: true }), mat('#d0e2f0', { flatShading: true }), mat('#2f5a3a', { flatShading: true })];
      const ice = mat('#bfe6ff', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
      for (const [x, z] of spots(200)) {
        const k = r();
        if (k < 0.5) {
          const g = new THREE.Group(), h = 1.6 + r() * 1.4;
          for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.22, 1.1, 7), snowL[i === 2 ? 0 : (r() < 0.5 ? 2 : 1)]); c.position.y = 0.6 + i * h * 0.3; g.add(c); }
          add(g, x, z);
        } else if (k < 0.75) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + r() * 0.5, 0), ice); c.scale.y = 2; c.position.y = 0.6; add(c, x, z); }
        else add(boulder('#e8f0f8', 1.4), x, z);
      }
    } else if (kind === 'harbor') {   // faro junto al mar: muelles de madera y bolardos
      for (let x = -4; x < COLS + 4; x += 2) for (const z of [-2, ROWS + 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 2.6), mat('#7a5a3a')); b.position.y = 0.05; add(b, x, z); }
      for (const [x, z] of spots(40)) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8), mat('#3a3f46', { metalness: 0.5 })); b.position.y = 0.3; add(b, x, z); }
    }
  }

  // Gradas a los dos lados largos de la arena (piscina y estadio)
  stands(c1, c2) {
    const seat = [mat(c1), mat(c2)];
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
      const z = side < 0 ? -2.2 - row * 0.9 : ROWS + 2.2 + row * 0.9;
      const step = new THREE.Mesh(new THREE.BoxGeometry(COLS + 4, 0.45 + row * 0.45, 0.9), mat('#d8d8e0'));
      step.position.set(COLS / 2, (0.45 + row * 0.45) / 2, z);
      step.receiveShadow = step.castShadow = true;
      this.decorGroup.add(step);
      for (let x = -1; x < COLS + 1; x += 0.7) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), seat[(Math.floor(x * 1.4) + row) % 2]);
        s.position.set(x + 0.4, 0.45 + row * 0.45 + 0.12, z);
        this.decorGroup.add(s);
      }
    }
  }

  // ---------- Elementos de las arenas ----------
  buildProps(name) {
    this.clearGroup(this.props);
    this.panels = null; this.pads = null; this.healPads = null; this.beam = null;
    const mech = Shared.mechOf(name);
    const marks = Shared.parseMap(name);
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
      const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(beamColor).multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
      const pivot = new THREE.Group();
      pivot.position.set(COLS / 2, 0.06, ROWS / 2);
      for (const s of [1, -1]) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(len, w).translate(len / 2 + 1, 0, 0), beamMat);
        b.rotation.x = -Math.PI / 2; b.rotation.z = s < 0 ? Math.PI : 0;
        pivot.add(b);
        const v = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.6).translate(len / 2 + 1, 0.8, 0), beamMat);
        v.rotation.y = s < 0 ? Math.PI : 0;
        pivot.add(v);
      }
      this.props.add(pivot);
      this.beam = { pivot, a: 0, target: 0 };
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
  loadMap(mapName, terrain) {
    if (this.mapName !== mapName) { this.applyTheme(mapName); this.buildProps(mapName); }
    this.mapName = mapName;
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
      } else {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * U * 1.1, 0), new THREE.MeshStandardMaterial({ color: this.theme ? this.theme.rock[1] : '#a08868', roughness: 0.9, flatShading: true }));
        mesh.position.copy(toWorld(o.x, o.y, -0.6));
        mesh.userData.rise = true;
        mesh.castShadow = mesh.receiveShadow = true;
      }
      this.scene.add(mesh);
      this.obstacles.set(o.id, { mesh, data: o });
    }
    for (const [id, o] of this.obstacles) if (!seen.has(id)) { this.scene.remove(o.mesh); o.mesh.geometry.dispose(); this.obstacles.delete(id); }
  }

  // Obstáculos para la predicción de movimiento (rocas del mapa + dinámicos)
  collisionList() {
    return [...(this.mapRocks || []), ...[...this.obstacles.values()].map(o => o.data)];
  }

  update(dt, particles) {
    this.time += dt;
    const t = this.time;
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
      if (o.mesh.userData.rise && o.mesh.position.y < o.data.r * U * 0.6) o.mesh.position.y += dt * 6;
      if (o.mesh.userData.ghost) {
        // el muro invisible brilla un poco cuando el Pokémon propio está pegado a él
        const near = this.focus ? Math.hypot(this.focus.x - o.data.x, this.focus.y - o.data.y) < o.data.r + 40 : false;
        o.mesh.material.opacity += ((near ? 0.3 : 0.008 + Math.max(0, Math.sin(t * 1.3 + o.data.x)) * 0.02) - o.mesh.material.opacity) * Math.min(1, dt * 6);
      }
    }
    // Luz del Pokémon propio en las arenas a oscuras
    this.focusLight.intensity = this.dark && this.focus ? 7 : 0;
    if (this.focus) this.focusLight.position.set(this.focus.x * U, 2.2, this.focus.y * U);
    // Elementos de la arena
    for (const a of this.animated || []) a(dt);
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
