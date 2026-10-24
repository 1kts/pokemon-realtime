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
function battle(map, a = [{ dex: 25, level: 30 }], b = [{ dex: 74, level: 30 }]) {
  const bt = new Battle({ mode: 'trainer', map, sides: [{ name: 'A', team: a }, { name: 'B', team: b }], onEnd: () => {} });
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

console.log(`\n${ok} pruebas de arenas correctas`);
