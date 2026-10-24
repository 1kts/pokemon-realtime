// Modo historia: elegir inicial, equipo, tienda, objetos, rutas con Pokémon salvajes y gimnasios.
// Todo se valida aquí; el cliente solo pide acciones.
const D = require('../public/data.js');
const store = require('./store.js');

const MAX_LEVEL = 100;

const newEv = () => ({ hp: 0, atk: 0, def: 0, spe: 0 });
// extra: { shiny, met (dónde se consiguió), iv, nat }
function addMon(p, dex, level, extra = {}) {
  const mon = { uid: p.nextUid++, dex, level, xp: 0, moves: D.defaultMoves(dex, level), ev: newEv(), iv: extra.iv || D.randomIv(), nat: extra.nat || D.randomNature(), shiny: !!extra.shiny, met: extra.met || null };
  p.mons.push(mon);
  if (p.team.length < 3) p.team.push(mon.uid);
  if (!p.caught.includes(dex)) p.caught.push(dex);
  if (mon.shiny && !(p.shinies || []).includes(dex)) p.shinies = [...(p.shinies || []), dex];
  return mon;
}

const monByUid = (p, uid) => p.mons.find(m => m.uid === uid);
// Perfiles anteriores a los movimientos por nivel: darles los que tocan por su nivel
function migrate(p) {
  for (const m of p.mons) {
    if (!Array.isArray(m.moves) || !m.moves.length) m.moves = D.defaultMoves(m.dex, m.level);
    if (!m.ev) { m.ev = newEv(); if (m.vit) { for (const k of D.STAT_KEYS) m.ev[k] = Math.min(D.EV_MAX, (m.vit[k] || 0) * D.EV_VIT); delete m.vit; } }
    if (!m.iv) m.iv = D.randomIv();
    if (!m.nat) m.nat = D.randomNature();
    if (m.shiny === undefined) m.shiny = false;
  }
  if (!p.shinies) p.shinies = [];
}
// Lo que puede llevar: lo aprendido por nivel en su especie actual más lo que ya llevaba
const learnable = mon => [...new Set([...D.learnedAt(mon.dex, mon.level), ...mon.moves])];
const teamMons = p => p.team.map(uid => monByUid(p, uid)).filter(Boolean);

// Evoluciona si toca por nivel (o con la piedra indicada). Devuelve el dex nuevo o null.
function tryEvolve(mon, stone) {
  const evo = D.SPECIES[mon.dex].evo;
  if (!evo) return null;
  const options = Array.isArray(evo[0]) ? evo : [evo];
  for (const [to, cond] of options) {
    if ((stone && cond === stone) || (!stone && typeof cond === 'number' && mon.level >= cond)) {
      mon.dex = to;
      return to;
    }
  }
  return null;
}

// Sube de nivel hasta el tope (media del siguiente gimnasio). Los movimientos nuevos se añaden
// solos si quedan huecos; si no, quedan disponibles para elegirlos en el equipo.
function levelUp(mon, cap) {
  const before = new Set(D.learnedAt(mon.dex, mon.level));
  mon.level++;
  const evolved = tryEvolve(mon, null);
  const learned = D.learnedAt(mon.dex, mon.level).filter(m => !before.has(m) && !mon.moves.includes(m));
  for (const m of learned) if (mon.moves.length < 4) mon.moves.push(m);
  return { evolved, learned };
}

function giveXp(mon, xp, cap) {
  const out = { uid: mon.uid, from: mon.dex, fromLevel: mon.level, xp, learned: [], evolved: null, cap };
  if (mon.level >= cap) { out.capped = true; out.xp = 0; out.level = mon.level; out.dex = mon.dex; return out; }
  mon.xp += xp;
  while (mon.level < cap && mon.xp >= D.xpToNext(mon.level)) {
    mon.xp -= D.xpToNext(mon.level);
    const r = levelUp(mon, cap);
    out.learned.push(...r.learned);
    out.evolved = r.evolved || out.evolved;
  }
  if (mon.level >= cap) { mon.xp = 0; out.capped = true; }
  out.level = mon.level;
  out.dex = mon.dex;
  return out;
}

// EV que dan los rivales vencidos: sus dos stats base más altas (At. Esp. cuenta como Ataque,
// Def. Esp. como Defensa), n puntos cada una.
function evYield(foes, n) {
  const gain = { hp: 0, atk: 0, def: 0, spe: 0 };
  for (const f of foes) {
    const b = (D.SPECIES[f.dex] && D.SPECIES[f.dex].base) || [0, 0, 0, 0, 0, 0];
    const four = { hp: b[0], atk: Math.max(b[1], b[3]), def: (b[2] + b[4]) / 2, spe: b[5] };
    Object.entries(four).sort((a, c) => c[1] - a[1]).slice(0, 2).forEach(([k]) => { gain[k] += n; });
  }
  return gain;
}
function addEv(mon, gain) {
  if (!mon.ev) mon.ev = newEv();
  const got = {};
  for (const k of D.STAT_KEYS) {
    const room = Math.min(D.EV_MAX - mon.ev[k], D.EV_TOTAL - D.evTotal(mon.ev));
    const add = Math.max(0, Math.min(gain[k] || 0, room));
    if (add) { mon.ev[k] += add; got[k] = add; }
  }
  return got;
}

// Acciones fuera de combate. Devuelve un mensaje de error o null.
function action(p, msg) {
  const a = msg.a;
  if (a === 'starter') {
    if (p.mons.length) return 'Ya tienes inicial';
    if (!D.STARTERS.includes(msg.dex)) return 'Inicial no válido';
    addMon(p, msg.dex, 5);
  } else if (a === 'team') {
    const uids = Array.isArray(msg.uids) ? [...new Set(msg.uids.map(Number))] : [];
    if (uids.length < 1 || uids.length > 3 || !uids.every(u => monByUid(p, u))) return 'Equipo no válido';
    p.team = uids;
  } else if (a === 'buy') {
    const item = D.SHOP.find(s => s.id === msg.id);
    const qty = Math.max(1, Math.min(99, msg.qty | 0 || 1));
    if (!item) return 'Ese objeto no existe';
    if ((item.req || 0) > p.badges) return `Necesitas ${item.req} medallas`;
    if (item.dex && qty > 1) return 'Solo uno a la vez';
    if (p.coins < item.price * qty) return 'No tienes suficiente dinero';
    p.coins -= item.price * qty;
    if (item.dex) addMon(p, item.dex, item.level);
    else p.items[item.id] = (p.items[item.id] || 0) + qty;
  } else if (a === 'use') {
    const mon = monByUid(p, msg.uid);
    const item = D.SHOP.find(s => s.id === msg.item);
    if (!mon || !item || !(p.items[item.id] > 0)) return 'No puedes usar eso';
    if (item.id === 'caramelo') {
      const cap = Math.min(MAX_LEVEL, D.levelCap(p.badges));
      if (mon.level >= cap) return `Tope de nivel ${cap}: vence al siguiente gimnasio para subir más`;
      mon.xp = 0;
      levelUp(mon, cap);
    } else if (item.stone) {
      if (!tryEvolve(mon, item.id)) return 'No tiene efecto';
    } else if (item.vit) {
      if (!mon.ev) mon.ev = newEv();
      if (mon.ev[item.vit] >= D.EV_MAX) return `Ya tiene el máximo de EV de ${D.VIT_STATS[item.vit]} (${D.EV_MAX})`;
      if (D.evTotal(mon.ev) >= D.EV_TOTAL) return `Ya tiene el máximo de EV en total (${D.EV_TOTAL}): no se pueden maxear todas las estadísticas`;
      mon.ev[item.vit] = Math.min(D.EV_MAX, mon.ev[item.vit] + Math.min(D.EV_VIT, D.EV_TOTAL - D.evTotal(mon.ev)));
    } else return 'No puedes usar eso';
    p.items[item.id]--;
  } else if (a === 'moves') {
    const mon = monByUid(p, msg.uid);
    const list = Array.isArray(msg.moves) ? [...new Set(msg.moves.map(String))] : [];
    if (!mon || list.length < 1 || list.length > 4) return 'Elige entre 1 y 4 movimientos';
    const ok = learnable(mon);
    if (!list.every(m => ok.includes(m))) return 'Ese Pokémon no sabe ese movimiento';
    mon.moves = list;
  } else if (a === 'sell') {
    const mon = monByUid(p, msg.uid);
    if (!mon || p.mons.length <= 1) return 'No puedes vender tu único Pokémon';
    p.coins += D.sellPrice(mon);
    p.mons = p.mons.filter(m => m !== mon);
    p.team = p.team.filter(u => u !== mon.uid);
    if (!p.team.length) p.team = [p.mons[0].uid];
  } else if (a === 'release') {
    const mon = monByUid(p, msg.uid);
    if (!mon || p.mons.length <= 1) return 'No puedes liberarlo';
    p.mons = p.mons.filter(m => m !== mon);
    p.team = p.team.filter(u => u !== mon.uid);
    if (!p.team.length) p.team = [p.mons[0].uid];
  } else return 'Acción desconocida';
  store.save();
  return null;
}

// Prepara un combate de historia. Devuelve { error } o { opts } para crear la Battle.
function battleSetup(p, msg) {
  const team = teamMons(p);
  if (!team.length) return { error: 'Primero elige tu Pokémon inicial' };
  migrate(p);
  const mine = { name: p.name, team: team.map(m => ({ dex: m.dex, level: m.level, uid: m.uid, moves: m.moves, ev: m.ev, iv: m.iv, nat: m.nat, shiny: m.shiny })) };
  if (msg.a === 'route') {
    const route = D.ROUTES.find(r => r.id === msg.id);
    if (!route) return { error: 'Ruta desconocida' };
    if (route.req > p.badges) return { error: `Necesitas ${route.req} medallas` };
    const wild = D.rollWild(route);
    const shiny = Math.random() < D.SHINY_RATE * (wild.rare ? 3 : 1);
    const balls = { pokeball: p.items.pokeball || 0, superball: p.items.superball || 0, ultraball: p.items.ultraball || 0 };
    return {
      kind: 'route', route,
      opts: { mode: 'wild', map: route.map, sides: [{ ...mine, balls }, { name: D.SPECIES[wild.dex].name + ' salvaje', team: [{ dex: wild.dex, level: wild.level, moves: D.defaultMoves(wild.dex, wild.level), shiny }], ai: wild.rare ? Math.min(0.5, route.ai + 0.25) : route.ai, wild: true, rare: !!wild.rare }] },
    };
  }
  if (msg.a === 'gym') {
    const i = D.GYMS.findIndex(g => g.id === msg.id);
    if (i < 0) return { error: 'Gimnasio desconocido' };
    if (i > p.badges) return { error: 'Antes tienes que vencer al anterior' };
    const g = D.GYMS[i];
    return {
      kind: 'gym', gym: g, index: i,
      opts: { mode: 'trainer', map: g.map, sides: [mine, { name: g.leader, team: g.team.map(([dex, level]) => ({ dex, level, moves: D.defaultMoves(dex, level) })), ai: g.ai }] },
    };
  }
  return { error: 'Combate desconocido' };
}

// Aplica el resultado de un combate de historia al perfil. Devuelve la recompensa para el cliente.
function applyResult(p, setup, result, battle) {
  const side = battle.sides[0];
  const reward = { coins: 0, xp: [], badge: null, captured: null, balls: null };
  // Las Poké Balls gastadas se descuentan siempre, se gane o se pierda
  if (side.balls) {
    for (const k of ['pokeball', 'superball', 'ultraball']) p.items[k] = side.balls[k] || 0;
    reward.balls = { ...side.balls };
  }
  const won = result.winner === 0;
  if (won) {
    const foes = battle.sides[1].team;
    const foeLevels = foes.reduce((s, m) => s + m.level, 0);
    if (result.captured) {
      const mon = addMon(p, result.captured.dex, result.captured.level, { shiny: !!result.captured.shiny, met: setup.route ? setup.route.id : null });
      reward.captured = { uid: mon.uid, dex: mon.dex, level: mon.level, shiny: mon.shiny, inTeam: p.team.includes(mon.uid) };
      reward.coins = 10;
    } else {
      reward.coins = setup.kind === 'gym' ? setup.gym.reward : 30 + foeLevels * 6;
    }
    if (setup.kind === 'gym' && setup.index === p.badges) {
      p.badges++;
      reward.badge = { index: setup.index, leader: setup.gym.leader, name: setup.gym.name };
    }
    // Experiencia para los que han combatido sin debilitarse; la mitad para los debilitados.
    // Nadie pasa del tope de nivel (media del siguiente gimnasio).
    const base = foeLevels * (setup.kind === 'gym' ? 30 : 18);
    const cap = Math.min(MAX_LEVEL, D.levelCap(p.badges));
    reward.cap = cap;
    const evGain = evYield(foes, setup.kind === 'gym' ? 8 : 4);
    side.team.forEach(bm => {
      const mon = monByUid(p, bm.uid);
      if (!mon) return;
      const x = giveXp(mon, Math.round(base * (bm.fainted ? 0.5 : 1)), cap);
      if (!bm.fainted) x.ev = addEv(mon, evGain);
      reward.xp.push(x);
    });
    p.coins += reward.coins;
  }
  reward.won = won;
  store.save();
  return reward;
}

module.exports = { action, battleSetup, applyResult, teamMons, migrate, learnable, devAddMon: (p, dex, level, shiny) => addMon(p, dex, level, { shiny }) };
