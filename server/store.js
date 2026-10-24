// Perfiles de jugador en data/profiles.json. Cada navegador guarda su token en localStorage
// y con él recupera su partida. Se escribe en disco como mucho una vez por segundo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.PROFILES_FILE || path.join(__dirname, '..', 'data', 'profiles.json');
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { profiles = {}; }

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
    .map(p => ({ name: p.name, elo: p.elo, wins: p.wins, losses: p.losses }));
}

module.exports = { get, save, leaderboard };
