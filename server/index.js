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
const treasure = require('./treasure.js');
const VERSION = require('../package.json').version;
const tower = require('./tower.js');
const missions = require('./missions.js');
const daily = require('./daily.js');
const { collectAll } = require('./collect.js');
const metrics = require('./metrics.js');
const balance = require('./balance.js');
const limits = require('./limits.js');
const bugs = require('./bugs.js');
const usage = require('./usage.js');
const audit = require('./audit.js');
const { createAdmin } = require('./admin.js');
const art = require('./art.js');
const names = require('./names.js');
const STARTED = Date.now();
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
// En producción 127.0.0.1: solo se llega a través de Caddy (HTTPS y la IP real para los límites)
const HOST = process.env.HOST || undefined;
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg' };

// Cabeceras de seguridad de todas las respuestas; las páginas HTML llevan además la CSP: todo
// (scripts, Three.js y fuentes en public/vendor) se carga de este servidor, más los scripts en línea
// de la propia página (por su hash: uno inyectado no se ejecutaría), y solo se conecta a él.
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
function csp(html, host) {
  const hashes = [...html.toString().matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  const h = /^[A-Za-z0-9.:[\]-]+$/.test(host || '') ? host : '';
  return [`default-src 'self'`, `script-src 'self' ${hashes.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`, `font-src 'self'`,
    `img-src 'self' data: blob:`, `connect-src 'self'${h ? ` ws://${h} wss://${h}` : ''}`, `worker-src 'self' blob:`,
    `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`].join('; ');
}

const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  // Para el hosting: comprobación de vida y versión desplegada
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, version: VERSION, players: clients.size })); }
  if (art.handle(url, res)) return;
  if (url === '/admin' || url === '/admin/') url = '/admin/index.html';
  if (url === '/legal' || url === '/legal/') url = '/legal/index.html';
  if (url === '/legal/en') url = '/legal/en.html';
  if (url.startsWith('/admin/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    const ext = path.extname(file);
    if (ext === '.html') res.setHeader('Content-Security-Policy', csp(data, req.headers.host));
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.png' || ext === '.jpg' ? 'max-age=86400' : url.startsWith('/vendor/') ? 'max-age=604800' : url.startsWith('/music/') ? 'max-age=86400' : 'no-cache' });
    res.end(data);
  });
});

// ---------- Clientes ----------
const clients = new Set();
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function sendProfile(c) {
  delete c.profile.admin;   // marca del antiguo "acceso total", ya quitado
  story.migrate(c.profile);
  rewards.migrate(c.profile);
  treasure.migrate(c.profile);
  if (metrics.touch(c.profile)) store.save();
  send(c, { t: 'profile', p: publicProfile(c.profile), board: store.leaderboard(), rank: store.rankOf(c.profile) });
}
function publicProfile(p) {
  const { account, act, ...rest } = p;
  return { ...rest, account: account ? { user: account.user, since: account.since } : null, league: D.leagueOf(p.elo), tower: tower.view(p), missions: missions.view(p),
    daily: daily.view(p) };
}
const onlineIds = () => new Set([...clients].filter(c => c.profile).map(c => c.profile.id));
const busy = c => c.battle || c.queue;

// ---------- Combates ----------
function startBattle(clientsBySide, opts, onEnd) {
  const sides = opts.sides.map((s, i) => ({ ...s, ws: clientsBySide[i] ? clientsBySide[i].ws : null }));
  const battle = new Battle({
    ...opts, sides,
    onEnd: (result, b) => {
      clientsBySide.forEach(c => { if (c && c.battle === b) c.battle = null; });
      try { balance.battle(b, result); } catch (e) { console.error('Datos de equilibrio:', e); }
      return onEnd(result, b);
    },
  });
  clientsBySide.forEach((c, i) => { if (c) { c.battle = battle; c.side = i; if (c.profile) metrics.battle(c.profile); } });
  return battle;
}

// ---------- Colas ----------
const SAME_FOE_ELO = 3;              // partidas al día contra el mismo rival que cuentan para el ELO
const pairGames = new Map();         // día -> (par de cuentas -> partidas)
const queues = { ranked: [], casual: [] };

// ---------- Administración (server/admin.js) ----------
// Mantenimiento: como al apagar, no se empiezan combates ni colas nuevas, pero el servidor sigue
let maintenance = false;
const adminPanel = createAdmin({ clients, send, sendProfile, queues, version: VERSION, startedAt: STARTED,
  maintenance: () => maintenance, setMaintenance: on => { maintenance = on; } });

// Gente en línea para las tarjetas de PvP del menú: conectados, buscando rival en cada cola y combatiendo.
// Cada 2 s se manda a quien no tenga ya los números de ahora (los recién llegados lo reciben enseguida)
function popInfo() {
  let online = 0, battling = 0;
  for (const c of clients) if (c.profile) { online++; if (c.battle || c.draft) battling++; }
  return { online, battling, queue: { ranked: queues.ranked.length, casual: queues.casual.length } };
}
setInterval(() => {
  const pop = popInfo(), key = JSON.stringify(pop);
  for (const c of clients) if (c.profile && c.popKey !== key) { c.popKey = key; send(c, { t: 'pop', ...pop }); }
}, 2000).unref();

function joinQueue(c, mode) {
  if (busy(c)) return;
  if (!D.pvpTeam(c.profile.pvpTeam)) return send(c, { t: 'error', msg: 'Prepara antes tu equipo en Clasificatoria' });
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

// Dos conexiones desde la misma IP no se emparejan (así nadie se sube el ELO jugando contra sí mismo en
// otra pestaña o navegador). En local y en los tests se permite, salvo con SAME_IP_BLOCK
const sameOrigin = (a, b) => a.ip === b.ip && (process.env.NODE_ENV === 'production' || !!process.env.SAME_IP_BLOCK);

function matchmake(mode) {
  const q = queues[mode];
  // Clasificatoria: el que más lleva esperando contra el de ELO más parecido; rápida, el primero que haya
  for (let ai = 0; ai < q.length; ai++) {
    const a = q[ai];
    let bi = -1, best = Infinity;
    q.forEach((x, i) => {
      if (i === ai || sameOrigin(a, x)) return;
      const d = mode === 'ranked' ? Math.abs(x.profile.elo - a.profile.elo) : i;
      if (d < best) { best = d; bi = i; }
    });
    if (bi < 0) continue;
    const b = q[bi];
    queues[mode] = q.filter(x => x !== a && x !== b);
    a.queue = b.queue = null;
    return startDuel([a, b], mode) || matchmake(mode);
  }
}

// Sin draft: cada uno combate con el equipo de 3 que se preparó (Pokémon y movimientos, a Nv.50)
function startDuel(players, mode) {
  const teams = players.map(c => D.pvpTeam(c.profile.pvpTeam));
  finishDraft({ mode, players, teams, picks: teams.map(tm => tm.map(x => x.dex)), bans: [] });
}

function finishDraft(draft) {
  const [a, b] = draft.players;
  const maps = Object.keys(D.MAPS);
  const lvl = D.RANKED_LEVEL;
  try { balance.draft(draft.mode, draft.picks, draft.bans); } catch (e) { console.error('Datos de equilibrio:', e); }
  startBattle(draft.players, {
    mode: draft.mode, map: maps[Math.floor(Math.random() * maps.length)],
    sides: draft.players.map((c, i) => ({ name: store.fullName(c.profile), team: draft.teams[i].map(({ dex, moves }) => ({ dex, level: lvl, moves, skin: D.skinOf(c.profile, dex), parts: D.particlesOf(c.profile, dex) })) })),
  }, (result, battle) => {
    if (result.winner < 0) return [];
    // Maestría para el ganador, en clasificatoria y en rápida
    const mastery = rewards.addMastery(draft.players[result.winner].profile, draft.picks[result.winner]);
    rewards.addLineStat(draft.players[result.winner].profile, draft.picks[result.winner], 'pvp');
    draft.players.forEach((c, i) => rewards.addKOs(c.profile, battle, i));
    // Misiones de los dos: combate online jugado, victoria (con los tipos de su equipo) y clasificatoria ganada
    const before = draft.players.map(c => missions.snapshot(c.profile));
    draft.players.forEach((c, i) => {
      missions.track(c.profile, 'online');
      if (result.winner === i) {
        missions.track(c.profile, 'win', 1, missions.typesOf(draft.picks[i]));
        if (draft.mode === 'ranked') missions.track(c.profile, 'rankedWin');
      }
    });
    const progress = draft.players.map((c, i) => missions.diff(c.profile, before[i]));
    if (draft.mode !== 'ranked') {
      store.save();
      setTimeout(() => draft.players.forEach(sendProfile), 50);
      return progress.map((m, i) => ({ missions: m, ...(i === result.winner ? { mastery } : {}) }));
    }
    // ELO con K=32
    const [pa, pb] = [a.profile, b.profile];
    const [ea0, eb0] = [pa.elo, pb.elo];
    const ea = 1 / (1 + Math.pow(10, (pb.elo - pa.elo) / 400));
    const sa = result.winner === 0 ? 1 : 0;
    // Contra el mismo rival, el ELO solo cuenta en las 3 primeras partidas del día (para que nadie se lo suba
    // jugando siempre contra la misma cuenta)
    const today = D.dayKey(), pairKey = [pa.id, pb.id].sort().join(':');
    if (!pairGames.has(today)) { pairGames.clear(); pairGames.set(today, new Map()); }
    const pairs = pairGames.get(today), n = (pairs.get(pairKey) || 0) + 1;
    pairs.set(pairKey, n);
    const eloOk = n <= SAME_FOE_ELO;
    const da = eloOk ? Math.round(32 * (sa - ea)) : 0;
    pa.elo += da; pb.elo -= da;
    pa.ranked++; pb.ranked++;
    if (sa) { pa.wins++; pb.losses++; } else { pa.losses++; pb.wins++; }
    const [win, lose] = sa ? [pa, pb] : [pb, pa];
    audit.log('ranked.resultado', { actor: win.id, target: lose.id, elo: Math.abs(da), winElo: win.elo, loseElo: lose.elo, mode: draft.mode });
    const leagues = [D.leagueOf(ea0), D.leagueOf(eb0)];
    const pay = [
      rewards.afterRanked(pa, { won: !!sa, delta: da, foe: store.fullName(pb), foeElo: eb0, team: draft.picks[0], foeTeam: draft.picks[1] }),
      rewards.afterRanked(pb, { won: !sa, delta: -da, foe: store.fullName(pa), foeElo: ea0, team: draft.picks[1], foeTeam: draft.picks[0] }),
    ];
    store.save();
    setTimeout(() => draft.players.forEach(sendProfile), 50);
    return [pa, pb].map((p, i) => ({ mastery: i === result.winner ? mastery : [], elo: i ? -da : da, total: p.elo, coins: pay[i].coins, firstWin: pay[i].firstWin, gems: pay[i].gems, missions: progress[i],
      eloCapped: !eloOk, league: D.leagueOf(p.elo), promoted: D.leagueOf(p.elo) !== leagues[i] && (i ? -da : da) > 0 ? D.leagueOf(p.elo) : null }));
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- Práctica contra bot ----------
const TUTORIAL_DUMMY = 143, TUTORIAL_HP = 0.6;   // Snorlax, con algo menos de vida para que el tutorial dure ~1 min
function startPractice(c, msg) {
  const list = Array.isArray(msg.dexes) ? [...new Set(msg.dexes.map(Number))].filter(d => D.RANKED_POOL.includes(d)).slice(0, 3) : [];
  if (!list.length) return send(c, { t: 'error', msg: 'Elige al menos un Pokémon' });
  const skill = Math.max(0, Math.min(1, +msg.skill || 0.28));
  const maps = Object.keys(D.MAPS);
  // Tutorial: un muñeco que ni se mueve ni ataca, para aprender los controles sin presión
  const tut = !!msg.tutorial;
  startBattle([c, null], {
    mode: 'practice', tutorial: tut, map: tut ? Object.keys(D.MAPS)[0] : maps[Math.floor(Math.random() * maps.length)],
    sides: [
      { name: c.profile.name, team: list.map(dex => ({ dex, level: D.RANKED_LEVEL, skin: D.skinOf(c.profile, dex), parts: D.particlesOf(c.profile, dex) })) },
      // (el muñeco es un Snorlax: Normal, así que ningún ataque del tutorial le hace poco efecto)
      tut ? { name: 'Muñeco', team: [{ dex: TUTORIAL_DUMMY, level: D.RANKED_LEVEL }], ai: 0, passive: true, hpMult: TUTORIAL_HP }
        : { name: 'Bot', team: shuffle(D.RANKED_POOL).slice(0, list.length).map(dex => ({ dex, level: D.RANKED_LEVEL })), ai: skill },
    ],
  }, () => []);
}

// ---------- Historia ----------
function startStory(c, msg) {
  const setup = story.battleSetup(c.profile, msg);
  if (setup.error) return send(c, { t: 'error', msg: setup.error });
  startBattle([c, null], setup.opts, (result, b) => {
    const before = missions.snapshot(c.profile);
    const reward = story.applyResult(c.profile, setup, result, b);
    if (setup.gym) try { balance.leader(setup.gym, result.winner === 0); } catch (e) { console.error('Datos de equilibrio:', e); }
    if (result.winner === 0) reward.mastery = rewards.addMastery(c.profile, b.sides[0].team.map(m => m.dex));
    rewards.addKOs(c.profile, b, 0);
    reward.missions = missions.diff(c.profile, before);
    setTimeout(() => sendProfile(c), 50);
    return [reward, null];
  });
}

// ---------- Torre Batalla ----------
function startTower(c) {
  const setup = tower.battleSetup(c.profile);
  if (setup.error) { send(c, { t: 'error', msg: setup.error }); return sendProfile(c); }
  startBattle([c, null], setup.opts, (result, b) => {
    const before = missions.snapshot(c.profile);
    const reward = tower.applyResult(c.profile, setup, result);
    try { balance.tower(setup.foe.n, result.winner === 0); } catch (e) { console.error('Datos de equilibrio:', e); }
    if (result.winner === 0) {
      reward.mastery = rewards.addMastery(c.profile, b.sides[0].team.map(m => m.dex));
      rewards.addLineStat(c.profile, b.sides[0].team.map(m => m.dex), 'tower', reward.tower.streak, true);
    }
    rewards.addKOs(c.profile, b, 0);
    reward.missions = missions.diff(c.profile, before);
    setTimeout(() => sendProfile(c), 50);
    return [reward, null];
  });
}

// ---------- Conexiones ----------
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  const ip = limits.clientIp(req);
  if (!limits.connOpen(ip)) {
    audit.logNoisy('limite.conexiones', ip);
    ws.send(JSON.stringify({ t: 'error', msg: 'Demasiadas conexiones desde tu red: espera un poco' }));
    return ws.close(1008);
  }
  const c = { ws, ip, limits: limits.forConn(ip), profile: null, battle: null, side: 0, queue: null, draft: null, authTries: [] };
  clients.add(c);
  send(c, { t: 'welcome', version: VERSION });
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    // Quien manda mensajes sin parar (un script) pierde los que sobran y, si insiste, la conexión
    const { ok, kick } = limits.allow(c.limits, msg.t);
    if (kick) { audit.logNoisy('limite.inundacion', ip, { actor: c.profile ? c.profile.id : null }); return ws.terminate(); }
    if (!ok) return;
    const fail = e => console.error('Error con el mensaje', msg.t, e);
    try { Promise.resolve(handle(c, msg)).catch(fail); } catch (e) { fail(e); }
  });
  ws.on('close', () => {
    limits.connClose(ip);
    clients.delete(c);
    leaveQueue(c);
    usage.close(c);
    if (c.battle) c.battle.leave(c.battle.sides[c.side], true);
    if (c.profile) store.release(c.profile);
  });
});

// Suspendidos: se les dice por qué y hasta cuándo, y se cierra la conexión
function refuseBanned(c, p) {
  audit.logNoisy('cuenta.suspendida', c.ip, { actor: p.id });
  send(c, { t: 'banned', reason: p.ban.reason, until: p.ban.until });
  c.ws.close(4001);
}

function handle(c, msg) {
  if (msg.t === 'ping') return send(c, { t: 'pong', ts: msg.ts });
  if (msg.t.startsWith('admin.')) return adminPanel.handle(c, msg);
  // Uso del juego para el panel (solo contadores del día): aparato, idioma y pantallas que se visitan
  if (msg.t === 'ctx') return usage.session(c, msg);
  if (msg.t === 'view') return usage.view(c, msg);
  // Reportar un bug desde el juego (se guarda y avisa al admin)
  if (msg.t === 'bug') {
    const err = bugs.report(c, msg);
    if (!err) audit.log('perfil.bug', { actor: c.profile.id, ip: c.ip });
    return send(c, err ? { t: 'error', msg: err } : { t: 'bugok' });
  }
  if (msg.t === 'hello') {
    // El nombre solo cuenta para perfiles nuevos; luego se cambia con 'name'
    if (busy(c) || c.authing) return;
    const token = typeof msg.token === 'string' ? msg.token : null;
    const known = store.has(token);
    const checked = names.trainerName(msg.name);
    if (!known && checked.error) return send(c, { t: 'error', msg: checked.error });
    const name = checked.name || 'Entrenador';
    if (!known && !limits.newProfile(c.ip)) {
      audit.logNoisy('limite.perfiles', c.ip);
      return send(c, { t: 'error', msg: 'Demasiados perfiles nuevos desde tu red: espera un rato' });
    }
    const p = store.get(token, name);
    if (store.banned(p)) { store.release(p); return refuseBanned(c, p); }
    setProfile(c, p);
    audit.log(known ? 'sesion' : 'perfil.nuevo', { actor: p.id, ip: c.ip });
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
    if (msg.daily && typeof msg.daily.last === 'string') p.daily = { last: msg.daily.last, streak: msg.daily.streak | 0 };
    if (msg.tutorial === false) delete p.tutorial;
    if (msg.mastery && D.SPECIES[msg.mastery.dex] && Number.isInteger(msg.mastery.wins)) { rewards.migrate(p); p.mastery[D.lineOf(msg.mastery.dex)] = msg.mastery.wins; }
    if (msg.catches && D.SPECIES[msg.catches.dex] && Number.isInteger(msg.catches.n)) { rewards.migrate(p); (p.lineStats.catch = p.lineStats.catch || {})[D.lineOf(msg.catches.dex)] = msg.catches.n; }
    if (msg.auras) { rewards.migrate(p); for (const g of D.AURAS) rewards.unlock(p, 'auras', g); }
    if (typeof msg.aura === 'string' && D.AURAS.includes(msg.aura)) { rewards.migrate(p); rewards.unlock(p, 'auras', msg.aura); }
    if (msg.missionsDone) { missions.action(p, { a: 'refresh' }); for (const m of p.missions.daily) m.n = D.MISSION_BY_ID[m.id].goal; }
    if (Array.isArray(msg.effects)) { rewards.migrate(p); for (const fx of msg.effects) if (D.EFFECTS.includes(fx)) rewards.unlock(p, 'effects', fx); }
    if (msg.elemental) { rewards.migrate(p); for (const m of p.mons) rewards.unlock(p, 'skins', 'elemental:' + D.lineOf(m.dex)); }
    if (msg.particles) { rewards.migrate(p); for (const m of p.mons) rewards.unlock(p, 'particles', D.lineOf(m.dex)); }
    if (Number.isFinite(msg.gems)) { treasure.migrate(p); p.gems += msg.gems; }
    // Rival del combate en curso con esa fracción de vida (las pruebas no esperan a debilitarlo a golpes)
    if (Number.isFinite(msg.foeHp) && c.battle) for (const m of c.battle.sides[1 - c.side].team) if (!m.fainted) m.hp = Math.max(1, Math.round(m.maxHp * msg.foeHp));
    store.save();
    return sendProfile(c);
  }
  // Equipo para Clasificatoria y Partida rápida: 3 Pokémon del pool, a Nv.50, con sus movimientos
  if (msg.t === 'pvpteam') {
    const team = D.pvpTeam(msg.team);
    if (!team) return send(c, { t: 'error', msg: 'Elige 3 Pokémon distintos de la lista' });
    c.profile.pvpTeam = team;
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'name') {
    const old = c.profile.name;
    const checked = names.trainerName(msg.name);
    if (checked.error) return send(c, { t: 'error', msg: checked.error });
    if (checked.name) store.setName(c.profile, checked.name);
    if (c.profile.name !== old) audit.log('perfil.nombre', { actor: c.profile.id, ip: c.ip, old, name: c.profile.name });
    store.save();
    return sendProfile(c);
  }
  if (msg.t === 'passwd') {
    if (tooManyTries(c)) return send(c, { t: 'autherr', msg: 'Demasiados intentos: espera un minuto' });
    return store.changePassword(c.profile, msg.old, msg.pass).then(err => {
      if (err) return send(c, { t: 'autherr', msg: err });
      audit.log('cuenta.contraseña', { actor: c.profile.id, ip: c.ip });
      send(c, { t: 'authok', msg: 'Contraseña cambiada' });
      sendProfile(c);
    });
  }
  if (msg.t === 'claim' || msg.t === 'look') {
    const err = msg.t === 'claim' ? rewards.claim(c.profile, String(msg.league)) : rewards.setLook(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    else if (msg.t === 'claim') audit.log('premio.liga', { actor: c.profile.id, ip: c.ip, league: String(msg.league) });
    store.save();
    return sendProfile(c);
  }
  // Misiones (recoger, cambiar, cofre), logros y medallas: lo recogido va en 'loot' para la animación
  if (msg.t === 'mission' && msg.a === 'refresh') return sendProfile(c);   // al acabar la cuenta atrás: misiones nuevas
  if (msg.t === 'mission' || msg.t === 'achclaim' || msg.t === 'badgeclaim' || msg.t === 'masteryclaim' || msg.t === 'daily' || msg.t === 'tutorial' || msg.t === 'treasure') {
    const r = msg.t === 'mission' && msg.a === 'claimAll' ? collectAll(c.profile, msg.scope)
      : msg.t === 'mission' ? missions.action(c.profile, msg)
      : msg.t === 'treasure' ? treasure.spin(c.profile, String(msg.id))
      : msg.t === 'daily' ? daily.claim(c.profile)
      : msg.t === 'tutorial' ? daily.claimTutorial(c.profile)
      : msg.t === 'achclaim' ? rewards.claimAchievement(c.profile, String(msg.id))
        : msg.t === 'masteryclaim' ? rewards.claimMastery(c.profile, msg.dex | 0, msg.i | 0)
          : rewards.claimBadge(c.profile, String(msg.region), msg.index | 0);
    if (r.error) send(c, { t: 'error', msg: r.error });
    else {
      if (r.loot) send(c, { t: 'loot', r: r.loot });
      audit.log('premio.' + (msg.t === 'mission' ? 'mision.' + msg.a : msg.t === 'achclaim' ? 'logro' : msg.t === 'masteryclaim' ? 'maestria' : msg.t === 'daily' ? 'diario' : msg.t === 'tutorial' ? 'tutorial' : msg.t === 'treasure' ? 'tesoro' : 'medalla'), { actor: c.profile.id, ip: c.ip,
        coins: r.loot ? r.loot.coins : -(r.cost || 0) });
      store.save();
    }
    return sendProfile(c);
  }
  if (msg.t === 'inboxread') { c.profile.inbox = []; store.save(); return sendProfile(c); }
  if (msg.t === 'story' && ['starter', 'team', 'buy', 'use', 'moves', 'sell', 'appearance', 'nick'].includes(msg.a)) {
    if (c.battle) return;
    const coins = c.profile.coins;
    const err = story.action(c.profile, msg);
    if (err) send(c, { t: 'error', msg: err });
    // Lo que mueve dinero o Pokémon queda apuntado (para investigar trampas o reclamaciones)
    else if (msg.a === 'nick') audit.log('pokemon.mote', { actor: c.profile.id, ip: c.ip, uid: msg.uid | 0, nick: (c.profile.mons.find(m => m.uid === (msg.uid | 0)) || {}).nick || '' });
    else if (['buy', 'sell'].includes(msg.a)) audit.log('tienda.' + msg.a, { actor: c.profile.id, ip: c.ip,
      item: typeof msg.item === 'string' ? msg.item.slice(0, 32) : undefined, uid: Number.isInteger(msg.uid) ? msg.uid : undefined,
      qty: Number.isInteger(msg.qty) ? msg.qty : undefined, coins: c.profile.coins - coins });
    return sendProfile(c);
  }
  if ((draining || maintenance) && starts(msg)) return send(c, { t: 'error', msg: draining ? DRAIN_MSG : MAINT_MSG });
  if (msg.t === 'story' && (msg.a === 'route' || msg.a === 'gym')) { if (!busy(c)) startStory(c, msg); return; }
  if (msg.t === 'practice') { if (!busy(c)) startPractice(c, msg); return; }
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

// La conexión pasa a usar otro perfil: el anterior se suelta (se guarda y deja de vigilarse)
function setProfile(c, p) {
  if (c.profile && c.profile !== p) store.release(c.profile);
  c.profile = p;
}

// El hash de la contraseña es asíncrono: mientras se calcula no se acepta otro login ni nada que
// cambie el perfil de la conexión; si se ha desconectado entretanto, se suelta el perfil.
async function auth(c, msg) {
  if (tooManyTries(c)) return send(c, { t: 'autherr', msg: 'Demasiados intentos: espera un minuto' });
  // Además del tope por conexión, por IP (abrir conexiones nuevas no da más intentos) y por cuenta
  if (!limits.authAttempt(c.ip)) {
    audit.logNoisy('limite.intentos', c.ip);
    return send(c, { t: 'autherr', msg: 'Demasiados intentos desde tu red: espera unos minutos' });
  }
  if (busy(c) || c.authing) return send(c, { t: 'autherr', msg: 'Termina antes lo que estás haciendo' });
  const user = typeof msg.user === 'string' ? msg.user.trim() : '';
  if (msg.t === 'login' && limits.userLocked(user)) {
    audit.logNoisy('cuenta.bloqueada', c.ip, { user: user.slice(0, 64) });
    return send(c, { t: 'autherr', msg: 'Demasiados intentos con esta cuenta: espera 15 minutos' });
  }
  if (msg.t === 'register' && !c.profile && !limits.newProfile(c.ip)) return send(c, { t: 'autherr', msg: 'Demasiados perfiles nuevos desde tu red: espera un rato' });
  c.authing = true;
  let r;
  try {
    r = msg.t === 'login' ? { p: await store.login(user, msg.pass) } : await store.register(c.profile, user, msg.pass);
  } finally { c.authing = false; }
  if (r.err) return send(c, { t: 'autherr', msg: r.err });
  if (!r.p) {
    limits.userFailed(user);
    audit.log('cuenta.fallo', { ip: c.ip, user: user.slice(0, 64) });
    return send(c, { t: 'autherr', msg: 'Usuario o contraseña incorrectos' });
  }
  if (!clients.has(c)) return store.release(r.p);
  if (store.banned(r.p)) { if (r.p !== c.profile) store.release(r.p); return refuseBanned(c, r.p); }
  audit.log(msg.t === 'login' ? 'cuenta.entra' : 'cuenta.registro', { actor: r.p.id, ip: c.ip, user: r.p.account.user });
  // Registrar el perfil actual (invitado) lo deja igual; entrar o registrar desde la portada lo cambia
  if (r.p !== c.profile) setProfile(c, r.p);
  else if (msg.t === 'login') store.release(r.p);   // ya lo tenía: que no cuente dos veces
  send(c, { t: 'authok', msg: msg.t === 'login' ? `¡Hola de nuevo, ${c.profile.name}!` : 'Cuenta creada: ya puedes entrar desde cualquier dispositivo' });
  sendProfile(c);
}

// ---------- Apagado ----------
// Al desplegar llega SIGTERM: se dejan de aceptar colas y combates nuevos, se esperan los combates
// y drafts en curso (como mucho DRAIN_MS; el hosting tiene que dar ese margen antes de matar el
// proceso) y se guardan los perfiles en el acto. Una segunda señal apaga sin esperar.
const DRAIN_MS = 5 * 60 * 1000;
const DRAIN_MSG = 'El servidor se va a actualizar: termina tu combate. En unos minutos podrás empezar otro.';
const MAINT_MSG = 'El servidor está en mantenimiento: ahora no se pueden empezar combates nuevos.';
const starts = msg => (msg.t === 'story' && (msg.a === 'route' || msg.a === 'gym')) || msg.t === 'practice'
  || (msg.t === 'tower' && msg.a === 'battle') || msg.t === 'queue';
let draining = false;

function shutdown() {
  if (draining) { store.flush(); process.exit(0); }
  draining = true;
  audit.log('servidor.para', { version: VERSION, online: [...clients].filter(c => c.profile).length });
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
  audit.log('servidor.arranca', { version: VERSION });
  // Limpieza de invitados abandonados: al arrancar y cada 6 h
  const purge = () => { const n = store.purgeGuests(); if (n) audit.log('sistema.invitados', { borrados: n, dias: store.GUEST_DAYS }); };
  purge();
  setInterval(purge, 6 * 3600e3).unref();
  return new Promise(resolve => server.listen(port, HOST, () => { console.log(`Servidor en http://localhost:${server.address().port}`); resolve(server); }));
}

module.exports = { start };
