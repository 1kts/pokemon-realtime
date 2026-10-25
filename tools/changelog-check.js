// Comprueba que las notas de parche (public/changelog.js) siguen el formato de la skill
// .claude/skills/patch-notes: versiones en orden y sin repetir, la primera igual que package.json,
// fechas válidas, títulos cortos y puntos escritos para el jugador (nada de jerga interna).
//   node tools/changelog-check.js        (va en npm test)
const path = require('path');
const CHANGELOG = require('../public/changelog.js');
const pkg = require('../package.json');

// Las notas de antes de existir la skill no se revisan con las reglas de estilo (solo estructura)
const STYLE_FROM = '0.12.2';
const TAGS = ['nuevo', 'cambio', 'arreglo'];
// Cosas que interesan a quien programa, no a quien juega: no van en las notas
const JARGON = [
  [/\b(refactor\w*|commit|merge|deploy\w*|endpoint|backend|frontend|websocket|sqlite|node\.?js|npm|ci|api|json|csp|hook|worktree|test(s)?)\b/i, 'jerga técnica'],
  [/\b(base de datos|auditoría|panel de admin\w*|despliegue|caché del servidor)\b/i, 'cosas internas que el jugador no ve (no van en las notas)'],
  [/[\w-]+\.(js|json|css|html|md|db|sh)\b/i, 'nombres de archivo'],
  [/`|<\/?code>|TODO|WIP|FIXME/, 'código o marcas de trabajo'],
  [/\b(bug|issue|ticket)\b|#\d+/i, 'referencias a fallos o tickets (di qué se ha arreglado)'],
];

const semver = v => /^\d+\.\d+\.\d+$/.test(v);
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
const errors = [];
const err = (v, msg) => errors.push(`v${v}: ${msg}`);

if (!Array.isArray(CHANGELOG) || !CHANGELOG.length) errors.push('changelog.js no exporta una lista de versiones');
else if (CHANGELOG[0].v !== pkg.version) errors.push(`la primera versión (${CHANGELOG[0].v}) no es la de package.json (${pkg.version})`);

const seen = new Set();
CHANGELOG.forEach((r, i) => {
  const v = r.v;
  if (!semver(v)) return err(v, 'la versión tiene que ser X.Y.Z');
  if (seen.has(v)) err(v, 'versión repetida');
  seen.add(v);
  const prev = CHANGELOG[i - 1];
  if (prev && semver(prev.v) && cmp(prev.v, v) <= 0) err(v, `va después de v${prev.v}: las versiones van de la más nueva a la más antigua`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || isNaN(Date.parse(r.date))) err(v, `fecha "${r.date}" no es AAAA-MM-DD`);
  else if (prev && prev.date < r.date) err(v, 'fecha posterior a la de la versión más nueva');
  if (!Array.isArray(r.items) || !r.items.length) return err(v, 'sin puntos');
  for (const it of r.items) {
    if (!Array.isArray(it) || it.length !== 2 || !TAGS.includes(it[0]) || typeof it[1] !== 'string') err(v, `punto mal formado: ${JSON.stringify(it)} (tiene que ser ['nuevo'|'cambio'|'arreglo', 'texto'])`);
  }
  if (cmp(v, STYLE_FROM) < 0) return;
  // ---------- Estilo (desde que existe la skill) ----------
  const title = String(r.title || '');
  if (title.length < 3 || title.length > 40) err(v, `título de ${title.length} caracteres (entre 3 y 40)`);
  if (/[.:;]$/.test(title)) err(v, 'el título no termina en punto ni dos puntos');
  if (r.items.length > 6) err(v, `${r.items.length} puntos: como mucho 6 (junta los pequeños o deja fuera lo que no nota el jugador)`);
  // Las versiones con algo nuevo suben el número del medio
  const older = CHANGELOG[i + 1];
  if (older && semver(older.v)) {
    const [a, b] = [v.split('.').map(Number), older.v.split('.').map(Number)];
    const hasNew = r.items.some(it => it[0] === 'nuevo');
    if (hasNew && a[0] === b[0] && a[1] === b[1]) err(v, `trae algo nuevo: tiene que subir el número del medio (v${b[0]}.${b[1] + 1}.0), no solo el último`);
  }
  const order = r.items.map(it => TAGS.indexOf(it[0]));
  if (order.some((t, k) => k && t < order[k - 1])) err(v, 'los puntos van en orden: primero los nuevo, luego los cambio y al final los arreglo');
  for (const [tag, text] of r.items) {
    const s = String(text);
    if (s.length < 25 || s.length > 180) err(v, `punto de ${s.length} caracteres (entre 25 y 180): «${s.slice(0, 60)}…»`);
    if (!/[.!?…]$/.test(s)) err(v, `cada punto termina en punto: «${s.slice(-40)}»`);
    if (!/^[A-ZÁÉÍÓÚÑ¿¡0-9«"]/.test(s)) err(v, `cada punto empieza en mayúscula: «${s.slice(0, 40)}»`);
    for (const [re, why] of JARGON) if (re.test(s)) err(v, `${why}: «${s.slice(0, 90)}»`);
    if (tag === 'arreglo' && /^(arreglado|fix|corregido)\b/i.test(s)) err(v, `un arreglo cuenta qué funciona ahora, no "arreglado…": «${s.slice(0, 60)}»`);
  }
});

const rel = path.relative(process.cwd(), path.join(__dirname, '..', 'public', 'changelog.js'));
if (errors.length) {
  console.log(`✗ Notas de parche (${rel}) — ver .claude/skills/patch-notes/SKILL.md:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Notas de parche correctas (${CHANGELOG.length} versiones, la actual v${CHANGELOG[0].v})`);
