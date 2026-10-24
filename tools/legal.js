// Rellena la tabla de artistas de los sprites de las páginas legales (public/legal/*.html) a partir
// de CREDITS.md, que es la lista completa (la regenera tools/import-sprites.js). La licencia CC BY-NC
// de los sprites pide que la atribución esté a la vista de quien juega, y el repositorio es privado.
//   node tools/legal.js           actualiza las páginas
//   node tools/legal.js --check   falla si alguna página no está al día con CREDITS.md (npm test)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['public/legal/index.html', 'public/legal/en.html'];
const START = '<!-- artistas:inicio (lo rellena tools/legal.js a partir de CREDITS.md) -->', END = '<!-- artistas:fin -->';
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Filas "| Artista | Contacto | Sprites |" de CREDITS.md (sin el contacto: basta con el nombre)
const rows = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8').split('\n')
  .filter(l => l.startsWith('| ') && !l.startsWith('| Artista') && !l.startsWith('|---'))
  .map(l => l.split('|').slice(1, -1).map(x => x.trim()))
  .filter(c => c.length >= 3 && c[0]);
const html = rows.map(([name, , dex]) => `<tr><td>${esc(name)}</td><td>${esc(dex)}</td></tr>`).join('\n');

let stale = 0;
for (const rel of PAGES) {
  const file = path.join(ROOT, rel), src = fs.readFileSync(file, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i < 0 || j < i) throw new Error(`${rel}: faltan las marcas de la tabla de artistas`);
  const out = src.slice(0, i + START.length) + '\n' + html + '\n' + src.slice(j);
  if (out === src) continue;
  stale++;
  if (!process.argv.includes('--check')) fs.writeFileSync(file, out);
}
if (process.argv.includes('--check')) {
  console.log(stale ? `${stale} página(s) legal(es) sin la lista de artistas al día: ejecuta node tools/legal.js` : `Páginas legales al día (${rows.length} artistas)`);
  process.exit(stale ? 1 : 0);
}
console.log(`${rows.length} artistas en ${PAGES.length} páginas legales${stale ? '' : ' (ya estaban al día)'}`);
