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

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
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
function sendProfile(c) { story.migrate(c.profile); send(c, { t: 'profile', p: publicProfile(c.profile), board: store.leaderboard() }); }
function publicProfile(p) {
  const { token, ...rest } = p;
  return { ...rest, token, league: D.leagueOf(p.elo) };
}
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
    const ea = 1 / (1 + Math.pow(10, (pb.elo - pa.elo) / 400));
    const sa = result.winner === 0 ? 1 : 0;
    const da = Math.round(32 * (sa - ea));
    pa.elo += da; pb.elo -= da;
    pa.ranked++; pb.ranked++;
    if (sa) { pa.wins++; pb.losses++; } else { pa.losses++; pb.wins++; }
    store.save();
    setTimeout(() => draft.players.forEach(sendProfile), 50);
    return [{ elo: da, total: pa.elo }, { elo: -da, total: pb.elo }];
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

// ---------- Conexiones ----------
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  const c = { ws, profile: null, battle: null, side: 0, queue: null, draft: null };
  clients.add(c);
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
    const name = String(msg.name || '').trim().slice(0, 16) || 'Entrenador';
    c.profile = store.get(typeof msg.token === 'string' ? msg.token : null, name);
    return sendProfile(c);
  }
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
  if (msg.t === 'name') {
    c.profile.name = String(msg.name || '').trim().slice(0, 16) || c.profile.name;
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'story' && ['starter', 'team', 'buy', 'use', 'release', 'moves'].includes(msg.a)) {
    if (c.battle) return;
    const err = story.action(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    return sendProfile(c);
  }
  if (msg.t === 'story' && (msg.a === 'route' || msg.a === 'gym')) { if (!busy(c)) startStory(c, msg); return; }
  if (msg.t === 'practice') { if (!busy(c)) startPractice(c, msg); return; }
  if (msg.t === 'queue' && (msg.mode === 'ranked' || msg.mode === 'casual')) return joinQueue(c, msg.mode);
  if (msg.t === 'unqueue') { leaveQueue(c); return send(c, { t: 'unqueued' }); }
  if (msg.t === 'ban' || msg.t === 'pick') return draftAction(c, msg);
  if (msg.t === 'forfeit' && c.battle) return c.battle.leave(c.battle.sides[c.side]);
}

function start(port = PORT) {
  return new Promise(resolve => server.listen(port, () => { console.log(`Servidor en http://localhost:${server.address().port}`); resolve(server); }));
}

module.exports = { start };
