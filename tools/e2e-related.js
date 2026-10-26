// ¿Qué tests e2e tocan a lo que se va a subir? Lo usa el hook de pre-push para no pasar la tanda entera
// (el CI la pasa completa en cada push a develop y main).
//   node tools/e2e-related.js <commit base> <commit nuevo>     imprime las rutas, una por línea
// Elige: los e2e nuevos o cambiados; los que mencionan algo del archivo tocado (su nombre o su alias de
// ALIAS: missions.js → «misiones», treasure.js → «tesoros»…); y portada.e2e.js siempre, como prueba de
// humo. Si se toca algo que usa todo el juego (CORE), los de interfaz general de SMOKE.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'tests', 'e2e');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

// Nombre del archivo → palabras que salen en sus tests (nombres de pantallas, clases, textos)
const ALIAS = {
  missions: ['misiones', 'mission', 'loot'], treasure: ['tesoros', 'tz-'], collection: ['maestria', 'maestría', 'coll-'],
  story: ['mapa', 'region'], regionmap: ['mapa'], touch: ['movil'], world: ['camara', 'cámara', 'fondo'], effects: ['proyectil'],
  particles: ['proyectil'], music: ['musica', 'música'], sound: ['sonido'], legalbar: ['barra-legal', 'legal'],
  account: ['portada', 'perfil', 'profile'], achievements: ['logro', 'ach-'], frames: ['glow', 'marco'], skinfx: ['glow', 'skin'],
  tower: ['torre', 'tower'], pokedex: ['dex'], bag: ['mochila', 'bag'], rewards: ['misiones', 'tesoros', 'maestria'],
  battle: ['combate', 'battle'], tutorial: ['tutorial'], daily: ['diario', 'daily'], admin: ['admin'],
};
// Archivos que usa todo el juego: con ellos van también los tests de interfaz general
const CORE = /^(public\/(index\.html|style\.css|cards\.css|data\.js|shared\.js)|public\/js\/(ui|main|net|i18n|sprites|pixicons)\.js|server\/index\.js|server\.js)$/;
const SMOKE = ['portada', 'tarjetas', 'mis-pokemon', 'misiones'];
const IGNORE = /^public\/(changelog\.js|js\/lang\/)|\.(png|gif|svg|webp|mp3|ogg|woff2?)$/;

const [base, head] = process.argv.slice(2);
if (!head) { console.error('Uso: node tools/e2e-related.js <base> <nuevo>'); process.exit(2); }
const files = git('diff', '--name-only', `${base}..${head}`).split('\n').filter(Boolean);
const tests = fs.readdirSync(DIR).filter(f => f.endsWith('.e2e.js'));
const src = Object.fromEntries(tests.map(f => [f, (f + '\n' + fs.readFileSync(path.join(DIR, f), 'utf8')).toLowerCase()]));
const pick = new Set(['portada.e2e.js']);

for (const f of files) {
  if (/^tests\/e2e\/.+\.e2e\.js$/.test(f) && fs.existsSync(path.join(ROOT, f))) pick.add(path.basename(f));
  if (CORE.test(f)) { SMOKE.forEach(s => tests.includes(s + '.e2e.js') && pick.add(s + '.e2e.js')); continue; }
  // Notas de parche y diccionarios: los lee todo test (CHANGELOG, textos) y no cambian cómo se juega
  if (!/^(public|server)\//.test(f) || IGNORE.test(f)) continue;
  const stem = path.basename(f).replace(/\.[^.]+$/, '').toLowerCase();
  const words = [...(stem.length > 3 ? [stem] : []), ...(ALIAS[stem] || [])];
  for (const t of tests) if (words.some(w => src[t].includes(w))) pick.add(t);
}
console.log([...pick].sort().map(t => path.join('tests', 'e2e', t)).join('\n'));
