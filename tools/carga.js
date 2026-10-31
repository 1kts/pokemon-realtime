// Prueba de carga: clientes WebSocket de verdad que entran, miran menús y juegan contra la IA, por escalones.
//   node tools/carga.js                                 10, 50, 100, 200 y 500 clientes, 30 s cada escalón
//   node tools/carga.js --escalones 10,50 --dur 15      otros escalones y otra duración
//   node tools/carga.js --mons 60                       perfiles más grandes (Pokémon de cada cliente)
//   node tools/carga.js --hasta-el-final                no para aunque el juego ya no dé abasto
//   node tools/carga.js --url ws://127.0.0.1:3000       contra un servidor local ya arrancado (solo lo que ve el cliente)
//   node tools/carga.js --json salida.json              guarda los números
//   node tools/carga.js --url wss://pokearenas.com --confirmo-produccion --escalones 10,20
//                                                       contra producción: solo con esa confirmación y sin ganchos de desarrollo
// Por defecto arranca su propio servidor con una base de datos temporal y ARENA_DEV (nunca data/), y lo mide por
// dentro: event loop, ticks de combate, CPU, memoria, SQLite, JSON de perfiles y recolector de basura.
// En local, cada cliente manda su propia X-Forwarded-For (limits.clientIp la cree si la conexión es de la propia
// máquina), así los topes por IP no falsean nada y no hace falta tocarlos.
// En remoto no hay sonda ni ganchos: solo mide lo que ve el cliente. Caddy sustituye la X-Forwarded-For, así que todos
// los clientes cuentan como una IP y se aplican los topes de server/limits.js (20 conexiones a la vez, 30 perfiles
// nuevos por hora): si salta uno, la prueba para y lo dice. Los tokens de invitado se guardan en el tmp para repetir
// sin crear más perfiles. Aborta si el servidor deja de responder o se disparan los errores o el ping.

// ---------- La sonda: se carga dentro del servidor con -r ----------
if (process.env.CARGA_SONDA) {
  const { monitorEventLoopDelay, createHistogram, PerformanceObserver } = require('perf_hooks');
  const sqlite = require('node:sqlite');
  const us = () => Number(process.hrtime.bigint() / 1000n);
  const sano = v => Math.max(1, Math.round(v));
  let loop, gaps, ticks, sql, gc, json, t0, cpu0, nTicks, nSql, nJson, sqlMax, jsonMax, jsonBytes, gcMax, gcMs;
  const reset = () => {
    if (loop) loop.disable();
    loop = monitorEventLoopDelay({ resolution: 5 }); loop.enable();
    gaps = createHistogram(); ticks = createHistogram(); sql = createHistogram(); gc = createHistogram(); json = createHistogram();
    t0 = Date.now(); cpu0 = process.cpuUsage(); nTicks = nSql = nJson = sqlMax = jsonMax = jsonBytes = gcMax = gcMs = 0;
  };
  reset();

  // Cuánto tarda cada tick y cada cuánto llega, combate a combate
  const { Battle } = require('../server/battle.js');
  const tick = Battle.prototype.tick;
  Battle.prototype.tick = function () {
    const a = us();
    if (this.cargaT) gaps.record(sano(a - this.cargaT));
    this.cargaT = a;
    tick.call(this);
    ticks.record(sano(us() - a));
    nTicks++;
  };
  // SQLite (síncrono: bloquea el bucle)
  const timed = (proto, name) => {
    const fn = proto[name];
    proto[name] = function (...args) {
      const a = us();
      try { return fn.apply(this, args); } finally { const d = us() - a; sql.record(sano(d)); nSql++; if (d > sqlMax) sqlMax = d; }
    };
  };
  timed(sqlite.StatementSync.prototype, 'run');
  timed(sqlite.DatabaseSync.prototype, 'exec');
  // JSON grandes (los perfiles): los snapshots de combate son pequeños y no cuentan
  const stringify = JSON.stringify;
  JSON.stringify = function (...args) {
    const a = us(), s = stringify.apply(this, args);
    if (s && s.length > 4096) { const d = us() - a; json.record(sano(d)); nJson++; jsonBytes += s.length; if (d > jsonMax) jsonMax = d; }
    return s;
  };
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) { gc.record(sano(e.duration * 1000)); gcMs += e.duration; if (e.duration > gcMax) gcMax = e.duration; }
  }).observe({ entryTypes: ['gc'] });

  const ms = h => ({ p50: h.percentile(50) / 1000, p95: h.percentile(95) / 1000, p99: h.percentile(99) / 1000, max: h.max / 1000 });
  process.on('message', m => {
    if (m === 'reset') return reset();
    if (m !== 'leer') return;
    const secs = (Date.now() - t0) / 1000, c = process.cpuUsage(cpu0), mem = process.memoryUsage();
    process.send({
      secs, loop: { p50: loop.percentile(50) / 1e6, p95: loop.percentile(95) / 1e6, p99: loop.percentile(99) / 1e6, max: loop.max / 1e6 }, gap: gaps.count ? ms(gaps) : null, tick: ticks.count ? ms(ticks) : null, ticksPerSec: nTicks / secs,
      cpu: (c.user + c.system) / 1e6 / secs, rss: mem.rss, heap: mem.heapUsed,
      sql: nSql ? { ...ms(sql), n: nSql, maxMs: sqlMax / 1000 } : null,
      json: nJson ? { ...ms(json), n: nJson, mb: jsonBytes / 1e6, maxMs: jsonMax / 1000 } : null,
      gc: gc.count ? { n: gc.count, totalMs: gcMs, maxMs: gcMax } : null,
    });
  });
  return;
}

// ---------- El generador ----------
const { fork } = require('child_process');
const { createHistogram, monitorEventLoopDelay } = require('perf_hooks');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const D = require('../public/data.js');

function localUrl(url) {
  let h;
  try { h = new URL(url).hostname.replace(/^\[|\]$/g, ''); } catch { return false; }
  return ['localhost', '127.0.0.1', '::1'].includes(h);
}
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i < 0 ? dflt : process.argv[i + 1]; };
const flag = name => process.argv.includes('--' + name);
const given = arg('url', null);
const REMOTE = !!given && !localUrl(given);
const STEPS = String(arg('escalones', REMOTE ? '10,25,50,100' : '10,50,100,200,500')).split(',').map(Number).filter(n => n > 0);
const DUR = +arg('dur', 30), MONS = +arg('mons', 30), SETTLE = 5, PORT = +arg('port', 3977);
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (REMOTE && !flag('confirmo-produccion')) {
  console.error(`No: ${given} no es de esta máquina. Contra un servidor remoto hace falta --confirmo-produccion.`);
  process.exit(2);
}
const HEALTH = (given || `http://127.0.0.1:${PORT}`).replace(/^ws/, 'http').replace(/\/$/, '') + '/healthz';
const TOKENS = path.join(os.tmpdir(), 'arena-carga-tokens.json');   // (fuera de data/: solo para no crear más invitados al repetir)
const tokens = REMOTE && fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, 'utf8')) : {};
const SAVE_MS = 10000;   // cada cuánto un cliente local cambia su perfil, como un premio al acabar un combate
let abort = null;        // por qué se para la prueba (remota)
const URL_WS = given || `ws://127.0.0.1:${PORT}`;

// ---------- Servidor propio ----------
let server = null, tmp = null;
async function startServer() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-carga-'));
  const root = path.join(__dirname, '..');
  server = fork(path.join(root, 'server.js'), {
    cwd: root, execArgv: ['-r', __filename], stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    env: { ...process.env, CARGA_SONDA: '1', NODE_ENV: 'development', ARENA_DEV: '1', ARENA_NPCS: '0', HOST: '127.0.0.1', PORT: String(PORT), DB_FILE: path.join(tmp, 'carga.db') },
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) return; } catch { /* aún no escucha */ }
    await sleep(100);
  }
  throw new Error('El servidor no arranca');
}
function stopServer() {
  if (server) server.kill('SIGKILL');
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  server = tmp = null;
}
const probe = () => new Promise(res => { server.once('message', res); server.send('leer'); });

// ---------- Clientes ----------
const clients = [];
let snapGap = createHistogram(), rtt = createHistogram(), snaps = 0, drops = 0, errors = 0;
const SNAP = Buffer.from('{"t":"snap"');   // comparar bytes: parsear 15.000 snapshots/s convertiría al generador en el cuello de botella
const pick = list => list[Math.floor(Math.random() * list.length)];

function connect(i) {
  const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
  const ws = new WebSocket(URL_WS, REMOTE ? {} : { headers: { 'x-forwarded-for': ip } });
  const c = { i, ws, ready: false, fighting: false, seq: 0, lastSnap: 0, next: 0, mx: 0, my: 0, saveAt: Date.now() + Math.random() * SAVE_MS, pingAt: Date.now() + Math.random() * 2000 };
  ws.on('error', () => { errors++; });
  ws.on('close', code => {
    if (code === 1008) abort = abort || 'tope de conexiones por IP (server/limits.js): este número de clientes no se puede medir desde una sola IP';
    if (!c.leaving) drops++;
    c.ready = c.fighting = false;
  });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', token: tokens[i], name: `Carga${i}` })));
  ws.on('message', raw => {
    if (raw.length >= SNAP.length && raw.compare(SNAP, 0, SNAP.length, 0, SNAP.length) === 0) {
      const now = performance.now();
      if (c.lastSnap) snapGap.record(Math.max(1, Math.round((now - c.lastSnap) * 1000)));
      c.lastSnap = now; snaps++; c.fighting = true;
      return;
    }
    const m = JSON.parse(raw);
    if (m.t === 'profile' && !c.ready && !c.seeded) {
      c.seeded = true;
      if (REMOTE) { tokens[i] = m.p.token; c.ready = true; return; }
      // Perfiles de tamaño creíble: los que se serializan al guardar
      for (let n = 0; n < MONS; n++) ws.send(JSON.stringify({ t: 'dev', dex: 1 + n % 150, level: 30, region: 'kanto' }));
      setTimeout(() => { c.ready = true; c.next = 0; }, 500);
    } else if (m.t === 'start') { c.fighting = true; c.lastSnap = 0; }
    else if (m.t === 'over') { c.fighting = false; c.lastSnap = 0; c.next = Date.now() + 1000 + Math.random() * 3000; }
    else if (m.t === 'pong') rtt.record(Math.max(1, Math.round((performance.now() - m.ts) * 1000)));
    else if (m.t === 'error') {
      errors++;
      if (/Demasiados perfiles/.test(m.msg)) abort = abort || 'tope de 30 perfiles nuevos por hora desde una IP (server/limits.js)';
    }
  });
  return c;
}

// Entre combates, lo que hace un jugador: mirar una pantalla o la ladder, y volver a jugar
function idle(c, now) {
  if (now < c.next || !c.ready) return;
  const r = Math.random();
  if (r < 0.3 && !REMOTE) c.ws.send(JSON.stringify({ t: 'view', v: 'menu' }));   // (en remoto, sin ensuciar las cuentas de uso)
  else if (r < 0.6) c.ws.send(JSON.stringify({ t: 'ladder', board: pick(['ranked', 'tower', 'dex']), page: 0 }));
  if (r < 0.6) { c.next = now + 500 + Math.random() * 1500; return; }
  c.next = now + 5000;   // (si no empieza, se reintenta)
  c.ws.send(JSON.stringify({ t: 'practice', dexes: [...D.RANKED_POOL].sort(() => Math.random() - 0.5).slice(0, 3), skill: 0.7 }));
}

// Un solo temporizador para todos: 30 entradas/s por cliente en combate, como el navegador
function drive() {
  const now = Date.now();
  for (const c of clients) {
    if (c.ws.readyState !== 1) continue;
    if (now >= c.pingAt) { c.pingAt = now + 2000; c.ws.send(JSON.stringify({ t: 'ping', ts: performance.now() })); }
    if (!REMOTE && c.ready && now >= c.saveAt) { c.saveAt = now + SAVE_MS; c.ws.send(JSON.stringify({ t: 'dev', coins: 1000 + c.seq % 100 })); }
    if (!c.fighting) { idle(c, now); continue; }
    if (Math.random() < 0.03) { c.mx = pick([-1, 0, 1]); c.my = pick([-1, 0, 1]); }
    const tx = Math.floor(Math.random() * 960), ty = Math.floor(Math.random() * 600);
    c.ws.send(JSON.stringify({ t: 'in', s: ++c.seq, mx: c.mx, my: c.my, a: 0, tx, ty, c: Math.random() < 0.03 ? Math.floor(Math.random() * 4) : -1, sw: -1 }));
  }
}

// ---------- Escalones ----------
const genLoop = monitorEventLoopDelay({ resolution: 5 });
const f1 = v => (v == null ? '—' : v.toFixed(1));
async function health() {
  try {
    const res = await fetch(HEALTH, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
const hist = h => (h.count ? { p50: h.percentile(50) / 1000, p95: h.percentile(95) / 1000, p99: h.percentile(99) / 1000, max: h.max / 1000 } : null);

// Qué está mal en este escalón (vacío: aguanta). Un tick nominal son 33 ms y la interpolación del cliente absorbe 100 ms
function verdict(r) {
  const bad = [], s = r.server;
  if (s) {
    if (s.loop.p99 > 33) bad.push(`event loop p99 ${f1(s.loop.p99)} ms`);
    if (s.gap && s.gap.p99 > 66) bad.push(`tick p99 cada ${f1(s.gap.p99)} ms`);
    if (s.cpu > 0.85) bad.push(`CPU ${Math.round(s.cpu * 100)} %`);
  }
  if (r.snap && r.snap.p99 > 100) bad.push(`snapshot p99 cada ${f1(r.snap.p99)} ms`);
  if (r.dropped) bad.push(`${r.dropped} desconexiones`);
  if (r.rtt && r.rtt.p99 > 200) bad.push(`ping p99 ${f1(r.rtt.p99)} ms`);
  if (r.abort) bad.push(`ABORTA: ${r.abort}`);
  return bad;
}

async function step(n) {
  while (clients.length < n && !abort) {
    const batch = Math.min(20, n - clients.length);
    for (let k = 0; k < batch; k++) clients.push(connect(clients.length));
    await sleep(200);
  }
  await sleep(SETTLE * 1000 + MONS * 10);
  snapGap = createHistogram(); rtt = createHistogram(); snaps = 0; const drops0 = drops, errors0 = errors;
  genLoop.reset();
  if (server) server.send('reset');
  const fightsAt = [];
  let healthFails = 0, players = null;
  for (let s = 0; s < DUR && !abort; s++) {
    await sleep(1000);
    fightsAt.push(clients.filter(c => c.fighting).length);
    if (!REMOTE) continue;
    // Cada 5 s: que el servidor responda, y que no se disparen errores, desconexiones ni el ping
    if (s % 5 === 4) {
      const h = await health();
      healthFails = h ? 0 : healthFails + 1;
      if (h) players = h.players;
      if (healthFails >= 2) abort = 'el servidor no responde a /healthz';
    }
    if (errors - errors0 > n) abort = abort || `${errors - errors0} errores en este escalón`;
    if (drops - drops0 >= Math.max(3, n * 0.2)) abort = abort || `${drops - drops0} desconexiones en este escalón`;
    if (rtt.count > n && rtt.percentile(99) / 1000 > 1000) abort = abort || `ping p99 de ${Math.round(rtt.percentile(99) / 1000)} ms`;
  }
  const r = {
    clients: n, players, abort, fighting: Math.round(fightsAt.reduce((a, b) => a + b, 0) / Math.max(1, fightsAt.length)), snapsPerSec: snaps / Math.max(1, fightsAt.length),
    snap: hist(snapGap), rtt: hist(rtt), dropped: drops - drops0, errors: errors - errors0, generator: { p99: genLoop.percentile(99) / 1e6 },
    server: server ? await probe() : null,
  };
  r.bad = verdict(r);
  // Si el generador también va ahogado, sus números de cliente no son del servidor
  r.generatorBusy = r.generator.p99 > 50;
  return r;
}

function print(r) {
  const s = r.server;
  console.log(`\n=== ${r.clients} clientes (${r.fighting} en combate, ${Math.round(r.snapsPerSec)} snapshots/s recibidos) ===`);
  if (s) {
    console.log(`  event loop  p50 ${f1(s.loop.p50)}  p95 ${f1(s.loop.p95)}  p99 ${f1(s.loop.p99)}  máx ${f1(s.loop.max)} ms`);
    if (s.gap) console.log(`  entre ticks p50 ${f1(s.gap.p50)}  p95 ${f1(s.gap.p95)}  p99 ${f1(s.gap.p99)}  máx ${f1(s.gap.max)} ms`);
    if (s.tick) console.log(`  dentro tick p50 ${f1(s.tick.p50)}  p99 ${f1(s.tick.p99)}  máx ${f1(s.tick.max)} ms  (${Math.round(s.ticksPerSec)} ticks/s)`);
    console.log(`  CPU ${Math.round(s.cpu * 100)} % de un núcleo · RSS ${Math.round(s.rss / 1e6)} MB · heap ${Math.round(s.heap / 1e6)} MB`);
    if (s.sql) console.log(`  SQLite      ${s.sql.n} llamadas  p99 ${f1(s.sql.p99)}  máx ${f1(s.sql.maxMs)} ms`);
    if (s.json) console.log(`  JSON >4 KB  ${s.json.n} (${f1(s.json.mb / r.server.secs)} MB/s)  p99 ${f1(s.json.p99)}  máx ${f1(s.json.maxMs)} ms`);
    if (s.gc) console.log(`  GC          ${s.gc.n} pausas  total ${Math.round(s.gc.totalMs)} ms  máx ${f1(s.gc.maxMs)} ms`);
  }
  if (r.snap) console.log(`  cliente: snapshot cada p50 ${f1(r.snap.p50)}  p99 ${f1(r.snap.p99)}  máx ${f1(r.snap.max)} ms; ping p99 ${f1(r.rtt && r.rtt.p99)} ms`);
  if (r.players != null) console.log(`  /healthz: ${r.players} jugadores`);
  console.log(`  ${r.bad.length ? 'DEGRADA: ' + r.bad.join(', ') : 'aguanta'}${r.errors ? ` · ${r.errors} errores` : ''}${r.generatorBusy ? ` · OJO: el generador va ahogado (p99 ${f1(r.generator.p99)} ms), los números de cliente no son fiables` : ''}`);
}

async function main() {
  if (!given) await startServer();
  const h0 = await health();
  console.log(`${URL_WS}: ${h0 ? `versión ${h0.version}, ${h0.players} jugadores conectados` : 'sin /healthz'}`);
  if (!h0) throw new Error('El servidor no responde a /healthz');
  genLoop.enable();
  const timer = setInterval(drive, 33);
  const results = [];
  for (const n of STEPS) {
    const r = await step(n);
    results.push(r);
    print(r);
    // Muy por debajo de 30 ticks/s por combate: seguir subiendo ya no enseña nada
    const perBattle = r.server && r.fighting ? r.server.ticksPerSec / r.fighting : 30;
    if (r.abort) { console.log(`\nPrueba abortada: ${r.abort}.`); break; }
    if (perBattle < 20 && !flag('hasta-el-final')) { console.log('\nParo aquí: el servidor ya no llega a 20 ticks/s por combate.'); break; }
  }
  clearInterval(timer);
  for (const c of clients) { c.leaving = true; c.ws.terminate(); }
  if (REMOTE) { fs.writeFileSync(TOKENS, JSON.stringify(tokens)); console.log(`Tokens de los invitados en ${TOKENS} (se reutilizan al repetir).`); }
  const first = results.find(r => r.bad.length);
  console.log(`\n${first ? `Empieza a degradar con ${first.clients} clientes.` : 'Ningún escalón degrada.'} (${os.cpus().length} núcleos aquí: esta máquina no es el servidor, compara escalones, no cifras absolutas)`);
  const out = arg('json', null);
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
}

process.on('SIGINT', () => { stopServer(); process.exit(130); });
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { stopServer(); setTimeout(() => process.exit(), 100).unref(); });
