// Ajustes que se cambian desde el panel de admin sin sacar versión (se guardan en la base de datos):
//   - costs: lo que cuesta mantener el juego, que sale en «Apoyar» (servidor en € al mes y dominio en € al año);
//   - wheels: qué ruletas de Lucky Spin salen cada semana ({ periodo: [línea, línea, línea] }); la semana que no
//     esté, las de por defecto. El plan llega al juego con los interruptores (flags) y se aplica igual en los dos lados.
const D = require('../public/data.js');
const store = require('./store.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL, by TEXT)`);
const get = (key, def) => { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); try { return r ? JSON.parse(r.value) : def; } catch { return def; } };
const put = (key, value, by) => db.prepare('INSERT INTO settings (key, value, at, by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at, by = excluded.by')
  .run(key, JSON.stringify(value), Date.now(), by || null);

// ---------- Lo que cuesta el juego ----------
const COSTS = { server: 10, domain: 12 };
const costs = () => ({ ...COSTS, ...get('costs', {}) });
function setCosts({ server, domain }, by) {
  const ok = v => Number.isFinite(+v) && +v >= 0 && +v <= 100000;
  if (!ok(server) || !ok(domain)) return 'Pon cantidades entre 0 y 100.000 €';
  put('costs', { server: Math.round(+server * 100) / 100, domain: Math.round(+domain * 100) / 100 }, by);
  return null;
}

// ---------- Ruletas por semana ----------
// (solo las de esta semana en adelante: las pasadas se olvidan)
const wheelPlan = (now = Date.now()) => {
  const cur = D.treasurePeriod(now), plan = get('wheels', {});
  return Object.fromEntries(Object.entries(plan).filter(([p]) => +p >= cur));
};
// lines: las 3 líneas elegidas, o null para volver a las de por defecto
function setWheels(period, lines, by, now = Date.now()) {
  const cur = D.treasurePeriod(now);
  if (!Number.isInteger(period) || period < cur || period > cur + 52) return 'Esa semana no se puede cambiar';
  const plan = wheelPlan(now);
  if (lines === null) delete plan[period];
  else {
    lines = Array.isArray(lines) ? lines.map(Number) : [];
    if (!D.validWheelLines(lines)) return 'Elige 3 ruletas distintas';
    plan[period] = lines;
  }
  put('wheels', plan, by);
  D.setWheelPlan(plan);
  return null;
}
// Para el panel: esta semana y las `n` siguientes, cada una con sus fechas, las suyas y las de por defecto
function weeks(n = 8, now = Date.now()) {
  const cur = D.treasurePeriod(now), plan = wheelPlan(now), DAY = 864e5;
  return Array.from({ length: n }, (_, k) => {
    const p = cur + k, ends = D.treasureEnds(now) + k * D.TREASURE_DAYS * DAY;
    return { period: p, from: ends - D.TREASURE_DAYS * DAY, to: ends, lines: D.wheelLines(p), def: D.defaultWheelLines(p), custom: !!plan[p] };
  });
}
const wheelOptions = () => D.TREASURE_LINES.map(line => ({ line, name: D.SPECIES[line].name, type: D.SPECIES[line].types[0] }));

D.setWheelPlan(wheelPlan());

module.exports = { costs, setCosts, wheelPlan, setWheels, weeks, wheelOptions };
