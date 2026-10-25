// Premio diario por entrar (Data.DAILY_LOGIN, un ciclo de 7 días que se recoge a mano) y premio del
// tutorial (una vez). En el perfil: p.daily = { last: 'AAAA-MM-DD' del último recogido, streak: día del
// ciclo recogido ese día (1-7) } y p.tutorial = true cuando ya se ha cobrado el del tutorial.
const D = require('../public/data.js');
const { pay } = require('./missions.js');

const DAY = 864e5;

// Qué toca hoy: el día del ciclo (1-7), si se puede recoger y cuándo se renueva
function view(p, now = Date.now()) {
  const d = p.daily || { last: null, streak: 0 };
  const today = D.dayKey(now), yesterday = D.dayKey(now - DAY);
  if (d.last === today) return { day: d.streak, ready: false, claimed: true, ends: D.nextDay(now) };
  // Ayer recogió: sigue el ciclo (tras el 7.º vuelve al 1.º); si no, empieza de nuevo
  const day = d.last === yesterday ? (d.streak % D.DAILY_LOGIN.length) + 1 : 1;
  return { day, ready: true, claimed: false, ends: D.nextDay(now), lost: !!d.last && d.last !== yesterday && d.streak > 1 };
}

function claim(p, now = Date.now()) {
  const v = view(p, now);
  if (!v.ready) return { error: 'Ya has recogido el premio de hoy: vuelve mañana' };
  p.daily = { last: D.dayKey(now), streak: v.day };
  return { loot: { ...pay(p, D.DAILY_LOGIN[v.day - 1]), daily: v.day } };
}

function claimTutorial(p) {
  if (p.tutorial) return { error: 'Ya has recogido el premio del tutorial' };
  p.tutorial = true;
  return { loot: { ...pay(p, D.TUTORIAL_REWARD), tutorial: true } };
}

module.exports = { view, claim, claimTutorial };
