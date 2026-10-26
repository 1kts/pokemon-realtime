// Prueba de integración del servidor por WebSocket: perfil, historia, tienda, objetos,
// combates (rendición), gimnasios en orden, clasificatoria con draft y ELO, recompensas de
// liga y temporada, cuentas con usuario y contraseña, con Google y con código por correo, Torre Batalla y ladder.
//   node tools/server-test.js        (arranca su propio servidor en un puerto libre)
const path = require('path');
const os = require('os');
const fs = require('fs');
const WebSocket = require('ws');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-test-'));
process.env.DB_FILE = path.join(tmp, 'arena.db');
process.env.ARENA_NPCS = '0';   // sin entrenadores IA: estas pruebas miran el ranking con jugadores concretos
// Entrar con el correo y con Google: los correos se quedan en memoria y los tokens de «Google» los firma una
// clave de prueba (su parte pública hace de claves de Google)
const crypto = require('crypto');
const googleKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.MAIL_TEST = '1';
process.env.GOOGLE_CLIENT_ID = 'prueba.apps.googleusercontent.com';
process.env.GOOGLE_TEST_JWKS = JSON.stringify({ keys: [{ ...googleKey.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] });
function googleToken(claims = {}, key = googleKey.privateKey, kid = 'k1') {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = b64({ alg: 'RS256', kid, typ: 'JWT' }) + '.' + b64({ iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: '1001',
    email: 'misty@example.com', email_verified: true, iat: now, exp: now + 3600, ...claims });
  return data + '.' + crypto.sign('RSA-SHA256', Buffer.from(data), key).toString('base64url');
}
const { start } = require('../server/index.js');
const D = require('../public/data.js');

let failures = 0;
// Nunca colgado (bloquearía el push): como mucho 5 minutos
setTimeout(() => { console.log('✗ server-test: más de 5 minutos, algo se ha quedado esperando'); process.exit(1); }, 5 * 60e3).unref();
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

class Client {
  constructor(port) {
    this.ws = new WebSocket(`ws://localhost:${port}`);
    this.opened = new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('close', () => reject(new Error('el servidor cerró la conexión antes de abrirla')));
    });
    this.opened.catch(() => {});
    this.msgs = [];
    this.waiters = [];
    this.ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'snap') { this.lastSnap = m; return; }
      this.msgs.push(m);
      this.waiters = this.waiters.filter(w => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  // Se escucha desde que se crea la conexión: si se esperase a llamar a open(), una conexión que se abre
  // mientras se espera a otra perdería el evento y el test se quedaría colgado
  open() { return this.opened; }
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
  // Motes: se guardan limpios y con 12 caracteres como mucho, pasan el filtro y vacíos se quitan
  const uid0 = m.p.mons[0].uid;
  m = await a.req({ t: 'story', a: 'nick', uid: uid0, nick: '  Chispas\u200b el grande  ' });
  ok(m.p.mons[0].nick === 'Chispas el g', 'ponerle mote: sin invisibles ni espacios de más y como mucho 12 caracteres');
  err = a.wait('error'); a.send({ t: 'story', a: 'nick', uid: uid0, nick: 'P.u.t.4' });
  ok((await err).msg.includes('mote no está permitido'), 'un mote ofensivo (aunque lo disimule) no se acepta');
  err = a.wait('error'); a.send({ t: 'story', a: 'nick', uid: 9999, nick: 'Otro' });
  ok((await err).msg.includes('no es tuyo'), 'no se le pone mote a un Pokémon que no es tuyo');
  m = await a.req({ t: 'story', a: 'nick', uid: uid0, nick: '' });
  ok(m.p.mons[0].nick === undefined, 'un mote vacío lo quita');
  m = await a.req({ t: 'story', a: 'nick', uid: uid0, nick: 'Chispas' });
  // Nombre de entrenador: el filtro vale para cambiarlo y para los perfiles nuevos
  err = a.wait('error'); a.send({ t: 'name', name: 'HijoDePuta' });
  ok((await err).msg.includes('nombre no está permitido'), 'no se puede cambiar el nombre a uno ofensivo');
  err = a.wait('error'); a.send({ t: 'name', name: 'Admin' });
  ok((await err).msg.includes('nombre no está permitido'), 'ni hacerse pasar por el equipo del juego');
  m = await a.req({ t: 'name', name: 'Rojo  Fuego' });
  ok(m.p.name === 'Rojo Fuego', 'un nombre normal sí se cambia');
  m = await a.req({ t: 'name', name: 'Rojo' });
  const rude = new Client(port); await rude.open();
  err = rude.wait('error'); rude.send({ t: 'hello', name: 'fuck you' });
  ok((await err).msg.includes('nombre no está permitido'), 'un invitado nuevo con nombre ofensivo no se crea');
  ok((await rude.req({ t: 'hello', name: 'Gary' })).p.name === 'Gary', 'y con otro nombre entra');
  rude.ws.close();
  const N = require('../server/names.js');
  const missed = ['puta', 'PUUUTA', 'Pütá', 'p u t a', 'рuta', 'nigg3r', 'Hitler88', 'sieg heil', 'g.i.l.i.p.o.l.l.a.s', 'cazzo', 'scheiße', '씨발', '傻逼', '死ね'].filter(x => N.allowed(x));
  ok(!missed.length, `el filtro pilla insultos con trucos y en otros idiomas${missed.length ? ' (se escapan: ' + missed.join(', ') + ')' : ''}`);
  const caught = ['Rojo', 'Pola', 'Computadora', 'Badminton', 'Cazorla', 'Ignazio', 'Therapist', 'Scunthorpe', 'Assassin', 'Cocktail', 'Shitake', 'Isis', 'Pikachu 99'].filter(x => !N.allowed(x));
  ok(!caught.length, `y deja pasar los nombres normales que contienen esas letras${caught.length ? ' (bloquea: ' + caught.join(', ') + ')' : ''}`);
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
  ok(s.sides[0].team[0].nick === 'Chispas', 'en combate su Pokémon lleva el mote');
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
  const pub = await a2.req({ t: 'user', id: m.p.id }, 'user');
  ok(pub.u.team[0].nick === 'Chispas' && pub.u.name === 'Rojo', 'su perfil público enseña el mote');

  // Captura: un cliente que juega con las instantáneas (como el navegador), debilita al salvaje
  // y deja de atacar y le lanza Poké Balls cuando le quedan menos del 28 % de PS
  require('../server/store.js').get(token).mons[0].level = 12;
  require('../server/store.js').get(token).items.pokeball = 30;
  let captured = null;
  for (let attempt = 0; attempt < 6 && !captured; attempt++) {
    const st = a2.wait('start'); a2.send({ t: 'story', a: 'route', id: 'k-ruta1' });
    const sm = await st;
    const foeMax = sm.sides[1].team[0].maxHp;
    let seq = 0, lowT = 0;
    const loop = setInterval(() => {
      const sn = a2.lastSnap;
      if (!sn || sn.state !== 'fight') return;
      const me = sn.ps[0], foe = sn.ps[1];
      if (foe.x === undefined) return;
      const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy);
      // Si tras 20 s de Balls no cae, se vuelve a atacar para acabar el combate y probar con otro
      // (si no, con mala suerte el combate no acaba nunca y el test se cuelga)
      const low = foe.hp[0] / foeMax < 0.28 && ++lowT < 600;
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
  // Pokémon del día de la tienda: IV perfectos, al tope de nivel y solo uno por día
  const daily = D.shopMons()[0];
  prof.coins = 200000;
  m = await a2.req({ t: 'story', a: 'buy', id: daily.id });
  const bought = m.p.mons.find(x => x.dex === daily.dex);
  ok(bought && D.STAT_KEYS.every(k => bought.iv[k] === D.IV_MAX) && bought.level === D.levelCap(prof, 'kanto'), 'Pokémon del día: IV perfectos y al tope de nivel');
  err = a2.wait('error'); a2.send({ t: 'story', a: 'buy', id: daily.id });
  ok(!!(await err), 'el Pokémon del día solo se compra una vez al día');
  // Con el Campeón vencido el tope pasa a 100, pero los de la tienda llegan a Nv.50
  const daily2 = D.shopMons()[1], prog0 = prof.prog.kanto, badges0 = prof.badges;
  prof.prog.kanto = D.leadersOf('kanto').length; prof.badges = 8;
  m = await a2.req({ t: 'story', a: 'buy', id: daily2.id });
  ok(D.shopLevel(prof, 'kanto') === 50 && m.p.mons.some(x => x.dex === daily2.dex && x.level === 50), 'tras vencer al Campeón, los Pokémon de la tienda llegan a Nv.50');
  prof.prog.kanto = prog0; prof.badges = badges0;
  ok(D.shopMons('2030-01-01').map(i => i.dex).join() !== D.shopMons('2030-01-02').map(i => i.dex).join(), 'los Pokémon de la tienda cambian cada día');
  require('../server/story.js').devAddMon(prof, 133, 20, false, 'kanto');
  m = await a2.req({ t: 'story', a: 'buy', id: 'trueno' });
  const eevee = m.p.mons.find(x => x.dex === 133);
  ok(!!eevee, 'Eevee añadido para probar las piedras');
  m = await a2.req({ t: 'story', a: 'use', item: 'trueno', uid: eevee.uid });
  ok(m.p.mons.find(x => x.uid === eevee.uid).dex === 135 && m.p.items.trueno === 0, 'Piedra Trueno: Eevee -> Jolteon');
  // Evoluciones por intercambio: con el Cordón Unión (Haunter -> Gengar) o con su objeto (Onix -> Steelix);
  // subir de nivel ya no las hace evolucionar
  const storyMod = require('../server/story.js');
  storyMod.devAddMon(prof, 93, 45, false, 'kanto'); storyMod.devAddMon(prof, 95, 30, false, 'kanto'); storyMod.devAddMon(prof, 64, 44, false, 'kanto');
  prof.items.cordon = 1; prof.items.revestimiento = 1; prof.items.caramelo = 1;
  const [hau, onx, kad] = [93, 95, 64].map(d => prof.mons.find(x => x.dex === d));
  m = await a2.req({ t: 'story', a: 'use', item: 'cordon', uid: hau.uid });
  ok(m.p.mons.find(x => x.uid === hau.uid).dex === 94 && !m.p.items.cordon, 'Cordón Unión: Haunter -> Gengar (evoluciones por intercambio)');
  m = await a2.req({ t: 'story', a: 'use', item: 'revestimiento', uid: onx.uid });
  ok(m.p.mons.find(x => x.uid === onx.uid).dex === 208, 'Revestimiento Metálico: Onix -> Steelix');
  ok(!D.SHOP.find(i => i.id === 'cordon').desc.includes('Gengar') && D.SPECIES[64].evo.join() === '65,cordon', 'su descripción no dice para qué sirven y Kadabra ya no evoluciona por nivel');
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
  ok(!jroute.error && D.NODES['j-ruta32'].wild.some(w => w[0] === jroute.opts.sides[1].team[0].dex || D.routeWild(D.NODES['j-ruta32']).specials.concat(D.routeWild(D.NODES['j-ruta32']).roam.map(dex => ({ dex }))).some(x => x.dex === jroute.opts.sides[1].team[0].dex)), 'la Ruta 32 saca un Pokémon de sus encuentros reales');

  // ---------- Clasificatoria con draft ----------
  const b = new Client(port), c = new Client(port);
  await b.open(); await c.open();
  await b.req({ t: 'hello', name: 'Azul' }); await c.req({ t: 'hello', name: 'Verde' });
  // Solo las cuentas registradas salen en los rankings: Azul y Verde se registran (conservan el perfil)
  await b.req({ t: 'register', user: 'azul', pass: 'clave-azul' }); await c.req({ t: 'register', user: 'verde', pass: 'clave-verde' });
  // Sin draft: cada uno se prepara su equipo de 3 (con movimientos) y el rival es al azar
  let qe = b.wait('error'); b.send({ t: 'queue', mode: 'ranked' });
  ok(/Prepara antes tu equipo/.test((await qe).msg), 'sin equipo preparado no se puede buscar partida');
  qe = b.wait('error'); b.send({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 6 }, { dex: 9 }] });
  ok(/3 Pokémon distintos/.test((await qe).msg), 'el equipo son 3 Pokémon distintos del pool');
  m = await b.req({ t: 'pvpteam', team: [{ dex: 6, moves: ['lanzallamas', 'noExiste'] }, { dex: 9 }, { dex: 3 }] });
  ok(m.p.pvpTeam[0].moves.join() === 'lanzallamas' && m.p.pvpTeam[1].moves.length === 4, 'se guarda con los movimientos elegidos (solo los que sabe a Nv.50)');
  await c.req({ t: 'pvpteam', team: [{ dex: 149 }, { dex: 65 }, { dex: 94 }] });
  const sb = b.wait('start'), sc = c.wait('start');
  b.send({ t: 'queue', mode: 'ranked' }); c.send({ t: 'queue', mode: 'ranked' });
  const [st] = await Promise.all([sb, sc]);
  const mine = st.sides[st.you].team;
  ok(st.mode === 'ranked' && mine.every(x => x.level === 50) && mine.map(x => x.dex).join() === '6,9,3' && mine[0].moves.join() === 'lanzallamas', 'emparejados: el combate empieza ya, a Nv.50, con el equipo y los movimientos de cada uno');
  const ob = b.wait('over'), oc = c.wait('over');
  c.send({ t: 'forfeit' });
  const [r1, r2] = await Promise.all([ob, oc]);
  const bWon = r1.winner === r1.you;
  ok(bWon && r1.reward.elo > 0 && r2.reward.elo === -r1.reward.elo, `ELO: ganador +${r1.reward.elo}, perdedor ${r2.reward.elo}`);
  ok(r1.reward.coins === D.RANKED_PAY.win + D.RANKED_PAY.firstWin && r1.reward.firstWin && r2.reward.coins === D.RANKED_PAY.loss, 'clasificatoria: dinero por combate y extra por la primera victoria del día');
  m = await b.wait('profile');
  ok(m.p.history.length === 1 && m.p.history[0].won && /^Verde#\d{4}$/.test(m.p.history[0].foe) && m.p.history[0].team.length === 3 && m.rank === 1, 'historial de clasificatorias y puesto en el ranking');
  ok(m.board[0].name === 'Azul' && !('account' in m.board[0]) && !('token' in m.board[0]), 'el ranking no filtra datos privados');
  // Etiquetas: dos entrenadores con el mismo nombre se distinguen por su #0000
  {
    const t1 = new Client(port), t2 = new Client(port);
    await t1.open(); await t2.open();
    const a1 = await t1.req({ t: 'hello', name: 'Gemelo' }), a2 = await t2.req({ t: 'hello', name: 'Gemelo' });
    ok(/^\d{4}$/.test(a1.p.tag) && /^\d{4}$/.test(a2.p.tag) && a1.p.tag !== a2.p.tag, `mismo nombre, etiquetas distintas (Gemelo#${a1.p.tag} y Gemelo#${a2.p.tag})`);
    const r1 = await t1.req({ t: 'name', name: 'Otro' });
    ok(r1.p.name === 'Otro' && /^\d{4}$/.test(r1.p.tag), 'al cambiar de nombre se conserva una etiqueta válida');
    t1.ws.close(); t2.ws.close();
  }

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
  {
    const dex = 25;
    bp.caught = [...new Set([...bp.caught, dex])];
    m = await b.req({ t: 'look', avatar: dex, avatarShiny: true });
    ok(!m.p.avatar, 'el avatar shiny tiene que ser un shiny atrapado');
    bp.shinies = [...(bp.shinies || []), dex];
    m = await b.req({ t: 'look', avatar: dex, avatarShiny: true });
    ok(m.p.avatar === dex && m.p.avatarShiny === true, 'avatar shiny si lo tienes');
    m = await b.req({ t: 'look', avatar: null });
    ok(!m.p.avatar && !m.p.avatarShiny, 'volver al avatar automático');
    // Maestría: victorias por línea evolutiva (Charmeleon suma a la de Charmander)
    m = await b.req({ t: 'look', avatar: dex, avatarArt: true });
    ok(!m.p.avatarArt, 'la ilustración necesita la maestría de la línea');
    const ups = [];
    seasonMod.migrate(bp);
    bp.mastery[4] = 0; bp.mastery[172] = 0;
    for (let i = 0; i < 50; i++) ups.push(...seasonMod.addMastery(bp, [5, 4, 25]));
    ok(bp.mastery[4] === 50 && bp.mastery[172] === 50 && ups.filter(u => u.dex === 4).length === 2, 'retos de línea: una victoria por línea y combate, con sus niveles');
    ok(D.masteryReady(bp, 4).join() === '0,1', 'retos de línea: los premios no llegan solos, quedan por recoger');
    m = await b.req({ t: 'masteryclaim', dex: 5, i: 4 }, 'error');
    ok(/nada que recoger/.test(m.msg), 'retos de línea: no se recoge un premio sin llegar a él');
    const candy0 = bp.items.caramelo || 0, coins0 = bp.coins;
    m = await b.req({ t: 'masteryclaim', dex: 5, i: 0 }, 'loot');
    ok(m.r.coins === 500 && m.r.items.caramelo === 1 && bp.items.caramelo === candy0 + 1 && bp.coins === coins0 + 500 && m.r.mastery.dex === 4, 'reto de 10 victorias: un Caramelo Raro y 500 de dinero');
    m = await b.req({ t: 'masteryclaim', dex: 4, i: 0 }, 'error');
    ok(/nada que recoger/.test(m.msg), 'retos de línea: cada premio se recoge una sola vez');
    m = await b.req({ t: 'masteryclaim', dex, i: 1 }, 'loot');
    ok(m.r.art === D.lineOf(dex) && D.MASTERY_ART === 50, 'reto de 50 victorias: ilustración oficial de la línea');
    m = await b.req({ t: 'look', avatar: dex, avatarArt: true });
    ok(m.p.avatarArt === true, 'ilustración de avatar');
    // Skins: Oro a 500 victorias, Holo a 25 victorias online y Galaxia con racha de 50 en la Torre
    m = await b.req({ t: 'look', skin: { dex: 4, skin: 'oro' } }, 'error');
    ok(/esa skin/.test(m.msg), 'skin: sin el reto no se puede poner');
    bp.mastery[4] = 500;
    m = await b.req({ t: 'masteryclaim', dex: 4, i: 2 }, 'loot');
    ok(m.r.avatar === 'pt:4' && bp.cosmetics.avatars.includes('pt:4'), 'reto de 100 victorias: retrato de la línea como avatar');
    m = await b.req({ t: 'masteryclaim', dex: 4, i: 4 }, 'loot');
    ok(m.r.skin === 'oro', 'reto de 500 victorias: skin Edición Oro');
    m = await b.req({ t: 'look', skin: { dex: 6, skin: 'oro' } });
    ok(m.p.skins[4] === 'oro' && D.skinOf(bp, 5) === 'oro' && D.skinOf(bp, 25) === null, 'skin: se pone a toda la línea evolutiva');
    m = await b.req({ t: 'look', skin: { dex: 4, skin: null } });
    ok(!m.p.skins[4], 'skin: quitarla');
    seasonMod.addLineStat(bp, [5], 'pvp', 25);
    seasonMod.addLineStat(bp, [6], 'tower', 30, true); seasonMod.addLineStat(bp, [4], 'tower', 50, true); seasonMod.addLineStat(bp, [4], 'tower', 10, true);
    ok(D.masteryReady(bp, 4).includes(5) && D.masteryReady(bp, 4).includes(6) && bp.lineStats.tower[4] === 50, 'Holo con victorias online y Galaxia con la mejor racha de la Torre (cuenta la mejor)');
    // Logros de debilitar por tipo: su marco
    const kp = { cosmetics: { titles: [], frames: [] }, coins: 0, items: {}, mons: [], caught: [], elo: 1000, mastery: {} };
    seasonMod.migrate(kp);
    seasonMod.addKOs(kp, { kos: [...Array(100)].map(() => ({ by: 0, type: 'fuego' })).concat([{ by: 1, type: 'agua' }]) }, 0);
    seasonMod.migrate(kp);
    ok(kp.koByType.fuego === 100 && !kp.koByType.agua && kp.achClaim.includes('ko-fuego'), 'debilitar 100 con movimientos de fuego cumple su reto (los del rival no cuentan)');
    ok(seasonMod.claimAchievement(kp, 'ko-fuego').loot.aura === 'tipo-fuego' && kp.cosmetics.auras.includes('tipo-fuego') && !kp.cosmetics.frames.includes('tipo-fuego'), 'y su premio es el glow Fuego');
    ok(!D.ACHIEVEMENTS.some(a => a.reward && (a.reward.frame === 'campeon' || /^tipo-/.test(a.reward.frame || ''))), 'los marcos de tipo y el de Campeón ya no salen de los retos');
    await b.req({ t: 'look', avatar: null, frame: null, aura: null });
  }
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

  // ---------- Entrar con el correo (código de 6 cifras) ----------
  {
    const mail = require('../server/mail.js');
    const peek = tok => [...store.all()].find(p => p.token === tok);   // (sin ponerlo en uso, como haría store.get)
    const codeOf = to => { const x = mail.lastTo(to); return x && /(\d{6})/.exec(x.text)[1]; };
    const cfg = await (await fetch(`http://localhost:${port}/auth/config`)).json();
    ok(cfg.mail === true && cfg.google === process.env.GOOGLE_CLIENT_ID, '/auth/config dice qué formas de entrar hay');
    const m1 = new Client(port); await m1.open();
    m = await m1.req({ t: 'mailcode', email: 'no es correo' }, 'autherr');
    ok(/no es válido/.test(m.msg), 'un correo mal escrito no recibe código');
    // La misma respuesta tenga cuenta o no (no se puede averiguar quién juega)
    const r1 = await m1.req({ t: 'mailcode', email: 'Brock@Example.com', lang: 'es' }, 'mailsent');
    const r2 = await m1.req({ t: 'mailcode', email: 'ash.ketchum@pueblo-paleta.com', lang: 'en' }, 'mailsent');
    ok(JSON.stringify(r1) === JSON.stringify(r2), 'pedir un código responde igual exista la cuenta o no');
    const code = codeOf('brock@example.com');
    ok(/^\d{6}$/.test(code) && /PokéArenas/.test(mail.lastTo('brock@example.com').subject) && /Your code/.test(mail.lastTo('ash.ketchum@pueblo-paleta.com').text), 'el correo lleva el código, en el idioma del jugador');
    const row = store.db.prepare('SELECT * FROM mail_codes WHERE email = ?').get('brock@example.com');
    ok(row && !JSON.stringify(row).includes(code) && row.expires - Date.now() <= mail.CODE_MS && row.expires - Date.now() > 9 * 60e3, 'el código se guarda solo como huella y caduca a los 10 minutos');
    m = await m1.req({ t: 'mailcode', email: 'brock@example.com' }, 'autherr');
    ok(/espera/.test(m.msg), 'no se puede pedir otro código al mismo correo enseguida');
    // Sin perfil (desde la portada): tras el código pide el nombre de entrenador, con el filtro de siempre
    m = await m1.req({ t: 'mailverify', email: 'brock@example.com', code: code === '000000' ? '111111' : '000000' }, 'autherr');
    ok(/incorrecto/.test(m.msg), 'un código equivocado no entra');
    await m1.req({ t: 'mailverify', email: 'BROCK@example.com', code }, 'authname');
    m = await m1.req({ t: 'authname', name: 'hijoputa' }, 'autherr');
    ok(/no está permitido/.test(m.msg), 'el nombre de la cuenta nueva pasa el filtro de nombres');
    m = await m1.req({ t: 'authname', name: 'Brock' });
    const brockTok = m.p.token;
    ok(m.p.name === 'Brock' && m.p.account.email === 'brock@example.com' && !m.p.account.user && !m.p.account.pass && m.p.coins === 500, 'cuenta nueva con el correo, sin usuario ni contraseña');
    const m2 = new Client(port); await m2.open();
    m = await m2.req({ t: 'mailverify', email: 'brock@example.com', code }, 'autherr');
    ok(/incorrecto/.test(m.msg), 'el código sirve una sola vez');
    // Volver a entrar desde otro dispositivo
    await m2.req({ t: 'mailcode', email: 'brock@example.com' }, 'autherr');   // (aún dentro de los 30 s)
    store.db.prepare('DELETE FROM mail_codes').run();
    mail.outbox.length = 0;
    const fresh = mail.newCode('brock@example.com');
    m = await m2.req({ t: 'mailverify', email: 'brock@example.com', code: fresh });
    ok(m.p.token === brockTok, 'entrar otra vez con el correo recupera la misma cuenta');
    // 5 fallos gastan el código
    const five = mail.newCode('cinco@example.com');
    for (let i = 0; i < 5; i++) await m2.req({ t: 'mailverify', email: 'cinco@example.com', code: String((+five + 1 + i) % 1e6).padStart(6, '0') }, 'autherr');
    m = await m2.req({ t: 'mailverify', email: 'cinco@example.com', code: five }, 'autherr');
    ok(/incorrecto/.test(m.msg), 'tras 5 intentos fallidos el código deja de valer');
    const old = mail.newCode('tarde@example.com');
    store.db.prepare('UPDATE mail_codes SET expires = ? WHERE email = ?').run(Date.now() - 1, 'tarde@example.com');
    m = await m2.req({ t: 'mailverify', email: 'tarde@example.com', code: old }, 'autherr');
    ok(/caducado/.test(m.msg), 'un código caducado no vale');
    // Un invitado conectado: su partida pasa a la cuenta (como al registrarse)
    const m3 = new Client(port); await m3.open();
    m = await m3.req({ t: 'hello', name: 'Gary' });
    const garyTok = m.p.token;
    await m3.req({ t: 'story', a: 'starter', dex: 7 });
    m = await m3.req({ t: 'mailverify', email: 'gary@example.com', code: mail.newCode('gary@example.com') });
    ok(m.p.token === garyTok && m.p.mons.length === 1 && m.p.account.email === 'gary@example.com' && m.p.name === 'Gary', 'un invitado que entra con el correo se lleva su partida a la cuenta nueva');
    // Desde la portada, con el token de invitado de ese navegador
    const m4 = new Client(port); await m4.open();
    m = await m4.req({ t: 'hello', name: 'Erika' });
    const erikaTok = m.p.token; m4.ws.close();
    const m5 = new Client(port); await m5.open();
    m = await m5.req({ t: 'mailverify', email: 'erika@example.com', code: mail.newCode('erika@example.com'), token: erikaTok });
    ok(m.p.token === erikaTok && m.p.name === 'Erika' && m.p.account.email === 'erika@example.com', 'desde la portada, la partida de invitado de ese navegador pasa a la cuenta');
    // Una cuenta de antes con el correo como usuario: se entra en ella
    const m6 = new Client(port); await m6.open();
    m = await m6.req({ t: 'mailverify', email: 'Ash.Ketchum@pueblo-paleta.com', code: mail.newCode('ash.ketchum@pueblo-paleta.com') });
    ok(m.p.account.user === 'ash.ketchum@pueblo-paleta.com' && m.p.account.pass && m.p.account.email === 'ash.ketchum@pueblo-paleta.com', 'con el correo se entra en la cuenta de antes que lo tiene de usuario');
    const m7 = new Client(port); await m7.open();
    m = await m7.req({ t: 'register', user: 'Gary@Example.com', pass: 'clave-gary' }, 'autherr');
    ok(/existe/.test(m.msg), 'no se puede registrar de usuario el correo de otra cuenta');
    m = await m2.req({ t: 'passwd', old: 'x', pass: 'nueva123' }, 'autherr');
    ok(/no tiene contraseña/.test(m.msg), 'una cuenta sin contraseña no la puede cambiar');
    ok(!JSON.stringify(store.ladder('ranked')).includes('@example') && !JSON.stringify(store.publicUser(peek(brockTok).id)).includes('@example')
      && !JSON.stringify(require('../server/audit.js').query({ limit: 500 })).includes('@example'), 'el correo no sale en la ladder, ni en la ficha pública, ni en la auditoría');
    for (const x of [m1, m2, m3, m5, m6, m7]) x.ws.close();   // (como mucho 20 conexiones a la vez por IP)
  }

  // ---------- Entrar con Google ----------
  {
    const g1 = new Client(port); await g1.open();
    const bad = async (tok, msg) => { const r = await g1.req({ t: 'google', credential: tok }, 'autherr'); ok(/Google/.test(r.msg), msg); };
    await bad(googleToken({ aud: 'otra-app' }), 'Google: un token para otra aplicación no vale (aud)');
    await bad(googleToken({ iss: 'https://evil.example.com' }), 'Google: un token de otro emisor no vale (iss)');
    await bad(googleToken({ exp: Math.floor(Date.now() / 1000) - 3600 }), 'Google: un token caducado no vale (exp)');
    await bad(googleToken({ email_verified: false }), 'Google: con el correo sin verificar no se entra');
    await bad(googleToken({}, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey), 'Google: un token firmado por otra clave no vale');
    await bad(googleToken({}, googleKey.privateKey, 'otra'), 'Google: una clave desconocida (kid) no vale');
    const t0 = googleToken().split('.');
    await bad([t0[0], Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(t0[1], 'base64url')), sub: '666' })).toString('base64url'), t0[2]].join('.'), 'Google: un token retocado no vale');
    await bad('basura', 'Google: algo que no es un token no vale');
    await g1.req({ t: 'google', credential: googleToken() }, 'authname');
    m = await g1.req({ t: 'authname', name: 'Misty' });
    const mistyTok = m.p.token;
    ok(m.p.account.google && m.p.account.email === 'misty@example.com' && !m.p.account.user && m.p.name === 'Misty', 'Google: cuenta nueva con el correo y su id de Google');
    ok([...store.all()].find(p => p.token === mistyTok).account.google === '1001', 'Google: se guarda su id (sub)');
    const g2 = new Client(port); await g2.open();
    m = await g2.req({ t: 'google', credential: googleToken({ email: 'misty.nuevo@example.com' }) });
    ok(m.p.token === mistyTok, 'Google: con la misma cuenta de Google se entra aunque haya cambiado el correo');
    // Con Google y el correo de una cuenta que entraba por código: es la misma cuenta, y queda vinculada
    const g3 = new Client(port); await g3.open();
    m = await g3.req({ t: 'google', credential: googleToken({ sub: '2002', email: 'brock@example.com' }) });
    ok(m.p.name === 'Brock' && m.p.account.google, 'Google: si el correo ya tiene cuenta, se entra en ella (y queda vinculada a Google)');
    // Un invitado conectado que entra con Google se lleva su partida
    const g4 = new Client(port); await g4.open();
    m = await g4.req({ t: 'hello', name: 'Sabrina' });
    const sabTok = m.p.token;
    m = await g4.req({ t: 'google', credential: googleToken({ sub: '3003', email: 'sabrina@example.com' }) });
    ok(m.p.token === sabTok && m.p.account.email === 'sabrina@example.com', 'Google: un invitado se lleva su partida a la cuenta nueva');
    // Sin el nombre a tiempo, la verificación caduca
    const g5 = new Client(port); await g5.open();
    m = await g5.req({ t: 'authname', name: 'Nadie' }, 'autherr');
    ok(/caducado/.test(m.msg), 'sin verificar antes el correo, no se puede crear la cuenta');
    const adminView = require('../server/admin.js');
    ok(!JSON.stringify(store.search('Misty').map(p => ({ user: p.account && p.account.user }))).includes('@'), 'el panel de admin no ve el correo de las cuentas de Google');
    ok(adminView.grant && (() => { try { adminView.grant('sabrina@example.com'); return false; } catch (e) { return /usuario y contraseña/.test(e.message); } })(), 'una cuenta sin contraseña no puede ser admin (el panel pide contraseña y 2FA)');
    for (const x of [g1, g2, g3, g4, g5]) x.ws.close();
  }

  // ---------- Cliente SMTP (contra un servidor SMTP de pruebas en esta máquina) ----------
  {
    const mail = require('../server/mail.js');
    const got = [];
    const smtp = require('net').createServer(sock => {
      let data = null, buf = '';
      sock.write('220 prueba ESMTP\r\n');
      sock.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\r\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          if (data !== null) { if (line === '.') { got.push(data); data = null; sock.write('250 OK\r\n'); } else data += line + '\n'; continue; }
          got.push(line);
          if (/^EHLO/.test(line)) sock.write('250-prueba\r\n250 AUTH PLAIN\r\n');
          else if (/^AUTH PLAIN/.test(line)) sock.write('235 OK\r\n');
          else if (/^(MAIL|RCPT)/.test(line)) sock.write('250 OK\r\n');
          else if (line === 'DATA') { data = ''; sock.write('354 Adelante\r\n'); }
          else if (line === 'QUIT') sock.end('221 Adiós\r\n');
        }
      });
    }).listen(0);
    await new Promise(r => smtp.once('listening', r));
    await mail.smtpSend({ host: '127.0.0.1', port: smtp.address().port, user: 'yo', pass: 'secreto', from: 'PokéArenas <no-reply@pokearenas.com>' },
      'brock@example.com', 'Tu código de PokéArenas: 123456', 'Tu código es 123456');
    const msgData = got.find(x => typeof x === 'string' && x.includes('Subject:')) || '';
    ok(got.includes('AUTH PLAIN ' + Buffer.from('\0yo\0secreto').toString('base64')) && got.includes('MAIL FROM:<no-reply@pokearenas.com>') && got.includes('RCPT TO:<brock@example.com>'), 'SMTP: se identifica y manda del remitente al destinatario');
    const body = /\n\n([\s\S]*)$/.exec(msgData);
    ok(/=\?UTF-8\?B\?/.test(msgData) && body && Buffer.from(body[1].replace(/\s/g, ''), 'base64').toString().includes('123456'), 'SMTP: asunto con acentos codificado y el texto en base64');
    let refused = null;
    await mail.smtpSend({ host: 'localhost.invalid', port: 1, from: 'a@b.cd' }, 'x@y.zz', 's', 't').catch(e => { refused = e; });
    ok(!!refused, 'SMTP: un servidor al que no se llega da error (y no cuelga)');
    smtp.close();
  }
  const hz = await new Promise(r => require('http').get(`http://localhost:${port}/healthz`, res => { let d = ''; res.on('data', x => { d += x; }); res.on('end', () => r(JSON.parse(d))); }));
  ok(hz.ok && hz.version === require('../package.json').version, '/healthz responde con la versión');

  // Misma IP: no se emparejan (en producción; aquí se activa a mano). Y contra el mismo rival, el ELO solo
  // cuenta en las 3 primeras partidas del día
  {
    process.env.SAME_IP_BLOCK = '1';
    const e1 = new Client(port), e2 = new Client(port);
    await e1.open(); await e2.open();
    await e1.req({ t: 'hello', name: 'X' }); await e2.req({ t: 'hello', name: 'Y' });
    for (const e of [e1, e2]) await e.req({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
    const q1 = e1.wait('queue'), q2 = e2.wait('queue');
    e1.send({ t: 'queue', mode: 'casual' }); e2.send({ t: 'queue', mode: 'casual' });
    await Promise.all([q1, q2]);
    const started = await Promise.race([e1.wait('start', () => true, 1500).then(() => true), new Promise(r => setTimeout(() => r(false), 1200))]);
    ok(!started, 'dos conexiones desde la misma IP no se emparejan (nadie se sube el ELO contra sí mismo)');
    e1.send({ t: 'unqueue' }); e2.send({ t: 'unqueue' });
    delete process.env.SAME_IP_BLOCK;
    e1.ws.close(); e2.ws.close();
  }
  {
    // El mismo par de cuentas: la 4.ª clasificatoria del día ya no mueve el ELO
    const f1 = new Client(port), f2 = new Client(port);
    await f1.open(); await f2.open();
    await f1.req({ t: 'hello', name: 'Fa' }); await f2.req({ t: 'hello', name: 'Fb' });
    for (const f of [f1, f2]) await f.req({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
    const deltas = [];
    for (let g = 0; g < 4; g++) {
      const s1 = f1.wait('start'), s2 = f2.wait('start');
      f1.send({ t: 'queue', mode: 'ranked' }); f2.send({ t: 'queue', mode: 'ranked' });
      await Promise.all([s1, s2]);
      const o1 = f1.wait('over');
      f2.send({ t: 'forfeit' });
      const r = await o1;
      deltas.push(r.reward.elo);
      await new Promise(x => setTimeout(x, 150));
    }
    ok(deltas.slice(0, 3).every(d => d > 0) && deltas[3] === 0, `contra el mismo rival, el ELO solo cuenta 3 partidas al día (${deltas.join(', ')})`);
    f1.ws.close(); f2.ws.close();
  }

  // ---------- Torre Batalla ----------
  const tower = require('../server/tower.js');
  const tw = new Client(port); await tw.open();
  m = await tw.req({ t: 'hello', name: 'Torre' });
  m = await tw.req({ t: 'register', user: 'torre', pass: 'clave-torre' });
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
  err = tw.wait('error'); tw.send({ t: 'story', a: 'sell', uid: low.uid });
  ok((await err).msg.includes('Torre'), 'no se vende un Pokémon del equipo de la Torre');
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
  const mb0 = twProf.items.masterball || 0, gems0 = twProf.gems || 0;
  rw = tower.applyResult(twProf, brainSetup, { winner: 0 });
  ok(rw.tower.symbol === 'Símbolo Plata' && twProf.tower.symbols.includes('Símbolo Plata') && twProf.tower.best === 21, 'vencer al Cerebro da el Símbolo Plata');
  ok(twProf.items.masterball === mb0 + 1 && rw.gems === D.TOWER.symbolPrize.gems + D.GEMS.towerBlock && twProf.gems === gems0 + rw.gems && !('gems' in rw.items),
    'el Símbolo trae una Master Ball y gemas (con las del bloque), y las gemas no van a la mochila');
  rw = tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 1 });
  ok(rw.tower.ended && twProf.tower.streak === 0 && !twProf.tower.team && twProf.tower.best === 21, 'perder resetea la racha pero guarda el récord');
  // Retirarse guarda la racha
  tower.action(twProf, { a: 'start', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
  tower.applyResult(twProf, tower.battleSetup(twProf), { winner: 0 });
  m = await tw.req({ t: 'tower', a: 'retire' });
  ok(!m.p.tower.team && m.p.tower.best === 21 && m.p.tower.runs === 3, 'retirarse termina la racha sin tocar el récord');

  // ---------- Lucky Spin: ruletas de la Gen 1 y 2 por línea ----------
  {
    const first = D.treasures(0);
    const all = Array.from({ length: 8 }, (_, k) => D.treasures(k)).flat();
    ok(first[0].line === 4 && first[0].prizes[0].id === 'skin:elemental:4', 'la primera ruleta es la de Charmander, con su skin Elemental de gran premio');
    ok(all.every(r => r.line <= 251 && r.prizes.length === 10 && r.prizes.filter(x => x.rarity === 'mitico').length === 1
      && r.prizes.every(x => !x.dex || x.dex <= 251) && r.prizes.filter(x => x.kind === 'portrait').every(x => D.lineOf(x.dex) === r.line)),
      'todas las ruletas son de la Gen 1 y 2: un gran premio, y retratos solo de su propia línea');
  }

  // ---------- Misiones: recoger todo ----------
  {
    const missions = require('../server/missions.js');
    const mp = { coins: 0, gems: 0, items: {}, cosmetics: { auras: [] } };
    missions.action(mp, { a: 'claimAll' });   // crea las misiones del día y de la semana
    for (const m of mp.missions.daily) m.n = D.MISSION_BY_ID[m.id].goal;
    mp.missions.weekly[0].n = D.MISSION_BY_ID[mp.missions.weekly[0].id].goal;
    const coins0 = mp.coins;
    const r = missions.action(mp, { a: 'claimAll' });
    const expect = mp.missions.daily.reduce((n, m) => n + (D.MISSION_BY_ID[m.id].reward.coins || 0), 0) + D.MISSION_BY_ID[mp.missions.weekly[0].id].reward.coins + D.MISSION_CHEST.daily.coins;
    ok(r.loot && r.loot.all === 4 && r.loot.chests.join() === 'daily' && mp.coins - coins0 === expect && mp.missions.chest.daily && !mp.missions.weekly[1].claimed,
      'recoger todo: las 4 misiones cumplidas y el cofre diario de una vez, con el premio sumado');
    ok(missions.action(mp, { a: 'claimAll' }).error, 'sin nada cumplido, recoger todo avisa');
  }

  // ---------- Recoger todo: misiones, diario, logros y medallas ----------
  {
    const { collectAll } = require('../server/collect.js');
    const cp = { coins: 0, gems: 0, items: {}, cosmetics: { auras: [] }, prog: { kanto: 2 }, mons: [], caught: [] };
    require('../server/missions.js').action(cp, { a: 'claimAll' });
    for (const m of cp.missions.daily) m.n = D.MISSION_BY_ID[m.id].goal;
    const r = collectAll(cp);
    ok(r.loot && r.loot.all === 3 && r.loot.chests.includes('daily') && cp.daily && cp.cosmetics.avatars.includes('badge:kanto:0') && cp.cosmetics.avatars.includes('badge:kanto:1'),
      'recoger todo: las misiones, su cofre, el premio diario y los avatares de medalla de una vez');
    ok(collectAll(cp).error, 'después ya no queda nada');
  }

  // ---------- Premio diario con gemas y presupuesto de Tesoros ----------
  {
    const daily = require('../server/daily.js');
    const dp = { coins: 0, gems: 0, items: {} };
    const l = daily.claim(dp, Date.UTC(2026, 9, 26, 12));
    ok(l.loot.gems === D.DAILY_LOGIN[0].gems && dp.gems === D.DAILY_LOGIN[0].gems && !('gems' in dp.items), 'el premio diario da gemas');
    // Quien entra cada día y hace sus diarias junta en 2 semanas lo que cuestan las 3 ruletas enteras
    const week = D.DAILY_LOGIN.reduce((n, d) => n + (d.gems || 0), 0);
    const fortnight = 2 * week + D.TREASURE_DAYS * (D.MISSION_COUNT * D.GEMS.missionDaily + D.GEMS.chestDaily);
    const allWheels = 3 * D.SPIN_COST.reduce((a, b) => a + b, 0);
    const perDay = fortnight / D.TREASURE_DAYS / (allWheels / 3 / D.SPIN_COST.length);
    ok(D.SPIN_COST.reduce((a, b) => a + b, 0) === 300 && perDay >= 0.8 && perDay <= 1.5, `una ruleta entera son 300 gemas: entrando a diario (premio diario y misiones diarias) sale una tirada al día (${perDay.toFixed(2)})`);
  }

  // ---------- Retratos con emoción en Tesoros ----------
  {
    const faces = Array.from({ length: 6 }, (_, k) => D.treasures(k)).flat().flatMap(r => r.prizes).filter(x => x.kind === 'portrait');
    const emo = faces.filter(x => x.emo), plain = faces.filter(x => !x.emo);
    ok(emo.length && emo.every(x => D.hasEmotion(x.dex, x.emo) && x.id === `pt:${x.dex}:${x.emo}`) && plain.every(x => x.id === `pt:${x.dex}`) && faces.every(x => !x.fx),
      'los retratos de Lucky Spin son solo la cara (con emoción si la especie la tiene), sin efecto incluido');
    const fxPrizes = Array.from({ length: 6 }, (_, k) => D.treasures(k)).flat().flatMap(r => r.prizes).filter(x => x.kind === 'effect');
    ok(fxPrizes.length && fxPrizes.every(x => D.EFFECTS.includes(x.effect) && x.id === 'fx:' + x.effect), 'los efectos son premios aparte de los retratos');
    {
      const rewards = require('../server/rewards.js');
      const ep = { cosmetics: { titles: [], frames: [] }, coins: 0, items: {}, mons: [], caught: [], elo: 1000 };
      rewards.migrate(ep);
      ok(rewards.setLook(ep, { effect: 'aurora' }) && !ep.effect, 'no se puede poner un efecto que no tienes');
      rewards.unlock(ep, 'effects', 'aurora');
      ok(rewards.setLook(ep, { effect: 'aurora' }) === null && ep.effect === 'aurora' && rewards.setLook(ep, { effect: null }) === null && ep.effect === null, 'el efecto conseguido se pone y se quita, con cualquier avatar');
    }
  }

  // ---------- Master Ball ----------
  ok(D.BALL_IDS.join() === 'pokeball,superball,ultraball,masterball' && D.catchChance(1, 'masterball', false, 150) === 1, 'la Master Ball atrapa seguro, incluso a un legendario con todos sus PS');
  {
    const { Battle } = require('../server/battle.js');
    const side = { balls: { pokeball: 1, superball: 0, ultraball: 0, masterball: 1 }, a: 0, x: 0, y: 0 };
    const fake = { projectiles: [], ev() {}, rad: () => 10 };
    Battle.prototype.throwBall.call(fake, side, {});
    ok(side.balls.masterball === 1 && side.balls.pokeball === 0, 'sin elegirla, la Master Ball no se lanza: sale la mejor de las otras');
    Battle.prototype.throwBall.call(fake, side, { ball: 'masterball' });
    ok(side.balls.masterball === 0 && fake.projectiles[1].ball === 'masterball', 'elegida, se lanza la Master Ball');
  }

  // ---------- Aspecto de un shiny (verlo normal) ----------
  {
    const prof = store.get(token);
    const mon = prof.mons.find(x => (x.region || 'kanto') === 'kanto');
    mon.shiny = false;
    let r = await a2.req({ t: 'story', a: 'appearance', uid: mon.uid, plain: true }, 'error');
    ok(/shiny/.test(r.msg), 'solo los shiny pueden cambiar de aspecto');
    mon.shiny = true;
    if (!prof.shinies.includes(mon.dex)) prof.shinies.push(mon.dex);
    r = await a2.req({ t: 'story', a: 'appearance', uid: mon.uid, plain: true });
    const seen = r.p.mons.find(x => x.uid === mon.uid);
    const setup = story.battleSetup(prof, { a: 'route', id: D.REGIONS.kanto.nodes.find(n => n.kind === 'route').id });
    ok(seen.plain && seen.shiny && prof.shinies.includes(mon.dex), 'un shiny se puede ver normal y sigue contando como shiny');
    ok(setup.opts && setup.opts.sides[0].team.some(x => x.uid === mon.uid && x.shiny === false), 'en combate sale con sus colores normales');
    r = await a2.req({ t: 'story', a: 'appearance', uid: mon.uid, plain: false });
    ok(!r.p.mons.find(x => x.uid === mon.uid).plain, 'y se puede volver a ver shiny');
  }

  // ---------- Ladder ----------
  // Rojo es un invitado: no sale en los rankings hasta que se registra
  tower.action(store.get(token), { a: 'start', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] });
  tower.applyResult(store.get(token), tower.battleSetup(store.get(token)), { winner: 0 });
  ok(!store.ladder('tower').rows.some(r => r.name === 'Rojo') && !store.ladder('dex').rows.some(r => r.name === 'Rojo'), 'un invitado no sale en los rankings');
  tower.endRun ? tower.endRun(store.get(token)) : null;
  store.get(token).tower.team = null; store.get(token).tower.streak = 0;
  await store.register(store.get(token), 'rojo_ladder', 'clave-rojo');
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

  // ---------- Misiones, logros y medallas por recoger ----------
  {
    const missions = require('../server/missions.js');
    const mc = new Client(port); await mc.open();
    let r = await mc.req({ t: 'hello', name: 'Misiones' });
    const prof = store.get(r.p.token);
    ok(r.p.missions && r.p.missions.daily.length === 3 && r.p.missions.weekly.length === 3 && new Set(r.p.missions.daily.map(x => x.id)).size === 3
      && r.p.missions.freeRerolls.daily === D.MISSION_REROLLS.daily && r.p.missions.ends.daily > Date.now(), '3 misiones diarias y 3 semanales distintas, con cambios gratis y hora de renovación');
    prof.missions.daily = [{ id: 'd-wild', n: 0, claimed: false }, { id: 'd-catch-type', type: 'agua', n: 0, claimed: false }, { id: 'd-level', n: 0, claimed: false }];
    const before = missions.snapshot(prof);
    missions.track(prof, 'catch', 1, ['fuego']);
    missions.track(prof, 'catch', 1, ['agua', 'volador']);
    for (let i = 0; i < 7; i++) missions.track(prof, 'wild');
    const moved = missions.diff(prof, before);
    ok(prof.missions.daily[0].n === 5 && prof.missions.daily[1].n === 1, 'avanzan con lo que se hace (la de tipo, solo con ese tipo) sin pasar de la meta');
    ok(moved.some(x => x.kind === 'daily' && x.i === 0 && x.from === 0 && x.n === 5 && x.goal === 5), 'se sabe cuánto ha avanzado cada una en el combate');
    let e = mc.wait('error'); mc.send({ t: 'mission', a: 'reroll', kind: 'daily', i: 0 });
    ok(/recoge/.test((await e).msg), 'una misión cumplida no se cambia: se recoge');
    e = mc.wait('error'); mc.send({ t: 'mission', a: 'claim', kind: 'daily', i: 2 });
    ok(/cumplida/.test((await e).msg), 'una sin cumplir no se recoge');
    const coins0 = prof.coins;
    let loot = mc.wait('loot'); mc.send({ t: 'mission', a: 'claim', kind: 'daily', i: 0 });
    let l = await loot;
    ok(l.r.coins === D.MISSION_BY_ID['d-wild'].reward.coins && prof.coins === coins0 + l.r.coins && prof.missions.daily[0].claimed, 'recoger da el premio');
    ok(l.r.gems === D.GEMS.missionDaily, 'y gemas para Tesoros');
    e = mc.wait('error'); mc.send({ t: 'mission', a: 'claim', kind: 'daily', i: 0 });
    ok(/Ya has/.test((await e).msg), 'y solo una vez');
    // Cambios: los gratis y después pagando
    for (let i = 0; i < D.MISSION_REROLLS.daily; i++) r = await mc.req({ t: 'mission', a: 'reroll', kind: 'daily', i: 2 });
    ok(r.p.missions.freeRerolls.daily === 0 && new Set(r.p.missions.daily.map(x => x.id)).size === 3, 'cambios gratis gastados, sin repetir misión');
    prof.coins = 10;
    e = mc.wait('error'); mc.send({ t: 'mission', a: 'reroll', kind: 'daily', i: 2 });
    ok(/dinero/.test((await e).msg), 'sin cambios gratis, cuesta dinero');
    prof.coins = 1000;
    r = await mc.req({ t: 'mission', a: 'reroll', kind: 'daily', i: 2 });
    ok(r.p.coins === 1000 - D.MISSION_REROLL_COST.daily, 'cambio pagado');
    // Cofre: al recoger las 3
    e = mc.wait('error'); mc.send({ t: 'mission', a: 'chest', kind: 'daily' });
    ok(/Recoge antes/.test((await e).msg), 'el cofre espera a las 3 misiones');
    prof.missions.daily[2].n = D.MISSION_BY_ID[prof.missions.daily[2].id].goal;
    await mc.req({ t: 'mission', a: 'claim', kind: 'daily', i: 1 });
    loot = mc.wait('loot'); mc.send({ t: 'mission', a: 'claim', kind: 'daily', i: 2 });
    ok((await loot).r.chestReady, 'al recoger la tercera, el cofre queda listo');
    const candy = prof.items.caramelo || 0;
    loot = mc.wait('loot'); mc.send({ t: 'mission', a: 'chest', kind: 'daily' });
    l = await loot;
    ok(l.r.chest === 'daily' && prof.items.caramelo === candy + D.MISSION_CHEST.daily.items.caramelo, 'abrir el cofre diario');
    e = mc.wait('error'); mc.send({ t: 'mission', a: 'chest', kind: 'daily' });
    ok(/Ya has/.test((await e).msg), 'el cofre se abre una vez');
    // Cofre semanal: trae un glow de tipo para el avatar que aún no tengas
    prof.missions.weekly.forEach(x => { x.claimed = true; });
    loot = mc.wait('loot'); mc.send({ t: 'mission', a: 'chest', kind: 'weekly' });
    l = await loot;
    ok(/^tipo-/.test(l.r.aura) && prof.cosmetics.auras.includes(l.r.aura), 'el cofre semanal da un glow de tipo para el avatar');
    e = mc.wait('error'); mc.send({ t: 'look', aura: 'dorado' });
    ok(/ese glow/.test((await e).msg), 'un glow que no tienes no se pone');
    r = await mc.req({ t: 'look', aura: l.r.aura });
    ok(r.p.aura === l.r.aura, 'y se pone alrededor del avatar');
    await mc.req({ t: 'look', aura: null });
    // Los glows del sprite (quitados) pasan a ser del avatar
    const oldG = { achievements: {}, cosmetics: { titles: [], frames: [], glows: ['estelar', 'tipo-agua'] }, glows: { 7: 'tipo-agua' } };
    seasonMod.migrate(oldG);
    ok(oldG.cosmetics.auras.join() === 'estelar,tipo-agua' && !oldG.cosmetics.glows && !oldG.glows, 'los glows del sprite que tenías pasan a glows del avatar');
    ok(!D.ACHIEVEMENTS.find(a => a.id === 'shiny1').reward.aura && D.ACHIEVEMENTS.find(a => a.id === 'shiny5').reward.aura === 'estelar', 'Cazador de shinies con el primero; el glow Estelar, con 5 shinies');
    // ---------- Tesoros ----------
    const treasure = require('../server/treasure.js');
    const rid = D.treasures()[0].id;
    prof.gems = 3;
    e = mc.wait('error'); mc.send({ t: 'treasure', id: rid });
    ok(/gemas/.test((await e).msg), 'sin gemas no se tira');
    prof.gems = 1000;
    const ids = [];
    let spent = 0;
    for (let i = 0; i < 10; i++) {
      loot = mc.wait('loot'); mc.send({ t: 'treasure', id: rid });
      l = await loot;
      ids.push(l.r.treasure.prize);
      spent += l.r.treasure.cost;
    }
    ok(new Set(ids).size === 10 && spent === D.SPIN_COST.reduce((a, b) => a + b, 0) && prof.gems === 1000 - spent, 'una ruleta: 10 premios distintos en 10 tiradas, cada una a su precio');
    const rr = D.treasures()[0];
    const skinP = rr.prizes.find(x => x.kind === 'skin'), ptP = rr.prizes.find(x => x.kind === 'portrait'), glP = rr.prizes.find(x => x.kind === 'particles');
    ok(D.hasSkin(prof, skinP.dex, 'elemental') && prof.cosmetics.avatars.includes(ptP.id) && prof.cosmetics.particles.includes(D.lineOf(glP.dex)) && D.particlesOf(prof, glP.dex) === D.SPECIES[D.lineOf(glP.dex)].types[0], 'los premios quedan: skin Elemental de la línea, retrato de avatar y partículas de la línea (puestas)');
    r = await mc.req({ t: 'look', particles: { dex: glP.dex, on: false } });
    ok(!D.particlesOf(prof, glP.dex), 'las partículas se apagan aparte de la skin');
    e = mc.wait('error'); mc.send({ t: 'look', particles: { dex: 133, on: true } });
    ok(/esas partículas/.test((await e).msg), 'sin tenerlas no se encienden');
    e = mc.wait('error'); mc.send({ t: 'treasure', id: rid });
    ok(/todos/.test((await e).msg), 'una ruleta completa no se tira más');
    r = await mc.req({ t: 'look', skin: { dex: skinP.dex, skin: 'elemental' } });
    ok(r.p.skins[D.lineOf(skinP.dex)] === 'elemental', 'la skin Elemental de Tesoros se pone a su línea');
    r = await mc.req({ t: 'look', avatar: ptP.id });
    ok(r.p.avatar === ptP.id, 'y el retrato, de avatar');
    // La última tirada siempre da el que queda: con una sola por sacar, ese
    const solo = { gems: 100, coins: 0, items: {}, achievements: {}, mons: [], caught: [], treasure: { period: D.treasurePeriod(), got: { [rid]: rr.prizes.slice(1).map(x => x.id) } } };
    ok(treasure.spin(solo, rid, () => 0.999).loot.treasure.prize === rr.prizes[0].id, 'la última tirada da el premio que queda');
    // Cambio de periodo: las ruletas viejas se van, lo conseguido se queda
    prof.treasure.period = D.treasurePeriod() - 1;
    r = await mc.req({ t: 'mission', a: 'refresh' });
    ok(!Object.keys(r.p.treasure.got).length && r.p.cosmetics.avatars.includes(ptP.id), 'cada 2 semanas, ruletas nuevas; lo ganado se queda');
    // La Elemental que se tenía por maestría (nivel 600, ya quitado) pasa a ser de la línea
    const oldE = { mastery: { 4: 600 }, masteryClaimed: { 4: [0, 1, 2, 3, 4, 5, 6, 7] }, cosmetics: { titles: [], frames: [] }, achievements: {} };
    seasonMod.migrate(oldE);
    ok(oldE.cosmetics.particles.includes(4) && !(oldE.masteryClaimed[4] || []).length && D.hasSkin(oldE, 6, 'elemental'), 'la Elemental de maestría se conserva al pasar a Tesoros y los retos de línea empiezan de cero');
    oldE.masteryClaimed[4] = [6]; seasonMod.migrate(oldE);
    ok(oldE.masteryClaimed[4].join() === '6', 'y solo una vez: el reto 7 nuevo (Galaxia) no se toca');
    // Retos de la 0.21 (con estrella y glow de tipo): se recolocan sin perder nada de lo recogido
    const v2 = { masteryV: 2, masteryClaimed: { 4: [0, 1, 2, 3, 4, 7] }, mastery: { 4: 300 }, cosmetics: { titles: [], frames: [], auras: ['tipo-fuego'] }, achievements: {} };
    seasonMod.migrate(v2);
    ok(v2.masteryClaimed[4].join() === '0,1,2,3,6' && v2.cosmetics.auras.includes('tipo-fuego') && v2.masteryV === 3, 'los retos ya recogidos en la 0.21 se recolocan y el glow de tipo se conserva');
    // Día nuevo: misiones, cambios y cofre nuevos
    prof.missions.day = '2000-01-01';
    r = await mc.req({ t: 'mission', a: 'refresh' });
    ok(r.p.missions.daily.every(x => !x.n && !x.claimed) && !r.p.missions.chest.daily && r.p.missions.freeRerolls.daily === D.MISSION_REROLLS.daily, 'cada día, misiones nuevas');
    // Un combate ganado en ruta cuenta para la misión
    prof.missions.daily[0] = { id: 'd-wild', n: 0, claimed: false };
    m = await mc.req({ t: 'story', a: 'starter', dex: 7 });
    story.applyResult(prof, { kind: 'route', route: D.NODES['k-ruta1'] }, { winner: 0 }, { sides: [{ team: [{ uid: prof.mons[0].uid, fainted: false }] }, { team: [{ level: 3 }] }] });
    ok(prof.missions.daily[0].n === 1, 'vencer a un salvaje cuenta');
    // Logros: el premio se recoge a mano
    prof.caught.push(16);
    r = await mc.req({ t: 'mission', a: 'refresh' });
    ok(r.p.achClaim.includes('captura1') && r.p.achievements.captura1, 'logro conseguido, premio pendiente');
    const c1 = prof.coins;
    loot = mc.wait('loot'); mc.send({ t: 'achclaim', id: 'captura1' });
    l = await loot;
    ok(l.r.coins === 300 && prof.coins === c1 + 300 && l.r.avatar === 'item:poke-ball' && !prof.achClaim.includes('captura1'), 'recoger el logro: dinero y su avatar');
    // Esta conexión ya ha mandado muchos mensajes seguidos: un respiro para no chocar con el límite anti-spam
    await new Promise(r => setTimeout(r, 1000));
    // Medallas: cada una da su avatar
    prof.prog.kanto = 1;
    loot = mc.wait('loot'); mc.send({ t: 'badgeclaim', region: 'kanto', index: 0 });
    ok((await loot).r.avatar === 'badge:kanto:0', 'la primera medalla da su avatar');
    e = mc.wait('error'); mc.send({ t: 'badgeclaim', region: 'kanto', index: 1 });
    ok(/nada que recoger/.test((await e).msg), 'una medalla sin ganar no da nada');
    r = await mc.req({ t: 'look', avatar: 'badge:kanto:0' });
    ok(r.p.avatar === 'badge:kanto:0', 'usar la medalla de avatar');
  }

  // Liga: el Alto Mando y el Campeón, 5 combates seguidos; si pierdes uno, se vuelve al primero
  {
    const storyL = require('../server/story.js');
    const lp = { coins: 0, items: {}, mons: [], caught: [], nextUid: 1, prog: { kanto: 8, johto: 0 }, teams: { kanto: [] }, starters: {}, achievements: {} };
    storyL.migrate(lp);
    storyL.devAddMon(lp, 6, 60, false, 'kanto');
    const L = D.leadersOf('kanto'), members = L.slice(D.LEAGUE_FROM);
    const fight = id => storyL.battleSetup(lp, { a: 'gym', id });
    const fakeB = setup => ({ sides: [{ team: [] }, { team: setup.opts.sides[1].team.map(m => ({ level: m.level })) }] });
    let st0 = fight(members[3].id);
    ok(!st0.error && st0.gym.id === members[0].id && st0.league.step === 0, 'la Liga empieza siempre por el primero del Alto Mando');
    ok(D.levelCap(lp, 'kanto') === Math.round(members.reduce((a, n) => a + n.team.reduce((x, [, l]) => x + l, 0) / n.team.length, 0) / members.length), 'con las 8 medallas, el tope de nivel es la media de toda la Liga');
    let r = storyL.applyResult(lp, st0, { winner: 0 }, fakeB(st0));
    ok(r.league.step === 1 && r.league.next === members[1].leader && lp.prog.kanto === 8, 'al ganar sigue con el siguiente (sin cerrar la región aún)');
    const st1 = fight(members[0].id);
    ok(st1.gym.id === members[1].id, 'el desafío sigue donde lo dejaste');
    r = storyL.applyResult(lp, st1, { winner: 1 }, fakeB(st1));
    ok(r.league.failed && !lp.leagueRun && fight(members[0].id).gym.id === members[0].id, 'perder uno te devuelve al primero');
    for (let i = 0; i < members.length; i++) { const stI = fight(members[0].id); r = storyL.applyResult(lp, stI, { winner: 0 }, fakeB(stI)); }
    ok(r.league.done && lp.prog.kanto === L.length && r.badge && r.badge.kind === 'champion' && D.levelCap(lp, 'kanto') === 100, 'ganar los 5 seguidos completa la región, con el premio del Campeón; después, tope 100');
  }

  // Rutas: cada 6 horas, 4 especies reales al azar y 1 especial de la zona; con «suerte acumulada», ninguna
  // tarda demasiado en salir. Los especiales, solo donde salen en los juegos
  {
    const seq = xs => { let i = 0; return () => xs[i++ % xs.length]; };
    const at = k => D.ROT_EPOCH + k * D.ROT_MS + 1000;
    const r2 = D.NODES['k-ruta2'], w2 = D.routeWild(r2, at(10));
    ok(w2.list.length === 4 && new Set(w2.list.map(x => x.dex)).size === 4 && w2.list.every(x => r2.wild.some(([d]) => d === x.dex)) && w2.specials.map(x => x.dex).join() === '25' && w2.ends === at(11) - 1000,
      'Bosque Verde: cada tanda salen 4 de sus especies reales y su especial, Pikachu, hasta la siguiente tanda');
    ok(JSON.stringify(D.routeWild(r2, at(10))) === JSON.stringify(w2) && JSON.stringify(D.routeWild(r2, at(11)).list) !== JSON.stringify(D.routeWild(r2, at(12)).list), 'la misma tanda es igual para todos y va cambiando');
    // Suerte acumulada: en 30 días todas las especies salen y ninguna pasa más de 3 días (12 tandas) sin salir
    for (const id of ['k-ruta2', 'j-ruta32', 'k-ruta23']) {
      const n = D.NODES[id], last = {}; let gap = 0;
      for (let k = 0; k < 120; k++) { const w = D.routeWild(n, at(k)); for (const x of w.list) { gap = Math.max(gap, k - (last[x.dex] ?? -1) - 1); last[x.dex] = k; } }
      for (const [d] of n.wild) gap = Math.max(gap, 119 - (last[d] ?? -1));
      ok(gap <= 12, `${n.name}: todas sus especies salen y ninguna pasa más de 12 tandas sin salir (${gap})`);
    }
    ok(D.rollWild(r2, seq([0.99, 0.999999]), at(10)).dex === w2.list[3].dex && D.rollWild(r2, seq([0, 0]), at(10)).rare, 'en la tanda, cada especie sale según su peso y el especial, a veces');
    const lake = D.rollWild(D.NODES['j-ruta43'], seq([0, 0]));
    ok(lake.dex === 130 && lake.shiny && lake.rare, 'el especial del Lago de la Furia es el Gyarados rojo (shiny)');
    const roam = D.routeWild(D.NODES['j-ruta29']);
    ok(roam.roam.join() === '243,244,245' && !D.routeWild(D.NODES['k-ruta1']).roam.length && D.rollWild(D.NODES['j-ruta29'], seq([roam.chance + 0.001, 0])).dex === 243, 'Raikou, Entei y Suicune vagan por las rutas de Johto (no por Kanto)');
    const safari = new Set(); for (let k = 0; k < 40; k++) safari.add(D.routeWild(D.NODES['k-safari'], at(k)).specials[0].dex);
    ok(safari.size === 6, 'los 6 especiales de la Zona Safari se van turnando');
    ok(!Object.values(D.ROUTE_SPECIALS).flat().some(x => [150, 151, 250].includes(x.dex || x)), 'Mewtwo, Mew y Ho-Oh no salen en las rutas');
  }
  ok(D.DEX_TOTAL === 251 && D.dexCount({ caught: [1, 152, 252, 448] }) === 2, 'la Pokédex cuenta solo las generaciones con región abierta (Gen 1 y 2)');
  // Datos de equilibrio: lo que cuenta un combate (los lados de la IA no) y el resumen del panel
  {
    const bal = require('../server/balance.js');
    const fake = { mode: 'prueba', sides: [{ idx: 0, ai: null, team: [{ dex: 6, fainted: false }] }, { idx: 1, ai: 0.5, team: [{ dex: 9, fainted: true }] }],
      stats: { mons: [{ 0: { dmg: 120, taken: 30, kos: 1, out: 1 } }, { 0: { dmg: 30, taken: 120, kos: 0, out: 1 } }], moves: [{ lanzallamas: { casts: 4, landed: 3, dmg: 120, kos: 1 } }, { pistolaAgua: { casts: 2, landed: 1, dmg: 30, kos: 0 } }] } };
    bal.battle(fake, { winner: 0 }); bal.battle(fake, { winner: 1 });
    bal.draft('prueba', [[6, 25, 3], [9, 4, 1]], [150, 149]);
    bal.leader(D.NODES.brock, true); bal.leader(D.NODES.brock, false);
    const sm = bal.summary(7, 'prueba'), zard = sm.mons.find(x => x.dex === 6), fl = sm.moves.find(x => x.key === 'lanzallamas');
    ok(zard.games === 2 && zard.wins === 1 && zard.dmg === 240 && zard.kos === 2 && zard.picked === 1 && !sm.mons.find(x => x.dex === 9 && x.games), 'balance: partidas, victorias, daño y KOs de cada Pokémon del jugador (la IA no cuenta)');
    ok(fl.casts === 8 && fl.landed === 6 && !sm.moves.find(x => x.key === 'pistolaAgua') && sm.mons.find(x => x.dex === 150).banned === 1 && sm.all.battles === 2 && sm.all.drafts === 1, 'balance: usos y aciertos de cada movimiento, vetos y totales');
    const lid = bal.summary(7, 'lider').leaders.find(x => x.id === 'brock');
    ok(lid.tries === 2 && lid.wins === 1 && lid.name === 'Brock', 'balance: intentos y victorias contra cada líder');
  }

  // Mensajes basura no tumban el servidor
  const g = new Client(port); await g.open();
  g.ws.send('no es json'); g.send({ t: 'in', mx: 'x', a: null }); g.send({ t: 'story', a: 'buy', id: { x: 1 } }); g.send({ foo: 1 });
  const hello = await g.req({ t: 'hello', name: '<script>alert(1)</script>'.repeat(3) });
  ok(hello.p.name.length <= 16, 'nombre recortado a 16 caracteres');

  console.log(failures ? `\n${failures} fallos` : '\nTodo correcto');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
