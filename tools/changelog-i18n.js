// Mete las traducciones de unas notas de parche en todos los diccionarios (public/js/lang/*.js) de una
// vez, en un bloque «Novedades vX.Y.Z» al principio de su objeto text. Lo usa la skill patch-notes.
//   node tools/changelog-i18n.js traducciones.json
// traducciones.json: { "v": "0.13.0", "en": { "Texto en español": "English text", … }, "zh": { … }, … }
// Tiene que traer todos los idiomas del juego (los de LANGS en public/js/i18n.js menos el español) y
// las mismas claves en cada uno. Las claves que un diccionario ya tiene se sustituyen.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public', 'js');
const file = process.argv[2];
if (!file) { console.log('Uso: node tools/changelog-i18n.js traducciones.json'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const v = String(data.v || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('Falta "v": la versión de las notas (X.Y.Z)');

const langs = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8')
  .match(/export const LANGS = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'))).filter(l => l !== 'es');
const keys = Object.keys(data[langs[0]] || {});
for (const l of langs) {
  const got = Object.keys(data[l] || {});
  if (!got.length) throw new Error(`Falta el idioma ${l}`);
  const missing = keys.filter(k => !got.includes(k)), extra = got.filter(k => !keys.includes(k));
  if (missing.length || extra.length) throw new Error(`${l}: claves distintas a las de ${langs[0]} (faltan ${missing.length}, sobran ${extra.length})`);
  for (const [k, val] of Object.entries(data[l])) {
    if (typeof val !== 'string' || !val.trim()) throw new Error(`${l}: traducción vacía para «${k}»`);
    const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort().join();
    if (vars(k) !== vars(val)) throw new Error(`${l}: las variables {…} no coinciden en «${k}»`);
  }
}

const js = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
for (const l of langs) {
  const p = path.join(ROOT, 'lang', `${l}.js`);
  let src = fs.readFileSync(p, 'utf8');
  // Fuera las versiones anteriores de estas claves (si ya estaban)
  for (const k of keys) src = src.replace(new RegExp(`^\\s*'${js(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':.*\\n`, 'm'), '');
  const at = src.indexOf('\n  text: {\n');
  if (at < 0) throw new Error(`${l}.js: no encuentro «text: {»`);
  const block = `    // ---------- Novedades v${v} ----------\n` + keys.map(k => `    '${js(k)}': '${js(data[l][k])}',\n`).join('');
  const cut = at + '\n  text: {\n'.length;
  fs.writeFileSync(p, src.slice(0, cut) + block + src.slice(cut));
  console.log(`${l}: ${keys.length} textos`);
}
