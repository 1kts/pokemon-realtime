// Bugs que reportan los jugadores desde el juego: se guardan en la base de datos (el panel de admin los lista y
// los marca como vistos o resueltos) y, si el servidor tiene un bot de Telegram configurado, llegan también como
// mensaje, por el mismo bot que los avisos de los vigilantes: TELEGRAM_TOKEN y TELEGRAM_CHAT, de /etc/arena-alerts.env
// (ver deploy/README.md, «Vigilancia»).
const store = require('./store.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS bugs (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, player TEXT, name TEXT, ip TEXT,
    view TEXT, version TEXT, ua TEXT, screen TEXT, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'nuevo');
  CREATE INDEX IF NOT EXISTS bugs_at ON bugs (at);
  CREATE INDEX IF NOT EXISTS bugs_player ON bugs (player, at)`);

const MIN = 10, MAX = 1000, PER_HOUR = 5;
const STATUS = ['nuevo', 'visto', 'resuelto'];
const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const insert = db.prepare('INSERT INTO bugs (at, player, name, ip, view, version, ua, screen, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const recent = db.prepare('SELECT COUNT(*) AS n FROM bugs WHERE player = ? AND at > ?');

// Un jugador manda un bug: devuelve un error para enseñarle o null si ha ido bien
function report(c, msg) {
  if (!c.profile) return 'Entra en el juego para reportar un bug';
  const text = clean(msg.text, MAX);
  if (text.length < MIN) return 'Cuéntanos un poco más (al menos 10 letras)';
  if (recent.get(c.profile.id, Date.now() - 3600e3).n >= PER_HOUR) return 'Ya has mandado varios reportes: espera un rato';
  // Sin la IP: con quién lo manda basta (el registro de seguridad ya la guarda 40 días)
  const bug = { at: Date.now(), player: c.profile.id, name: c.profile.name, ip: null, view: clean(msg.view, 40), version: clean(msg.version, 20),
    ua: clean(msg.ua, 300), screen: clean(msg.screen, 20), text };
  const id = insert.run(bug.at, bug.player, bug.name, bug.ip, bug.view, bug.version, bug.ua, bug.screen, bug.text).lastInsertRowid;
  telegram(`🐞 Bug #${id} de ${bug.name}\nPantalla: ${bug.view || '—'} · v${bug.version || '?'} · ${bug.screen || '?'}\n${bug.ua}\n\n${bug.text}`);
  return null;
}

// Aviso por Telegram (texto plano, sin formato: lo que escribe el jugador no puede colar nada). Si no hay bot
// configurado o falla, el bug ya está guardado: solo se apunta el error
function telegram(text) {
  const token = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT;
  if (!token || !chat || typeof fetch !== 'function') return;
  fetch(`${process.env.TELEGRAM_API || 'https://api.telegram.org'}/bot${token}/sendMessage`, {   // (TELEGRAM_API: para las pruebas)
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
  }).then(r => { if (!r.ok) console.error('Telegram: respuesta', r.status); }).catch(e => console.error('Telegram:', e.message));
}

// Panel de admin: la lista (los nuevos primero) y cambiar el estado
function list(status) {
  const where = STATUS.includes(status) ? 'WHERE status = ?' : '';
  return db.prepare(`SELECT * FROM bugs ${where} ORDER BY (status = 'nuevo') DESC, at DESC LIMIT 300`).all(...(where ? [status] : []));
}
function setStatus(id, status) {
  if (!STATUS.includes(status)) return false;
  return db.prepare('UPDATE bugs SET status = ? WHERE id = ?').run(status, Number(id) | 0).changes > 0;
}
// Si se borra un jugador (lo pide él o es un invitado viejo), sus reportes también
store.onRemove(p => db.prepare('DELETE FROM bugs WHERE player = ?').run(p.id));

// Los reportes se guardan un año (lo que dice la política de privacidad); se repasa cada 6 h
setInterval(() => db.prepare('DELETE FROM bugs WHERE at < ?').run(Date.now() - 365 * 864e5), 6 * 3600e3).unref();
const countNew = () => db.prepare("SELECT COUNT(*) AS n FROM bugs WHERE status = 'nuevo'").get().n;

module.exports = { report, list, setStatus, countNew, telegram, MIN, MAX };
