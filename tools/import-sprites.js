// Copia los sprites de SpriteCollab (vía un clon de PokéSurvivor) para todas las especies de
// public/data.js, genera public/sprites/meta.js y la tabla de artistas de CREDITS.md.
//
//   git clone --depth 1 https://github.com/JPTER78/pokesurvivor /tmp/pokesurvivor
//   node tools/import-sprites.js /tmp/pokesurvivor
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = process.argv[2];
if (!src) { console.error('Uso: node tools/import-sprites.js <ruta a pokesurvivor>'); process.exit(1); }
const root = path.join(__dirname, '..');
const Data = require(path.join(root, 'public/data.js'));
const ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];

const ctx = { G: {} };
vm.runInNewContext(fs.readFileSync(path.join(src, 'js/data/sprites-meta.js'), 'utf8'), ctx);
const SRC_META = ctx.G.SPRITE_META;

const meta = {};
const dexes = Object.keys(Data.SPECIES).map(Number);
for (const dex of dexes) {
  const m = SRC_META[dex];
  if (!m) throw new Error(`Sin sprites para ${dex}`);
  const out = path.join(root, 'public/sprites', String(dex));
  fs.mkdirSync(out, { recursive: true });
  meta[dex] = { a: {} };
  if (m.hv) meta[dex].hv = 1;
  for (const anim of ANIMS) {
    const a = m.a[anim];
    if (!a) continue;
    fs.copyFileSync(path.join(src, 'assets/pokemon', String(dex), anim + '.png'), path.join(out, anim + '.png'));
    meta[dex].a[anim] = { w: a.w, h: a.h, d: a.d, ax: a.ax, ay: a.ay };
  }
}
const lines = dexes.map(d => `  ${d}: ${JSON.stringify(meta[d])},`).join('\n');
fs.writeFileSync(path.join(root, 'public/sprites/meta.js'),
  `// Generado por tools/import-sprites.js a partir de los AnimData.xml de SpriteCollab. No editar a mano.\n` +
  `// Por animación: w,h fotograma · d duración de cada fotograma (1/60 s) · ax,ay ancla en los pies.\n` +
  `// Filas: 0 abajo, 1 abajo-dcha, 2 dcha, 3 arriba-dcha, 4 arriba, 5 arriba-izq, 6 izq, 7 abajo-izq.\n` +
  `// hv = flota en su sprite.\nwindow.SPRITE_META = {\n${lines}\n};\n`);

// Artistas de cada sprite, sacados de los créditos de PokéSurvivor (que vienen de SpriteCollab).
const wanted = new Set(dexes.map(String));
const rows = [];
for (const line of fs.readFileSync(path.join(src, 'CREDITS.md'), 'utf8').split('\n')) {
  const c = line.split('|');
  if (c.length < 5 || !/\d/.test(c[3])) continue;
  const hit = c[3].split(',').map(s => s.trim()).filter(n => wanted.has(n));
  if (hit.length) rows.push(`| ${c[1].trim()} | ${c[2].trim()} | ${hit.join(', ')} |`);
}
const credits = path.join(root, 'CREDITS.md');
const text = fs.readFileSync(credits, 'utf8');
const start = text.indexOf('| Artista |');
const end = text.indexOf('\n\n', start);
fs.writeFileSync(credits, text.slice(0, start) + '| Artista | Contacto | Sprites (nº de Pokédex) |\n|---|---|---|\n' + rows.join('\n') + text.slice(end));
console.log(`${dexes.length} especies, ${rows.length} artistas`);
