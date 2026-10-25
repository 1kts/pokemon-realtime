// Métricas para el panel de admin: cuántos juegan cada día, cuántos son nuevos, cuántos combates hay y
// cuántos vuelven al día siguiente y a la semana. Cada perfil guarda en p.act los días que ha entrado en
// las últimas KEEP jornadas y cuántos combates jugó cada uno: { 'AAAA-MM-DD': combates }.
const D = require('../public/data.js');

const KEEP = 35;     // días que se guardan por perfil
const DAY = 864e5;

// Ha entrado hoy (y se tiran los días que ya no se usan). Dice si es su primera vez en el día (hay que guardar)
function touch(p, now = Date.now()) {
  const today = D.dayKey(now);
  if (!p.act) p.act = {};
  if (today in p.act) return false;
  p.act[today] = 0;
  const oldest = D.dayKey(now - KEEP * DAY);
  for (const k of Object.keys(p.act)) if (k < oldest) delete p.act[k];
  return true;
}
// Ha empezado un combate
function battle(p, now = Date.now()) {
  touch(p, now);
  p.act[D.dayKey(now)]++;
}

// Resumen de los últimos `days` días (de hoy hacia atrás) a partir de todos los perfiles.
// Vuelven al día siguiente / a los 7 días: de los que se crearon ese día, cuántos entraron 1 o 7 días después.
function compute(profiles, now = Date.now(), days = 14) {
  const keys = Array.from({ length: days }, (_, i) => D.dayKey(now - i * DAY));
  const rows = new Map(keys.map(k => [k, { day: k, active: 0, fresh: 0, battles: 0, d1: [0, 0], d7: [0, 0] }]));
  const plus = (k, n) => D.dayKey(Date.parse(k) + n * DAY);
  const today = keys[0];
  const span = n => Array.from({ length: n }, (_, i) => D.dayKey(now - i * DAY));
  const last7 = new Set(span(7)), last30 = new Set(span(30));
  let wau = 0, mau = 0, total = 0, accounts = 0;
  for (const p of profiles) {
    total++;
    if (p.account) accounts++;
    const act = p.act || {};
    const seen = Object.keys(act);
    if (seen.some(k => last7.has(k))) wau++;
    if (seen.some(k => last30.has(k))) mau++;
    for (const k of seen) { const r = rows.get(k); if (r) { r.active++; r.battles += act[k]; } }
    const born = p.created ? D.dayKey(p.created) : null;
    const r = born && rows.get(born);
    if (!r) continue;
    r.fresh++;
    // Solo cuentan las cohortes cuyo día de vuelta ya ha pasado o es hoy
    for (const [n, key] of [[1, 'd1'], [7, 'd7']]) {
      const back = plus(born, n);
      if (back > today) continue;
      r[key][0]++;
      if (back in act) r[key][1]++;
    }
  }
  return { days: [...rows.values()], summary: { dau: rows.get(today).active, wau, mau, total, accounts } };
}

module.exports = { touch, battle, compute, KEEP };
