// Recompensas de clasificatoria, temporadas, logros y cosméticos del perfil (títulos, marcos y avatares).
// Por temporada: cada liga alcanzada por primera vez da un premio que se reclama a mano;
// al cambiar de temporada se cobra el premio de la anterior según la mejor liga y el ELO se
// acerca a la mitad hacia 1000. Cada combate paga algo y la primera victoria del día, más.
const D = require('../public/data.js');

const LEAGUE_NAMES = D.LEAGUES.map(l => l[1]);
const leagueIndex = name => LEAGUE_NAMES.indexOf(name);
const HISTORY = 15;
const MAX_COINS = 999999999;   // tope del dinero (el mismo que da el panel de admin)

// Campos nuevos en perfiles antiguos y cambio de temporada
function migrate(p) {
  if (!p.cosmetics) p.cosmetics = { titles: ['Novato'], frames: ['bronce'] };
  if (!p.history) p.history = [];
  if (p.peakElo === undefined) p.peakElo = p.elo;
  if (!p.season) p.season = { id: D.SEASON.id, peak: p.elo, claimed: [] };
  if (!p.inbox) p.inbox = [];
  if (p.season.id < D.SEASON.id) rollSeason(p);
  if (!p.achievements) p.achievements = {};
  if (!p.showcase) p.showcase = [];
  // Avatares de colección: los logros de antes (ya cobrados) dan su icono sin más
  if (!p.cosmetics.avatars) {
    p.cosmetics.avatars = [];
    for (const a of D.ACHIEVEMENTS) if (p.achievements[a.id] && D.achievementAvatar(a)) unlock(p, 'avatars', D.achievementAvatar(a));
  }
  if (!p.achClaim) p.achClaim = [];
  if (!p.mastery) p.mastery = {};
  checkAchievements(p);
}

// Logros: los que se acaban de cumplir se guardan con su fecha y su premio queda pendiente de
// recoger a mano (claimAchievement), una sola vez
function checkAchievements(p) {
  const fresh = [];
  for (const a of D.ACHIEVEMENTS) {
    if (p.achievements[a.id] || a.progress(p) < a.goal) continue;
    p.achievements[a.id] = Date.now();
    p.achClaim.push(a.id);
    fresh.push(a.id);
  }
  return fresh;
}

// Recoger el premio de un logro: dinero, título, marco y su icono como avatar
function claimAchievement(p, id) {
  migrate(p);
  const a = D.ACHIEVEMENTS.find(x => x.id === id);
  if (!a || !p.achClaim.includes(id)) return { error: 'No hay nada que recoger de ese logro' };
  p.achClaim = p.achClaim.filter(x => x !== id);
  const rw = a.reward || {};
  const loot = { coins: rw.coins || 0, items: {}, title: rw.title || null, frame: rw.frame || null, avatar: D.achievementAvatar(a), achievement: id };
  p.coins = Math.min(MAX_COINS, p.coins + loot.coins);
  if (loot.title) unlock(p, 'titles', loot.title);
  if (loot.frame) unlock(p, 'frames', loot.frame);
  if (loot.avatar) unlock(p, 'avatars', loot.avatar);
  return { loot };
}

// Medallas ganadas cuyo avatar aún no se ha recogido
const badgesToClaim = p => D.REGION_IDS.flatMap(r => Array.from({ length: Math.min(8, D.progOf(p, r)) }, (_, i) => D.badgeAvatar(r, i)))
  .filter(id => !p.cosmetics.avatars.includes(id));
function claimBadge(p, region, index) {
  migrate(p);
  const id = D.badgeAvatar(region, index);
  if (!badgesToClaim(p).includes(id)) return { error: 'No hay nada que recoger de esa medalla' };
  unlock(p, 'avatars', id);
  return { loot: { coins: 0, items: {}, avatar: id, badge: { region, index } } };
}

// Maestría: una victoria más para la línea evolutiva de cada Pokémon del equipo (una vez por línea).
// Al llegar a MASTERY_FRAME se desbloquea el marco de su tipo. Devuelve las líneas que suben de nivel.
function addMastery(p, dexes) {
  migrate(p);
  const ups = [];
  for (const root of new Set(dexes.filter(d => D.SPECIES[d]).map(D.lineOf))) {
    const before = p.mastery[root] || 0;
    p.mastery[root] = before + 1;
    if (D.masteryTier(before + 1) > D.masteryTier(before)) ups.push({ dex: root, tier: D.masteryTier(before + 1) });
    if (before + 1 >= D.MASTERY_FRAME) unlock(p, 'frames', D.typeFrameOf(root));
  }
  return ups;
}

function rollSeason(p) {
  const prev = p.season;
  const league = D.leagueOf(prev.peak);
  const coins = D.SEASON_REWARDS[league] || 0;
  p.coins += coins;
  const title = leagueIndex(league) >= leagueIndex('Oro') ? D.seasonTitle(league, prev.id) : null;
  if (title) unlock(p, 'titles', title);
  p.inbox.push({ kind: 'season', season: prev.id, league, coins, title, at: Date.now() });
  p.elo = Math.round(1000 + (p.elo - 1000) / 2);
  p.season = { id: D.SEASON.id, peak: p.elo, claimed: [] };
}

function unlock(p, kind, id) {
  if (!p.cosmetics[kind].includes(id)) p.cosmetics[kind].push(id);
}

// Tras cada clasificatoria: pico de ELO, historial y dinero
function afterRanked(p, { won, delta, foe, foeElo, team, foeTeam }) {
  migrate(p);
  p.peakElo = Math.max(p.peakElo, p.elo);
  p.season.peak = Math.max(p.season.peak, p.elo);
  const today = D.dayKey();
  const first = won && p.lastWinDay !== today;
  if (first) p.lastWinDay = today;
  const coins = (won ? D.RANKED_PAY.win : D.RANKED_PAY.loss) + (first ? D.RANKED_PAY.firstWin : 0);
  p.coins += coins;
  p.history.unshift({ at: Date.now(), won, delta, elo: p.elo, foe, foeElo, team, foeTeam });
  p.history.length = Math.min(p.history.length, HISTORY);
  return { coins, firstWin: first };
}

// Reclamar el premio de una liga ya alcanzada en esta temporada
function claim(p, league) {
  migrate(p);
  const r = D.RANKED_REWARDS[league];
  const min = (D.LEAGUES.find(l => l[1] === league) || [])[0];
  if (!r || min === undefined) return 'Esa liga no existe';
  if (p.season.peak < min) return `Aún no has llegado a ${league}`;
  if (p.season.claimed.includes(league)) return 'Ya has reclamado ese premio esta temporada';
  p.season.claimed.push(league);
  p.coins += r.coins;
  for (const [id, n] of Object.entries(r.items)) p.items[id] = (p.items[id] || 0) + n;
  unlock(p, 'titles', r.title);
  unlock(p, 'frames', r.frame);
  return null;
}

// Elegir título, marco o Pokémon de avatar entre los desbloqueados
function setLook(p, msg) {
  migrate(p);
  if (msg.title !== undefined) {
    if (msg.title !== null && !p.cosmetics.titles.includes(msg.title)) return 'No tienes ese título';
    p.title = msg.title;
  }
  if (msg.frame !== undefined) {
    if (msg.frame !== null && !p.cosmetics.frames.includes(msg.frame)) return 'No tienes ese marco';
    p.frame = msg.frame;
  }
  if (msg.showcase !== undefined) {
    const list = Array.isArray(msg.showcase) ? [...new Set(msg.showcase.map(String))] : [];
    if (list.length > D.SHOWCASE_MAX || !list.every(id => p.achievements[id])) return 'Solo puedes mostrar logros que hayas conseguido';
    p.showcase = list;
  }
  if (typeof msg.avatar === 'string') {
    if (!p.cosmetics.avatars.includes(msg.avatar)) return 'No tienes ese avatar';
    p.avatar = msg.avatar;
    p.avatarShiny = false;
    p.avatarArt = false;
  } else if (msg.avatar !== undefined) {
    const shiny = !!msg.avatarShiny && msg.avatar !== null;
    if (msg.avatar !== null && !p.caught.includes(msg.avatar)) return 'Solo puedes usar Pokémon que hayas atrapado';
    if (shiny && !(p.shinies || []).includes(msg.avatar)) return 'Solo puedes usar Pokémon que hayas atrapado';
    const art = !!msg.avatarArt && msg.avatar !== null;
    if (art && D.masteryWins(p, msg.avatar) < D.MASTERY_ART) return 'Esa ilustración aún no está desbloqueada';
    p.avatar = msg.avatar;
    p.avatarShiny = shiny;
    p.avatarArt = art;
  }
  return null;
}

module.exports = { migrate, afterRanked, claim, setLook, checkAchievements, claimAchievement, claimBadge, badgesToClaim, addMastery };
