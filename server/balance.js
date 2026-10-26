// Datos de equilibrio para el panel de admin (pestaña Balance): al acabar cada combate se suman, por día y
// por modo, contadores de cada Pokémon (partidas, victorias, daño hecho y recibido, KOs, debilitado), de cada
// movimiento (usos, aciertos, daño, KOs), del draft online (elegido y vetado) y de los líderes de la historia
// (intentos y victorias). Solo totales: nada de quién jugó. Se cuentan los lados que juega una persona;
// en los combates contra la IA, la IA no. Los cuenta Battle (battle.stats) y se guardan en la tabla balance.
const D = require('../public/data.js');
const store = require('./store.js');

const KEEP_DAYS = 120;
const DAY = 864e5;
const db = store.db;
db.exec(`CREATE TABLE IF NOT EXISTS balance (day TEXT NOT NULL, mode TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
  f TEXT NOT NULL, n REAL NOT NULL, PRIMARY KEY (day, mode, kind, key, f))`);
const upsert = db.prepare(`INSERT INTO balance (day, mode, kind, key, f, n) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (day, mode, kind, key, f) DO UPDATE SET n = n + excluded.n`);

// Suma filas [kind, key, f, n] al día de hoy en ese modo, en una transacción
function add(mode, rows) {
  if (!rows.length) return;
  const day = D.dayKey(Date.now());
  db.exec('BEGIN');
  try {
    for (const [kind, key, f, n] of rows) if (n) upsert.run(day, mode, kind, String(key), f, n);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Modo de un combate para los datos: los de la historia se separan en ruta (salvajes) y líder
const modeOf = b => b.mode === 'wild' ? 'ruta' : b.mode === 'trainer' ? 'lider' : b.mode;

// Un combate que acaba (Battle.finish). El tutorial no cuenta: es siempre el mismo combate guiado
function battle(b, result) {
  if (b.tutorial) return;
  const rows = [];
  for (const side of b.sides) {
    if (side.ai !== null || side.wild) continue;
    const won = result.winner === side.idx ? 1 : 0;
    side.team.forEach((m, slot) => {
      const st = b.stats.mons[side.idx][slot] || { dmg: 0, taken: 0, kos: 0, out: 0 };
      rows.push(['mon', m.dex, 'games', 1], ['mon', m.dex, 'wins', won], ['mon', m.dex, 'out', st.out], ['mon', m.dex, 'dmg', st.dmg],
        ['mon', m.dex, 'taken', st.taken], ['mon', m.dex, 'kos', st.kos], ['mon', m.dex, 'fainted', m.fainted ? 1 : 0]);
    });
    for (const [key, mv] of Object.entries(b.stats.moves[side.idx])) {
      rows.push(['move', key, 'casts', mv.casts], ['move', key, 'landed', mv.landed], ['move', key, 'dmg', mv.dmg], ['move', key, 'kos', mv.kos]);
    }
  }
  rows.push(['all', 'battles', 'n', 1]);
  add(modeOf(b), rows);
}

// Draft online: qué se elige y qué se veta
function draft(mode, picks, bans) {
  const rows = [];
  for (const list of picks) for (const dex of list || []) rows.push(['mon', dex, 'picked', 1]);
  for (const dex of bans) if (dex) rows.push(['mon', dex, 'banned', 1]);
  rows.push(['all', 'drafts', 'n', 1]);
  add(mode, rows);
}

// Líder de gimnasio, Alto Mando o Campeón de la historia: un intento y si se gana
function leader(node, won) {
  add('lider', [['leader', node.id, 'tries', 1], ['leader', node.id, 'wins', won ? 1 : 0]]);
}

// Torre Batalla: cada combate (por su número en la racha), un intento y si se gana. Así se ve en qué piso cae la gente
function tower(n, won) {
  add('tower', [['tower', n, 'tries', 1], ['tower', n, 'wins', won ? 1 : 0]]);
}

// Resumen para el panel: los últimos `days` días, de un modo o de todos ('')
function summary(days = 14, mode = '') {
  const from = D.dayKey(Date.now() - (Math.max(1, Math.min(KEEP_DAYS, days | 0)) - 1) * DAY);
  const rows = mode
    ? db.prepare('SELECT kind, key, f, SUM(n) AS n FROM balance WHERE day >= ? AND mode = ? GROUP BY kind, key, f').all(from, mode)
    : db.prepare('SELECT kind, key, f, SUM(n) AS n FROM balance WHERE day >= ? GROUP BY kind, key, f').all(from);
  const by = { mon: {}, move: {}, leader: {}, tower: {}, all: {} };
  for (const r of rows) ((by[r.kind] || (by[r.kind] = {}))[r.key] || (by[r.kind][r.key] = {}))[r.f] = r.n;
  const all = { battles: (by.all.battles || {}).n || 0, drafts: (by.all.drafts || {}).n || 0 };
  const mons = Object.entries(by.mon).map(([dex, s]) => ({ dex: +dex, name: (D.SPECIES[dex] || { name: dex }).name, types: (D.SPECIES[dex] || {}).types || [], games: s.games || 0, wins: s.wins || 0,
    out: s.out || 0, dmg: s.dmg || 0, taken: s.taken || 0, kos: s.kos || 0, fainted: s.fainted || 0, picked: s.picked || 0, banned: s.banned || 0 }));
  const moves = Object.entries(by.move).map(([key, s]) => ({ key, name: (D.MOVES[key] || { name: key }).name, type: (D.MOVES[key] || {}).type || null,
    casts: s.casts || 0, landed: s.landed || 0, dmg: s.dmg || 0, kos: s.kos || 0 }));
  const leaders = Object.entries(by.leader).map(([id, s]) => {
    const node = D.NODES[id] || {};
    return { id, name: node.leader || id, region: node.region || null, index: node.index ?? null, tries: s.tries || 0, wins: s.wins || 0 };
  });
  const towerRows = Object.entries(by.tower || {}).map(([n, s]) => ({ n: +n, tries: s.tries || 0, wins: s.wins || 0 })).sort((a, b) => a.n - b.n);
  return { days, mode, from, all, mons, moves, leaders, tower: towerRows };
}

// Los días viejos se borran (cada 6 h)
function purge() {
  db.prepare('DELETE FROM balance WHERE day < ?').run(D.dayKey(Date.now() - KEEP_DAYS * DAY));
}
setInterval(purge, 6 * 3600e3).unref();

module.exports = { battle, draft, leader, tower, summary, purge };
