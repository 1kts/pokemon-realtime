// Servidor HTTP (archivos estáticos) + WebSocket: perfiles, modo historia, práctica,
// colas online (partida rápida y clasificatoria con draft y ELO) y combates.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const D = require('../public/data.js');
const { Battle } = require('./battle.js');
const store = require('./store.js');
const story = require('./story.js');
const rewards = require('./rewards.js');
const VERSION = require('../package.json').version;
const tower = require('./tower.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  // Para el hosting: comprobación de vida y versión desplegada
  // Acceso total (ver escenarios): /fullaccess lleva al juego con ?fullaccess
  if (url === '/fullaccess') { res.writeHead(302, { Location: '/?fullaccess' }); return res.end(); }
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, version: VERSION, players: clients.size })); }
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.png' ? 'max-age=86400' : 'no-cache' });
    res.end(data);
  });
});

// ---------- Clientes ----------
const clients = new Set();
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function sendProfile(c) {
  story.migrate(c.profile);
  rewards.migrate(c.profile);
  send(c, { t: 'profile', p: publicProfile(c.profile), board: store.leaderboard(), rank: store.rankOf(c.profile) });
}
function publicProfile(p) {
  const { account, ...rest } = p;
  return { ...rest, account: account ? { user: account.user, since: account.since } : null, league: D.leagueOf(p.elo), tower: tower.view(p) };
}
const onlineIds = () => new Set([...clients].filter(c => c.profile).map(c => c.profile.id));
const busy = c => c.battle || c.queue || c.draft;

// ---------- Combates ----------
function startBattle(clientsBySide, opts, onEnd) {
  const sides = opts.sides.map((s, i) => ({ ...s, ws: clientsBySide[i] ? clientsBySide[i].ws : null }));
  const battle = new Battle({
    ...opts, sides,
    onEnd: (result, b) => {
      clientsBySide.forEach(c => { if (c && c.battle === b) c.battle = null; });
      return onEnd(result, b);
    },
  });
  clientsBySide.forEach((c, i) => { if (c) { c.battle = battle; c.side = i; } });
  return battle;
}

// ---------- Colas y draft ----------
const queues = { ranked: [], casual: [] };
const DRAFT_BAN_T = 20, DRAFT_PICK_T = 30;

function joinQueue(c, mode) {
  if (busy(c)) return;
  c.queue = mode;
  c.queuedAt = Date.now();
  queues[mode].push(c);
  send(c, { t: 'queue', mode });
  matchmake(mode);
}

function leaveQueue(c) {
  if (!c.queue) return;
  queues[c.queue] = queues[c.queue].filter(x => x !== c);
  c.queue = null;
}

function matchmake(mode) {
  const q = queues[mode];
  while (q.length >= 2) {
    // Clasificatoria: el que más lleva esperando contra el de ELO más parecido
    const a = q.shift();
    let bi = 0;
    if (mode === 'ranked') {
      let best = Infinity;
      q.forEach((x, i) => { const d = Math.abs(x.profile.elo - a.profile.elo); if (d < best) { best = d; bi = i; } });
    }
    const b = q.splice(bi, 1)[0];
    a.queue = b.queue = null;
    startDraft([a, b], mode);
  }
}

function startDraft(players, mode) {
  const draft = { mode, players, phase: mode === 'ranked' ? 'ban' : 'pick', bans: [null, null], picks: [null, null], timer: null };
  players.forEach(c => { c.draft = draft; });
  draftPhase(draft);
}

function draftPhase(draft) {
  clearTimeout(draft.timer);
  const time = draft.phase === 'ban' ? DRAFT_BAN_T : DRAFT_PICK_T;
  draft.ends = Date.now() + time * 1000;
  draft.players.forEach((c, i) => send(c, {
    t: 'draft', phase: draft.phase, mode: draft.mode, time, pool: D.RANKED_POOL,
    bans: draft.phase === 'pick' ? draft.bans.filter(Boolean) : [], foe: draft.players[1 - i].profile.name,
    foeElo: draft.mode === 'ranked' ? draft.players[1 - i].profile.elo : null,
  }));
  draft.timer = setTimeout(() => draftTimeout(draft), time * 1000 + 300);
}

function draftTimeout(draft) {
  if (draft.phase === 'ban') {
    draft.bans = draft.bans.map(b => b || null);
    draft.phase = 'pick';
    return draftPhase(draft);
  }
  // Quien no eligió a tiempo recibe 3 al azar de los disponibles
  const banned = draft.bans.filter(Boolean);
  draft.picks = draft.picks.map(p => p || shuffle(D.RANKED_POOL.filter(d => !banned.includes(d))).slice(0, 3));
  finishDraft(draft);
}

function draftAction(c, msg) {
  const draft = c.draft;
  if (!draft) return;
  const i = draft.players.indexOf(c);
  if (draft.phase === 'ban' && msg.t === 'ban') {
    if (!D.RANKED_POOL.includes(msg.dex) || draft.bans[i]) return;
    draft.bans[i] = msg.dex;
    if (draft.bans.every(Boolean)) { draft.phase = 'pick'; draftPhase(draft); }
  } else if (draft.phase === 'pick' && msg.t === 'pick') {
    const banned = draft.bans.filter(Boolean);
    const list = Array.isArray(msg.dexes) ? [...new Set(msg.dexes.map(Number))] : [];
    if (list.length !== 3 || !list.every(d => D.RANKED_POOL.includes(d) && !banned.includes(d)) || draft.picks[i]) return;
    draft.picks[i] = list;
    send(c, { t: 'draftwait' });
    if (draft.picks.every(Boolean)) finishDraft(draft);
  }
}

function cancelDraft(draft, leaver) {
  clearTimeout(draft.timer);
  draft.players.forEach(c => {
    c.draft = null;
    if (c !== leaver) send(c, { t: 'cancelled', reason: 'Tu rival se ha desconectado' });
  });
}

function finishDraft(draft) {
  clearTimeout(draft.timer);
  const [a, b] = draft.players;
  a.draft = b.draft = null;
  const maps = Object.keys(D.MAPS);
  const lvl = D.RANKED_LEVEL;
  startBattle(draft.players, {
    mode: draft.mode, map: maps[Math.floor(Math.random() * maps.length)],
    sides: draft.players.map((c, i) => ({ name: c.profile.name, team: draft.picks[i].map(dex => ({ dex, level: lvl })) })),
  }, (result) => {
    if (draft.mode !== 'ranked' || result.winner < 0) return [];
    // ELO con K=32
    const [pa, pb] = [a.profile, b.profile];
    const [ea0, eb0] = [pa.elo, pb.elo];
    const ea = 1 / (1 + Math.pow(10, (pb.elo - pa.elo) / 400));
    const sa = result.winner === 0 ? 1 : 0;
    const da = Math.round(32 * (sa - ea));
    pa.elo += da; pb.elo -= da;
    pa.ranked++; pb.ranked++;
    if (sa) { pa.wins++; pb.losses++; } else { pa.losses++; pb.wins++; }
    const leagues = [D.leagueOf(ea0), D.leagueOf(eb0)];
    const pay = [
      rewards.afterRanked(pa, { won: !!sa, delta: da, foe: pb.name, foeElo: eb0, team: draft.picks[0], foeTeam: draft.picks[1] }),
      rewards.afterRanked(pb, { won: !sa, delta: -da, foe: pa.name, foeElo: ea0, team: draft.picks[1], foeTeam: draft.picks[0] }),
    ];
    store.save();
    setTimeout(() => draft.players.forEach(sendProfile), 50);
    return [pa, pb].map((p, i) => ({ elo: i ? -da : da, total: p.elo, coins: pay[i].coins, firstWin: pay[i].firstWin,
      league: D.leagueOf(p.elo), promoted: D.leagueOf(p.elo) !== leagues[i] && (i ? -da : da) > 0 ? D.leagueOf(p.elo) : null }));
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Práctica contra bot ----------
function startPractice(c, msg) {
  const list = Array.isArray(msg.dexes) ? [...new Set(msg.dexes.map(Number))].filter(d => D.RANKED_POOL.includes(d)).slice(0, 3) : [];
  if (!list.length) return send(c, { t: 'error', msg: 'Elige al menos un Pokémon' });
  const skill = Math.max(0, Math.min(1, +msg.skill || 0.28));
  const maps = Object.keys(D.MAPS);
  startBattle([c, null], {
    mode: 'practice', map: maps[Math.floor(Math.random() * maps.length)],
    sides: [
      { name: c.profile.name, team: list.map(dex => ({ dex, level: D.RANKED_LEVEL })) },
      { name: 'Bot', team: shuffle(D.RANKED_POOL).slice(0, list.length).map(dex => ({ dex, level: D.RANKED_LEVEL })), ai: skill },
    ],
  }, () => []);
}

// ---------- Acceso total: ver cualquier escenario ----------
// Quien abre el juego con ?fullaccess puede combatir en cualquier mapa o arena sin medallas ni
// nivel. Son combates de práctica (sin premios ni progreso), así que no hace falta clave.
function startArenaView(c, msg) {
  const map = typeof msg.map === 'string' && (D.MAPS[msg.map] || D.ARENAS[msg.map]) ? msg.map : null;
  if (!map) return send(c, { t: 'error', msg: 'Escenario desconocido' });
  const leader = Object.values(D.NODES).find(n => n.kind !== 'route' && n.map === map);
  const pool = shuffle(D.RANKED_POOL);
  const foe = leader ? D.leaderTeam(leader, 1).map(([dex]) => dex) : pool.slice(3, 6);
  startBattle([c, null], {
    mode: 'practice', map,
    sides: [
      { name: c.profile.name, team: pool.slice(0, 3).map(dex => ({ dex, level: D.RANKED_LEVEL })) },
      { name: leader ? leader.leader : 'Bot', team: foe.map(dex => ({ dex, level: D.RANKED_LEVEL })), ai: leader ? leader.ai : 0.28, passive: !!msg.passive },
    ],
  }, () => []);
}

// ---------- Historia ----------
function startStory(c, msg) {
  const setup = story.battleSetup(c.profile, msg);
  if (setup.error) return send(c, { t: 'error', msg: setup.error });
  startBattle([c, null], setup.opts, (result, b) => {
    const reward = story.applyResult(c.profile, setup, result, b);
    setTimeout(() => sendProfile(c), 50);
    return [reward, null];
  });
}

// ---------- Torre Batalla ----------
function startTower(c) {
  const setup = tower.battleSetup(c.profile);
  if (setup.error) { send(c, { t: 'error', msg: setup.error }); return sendProfile(c); }
  startBattle([c, null], setup.opts, result => {
    const reward = tower.applyResult(c.profile, setup, result);
    setTimeout(() => sendProfile(c), 50);
    return [reward, null];
  });
}

// ---------- Conexiones ----------
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  const c = { ws, profile: null, battle: null, side: 0, queue: null, draft: null, authTries: [] };
  clients.add(c);
  send(c, { t: 'welcome', version: VERSION });
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    try { handle(c, msg); } catch (e) { console.error('Error con el mensaje', msg.t, e); }
  });
  ws.on('close', () => {
    clients.delete(c);
    leaveQueue(c);
    if (c.draft) cancelDraft(c.draft, c);
    if (c.battle) c.battle.leave(c.battle.sides[c.side], true);
  });
});

function handle(c, msg) {
  if (msg.t === 'ping') return send(c, { t: 'pong', ts: msg.ts });
  if (msg.t === 'hello') {
    // El nombre solo cuenta para perfiles nuevos; luego se cambia con 'name'
    const name = String(msg.name || '').trim().slice(0, 16) || 'Entrenador';
    c.profile = store.get(typeof msg.token === 'string' ? msg.token : null, name);
    return sendProfile(c);
  }
  if (msg.t === 'login' || msg.t === 'register') return auth(c, msg);
  if (!c.profile) return;
  if (msg.t === 'in') {
    if (!c.battle) return;
    const side = c.battle.sides[c.side];
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
    side.inputs.push({
      s: msg.s | 0, mx: num(msg.mx, -1, 1), my: num(msg.my, -1, 1), a: num(msg.a, -10, 10),
      tx: num(msg.tx, -200, 1200), ty: num(msg.ty, -200, 900),
      c: Number.isInteger(msg.c) ? msg.c : -1, sw: Number.isInteger(msg.sw) ? msg.sw : -1,
      ball: typeof msg.ball === 'string' ? msg.ball : undefined,
    });
    return;
  }
  // Gancho de desarrollo (solo con ARENA_DEV=1): dinero, ELO, medallas, objetos, Pokémon y racha de la Torre para probar
  if (msg.t === 'dev' && process.env.ARENA_DEV) {
    const p = c.profile;
    if (Number.isFinite(msg.coins)) p.coins += msg.coins;
    if (Number.isFinite(msg.elo)) { rewards.migrate(p); p.elo = msg.elo; p.peakElo = Math.max(p.peakElo, p.elo); p.season.peak = Math.max(p.season.peak, p.elo); }
    if (Number.isInteger(msg.badges)) { p.prog = { ...(p.prog || {}), [msg.region || 'kanto']: msg.badges }; story.migrate(p); }
    if (msg.item && D.SHOP.find(i => i.id === msg.item)) p.items[msg.item] = (p.items[msg.item] || 0) + (msg.qty | 0 || 1);
    if (D.SPECIES[msg.dex]) story.devAddMon(p, msg.dex, msg.level | 0 || 5, !!msg.shiny, msg.region);
    if (Number.isInteger(msg.towerStreak) && p.tower && p.tower.team) { p.tower.streak = msg.towerStreak; p.tower.next = null; }
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'name') {
    c.profile.name = String(msg.name || '').trim().slice(0, 16) || c.profile.name;
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'passwd') {
    if (tooManyTries(c)) return send(c, { t: 'autherr', msg: 'Demasiados intentos: espera un minuto' });
    const err = store.changePassword(c.profile, msg.old, msg.pass);
    if (err) return send(c, { t: 'autherr', msg: err });
    send(c, { t: 'authok', msg: 'Contraseña cambiada' });
    return sendProfile(c);
  }
  if (msg.t === 'claim' || msg.t === 'look') {
    const err = msg.t === 'claim' ? rewards.claim(c.profile, String(msg.league)) : rewards.setLook(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'inboxread') { c.profile.inbox = []; store.save(); return sendProfile(c); }
  if (msg.t === 'story' && ['starter', 'team', 'buy', 'use', 'release', 'moves', 'sell'].includes(msg.a)) {
    if (c.battle) return;
    const err = story.action(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    return sendProfile(c);
  }
  if (draining && starts(msg)) return send(c, { t: 'error', msg: DRAIN_MSG });
  if (msg.t === 'story' && (msg.a === 'route' || msg.a === 'gym')) { if (!busy(c)) startStory(c, msg); return; }
  if (msg.t === 'practice') { if (!busy(c)) startPractice(c, msg); return; }
  if (msg.t === 'admin') {
    c.profile.admin = !msg.off;
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'arena') {
    if (!c.profile.admin) return send(c, { t: 'error', msg: 'Abre el juego con ?fullaccess para entrar en los escenarios' });
    if (!busy(c)) startArenaView(c, msg);
    return;
  }
  if (msg.t === 'tower' && msg.a === 'battle') { if (!busy(c)) startTower(c); return; }
  if (msg.t === 'tower') {
    if (c.battle) return;
    const err = tower.action(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    return sendProfile(c);
  }
  if (msg.t === 'ladder') {
    const q = typeof msg.q === 'string' ? msg.q : '';
    return send(c, { t: 'ladder', ...store.ladder(String(msg.board), { page: msg.page | 0, q, me: c.profile, online: onlineIds() }) });
  }
  if (msg.t === 'user') return send(c, { t: 'user', u: store.publicUser(String(msg.id), onlineIds()) });
  if (msg.t === 'queue' && (msg.mode === 'ranked' || msg.mode === 'casual')) return joinQueue(c, msg.mode);
  if (msg.t === 'unqueue') { leaveQueue(c); return send(c, { t: 'unqueued' }); }
  if (msg.t === 'ban' || msg.t === 'pick') return draftAction(c, msg);
  if (msg.t === 'forfeit' && c.battle) return c.battle.leave(c.battle.sides[c.side]);
}

// ---------- Cuentas ----------
// Como mucho 8 intentos de contraseña por conexión y minuto
function tooManyTries(c) {
  const now = Date.now();
  c.authTries = c.authTries.filter(t => now - t < 60000);
  c.authTries.push(now);
  return c.authTries.length > 8;
}

function auth(c, msg) {
  if (busy(c)) return send(c, { t: 'autherr', msg: 'Termina antes lo que estás haciendo' });
  if (tooManyTries(c)) return send(c, { t: 'autherr', msg: 'Demasiados intentos: espera un minuto' });
  const user = typeof msg.user === 'string' ? msg.user.trim() : '';
  if (msg.t === 'login') {
    const p = store.login(user, msg.pass);
    if (!p) return send(c, { t: 'autherr', msg: 'Usuario o contraseña incorrectos' });
    c.profile = p;
  } else {
    // Registrar el perfil actual (invitado) o, desde la portada, uno nuevo
    const r = store.register(c.profile, user, msg.pass);
    if (r.err) return send(c, { t: 'autherr', msg: r.err });
    c.profile = r.p;
  }
  send(c, { t: 'authok', msg: msg.t === 'login' ? `¡Hola de nuevo, ${c.profile.name}!` : 'Cuenta creada: ya puedes entrar desde cualquier dispositivo' });
  sendProfile(c);
}

// ---------- Apagado ----------
// Al desplegar llega SIGTERM: se dejan de aceptar colas y combates nuevos, se esperan los combates
// y drafts en curso (como mucho DRAIN_MS; el hosting tiene que dar ese margen antes de matar el
// proceso) y se guardan los perfiles en el acto. Una segunda señal apaga sin esperar.
const DRAIN_MS = 5 * 60 * 1000;
const DRAIN_MSG = 'El servidor se va a actualizar: termina tu combate. En unos minutos podrás empezar otro.';
const starts = msg => (msg.t === 'story' && (msg.a === 'route' || msg.a === 'gym')) || msg.t === 'practice' || msg.t === 'arena'
  || (msg.t === 'tower' && msg.a === 'battle') || msg.t === 'queue';
let draining = false;

function shutdown() {
  if (draining) { store.flush(); process.exit(0); }
  draining = true;
  console.log('Apagando: esperando a los combates en curso…');
  for (const c of clients) {
    if (c.queue) { leaveQueue(c); send(c, { t: 'cancelled', reason: DRAIN_MSG }); } else send(c, { t: 'error', msg: DRAIN_MSG });
  }
  const until = Date.now() + DRAIN_MS;
  (function wait() {
    if ([...clients].some(c => c.battle || c.draft) && Date.now() < until) return setTimeout(wait, 1000);
    store.flush();
    process.exit(0);
  })();
}

function start(port = PORT) {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return new Promise(resolve => server.listen(port, () => { console.log(`Servidor en http://localhost:${server.address().port}`); resolve(server); }));
}

module.exports = { start };
