// Modo historia: elegir inicial, equipo, tienda, objetos, rutas con Pokémon salvajes y gimnasios.
// Todo se valida aquí; el cliente solo pide acciones.
const D = require('../public/data.js');
const store = require('./store.js');

const MAX_LEVEL = 100;

function addMon(p, dex, level) {
  const mon = { uid: p.nextUid++, dex, level, xp: 0 };
  p.mons.push(mon);
  if (p.team.length < 3) p.team.push(mon.uid);
  if (!p.caught.includes(dex)) p.caught.push(dex);
  return mon;
}

const monByUid = (p, uid) => p.mons.find(m => m.uid === uid);
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

function giveXp(mon, xp) {
  const out = { uid: mon.uid, from: mon.dex, fromLevel: mon.level, xp };
  mon.xp += xp;
  while (mon.level < MAX_LEVEL && mon.xp >= D.xpToNext(mon.level)) {
    mon.xp -= D.xpToNext(mon.level);
    mon.level++;
  }
  if (mon.level >= MAX_LEVEL) mon.xp = 0;
  out.level = mon.level;
  out.evolved = tryEvolve(mon, null);
  out.dex = mon.dex;
  return out;
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
      if (mon.level >= MAX_LEVEL) return 'Ya está al nivel máximo';
      mon.level++; mon.xp = 0;
      tryEvolve(mon, null);
    } else if (item.stone) {
      if (!tryEvolve(mon, item.id)) return 'No tiene efecto';
    } else return 'No puedes usar eso';
    p.items[item.id]--;
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
  const mine = { name: p.name, team: team.map(m => ({ dex: m.dex, level: m.level, uid: m.uid })) };
  if (msg.a === 'route') {
    const route = D.ROUTES.find(r => r.id === msg.id);
    if (!route) return { error: 'Ruta desconocida' };
    if (route.req > p.badges) return { error: `Necesitas ${route.req} medallas` };
    const wild = D.rollWild(route);
    const balls = { pokeball: p.items.pokeball || 0, superball: p.items.superball || 0, ultraball: p.items.ultraball || 0 };
    return {
      kind: 'route', route,
      opts: { mode: 'wild', map: route.map, sides: [{ ...mine, balls }, { name: D.SPECIES[wild.dex].name + ' salvaje', team: [{ dex: wild.dex, level: wild.level }], ai: wild.rare ? Math.min(0.5, route.ai + 0.25) : route.ai, wild: true, rare: !!wild.rare }] },
    };
  }
  if (msg.a === 'gym') {
    const i = D.GYMS.findIndex(g => g.id === msg.id);
    if (i < 0) return { error: 'Gimnasio desconocido' };
    if (i > p.badges) return { error: 'Antes tienes que vencer al anterior' };
    const g = D.GYMS[i];
    return {
      kind: 'gym', gym: g, index: i,
      opts: { mode: 'trainer', map: g.map, sides: [mine, { name: g.leader, team: g.team.map(([dex, level]) => ({ dex, level })), ai: g.ai }] },
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
      const mon = addMon(p, result.captured.dex, result.captured.level);
      reward.captured = { uid: mon.uid, dex: mon.dex, level: mon.level, inTeam: p.team.includes(mon.uid) };
      reward.coins = 10;
    } else {
      reward.coins = setup.kind === 'gym' ? setup.gym.reward : 30 + foeLevels * 6;
    }
    // Experiencia para los que han combatido sin debilitarse; la mitad para los debilitados
    const base = foeLevels * (setup.kind === 'gym' ? 30 : 18);
    side.team.forEach(bm => {
      const mon = monByUid(p, bm.uid);
      if (mon) reward.xp.push(giveXp(mon, Math.round(base * (bm.fainted ? 0.5 : 1))));
    });
    if (setup.kind === 'gym' && setup.index === p.badges) {
      p.badges++;
      reward.badge = { index: setup.index, leader: setup.gym.leader, name: setup.gym.name };
    }
    p.coins += reward.coins;
  }
  reward.won = won;
  store.save();
  return reward;
}

module.exports = { action, battleSetup, applyResult, teamMons };
