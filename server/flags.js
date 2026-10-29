// Interruptores: partes del juego que se pueden cerrar desde el panel de administración sin sacar versión (de
// momento, Lucky Spin). Se guardan en la base de datos: siguen igual aunque el servidor se reinicie o se despliegue.
// Cerrado, el servidor rechaza lo que haga falta y los jugadores dejan de verlo al momento; los admins lo siguen
// viendo y usando (para probarlo antes de abrirlo), con un aviso de que está cerrado para los demás
const store = require('./store.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS flags (id TEXT PRIMARY KEY, on_ INTEGER NOT NULL, at INTEGER NOT NULL, by TEXT)`);

// Los que hay, abiertos de entrada
const FLAGS = { spin: { label: 'Lucky Spin', desc: 'Las ruletas de gemas: el botón del menú y las tiradas' } };

const isOn = id => { const r = db.prepare('SELECT on_ FROM flags WHERE id = ?').get(id); return r ? !!r.on_ : true; };
function set(id, on, by) {
  if (!FLAGS[id]) return false;
  db.prepare('INSERT INTO flags (id, on_, at, by) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET on_ = excluded.on_, at = excluded.at, by = excluded.by').run(id, on ? 1 : 0, Date.now(), by || null);
  return true;
}
// Para el panel: cada interruptor con su estado y quién lo tocó por última vez
const list = () => Object.entries(FLAGS).map(([id, f]) => {
  const r = db.prepare('SELECT on_, at, by FROM flags WHERE id = ?').get(id);
  return { id, label: f.label, desc: f.desc, on: r ? !!r.on_ : true, at: r ? r.at : null, by: r ? r.by : null };
});
// Para un jugador: lo que puede usar (un admin, todo) y, si es admin, lo que está cerrado para los demás
function forPlayer(admin) {
  const out = {}, closed = [];
  for (const id of Object.keys(FLAGS)) { const on = isOn(id); out[id] = on || admin; if (!on && admin) closed.push(id); }
  return { ...out, closed };
}

module.exports = { FLAGS, isOn, set, list, forPlayer };
