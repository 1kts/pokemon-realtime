// Uso del juego por día para el panel de admin (pestaña Actividad): sesiones, minutos jugados, desde qué aparato
// (móvil, tablet o PC), en qué idioma, si lo abren como app y qué pantallas se visitan. Solo contadores del día,
// sin decir de quién: nada que identifique a nadie. Se guarda 120 días.
const D = require('../public/data.js');
const store = require('./store.js');

const KEEP_DAYS = 120, DAY = 864e5, MAX_MIN = 360;
const db = store.db;
db.exec(`CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, key TEXT NOT NULL, n REAL NOT NULL, PRIMARY KEY (day, key))`);
const upsert = db.prepare(`INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n`);
const add = (key, n = 1) => { try { upsert.run(D.dayKey(Date.now()), key, n); } catch (e) { console.error('Uso:', e.message); } };

const DEVICES = ['movil', 'tablet', 'pc'];
const VIEW_RE = /^[a-z_]{2,20}$/;

// Al conectar, el juego dice desde qué aparato juega, en qué idioma y si va como app (una vez por conexión)
function session(c, msg) {
  if (c.usage) return;
  c.usage = { at: Date.now(), views: new Set() };
  add('sesiones');
  add('aparato:' + (DEVICES.includes(msg.device) ? msg.device : 'pc'));
  if (/^[a-z]{2}$/.test(msg.lang || '')) add('idioma:' + msg.lang);
  if (msg.app) add('app');
}
// Una pantalla vista (cada una cuenta una vez por sesión: cuánta gente llega, no cuántas veces entra)
function view(c, msg) {
  const v = String(msg.v || '');
  if (!c.usage || !VIEW_RE.test(v) || c.usage.views.has(v) || c.usage.views.size > 40) return;
  c.usage.views.add(v);
  add('pantalla:' + v);
}
// Al cerrar: los minutos que ha durado (como mucho 6 h, por si una pestaña se queda abierta)
function close(c) {
  if (!c.usage) return;
  add('minutos', Math.min(MAX_MIN, (Date.now() - c.usage.at) / 60e3));
  c.usage = null;
}

// Resumen de los últimos `days` días: total por clave y por día
function summary(days = 14) {
  const from = D.dayKey(Date.now() - (Math.max(1, Math.min(KEEP_DAYS, days | 0)) - 1) * DAY);
  const rows = db.prepare('SELECT day, key, n FROM usage WHERE day >= ? ORDER BY day').all(from);
  const total = {}, byDay = {};
  for (const r of rows) {
    total[r.key] = (total[r.key] || 0) + r.n;
    (byDay[r.day] || (byDay[r.day] = {}))[r.key] = r.n;
  }
  return { days, from, total, byDay };
}

setInterval(() => db.prepare('DELETE FROM usage WHERE day < ?').run(D.dayKey(Date.now() - KEEP_DAYS * DAY)), 6 * 3600e3).unref();

module.exports = { session, view, close, summary };
