// El menú, mirado en los píxeles de la captura: lo que tiene premio (Lucky Spin, Logros, Misiones) lleva un halo dorado
// que se ve aunque no esté en lo alto del parpadeo, y la franja de color de las tarjetas no se sale por sus esquinas.
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Lee un PNG de 8 bits RGB o RGBA, sin entrelazar (lo que da la captura del navegador)
function png(file) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ch = b[25] === 6 ? 4 : 3;
  const parts = [];
  for (let i = 8; i < b.length;) {
    const len = b.readUInt32BE(i), type = b.toString('latin1', i + 4, i + 8);
    if (type === 'IDAT') parts.push(b.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts)), row = w * ch, px = Buffer.alloc(h * row);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)];
    for (let x = 0; x < row; x++) {
      const v = raw[y * (row + 1) + 1 + x];
      const a = x >= ch ? px[y * row + x - ch] : 0, u = y ? px[(y - 1) * row + x] : 0, c = x >= ch && y ? px[(y - 1) * row + x - ch] : 0;
      const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c);
      const pred = f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? u : c) : 0;
      px[y * row + x] = (v + pred) & 255;
    }
  }
  return (x, y) => { const i = Math.round(y) * row + Math.round(x) * ch; return [px[i], px[i + 1], px[i + 2]]; };
}

module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'destacados' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2, gems: 500 });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.waitSee('Recoger todo');
  await page.waitSee('premios por recoger');
  // Fondo negro y sin el 3D, para que solo se vea lo que pinta el menú; y sin parpadeo: se mira lo que queda en el
  // punto más flojo, el que se ve siempre
  await page.eval(`(() => { const s = document.createElement('style');
    s.textContent = 'canvas { display: none !important } html, body, #app, .menu { background: #000 !important } *, *::before, *::after { animation: none !important; transition: none !important }';
    document.head.append(s); return true; })()`);
  const box = sel => page.eval(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  const file = path.join(os.tmpdir(), `destacados-${process.pid}.png`);
  await page.shot(file);
  const at = png(file);
  fs.unlinkSync(file);

  // Las esquinas: justo fuera de la curva no hay color de la tarjeta
  for (const [nombre, sel] of [['Historia', '.menu-card.story'], ['Torre Batalla', '.menu-card.tower'], ['Clasificatoria', '.menu-card.ranked']]) {
    const c = await box(sel);
    const [r, g, b] = at(c.x + 4, c.y + 3);
    ok(Math.max(r, g, b) < 50, `la franja de ${nombre} no se sale por la esquina (hay rgb ${r},${g},${b})`);
  }

  // El halo: a 7 px del borde, un dorado que se distingue (el rojo muy por encima del azul)
  const halo = (nombre, [r, g, b]) => ok(r - b > 70 && g - b > 40, `alrededor de ${nombre} se ve el halo dorado (hay rgb ${r},${g},${b})`);
  const tz = await box('.hub-left .hub-tz');
  halo('Lucky Spin', at(tz.x + tz.w / 2, tz.y - 7));
  const logros = await box('.hub-coll .coll-tile.ready');
  halo('Logros', at(logros.x - 7, logros.y + logros.h / 2));
  const mis = await box('.missions-widget');
  halo('Misiones', at(mis.x - 7, mis.y + mis.h / 2));
};
