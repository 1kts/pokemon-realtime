// Prueba de integración del servidor por WebSocket: perfil, historia, tienda, objetos,
// combates (rendición), gimnasios en orden, clasificatoria con draft y ELO, recompensas de
// liga y temporada, cuentas con usuario y contraseña, Torre Batalla y ladder.
//   node tools/server-test.js        (arranca su propio servidor en un puerto libre)
const path = require('path');
const os = require('os');
const fs = require('fs');
const WebSocket = require('ws');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-test-'));
process.env.DB_FILE = path.join(tmp, 'arena.db');
const { start } = require('../server/index.js');
const D = require('../public/data.js');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

class Client {
  constructor(port) {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.msgs = [];
    this.waiters = [];
    this.ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'snap') { this.lastSnap = m; return; }
      this.msgs.push(m);
      this.waiters = this.waiters.filter(w => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  open() { return new Promise(r => this.ws.on('open', r)); }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(t, pred = () => true, ms = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout esperando ' + t)), ms);
      this.waiters.push({ pred: m => m.t === t && pred(m), resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  async req(msg, t = 'profile') { const p = this.wait(t); this.send(msg); return p; }
}

(async () => {
  const server = await start(0);
  const port = server.address().port;

  // ---------- Perfil e historia ----------
  const a = new Client(port); await a.open();
  let m = await a.req({ t: 'hello', name: 'Rojo' });
  ok(m.p.name === 'Rojo' && m.p.coins === 500 && m.p.items.pokeball === 5, 'perfil nuevo con 500 ₽ y 5 Poké Balls');
  const token = m.p.token;
  let err = a.wait('error'); a.send({ t: 'story', a: 'route', id: 'k-ruta1' });
  ok((await err).msg.includes('inicial'), 'no se puede explorar sin inicial');
  m = await a.req({ t: 'story', a: 'starter', dex: 4 });
  ok(m.p.mons.length === 1 && m.p.mons[0].dex === 4 && m.p.team.length === 1, 'elige Charmander de inicial');
  ok(JSON.stringify(m.p.mons[0].moves) === JSON.stringify(D.defaultMoves(4, 5)) && m.p.mons[0].moves.length === 2, 'a Nv.5 sabe sus 2 primeros movimientos');
  err = a.wait('error'); a.send({ t: 'story', a: 'moves', uid: m.p.mons[0].uid, moves: ['ascuas', 'llamarada'] });
  ok((await err).msg.includes('no sabe'), 'no puede llevar un movimiento que no ha aprendido');
  m = await a.req({ t: 'story', a: 'moves', uid: m.p.mons[0].uid, moves: ['placaje', 'ascuas'] });
  ok(m.p.mons[0].moves[0] === 'placaje', 'reordenar sus movimientos');
  // Tope de nivel: sin medallas, la media del equipo de Brock
  const st0 = require('../server/store.js').get(m.p.token);
  st0.mons[0].level = D.levelCap(0); st0.items.caramelo = 1;
  err = a.wait('error'); a.send({ t: 'story', a: 'use', item: 'caramelo', uid: m.p.mons[0].uid });
  ok((await err).msg.includes('Tope'), `Caramelo Raro bloqueado en el tope (Nv.${D.levelCap(0)})`);
  const capRes = require('../server/story.js').applyResult(st0, { kind: 'route' }, { winner: 0 }, { sides: [{ team: [{ uid: st0.mons[0].uid, fainted: false }] }, { team: [{ level: 30 }] }] });
  ok(st0.mons[0].level === D.levelCap(0) && capRes.xp[0].capped, 'la experiencia no pasa del tope');
  st0.mons[0].level = 5; st0.items.caramelo = 0; st0.coins = 500;
  err = a.wait('error'); a.send({ t: 'story', a: 'starter', dex: 1 });
  ok((await err).msg.includes('Ya tienes'), 'no se puede elegir dos iniciales');
  err = a.wait('error'); a.send({ t: 'story', a: 'buy', id: 'superball' });
  ok((await err).msg.includes('medallas'), 'Super Ball bloqueada sin medallas');
  m = await a.req({ t: 'story', a: 'buy', id: 'pokeball', qty: 3 });
  ok(m.p.coins === 200 && m.p.items.pokeball === 8, 'comprar 3 Poké Balls');
  err = a.wait('error'); a.send({ t: 'story', a: 'buy', id: 'pokeball', qty: 5 });
  ok((await err).msg.includes('dinero'), 'no se puede comprar sin dinero');
  err = a.wait('error'); a.send({ t: 'story', a: 'gym', id: 'misty' });
  ok((await err).msg.includes('anterior'), 'los gimnasios van en orden');
  err = a.wait('error'); a.send({ t: 'story', a: 'route', id: 'k-ruta3' });
  ok((await err).msg.includes('medallas'), 'ruta bloqueada sin medallas');

  // Combate en ruta y rendición
  let start1 = a.wait('start'); a.send({ t: 'story', a: 'route', id: 'k-ruta1' });
  let s = await start1;
  ok(s.mode === 'wild' && s.sides[1].wild && s.balls.pokeball === 8, 'empieza un combate salvaje con las Balls del perfil');
  await new Promise(r => setTimeout(r, 300));
  ok(a.lastSnap && a.lastSnap.ps.length === 2, 'llegan instantáneas');
  let over = a.wait('over'); a.send({ t: 'forfeit' });
  m = await over;
  ok(m.winner === 1 && m.reward && m.reward.won === false, 'rendirse cuenta como derrota');
  m = await a.wait('profile');
  ok(m.p.coins === 200, 'perder no da dinero');

  // Reconexión con el token: mismo perfil
  a.ws.close();
  const a2 = new Client(port); await a2.open();
  m = await a2.req({ t: 'hello', token, name: 'Rojo' });
  ok(m.p.mons.length === 1 && m.p.items.pokeball === 8, 'el token recupera la partida');

  // Captura: un cliente que juega con las instantáneas (como el navegador), debilita al salvaje
  // y deja de atacar y le lanza Poké Balls cuando le quedan menos del 28 % de PS
  require('../server/store.js').get(token).mons[0].level = 12;
  require('../server/store.js').get(token).items.pokeball = 30;
  let captured = null;
  for (let attempt = 0; attempt < 6 && !captured; attempt++) {
    const st = a2.wait('start'); a2.send({ t: 'story', a: 'route', id: 'k-ruta1' });
    const sm = await st;
    const foeMax = sm.sides[1].team[0].maxHp;
    let seq = 0;
    const loop = setInterval(() => {
      const sn = a2.lastSnap;
      if (!sn || sn.state !== 'fight') return;
      const me = sn.ps[0], foe = sn.ps[1];
      if (foe.x === undefined) return;
      const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy);
      const low = foe.hp[0] / foeMax < 0.28;
      seq++;
      // Atacar a ritmo normal; con poca vida, acercarse y lanzar una Ball cada 0,8 s
      const want = low ? 120 : 220;
      const c = low ? (seq % 24 === 0 && d < 200 ? 5 : -1) : (seq % 4 === 0 ? 0 : -1);
      a2.send({ t: 'in', s: seq, mx: d > want ? dx / d : 0, my: d > want ? dy / d : 0, a: Math.atan2(dy, dx), tx: foe.x, ty: foe.y, c, sw: -1, ball: 'pokeball' });
    }, 1000 / 30);
    const end = await a2.wait('over', () => true, 120000);
    clearInterval(loop);
    if (end.captured) captured = end;
  }
  ok(!!captured && captured.reward && captured.reward.captured, 'capturar un Pokémon salvaje con una Poké Ball');
  m = await a2.wait('profile');
  ok(captured && m.p.mons.length === 2 && m.p.mons.some(x => x.dex === captured.captured.dex) && m.p.items.pokeball < 30, 'el capturado entra en el perfil y se gastan Balls');

  // Objetos: Caramelo Raro y evolución por nivel (manipulando el perfil en memoria)
  const store = require('../server/store.js');
  const prof = store.get(token);
  prof.coins = 50000; prof.prog = { kanto: 4, johto: 0 }; prof.badges = 4; prof.mons[0].level = 15;
  m = await a2.req({ t: 'story', a: 'buy', id: 'caramelo' });
  m = await a2.req({ t: 'story', a: 'use', item: 'caramelo', uid: m.p.mons[0].uid });
  ok(m.p.mons[0].level === 16 && m.p.mons[0].dex === 5, 'Caramelo Raro: Nv.16 y evoluciona a Charmeleon');
  m = await a2.req({ t: 'story', a: 'buy', id: 'poke133' });
  const eevee = m.p.mons.find(x => x.dex === 133);
  ok(eevee && m.p.team.includes(eevee.uid), 'comprar Eevee lo mete en el equipo');
  m = await a2.req({ t: 'story', a: 'buy', id: 'trueno' });
  m = await a2.req({ t: 'story', a: 'use', item: 'trueno', uid: eevee.uid });
  ok(m.p.mons.find(x => x.uid === eevee.uid).dex === 135 && m.p.items.trueno === 0, 'Piedra Trueno: Eevee -> Jolteon');
  err = a2.wait('error'); a2.send({ t: 'story', a: 'use', item: 'caramelo', uid: 999 });
  ok(!!(await err), 'usar objeto sobre un Pokémon inexistente da error');
  // Vitaminas: suben la estadística y tienen tope; venta: da dinero y quita el Pokémon
  m = await a2.req({ t: 'story', a: 'buy', id: 'proteina', qty: 3 });
  const vitMon = m.p.mons[0];
  const atkBefore = require('../public/shared.js').monStats(vitMon.dex, vitMon.level, vitMon).atk;
  m = await a2.req({ t: 'story', a: 'use', item: 'proteina', uid: vitMon.uid });
  const vm = m.p.mons.find(x => x.uid === vitMon.uid);
  ok(vm.ev.atk === (vitMon.ev ? vitMon.ev.atk : 0) + D.EV_VIT && require('../public/shared.js').monStats(vm.dex, vm.level, vm).atk > atkBefore && m.p.items.proteina === 2 && vm.nat && vm.iv, 'Proteína: +10 EV de Ataque y sube el Ataque (con IV y naturaleza)');
  require('../server/store.js').get(token).mons.find(x => x.uid === vitMon.uid).ev.atk = D.EV_MAX;
  err = a2.wait('error'); a2.send({ t: 'story', a: 'use', item: 'proteina', uid: vitMon.uid });
  ok((await err).msg.includes('máximo'), 'los EV tienen tope por estadística');
  const sellMon = m.p.mons.find(x => x.uid !== vitMon.uid);
  const coinsBefore = m.p.coins;
  m = await a2.req({ t: 'story', a: 'sell', uid: sellMon.uid });
  ok(m.p.coins === coinsBefore + D.sellPrice(sellMon) && !m.p.mons.some(x => x.uid === sellMon.uid), `vender un Pokémon da ${D.sellPrice(sellMon)} ₽ y lo quita`);
  err = a2.wait('error'); a2.send({ t: 'story', a: 'sell', uid: 999 });
  ok(!!(await err), 'vender un Pokémon inexistente da error');
  // Shiny y vitaminas llegan al combate (hitbox, velocidad y stats por Pokémon)
  const { Battle } = require('../server/battle.js');
  const tb = new Battle({ mode: 'practice', map: 'pradera', sides: [{ name: 'a', team: [{ dex: 25, level: 50, shiny: true, ev: { hp: 252, atk: 0, def: 0, spe: 100 }, nat: 'alegre' }] }, { name: 'b', team: [{ dex: 95, level: 50 }] }] });
  tb.stop();
  const pika = tb.sides[0].team[0], onix = tb.sides[1].team[0];
  ok(pika.shiny && pika.spdMult > 1 && pika.maxHp > require('../public/shared.js').monStats(25, 50).maxHp && pika.r < onix.r, 'shiny, vitaminas e hitbox por tamaño en el combate');
  ok(tb.startMsg(tb.sides[0]).sides[0].team[0].shiny === true && tb.startMsg(tb.sides[1]).sides[0].team[0].r === pika.r, 'el mensaje de inicio lleva shiny, velocidad e hitbox');
  err = a2.wait('error'); a2.send({ t: 'story', a: 'team', uids: [] });
  ok(!!(await err), 'el equipo no puede quedar vacío');

  // Resultado de victoria en gimnasio (aplicado directamente para no depender de jugar)
  const story = require('../server/story.js');
  const setup = story.battleSetup(prof, { a: 'gym', id: 'erika' });
  ok(!setup.error && setup.index === 3, 'con 4 medallas se puede desafiar a Erika (4º gimnasio)');
  const fakeBattle = { sides: [{ team: setup.opts.sides[0].team.map(t => ({ ...t, fainted: false })), balls: null }, { team: setup.opts.sides[1].team.map(t => ({ level: t.level })) }] };
  const before = prof.prog.kanto;
  const reward = story.applyResult(prof, setup, { winner: 0 }, fakeBattle);
  ok(reward.won && reward.coins === Math.round(D.NODES.erika.reward / 2) && reward.xp.length === prof.team.length, 'revancha en gimnasio: la mitad del dinero y experiencia');
  ok(prof.prog.kanto === before, 'revancha de un gimnasio ya ganado no suma medalla');
  // Regiones: los Pokémon no viajan; Johto empieza con su propio inicial y su tope
  const noJohto = story.battleSetup(prof, { a: 'gym', id: 'falkner' });
  ok(noJohto.error && noJohto.error.includes('Johto'), 'sin Pokémon de Johto no se puede combatir allí');
  ok(story.action(prof, { a: 'starter', dex: 4, region: 'johto' }) === 'Inicial no válido', 'en Johto solo se eligen los iniciales de Johto');
  ok(story.action(prof, { a: 'starter', dex: 155, region: 'johto' }) === null && prof.teams.johto.length === 1, 'eliges Cyndaquil como inicial de Johto');
  ok(story.action(prof, { a: 'team', uids: [prof.teams.johto[0], prof.teams.kanto[0]], region: 'johto' }) !== null, 'no se mezclan Pokémon de regiones en un equipo');
  ok(D.levelCap(prof, 'johto') === 11 && D.levelCap(prof, 'kanto') > 11, 'el tope de nivel va por región');
  // Primera victoria contra un líder de Johto: medalla de Johto y premio
  const jset = story.battleSetup(prof, { a: 'gym', id: 'falkner' });
  ok(jset.opts && jset.opts.sides[0].team.every(t => prof.mons.find(m => m.uid === t.uid).region === 'johto'), 'contra Pegaso solo salen tus Pokémon de Johto');
  ok(!jset.error && jset.region === 'johto' && jset.opts.sides[1].team.length === 2, 'Pegaso (Johto) con su equipo real');
  const jfake = { sides: [{ team: jset.opts.sides[0].team.map(t => ({ ...t, fainted: false })), balls: null }, { team: jset.opts.sides[1].team.map(t => ({ dex: t.dex, level: t.level })) }] };
  const items0 = prof.items.caramelo || 0;
  const jr = story.applyResult(prof, jset, { winner: 0 }, jfake);
  ok(prof.prog.johto === 1 && jr.badge && jr.badge.region === 'johto' && (prof.items.caramelo || 0) === items0 + 1, 'vencer a Pegaso da la Medalla Céfiro y premios');
  const jroute = story.battleSetup(prof, { a: 'route', id: 'j-ruta32' });
  ok(!jroute.error && D.NODES['j-ruta32'].wild.some(w => w[0] === jroute.opts.sides[1].team[0].dex || D.routeWild(D.NODES['j-ruta32']).rare.dex === jroute.opts.sides[1].team[0].dex), 'la Ruta 32 saca un Pokémon de sus encuentros reales');

  // ---------- Clasificatoria con draft ----------
  const b = new Client(port), c = new Client(port);
  await b.open(); await c.open();
  await b.req({ t: 'hello', name: 'Azul' }); await c.req({ t: 'hello', name: 'Verde' });
  const db = b.wait('draft'), dc = c.wait('draft');
  b.send({ t: 'queue', mode: 'ranked' }); c.send({ t: 'queue', mode: 'ranked' });
  const [d1] = await Promise.all([db, dc]);
  ok(d1.phase === 'ban' && d1.pool.length === D.RANKED_POOL.length, 'emparejados: fase de veto');
  const pb = b.wait('draft', x => x.phase === 'pick'), pc = c.wait('draft', x => x.phase === 'pick');
  b.send({ t: 'ban', dex: 149 }); c.send({ t: 'ban', dex: 65 });
  const [p1] = await Promise.all([pb, pc]);
  ok(p1.bans.includes(149) && p1.bans.includes(65), 'fase de elección con los vetos');
  b.send({ t: 'pick', dexes: [149, 6, 9] });
  c.send({ t: 'pick', dexes: [6, 9, 3] });
  const sb = b.wait('start'), sc = c.wait('start');
  b.send({ t: 'pick', dexes: [6, 9, 3] });   // reintento válido tras uno con un vetado
  const [st] = await Promise.all([sb, sc]);
  ok(st.mode === 'ranked' && st.sides[0].team.every(t => t.level === 50) && !st.sides.some(x => x.team.some(t => t.dex === 149)), 'combate a nivel 50 sin Pokémon vetados');
  const ob = b.wait('over'), oc = c.wait('over');
  c.send({ t: 'forfeit' });
  const [r1, r2] = await Promise.all([ob, oc]);
  const bWon = r1.winner === r1.you;
  ok(bWon && r1.reward.elo > 0 && r2.reward.elo === -r1.reward.elo, `ELO: ganador +${r1.reward.elo}, perdedor ${r2.reward.elo}`);
  ok(r1.reward.coins === D.RANKED_PAY.win + D.RANKED_PAY.firstWin && r1.reward.firstWin && r2.reward.coins === D.RANKED_PAY.loss, 'clasificatoria: dinero por combate y extra por la primera victoria del día');
  m = await b.wait('profile');
  ok(m.p.history.length === 1 && m.p.history[0].won && m.p.history[0].foe === 'Verde' && m.p.history[0].team.length === 3 && m.rank === 1, 'historial de clasificatorias y puesto en el ranking');
  ok(m.board[0].name === 'Azul' && !('account' in m.board[0]) && !('token' in m.board[0]), 'el ranking no filtra datos privados');

  // ---------- Recompensas de liga y temporada ----------
  const seasonMod = require('../server/rewards.js');
  const bp = store.get(m.p.token);
  m = await b.req({ t: 'claim', league: 'Plata' });
  ok(m.p.coins === bp.coins && !m.p.season.claimed.includes('Plata'), 'no se puede reclamar una liga no alcanzada');
  bp.elo = 1260; seasonMod.afterRanked(bp, { won: true, delta: 0, foe: 'X', foeElo: 1000, team: [], foeTeam: [] });
  const oroCoins0 = bp.coins, ultra0 = bp.items.ultraball || 0;
  m = await b.req({ t: 'claim', league: 'Oro' });
  ok(m.p.coins === oroCoins0 + D.RANKED_REWARDS.Oro.coins && m.p.items.ultraball === ultra0 + 5 && m.p.cosmetics.titles.includes('Estratega') && m.p.cosmetics.frames.includes('oro'), 'reclamar Oro: dinero, objetos, título y marco');
  m = await b.req({ t: 'claim', league: 'Oro' });
  ok(m.p.coins === oroCoins0 + D.RANKED_REWARDS.Oro.coins, 'cada liga se reclama una sola vez por temporada');
  m = await b.req({ t: 'look', title: 'Estratega', frame: 'oro' });
  ok(m.p.title === 'Estratega' && m.p.frame === 'oro' && m.board[0].title === 'Estratega', 'equipar título y marco (se ven en el ranking)');
  m = await b.req({ t: 'look', title: 'Maestro de la Arena' });
  ok(m.p.title === 'Estratega', 'no se puede equipar un título bloqueado');
  m = await b.req({ t: 'look', avatar: 1 });
  ok(!m.p.avatar, 'el avatar tiene que ser un Pokémon atrapado');
  // Fin de temporada (simulado subiendo el id)
  const sid = D.SEASON.id, coins1 = bp.coins;
  D.SEASON.id = sid + 1;
  seasonMod.migrate(bp);
  ok(bp.season.id === sid + 1 && bp.coins === coins1 + D.SEASON_REWARDS.Oro && bp.cosmetics.titles.includes(D.seasonTitle('Oro', sid)) && bp.elo === 1130 && bp.inbox.length === 1 && !bp.season.claimed.length, 'fin de temporada: premio por la mejor liga, título, ELO a mitad hacia 1000');
  D.SEASON.id = sid;
  m = await b.req({ t: 'inboxread' });
  ok(m.p.inbox.length === 0, 'el aviso de fin de temporada se marca como leído');

  // ---------- Cuentas ----------
  const ua = new Client(port); await ua.open();
  ok(ua.msgs.some(x => x.t === 'welcome' && x.version === require('../package.json').version), 'al conectar el servidor dice su versión');
  ok(require('../public/changelog.js')[0].v === require('../package.json').version, 'la primera nota de versión coincide con package.json');
  m = await ua.req({ t: 'hello', name: 'Invitado' });
  const guestToken = m.p.token;
  ok(m.p.account === null, 'un perfil nuevo es de invitado');
  m = await ua.req({ t: 'register', user: 'ab', pass: '123456' }, 'autherr');
  ok(/usuario/i.test(m.msg), 'usuario demasiado corto');
  m = await ua.req({ t: 'register', user: 'rojo_1', pass: '123' }, 'autherr');
  ok(/contraseña/i.test(m.msg), 'contraseña demasiado corta');
  m = await ua.req({ t: 'register', user: 'Rojo_1', pass: 'pikachu' });
  ok(m.p.account && m.p.account.user === 'Rojo_1' && m.p.token === guestToken && !m.p.account.hash && !m.p.account.salt, 'registrar conserva el perfil de invitado y no envía el hash');
  const raw = JSON.parse(JSON.stringify(store.get(guestToken)));
  ok(raw.account.hash && raw.account.hash !== 'pikachu', 'la contraseña se guarda cifrada');
  const ub = new Client(port); await ub.open();
  m = await ub.req({ t: 'register', user: 'rojo_1', pass: 'otraclave' }, 'autherr');
  ok(/existe/.test(m.msg), 'no se repite usuario (sin distinguir mayúsculas)');
  m = await ub.req({ t: 'login', user: 'rojo_1', pass: 'mala' }, 'autherr');
  ok(/incorrectos/.test(m.msg), 'contraseña incorrecta');
  m = await ub.req({ t: 'login', user: 'ROJO_1', pass: 'pikachu' });
  ok(m.p.token === guestToken, 'iniciar sesión desde otro dispositivo recupera el mismo perfil');
  m = await ub.req({ t: 'passwd', old: 'mala', pass: 'raichu1' }, 'autherr');
  ok(/actual/.test(m.msg), 'cambiar contraseña pide la actual');
  await ub.req({ t: 'passwd', old: 'pikachu', pass: 'raichu1' });
  ok(await store.login('rojo_1', 'raichu1') && !await store.login('rojo_1', 'pikachu'), 'contraseña cambiada');
  const uc = new Client(port); await uc.open();
  m = await uc.req({ t: 'register', user: 'Nuevo', pass: 'abcdef' });
  ok(m.p.name === 'Nuevo' && m.p.account.user === 'Nuevo' && m.p.coins === 500, 'registrarse desde la portada crea un perfil nuevo');
  const ue = new Client(port); await ue.open();
  m = await ue.req({ t: 'register', user: 'ash.ketchum@pueblo-paleta.com', pass: 'pikachu' });
  ok(m.p.account.user === 'ash.ketchum@pueblo-paleta.com' && m.p.name === 'ash.ketchum', 'registrarse con un correo; el nombre de entrenador es lo de antes de la @');
  ok(!!await store.login('ASH.KETCHUM@pueblo-paleta.com', 'pikachu'), 'entrar con el correo (sin distinguir mayúsculas)');
  ok(!store.ladder('dex').rows.concat(store.ladder('ranked').rows).some(r => JSON.stringify(r).includes('@pueblo')) && !JSON.stringify(store.publicUser(m.p.id)).includes('@pueblo'), 'el correo no sale en la ladder ni en la ficha pública');
  m = await ue.req({ t: 'register', user: 'no es un correo@', pass: 'pikachu' }, 'autherr');
  ok(/usuario/i.test(m.msg), 'usuario no válido');
  const limited = uc.wait('autherr', x => /intentos/.test(x.msg));
  for (let i = 0; i < 8; i++) uc.send({ t: 'login', user: 'Nuevo', pass: 'x' });
  uc.send({ t: 'login', user: 'Nuevo', pass: 'abcdef' });
  ok(!!(await limited), 'límite de intentos de contraseña');
  const hz = await new Promise(r => require('http').get(`http://localhost:${port}/healthz`, res => { let d = ''; res.on('data', x => { d += x; }); res.on('end', () => r(JSON.parse(d))); }));
  ok(hz.ok && hz.version === require('../package.json').version, '/healthz responde con la versión');

  // Desconexión durante el draft
  const e1 = new Client(port), e2 = new Client(port);
  await e1.open(); await e2.open();
  await e1.req({ t: 'hello', name: 'X' }); await e2.req({ t: 'hello', name: 'Y' });
  const de = e2.wait('draft');
  e1.send({ t: 'queue', mode: 'casual' }); e2.send({ t: 'queue', mode: 'casual' });
  const dd = await de;
  ok(dd.phase === 'pick', 'partida rápida: sin fase de veto');
  const cancel = e2.wait('cancelled');
  e1.ws.close();
  ok(!!(await cancel), 'si el rival se va durante el draft, se cancela');

  // ---------- Torre Batalla ----------
  const tower = require('../server/tower.js');
  const tw = new Client(port); await tw.open();
  m = await tw.req({ t: 'hello', name: 'Torre' });
  const twProf = store.get(m.p.token);
  ok(m.p.tower && m.p.tower.streak === 0 && m.p.tower.best === 0 && !m.p.tower.team, 'perfil con Torre vacía');
  err = tw.wait('error'); tw.send({ t: 'tower', a: 'start', team: [{ dex: 6 }, { dex: 9 }] });
  ok((await err).msg.includes('3'), 'la Torre pide 3 Pokémon');
  err = tw.wait('error'); tw.send({ t: 'tower', a: 'start', team: [{ dex: 6 }, { dex: 6 }, { dex: 9 }] });
  ok((await err).msg.includes('especie'), 'no se repite especie');
  const legend = story.devAddMon(twProf, 150, 70, false, 'kanto');
  err = tw.wait('error'); tw.send({ t: 'tower', a: 'start', team: [{ uid: legend.uid }, { dex: 9 }, { dex: 3 }] });
  ok((await err).msg.includes('legendarios'), 'los legendarios no entran');
  const low = story.devAddMon(twProf, 4, 5, false, 'kanto');
  m = await tw.req({ t: 'tower', a: 'start', team: [{ uid: low.uid }, { dex: 9 }, { dex: 3 }] });
  ok(m.p.tower.team.length === 3 && m.p.tower.streak === 0 && m.p.tower.next.team.length === 3 && m.p.tower.block === 1, 'empieza la racha con uno propio y dos de alquiler; ya se ve el siguiente rival');
  err = tw.wait('error'); tw.send({ t: 'tower', a: 'start', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
  ok((await err).msg.includes('retírate'), 'con racha en curso no se cambia de equipo');
  m = await tw.req({ t: 'tower', a: 'order', order: [2, 0, 1] });
  ok(m.p.tower.team[0].dex === 3 && m.p.tower.team[1].uid === low.uid, 'reordenar el equipo entre combates');
  err = tw.wait('error'); tw.send({ t: 'story', a: 'release', uid: low.uid });
  ok((await err).msg.includes('Torre'), 'no se libera un Pokémon del equipo de la Torre');
  const foeTeam = m.p.tower.next.team;
  let tstart = tw.wait('start'); tw.send({ t: 'tower', a: 'battle' });
  s = await tstart;
  ok(s.mode === 'tower' && s.sides.every(x => x.team.every(t => t.level === 50)) && s.sides[0].team[1].moves.length === 4, 'combate de Torre: todos a Nv.50 (el Charmander Nv.5 también, con 4 movimientos)');
  ok(JSON.stringify(s.sides[1].team.map(t => t.dex)) === JSON.stringify(foeTeam), 'el rival es el que se enseñaba en silueta');
  over = tw.wait('over'); tw.send({ t: 'forfeit' });
  m = await over;
  ok(m.reward.tower && m.reward.tower.ended && m.reward.tower.streak === 0, 'rendirse en la Torre termina la racha');
  m = await tw.wait('profile');
  ok(!m.p.tower.team && m.p.tower.streak === 0, 'tras perder, sin equipo ni racha');
  // Racha larga aplicando resultados (sin jugar): bloques, premios, Cerebro de la Frontera y récord
  ok(tower.action(twProf, { a: 'start', team: [{ uid: low.uid }, { dex: 9 }, { dex: 3 }] }) === null, 'nueva racha');
  const coins0 = twProf.coins, candy0 = twProf.items.caramelo || 0, lvl0 = low.level;
  const firstAi = tower.battleSetup(twProf).foe.ai;
  let rw;
  for (let i = 0; i < 7; i++) rw = tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 0 });
  const v7 = tower.view(twProf);
  ok(v7.streak === 7 && v7.best === 7 && v7.block === 2 && v7.next.ai > firstAi && rw.tower.blockUp === 2, '7 victorias: bloque 2 con IA más lista');
  ok(rw.items && rw.items.caramelo === 1 && Object.keys(rw.items).some(k => D.SHOP.find(x => x.id === k && x.vit)) && twProf.coins > coins0 && twProf.items.caramelo === candy0 + 1, 'premio de bloque: dinero, Caramelo Raro y vitamina');
  ok(low.level === lvl0, 'la Torre no da experiencia: no se salta el tope de nivel');
  for (let i = 0; i < 13; i++) tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 0 });
  const brainSetup = tower.battleSetup(twProf);
  ok(brainSetup.foe.n === 21 && brainSetup.foe.brain && JSON.stringify(brainSetup.foe.team) === JSON.stringify(tower.BRAINS.plata.team), 'combate 21: Cerebro de la Frontera con su equipo fijo');
  rw = tower.applyResult(twProf, brainSetup, { winner: 0 });
  ok(rw.tower.symbol === 'Símbolo Plata' && twProf.tower.symbols.includes('Símbolo Plata') && twProf.tower.best === 21, 'vencer al Cerebro da el Símbolo Plata');
  rw = tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 1 });
  ok(rw.tower.ended && twProf.tower.streak === 0 && !twProf.tower.team && twProf.tower.best === 21, 'perder resetea la racha pero guarda el récord');
  // Retirarse guarda la racha
  tower.action(twProf, { a: 'start', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
  tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 0 });
  m = await tw.req({ t: 'tower', a: 'retire' });
  ok(!m.p.tower.team && m.p.tower.best === 21 && m.p.tower.runs === 3, 'retirarse termina la racha sin tocar el récord');

  // ---------- Ladder ----------
  tower.action(store.get(token), { a: 'start', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
  for (let i = 0; i < 3; i++) tower.applyResult(store.get(token), tower.battleSetup(store.get(token)), { winner: 0 });
  let lad = await tw.req({ t: 'ladder', board: 'tower' }, 'ladder');
  ok(lad.rows.length >= 2 && lad.rows[0].name === 'Torre' && lad.rows[0].best === 21 && lad.rows[0].online && lad.me.rank === 1, 'ladder de la Torre ordenada por mejor racha, con quién está en línea');
  ok(lad.rows.find(r => r.name === 'Rojo').streak === 3, 'la ladder enseña la racha en curso');
  lad = await tw.req({ t: 'ladder', board: 'ranked' }, 'ladder');
  ok(lad.rows.length === 2 && lad.rows[0].elo > lad.rows[1].elo && !lad.me, 'ladder de clasificatoria por ELO (sin quien no ha jugado)');
  lad = await tw.req({ t: 'ladder', board: 'dex', q: 'roj' }, 'ladder');
  ok(lad.rows.length === 1 && lad.rows[0].name === 'Rojo' && lad.found === 1 && lad.total > 1, 'buscar entrenador por nombre');
  const u = await tw.req({ t: 'user', id: lad.rows[0].id }, 'user');
  ok(u.u && u.u.name === 'Rojo' && u.u.tower.streak === 3 && u.u.caught > 0 && !('token' in u.u) && !JSON.stringify(u.u).includes(token), 'ficha pública de un entrenador sin su token');
  const nobody = await tw.req({ t: 'user', id: 'nadie' }, 'user');
  ok(nobody.u === null, 'ficha de un id inexistente');

  // Mensajes basura no tumban el servidor
  const g = new Client(port); await g.open();
  g.ws.send('no es json'); g.send({ t: 'in', mx: 'x', a: null }); g.send({ t: 'story', a: 'buy', id: { x: 1 } }); g.send({ foo: 1 });
  const hello = await g.req({ t: 'hello', name: '<script>alert(1)</script>'.repeat(3) });
  ok(hello.p.name.length <= 16, 'nombre recortado a 16 caracteres');

  console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
