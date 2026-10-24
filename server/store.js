// Perfiles de jugador en data/profiles.json. Cada navegador guarda su token en localStorage
// y con él recupera su partida. Un invitado puede registrar usuario y contraseña para entrar
// desde otro dispositivo (la contraseña se guarda con scrypt y sal). Se escribe en disco como
// mucho una vez por segundo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.PROFILES_FILE || path.join(__dirname, '..', 'data', 'profiles.json');
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { profiles = {}; }
// Id público de cada perfil (el token es secreto: con él se entra en la partida)
const newId = () => crypto.randomBytes(5).toString('hex');
const byId = id => Object.values(profiles).find(p => p.id === id) || null;

// Índice usuario (en minúsculas) -> token
const accounts = new Map();
for (const p of Object.values(profiles)) if (p.account) accounts.set(p.account.user.toLowerCase(), p.token);

let timer = null;
function save() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(profiles));
    fs.renameSync(tmp, FILE);   // escritura atómica: nunca queda un JSON a medias
  }, 1000);
}
// Perfiles de antes del id público
if (Object.values(profiles).filter(p => !p.id).map(p => { p.id = newId(); }).length) save();

function newProfile(name) {
  return {
    token: crypto.randomBytes(16).toString('hex'), id: newId(), name,
    coins: 500, items: { pokeball: 5 }, mons: [], team: [], badges: 0, prog: { kanto: 0, johto: 0 }, nextUid: 1,
    elo: 1000, wins: 0, losses: 0, ranked: 0, caught: [], created: Date.now(),
  };
}

// Con token válido devuelve su perfil; si no, crea uno de invitado con ese nombre
function get(token, name) {
  let p = token && profiles[token];
  if (!p) { p = newProfile(name || 'Entrenador'); profiles[p.token] = p; }
  save();
  return p;
}

// ---------- Cuentas ----------
const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
const hash = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString('hex');

function checkCredentials(user, pass) {
  if (typeof user !== 'string' || !USER_RE.test(user)) return 'El usuario debe tener de 3 a 16 letras, números o _';
  if (typeof pass !== 'string' || pass.length < 6 || pass.length > 72) return 'La contraseña debe tener de 6 a 72 caracteres';
  return null;
}

// Registra usuario y contraseña en el perfil (el invitado conserva toda su partida); sin
// perfil crea uno nuevo. Devuelve { p } o { err }.
function register(p, user, pass) {
  const err = checkCredentials(user, pass);
  if (err) return { err };
  if (p && p.account) return { err: 'Este perfil ya tiene cuenta' };
  if (accounts.has(user.toLowerCase())) return { err: 'Ese usuario ya existe' };
  if (!p) { p = newProfile(user); profiles[p.token] = p; }
  const salt = crypto.randomBytes(16).toString('hex');
  p.account = { user, salt, hash: hash(pass, salt), since: Date.now() };
  accounts.set(user.toLowerCase(), p.token);
  save();
  return { p };
}

// Devuelve el perfil si usuario y contraseña coinciden
function login(user, pass) {
  if (typeof user !== 'string' || typeof pass !== 'string' || pass.length > 72) return null;
  const p = profiles[accounts.get(user.toLowerCase())];
  if (!p || !p.account) return null;
  const a = Buffer.from(hash(pass, p.account.salt), 'hex'), b = Buffer.from(p.account.hash, 'hex');
  return crypto.timingSafeEqual(a, b) ? p : null;
}

function changePassword(p, oldPass, newPass) {
  if (!p.account) return 'Este perfil no tiene cuenta';
  if (!login(p.account.user, String(oldPass || ''))) return 'La contraseña actual no es correcta';
  const err = checkCredentials(p.account.user, newPass);
  if (err) return err;
  p.account.salt = crypto.randomBytes(16).toString('hex');
  p.account.hash = hash(newPass, p.account.salt);
  save();
  return null;
}

// ---------- Ranking ----------
function leaderboard(n = 10) {
  return Object.values(profiles).filter(p => p.ranked > 0)
    .sort((a, b) => b.elo - a.elo).slice(0, n)
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
const PAGE = 20;
const sorted = board => Object.values(profiles).filter(BOARDS[board].has).sort(BOARDS[board].cmp);

// Una página de una tabla. q filtra por nombre (el puesto es el de la tabla completa).
// online: Set de ids conectados ahora mismo.
function ladder(board, { page = 0, q = '', me = null, online = new Set() } = {}) {
  if (!BOARDS[board]) board = 'ranked';
  const all = sorted(board).map((p, i) => ({ p, rank: i + 1 }));
  const needle = String(q || '').trim().toLowerCase().slice(0, 16);
  const list = needle ? all.filter(x => x.p.name.toLowerCase().includes(needle)) : all;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  page = Math.max(0, Math.min(pages - 1, page | 0));
  const row = ({ p, rank }) => ({ rank, id: p.id, name: p.name, title: p.title || null, frame: p.frame || null, online: online.has(p.id), ...BOARDS[board].row(p) });
  const mine = me && all.find(x => x.p === me);
  return { board, page, pages, total: all.length, found: list.length, q: needle, rows: list.slice(page * PAGE, (page + 1) * PAGE).map(row), me: mine ? row(mine) : null };
}

// Ficha pública de un entrenador (sin token ni datos de la partida que no hacen falta)
function publicUser(id, online = new Set()) {
  const p = byId(id);
  if (!p) return null;
  const rankIn = board => { const i = BOARDS[board].has(p) ? sorted(board).indexOf(p) : -1; return i >= 0 ? i + 1 : null; };
  const team = Object.values(p.teams || {}).flat().map(u => (p.mons || []).find(m => m.uid === u)).filter(Boolean)
    .sort((a, b) => b.level - a.level).slice(0, 6).map(m => ({ dex: m.dex, level: m.level, shiny: !!m.shiny }));
  const t = tw(p);
  return {
    id: p.id, name: p.name, title: p.title || null, frame: p.frame || null, online: online.has(p.id), created: p.created,
    elo: p.elo, wins: p.wins, losses: p.losses, ranked: p.ranked,
    tower: { best: t.best || 0, streak: t.team ? t.streak : 0, symbols: t.symbols || [], wins: t.wins || 0, team: t.bestTeam || [] },
    caught: (p.caught || []).length, shinies: (p.shinies || []).length, mons: (p.mons || []).length, badges: badgesOf(p), prog: p.prog || {},
    team, ranks: { ranked: rankIn('ranked'), tower: rankIn('tower'), dex: rankIn('dex') },
  };
}

// Puesto en el ranking de clasificatoria (1 = primero) o null si no ha jugado
function rankOf(p) {
  const i = p.ranked > 0 ? sorted('ranked').indexOf(p) : -1;
  return i < 0 ? null : i + 1;
}

module.exports = { get, save, leaderboard, rankOf, ladder, publicUser, register, login, changePassword };
