// Copia los sprites de SpriteCollab (vía un clon de PokéSurvivor) para todas las especies de
// public/data.js (normales y shiny), genera public/sprites/meta.js, public/hitbox.js (radio de
// colisión según el tamaño del sprite) y la tabla de artistas de CREDITS.md.
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

// Radio de colisión (px de juego) según la sombra de SpriteCollab (0 pequeña, 1 media, 2 grande)
// y la anchura del fotograma de Idle: los pequeños son difíciles de acertar, los grandes fáciles.
function hitbox(m) {
  const w = m.a.Idle ? m.a.Idle.w : m.a.Walk ? m.a.Walk.w : 32;
  const base = 10 + w * 0.3 + [-2, 0, 3][m.s || 0];
  return Math.max(13, Math.min(34, Math.round(base)));
}

const meta = {}, hit = {};
const dexes = Object.keys(Data.SPECIES).map(Number);
let shinies = 0;
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
  // Shiny: misma geometría; si a alguna animación le falta o difiere, el cliente usa la normal
  if (m.sh) {
    const sdir = path.join(src, 'assets/pokemon', String(dex), 's');
    const have = ANIMS.filter(anim => m.a[anim] && fs.existsSync(path.join(sdir, anim + '.png')) && !(m.sm && m.sm.includes(anim)) && !(m.sa && m.sa[anim]));
    if (have.length) {
      fs.mkdirSync(path.join(out, 's'), { recursive: true });
      for (const anim of have) fs.copyFileSync(path.join(sdir, anim + '.png'), path.join(out, 's', anim + '.png'));
      meta[dex].sh = have;
      shinies++;
    }
  }
  hit[dex] = hitbox(m);
}
const lines = dexes.map(d => `  ${d}: ${JSON.stringify(meta[d])},`).join('\n');
fs.writeFileSync(path.join(root, 'public/sprites/meta.js'),
  `// Generado por tools/import-sprites.js a partir de los AnimData.xml de SpriteCollab. No editar a mano.\n` +
  `// Por animación: w,h fotograma · d duración de cada fotograma (1/60 s) · ax,ay ancla en los pies.\n` +
  `// Filas: 0 abajo, 1 abajo-dcha, 2 dcha, 3 arriba-dcha, 4 arriba, 5 arriba-izq, 6 izq, 7 abajo-izq.\n` +
  `// hv = flota en su sprite · sh = animaciones con versión shiny en sprites/{dex}/s/.\nwindow.SPRITE_META = {\n${lines}\n};\n`);
fs.writeFileSync(path.join(root, 'public/hitbox.js'),
  `// Generado por tools/import-sprites.js: radio de colisión (px) de cada especie según su sprite. No editar a mano.\n` +
  `(function (root) {\n  const HITBOX = ${JSON.stringify(hit)};\n` +
  `  if (typeof module !== 'undefined' && module.exports) module.exports = HITBOX;\n  else root.HITBOX = HITBOX;\n})(this);\n`);

// Artistas de cada sprite, sacados de los créditos de PokéSurvivor (que vienen de SpriteCollab).
const wanted = new Set(dexes.map(String));
const rows = [];
for (const line of fs.readFileSync(path.join(src, 'CREDITS.md'), 'utf8').split('\n')) {
  const c = line.split('|');
  if (c.length < 5 || !/\d/.test(c[3])) continue;
  const hitDex = c[3].split(',').map(s => s.trim()).filter(n => wanted.has(n));
  if (hitDex.length) rows.push(`| ${c[1].trim()} | ${c[2].trim()} | ${hitDex.join(', ')} |`);
}
const credits = path.join(root, 'CREDITS.md');
const text = fs.readFileSync(credits, 'utf8');
const start = text.indexOf('| Artista |');
const end = text.indexOf('\n\n', start);
fs.writeFileSync(credits, text.slice(0, start) + '| Artista | Contacto | Sprites (nº de Pokédex) |\n|---|---|---|\n' + rows.join('\n') + text.slice(end));
console.log(`${dexes.length} especies (${shinies} con shiny), ${rows.length} artistas`);
