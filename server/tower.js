// Torre Batalla: rachas de combates seguidos contra entrenadores de la IA.
// Equipo de 3: tus Pokémon (de cualquier región, sin legendarios) o de alquiler del RANKED_POOL;
// todos normalizados a Nv.50. Durante la racha no se cambian los Pokémon, solo su orden.
// Cada 7 victorias se sube de bloque (IA más lista, rivales más fuertes) y cada 21 combates
// espera el Cerebro de la Frontera. Perder termina la racha; retirarse la guarda como récord.
// La Torre no da experiencia: los premios son dinero y objetos, así que no salta el tope de nivel.
const D = require('../public/data.js');
const store = require('./store.js');

const LEVEL = 50, BLOCK = 7, BRAIN_EVERY = 21;
const PERFECT_IV = { hp: 31, atk: 31, def: 31, spe: 31 };
// Cerebro de la Frontera: la primera vez (combate 21) su equipo de plata; después, el de oro
const BRAINS = {
  plata: { name: 'As de la Torre Moreno', symbol: 'Símbolo Plata', team: [350, 464, 149], ai: 0.88 },
  oro: { name: 'As de la Torre Moreno', symbol: 'Símbolo Oro', team: [376, 248, 445], ai: 0.95 },
};
const AI_BY_BLOCK = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.82];
const CLASSES = ['Entrenador Guay', 'Entrenadora Guay', 'Dama', 'Caballero', 'Montañero', 'Karateka', 'Científico', 'Domador',
  'Ornitólogo', 'Nadadora', 'Motorista', 'Bella', 'Médium', 'Experto', 'Pokéfan', 'Ranger', 'Psíquico', 'Dragonauta'];
const NAMES = ['Álex', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gala', 'Hugo', 'Irene', 'Jaime', 'Lola', 'Marco',
  'Nora', 'Óscar', 'Paula', 'Quique', 'Rita', 'Sergio', 'Tina', 'Úrsula', 'Víctor', 'Yago', 'Zoe'];
// Especies de los rivales: totalmente evolucionadas y no legendarias
const POOL = Object.values(D.SPECIES).filter(s => !s.leg && !s.evo);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

const blockOf = n => Math.floor((n - 1) / BLOCK);   // 0 = combates 1-7, 1 = 8-14…
const brainOf = n => n % BRAIN_EVERY === 0 ? (n === BRAIN_EVERY ? BRAINS.plata : BRAINS.oro) : null;

function state(p) {
  if (!p.tower) p.tower = { streak: 0, best: 0, bestAt: 0, bestTeam: [], team: null, next: null, wins: 0, runs: 0, symbols: [] };
  return p.tower;
}

// Rival del combate n
function trainer(n) {
  const brain = brainOf(n);
  if (brain) return { n, name: brain.name, brain: true, ai: brain.ai, team: brain.team };
  const b = blockOf(n);
  const center = Math.min(560, 430 + 25 * b);
  let list = POOL.filter(s => Math.abs(s.bst - center) <= 40);
  if (list.length < 3) list = POOL;
  const team = [];
  while (team.length < 3) { const s = pick(list); if (!team.includes(s.dex)) team.push(s.dex); }
  return { n, name: `${pick(CLASSES)} ${pick(NAMES)}`, ai: AI_BY_BLOCK[Math.min(b, AI_BY_BLOCK.length - 1)], team };
}

// El siguiente rival se decide de antemano para enseñar sus siluetas
function nextFoe(t) {
  const n = t.streak + 1;
  if (!t.next || t.next.n !== n) t.next = trainer(n);
  return t.next;
}

// Equipo: [{ uid } (tuyo) | { dex } (de alquiler)]. Devuelve { error } o { team }.
function checkTeam(p, list) {
  if (!Array.isArray(list) || list.length !== 3) return { error: 'Elige 3 Pokémon' };
  const team = [];
  for (const e of list) {
    if (e && Number.isInteger(e.uid)) {
      const m = p.mons.find(x => x.uid === e.uid);
      if (!m) return { error: 'Ese Pokémon no es tuyo' };
      if (D.SPECIES[m.dex].leg) return { error: `${D.SPECIES[m.dex].name}: los legendarios y singulares no pueden entrar en la Torre` };
      team.push({ uid: m.uid });
    } else if (e && D.RANKED_POOL.includes(e.dex)) team.push({ dex: e.dex });
    else return { error: 'Equipo no válido' };
  }
  const dexes = team.map(e => e.uid ? p.mons.find(m => m.uid === e.uid).dex : e.dex);
  if (new Set(dexes).size < 3) return { error: 'No se puede repetir especie' };
  if (new Set(team.filter(e => e.uid).map(e => e.uid)).size !== team.filter(e => e.uid).length) return { error: 'Equipo no válido' };
  return { team };
}

// Los tuyos llevan sus movimientos (completados hasta 4 con los que sabría a Nv.50), IV, EV y naturaleza;
// los de alquiler, los de su especie a Nv.50 sin extras (como en la clasificatoria)
function battleMon(p, e) {
  if (!e.uid) return { dex: e.dex, level: LEVEL, rental: true };
  const m = p.mons.find(x => x.uid === e.uid);
  if (!m) return null;
  const moves = [...new Set([...(m.moves || []), ...D.defaultMoves(m.dex, LEVEL)])].filter(k => D.MOVES[k]).slice(0, 4);
  return { dex: m.dex, level: LEVEL, uid: m.uid, moves, ev: m.ev, iv: m.iv, nat: m.nat, shiny: !!m.shiny };
}

// Acciones fuera de combate: start (elegir equipo), order (reordenar), retire. Devuelve error o null.
function action(p, msg) {
  const t = state(p);
  if (msg.a === 'start') {
    if (t.team) return 'Ya tienes una racha en curso: retírate antes para cambiar de equipo';
    const r = checkTeam(p, msg.team);
    if (r.error) return r.error;
    Object.assign(t, { team: r.team, streak: 0, next: null });
    t.runs++;
    nextFoe(t);
  } else if (msg.a === 'order') {
    const o = Array.isArray(msg.order) ? msg.order.map(Number) : [];
    if (!t.team || o.length !== 3 || [...o].sort().join() !== '0,1,2') return 'Orden no válido';
    t.team = o.map(i => t.team[i]);
  } else if (msg.a === 'retire') {
    if (!t.team) return 'No tienes ninguna racha en curso';
    endRun(p);
  } else return 'Acción desconocida';
  store.save();
  return null;
}

// Prepara el siguiente combate de la racha
function battleSetup(p) {
  const t = state(p);
  if (!t.team) return { error: 'Primero elige tu equipo para la Torre' };
  const mine = t.team.map(e => battleMon(p, e));
  if (mine.some(m => !m)) { endRun(p); return { error: 'Tu equipo de la Torre ya no está completo: la racha ha terminado' }; }
  const foe = nextFoe(t);
  return {
    foe,
    opts: {
      mode: 'tower', map: pick(Object.keys(D.MAPS)),
      sides: [
        { name: p.name, team: mine },
        { name: foe.name, team: foe.team.map(dex => ({ dex, level: LEVEL, moves: D.defaultMoves(dex, LEVEL), ...(foe.brain ? { iv: PERFECT_IV } : {}) })), ai: foe.ai },
      ],
    },
  };
}

function endRun(p) {
  const t = state(p);
  t.team = null;
  t.next = null;
  t.streak = 0;
  store.save();
}

const teamSummary = (p, team) => team.map(e => {
  if (!e.uid) return { dex: e.dex, rental: true };
  const m = p.mons.find(x => x.uid === e.uid);
  return m ? { dex: m.dex, shiny: !!m.shiny } : null;
}).filter(Boolean);

// Premios por hito: cada victoria da dinero (más cuanto más alto el bloque), cada bloque de 7
// completado un Caramelo Raro y una vitamina, y el Cerebro de la Frontera su símbolo la primera vez
function rewardsFor(t, n, foe) {
  const coins = 60 + 30 * blockOf(n) + (foe.brain ? 1000 : 0);
  const items = {};
  const add = (k, q) => { items[k] = (items[k] || 0) + q; };
  if (n % BLOCK === 0) { add('caramelo', 1); add(pick(D.SHOP.filter(i => i.vit)).id, 1); }
  let symbol = null;
  if (foe.brain) {
    const brain = brainOf(n);
    if (!t.symbols.includes(brain.symbol)) { symbol = brain.symbol; add('caramelo', 2); add('ultraball', 5); }
    else add('caramelo', 1);
  }
  return { coins, items, symbol };
}

// Resultado de un combate de la Torre. Devuelve la recompensa para el cliente.
function applyResult(p, setup, result) {
  const t = state(p);
  const n = setup.foe.n;
  const won = result.winner === 0;
  const reward = { won, tower: { n, foe: setup.foe.name, brain: !!setup.foe.brain, block: blockOf(n) + 1 } };
  if (!won) {   // derrota, empate o rendición: se acaba la racha (el récord ya está guardado)
    Object.assign(reward.tower, { streak: t.streak, best: t.best, ended: true });
    endRun(p);
    return reward;
  }
  t.streak++;
  t.wins++;
  if (t.streak > t.best) { t.best = t.streak; t.bestAt = Date.now(); t.bestTeam = teamSummary(p, t.team); reward.tower.record = true; }
  const r = rewardsFor(t, n, setup.foe);
  reward.coins = r.coins;
  p.coins += r.coins;
  if (Object.keys(r.items).length) {
    reward.items = r.items;
    for (const [k, q] of Object.entries(r.items)) p.items[k] = (p.items[k] || 0) + q;
  }
  if (r.symbol) { t.symbols.push(r.symbol); reward.tower.symbol = r.symbol; }
  if (t.streak % BLOCK === 0) reward.tower.blockUp = blockOf(t.streak + 1) + 1;
  Object.assign(reward.tower, { streak: t.streak, best: t.best });
  nextFoe(t);
  store.save();
  return reward;
}

// Lo que ve el cliente: racha, bloque y el siguiente rival (sus especies se enseñan en silueta)
function view(p) {
  const t = state(p);
  const foe = t.team ? nextFoe(t) : null;
  const n = t.streak + 1;
  return {
    streak: t.streak, best: t.best, wins: t.wins, runs: t.runs, symbols: t.symbols, bestTeam: t.bestTeam,
    team: t.team, n, block: blockOf(n) + 1, inBlock: (n - 1) % BLOCK + 1, toBrain: BRAIN_EVERY - ((n - 1) % BRAIN_EVERY) - 1,
    next: foe && { name: foe.name, brain: !!foe.brain, ai: foe.ai, team: foe.team },
  };
}

module.exports = { action, battleSetup, applyResult, endRun, state, view, trainer, checkTeam, LEVEL, BLOCK, BRAIN_EVERY, BRAINS };
