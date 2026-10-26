// Pruebas de las mecánicas de las arenas de gimnasio (server/arena.js y Shared.arenaStep).
//   node tools/arena-test.js
const assert = require('assert');
const D = require('../public/data.js');
const S = require('../public/shared.js');
const { Battle } = require('../server/battle.js');

const { T, COLS } = S;
let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('✓', name); };

// Combate de prueba sin temporizador: avanza a mano con tick()
function battle(map, a = [{ dex: 25, level: 30 }], b = [{ dex: 74, level: 30 }], mod = null) {
  const bt = new Battle({ mode: 'trainer', map, mod, sides: [{ name: 'A', team: a }, { name: 'B', team: b }], onEnd: () => {} });
  bt.stop();
  bt.state = 'fight';
  return bt;
}
const run = (bt, secs, inp = { mx: 0, my: 0 }) => { for (let i = 0; i < secs * S.TICK; i++) { for (const s of bt.sides) s.inputs.push({ ...inp }); bt.tick(); } };

check('cada líder pelea en la arena de su tipo y el Alto Mando en su sala', () => {
  for (const n of Object.values(D.NODES)) {
    if (n.kind === 'gym') assert.strictEqual(n.map, 'g-' + n.type, n.id);
    else if (n.kind !== 'route') assert.strictEqual(n.map, 'e-' + n.id, n.id);
  }
  for (const [id, a] of Object.entries(D.ARENAS)) {
    assert.strictEqual(a.rows.length, S.ROWS, id);
    for (const r of a.rows) assert.strictEqual(r.length, S.COLS, id);
  }
});

check('el haz del faro empieza en vertical: no pasa por donde salen los Pokémon', () => {
  for (const [id, a] of Object.entries(D.ARENAS)) {
    if (!a.mech.beam) continue;
    const bt = battle(id);
    assert(Math.abs(bt.arena.beamA - Math.PI / 2) < 1e-9, id);
    for (const s of bt.sides) { assert(Math.abs(s.x - S.COLS * S.CELL / 2) > a.mech.beam.width + 30, id + ': sale lejos de la vertical del centro'); }
  }
});

check('en hielo se resbala: al soltar sigue moviéndose', () => {
  const terrain = new Array(S.COLS * S.ROWS).fill(T.ICE);
  const p = { x: 480, y: 300 };
  for (let i = 0; i < 30; i++) S.arenaStep(p, 1, 0, 200, S.DT, [], 22, { map: 'g-hielo', terrain });
  const x0 = p.x;
  S.arenaStep(p, 0, 0, 200, S.DT, [], 22, { map: 'g-hielo', terrain });
  assert(p.x - x0 > 3, 'sigue deslizando');
  const q = { x: 480, y: 300 };
  S.arenaStep(q, 0, 0, 200, S.DT, [], 22, { map: 'pradera', terrain: new Array(S.COLS * S.ROWS).fill(T.NONE), wind: null });
  assert.strictEqual(q.x, 480, 'sin hielo se para en seco');
});

check('la corriente de la cascada arrastra', () => {
  const m = S.parseMap('g-lucha');
  const i = [...m.flow.keys()].find(k => m.flow.get(k)[1] > 0 && Math.floor(k / COLS) === 6);
  const c = S.cellCenter(i);
  const p = { x: c.x, y: c.y };
  S.arenaStep(p, 0, 0, 200, 0.2, [], 22, { map: 'g-lucha', terrain: m.terrain });
  assert(p.y > c.y + 10, 'baja con la corriente');
});

check('el teletransporte lleva a la pareja', () => {
  const bt = battle('g-psiquico');
  const [a, b] = S.parseMap('g-psiquico').pads[0];
  const s = bt.sides[0];
  s.x = a.x; s.y = a.y;
  run(bt, 0.1);
  assert(Math.hypot(s.x - b.x, s.y - b.y) < 30, `llega a la otra baldosa (${s.x},${s.y})`);
});

check('la marea sube y baja', () => {
  const bt = battle('g-agua');
  const water = () => bt.terrain.filter(t => t === T.WATER).length;
  const w0 = water();
  bt.arena.timers.tide = 0;
  run(bt, 0.1);
  assert(water() > w0, 'sube');
  bt.arena.timers.tide = 0;
  run(bt, 0.1);
  assert.strictEqual(water(), w0, 'baja');
});

check('las baldosas de curación curan y se agotan', () => {
  const bt = battle('g-normal');
  const pad = bt.arena.pads[0], s = bt.sides[0], mon = bt.mon(s);
  s.x = pad.x; s.y = pad.y;
  mon.hp = Math.round(mon.maxHp / 3);
  const hp0 = mon.hp;
  run(bt, 2);
  assert(mon.hp > hp0, 'cura');
  run(bt, 6);
  assert(pad.c <= 0 || pad.cd > 0, 'se agota');
});

check('el fuego derrite el hielo y vuelve a congelarse', () => {
  const bt = battle('g-hielo');
  const i = bt.terrain.indexOf(T.ICE);
  bt.paint(i, 'fuego');
  assert.strictEqual(bt.terrain[i], T.WATER);
  run(bt, 8);
  assert.strictEqual(bt.terrain[i], T.ICE);
});

check('el agua en la lava da vapor y la lava vuelve', () => {
  const bt = battle('g-fuego');
  const i = bt.terrain.indexOf(T.LAVA);
  bt.paint(i, 'agua');
  assert.strictEqual(bt.terrain[i], T.STEAM);
  run(bt, 5);
  assert.strictEqual(bt.terrain[i], T.LAVA);
});

check('la lava quema salvo al tipo fuego', () => {
  const bt = battle('g-fuego', [{ dex: 1, level: 30 }], [{ dex: 4, level: 30 }]);
  const i = bt.terrain.indexOf(T.LAVA), c = S.cellCenter(i);
  for (const s of bt.sides) { s.x = c.x; s.y = c.y; }
  bt.sides[1].x += 1;
  run(bt, 0.2);
  assert(bt.sides[0].burn > 0, 'Bulbasaur se quema');
  assert.strictEqual(bt.sides[1].burn, 0, 'Charmander no');
});

check('los muros invisibles bloquean', () => {
  const bt = battle('g-veneno');
  assert(bt.obstacles.some(o => o.kind === 'ghost'));
});

check('en la oscuridad no se ve al rival de lejos', () => {
  const bt = battle('g-fantasma');
  bt.sides[0].x = 100; bt.sides[1].x = 860;
  run(bt, 1.2);
  assert(bt.sides[1].hidden, 'oculto');
});

check('detrás de una roca no llega la onda del terremoto', () => {
  const bt = battle('g-tierra', [{ dex: 74, level: 30 }], [{ dex: 74, level: 30 }]);
  const rock = bt.obstacles.find(o => o.kind === 'rock');
  const E = { x: rock.x - 160, y: rock.y };               // epicentro a la izquierda de la roca
  const [hid, open] = bt.sides;
  hid.x = rock.x + rock.r + 30; hid.y = rock.y;           // a la derecha: a cubierto
  open.x = rock.x + rock.r + 30; open.y = rock.y + 140;   // más abajo: al descubierto
  bt.arena.timers.quake = 99;
  bt.arena.quakes.push({ x: E.x, y: E.y, t: 0, hit: new Set() });
  const hp = [bt.mon(hid).hp, bt.mon(open).hp];
  run(bt, 1.5);
  assert.strictEqual(bt.mon(hid).hp, hp[0], 'a cubierto no pierde PS');
  assert(bt.mon(open).hp < hp[1], 'al descubierto sí');
});

check('el Alto Mando lleva IV perfectos y EV', () => {
  const x = D.leaderExtras(D.NODES.lance);
  assert.strictEqual(x.iv.atk, D.IV_MAX);
  assert(D.evTotal(x.ev) <= D.EV_TOTAL);
  assert.deepStrictEqual(D.leaderExtras(D.NODES.brock), {});
});

check('cada ruta tiene su mapa: siempre el mismo, simétrico y con la salida libre', () => {
  const routes = Object.values(D.NODES).filter(n => n.kind === 'route');
  const seen = new Set();
  for (const n of routes) {
    const rows = S.rowsOf('r:' + n.id);
    assert.deepStrictEqual(rows, S.rowsOf('r:' + n.id), 'determinista');
    assert.strictEqual(rows.length, S.ROWS);
    const flip = { v: '^', '^': 'v' };
    rows.forEach((r, y) => { assert.strictEqual(r.length, S.COLS); for (let x = 0; x < S.COLS; x++) assert.strictEqual(r[S.COLS - 1 - x], flip[r[x]] || r[x], `${n.id} simétrico`); });
    for (const [x, y] of [[3, 7], [20, 7]]) assert.strictEqual(rows[y][x], '.', `${n.id} salida libre`);
    seen.add(rows.join(''));
  }
  assert(seen.size > routes.length * 0.9, 'casi todas distintas');
});

check('los combates de ruta usan el mapa de su ruta', () => {
  const bt = battle('r:k-ruta1');
  assert.deepStrictEqual(bt.terrain, S.parseMap('r:k-ruta1').terrain);
});

// ---------- Movimientos según lo que son ----------
// Lanza un movimiento del bando 0 contra el bando 1 en una pradera y deja pasar 'secs'
function cast(key, place, secs = 1.5, aimAt = null) {
  const bt = battle('pradera', [{ dex: 6, level: 50, moves: [key] }], [{ dex: 143, level: 50 }]);
  const [me, foe] = bt.sides;
  me.x = 200; me.y = 300; me.energy = 100;
  place(foe);
  const hp = bt.mon(foe).hp;
  const t = aimAt || foe;
  me.inputs.push({ mx: 0, my: 0, a: Math.atan2(t.y - me.y, t.x - me.x), tx: t.x, ty: t.y, c: 0, s: 1 });
  run(bt, secs);
  return { bt, me, foe, lost: hp - bt.mon(foe).hp };
}

check('el cono pega delante y no a los lados', () => {
  assert(cast('lanzallamas', f => { f.x = 380; f.y = 300; }).lost > 0, 'delante');
  assert.strictEqual(cast('lanzallamas', f => { f.x = 200; f.y = 480; }, 1.5, { x: 400, y: 300 }).lost, 0, 'al lado');
  assert.strictEqual(cast('lanzallamas', f => { f.x = 700; f.y = 300; }).lost, 0, 'fuera de alcance');
});

check('la ola es ancha: pilla aunque no esté en línea', () => {
  const r = cast('surf', f => { f.x = 520; f.y = 400; }, 2, { x: 600, y: 300 });
  assert(r.lost > 0, 'pilla de lado');
  assert(r.bt.terrain.some(t => t === S.T.WATER), 'moja el suelo');
});

check('Bomba Lodo estalla donde apuntas y deja un charco tóxico', () => {
  const r = cast('bombaLodo', f => { f.x = 430; f.y = 330; }, 2, { x: 400, y: 300 });
  assert(r.lost > 0, 'la explosión le alcanza');
  assert(r.bt.terrain.some(t => t === S.T.POISON), 'charco');
});

check('Avalancha cae en tres puntos en fila', () => {
  const bt = battle('pradera', [{ dex: 76, level: 50, moves: ['avalancha'] }], [{ dex: 143, level: 50 }]);
  const [me] = bt.sides;
  me.x = 200; me.y = 300; me.energy = 100;
  const warns = [];
  const ev = bt.ev.bind(bt); bt.ev = e => { if (e.k === 'warn') warns.push(e); ev(e); };
  me.inputs.push({ mx: 0, my: 0, a: 0, tx: 500, ty: 300, c: 0, s: 1 });
  run(bt, 1);
  assert.strictEqual(warns.length, 3);
  assert(warns.every(w => Math.abs(w.y - 300) < 2) && warns[0].x < warns[1].x && warns[1].x < warns[2].x, 'en fila');
});

check('Ida y Vuelta vuelve a su sitio', () => {
  const r = cast('idaYVuelta', f => { f.x = 330; f.y = 300; }, 1);
  assert(r.lost > 0, 'golpea');
  assert(Math.hypot(r.me.x - 200, r.me.y - 300) < 40, `vuelve (${Math.round(r.me.x)},${Math.round(r.me.y)})`);
});

check('el Pokémon misterioso sale con IV perfectos más o menos 1 de cada 3 veces', () => {
  const story = require('../server/story.js');
  const prof = { name: 'T', coins: 0, items: {}, mons: [], team: [], badges: 0, prog: { kanto: 13, johto: 0 }, nextUid: 1, caught: [] };
  story.migrate(prof);
  story.devAddMon(prof, 25, 50, false, 'kanto');
  const orig = D.rollWild;
  let n = 0, perfect = 0;
  D.rollWild = route => ({ dex: 151, level: 50, rare: true });
  try {
    for (let i = 0; i < 3000; i++) {
      const st = story.battleSetup(prof, { a: 'route', id: 'k-ruta1' });
      const foe = st.opts.sides[1];
      n++; if (foe.perfect && D.STAT_KEYS.every(k => foe.team[0].iv[k] === D.IV_MAX)) perfect++;
    }
  } finally { D.rollWild = orig; }
  assert(perfect / n > 0.28 && perfect / n < 0.39, `${perfect}/${n}`);
});

check('logros: se desbloquean una vez, su premio se recoge a mano y se pueden fijar (máx. 3)', () => {
  const rewards = require('../server/rewards.js');
  const p = { coins: 0, items: {}, mons: [{ dex: 4, iv: { hp: 31, atk: 31, def: 31, spe: 31 } }], caught: [4, 16], prog: { kanto: 13, johto: 0 }, elo: 1000, wins: 0, tower: { best: 0 } };
  rewards.migrate(p);
  assert(p.achievements.captura1 && p.achievements.kantoChamp && p.achievements.perfecto, 'desbloqueados');
  assert(p.coins === 0 && p.achClaim.includes('kantoChamp') && !p.cosmetics.frames.includes('campeon'), 'el premio espera a que se recoja');
  for (const id of [...p.achClaim]) assert(rewards.claimAchievement(p, id).loot, 'recoger ' + id);
  assert(p.cosmetics.auras.includes('dorado') && !p.cosmetics.frames.includes('campeon') && p.cosmetics.titles.includes('Campeón de Kanto') && p.cosmetics.avatars.includes('item:relic-crown'), 'premios: título, glow dorado y avatar (sin marco)');
  const coins = p.coins;
  assert(coins >= 300 + 8000 + 2000, 'dinero');
  assert(rewards.claimAchievement(p, 'kantoChamp').error, 'no se recoge dos veces');
  rewards.migrate(p);
  assert.strictEqual(p.coins, coins, 'no se cobra dos veces');
  // Medallas: cada una ganada da su avatar (una vez)
  assert.strictEqual(rewards.badgesToClaim(p).length, 8, '8 medallas de Kanto por recoger');
  assert(rewards.claimBadge(p, 'kanto', 0).loot && rewards.claimBadge(p, 'kanto', 0).error && rewards.claimBadge(p, 'johto', 0).error, 'medalla: una vez y solo si se ha ganado');
  assert.strictEqual(rewards.setLook(p, { avatar: 'badge:kanto:0' }), null);
  assert(rewards.setLook(p, { avatar: 'badge:kanto:1' }), 'no se usa un avatar sin recoger');
  // Perfiles de antes: sus logros ya cobrados no se vuelven a pagar, pero dan su avatar
  const old = { coins: 5, items: {}, mons: [], caught: [4, 16], prog: { kanto: 0 }, elo: 1000, wins: 0, tower: { best: 0 }, cosmetics: { titles: ['Novato'], frames: ['bronce'] }, achievements: { captura1: 1 } };
  rewards.migrate(old);
  assert(old.achClaim.length === 0 && old.coins === 5 && old.cosmetics.avatars.includes('item:poke-ball'), 'logros antiguos: avatar sin volver a cobrar');
  assert.strictEqual(rewards.setLook(p, { showcase: ['kantoChamp', 'perfecto'] }), null);
  assert(rewards.setLook(p, { showcase: ['dex250'] }), 'no se fija uno no conseguido');
  assert(rewards.setLook(p, { showcase: ['captura1', 'perfecto', 'kantoChamp', 'kanto8'] }), 'máximo 3');
});

// Curarse tiene precio: menos cura, más recarga y un rato aturdido (sin moverse, atacar ni proteger)
function heal(key) {
  const bt = battle('pradera', [{ dex: 9, level: 50, moves: [key] }], [{ dex: 143, level: 50 }]);
  const [me] = bt.sides;
  me.x = 200; me.y = 300; me.energy = 100; me.burn = 5;
  const mon = bt.mon(me);
  mon.hp = Math.round(mon.maxHp / 2);
  me.inputs.push({ mx: 0, my: 0, a: 0, tx: 400, ty: 300, c: 0, s: 1 });
  run(bt, D.MOVES[key].wind + 0.1);
  return { bt, me, mon };
}
check('las curas curan menos y dejan aturdido al que se cura', () => {
  const { bt, me, mon } = heal('acuaAro');
  const m = D.MOVES.acuaAro;
  assert(m.heal <= 0.25 && m.cd >= 20 && m.selfStun >= 0.8, 'curan con medida: un cuarto como mucho, con recarga larga y aturdido');
  assert(mon.hp > mon.maxHp / 2 && mon.hp <= mon.maxHp / 2 + mon.maxHp * m.heal + 1, 'cura como mucho su %');
  assert(me.stun > 0.7, 'aturdido tras curarse');
  assert(me.burn > 0, 'Acua Aro no quita la quemadura');
  const x0 = me.x;
  run(bt, 0.5, { mx: 1, my: 0 });
  assert.strictEqual(me.x, x0, 'no se mueve mientras está aturdido');
  assert(!bt.canAct(me), 'ni puede atacar');
});
check('Descanso cura más, quita estados y duerme más rato', () => {
  const { me } = heal('descanso');
  assert(me.stun > 2 && me.burn === 0, 'dormido y sin quemadura');
});

check('un proyectil que pasa rozando a un Pokémon pequeño también le da (margen de impacto)', () => {
  const bt = battle('pradera', [{ dex: 25, level: 30 }], [{ dex: 129, level: 30 }]);
  bt.obstacles = [];
  const [a, b] = bt.sides;
  a.x = 200; a.y = 300; b.x = 400; b.y = 300 + bt.rad(b) + D.MOVES.impactrueno.radius + 4;   // pasa 4 px por fuera de lo que antes contaba como impacto
  const hp0 = bt.mon(b).hp;
  bt.projectiles.push({ id: 999, owner: a, m: { ...D.MOVES.impactrueno }, mk: 'impactrueno', x: 230, y: 300, vx: 780, vy: 0, left: 400, r: D.MOVES.impactrueno.radius });
  for (let i = 0; i < 20; i++) bt.updateProjectiles(S.DT);
  assert(bt.mon(b).hp < hp0, 'le ha dado');
});

check('IA adaptativa: afloja si va arrasando y aprieta si va perdiendo, sin salirse de su margen', () => {
  const { adaptiveSkill } = require('../server/ai.js');
  const bt = battle('pradera');
  const [a, b] = bt.sides;
  b.ai = 0.6;
  const st = {};
  a.team.forEach(m => { m.hp = m.maxHp * 0.1; });   // el jugador va muy tocado
  let s1; for (let i = 0; i < 300; i++) s1 = adaptiveSkill(bt, b, st, S.DT);
  a.team.forEach(m => { m.hp = m.maxHp; }); b.team.forEach(m => { m.hp = m.maxHp * 0.1; });   // ahora pierde la IA
  let s2; for (let i = 0; i < 600; i++) s2 = adaptiveSkill(bt, b, st, S.DT);
  assert(s1 < 0.5 && s1 >= 0.6 - 0.18 - 1e-9, `afloja (${s1})`);
  assert(s2 > 0.65 && s2 <= 0.6 + 0.1 + 1e-9, `aprieta (${s2})`);
});

check('datos de equilibrio: el combate cuenta usos, aciertos, daño y KOs de cada movimiento y Pokémon', () => {
  const bt = battle('pradera', [{ dex: 25, level: 50, moves: ['impactrueno'] }], [{ dex: 129, level: 5 }]);
  bt.obstacles = [];
  const [a, b] = bt.sides;
  a.x = 200; a.y = 300; b.x = 330; b.y = 300; a.energy = 100;
  a.inputs.push({ mx: 0, my: 0, a: 0, tx: 330, ty: 300, c: 0, s: 1 });
  run(bt, 1.5);
  const mv = bt.stats.moves[0].impactrueno, me = bt.stats.mons[0][0], foe = bt.stats.mons[1][0];
  assert(mv && mv.casts === 1 && mv.landed === 1 && mv.dmg > 0, `un uso que da (${JSON.stringify(mv)})`);
  assert(me.dmg === mv.dmg && foe.taken === mv.dmg && me.out === 1, 'el daño cuenta para quien lo hace y quien lo recibe');
  if (bt.mon(b).fainted) assert(mv.kos === 1 && me.kos === 1, 'y el KO, para el movimiento y el Pokémon');
  a.inputs.push({ mx: 0, my: 0, a: Math.PI, tx: 0, ty: 300, c: 0, s: 2 });   // hacia atrás: falla
  run(bt, 1.5);
  assert(bt.stats.moves[0].impactrueno.casts >= 1 && bt.stats.moves[0].impactrueno.landed <= bt.stats.moves[0].impactrueno.casts, 'los fallos cuentan como uso sin acierto');
});

// ---------- Mecánicas nuevas ----------
const evs = bt => { const out = []; const ev = bt.ev.bind(bt); bt.ev = e => { out.push(e); ev(e); }; return out; };
const place = (s, x, y) => { s.x = x; s.y = y; s.vx = s.vy = 0; };
const runUntil = (bt, cond, secs = 30) => { for (let i = 0; i < secs * S.TICK && !cond(); i++) { for (const s of bt.sides) s.inputs.push({ mx: 0, my: 0 }); bt.tick(); } return cond(); };

check('géiseres: avisan, hacen daño y lanzan hacia fuera', () => {
  const bt = battle('g-agua', [{ dex: 25, level: 30 }], [{ dex: 74, level: 30 }]), out = evs(bt);
  const [a] = bt.sides, hp0 = bt.mon(a).hp;
  bt.arena.timers.geyser = 0;
  bt.arena.update(0.01);
  const w = out.find(e => e.k === 'warn' && e.ty === 'agua');
  assert(w, 'aviso');
  place(a, w.x + 10, w.y); a.invuln = 0;
  for (let i = 0; i < 40; i++) bt.arena.update(0.05);
  assert(out.some(e => e.k === 'geyser'), 'chorro');
  assert(bt.mon(a).hp < hp0 && a.kb && a.kb.vx > 0, 'daño y empuje hacia fuera');
});

check('hielo que se rompe: quieto encima, la casilla pasa a agua y luego vuelve a ser hielo', () => {
  const bt = battle('g-hielo');
  const [a] = bt.sides, i = bt.terrain.indexOf(T.ICE), c = S.cellCenter(i);
  place(a, c.x, c.y);
  for (let k = 0; k < 30; k++) bt.arena.update(0.05);
  assert.strictEqual(bt.terrain[i], T.WATER, 'agua');
  place(a, 480, 20);
  run(bt, 7);
  assert.strictEqual(bt.terrain[i], T.ICE, 'vuelve el hielo');
});

check('cintas transportadoras: arrastran en su sentido', () => {
  const p = { x: 300, y: 20 }, q = { x: 300, y: 13 * 40 + 20 };
  const env = { map: 'g-electrico', terrain: new Array(S.COLS * S.ROWS).fill(T.NONE) };
  S.arenaStep(p, 0, 0, 200, S.DT, [], 22, env); S.arenaStep(q, 0, 0, 200, S.DT, [], 22, env);
  assert(p.x > 300 && q.x < 300);
});

check('pilares: se turnan y sacan de dentro a quien estuviera encima', () => {
  const bt = battle('g-lucha'), out = evs(bt);
  const up0 = bt.obstacles.filter(o => o.kind === 'pillar').map(o => o.x + ',' + o.y).join();
  const spot = S.pillarSpots(D.ARENAS['g-lucha'].mech.pillars).find(p => p.g === 1);
  place(bt.sides[0], spot.x, spot.y);
  bt.arena.timers.pillars = 0;
  for (let k = 0; k < 30; k++) bt.arena.update(0.05);
  const up1 = bt.obstacles.filter(o => o.kind === 'pillar').map(o => o.x + ',' + o.y).join();
  assert(up0 && up1 && up0 !== up1, 'cambian');
  assert(out.some(e => e.k === 'warn' && e.ty === 'roca'), 'avisan');
  assert(Math.hypot(bt.sides[0].x - spot.x, bt.sides[0].y - spot.y) >= 26, 'fuera del pilar');
});

check('gravedad: avisa, atrae hacia el centro, curva los proyectiles y en el centro hace daño', () => {
  const bt = battle('g-siniestro');
  bt.arena.timers.gravity = 0;
  for (let k = 0; k < 30 && !bt.arena.pull; k++) bt.arena.update(0.05);
  assert(bt.arena.pull > 0, 'late');
  const p = { x: 200, y: 300 };
  S.arenaStep(p, 0, 0, 200, S.DT, [], 22, bt.arena.env(bt.sides[0]));
  assert(p.x > 200, 'atrae');
  const pr = { x: 480, y: 100, vx: 300, vy: 0 };
  bt.arena.bend(pr, 0.1);
  assert(pr.vy > 0 && Math.abs(Math.hypot(pr.vx, pr.vy) - 300) < 0.01, 'curva sin acelerar');
  const [a] = bt.sides, hp0 = bt.mon(a).hp;
  place(a, 480, 300); a.invuln = 0;
  bt.arena.update(0.05);
  assert(bt.mon(a).hp < hp0, 'daño en el centro');
});

check('espejos: un proyectil que choca con uno rebota', () => {
  const bt = battle('g-psiquico'), [x1, y1, x2] = S.mirrorSegs({})[0];
  const pr = { x: (x1 + x2) / 2, y: y1 + 9, vx: 0, vy: -400, r: 8 };
  assert(bt.arena.bounce(pr) && pr.vy > 0);
});

check('tormenta: el rayo que cae junto al agua electrifica a quien está en ella', () => {
  const bt = battle('lago', [{ dex: 74, level: 30 }], [{ dex: 74, level: 30 }], 'storm'), out = evs(bt);
  const w = bt.terrain.indexOf(T.WATER), c = S.cellCenter(w);
  const [a, b2] = bt.sides;
  place(b2, c.x, c.y); b2.invuln = 0;
  const hp0 = bt.mon(b2).hp;
  // (el rayo de verdad, pero forzado a caer junto al agua)
  bt.arena.timers.storm = 0;
  const realWarn = bt.arena.warnAt.bind(bt.arena);
  bt.arena.warnAt = (x, y, r, warn, ty, onHit) => realWarn(c.x + 30, c.y, r, 0.01, ty, onHit);
  bt.arena.update(0.01); bt.arena.update(0.05);
  assert(out.some(e => e.k === 'zapwater'), 'electrifica');
  assert(bt.mon(b2).hp < hp0, 'daña al del agua');
});

check('niebla: dentro de un banco no se le ve de lejos', () => {
  const bt = battle('pradera', undefined, undefined, 'fog');
  const z = S.fogZones(D.MODIFIERS.fog)[0], [a, b2] = bt.sides;
  place(a, z.x, z.y); place(b2, 900, 560); a.sinceAct = 5;
  run(bt, 0.1);
  assert(a.hidden && bt.startMsg(a).mod === 'fog');
});

check('flores: las rosas curan y las moradas adormecen', () => {
  const bt = battle('g-planta', [{ dex: 25, level: 30 }], [{ dex: 74, level: 30 }]);
  const fl = S.parseMap('g-planta').flowers, heal = fl.find(f => f.k === 'heal'), sleep = fl.find(f => f.k === 'sleep');
  const [a, b2] = bt.sides;
  bt.mon(a).hp = Math.round(bt.mon(a).maxHp / 2);
  const hp0 = bt.mon(a).hp;
  place(a, heal.x, heal.y); place(b2, sleep.x, sleep.y);
  for (let k = 0; k < 40; k++) bt.arena.update(0.05);
  assert(bt.mon(a).hp > hp0, 'cura');
  assert(b2.slow > 0, 'adormece');
});

check('los modificadores funcionan en cualquier arena', () => {
  for (const mod of Object.keys(D.MODIFIERS)) {
    const bt = battle('pradera', undefined, undefined, mod);
    assert(bt.arena.active && bt.arena.m[mod], mod);
    run(bt, 12);
  }
});

console.log(`\n${ok} pruebas de arenas correctas`);
