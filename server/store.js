// Perfiles de jugador en data/profiles.json. Cada navegador guarda su token en localStorage
// y con él recupera su partida. Se escribe en disco como mucho una vez por segundo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.PROFILES_FILE || path.join(__dirname, '..', 'data', 'profiles.json');
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { profiles = {}; }
// Id público de cada perfil (el token es secreto: con él se entra en la partida)
const newId = () => crypto.randomBytes(5).toString('hex');
const byId = id => Object.values(profiles).find(p => p.id === id) || null;

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

function get(token, name) {
  let p = token && profiles[token];
  if (!p) { p = newProfile(name); profiles[p.token] = p; }
  if (name) p.name = name;
  save();
  return p;
}

function leaderboard(n = 10) {
  return Object.values(profiles).filter(p => p.ranked > 0)
    .sort((a, b) => b.elo - a.elo).slice(0, n)
    .map(p => ({ id: p.id, name: p.name, elo: p.elo, wins: p.wins, losses: p.losses }));
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
  const row = ({ p, rank }) => ({ rank, id: p.id, name: p.name, online: online.has(p.id), ...BOARDS[board].row(p) });
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
    id: p.id, name: p.name, online: online.has(p.id), created: p.created,
    elo: p.elo, wins: p.wins, losses: p.losses, ranked: p.ranked,
    tower: { best: t.best || 0, streak: t.team ? t.streak : 0, symbols: t.symbols || [], wins: t.wins || 0, team: t.bestTeam || [] },
    caught: (p.caught || []).length, shinies: (p.shinies || []).length, mons: (p.mons || []).length, badges: badgesOf(p), prog: p.prog || {},
    team, ranks: { ranked: rankIn('ranked'), tower: rankIn('tower'), dex: rankIn('dex') },
  };
}

module.exports = { get, save, leaderboard, ladder, publicUser };
