// Simula muchos combates IA contra IA a toda velocidad y comprueba que no haya errores:
// excepciones, posiciones NaN o fuera de la arena, PS imposibles o combates que no acaban.
// Incluye los mapas normales y las arenas de gimnasio con sus mecánicas.
//   node tools/sim-test.js [combates]
const D = require('../public/data.js');
const S = require('../public/shared.js');
const { Battle } = require('../server/battle.js');

const N = +process.argv[2] || 200;
const dexes = Object.keys(D.SPECIES).map(Number);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const stats = { done: 0, draws: 0, timeouts: 0, ticks: 0, wins: [0, 0], captures: 0, events: {} };

for (let n = 0; n < N; n++) {
  const wild = n % 4 === 0;
  const team = k => Array.from({ length: k }, () => ({ dex: pick(dexes), level: 5 + Math.floor(Math.random() * 60) }));
  let ended = null;
  const b = new Battle({
    mode: wild ? 'wild' : 'trainer', map: pick([...Object.keys(D.MAPS), ...Object.keys(D.ARENAS)]),
    sides: [
      { name: 'A', team: team(3), ai: Math.random(), balls: wild ? { pokeball: 3, superball: 1 } : null },
      { name: 'B', team: team(wild ? 1 : 3), ai: Math.random(), wild },
    ],
    onEnd: r => { ended = r; },
  });
  b.stop(); b.state = 'countdown';
  const origEv = b.ev.bind(b);
  b.ev = e => { stats.events[e.k] = (stats.events[e.k] || 0) + 1; origEv(e); };
  // La IA lanza Poké Balls de vez en cuando en combates salvajes
  const origPush = b.sides[0].inputs.push.bind(b.sides[0].inputs);
  b.sides[0].inputs.push = inp => origPush(wild && Math.random() < 0.01 ? { ...inp, c: 5 } : inp);
  let t = 0;
  try {
    while (!ended && t < 30 * 60 * 4) {
      b.tick(); t++;
      for (const s of b.sides) {
        if (!isFinite(s.x) || !isFinite(s.y)) throw new Error(`posición NaN ${s.name}`);
        if (s.x < 0 || s.y < 0 || s.x > S.ARENA.w || s.y > S.ARENA.h) throw new Error(`fuera de la arena ${s.x},${s.y}`);
        for (const m of s.team) if (!(m.hp >= 0 && m.hp <= m.maxHp)) throw new Error(`PS imposibles ${m.hp}/${m.maxHp}`);
        if (!(s.energy >= 0 && s.energy <= 100)) throw new Error(`energía ${s.energy}`);
      }
    }
  } catch (e) {
    console.error(`Combate ${n} (${b.mapName}):`, e.stack);
    process.exit(1);
  }
  stats.ticks += t;
  if (!ended) stats.timeouts++;
  else {
    stats.done++;
    if (ended.winner < 0) stats.draws++; else stats.wins[ended.winner]++;
    if (ended.captured) stats.captures++;
  }
}
console.log(JSON.stringify({ ...stats, avgSeconds: +(stats.ticks / N / 30).toFixed(1) }, null, 1));
if (stats.timeouts > N * 0.05) { console.error('Demasiados combates sin terminar'); process.exit(1); }
