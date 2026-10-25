// Recompensas de clasificatoria, temporadas, logros, maestría y cosméticos del perfil (títulos, marcos,
// avatares, brillos de burbuja y skins).
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
  if (!p.cosmetics.effects) p.cosmetics.effects = [];
  if (!p.koByType) p.koByType = {};
  if (!p.lineStats) p.lineStats = {};
  if (!p.mastery) p.mastery = {};
  if (!p.cosmetics.auras) p.cosmetics.auras = [];
  if (!p.skins) p.skins = {};
  // Los glows del sprite (quitados) pasan a ser glows del avatar con el mismo nombre
  if (p.cosmetics.glows) { for (const g of p.cosmetics.glows) if (D.AURAS.includes(g)) unlock(p, 'auras', g); delete p.cosmetics.glows; }
  delete p.glows;
  // Skins ganadas en Tesoros ('elemental:<línea>'); la Elemental que antes era el premio de maestría de
  // 600 victorias (nivel 7, ya quitado) pasa aquí para quien la tuviera
  if (!p.cosmetics.skins) p.cosmetics.skins = [];
  // Retos de línea nuevos (Logros): los premios de maestría de antes eran otros, se empieza de cero
  if (p.masteryV !== 2) {
    for (const [root, list] of Object.entries(p.masteryClaimed || {})) if (list.includes(7)) unlock(p, 'skins', 'elemental:' + root);
    p.masteryClaimed = {};
    p.masteryV = 2;
  }
  // Partículas: antes iban con la skin Elemental; quien la tenga se queda también sus partículas, puestas
  if (!p.cosmetics.particles) {
    p.cosmetics.particles = [];
    p.particles = {};
    for (const s of p.cosmetics.skins || []) if (s.startsWith('elemental:')) { const l = +s.split(':')[1]; unlock(p, 'particles', l); if (p.skins[l] === 'elemental') p.particles[l] = true; }
  }
  if (!p.particles) p.particles = {};
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
  const loot = { coins: rw.coins || 0, items: {}, title: rw.title || null, frame: rw.frame || null, aura: rw.aura || null, avatar: D.achievementAvatar(a), achievement: id };
  p.coins = Math.min(MAX_COINS, p.coins + loot.coins);
  if (loot.title) unlock(p, 'titles', loot.title);
  if (loot.frame) unlock(p, 'frames', loot.frame);
  if (loot.aura) unlock(p, 'auras', loot.aura);
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
// Devuelve las líneas que llegan a un premio nuevo (se recoge a mano con claimMastery).
function addMastery(p, dexes) {
  migrate(p);
  const ups = [];
  for (const root of new Set(dexes.filter(d => D.SPECIES[d]).map(D.lineOf))) {
    const before = p.mastery[root] || 0;
    p.mastery[root] = before + 1;
    if (D.masteryTier(before + 1) > D.masteryTier(before)) ups.push({ dex: root, tier: D.masteryTier(before + 1) });
  }
  return ups;
}

// Debilitados del combate b hechos por el lado idx, por tipo del movimiento (logros ko-<tipo>)
function addKOs(p, b, idx) {
  migrate(p);
  for (const k of b.kos || []) if (k.by === idx && k.type) p.koByType[k.type] = (p.koByType[k.type] || 0) + 1;
}

// Contadores de los retos de línea: victorias online (pvp, suma) y mejor racha de la Torre (tower, máximo)
function addLineStat(p, dexes, stat, value = 1, max = false) {
  migrate(p);
  const s = p.lineStats[stat] = p.lineStats[stat] || {};
  for (const root of new Set(dexes.filter(d => D.SPECIES[d]).map(D.lineOf))) s[root] = max ? Math.max(s[root] || 0, value) : (s[root] || 0) + value;
}

// Recoger el premio i de la maestría de una línea
function claimMastery(p, dex, i) {
  migrate(p);
  if (!D.SPECIES[dex]) return { error: 'Ese Pokémon no existe' };
  const root = D.lineOf(dex), tier = D.MASTERY_TIERS[i];
  if (!tier) return { error: 'Ese premio no existe' };
  if (!D.masteryReady(p, root).includes(i)) return { error: 'No hay nada que recoger de ese premio' };
  p.masteryClaimed[root] = [...(p.masteryClaimed[root] || []), i];
  const loot = { coins: 0, items: {}, mastery: { dex: root, tier: i, kind: tier.kind } };
  if (tier.kind === 'art') loot.art = root;
  if (tier.kind === 'portrait') { unlock(p, 'avatars', 'pt:' + root); loot.avatar = 'pt:' + root; }
  if (tier.kind === 'aura') { unlock(p, 'auras', D.typeAuraOf(root)); loot.aura = D.typeAuraOf(root); }
  if (tier.kind === 'frame') { unlock(p, 'frames', D.typeFrameOf(root)); loot.frame = D.typeFrameOf(root); }
  if (tier.kind === 'skin') loot.skin = tier.skin;
  if (tier.kind === 'title') { unlock(p, 'titles', D.masteryTitle(root)); loot.title = D.masteryTitle(root); }
  if (tier.aura) { unlock(p, 'auras', tier.aura); loot.aura2 = tier.aura; }
  return { loot };
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

// Gemas de Tesoros (aquí y no en treasure.js para no requerirse en círculo)
function addGems(p, n) {
  if (p.gems === undefined) p.gems = 0;
  p.gems = Math.min(999999, p.gems + (n || 0));
  return n || 0;
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
  const gems = first ? addGems(p, D.GEMS.firstWin) : 0;
  return { coins, firstWin: first, gems };
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
  addGems(p, D.GEMS.league);
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
  if (msg.aura !== undefined) {
    if (msg.aura !== null && !p.cosmetics.auras.includes(msg.aura)) return 'No tienes ese glow';
    p.aura = msg.aura;
  }
  // Skin de una línea evolutiva: { dex, skin } (skin null = sin skin)
  if (msg.skin !== undefined) {
    const dex = msg.skin && +msg.skin.dex, id = msg.skin && msg.skin.skin;
    if (!D.SPECIES[dex]) return 'Ese Pokémon no existe';
    if (id !== null && !(D.SKINS.includes(id) && D.hasSkin(p, dex, id))) return 'No tienes esa skin';
    if (id) p.skins[D.lineOf(dex)] = id; else delete p.skins[D.lineOf(dex)];
  }
  // Partículas de una línea: { dex, on }
  if (msg.particles !== undefined) {
    const dex = msg.particles && +msg.particles.dex;
    if (!D.SPECIES[dex]) return 'Ese Pokémon no existe';
    if (msg.particles.on && !D.hasParticles(p, dex)) return 'No tienes esas partículas';
    if (msg.particles.on) p.particles[D.lineOf(dex)] = true; else delete p.particles[D.lineOf(dex)];
  }
  if (msg.showcase !== undefined) {
    const list = Array.isArray(msg.showcase) ? [...new Set(msg.showcase.map(String))] : [];
    if (list.length > D.SHOWCASE_MAX || !list.every(id => p.achievements[id])) return 'Solo puedes mostrar logros que hayas conseguido';
    p.showcase = list;
  }
  // Efecto del avatar (por encima de la imagen): uno de los conseguidos, o null para ninguno
  if (msg.effect !== undefined) {
    if (msg.effect !== null && !(p.cosmetics.effects || []).includes(msg.effect)) return 'No tienes ese efecto';
    p.effect = msg.effect;
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
    if (art && !D.hasMastery(p, msg.avatar, 'art')) return 'Esa ilustración aún no está desbloqueada';
    p.avatar = msg.avatar;
    p.avatarShiny = shiny;
    p.avatarArt = art;
  }
  return null;
}

module.exports = { unlock, addGems, migrate, afterRanked, claim, setLook, checkAchievements, claimAchievement, claimBadge, badgesToClaim, addMastery, claimMastery, addKOs, addLineStat };
