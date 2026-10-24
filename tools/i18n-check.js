// Comprueba las traducciones: busca en public/js los textos t('…') y lista, por idioma, los que
// aún no están traducidos y las traducciones cuyas variables {x} no coinciden con las del original.
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
let bad = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'js', 'lang')).filter(f => f.endsWith('.js'))) {
  const lang = f.replace('.js', '');
  // Los diccionarios son módulos ES: se evalúan quitando el export
  const src = fs.readFileSync(path.join(ROOT, 'js', 'lang', f), 'utf8').replace(/export default/, 'module.exports =');
  const mod = { exports: {} };
  new Function('module', src)(mod);
  const dict = mod.exports.text;
  const missing = [...keys.keys()].filter(k => dict[k] === undefined);
  const wrongVars = Object.entries(dict).filter(([k, v]) => vars(k) !== vars(v));
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} textos del código traducidos · ${Object.keys(dict).length} en el diccionario`);
  for (const k of missing) console.log(`  falta (${keys.get(k)}): ${JSON.stringify(k)}`);
  for (const [k] of wrongVars) console.log(`  variables distintas: ${JSON.stringify(k)}`);
  bad += missing.length + wrongVars.length;
}
if (strict && bad) process.exit(1);
