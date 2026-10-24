// Registro de auditoría en la misma base de datos: qué pasó, quién lo hizo (actor), a quién
// (target), desde qué IP y cuándo. Los tipos van por grupos ("cuenta.fallo", "admin.ban"…) para
// filtrar por prefijo. Se guarda 40 días; las acciones de los admins, siempre.
const store = require('./store.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, type TEXT NOT NULL,
    actor TEXT, target TEXT, ip TEXT, data TEXT);
  CREATE INDEX IF NOT EXISTS audit_at ON audit (at);
  CREATE INDEX IF NOT EXISTS audit_type ON audit (type, at);
  CREATE INDEX IF NOT EXISTS audit_actor ON audit (actor, at);
  CREATE INDEX IF NOT EXISTS audit_target ON audit (target, at);
  CREATE INDEX IF NOT EXISTS audit_ip ON audit (ip, at)`);

const KEEP_MS = 40 * 864e5;
const insert = db.prepare('INSERT INTO audit (at, type, actor, target, ip, data) VALUES (?, ?, ?, ?, ?, ?)');

// Apunta un evento. Nunca rompe lo que se estaba haciendo: si falla, solo lo dice en el registro.
function log(type, { actor = null, target = null, ip = null, ...data } = {}) {
  try { insert.run(Date.now(), type, actor, target, ip, Object.keys(data).length ? JSON.stringify(data) : null); }
  catch (e) { console.error('Auditoría:', e.message); }
}

// Los avisos de los límites (inundaciones, conexiones de más…) los puede provocar cualquiera sin
// parar: como mucho uno por IP y tipo cada minuto, para que no llenen la base de datos
const lastNoisy = new Map();
function logNoisy(type, ip, data = {}) {
  const key = type + ' ' + ip, now = Date.now();
  if (now - (lastNoisy.get(key) || 0) < 60e3) return;
  lastNoisy.set(key, now);
  log(type, { ip, ...data });
}
setInterval(() => { const now = Date.now(); for (const [k, t] of lastNoisy) if (now - t > 60e3) lastNoisy.delete(k); }, 60e3).unref();

// Consulta con filtros, de lo más nuevo a lo más viejo; before (un id) para la página siguiente
function query({ type, who, ip, from, to, before, limit = 100 } = {}) {
  const where = [], args = [];
  if (type) { where.push('type LIKE ?'); args.push(String(type).replace(/[%_]/g, '').slice(0, 40) + '%'); }
  if (who) { where.push('(actor = ? OR target = ?)'); args.push(String(who), String(who)); }
  if (ip) { where.push('ip = ?'); args.push(String(ip).slice(0, 64)); }
  if (Number.isFinite(+from) && +from > 0) { where.push('at >= ?'); args.push(+from); }
  if (Number.isFinite(+to) && +to > 0) { where.push('at <= ?'); args.push(+to); }
  if (Number.isFinite(+before) && +before > 0) { where.push('id < ?'); args.push(+before); }
  const n = Math.max(1, Math.min(500, limit | 0 || 100));
  return db.prepare(`SELECT * FROM audit ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
    .all(...args, n).map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null }));
}

// Cuántos eventos de cada tipo desde un momento (para el resumen del panel)
const countsSince = since => db.prepare('SELECT type, COUNT(*) AS n FROM audit WHERE at >= ? GROUP BY type ORDER BY n DESC').all(since);
// IPs desde las que ha jugado alguien, y quién más ha jugado desde una IP (cuentas del mismo jugador)
const ipsOf = id => db.prepare(`SELECT ip, COUNT(*) AS n, MAX(at) AS last FROM audit
  WHERE (actor = ? OR target = ?) AND ip IS NOT NULL GROUP BY ip ORDER BY last DESC LIMIT 20`).all(id, id);
const playersOnIp = ip => db.prepare(`SELECT actor AS id, MAX(at) AS last FROM audit
  WHERE ip = ? AND actor IS NOT NULL AND type NOT LIKE 'admin.%' GROUP BY actor ORDER BY last DESC LIMIT 20`).all(ip);

// Borra lo que tiene más de 40 días, menos las acciones de los admins
function prune(now = Date.now()) {
  return Number(db.prepare("DELETE FROM audit WHERE at < ? AND type NOT LIKE 'admin.%'").run(now - KEEP_MS).changes);
}
prune();
setInterval(prune, 6 * 3600e3).unref();

module.exports = { log, logNoisy, query, countsSince, ipsOf, playersOnIp, prune, KEEP_MS };
