// Panel de administración (public/admin/): resumen del servidor, jugadores, auditoría y moderación.
// Para entrar hace falta las tres cosas: una cuenta del juego, que esa cuenta esté dada de alta
// como admin (solo desde el servidor: tools/admin.js, por SSH; desde la web no hay forma) y el
// código de 6 cifras de su app de autenticación. La sesión es de esa conexión: caduca a los 30 min
// sin actividad o a las 12 h, y cada acción queda en la auditoría.
const os = require('os');
const crypto = require('crypto');
const store = require('./store.js');
const audit = require('./audit.js');
const totp = require('./totp.js');
const limits = require('./limits.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, secret TEXT NOT NULL, last_counter INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, note TEXT)`);
// Siempre se lee de la base de datos (no se guarda en memoria): así dar de alta o de baja desde la
// consola vale al momento aunque el servidor esté en marcha
const adminRow = id => db.prepare('SELECT * FROM admins WHERE id = ?').get(id) || null;

const IDLE_MS = 30 * 60e3, MAX_MS = 12 * 3600e3;
const BAN_HOURS = [1, 24, 24 * 7, 24 * 30, 0];   // 0 = para siempre
const sanitize = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Lo que el panel enseña de un perfil: todo menos el token y el hash de la contraseña
function adminView(p, online) {
  const { token, account, ...rest } = p;
  return { ...rest, account: account ? { user: account.user, since: account.since } : null, banned: store.banned(p), online };
}

// ctx: lo que el panel necesita del servidor (index.js)
function createAdmin(ctx) {
  const { clients, send, sendProfile, queues, version, startedAt } = ctx;
  const conns = id => [...clients].filter(c => c.profile && c.profile.id === id);
  const nameOf = id => { const p = store.byId(id); return p ? p.name : null; };

  function kick(id, msg) {
    for (const c of conns(id)) { send(c, msg); c.ws.close(4001); }
  }

  async function login(c, msg) {
    const user = sanitize(msg.user, 64);
    const fail = reason => {
      limits.userFailed(user);
      audit.log('admin.login.fallo', { ip: c.ip, user, reason });
      send(c, { t: 'admin.err', msg: 'Usuario, contraseña o código incorrectos' });
    };
    if (!limits.authAttempt(c.ip)) return send(c, { t: 'admin.err', msg: 'Demasiados intentos desde tu red: espera unos minutos' });
    if (limits.userLocked(user)) return send(c, { t: 'admin.err', msg: 'Demasiados intentos con esta cuenta: espera 15 minutos' });
    if (c.authing) return;
    c.authing = true;
    let p;
    try { p = await store.check(user, msg.pass); } finally { c.authing = false; }
    if (!p) return fail('contraseña');
    const row = adminRow(p.id);
    if (!row) return fail('no es admin');
    const counter = totp.verify(row.secret, msg.code);
    if (counter === null) return fail('código 2FA');
    // Un código ya usado no vale otra vez (si alguien lo ve por encima del hombro)
    if (counter <= row.last_counter) return fail('código 2FA repetido');
    db.prepare('UPDATE admins SET last_counter = ? WHERE id = ?').run(counter, p.id);
    c.admin = { id: p.id, name: p.name, at: Date.now(), seen: Date.now() };
    audit.log('admin.login', { actor: p.id, ip: c.ip });
    send(c, { t: 'admin.ok', name: p.name, version });
  }

  function overview() {
    const players = [...clients].filter(c => c.profile);
    const battles = new Set(players.filter(c => c.battle).map(c => c.battle));
    const byMode = {};
    for (const b of battles) byMode[b.mode] = (byMode[b.mode] || 0) + 1;
    const mem = process.memoryUsage();
    const day = Date.now() - 864e5;
    return {
      version, uptime: Date.now() - startedAt, maintenance: ctx.maintenance(),
      online: players.length, admins: [...clients].filter(c => c.admin).length,
      battles: battles.size, byMode, queues: Object.fromEntries(Object.entries(queues).map(([k, q]) => [k, q.length])),
      drafts: players.filter(c => c.draft).length / 2,
      server: { rss: mem.rss, heap: mem.heapUsed, load: os.loadavg(), cpus: os.cpus().length, freemem: os.freemem(), totalmem: os.totalmem(), node: process.version },
      store: store.stats(),
      events24h: audit.countsSince(day),
      onlineList: players.slice(0, 100).map(c => ({ id: c.profile.id, name: c.profile.name, ip: c.ip,
        doing: c.battle ? c.battle.mode : c.draft ? 'draft' : c.queue ? 'cola ' + c.queue : 'menú' })),
      recentAdmin: audit.query({ type: 'admin.', limit: 15 }).map(withNames),
    };
  }

  const withNames = r => ({ ...r, actorName: r.actor ? nameOf(r.actor) : null, targetName: r.target ? nameOf(r.target) : null });

  function player(id) {
    const p = store.byId(id);
    if (!p) return null;
    const live = conns(id);
    const ips = audit.ipsOf(id);
    const alts = new Map();
    for (const { ip } of ips) for (const a of audit.playersOnIp(ip)) if (a.id !== id) alts.set(a.id, { id: a.id, name: nameOf(a.id), ip });
    return {
      profile: adminView(p, live.length > 0),
      connections: live.map(c => ({ ip: c.ip, doing: c.battle ? c.battle.mode : c.draft ? 'draft' : c.queue ? 'cola' : 'menú' })),
      admin: !!adminRow(id), ips, alts: [...alts.values()].slice(0, 20),
      events: audit.query({ who: id, limit: 100 }).map(withNames),
    };
  }

  // Acciones: cada una devuelve un texto para el panel y queda en la auditoría
  const actions = {
    ban(c, msg, p) {
      const hours = BAN_HOURS.includes(+msg.hours) ? +msg.hours : 24;
      const reason = sanitize(msg.reason, 200) || 'Sin motivo';
      if (adminRow(p.id)) return 'No se puede suspender a un admin';
      p.ban = { until: hours ? Date.now() + hours * 3600e3 : null, reason, by: c.admin.id, at: Date.now() };
      store.persist(p);
      kick(p.id, { t: 'banned', reason, until: p.ban.until });
      audit.log('admin.ban', { actor: c.admin.id, target: p.id, ip: c.ip, hours, reason });
      return `${p.name} suspendido ${hours ? `${hours} h` : 'para siempre'}`;
    },
    unban(c, msg, p) {
      if (!p.ban) return 'No estaba suspendido';
      delete p.ban;
      store.persist(p);
      audit.log('admin.unban', { actor: c.admin.id, target: p.id, ip: c.ip });
      return `${p.name} ya puede volver a jugar`;
    },
    kick(c, msg, p) {
      const reason = sanitize(msg.reason, 200) || 'Un administrador te ha desconectado';
      const n = conns(p.id).length;
      kick(p.id, { t: 'error', msg: reason });
      audit.log('admin.kick', { actor: c.admin.id, target: p.id, ip: c.ip, reason, conns: n });
      return n ? `${p.name} desconectado (${n} conexión${n > 1 ? 'es' : ''})` : `${p.name} no estaba conectado`;
    },
    rename(c, msg, p) {
      const name = sanitize(msg.name, 16);
      if (!name) return 'Nombre vacío';
      const old = p.name;
      p.name = name;
      store.persist(p);
      for (const x of conns(p.id)) sendProfile(x);
      audit.log('admin.rename', { actor: c.admin.id, target: p.id, ip: c.ip, old, name });
      return `${old} ahora se llama ${name}`;
    },
    async resetpass(c, msg, p) {
      if (!p.account) return 'Es un invitado: no tiene contraseña';
      // Se enseña una vez al admin para que se la pase al jugador; no se guarda en ningún sitio
      const temp = crypto.randomBytes(9).toString('base64url');
      await store.setPassword(p, temp);
      audit.log('admin.resetpass', { actor: c.admin.id, target: p.id, ip: c.ip });
      return { msg: `Contraseña nueva para ${p.account.user}`, secret: temp };
    },
  };

  async function handle(c, msg) {
    if (msg.t === 'admin.login') return login(c, msg);
    const now = Date.now();
    // También se corta si le han quitado el admin desde la consola mientras tenía el panel abierto
    if (!c.admin || now - c.admin.seen > IDLE_MS || now - c.admin.at > MAX_MS || !adminRow(c.admin.id)) {
      if (c.admin) audit.log('admin.caduca', { actor: c.admin.id, ip: c.ip });
      else audit.logNoisy('admin.denegado', c.ip, { type: msg.t });
      c.admin = null;
      return send(c, { t: 'admin.out', msg: 'Inicia sesión otra vez' });
    }
    c.admin.seen = now;
    const reply = (data) => send(c, { t: msg.t, rid: msg.rid, ...data });
    switch (msg.t) {
      case 'admin.overview': return reply(overview());
      case 'admin.search': return reply({ rows: store.search(msg.q).map(p => ({ id: p.id, name: p.name, user: p.account ? p.account.user : null,
        created: p.created, elo: p.elo, ranked: p.ranked, banned: store.banned(p), online: conns(p.id).length > 0 })) });
      case 'admin.player': return reply({ player: player(String(msg.id)) });
      case 'admin.audit': {
        const rows = audit.query(msg).map(withNames);
        return reply({ rows, more: rows.length === Math.max(1, Math.min(500, msg.limit | 0 || 100)) });
      }
      case 'admin.action': {
        const p = store.byId(String(msg.id));
        const fn = actions[msg.a];
        if (!p || !fn) return reply({ err: 'Jugador o acción desconocidos' });
        const r = await fn(c, msg, p);
        return reply(typeof r === 'string' ? { ok: r } : { ok: r.msg, secret: r.secret });
      }
      case 'admin.broadcast': {
        const text = sanitize(msg.msg, 300);
        if (!text) return reply({ err: 'Mensaje vacío' });
        let n = 0;
        for (const x of clients) if (x.profile) { send(x, { t: 'announce', msg: text }); n++; }
        audit.log('admin.broadcast', { actor: c.admin.id, ip: c.ip, msg: text, to: n });
        return reply({ ok: `Enviado a ${n} jugador${n === 1 ? '' : 'es'}` });
      }
      case 'admin.maintenance': {
        const on = !!msg.on;
        ctx.setMaintenance(on);
        if (on) for (const x of clients) if (x.profile) send(x, { t: 'announce', msg: 'Mantenimiento: termina tu combate; durante un rato no se podrán empezar otros.' });
        audit.log('admin.mantenimiento', { actor: c.admin.id, ip: c.ip, on });
        return reply({ ok: on ? 'Mantenimiento activado: no se empiezan combates nuevos' : 'Mantenimiento desactivado' });
      }
      case 'admin.logout':
        audit.log('admin.logout', { actor: c.admin.id, ip: c.ip });
        c.admin = null;
        return send(c, { t: 'admin.out', msg: 'Sesión cerrada' });
    }
  }

  return { handle, kick };
}

// ---------- Consola (tools/admin.js) ----------
function grant(user, note = '') {
  const p = store.byUser(user);
  if (!p) throw new Error(`No hay ninguna cuenta registrada con el usuario «${user}»`);
  const secret = totp.newSecret();
  db.prepare(`INSERT INTO admins (id, secret, last_counter, created, note) VALUES (?, ?, 0, ?, ?)
    ON CONFLICT (id) DO UPDATE SET secret = excluded.secret, last_counter = 0, note = excluded.note`).run(p.id, secret, Date.now(), note);
  audit.log('admin.alta', { actor: 'consola', target: p.id, user: p.account.user, ...(note ? { note } : {}) });
  return { p, secret, uri: totp.uri(secret, p.account.user) };
}
function revoke(user) {
  const p = store.byUser(user);
  if (!p || !adminRow(p.id)) throw new Error(`«${user}» no es admin`);
  db.prepare('DELETE FROM admins WHERE id = ?').run(p.id);
  audit.log('admin.baja', { actor: 'consola', target: p.id, user: p.account.user });
  return p;
}
const list = () => db.prepare('SELECT id, created, note FROM admins ORDER BY created').all()
  .map(r => { const p = store.byId(r.id); return { ...r, name: p ? p.name : '?', user: p && p.account ? p.account.user : '?' }; });

module.exports = { createAdmin, grant, revoke, list, adminRow, BAN_HOURS };
