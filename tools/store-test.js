// Prueba de la base de datos de perfiles (SQLite): importar el antiguo profiles.json, guardar
// solo lo que cambia, soltar perfiles y que todo siga ahí al reiniciar el servidor.
// Cada "arranque" es un proceso nuevo con la misma DB_FILE.
//   node tools/store-test.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-store-'));
const DB = path.join(tmp, 'arena.db');
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

// Ejecuta código con el store cargado en un proceso aparte y devuelve lo que imprima como JSON
function run(code) {
  const src = `const store = require(${JSON.stringify(path.join(__dirname, '..', 'server', 'store.js'))});
    (async () => { const out = await (async () => { ${code} })(); store.flush(); console.log(JSON.stringify(out ?? null)); })();`;
  const out = execFileSync(process.execPath, ['--no-warnings', '-e', src], { env: { ...process.env, DB_FILE: DB }, encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop());
}

// ---------- Importar profiles.json ----------
fs.writeFileSync(path.join(tmp, 'profiles.json'), JSON.stringify({
  aaa: { token: 'aaa', id: 'id1', name: 'Viejo', coins: 123, elo: 1100, ranked: 3, wins: 2, losses: 1, mons: [], caught: [] },
  bbb: { token: 'bbb', name: 'SinId', coins: 5, elo: 1000, ranked: 0, mons: [], caught: [] },
}));
let r = run(`const a = store.get('aaa'), b = store.get('bbb'); return { a: a.coins, id: a.id, bid: b.id, rank: store.rankOf(a) };`);
ok(r.a === 123 && r.id === 'id1', 'importa los perfiles del antiguo profiles.json');
ok(typeof r.bid === 'string' && r.bid.length === 10, 'da id público a los perfiles que no lo tenían');
ok(r.rank === 1, 'el ranking cuenta los perfiles importados');
const jsonBefore = fs.readFileSync(path.join(tmp, 'profiles.json'), 'utf8');
ok(jsonBefore.includes('"Viejo"') && !fs.existsSync(path.join(tmp, 'profiles.json.importado')), 'el JSON importado no se toca');
run(`store.get('aaa').coins = 321; store.save(); return null;`);
r = run(`return store.get('aaa').coins;`);
ok(r === 321, 'con datos en la base de datos no se vuelve a importar el JSON');
let threw = '';
try { execFileSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(__dirname, '..', 'server', 'store.js'))})`], { env: { ...process.env, DB_FILE: '', PROFILES_FILE: path.join(tmp, 'x.json') }, encoding: 'utf8', stdio: 'pipe' }); }
catch (e) { threw = String(e.stderr); }
ok(/PROFILES_FILE ya no se usa/.test(threw), 'con la variable antigua PROFILES_FILE se niega a arrancar (no usa data/ real)');

// ---------- Guardar y reiniciar ----------
r = run(`const a = store.get('aaa'); a.coins = 999; store.save(); return null;`);
r = run(`const p = store.get('aaa'); const b = store.get('bbb'); return { coins: p.coins, bid: b.id };`);
ok(r.coins === 999, 'un cambio guardado sigue ahí al reiniciar');
r = run(`const p = store.get(null, 'Nuevo'); p.coins = 42; store.save(); return p.token;`);
const newTok = r;
r = run(`return store.get(${JSON.stringify(newTok)}).coins;`);
ok(r === 42, 'un perfil nuevo se guarda');

// ---------- Soltar un perfil lo guarda en el acto ----------
r = run(`const p = store.get('aaa'); p.coins = 7; store.release(p);
  // Ya no se vigila: lo que cambie después sin volver a pedirlo no se escribe
  p.coins = 8; store.save(); return null;`);
r = run(`return store.get('aaa').coins;`);
ok(r === 7, 'release() guarda el perfil al desconectarse y deja de vigilarlo');

// Dos conexiones con el mismo perfil: soltar una no deja de vigilarlo
r = run(`const p = store.get('aaa'); store.get('aaa'); store.release(p); p.coins = 55; store.save(); return null;`);
r = run(`return store.get('aaa').coins;`);
ok(r === 55, 'con dos conexiones, soltar una sigue guardando la otra');

// ---------- Cuentas ----------
r = run(`const p = store.get('bbb'); const x = await store.register(p, 'Azul', 'secreto1'); return !!x.p;`);
r = run(`const p = await store.login('azul', 'secreto1'); const bad = await store.login('azul', 'otra'); return { tok: p && p.token, bad };`);
ok(r.tok === 'bbb' && r.bad === null, 'la cuenta y su contraseña siguen valiendo al reiniciar');

// ---------- Solo se reescribe lo que cambia ----------
r = run(`const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(process.env.DB_FILE);
  const before = db.prepare('SELECT token, updated FROM profiles').all();
  const a = store.get('aaa'); store.get('bbb'); a.coins = 1; store.flush(); store.save(); store.flush();
  await new Promise(r => setTimeout(r, 1100));
  const after = db.prepare('SELECT token, updated FROM profiles').all();
  const t = (l, k) => l.find(x => x.token === k).updated;
  return { a: t(after, 'aaa') > t(before, 'aaa'), b: t(after, 'bbb') === t(before, 'bbb') };`);
ok(r.a && r.b, 'solo se reescribe el perfil que ha cambiado');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
process.exit(failures ? 1 : 0);
