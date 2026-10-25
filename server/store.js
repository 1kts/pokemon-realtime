// Perfiles de jugador en SQLite (data/arena.db, o DB_FILE): una fila por perfil con su JSON.
// Todos los perfiles están en memoria (la ladder y las fichas se calculan de ahí) y a disco solo
// va lo que cambia: como mucho una vez por segundo se reescriben, en una transacción, los perfiles
// en uso (los de los jugadores conectados) que hayan cambiado. Cada navegador guarda su token en
// localStorage y con él recupera su partida. Un invitado puede registrar usuario y contraseña
// para entrar desde otro dispositivo (la contraseña se guarda con scrypt y sal).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { DatabaseSync } = require('node:sqlite');

// PROFILES_FILE era el JSON de antes: si alguien la sigue usando (p. ej. un servidor de pruebas)
// no se ignora en silencio, porque acabaría usando los datos reales de data/
if (process.env.PROFILES_FILE && !process.env.DB_FILE) {
  throw new Error('PROFILES_FILE ya no se usa: los perfiles van en SQLite. Usa DB_FILE=/ruta/arena.db');
}
const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'arena.db');
fs.mkdirSync(path.dirname(FILE), { recursive: true });
const db = new DatabaseSync(FILE);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS profiles (token TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)`);
const upsert = db.prepare(`INSERT INTO profiles (token, data, updated) VALUES (?, ?, ?)
  ON CONFLICT (token) DO UPDATE SET data = excluded.data, updated = excluded.updated`);

const profiles = new Map();   // token -> perfil
for (const r of db.prepare('SELECT data FROM profiles').all()) { const p = JSON.parse(r.data); profiles.set(p.token, p); }

function writeRows(list) {
  const now = Date.now();
  db.exec('BEGIN');
  try {
    for (const [p, json] of list) upsert.run(p.token, json, now);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// La primera vez (base de datos vacía) se importa el antiguo profiles.json de la misma carpeta.
// Solo se lee: otro servidor con la versión anterior puede estar usándolo.
const OLD_JSON = path.join(path.dirname(FILE), 'profiles.json');
if (!profiles.size && fs.existsSync(OLD_JSON)) {
  for (const p of Object.values(JSON.parse(fs.readFileSync(OLD_JSON, 'utf8')))) profiles.set(p.token, p);
  writeRows([...profiles.values()].map(p => [p, JSON.stringify(p)]));
  console.log(`Importados ${profiles.size} perfiles de ${OLD_JSON}`);
}

// Id público de cada perfil (el token es secreto: con él se entra en la partida)
const newId = () => crypto.randomBytes(5).toString('hex');
const ids = new Map([...profiles.values()].filter(p => p.id).map(p => [p.id, p]));
const byId = id => ids.get(id) || null;

// Índice usuario (en minúsculas) -> token
const accounts = new Map();
for (const p of profiles.values()) if (p.account) accounts.set(p.account.user.toLowerCase(), p.token);

// Perfiles en uso: perfil -> { json: lo último escrito, refs: conexiones que lo usan }
const inUse = new Map();
function use(p) {
  p.seen = Date.now();   // última conexión (para borrar invitados abandonados)
  const u = inUse.get(p);
  if (u) u.refs++; else inUse.set(p, { json: JSON.stringify(p), refs: 1 });
  return p;
}
// Una conexión deja el perfil: se guarda si ha cambiado y, si nadie más lo usa, deja de vigilarse
function release(p) {
  const u = inUse.get(p);
  if (!u) return;
  const json = JSON.stringify(p);
  if (json !== u.json) { writeRows([[p, json]]); u.json = json; }
  if (--u.refs <= 0) inUse.delete(p);
}

let timer = null;
function write() {
  timer = null;
  const changed = [];
  for (const [p, u] of inUse) {
    const json = JSON.stringify(p);
    if (json !== u.json) { changed.push([p, json]); u.json = json; }
  }
  if (changed.length) writeRows(changed);
}
function save() {
  if (!timer) timer = setTimeout(write, 1000);
}
// Escribe ya lo pendiente (al apagar el servidor)
function flush() {
  if (!timer) return;
  clearTimeout(timer);
  write();
}
// Perfiles de antes del id público
for (const p of profiles.values()) if (!p.id) { p.id = newId(); ids.set(p.id, p); writeRows([[p, JSON.stringify(p)]]); }

function newProfile(name) {
  return {
    token: crypto.randomBytes(16).toString('hex'), id: newId(), name,
    coins: 500, items: { pokeball: 5 }, mons: [], team: [], badges: 0, prog: { kanto: 0, johto: 0 }, nextUid: 1,
    elo: 1000, wins: 0, losses: 0, ranked: 0, caught: [], created: Date.now(),
  };
}

function addProfile(name) {
  const p = newProfile(name);
  profiles.set(p.token, p);
  ids.set(p.id, p);
  writeRows([[p, JSON.stringify(p)]]);
  return p;
}

// ¿Existe un perfil con este token?
const has = token => !!token && profiles.has(token);

// Con token válido devuelve su perfil; si no, crea uno de invitado con ese nombre. La conexión
// que lo pide lo tiene en uso hasta que llame a release().
function get(token, name) {
  const p = (token && profiles.get(token)) || addProfile(name || 'Entrenador');
  use(p);
  save();
  return p;
}

// ---------- Cuentas ----------
// scrypt asíncrono: calcularlo cuesta ~30 ms y no debe parar los combates mientras tanto
// Usuario: un nombre (3-24 letras, números, _ . o -) o un correo (hasta 64). Solo lo ve su dueño:
// no sale en la ladder ni en las fichas públicas.
const USER_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const validUser = u => typeof u === 'string' && u.length <= 64 && (USER_RE.test(u) || EMAIL_RE.test(u));
// Nombre de entrenador (público) para un perfil nuevo: si el usuario es un correo, solo lo de antes de la @
const trainerName = u => u.split('@')[0].slice(0, 16) || 'Entrenador';
const scrypt = promisify(crypto.scrypt);
const hash = async (pass, salt) => (await scrypt(pass, salt, 32)).toString('hex');

function checkCredentials(user, pass) {
  if (!validUser(user)) return 'El usuario debe tener de 3 a 24 letras, números, _ . o -, o ser un correo';
  if (typeof pass !== 'string' || pass.length < 6 || pass.length > 72) return 'La contraseña debe tener de 6 a 72 caracteres';
  return null;
}

// Registra usuario y contraseña en el perfil (el invitado conserva toda su partida); sin
// perfil crea uno nuevo, en uso por quien lo pide. Devuelve { p } o { err }.
async function register(p, user, pass) {
  const err = checkCredentials(user, pass);
  if (err) return { err };
  if (p && p.account) return { err: 'Este perfil ya tiene cuenta' };
  if (accounts.has(user.toLowerCase())) return { err: 'Ese usuario ya existe' };
  const salt = crypto.randomBytes(16).toString('hex');
  const h = await hash(pass, salt);
  // Mientras se calculaba el hash otro ha podido registrar el mismo usuario o este perfil
  if (accounts.has(user.toLowerCase())) return { err: 'Ese usuario ya existe' };
  if (p && p.account) return { err: 'Este perfil ya tiene cuenta' };
  if (!p) p = use(addProfile(trainerName(user)));
  p.account = { user, salt, hash: h, since: Date.now() };
  accounts.set(user.toLowerCase(), p.token);
  save();
  return { p };
}

async function check(user, pass) {
  if (typeof user !== 'string' || typeof pass !== 'string' || pass.length > 72) return null;
  const p = profiles.get(accounts.get(user.toLowerCase()));
  if (!p || !p.account) return null;
  const a = Buffer.from(await hash(pass, p.account.salt), 'hex'), b = Buffer.from(p.account.hash, 'hex');
  return crypto.timingSafeEqual(a, b) ? p : null;
}

// Devuelve el perfil (en uso por quien lo pide) si usuario y contraseña coinciden
async function login(user, pass) {
  const p = await check(user, pass);
  return p && use(p);
}

// Contraseña nueva sin pedir la actual (el admin la resetea por soporte)
async function setPassword(p, pass) {
  if (!p.account) return 'Este perfil no tiene cuenta';
  const salt = crypto.randomBytes(16).toString('hex');
  p.account.hash = await hash(pass, salt);
  p.account.salt = salt;
  persist(p);
  return null;
}

async function changePassword(p, oldPass, newPass) {
  if (!p.account) return 'Este perfil no tiene cuenta';
  if (!await check(p.account.user, String(oldPass || ''))) return 'La contraseña actual no es correcta';
  const err = checkCredentials(p.account.user, newPass);
  if (err) return err;
  const salt = crypto.randomBytes(16).toString('hex');
  p.account.hash = await hash(newPass, salt);
  p.account.salt = salt;
  save();
  return null;
}

// ---------- Moderación ----------
// Suspensión: p.ban = { until (null = para siempre), reason, by, at }. Los suspendidos no pueden
// entrar ni salen en los rankings.
const banned = p => !!(p.ban && (!p.ban.until || p.ban.until > Date.now()));
// Escribe el perfil ya, esté en uso o no (cambios del admin a jugadores desconectados)
function persist(p) {
  const json = JSON.stringify(p);
  writeRows([[p, json]]);
  const u = inUse.get(p);
  if (u) u.json = json;
}
// Borra un perfil del todo (derecho de supresión): memoria, índices y base de datos. Quien lo esté
// usando tiene que estar ya desconectado.
function remove(p) {
  profiles.delete(p.token);
  ids.delete(p.id);
  if (p.account) accounts.delete(p.account.user.toLowerCase());
  inUse.delete(p);
  db.prepare('DELETE FROM profiles WHERE token = ?').run(p.token);
}
// Invitados (sin usuario ni contraseña) que llevan GUEST_DAYS sin conectarse: se borran con su partida,
// como dice la política de privacidad. Nunca uno conectado. Devuelve cuántos.
const GUEST_DAYS = 60;
function purgeGuests(now = Date.now()) {
  const limit = now - GUEST_DAYS * 864e5;
  let n = 0;
  for (const p of [...profiles.values()]) {
    if (p.account || inUse.has(p) || (p.seen || p.created || now) >= limit) continue;
    remove(p);
    n++;
  }
  return n;
}
const byUser = user => profiles.get(accounts.get(String(user || '').toLowerCase())) || null;
// Busca por nombre de entrenador, usuario o id (los registrados primero)
function search(q, limit = 50) {
  const needle = String(q || '').trim().toLowerCase().slice(0, 64);
  const list = [];
  for (const p of profiles.values()) {
    if (needle && !(p.name.toLowerCase().includes(needle) || p.id === needle || (p.account && p.account.user.toLowerCase().includes(needle)))) continue;
    list.push(p);
  }
  return list.sort((a, b) => !!b.account - !!a.account || (b.created || 0) - (a.created || 0)).slice(0, limit);
}
function stats() {
  const day = new Date(); day.setHours(0, 0, 0, 0);
  let accountsN = 0, today = 0, bannedN = 0;
  for (const p of profiles.values()) {
    if (p.account) accountsN++;
    if ((p.created || 0) >= day.getTime()) today++;
    if (banned(p)) bannedN++;
  }
  return { profiles: profiles.size, accounts: accountsN, newToday: today, banned: bannedN, dbBytes: fs.statSync(FILE).size };
}

// ---------- Ranking ----------
// Top n de clasificatoria y puesto de un jugador: se piden en cada envío de perfil, así que se
// calculan con una sola pasada por los perfiles en vez de ordenarlos todos
function leaderboard(n = 10) {
  const { has, cmp } = BOARDS.ranked, top = [];
  for (const p of profiles.values()) {
    if (!has(p) || (top.length === n && cmp(p, top[n - 1]) >= 0)) continue;
    let i = top.length;
    while (i > 0 && cmp(p, top[i - 1]) < 0) i--;
    top.splice(i, 0, p);
    if (top.length > n) top.pop();
  }
  return top
    .map(p => ({ id: p.id, name: p.name, elo: p.elo, wins: p.wins, losses: p.losses, title: p.title || null, frame: p.frame || null }));
}

// ---------- Ladder ----------
// Cada tabla: quién aparece, cómo se ordena y qué columnas se enseñan
const tw = p => p.tower || {};
const badgesOf = p => Object.values(p.prog || {}).reduce((a, n) => a + Math.min(8, n || 0), 0);
const BOARDS = {
  ranked: { has: p => p.ranked > 0, cmp: (a, b) => b.elo - a.elo || b.wins - a.wins,
    row: p => ({ elo: p.elo, wins: p.wins, losses: p.losses }) },
  tower: { has: p => tw(p).best > 0, cmp: (a, b) => tw(b).best - tw(a).best || tw(a).bestAt - tw(b).bestAt,
    row: p => ({ best: tw(p).best, streak: tw(p).team ? tw(p).streak : 0, symbols: tw(p).symbols || [], team: tw(p).bestTeam || [] }) },
  dex: { has: p => (p.caught || []).length > 0, cmp: (a, b) => b.caught.length - a.caught.length || (b.shinies || []).length - (a.shinies || []).length || badgesOf(b) - badgesOf(a),
    row: p => ({ caught: p.caught.length, shinies: (p.shinies || []).length, badges: badgesOf(p) }) },
};
// En los rankings solo salen cuentas registradas (un invitado se puede crear y tirar sin más, y con
// varios se podría inflar el ELO de otro): ni invitados, ni suspendidos, ni cuentas del equipo con
// todo desbloqueado (staff). Al registrarse, el invitado entra con lo que ya tenía.
for (const b of Object.values(BOARDS)) { const has = b.has; b.has = p => !!p.account && !banned(p) && !p.staff && has(p); }
const PAGE = 20;
const sorted = board => [...profiles.values()].filter(BOARDS[board].has).sort(BOARDS[board].cmp);

// Una página de una tabla. q filtra por nombre (el puesto es el de la tabla completa).
// online: Set de ids conectados ahora mismo.
function ladder(board, { page = 0, q = '', me = null, online = new Set() } = {}) {
  if (!BOARDS[board]) board = 'ranked';
  const all = sorted(board).map((p, i) => ({ p, rank: i + 1 }));
  const needle = String(q || '').trim().toLowerCase().slice(0, 16);
  const list = needle ? all.filter(x => x.p.name.toLowerCase().includes(needle)) : all;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  page = Math.max(0, Math.min(pages - 1, page | 0));
  const row = ({ p, rank }) => ({ rank, id: p.id, name: p.name, title: p.title || null, frame: p.frame || null, showcase: p.showcase || [], online: online.has(p.id), ...BOARDS[board].row(p) });
  const mine = me && all.find(x => x.p === me);
  return { board, page, pages, total: all.length, found: list.length, q: needle, rows: list.slice(page * PAGE, (page + 1) * PAGE).map(row), me: mine ? row(mine) : null };
}

// Ficha pública de un entrenador (sin token ni datos de la partida que no hacen falta)
function publicUser(id, online = new Set()) {
  const p = byId(id);
  if (!p) return null;
  const rankIn = board => { const i = BOARDS[board].has(p) ? sorted(board).indexOf(p) : -1; return i >= 0 ? i + 1 : null; };
  const team = Object.values(p.teams || {}).flat().map(u => (p.mons || []).find(m => m.uid === u)).filter(Boolean)
    .sort((a, b) => b.level - a.level).slice(0, 6).map(m => ({ dex: m.dex, nick: m.nick, level: m.level, shiny: !!(m.shiny && !m.plain) }));
  const t = tw(p);
  return {
    id: p.id, name: p.name, title: p.title || null, frame: p.frame || null, showcase: p.showcase || [], online: online.has(p.id), created: p.created,
    elo: p.elo, wins: p.wins, losses: p.losses, ranked: p.ranked,
    tower: { best: t.best || 0, streak: t.team ? t.streak : 0, symbols: t.symbols || [], wins: t.wins || 0, team: t.bestTeam || [] },
    caught: (p.caught || []).length, shinies: (p.shinies || []).length, mons: (p.mons || []).length, badges: badgesOf(p), prog: p.prog || {},
    team, ranks: { ranked: rankIn('ranked'), tower: rankIn('tower'), dex: rankIn('dex') },
  };
}

// Puesto en el ranking de clasificatoria (1 = primero) o null si no ha jugado
function rankOf(p) {
  const { has, cmp } = BOARDS.ranked;
  if (!has(p)) return null;
  let rank = 1;
  for (const q of profiles.values()) if (has(q) && cmp(q, p) < 0) rank++;
  return rank;
}

module.exports = { db, get, has, release, save, flush, leaderboard, rankOf, ladder, publicUser, register, login, changePassword,
  check, setPassword, banned, persist, remove, purgeGuests, GUEST_DAYS, byId, byUser, search, stats, all: () => profiles.values() };
