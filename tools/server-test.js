// Prueba de integración del servidor por WebSocket: perfil, historia, tienda, objetos,
// combates (rendición), gimnasios en orden y clasificatoria con draft y ELO.
//   node tools/server-test.js        (arranca su propio servidor en un puerto libre)
const path = require('path');
const os = require('os');
const fs = require('fs');
const WebSocket = require('ws');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-test-'));
process.env.PROFILES_FILE = path.join(tmp, 'profiles.json');
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
  let err = a.wait('error'); a.send({ t: 'story', a: 'route', id: 'ruta1' });
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
  err = a.wait('error'); a.send({ t: 'story', a: 'gym', id: 'celeste' });
  ok((await err).msg.includes('anterior'), 'los gimnasios van en orden');
  err = a.wait('error'); a.send({ t: 'story', a: 'route', id: 'montemoon' });
  ok((await err).msg.includes('medallas'), 'ruta bloqueada sin medallas');

  // Combate en ruta y rendición
  let start1 = a.wait('start'); a.send({ t: 'story', a: 'route', id: 'ruta1' });
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
    const st = a2.wait('start'); a2.send({ t: 'story', a: 'route', id: 'ruta1' });
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
  prof.coins = 50000; prof.badges = 4; prof.mons[0].level = 15;
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
  const atkBefore = require('../public/shared.js').monStats(vitMon.dex, vitMon.level, vitMon.vit).atk;
  m = await a2.req({ t: 'story', a: 'use', item: 'proteina', uid: vitMon.uid });
  const vm = m.p.mons.find(x => x.uid === vitMon.uid);
  ok(vm.vit.atk === 1 && require('../public/shared.js').monStats(vm.dex, vm.level, vm.vit).atk > atkBefore && m.p.items.proteina === 2, 'Proteína: +1 dosis y sube el Ataque');
  require('../server/store.js').get(token).mons.find(x => x.uid === vitMon.uid).vit.atk = D.VIT_MAX;
  err = a2.wait('error'); a2.send({ t: 'story', a: 'use', item: 'proteina', uid: vitMon.uid });
  ok((await err).msg.includes('máximo'), 'las vitaminas tienen tope de dosis');
  const sellMon = m.p.mons.find(x => x.uid !== vitMon.uid);
  const coinsBefore = m.p.coins;
  m = await a2.req({ t: 'story', a: 'sell', uid: sellMon.uid });
  ok(m.p.coins === coinsBefore + D.sellPrice(sellMon) && !m.p.mons.some(x => x.uid === sellMon.uid), `vender un Pokémon da ${D.sellPrice(sellMon)} ₽ y lo quita`);
  err = a2.wait('error'); a2.send({ t: 'story', a: 'sell', uid: 999 });
  ok(!!(await err), 'vender un Pokémon inexistente da error');
  // Shiny y vitaminas llegan al combate (hitbox, velocidad y stats por Pokémon)
  const { Battle } = require('../server/battle.js');
  const tb = new Battle({ mode: 'practice', map: 'pradera', sides: [{ name: 'a', team: [{ dex: 25, level: 50, shiny: true, vit: { hp: 10, atk: 0, def: 0, spe: 4 } }] }, { name: 'b', team: [{ dex: 95, level: 50 }] }] });
  tb.stop();
  const pika = tb.sides[0].team[0], onix = tb.sides[1].team[0];
  ok(pika.shiny && pika.spdMult > 1 && pika.maxHp > require('../public/shared.js').monStats(25, 50).maxHp && pika.r < onix.r, 'shiny, vitaminas e hitbox por tamaño en el combate');
  ok(tb.startMsg(tb.sides[0]).sides[0].team[0].shiny === true && tb.startMsg(tb.sides[1]).sides[0].team[0].r === pika.r, 'el mensaje de inicio lleva shiny, velocidad e hitbox');
  err = a2.wait('error'); a2.send({ t: 'story', a: 'team', uids: [] });
  ok(!!(await err), 'el equipo no puede quedar vacío');

  // Resultado de victoria en gimnasio (aplicado directamente para no depender de jugar)
  const story = require('../server/story.js');
  const setup = story.battleSetup(prof, { a: 'gym', id: 'azulona' });
  ok(!setup.error && setup.index === 3, 'con 4 medallas se puede desafiar a Erika (4º gimnasio)');
  const fakeBattle = { sides: [{ team: setup.opts.sides[0].team.map(t => ({ ...t, fainted: false })), balls: null }, { team: setup.opts.sides[1].team.map(t => ({ level: t.level })) }] };
  const before = prof.badges;
  const reward = story.applyResult(prof, setup, { winner: 0 }, fakeBattle);
  ok(reward.won && reward.coins === D.GYMS[3].reward && reward.xp.length === prof.team.length, 'victoria en gimnasio da dinero y experiencia');
  ok(prof.badges === before, 'revancha de un gimnasio ya ganado no suma medalla');

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

  // Mensajes basura no tumban el servidor
  const g = new Client(port); await g.open();
  g.ws.send('no es json'); g.send({ t: 'in', mx: 'x', a: null }); g.send({ t: 'story', a: 'buy', id: { x: 1 } }); g.send({ foo: 1 });
  const hello = await g.req({ t: 'hello', name: '<script>alert(1)</script>'.repeat(3) });
  ok(hello.p.name.length <= 16, 'nombre recortado a 16 caracteres');

  console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
