// Prueba de los límites contra abusos y de las cabeceras de seguridad. Cada caso usa su propia IP
// (cabecera X-Forwarded-For, que el servidor solo cree en conexiones desde la propia máquina,
// como las de Caddy) para que los topes de uno no afecten al siguiente.
//   node tools/security-test.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-sec-'));
process.env.DB_FILE = path.join(tmp, 'arena.db');
const { start } = require('../server/index.js');
const limits = require('../server/limits.js');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let port;
// Conexión desde una IP inventada; guarda todos los mensajes y si la han cerrado
function connect(ip) {
  const ws = new WebSocket(`ws://localhost:${port}`, { headers: { 'X-Forwarded-For': ip } });
  const c = { ws, msgs: [], closed: false };
  ws.on('message', raw => c.msgs.push(JSON.parse(raw)));
  ws.on('close', () => { c.closed = true; });
  ws.on('error', () => {});
  c.open = new Promise(r => { ws.on('open', r); ws.on('close', r); });
  c.send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  c.wait = (pred, ms = 3000) => new Promise(resolve => {
    const t0 = Date.now();
    (function poll() { const m = c.msgs.find(pred); if (m || Date.now() - t0 > ms) return resolve(m); setTimeout(poll, 20); })();
  });
  return c;
}
const get = url => new Promise(r => http.get(`http://localhost:${port}${url}`, res => { let d = ''; res.on('data', x => { d += x; }); res.on('end', () => r({ h: res.headers, body: d })); }));

(async () => {
  const server = await start(0);
  port = server.address().port;

  // ---------- IP del cliente ----------
  const req = (addr, xff) => ({ socket: { remoteAddress: addr }, headers: xff ? { 'x-forwarded-for': xff } : {} });
  ok(limits.clientIp(req('127.0.0.1', '1.2.3.4')) === '1.2.3.4', 'detrás de Caddy (desde 127.0.0.1) usa la IP de X-Forwarded-For');
  ok(limits.clientIp(req('::ffff:127.0.0.1', '9.9.9.9, 5.6.7.8')) === '5.6.7.8', 'con varias IPs usa la última (la que pone Caddy)');
  ok(limits.clientIp(req('203.0.113.7', '1.2.3.4')) === '203.0.113.7', 'una conexión de fuera no puede inventarse la IP con X-Forwarded-For');

  // ---------- Cabeceras ----------
  const page = await get('/');
  const importmap = page.body.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  const hash = `'sha256-${crypto.createHash('sha256').update(importmap).digest('base64')}'`;
  const cspHeader = page.h['content-security-policy'] || '';
  ok(cspHeader.includes(hash), 'la CSP permite el importmap de la página por su hash');
  const scriptSrc = cspHeader.split('script-src')[1].split(';')[0];
  ok(scriptSrc.trim().startsWith("'self' 'sha256-") && !/unsafe-inline|https?:/.test(scriptSrc) && /font-src 'self'/.test(cspHeader),
    'la CSP solo deja scripts y fuentes de este servidor (ni en línea ajenos ni de terceros)');
  ok(/frame-ancestors 'none'/.test(cspHeader) && page.h['x-frame-options'] === 'DENY', 'no se puede meter el juego en un iframe de otra web');
  const js = await get('/js/main.js');
  ok(js.h['x-content-type-options'] === 'nosniff' && !js.h['content-security-policy'], 'nosniff en todo; la CSP solo en las páginas');

  // ---------- Páginas legales ----------
  for (const [url, lang] of [['/legal', 'es'], ['/legal/en', 'en']]) {
    const lp = await get(url);
    ok(/contact@pokearenas\.com/.test(lp.body) && lp.body.includes(`lang="${lang}"`) && /CC BY-NC 4\.0/.test(lp.body) && /<tr><td>CHUNSOFT<\/td>/.test(lp.body)
      && /default-src 'self'/.test(lp.h['content-security-policy'] || ''), `${url}: aviso legal, privacidad y artistas, con CSP`);
  }
  ok(!/(src|href)="https?:\/\/(?!creativecommons|github|polyform|pokeapi|threejs|ko-fi|www\.aepd|[a-z0-9-]+\.itch\.io|opengameart\.org)/.test((await get('/legal')).body + (await get('/')).body),
    'ni el juego ni la página legal cargan nada de terceros (solo enlaces)');

  // ---------- Inundar de mensajes ----------
  const flood = connect('10.0.0.1');
  await flood.open;
  for (let i = 0; i < 2000; i++) flood.send({ t: 'ping', ts: i });
  await sleep(500);
  const pongs = flood.msgs.filter(m => m.t === 'pong').length;
  ok(pongs <= 50, `de 2000 mensajes de golpe solo se atienden ${pongs}`);
  ok(flood.closed, 'quien insiste en inundar pierde la conexión');
  const calm = connect('10.0.0.1');
  await calm.open;
  calm.send({ t: 'ping', ts: 1 });
  ok(!!(await calm.wait(m => m.t === 'pong')), 'después puede volver a conectarse y jugar normal');
  calm.ws.close();

  // Un jugador normal no pierde entradas: 30 por segundo durante 2 s, más una ráfaga al volver a la pestaña
  const l = limits.forConn('10.0.0.2');
  let dropped = 0;
  for (let i = 0; i < 8; i++) if (!limits.allow(l, 'in').ok) dropped++;
  for (let s = 0; s < 60; s++) { if (!limits.allow(l, 'in').ok) dropped++; await sleep(33); }
  ok(dropped === 0, 'un jugador normal (30 entradas/s y ráfagas) no pierde ninguna');

  // Consultas caras (ladder): tope por IP aunque se repartan en varias conexiones
  const lad = [connect('10.0.0.3'), connect('10.0.0.3'), connect('10.0.0.3')];
  await Promise.all(lad.map(c => c.open));
  for (const c of lad) { c.send({ t: 'hello', name: 'L' }); }
  await sleep(200);
  for (let i = 0; i < 30; i++) for (const c of lad) c.send({ t: 'ladder', board: 'ranked' });
  await sleep(500);
  const ladders = lad.reduce((n, c) => n + c.msgs.filter(m => m.t === 'ladder').length, 0);
  ok(ladders <= 35, `90 consultas de ladder desde una IP en 3 conexiones: se atienden ${ladders}`);
  lad.forEach(c => c.ws.close());

  // ---------- Conexiones por IP ----------
  const many = [];
  for (let i = 0; i < limits.LIMITS.conns + 1; i++) { many.push(connect('10.0.0.4')); await many[i].open; }
  const last = many[many.length - 1];
  await sleep(100);
  ok(many.slice(0, -1).every(c => !c.closed), `${limits.LIMITS.conns} conexiones desde una IP se aceptan`);
  ok(last.closed && last.msgs.some(m => m.t === 'error' && /conexiones/.test(m.msg)), 'la siguiente se rechaza con aviso');
  many.forEach(c => c.ws.close());

  // ---------- Perfiles nuevos por IP ----------
  let made = 0, refused = false;
  for (let i = 0; i < limits.LIMITS.newProfiles + 1; i++) {
    const c = connect('10.0.0.5');
    await c.open;
    c.send({ t: 'hello', name: 'Spam' + i });
    const m = await c.wait(x => x.t === 'profile' || x.t === 'error');
    if (m && m.t === 'profile') made++;
    else if (m && /perfiles nuevos/.test(m.msg)) refused = true;
    c.ws.close();
  }
  ok(made === limits.LIMITS.newProfiles && refused, `${made} perfiles nuevos por hora desde una IP; el siguiente se rechaza`);
  const back = connect('10.0.0.5');
  await back.open;
  const someToken = (await (async () => { const c = connect('10.0.0.6'); await c.open; c.send({ t: 'hello', name: 'Vuelvo' }); const m = await c.wait(x => x.t === 'profile'); c.ws.close(); return m.p.token; })());
  back.send({ t: 'hello', token: someToken });
  ok(!!(await back.wait(x => x.t === 'profile')), 'quien ya tiene perfil puede entrar aunque su IP haya llegado al tope');
  back.ws.close();

  // ---------- Contraseñas ----------
  const owner = connect('10.0.1.1');
  await owner.open;
  owner.send({ t: 'register', user: 'victima', pass: 'secreta123' });
  await owner.wait(m => m.t === 'authok');
  owner.ws.close();
  // Fuerza bruta contra una cuenta repartida entre muchas IPs: la cuenta se bloquea un rato
  let locked = false;
  for (let i = 0; i < limits.LIMITS.failsPerUser + 1; i++) {
    const c = connect(`10.0.2.${i + 1}`);
    await c.open;
    c.send({ t: 'login', user: 'victima', pass: 'mala' + i });
    const m = await c.wait(x => x.t === 'autherr');
    if (m && /esta cuenta/.test(m.msg)) locked = true;
    c.ws.close();
  }
  ok(locked, `tras ${limits.LIMITS.failsPerUser} fallos desde IPs distintas la cuenta se bloquea`);
  const right = connect('10.0.2.200');
  await right.open;
  right.send({ t: 'login', user: 'victima', pass: 'secreta123' });
  const rm = await right.wait(x => x.t === 'autherr' || x.t === 'authok');
  ok(rm && rm.t === 'autherr' && /esta cuenta/.test(rm.msg), 'mientras dura el bloqueo ni la contraseña buena entra');
  right.ws.close();
  // Muchas cuentas desde una IP abriendo conexiones nuevas (el tope por conexión no basta)
  let ipBlocked = false;
  for (let i = 0; i < limits.LIMITS.authPerIp / 5 + 2 && !ipBlocked; i++) {
    const c = connect('10.0.3.1');
    await c.open;
    for (let k = 0; k < 5; k++) c.send({ t: 'login', user: `otra${i}_${k}`, pass: 'xxxxxx' });
    await sleep(150);
    if (c.msgs.some(m => /desde tu red/.test(m.msg || ''))) ipBlocked = true;
    c.ws.close();
  }
  ok(ipBlocked, `más de ${limits.LIMITS.authPerIp} intentos desde una IP, aunque sea con conexiones nuevas, se cortan`);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
