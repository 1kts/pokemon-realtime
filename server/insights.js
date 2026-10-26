// Datos para mejorar el juego (pestañas Progreso, Colección y Economía del panel de admin), calculados al momento a
// partir de todos los perfiles. Solo totales y repartos: hasta dónde llega la gente, dónde lo deja, qué Pokémon tiene
// y usa, y cómo va la economía. Nada de quién es quién (para eso está la ficha de cada jugador).
const D = require('../public/data.js');

const DAY = 864e5;
const median = xs => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pctl = (xs, q) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const count = (map, k, n = 1) => map.set(k, (map.get(k) || 0) + n);
const top = (map, n = 40) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const monName = dex => (D.SPECIES[dex] || { name: '#' + dex }).name;
// Repartos en tramos: [[etiqueta, desde, hasta (incluido)], …]
const buckets = (vals, edges) => edges.map(([label, lo, hi]) => ({ label, n: vals.filter(v => v >= lo && v <= hi).length }));

// Último día que entró (de p.act, o p.seen)
const lastSeen = p => Math.max(p.seen || 0, ...Object.keys(p.act || {}).map(k => Date.parse(k)));

// Filtro de quién cuenta: todos, activos en los últimos 30 días o solo cuentas
function pick(profiles, who) {
  const now = Date.now();
  // El personal (admins con «Desbloquear todo») no cuenta: lo tiene todo y falsearía los datos
  const all = [...profiles].filter(p => !p.staff && !p.npc);   // ni el personal ni los entrenadores IA   // (store.all() es un iterador: su filter no da una lista)
  if (who === 'activos') return all.filter(p => now - lastSeen(p) < 30 * DAY);
  if (who === 'cuentas') return all.filter(p => p.account);
  return all;
}

// ---------- Progreso: hasta dónde llega la gente y dónde lo deja ----------
function progress(profiles, who = '') {
  const ps = pick(profiles, who), now = Date.now();
  const n = ps.length || 1;
  const regions = D.REGION_IDS.filter(r => D.REGIONS[r] && D.leadersOf(r).length);
  const leaders = Object.fromEntries(regions.map(r => [r, D.leadersOf(r)]));
  const prog = (p, r) => D.progOf(p, r);
  const online = p => (p.wins || 0) + (p.losses || 0) + (p.history || []).length > 0;
  // Embudo: cada paso, cuántos lo han hecho (en orden de juego)
  const steps = [
    ['Han entrado', () => true],
    ['Tutorial hecho', p => !!p.tutorial],
    ['Han capturado un Pokémon', p => (p.caught || []).length >= 2],
  ];
  for (const r of regions) {
    const name = D.REGIONS[r].name, L = leaders[r].length;
    steps.push([`${name}: 1.ª medalla`, p => prog(p, r) >= 1], [`${name}: 4 medallas`, p => prog(p, r) >= 4], [`${name}: 8 medallas`, p => prog(p, r) >= D.LEAGUE_FROM],
      [`${name}: Campeón`, p => prog(p, r) >= L]);
  }
  steps.push(['Han jugado la Torre', p => (p.tower && p.tower.runs) > 0], ['Han jugado online', online], ['Tienen cuenta', p => !!p.account]);
  const funnel = steps.map(([label, f]) => ({ label, n: ps.filter(f).length }));

  // Medallas por región: cuántos jugadores tienen 0, 1, 2…; y de los que llevan 7 días sin entrar, dónde se quedaron
  const gone = ps.filter(p => now - lastSeen(p) >= 7 * DAY);
  const byRegion = regions.map(r => {
    const L = leaders[r].length;
    const dist = Array.from({ length: L + 1 }, (_, i) => ({ label: i === 0 ? 'Ninguna' : i <= D.LEAGUE_FROM ? `${i} medalla${i > 1 ? 's' : ''}` : i === L ? 'Campeón' : `Liga ${i - D.LEAGUE_FROM}/${L - D.LEAGUE_FROM}`,
      next: leaders[r][i] ? leaders[r][i].leader : null, n: 0, gone: 0 }));   // next: el líder que le toca (el muro, si se quedan ahí)
    for (const p of ps) dist[Math.min(L, prog(p, r))].n++;
    for (const p of gone) dist[Math.min(L, prog(p, r))].gone++;
    return { region: r, name: D.REGIONS[r].name, dist };
  });

  // Pokédex, nivel máximo, Torre, Clasificatoria, racha diaria y días jugados
  const dex = ps.map(p => D.dexCount(p));
  const maxLv = ps.map(p => Math.max(0, ...(p.mons || []).map(m => m.level)));
  const towerBest = ps.map(p => (p.tower && p.tower.best) || 0);
  const days = ps.map(p => Object.keys(p.act || {}).length);
  const leagues = new Map();
  for (const p of ps.filter(p => p.ranked > 0)) count(leagues, (D.leagueOf(p.elo) || { name: '—' }).name);
  return {
    who, players: ps.length, gone: gone.length, funnel, byRegion,
    dex: { median: median(dex), p90: pctl(dex, 0.9), total: D.DEX_TOTAL,
      dist: buckets(dex, [['1', 0, 1], ['2–5', 2, 5], ['6–20', 6, 20], ['21–50', 21, 50], ['51–100', 51, 100], ['101–200', 101, 200], ['Más de 200', 201, 1e9]]) },
    level: { median: median(maxLv), dist: buckets(maxLv, [['1–10', 0, 10], ['11–20', 11, 20], ['21–30', 21, 30], ['31–40', 31, 40], ['41–50', 41, 50], ['51–70', 51, 70], ['71–100', 71, 100]]) },
    tower: { players: towerBest.filter(x => x > 0).length, median: median(towerBest.filter(x => x > 0)),
      dist: buckets(towerBest, [['Sin jugar', 0, 0], ['1–6', 1, 6], ['7–13', 7, 13], ['14–20', 14, 20], ['21 (Cerebro)', 21, 21], ['22–48', 22, 48], ['49 o más', 49, 1e9]]) },
    ranked: { players: ps.filter(p => p.ranked > 0).length, online: ps.filter(online).length, leagues: top(leagues).map(([name, n]) => ({ label: name, n })) },
    days: { median: median(days), dist: buckets(days, [['1 día', 0, 1], ['2–3', 2, 3], ['4–7', 4, 7], ['8–14', 8, 14], ['15–35', 15, 1e9]]) },
    streak: buckets(ps.map(p => (p.daily && p.daily.streak) || 0), [['Sin racha', 0, 0], ['1–2 días', 1, 2], ['3–6', 3, 6], ['7 o más', 7, 1e9]]),
    missions: missionStats(ps),
    n,
  };
}

// Misiones: cuántas de las diarias de hoy y de las semanales de esta semana se han completado y recogido
function missionStats(ps) {
  const out = new Map();
  for (const p of ps) {
    const m = p.missions;
    if (!m) continue;
    for (const [list, kind] of [[m.daily, 'Diaria'], [m.weekly, 'Semanal']]) for (const x of list || []) {
      const def = (D.MISSION_BY_ID || {})[x.id];
      if (!def) continue;
      const k = x.id;
      const r = out.get(k) || { id: k, kind, label: String(def.name || k).replace('{n}', def.goal).replace(' {type}', ''), goal: def.goal, given: 0, done: 0, claimed: 0 };
      r.given++; if (x.n >= def.goal) r.done++; if (x.claimed) r.claimed++;
      out.set(k, r);
    }
  }
  return [...out.values()].sort((a, b) => b.given - a.given);
}

// ---------- Colección: qué Pokémon tiene la gente y cuáles usa ----------
function collection(profiles, who = '') {
  const ps = pick(profiles, who);
  const owned = new Map(), inTeam = new Map(), pvp = new Map(), starters = new Map(), mastery = new Map(), shinies = new Map(), skins = new Map();
  let mons = 0, shiny = 0, nick = 0;
  for (const p of ps) {
    const seen = new Set();
    for (const m of p.mons || []) {
      mons++; if (m.shiny) { shiny++; count(shinies, m.dex); } if (m.nick) nick++;
      if (!seen.has(m.dex)) { seen.add(m.dex); count(owned, m.dex); }
    }
    const byUid = new Map((p.mons || []).map(m => [m.uid, m]));
    for (const list of Object.values(p.teams || {})) for (const uid of list || []) { const m = byUid.get(uid); if (m) count(inTeam, m.dex); }
    for (const x of p.pvpTeam || []) count(pvp, x.dex);
    for (const dex of Object.values(p.starters || {})) count(starters, dex);
    if (p.starter && !Object.keys(p.starters || {}).length) count(starters, p.starter);
    for (const [line, wins] of Object.entries(p.mastery || {})) count(mastery, +line, wins);
    for (const id of Object.keys(p.skins || {})) count(skins, String(id).split(':')[0]);
  }
  const list = (map, n = 40) => top(map, n).map(([dex, v]) => ({ dex: +dex, name: monName(dex), n: v }));
  return {
    who, players: ps.length, mons, perPlayer: ps.length ? Math.round(mons / ps.length * 10) / 10 : 0, shiny, nick,
    owned: list(owned), inTeam: list(inTeam), pvp: list(pvp), starters: list(starters, 30), mastery: list(mastery), shinies: list(shinies, 20),
    skins: top(skins, 20).map(([kind, n]) => ({ label: kind, n })),
  };
}

// ---------- Economía: dinero, gemas, objetos, premios y cosméticos ----------
function economy(profiles, who = '') {
  const ps = pick(profiles, who);
  const coins = ps.map(p => p.coins || 0), gems = ps.map(p => p.gems || 0);
  const items = new Map(), cos = new Map(), prizes = new Map(), ach = new Map();
  let spins = 0;
  for (const p of ps) {
    for (const [id, n] of Object.entries(p.items || {})) if (n > 0) count(items, id, n);
    for (const [kind, list] of Object.entries(p.cosmetics || {})) count(cos, kind, Array.isArray(list) ? list.length : Object.keys(list || {}).length);
    for (const list of Object.values((p.treasure && p.treasure.got) || {})) for (const r of list) { spins++; count(prizes, String(r).split(':')[0]); }
    for (const id of Object.keys(p.achievements || {})) count(ach, id);
  }
  const shopName = id => (D.SHOP.find(s => s.id === id) || { name: id }).name;
  const achName = id => ((D.ACHIEVEMENTS || []).find(a => a.id === id) || { name: id }).name;
  return {
    who, players: ps.length,
    coins: { total: coins.reduce((a, b) => a + b, 0), median: median(coins), p90: pctl(coins, 0.9),
      dist: buckets(coins, [['0–999', 0, 999], ['1k–5k', 1000, 4999], ['5k–20k', 5000, 19999], ['20k–100k', 20000, 99999], ['100k o más', 100000, 1e15]]) },
    gems: { total: gems.reduce((a, b) => a + b, 0), median: median(gems), p90: pctl(gems, 0.9), spins,
      dist: buckets(gems, [['0', 0, 0], ['1–99', 1, 99], ['100–299', 100, 299], ['300–999', 300, 999], ['1000 o más', 1000, 1e15]]) },
    items: top(items, 40).map(([id, n]) => ({ label: shopName(id), n })),
    prizes: top(prizes).map(([kind, n]) => ({ label: kind, n })),
    cosmetics: top(cos).map(([kind, n]) => ({ label: kind, n })),
    achievements: top(ach, 60).map(([id, n]) => ({ label: achName(id), n })),
  };
}

module.exports = { progress, collection, economy, lastSeen };
