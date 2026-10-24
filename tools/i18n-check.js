// Comprueba las traducciones: busca en public/js los textos t('…') (más las notas de parche y las
// arenas, que vienen de los datos) y lista, por idioma, los que aún no están traducidos y las traducciones cuyas variables {x} no coinciden con las del original.
//   node tools/i18n-check.js           resumen y textos que faltan
//   node tools/i18n-check.js --strict  además falla (código 1) si falta algo o hay variables mal
// Los textos que llegan ya montados (servidor, datos) no salen aquí: se ven en el navegador en
// window.__i18nMissing con el idioma puesto.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const strict = process.argv.includes('--strict');

// Textos literales pasados a t(): t('…') o t("…")
const keys = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
  // Sin las líneas de comentario (los ejemplos de los comentarios no son textos de la interfaz)
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const re = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const key = m[2].replace(/\\(['"\\])/g, '$1');
    if (!keys.has(key)) keys.set(key, f);
  }
}

const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort().join(',');
// Los diccionarios son módulos ES: se evalúan quitando el export
function loadDict(f) {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'lang', f), 'utf8').replace(/export default/, 'module.exports =');
  const mod = { exports: {} };
  new Function('module', src)(mod);
  return mod.exports.text;
}
// Textos que vienen de los datos y se pasan por t() al enseñarlos: notas de parche, arenas y misiones
const CHANGELOG = require('../public/changelog.js');
for (const r of CHANGELOG) for (const x of [r.title, ...r.items.map(i => i[1])]) if (!keys.has(x)) keys.set(x, 'changelog.js');
const D = require('../public/data.js');
for (const a of Object.values(D.ARENAS || {})) for (const x of [a.name, a.desc]) if (x && !keys.has(x)) keys.set(x, 'data.js (arenas)');
for (const m of Object.values(D.MISSION_BY_ID || {})) if (!keys.has(m.name)) keys.set(m.name, 'data.js (misiones)');
// El inglés es la referencia: además de los textos del código tiene los dinámicos (ligas, títulos,
// novedades, nombres de arenas…), y los demás idiomas tienen que traducir todo lo que tiene él
const en = loadDict('en.js');
for (const k of Object.keys(en)) if (!keys.has(k)) keys.set(k, 'en.js');
let bad = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'js', 'lang')).filter(f => f.endsWith('.js') && !f.startsWith('names-'))) {
  const lang = f.replace('.js', '');
  const dict = loadDict(f);
  const missing = [...keys.keys()].filter(k => dict[k] === undefined);
  const wrongVars = Object.entries(dict).filter(([k, v]) => vars(k) !== vars(v));
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} textos traducidos · ${Object.keys(dict).length} en el diccionario`);
  for (const k of missing) console.log(`  falta (${keys.get(k)}): ${JSON.stringify(k)}`);
  for (const [k] of wrongVars) console.log(`  variables distintas: ${JSON.stringify(k)}`);
  bad += missing.length + wrongVars.length;
}
if (strict && bad) process.exit(1);
