// Modo historia: elegir inicial, equipo, tienda, objetos, rutas con Pokémon salvajes y gimnasios.
// Todo se valida aquí; el cliente solo pide acciones.
const D = require('../public/data.js');
const store = require('./store.js');
const missions = require('./missions.js');

const MAX_LEVEL = 100;

const newEv = () => ({ hp: 0, atk: 0, def: 0, spe: 0 });
// extra: { region (a la que pertenece: no viaja a otras), shiny, met (dónde se consiguió), iv, nat }
function addMon(p, dex, level, extra = {}) {
  const region = D.REGIONS[extra.region] ? extra.region : 'kanto';
  const mon = { uid: p.nextUid++, dex, level, xp: 0, region, moves: D.defaultMoves(dex, level), ev: newEv(), iv: extra.iv || D.randomIv(), nat: extra.nat || D.randomNature(), shiny: !!extra.shiny, met: extra.met || null };
  p.mons.push(mon);
  if (!p.teams) p.teams = {};
  const team = p.teams[region] = p.teams[region] || [];
  if (team.length < 3) team.push(mon.uid);
  if (!p.caught.includes(dex)) { p.caught.push(dex); missions.track(p, 'dex'); }
  if (mon.shiny && !(p.shinies || []).includes(dex)) p.shinies = [...(p.shinies || []), dex];
  return mon;
}

const monByUid = (p, uid) => p.mons.find(m => m.uid === uid);
// En el equipo de una racha de la Torre Batalla en curso (ver tower.js)
const inTower = (p, uid) => !!(p.tower && p.tower.team && p.tower.team.some(e => e.uid === uid));
// Perfiles anteriores a los movimientos por nivel: darles los que tocan por su nivel
function migrate(p) {
  for (const m of p.mons) {
    if (!Array.isArray(m.moves) || !m.moves.length) m.moves = D.defaultMoves(m.dex, m.level);
    if (!m.ev) { m.ev = newEv(); if (m.vit) { for (const k of D.STAT_KEYS) m.ev[k] = Math.min(D.EV_MAX, (m.vit[k] || 0) * D.EV_VIT); delete m.vit; } }
    if (!m.iv) m.iv = D.randomIv();
    if (!m.nat) m.nat = D.randomNature();
    if (m.shiny === undefined) m.shiny = false;
    if (!m.region) m.region = 'kanto';   // los Pokémon de antes de las regiones eran de Kanto
  }
  // Equipo por región (antes: uno solo)
  if (!p.teams) p.teams = { kanto: (p.team || []).slice() };
  for (const r of D.REGION_IDS) {
    p.teams[r] = (p.teams[r] || []).filter(u => { const m = monByUid(p, u); return m && m.region === r; });
    if (!p.teams[r].length) { const first = p.mons.find(m => m.region === r); if (first) p.teams[r] = [first.uid]; }
  }
  p.team = p.teams.kanto;
  if (!p.starters) p.starters = p.starter ? { kanto: p.starter } : {};
  if (!p.shinies) p.shinies = [];
  // Progreso por región (antes: un solo contador de medallas de Kanto)
  if (!p.prog) p.prog = { kanto: p.badges || 0 };
  for (const r of D.REGION_IDS) if (p.prog[r] === undefined) p.prog[r] = 0;
  syncBadges(p);
}
// p.badges = medallas de la región más avanzada (para los requisitos de la tienda)
function syncBadges(p) { p.badges = Math.max(0, ...D.REGION_IDS.map(r => Math.min(8, p.prog[r] || 0))); }
// Lo que puede llevar: lo aprendido por nivel en su especie actual más lo que ya llevaba
const learnable = mon => [...new Set([...D.learnedAt(mon.dex, mon.level), ...mon.moves])];
const teamMons = (p, region = 'kanto') => ((p.teams && p.teams[region]) || []).map(uid => monByUid(p, uid)).filter(Boolean);
const regionMons = (p, region) => p.mons.filter(m => m.region === region);
// Quita un Pokémon del perfil y de su equipo
function removeMon(p, mon) {
  p.mons = p.mons.filter(m => m !== mon);
  const team = p.teams[mon.region] = (p.teams[mon.region] || []).filter(u => u !== mon.uid);
  if (!team.length) { const first = regionMons(p, mon.region)[0]; if (first) team.push(first.uid); }
  p.team = p.teams.kanto || [];
}

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

// Acciones fuera de combate. Devuelve un mensaje de error o null.
function action(p, msg) {
  const a = msg.a;
  migrate(p);
  const region = D.REGIONS[msg.region] ? msg.region : 'kanto';
  if (a === 'starter') {
    if (regionMons(p, region).length) return `Ya tienes inicial en ${D.REGIONS[region].name}`;
    if (!D.REGION_STARTERS[region].includes(msg.dex)) return 'Inicial no válido';
    addMon(p, msg.dex, 5, { region });
    p.starters[region] = msg.dex;
    if (region === 'kanto') p.starter = msg.dex;
  } else if (a === 'appearance') {
    // Ver un shiny con sus colores normales o shiny (también en combate); sigue contando como shiny
    const mon = monByUid(p, msg.uid | 0);
    if (!mon) return 'Ese Pokémon no es tuyo';
    if (!mon.shiny) return 'Solo los Pokémon shiny pueden cambiar de aspecto';
    if (msg.plain) mon.plain = true; else delete mon.plain;
  } else if (a === 'team') {
    const uids = Array.isArray(msg.uids) ? [...new Set(msg.uids.map(Number))] : [];
    if (uids.length < 1 || uids.length > 3 || !uids.every(u => { const m = monByUid(p, u); return m && m.region === region; })) return 'Equipo no válido (máximo 3, todos de la misma región)';
    p.teams[region] = uids;
    p.team = p.teams.kanto || [];
  } else if (a === 'buy') {
    const item = D.SHOP.find(s => s.id === msg.id) || D.shopMons().find(s => s.id === msg.id);
    const qty = Math.max(1, Math.min(99, msg.qty | 0 || 1));
    if (!item) return 'Ese objeto no existe';
    if ((item.req || 0) > p.badges) return `Necesitas ${item.req} medallas`;
    if (item.dex && qty > 1) return 'Solo uno a la vez';
    // Pokémon del día: uno de cada por día y jugador
    const today = D.dayKey();
    if (!p.shopBought || p.shopBought.day !== today) p.shopBought = { day: today, ids: [] };
    if (item.daily && p.shopBought.ids.includes(item.id)) return 'Ya lo has comprado hoy: mañana habrá otros';
    if (p.coins < item.price * qty) return 'No tienes suficiente dinero';
    p.coins -= item.price * qty;
    if (item.daily) {
      p.shopBought.ids.push(item.id);
      addMon(p, item.dex, Math.min(MAX_LEVEL, D.levelCap(p, region)), { region, iv: { ...D.PERFECT_IVS } });
    } else if (item.dex) addMon(p, item.dex, item.level, { region });
    else p.items[item.id] = (p.items[item.id] || 0) + qty;
  } else if (a === 'use') {
    const mon = monByUid(p, msg.uid);
    const item = D.SHOP.find(s => s.id === msg.item);
    if (!mon || !item || !(p.items[item.id] > 0)) return 'No puedes usar eso';
    if (item.id === 'caramelo') {
      const cap = Math.min(MAX_LEVEL, D.levelCap(p, mon.region));
      if (mon.level >= cap) return `Tope de nivel ${cap} en ${D.REGIONS[mon.region].name}: vence al siguiente líder para subir más`;
      mon.xp = 0;
      if (levelUp(mon, cap).evolved) missions.track(p, 'evolve');
      missions.track(p, 'level');
    } else if (item.stone) {
      if (!tryEvolve(mon, item.id)) return 'No tiene efecto';
      missions.track(p, 'evolve');
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
    if (mon && inTower(p, mon.uid)) return 'Está en tu equipo de la Torre Batalla: retírate antes';
    if (!mon || p.mons.length <= 1) return 'No puedes vender tu único Pokémon';
    if (regionMons(p, mon.region).length <= 1) return `Es tu único Pokémon de ${D.REGIONS[mon.region].name}`;
    p.coins += D.sellPrice(mon);
    removeMon(p, mon);
  } else if (a === 'release') {
    const mon = monByUid(p, msg.uid);
    if (mon && inTower(p, mon.uid)) return 'Está en tu equipo de la Torre Batalla: retírate antes';
    if (!mon || regionMons(p, mon.region).length <= 1) return 'No puedes liberarlo';
    removeMon(p, mon);
  } else return 'Acción desconocida';
  store.save();
  return null;
}

// Prepara un combate de historia. Devuelve { error } o { opts } para crear la Battle.
function battleSetup(p, msg) {
  migrate(p);
  const node = D.NODES[msg.id];
  if (!node) return { error: 'Lugar desconocido' };
  // Solo se combate con Pokémon de la región del lugar
  const team = teamMons(p, node.region);
  if (!team.length) return { error: `Primero elige tu Pokémon inicial de ${D.REGIONS[node.region].name}` };
  const mine = { name: p.name, team: team.map(m => ({ dex: m.dex, level: m.level, uid: m.uid, moves: m.moves, ev: m.ev, iv: m.iv, nat: m.nat, shiny: D.looksShiny(m), skin: D.skinOf(p, m.dex) })) };
  if (msg.a === 'route') {
    const route = node && node.kind === 'route' ? node : null;
    if (!route) return { error: 'Ruta desconocida' };
    if (route.req > D.progOf(p, route.region)) return { error: `Necesitas ${route.req} medallas de ${D.REGIONS[route.region].name}` };
    const wild = D.rollWild(route);
    const shiny = Math.random() < D.SHINY_RATE * (wild.rare ? 3 : 1);
    const perfect = !!wild.rare && Math.random() < D.RARE_PERFECT;
    const balls = { pokeball: p.items.pokeball || 0, superball: p.items.superball || 0, ultraball: p.items.ultraball || 0 };
    return {
      kind: 'route', route,
      opts: { mode: 'wild', map: 'r:' + route.id, sides: [{ ...mine, balls }, { name: D.SPECIES[wild.dex].name + ' salvaje', team: [{ dex: wild.dex, level: wild.level, moves: D.defaultMoves(wild.dex, wild.level), shiny, iv: perfect ? { ...D.PERFECT_IVS } : undefined }], ai: wild.rare ? Math.min(0.5, route.ai + 0.25) : route.ai, wild: true, rare: !!wild.rare, perfect }] },
    };
  }
  if (msg.a === 'gym') {
    if (!node || node.kind === 'route') return { error: 'Gimnasio desconocido' };
    if (node.index > D.progOf(p, node.region)) return { error: 'Antes tienes que vencer al anterior' };
    const lt = D.leaderTeam(node, p.starters[node.region] || (team[0] && team[0].dex));
    return {
      kind: 'gym', gym: node, index: node.index, region: node.region,
      opts: { mode: 'trainer', map: node.map, sides: [mine, { name: node.leader, team: lt.map(([dex, level]) => ({ dex, level, moves: D.defaultMoves(dex, level), ...D.leaderExtras(node) })), ai: node.ai }] },
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
      const region = setup.route ? setup.route.region : 'kanto';
      const mon = addMon(p, result.captured.dex, result.captured.level, { region, shiny: !!result.captured.shiny, iv: result.captured.iv, met: setup.route ? setup.route.id : null });
      reward.captured = { uid: mon.uid, dex: mon.dex, level: mon.level, shiny: mon.shiny, perfect: D.STAT_KEYS.every(k => mon.iv[k] === D.IV_MAX), inTeam: p.teams[region].includes(mon.uid) };
      reward.coins = 10;
    } else {
      reward.coins = setup.kind === 'gym' ? setup.gym.reward : 30 + foeLevels * 6;
    }
    if (setup.kind === 'gym') {
      migrate(p);
      const first = setup.index === p.prog[setup.region];
      if (first) {
        p.prog[setup.region]++;
        syncBadges(p);
        reward.badge = { region: setup.region, index: setup.index, leader: setup.gym.leader, name: setup.gym.badge || setup.gym.name, kind: setup.gym.kind };
        // Premio del líder la primera vez: Caramelo Raro y una vitamina (el Campeón, más)
        const vit = D.SHOP.filter(i => i.vit)[Math.floor(Math.random() * 4)].id;
        reward.items = setup.gym.kind === 'champion' ? { caramelo: 3, [vit]: 2, ultraball: 5 } : { caramelo: 1, [vit]: 1 };
        for (const [k, n] of Object.entries(reward.items)) p.items[k] = (p.items[k] || 0) + n;
      } else reward.coins = Math.round(reward.coins / 2);   // revancha: la mitad del dinero
    }
    // Experiencia para los que han combatido sin debilitarse; la mitad para los debilitados.
    // Nadie pasa del tope de nivel (media del siguiente gimnasio).
    const base = foeLevels * (setup.kind === 'gym' ? 30 : 18);
    const region = setup.region || (setup.route && setup.route.region) || 'kanto';
    const cap = Math.min(MAX_LEVEL, D.levelCap(p, region));
    reward.cap = cap;
    side.team.forEach(bm => {
      const mon = monByUid(p, bm.uid);
      if (mon) reward.xp.push(giveXp(mon, Math.round(base * (bm.fainted ? 0.5 : 1)), cap));
    });
    p.coins += reward.coins;
    // Misiones: lo conseguido en el combate
    const teamTypes = missions.typesOf(side.team.map(bm => (monByUid(p, bm.uid) || bm).dex));
    if (result.captured) missions.track(p, 'catch', 1, missions.typesOf([result.captured.dex]));
    else if (setup.kind === 'route') missions.track(p, 'wild');
    if (setup.kind === 'gym') missions.track(p, 'gym');
    missions.track(p, 'win', 1, teamTypes);
    missions.track(p, 'level', reward.xp.reduce((a, x) => a + x.level - x.fromLevel, 0));
    missions.track(p, 'evolve', reward.xp.filter(x => x.evolved).length);
  }
  reward.won = won;
  store.save();
  return reward;
}

module.exports = { action, battleSetup, applyResult, teamMons, migrate, learnable, devAddMon: (p, dex, level, shiny, region) => addMon(p, dex, level, { shiny, region }) };
