// Misiones diarias y semanales (los datos en Data.MISSIONS). Cada día salen 3 diarias y cada lunes
// 3 semanales; avanzan solas con lo que se hace en el juego (track) y, cumplidas, el premio se
// recoge a mano (claim). Las que no convencen se cambian por otra (reroll: unas gratis, luego
// pagando) y recoger las 3 de un tipo abre su cofre. Todo en p.missions:
//   { day, week, daily: [{ id, type?, n, claimed }], weekly: [...], rerolls: { daily, weekly }, chest: { daily, weekly } }
const D = require('../public/data.js');

const KINDS = ['daily', 'weekly'];
const MAX_COINS = 999999999;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Misión nueva de la lista del tipo, sin repetir las que ya hay (ni la que se cambia)
function roll(kind, skip = []) {
  const pool = D.MISSIONS[kind].filter(m => !skip.includes(m.id));
  const tpl = pick(pool.length ? pool : D.MISSIONS[kind]);
  const m = { id: tpl.id, n: 0, claimed: false };
  if (tpl.type) m.type = pick(D.MISSION_TYPES);
  return m;
}

function fresh(kind) {
  const list = [];
  while (list.length < D.MISSION_COUNT) list.push(roll(kind, list.map(m => m.id)));
  return list;
}

// Crea las misiones o las renueva si ha cambiado el día o la semana
function refresh(p, now = Date.now()) {
  if (!p.missions) p.missions = { day: null, week: null, daily: [], weekly: [], rerolls: { daily: 0, weekly: 0 }, chest: { daily: false, weekly: false } };
  const ms = p.missions;
  const day = D.dayKey(now), week = D.weekKey(now);
  if (ms.day !== day) Object.assign(ms, { day, daily: fresh('daily') }, { rerolls: { ...ms.rerolls, daily: 0 }, chest: { ...ms.chest, daily: false } });
  if (ms.week !== week) Object.assign(ms, { week, weekly: fresh('weekly') }, { rerolls: { ...ms.rerolls, weekly: 0 }, chest: { ...ms.chest, weekly: false } });
  // Plantillas que ya no existen (cambios en los datos): se sustituyen
  for (const kind of KINDS) ms[kind] = ms[kind].map(m => D.MISSION_BY_ID[m.id] ? m : roll(kind, ms[kind].map(x => x.id)));
  return ms;
}

const goalOf = m => D.MISSION_BY_ID[m.id].goal;
const done = m => m.n >= goalOf(m);

// Algo ha pasado en el juego. ev: wild, catch, win, gym, tower, towerStreak, online, rankedWin,
// level, evolve, dex. amount: cuánto suma (o el valor, en las de máximo). types: tipos de los
// Pokémon implicados (el capturado, o los del equipo en las victorias) para las misiones con tipo.
function track(p, ev, amount = 1, types = null) {
  if (!(amount > 0)) return;
  const ms = refresh(p);
  for (const kind of KINDS) for (const m of ms[kind]) {
    const tpl = D.MISSION_BY_ID[m.id];
    if (tpl.ev !== ev || m.claimed || done(m)) continue;
    if (m.type && !(types || []).includes(m.type)) continue;
    m.n = Math.min(tpl.goal, tpl.max ? Math.max(m.n, amount) : m.n + amount);
  }
}

// Tipos de una lista de especies
const typesOf = dexes => [...new Set(dexes.flatMap(d => (D.SPECIES[d] ? D.SPECIES[d].types : [])))];

// Progreso de todas las misiones, para ver qué ha cambiado en un combate (snapshot antes, diff después)
const snapshot = p => { const ms = refresh(p); return KINDS.flatMap(kind => ms[kind].map((m, i) => `${kind}:${i}:${m.id}:${m.type || ''}=${m.n}`)); };
function diff(p, before) {
  const ms = refresh(p), was = new Map(before.map(s => s.split('=')).map(([k, n]) => [k, +n]));
  const out = [];
  for (const kind of KINDS) ms[kind].forEach((m, i) => {
    const from = was.get(`${kind}:${i}:${m.id}:${m.type || ''}`);
    if (from !== undefined && m.n > from) out.push({ kind, i, id: m.id, type: m.type || null, from, n: m.n, goal: goalOf(m) });
  });
  return out;
}

function pay(p, rw) {
  const loot = { coins: rw.coins || 0, items: { ...(rw.items || {}) } };
  p.coins = Math.min(MAX_COINS, p.coins + loot.coins);
  for (const [k, q] of Object.entries(loot.items)) p.items[k] = (p.items[k] || 0) + q;
  return loot;
}

// Acciones del jugador: claim (recoger una cumplida), reroll (cambiarla) y chest (abrir el cofre).
// Devuelve { error } o { loot } con lo recibido (para la animación del cliente).
function action(p, msg) {
  const ms = refresh(p);
  const kind = KINDS.includes(msg.kind) ? msg.kind : null;
  if (!kind) return { error: 'Misión no válida' };
  if (msg.a === 'chest') {
    if (ms.chest[kind]) return { error: 'Ya has abierto este cofre' };
    if (!ms[kind].every(m => m.claimed)) return { error: 'Recoge antes las 3 misiones' };
    ms.chest[kind] = true;
    return { loot: { ...pay(p, D.MISSION_CHEST[kind]), chest: kind } };
  }
  const m = ms[kind][msg.i];
  if (!Number.isInteger(msg.i) || !m) return { error: 'Misión no válida' };
  if (msg.a === 'claim') {
    if (m.claimed) return { error: 'Ya has recogido esta misión' };
    if (!done(m)) return { error: 'Esta misión aún no está cumplida' };
    m.claimed = true;
    return { loot: { ...pay(p, D.MISSION_BY_ID[m.id].reward), mission: { id: m.id, type: m.type || null }, chestReady: ms[kind].every(x => x.claimed) && !ms.chest[kind] } };
  }
  if (msg.a === 'reroll') {
    if (m.claimed || done(m)) return { error: 'Está cumplida: recoge su premio' };
    const cost = ms.rerolls[kind] >= D.MISSION_REROLLS[kind] ? D.MISSION_REROLL_COST[kind] : 0;
    if (p.coins < cost) return { error: 'No tienes suficiente dinero' };
    p.coins -= cost;
    ms.rerolls[kind]++;
    ms[kind][msg.i] = roll(kind, ms[kind].map(x => x.id));
    return { loot: null, cost };
  }
  return { error: 'Acción desconocida' };
}

// Lo que ve el cliente: las misiones con su meta, cuántos cambios gratis quedan y cuándo se renuevan
function view(p) {
  const ms = refresh(p);
  const out = { day: ms.day, week: ms.week, chest: ms.chest, ends: { daily: D.nextDay(), weekly: D.nextWeek() } };
  out.freeRerolls = Object.fromEntries(KINDS.map(k => [k, Math.max(0, D.MISSION_REROLLS[k] - ms.rerolls[k])]));
  for (const kind of KINDS) out[kind] = ms[kind].map(m => ({ ...m, goal: goalOf(m) }));
  return out;
}

module.exports = { refresh, track, typesOf, snapshot, diff, action, view, pay, KINDS };
