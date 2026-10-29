// Ajuste de la IA jugando IA contra IA a toda velocidad: la simulación del servidor (server/battle.js) sin red ni
// temporizador, repartida en hilos. Cada combate lleva su semilla (equipos, arena y Math.random), así que dos
// versiones de la IA juegan exactamente los mismos combates y se comparan sin tanto ruido.
//
//   node tools/ai-tune.js compare [--skill 0.85] [--games 2000] [--a game|base|tuned|archivo.json] [--b base|…]
//        tasa de victorias de A contra B (mismos equipos y arenas; cada combate se juega dos veces cambiando
//        quién lleva cada lado)
//   node tools/ai-tune.js strength [--skill 0.85] [--gens 10] [--pop 10] [--games 400] [--from archivo.json] [--out archivo.json]
//        búsqueda evolutiva de los parámetros de server/ai.js (BASE_PARAMS) contra la IA de siempre
//   node tools/ai-tune.js sweep [--skill 0.85] [--games 600] [--from …] [--out archivo.json]
//        cada parámetro a medio camino de su extremo bajo y del alto, uno a uno: cuáles importan y hacia dónde
//   node tools/ai-tune.js leaders [--games 300] [--ref 0.5]
//        tasa de victorias de un jugador de referencia contra cada líder, Alto Mando y Campeón
//   node tools/ai-tune.js calibrate [--games 300] [--ref 0.5]
//        busca la habilidad de cada líder para que esa tasa siga la curva TARGET (para LEADER_AI de public/data.js)
//
// Jugador de referencia: una IA de habilidad --ref sin la dificultad adaptativa (una persona no afloja cuando gana),
// con un equipo como el de un jugador que llega a ese líder: su inicial y dos Pokémon de las rutas ya abiertas, al
// tope de nivel y evolucionados por nivel. No es una persona, pero sirve para comparar líderes entre sí.
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const D = require('../public/data.js');
const S = require('../public/shared.js');
const AI = require('../server/ai.js');

// Generador con semilla (mulberry32): el mismo número da el mismo combate
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- Hilo que juega combates ----------
if (!isMainThread) {
  const { Battle } = require('../server/battle.js');
  parentPort.on('message', jobs => {
    const out = jobs.map(job => {
      Math.random = rng(job.seed);
      let ended = null;
      const b = new Battle({ mode: job.mode, map: job.map, sides: job.sides, onEnd: r => { ended = r; } });
      b.stop(); b.state = 'countdown';
      for (let t = 0; !ended && t < S.TICK * 300; t++) b.tick();
      return ended ? ended.winner : -1;
    });
    parentPort.postMessage(out);
  });
  return;
}

// ---------- Reparto en hilos ----------
const THREADS = Math.max(1, Math.min(+process.env.AI_TUNE_THREADS || os.cpus().length - 1, 32));
let pool = null;
function run(jobs) {
  if (!pool) pool = Array.from({ length: THREADS }, () => new Worker(__filename));
  const CHUNK = 4;
  const res = new Array(jobs.length);
  let next = 0;
  return new Promise(resolve => {
    let busy = 0;
    const feed = w => {
      if (next >= jobs.length) { if (!busy) resolve(res); return; }
      const from = next; next += CHUNK;
      busy++;
      w.once('message', out => { out.forEach((r, i) => { res[from + i] = r; }); busy--; feed(w); });
      w.postMessage(jobs.slice(from, from + CHUNK));
    };
    pool.forEach(feed);
  });
}
const done = () => { if (pool) pool.forEach(w => w.terminate()); };

// ---------- Argumentos ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (k, def) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : def; };
const pct = x => (x * 100).toFixed(1) + ' %';
const se = (p, n) => Math.sqrt(p * (1 - p) / n);   // error típico de una proporción
// base: los de siempre · tuned: los ajustados enteros · game: los que usa el juego a esa habilidad (mezcla de los dos)
const loadParams = (v, skill = 0.85) => v === 'base' || !v ? AI.BASE_PARAMS : v === 'tuned' ? AI.TUNED_PARAMS : v === 'game' ? AI.paramsFor(skill) : { ...AI.BASE_PARAMS, ...JSON.parse(fs.readFileSync(v, 'utf8')) };

// ---------- Duelo: A contra B con los mismos equipos y arenas ----------
const MAPS = [...Object.keys(D.MAPS), ...Object.keys(D.ARENAS)];
function duelJobs(A, B, skill, games, seed) {
  const r = rng(seed), jobs = [];
  const pick3 = () => { const pool = [...D.RANKED_POOL], out = []; while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out; };
  const team = dexes => dexes.map(dex => ({ dex, level: D.RANKED_LEVEL }));
  for (let g = 0; g < games / 2; g++) {
    const t1 = pick3(), t2 = pick3(), map = MAPS[Math.floor(r() * MAPS.length)], s = Math.floor(r() * 2 ** 31);
    // (los dos combates de la pareja son iguales salvo quién lleva cada lado: A juega con t1 y luego con t2)
    jobs.push({ seed: s, mode: 'practice', map, a: 0, sides: [{ name: 'A', team: team(t1), ai: skill, aiParams: A }, { name: 'B', team: team(t2), ai: skill, aiParams: B }] });
    jobs.push({ seed: s, mode: 'practice', map, a: 1, sides: [{ name: 'B', team: team(t1), ai: skill, aiParams: B }, { name: 'A', team: team(t2), ai: skill, aiParams: A }] });
  }
  return jobs;
}
// Puntuación de A: victorias + medio empate (o combate sin acabar)
async function duel(A, B, skill, games, seed) {
  const jobs = duelJobs(A, B, skill, games, seed);
  const res = await run(jobs);
  let score = 0;
  res.forEach((w, i) => { score += w < 0 ? 0.5 : w === jobs[i].a ? 1 : 0; });
  return score / jobs.length;
}

// ---------- Búsqueda evolutiva ----------
// Cada parámetro con su rango; las mutaciones son gaussianas sobre una fracción del rango
const SPACE = {
  'aggro.luchador': [0.3, 0.9], 'aggro.tanque': [0.25, 0.8], 'aggro.controlador': [0.2, 0.8], 'aggro.francotirador': [0.2, 0.8],
  wHp: [0, 1.2], wAlive: [0, 0.25], wType: [0, 0.4], wEnergy: [0, 0.6], finish: [0, 0.5], finishAt: [0.1, 0.45], lowHp: [0, 0.6], lowHpAt: [0.1, 0.5], opening: [0, 0.5],
  atacarAt: [0.5, 0.8], defenderAt: [0.15, 0.45], hyst: [0, 0.12],
  'range.luchador': [35, 120], 'range.tanque': [100, 280], 'range.controlador': [150, 320], 'range.francotirador': [170, 360],
  probeExtra: [0, 120], fleeMin: [220, 420], fleeExtra: [40, 220], strafe: [0.2, 1], strafeDefend: [0.4, 1.2],
  guard: [0, 0.4], swapType: [0, 1], swapSave: [0, 1], swapSaveAt: [0.1, 0.45],
  cadenceAttack: [-0.05, 0.25], cadenceDefend: [-0.15, 0.1], reserve: [0, 50],
  uProj: [0.3, 1.2], uBeam: [0.4, 1.4], uBeamOpen: [0.8, 2.5], uMelee: [0.6, 2], uCone: [0.6, 2], uWave: [0.5, 1.5], uWaveOpen: [0.8, 2.5],
  uDashAttack: [0.6, 2], uDashProbe: [0.2, 1.4], uAreaSelf: [0.6, 2], uArea: [0.3, 1.2], uAreaOpen: [0.8, 2.6],
  uHeal: [15, 60], healAt: [0.2, 0.6], healAtDefend: [0.35, 0.8], uBuff: [0, 30], uWall: [5, 45], uBlink: [5, 45],
  meleeDefend: [0.05, 1], bigAttack: [0.8, 2], finishMult: [1, 2.2],
};
const get = (P, k) => k.includes('.') ? P[k.split('.')[0]][k.split('.')[1]] : P[k];
function set(P, k, v) { if (k.includes('.')) { const [a, b] = k.split('.'); P[a] = { ...P[a], [b]: v }; } else P[k] = v; }
const round = (k, v) => SPACE[k][1] >= 10 ? Math.round(v) : Math.round(v * 1000) / 1000;
function mutate(P, r, sigma, rate) {
  const Q = { ...P, aggro: { ...P.aggro }, range: { ...P.range } };
  for (const [k, [lo, hi]] of Object.entries(SPACE)) {
    if (r() > rate) continue;
    const g = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    set(Q, k, round(k, Math.max(lo, Math.min(hi, get(Q, k) + g * sigma * (hi - lo)))));
  }
  if (Q.defenderAt > Q.atacarAt - 0.12) Q.defenderAt = round('defenderAt', Q.atacarAt - 0.12);
  return Q;
}
const diff = (P, Q = AI.BASE_PARAMS) => Object.fromEntries(Object.keys(SPACE).filter(k => get(P, k) !== get(Q, k)).map(k => [k, get(P, k)]));
const flat = P => { const out = {}; for (const k of Object.keys(SPACE)) set(out, k, get(P, k)); return { ...out, adapt: false }; };

// (1+λ) con revancha: cada generación prueba λ mutaciones del padre en los mismos combates; la mejor juega otra
// tanda de combates nuevos (el doble) contra la IA de siempre junto al padre, y solo lo sustituye si le gana también
// ahí. Con tan poca diferencia entre versiones, sin la revancha se elige ruido
async function strength() {
  const skill = +arg('skill', 0.85), gens = +arg('gens', 10), pop = +arg('pop', 10), games = +arg('games', 400);
  const r = rng(+arg('seed', 7));
  const base = { ...AI.BASE_PARAMS, adapt: false };
  let parent = { ...loadParams(arg('from', 'base')), adapt: false };
  const sigma = +arg('sigma', 0.15), rate = +arg('rate', 0.25);
  console.log(`Búsqueda: habilidad ${skill}, ${gens} generaciones de ${pop}, ${games} combates por candidato (${THREADS} hilos)`);
  for (let g = 0; g < gens; g++) {
    const seed = Math.floor(r() * 2 ** 31);
    const kids = Array.from({ length: pop }, () => mutate(parent, r, sigma, rate));
    const scores = [];
    for (const c of kids) scores.push(await duel(c, base, skill, games, seed));
    const bi = scores.indexOf(Math.max(...scores));
    const seed2 = Math.floor(r() * 2 ** 31);
    const sp = await duel(parent, base, skill, games * 2, seed2), sk = await duel(kids[bi], base, skill, games * 2, seed2);
    const take = sk > sp + 0.005;
    console.log(`gen ${g + 1}: mejor hijo ${pct(scores[bi])} · revancha: hijo ${pct(sk)} contra padre ${pct(sp)}${take ? ' → nuevo padre' : ''}`);
    if (take) parent = kids[bi];
  }
  const out = arg('out');
  if (out) fs.writeFileSync(out, JSON.stringify(flat(parent), null, 1));
  console.log('Cambios respecto a BASE_PARAMS:', JSON.stringify(diff(parent)));
  const val = +arg('validate', 2000);
  const w = await duel(parent, base, skill, val, 99991);
  console.log(`Validación (combates nuevos): ${pct(w)} ± ${pct(se(w, val))} en ${val} combates a habilidad ${skill}`);
}

// Barrido de uno en uno: cada parámetro en el extremo bajo y en el alto de su rango (el resto como --from), contra
// la IA de siempre en los mismos combates. Dice cuáles importan y hacia dónde; los que ayudan se pueden juntar con --out
async function sweep() {
  const skill = +arg('skill', 0.85), games = +arg('games', 600), seed = +arg('seed', 31);
  const base = { ...AI.BASE_PARAMS, adapt: false }, from = { ...loadParams(arg('from', 'base')), adapt: false };
  const ref = await duel(from, base, skill, games, seed);
  console.log(`Punto de partida: ${pct(ref)} (${games} combates por prueba, ± ${pct(se(0.5, games))})`);
  const good = {};
  for (const [k, [lo, hi]] of Object.entries(SPACE)) {
    const res = [];
    for (const v of [lo + (get(from, k) - lo) / 2, get(from, k) + (hi - get(from, k)) / 2]) {
      const P = { ...from, aggro: { ...from.aggro }, range: { ...from.range } };
      set(P, k, round(k, v));
      res.push([round(k, v), await duel(P, base, skill, games, seed)]);
    }
    const [bv, bw] = res[0][1] >= res[1][1] ? res[0] : res[1];
    if (bw > ref + 2 * se(0.5, games)) good[k] = bv;
    console.log(`${k.padEnd(20)} ${String(get(from, k)).padStart(6)}  ${res.map(([v, w]) => `${v} → ${pct(w)}`).join('   ')}${good[k] !== undefined ? '   *' : ''}`);
  }
  console.log('Mejoras claras:', JSON.stringify(good));
  const out = arg('out');
  if (out) { const P = { ...from, aggro: { ...from.aggro }, range: { ...from.range } }; for (const [k, v] of Object.entries(good)) set(P, k, v); fs.writeFileSync(out, JSON.stringify(flat(P), null, 1)); }
}

async function compareCmd() {
  const skill = +arg('skill', 0.85), games = +arg('games', 2000);
  const A = { ...loadParams(arg('a', 'game'), skill), adapt: false }, B = { ...loadParams(arg('b', 'base'), skill), adapt: false };
  const w = await duel(A, B, skill, games, +arg('seed', 4242));
  console.log(`A (${arg('a', 'game')}) contra B (${arg('b', 'base')}) a habilidad ${skill}: A gana ${pct(w)} ± ${pct(se(w, games))} de ${games} combates`);
  return w;
}

// ---------- Líderes ----------
// Evoluciona por nivel (la primera rama, como en la historia sin piedras)
function evolve(dex, level) {
  for (let k = 0; k < 3; k++) {
    const e = D.SPECIES[dex] && D.SPECIES[dex].evo;
    if (!e || typeof e[1] !== 'number' || level < e[1] || !D.SPECIES[e[0]]) break;
    dex = e[0];
  }
  return dex;
}
// Equipo del jugador de referencia al llegar a un líder: su inicial y, de 8 Pokémon al azar de las rutas ya abiertas,
// los 2 que mejor le van contra el tipo del líder (un jugador mira el tipo del gimnasio). Al tope de nivel,
// evolucionados por nivel, con IV al azar como los capturados y sin vitaminas
const typeScore = (dex, type) => Math.max(...D.SPECIES[dex].types.map(t => D.typeMult(t, [type]))) - D.typeMult(type, D.SPECIES[dex].types);
function refTeam(node, r) {
  const level = D.levelCap(node.index, node.region);
  const starters = D.REGION_STARTERS[node.region];
  const starter = starters[Math.floor(r() * starters.length)];
  const wild = D.REGIONS[node.region].nodes.filter(n => n.kind === 'route' && n.req <= node.index).flatMap(n => n.wild.map(w => w[0]));
  const cands = [];
  for (let k = 0; k < 40 && cands.length < 8; k++) {
    const d = evolve(wild[Math.floor(r() * wild.length)], level);
    if (D.lineOf(d) !== D.lineOf(starter) && !cands.some(x => D.lineOf(x) === D.lineOf(d))) cands.push(d);
  }
  cands.sort((a, b) => typeScore(b, node.type) - typeScore(a, node.type) || D.SPECIES[b].bst - D.SPECIES[a].bst);
  const iv = () => ({ hp: Math.floor(r() * 32), atk: Math.floor(r() * 32), def: Math.floor(r() * 32), spe: Math.floor(r() * 32) });
  return { starter, team: [evolve(starter, level), ...cands.slice(0, 2)].map(dex => ({ dex, level, moves: D.defaultMoves(dex, level), iv: iv() })) };
}
function leaderJobs(node, skill, ref, games, seed) {
  const r = rng(seed), jobs = [];
  for (let g = 0; g < games; g++) {
    const { starter, team } = refTeam(node, r);
    const lt = D.leaderTeam(node, starter);
    jobs.push({ seed: Math.floor(r() * 2 ** 31), mode: 'trainer', map: node.map, sides: [
      { name: 'Jugador', team, ai: ref, aiParams: { ...AI.BASE_PARAMS, adapt: false } },
      { name: node.leader, team: lt.map(([dex, level]) => ({ dex, level, moves: D.defaultMoves(dex, level), ...D.leaderExtras(node) })), ai: skill },
    ] });
  }
  return jobs;
}
async function leaderRate(node, skill, ref, games, seed) {
  const res = await run(leaderJobs(node, skill, ref, games, seed));
  return res.reduce((a, w) => a + (w === 0 ? 1 : w < 0 ? 0.5 : 0), 0) / res.length;
}
const LEADERS = () => D.REGION_IDS.flatMap(r => D.leadersOf(r));
// Curva buscada: tasa de victorias del jugador de referencia. Los primeros gimnasios se ganan casi siempre, cada
// medalla cuesta algo más y el Alto Mando y el Campeón son lo más difícil (el Campeón, menos de la mitad)
const TARGET = i => [0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.66, 0.62, 0.56, 0.53, 0.5, 0.47, 0.42][i];

async function leaders() {
  const games = +arg('games', 300), ref = +arg('ref', 0.5);
  console.log(`Jugador de referencia (habilidad ${ref}, sin adaptarse) contra cada líder, ${games} combates:`);
  for (const n of LEADERS()) {
    const w = await leaderRate(n, n.ai, ref, games, 1000 + n.index);
    console.log(`${n.region.padEnd(6)} ${String(n.index + 1).padStart(2)} ${n.leader.padEnd(10)} IA ${n.ai.toFixed(2)}  jugador gana ${pct(w).padStart(7)}  (objetivo ${pct(TARGET(n.index))})`);
  }
}

// Para cada líder, bisección en su habilidad hasta acercarse a la curva (la tasa baja al subir la habilidad). Los
// mismos combates en cada paso, para que el ruido no lo mueva. Sin salirse de una banda: un gimnasio no juega como
// un Maestro ni el Alto Mando como un novato, aunque el equipo pese más que la habilidad
const BAND = i => i < D.LEAGUE_FROM ? [0.12, 0.75] : [0.5, 0.95];
async function calibrate() {
  const games = +arg('games', 300), ref = +arg('ref', 0.5);
  const out = {};
  for (const n of LEADERS()) {
    const want = TARGET(n.index);
    let [lo, hi] = BAND(n.index), best = n.ai, bestErr = Infinity, bestW = 0;
    const seed = 2000 + n.index * 7 + n.region.length;
    for (const edge of [lo, hi]) {   // (primero los extremos: si ni así se llega, se queda en el borde)
      const w = await leaderRate(n, edge, ref, games, seed);
      if (Math.abs(w - want) < bestErr) { bestErr = Math.abs(w - want); best = edge; bestW = w; }
    }
    for (let k = 0; k < 5; k++) {
      const mid = Math.round((lo + hi) / 2 * 100) / 100;
      const w = await leaderRate(n, mid, ref, games, seed);
      if (Math.abs(w - want) < bestErr) { bestErr = Math.abs(w - want); best = mid; bestW = w; }
      if (w > want) lo = mid; else hi = mid;
    }
    out[n.id] = best;
    console.log(`${n.region.padEnd(6)} ${String(n.index + 1).padStart(2)} ${n.leader.padEnd(10)} IA ${n.ai.toFixed(2)} → ${best.toFixed(2)}  jugador gana ${pct(bestW).padStart(7)} (objetivo ${pct(want)})`);
  }
  console.log('LEADER_AI =', JSON.stringify(out));
}

(async () => {
  const t0 = Date.now();
  try {
    if (cmd === 'compare') await compareCmd();
    else if (cmd === 'strength') await strength();
    else if (cmd === 'sweep') await sweep();
    else if (cmd === 'leaders') await leaders();
    else if (cmd === 'calibrate') await calibrate();
    else { console.log('Uso: node tools/ai-tune.js compare|strength|sweep|leaders|calibrate [opciones] (ver el principio del archivo)'); process.exitCode = 2; }
  } finally { done(); }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
})();
