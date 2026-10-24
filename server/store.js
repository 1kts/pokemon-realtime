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

function newProfile(name) {
  return {
    token: crypto.randomBytes(16).toString('hex'), name,
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
const rankedList = () => Object.values(profiles).filter(p => p.ranked > 0).sort((a, b) => b.elo - a.elo);

function leaderboard(n = 10) {
  return rankedList().slice(0, n)
    .map(p => ({ name: p.name, elo: p.elo, wins: p.wins, losses: p.losses, title: p.title || null, frame: p.frame || null }));
}

// Puesto en el ranking (1 = primero) o null si no ha jugado clasificatoria
function rankOf(p) {
  const i = rankedList().indexOf(p);
  return i < 0 ? null : i + 1;
}

module.exports = { get, save, leaderboard, rankOf, register, login, changePassword };
