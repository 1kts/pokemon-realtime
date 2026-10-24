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

check('cada líder pelea en la arena de su tipo', () => {
  for (const n of Object.values(D.NODES)) if (n.kind !== 'route') assert.strictEqual(n.map, 'g-' + n.type, n.id);
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

console.log(`\n${ok} pruebas de arenas correctas`);
