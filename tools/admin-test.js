// Prueba del panel de administración: alta por consola, entrada con contraseña + 2FA (y lo que no
// debe dejar entrar), resumen, búsqueda, ficha, suspender/levantar, desconectar, renombrar,
// resetear contraseña, anuncios, mantenimiento, auditoría y su limpieza a los 40 días.
//   node tools/admin-test.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const WebSocket = require('ws');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-admin-'));
process.env.DB_FILE = path.join(tmp, 'arena.db');
const { start } = require('../server/index.js');
const totp = require('../server/totp.js');
const audit = require('../server/audit.js');
const store = require('../server/store.js');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let port, ipN = 0;
// Cada conexión con su IP inventada, para que los límites de una no afecten a las demás
function connect() {
  const ws = new WebSocket(`ws://localhost:${port}`, { headers: { 'X-Forwarded-For': `10.9.${(ipN >> 8) & 255}.${++ipN & 255}` } });
  const c = { ws, msgs: [], closed: false, rid: 0 };
  ws.on('message', raw => c.msgs.push(JSON.parse(raw)));
  ws.on('close', () => { c.closed = true; });
  ws.on('error', () => {});
  c.open = new Promise(r => { ws.on('open', r); ws.on('close', r); });
  c.send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  c.wait = (pred, ms = 3000) => new Promise(resolve => {
    const t0 = Date.now();
    (function poll() { const i = c.msgs.findIndex(pred); if (i >= 0) return resolve(c.msgs.splice(i, 1)[0]); if (Date.now() - t0 > ms) return resolve(null); setTimeout(poll, 15); })();
  });
  c.ask = (t, data = {}) => { const rid = ++c.rid; c.send({ t, rid, ...data }); return c.wait(m => m.rid === rid || m.t === 'admin.out'); };
  return c;
}
async function player(name, user, pass) {
  const c = connect();
  await c.open;
  if (user) { c.send({ t: 'register', user, pass }); await c.wait(m => m.t === 'authok'); }
  else c.send({ t: 'hello', name });
  const m = await c.wait(x => x.t === 'profile');
  c.p = m && m.p;
  return c;
}
// Código válido para el siguiente intervalo de 30 s (cada código solo vale una vez)
let lastCounter = 0;
const freshCode = secret => { const now = Date.now(); let k = Math.floor(now / totp.STEP); if (k <= lastCounter) k = lastCounter + 1; lastCounter = k; return totp.code(secret, k); };

(async () => {
  const server = await start(0);
  port = server.address().port;

  // ---------- Alta por consola ----------
  const boss = await player(null, 'jefa', 'clave-larga-1');
  store.flush();   // el servidor guarda cada segundo; la consola lee de la base de datos
  const env = { ...process.env, DB_FILE: process.env.DB_FILE };
  const cli = (...a) => { try { return execFileSync(process.execPath, [path.join(__dirname, 'admin.js'), ...a], { env, encoding: 'utf8', stdio: 'pipe' }); } catch (e) { return 'ERROR ' + e.stderr; } };
  ok(/No hay ninguna cuenta/.test(cli('alta', 'nadie')), 'la consola no da de alta un usuario que no existe');
  const out = cli('alta', 'jefa', 'yo misma');
  const secret = (out.match(/Clave: ([A-Z2-7 ]+) ·/) || [])[1]?.replace(/ /g, '');
  ok(secret && secret.length === 32, 'la consola da de alta al admin y enseña la clave para la app');
  ok(/jefa/.test(cli('lista')), 'la consola lista los admins');

  // ---------- Entrar ----------
  const adm = connect();
  await adm.open;
  ok((await adm.ask('admin.overview')).t === 'admin.out', 'sin iniciar sesión el panel no da datos');
  const nowCode = () => totp.code(secret, Math.floor(Date.now() / totp.STEP));   // para los intentos que deben fallar
  adm.send({ t: 'admin.login', user: 'jefa', pass: 'mala', code: nowCode() });
  ok(!!(await adm.wait(m => m.t === 'admin.err')), 'contraseña mala: no entra');
  adm.send({ t: 'admin.login', user: 'jefa', pass: 'clave-larga-1', code: '000000' });
  ok(!!(await adm.wait(m => m.t === 'admin.err')), 'código 2FA malo: no entra');
  const normal = await player(null, 'normalito', 'clave-larga-2');
  adm.send({ t: 'admin.login', user: 'normalito', pass: 'clave-larga-2', code: nowCode() });
  ok(!!(await adm.wait(m => m.t === 'admin.err')), 'una cuenta que no es admin no entra aunque tenga contraseña buena');
  const code = freshCode(secret);
  adm.send({ t: 'admin.login', user: 'jefa', pass: 'clave-larga-1', code });
  ok(!!(await adm.wait(m => m.t === 'admin.ok')), 'contraseña + código 2FA buenos: entra');
  const again = connect();
  await again.open;
  again.send({ t: 'admin.login', user: 'jefa', pass: 'clave-larga-1', code });
  ok(!!(await again.wait(m => m.t === 'admin.err')), 'el mismo código 2FA no vale dos veces');
  ok(audit.query({ type: 'admin.login.fallo' }).length >= 4 && audit.query({ type: 'admin.login', limit: 50 }).some(r => r.type === 'admin.login'),
    'los intentos buenos y malos quedan en la auditoría');

  // ---------- Resumen, búsqueda y ficha ----------
  const victim = await player('Gamberro');
  const o = await adm.ask('admin.overview');
  ok(o.online >= 3 && o.store.profiles >= 3 && o.server.rss > 0 && Array.isArray(o.events24h), 'el resumen da conectados, perfiles, memoria y eventos');
  ok(o.onlineList.some(x => x.name === 'Gamberro' && x.ip), 'el resumen lista quién está conectado y desde qué IP');
  const s = await adm.ask('admin.search', { q: 'gamber' });
  ok(s.rows.length === 1 && s.rows[0].id === victim.p.id && s.rows[0].online, 'buscar por nombre encuentra al jugador');
  const det = await adm.ask('admin.player', { id: victim.p.id });
  ok(det.player.profile.name === 'Gamberro' && !det.player.profile.token && det.player.ips.length === 1 && det.player.events.some(e => e.type === 'perfil.nuevo'),
    'la ficha tiene sus IPs e historial, sin el token');
  const bossDet = await adm.ask('admin.player', { id: boss.p.id });
  ok(bossDet.player.profile.account.user === 'jefa' && !bossDet.player.profile.account.hash && bossDet.player.admin, 'la ficha no enseña el hash de la contraseña');

  // ---------- Moderación ----------
  const r1 = await adm.ask('admin.action', { a: 'rename', id: victim.p.id, name: 'Nombre limpio' });
  const renamed = await victim.wait(m => m.t === 'profile');
  ok(r1.ok && renamed && renamed.p.name === 'Nombre limpio', 'renombrar cambia el nombre y el jugador lo ve al momento');
  const r2 = await adm.ask('admin.action', { a: 'ban', id: victim.p.id, reason: 'Trampas', hours: 24 });
  const bannedMsg = await victim.wait(m => m.t === 'banned');
  await sleep(100);
  ok(r2.ok && bannedMsg && bannedMsg.reason === 'Trampas' && victim.closed, 'suspender le avisa con el motivo y lo desconecta');
  const back = connect();
  await back.open;
  back.send({ t: 'hello', token: victim.p.token });
  ok(!!(await back.wait(m => m.t === 'banned')), 'un suspendido no puede volver a entrar');
  ok(!(await adm.ask('admin.action', { a: 'ban', id: boss.p.id, reason: 'x', hours: 1 })).ok.includes('suspendido'), 'no se puede suspender a un admin');
  await adm.ask('admin.action', { a: 'unban', id: victim.p.id });
  const back2 = connect();
  await back2.open;
  back2.send({ t: 'hello', token: victim.p.token });
  ok(!!(await back2.wait(m => m.t === 'profile')), 'al levantar la suspensión puede volver');
  const r3 = await adm.ask('admin.action', { a: 'kick', id: victim.p.id, reason: 'Fuera' });
  await sleep(150);
  ok(/desconectado/.test(r3.ok) && back2.closed, 'desconectar cierra su conexión');
  const r4 = await adm.ask('admin.action', { a: 'resetpass', id: normal.p.id });
  ok(r4.secret && r4.secret.length >= 10, 'resetear contraseña da una nueva (solo al admin)');
  ok(await store.check('normalito', r4.secret) && !await store.check('normalito', 'clave-larga-2'), 'la contraseña nueva vale y la vieja ya no');
  ok(!JSON.stringify(audit.query({ type: 'admin.resetpass' })).includes(r4.secret), 'la contraseña nueva no queda en la auditoría');

  // ---------- Servidor ----------
  const r5 = await adm.ask('admin.broadcast', { msg: 'Reinicio en 5 minutos' });
  const ann = await normal.wait(m => m.t === 'announce');
  ok(/Enviado/.test(r5.ok) && ann && ann.msg === 'Reinicio en 5 minutos', 'el anuncio llega a los conectados');
  await adm.ask('admin.maintenance', { on: true });
  normal.msgs.length = 0;
  normal.send({ t: 'practice', dexes: [require('../public/data.js').RANKED_POOL[0]] });
  ok(!!(await normal.wait(m => m.t === 'error' && /mantenimiento/.test(m.msg))), 'con mantenimiento no se empiezan combates');
  await adm.ask('admin.maintenance', { on: false });
  normal.send({ t: 'practice', dexes: [require('../public/data.js').RANKED_POOL[0]] });
  ok(!!(await normal.wait(m => m.t === 'start')), 'sin mantenimiento se vuelve a poder');
  normal.send({ t: 'forfeit' });

  // ---------- Auditoría ----------
  const a1 = await adm.ask('admin.audit', { type: 'admin.' });
  ok(a1.rows.length >= 6 && a1.rows.every(r => r.type.startsWith('admin.')), 'filtrar la auditoría por tipo');
  const a2 = await adm.ask('admin.audit', { who: victim.p.id });
  ok(a2.rows.some(r => r.type === 'admin.ban' && r.data.reason === 'Trampas' && r.actorName === 'jefa'), 'filtrar por jugador, con el nombre de quién lo hizo');
  const a3 = await adm.ask('admin.audit', { limit: 2 });
  const a4 = await adm.ask('admin.audit', { limit: 2, before: a3.rows[1].id });
  ok(a3.more && a4.rows.length === 2 && a4.rows[0].id < a3.rows[1].id, 'paginar hacia atrás');
  const old = Date.now() - audit.KEEP_MS - 864e5;
  store.db.prepare("INSERT INTO audit (at, type, actor) VALUES (?, 'sesion', 'x'), (?, 'admin.ban', 'x')").run(old, old);
  const removed = audit.prune();
  ok(removed >= 1 && store.db.prepare("SELECT COUNT(*) n FROM audit WHERE at = ? AND type = 'admin.ban'").get(old).n === 1, 'a los 40 días se borra todo menos las acciones de admin');

  // ---------- Bajas y sesión ----------
  cli('baja', 'jefa');
  ok((await adm.ask('admin.overview')).t === 'admin.out', 'quitarle el admin desde la consola corta su sesión al momento');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
