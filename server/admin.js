// Panel de administración (public/admin/): resumen del servidor, jugadores, auditoría y moderación.
// Para entrar hace falta las tres cosas: una cuenta del juego, que esa cuenta esté dada de alta
// como admin (solo desde el servidor: tools/admin.js, por SSH; desde la web no hay forma) y el
// código de 6 cifras de su app de autenticación. La sesión es de esa conexión: caduca a los 30 min
// sin actividad o a las 12 h, y cada acción queda en la auditoría.
const os = require('os');
const crypto = require('crypto');
const store = require('./store.js');
const audit = require('./audit.js');
const balance = require('./balance.js');
const totp = require('./totp.js');
const limits = require('./limits.js');
const story = require('./story.js');
const rewards = require('./rewards.js');
const tower = require('./tower.js');
const metrics = require('./metrics.js');
const bugs = require('./bugs.js');
const insights = require('./insights.js');
const usage = require('./usage.js');
const flags = require('./flags.js');
const D = require('../public/data.js');

const { db } = store;
db.exec(`CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, secret TEXT NOT NULL, last_counter INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, note TEXT)`);
// Siempre se lee de la base de datos (no se guarda en memoria): así dar de alta o de baja desde la
// consola vale al momento aunque el servidor esté en marcha
const adminRow = id => db.prepare('SELECT * FROM admins WHERE id = ?').get(id) || null;

const IDLE_MS = 30 * 60e3, MAX_MS = 12 * 3600e3;
const BAN_HOURS = [1, 24, 24 * 7, 24 * 30, 0];   // 0 = para siempre
const sanitize = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Lo que el panel enseña de un perfil: todo menos el token y el hash de la contraseña. De las cuentas que
// entran con Google o con el correo no se enseña el correo: solo cómo entran
const userOf = a => a.user || `(${a.google ? 'Google' : 'correo'}, sin usuario)`;
function adminView(p, online) {
  const { token, account, ...rest } = p;
  return { ...rest, account: account ? { user: userOf(account), since: account.since } : null, banned: store.banned(p), online };
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
    send(c, { t: 'admin.ok', id: p.id, name: p.name, version });
  }

  function overview() {
    const players = [...clients].filter(c => c.profile);
    const battles = new Set(players.filter(c => c.battle).map(c => c.battle));
    const byMode = {};
    for (const b of battles) byMode[b.mode] = (byMode[b.mode] || 0) + 1;
    const mem = process.memoryUsage();
    const day = Date.now() - 864e5;
    return {
      version, uptime: Date.now() - startedAt, maintenance: ctx.maintenance(), bugsNew: bugs.countNew(),
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
      // Nombres de las especies que salen en su ficha (sus Pokémon y sus partidas)
      names: Object.fromEntries([...new Set([...(p.mons || []).map(m => m.dex), ...(p.history || []).flatMap(x => [...(x.team || []), ...(x.foeTeam || [])])])]
        .filter(d => D.SPECIES[d]).map(d => [d, D.SPECIES[d].name])),
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
      store.setName(p, name);
      store.persist(p);
      for (const x of conns(p.id)) sendProfile(x);
      audit.log('admin.rename', { actor: c.admin.id, target: p.id, ip: c.ip, old, name });
      return `${old} ahora se llama ${name}`;
    },
    // Quitar todos los motes de sus Pokémon (si alguno es ofensivo): vuelven al nombre de la especie
    nicks(c, msg, p) {
      const list = (p.mons || []).filter(m => m.nick);
      for (const m of list) delete m.nick;
      store.persist(p);
      for (const x of conns(p.id)) sendProfile(x);
      audit.log('admin.motes', { actor: c.admin.id, target: p.id, ip: c.ip, motes: list.length });
      return list.length ? `${list.length} mote${list.length > 1 ? 's' : ''} quitado${list.length > 1 ? 's' : ''}` : 'No tenía motes';
    },
    // Derecho de supresión: perfil, partida, cuenta y su registro de seguridad. Hay que escribir su
    // nombre para confirmar; queda constancia (solo el id) de que se borró y quién lo hizo.
    remove(c, msg, p) {
      if (adminRow(p.id)) return 'No se puede borrar a un admin (dale antes de baja)';
      if (sanitize(msg.confirm, 16) !== p.name) return 'Para borrar, escribe exactamente su nombre de entrenador';
      kick(p.id, { t: 'error', msg: 'Tu cuenta se ha borrado' });
      for (const x of conns(p.id)) x.profile = null;
      const events = audit.forget(p.id);
      store.remove(p);
      audit.log('admin.borrar', { actor: c.admin.id, target: p.id, ip: c.ip, events });
      return `Perfil borrado (y ${events} eventos de su registro)`;
    },
    // Solo con la cuenta propia: desde el panel no se editan partidas de otros jugadores
    unlockall(c, msg, p) {
      if (p.id !== c.admin.id) return 'Solo se puede desbloquear tu propia cuenta';
      const added = unlockAll(p);
      store.persist(p);
      for (const x of conns(p.id)) sendProfile(x);
      audit.log('admin.desbloquear', { actor: c.admin.id, target: p.id, ip: c.ip, mons: added });
      return `Todo desbloqueado${added ? ` (${added} legendarios nuevos)` : ' (dinero y objetos rellenados)'}`;
    },
    async resetpass(c, msg, p) {
      if (!p.account) return 'Es un invitado: no tiene contraseña';
      if (!p.account.user) return 'Entra con Google o con su correo: no tiene contraseña';
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
      case 'admin.metrics': return reply({ ...metrics.compute([...store.all()].filter(p => !p.npc), Date.now(), Math.max(7, Math.min(35, msg.days | 0 || 14))), usage: usage.summary(Math.max(7, Math.min(35, msg.days | 0 || 14))) });
      // Para mejorar el juego: hasta dónde llega la gente, qué Pokémon tiene y usa, y cómo va la economía
      case 'admin.progress': return reply(insights.progress(store.all(), String(msg.who || '')));
      case 'admin.collection': return reply(insights.collection(store.all(), String(msg.who || '')));
      case 'admin.economy': return reply(insights.economy(store.all(), String(msg.who || '')));
      case 'admin.balance': return reply(balance.summary(msg.days, String(msg.mode || '')));
      // Jugadores: con texto busca; sin texto, la lista entera (cuentas primero, por última conexión)
      case 'admin.search': {
        const rows = store.search(msg.q, msg.q ? 50 : 5000, String(msg.kind || ''));
        return reply({ total: store.stats(), rows: rows.map(p => ({ id: p.id, name: p.name, user: p.account ? userOf(p.account) : null,
          created: p.created, seen: p.seen || null, elo: p.elo, ranked: p.ranked, banned: store.banned(p), online: conns(p.id).length > 0 })) });
      }
      case 'admin.player': return reply({ player: player(String(msg.id)) });
      // Bugs que reportan los jugadores: la lista y marcarlos como vistos o resueltos
      case 'admin.bugs': return reply({ rows: bugs.list(String(msg.status || '')) });
      case 'admin.bugstatus': {
        if (!bugs.setStatus(msg.id, String(msg.status))) return reply({ err: 'Bug o estado desconocidos' });
        audit.log('admin.bug', { actor: c.admin.id, ip: c.ip, bug: msg.id | 0, status: String(msg.status) });
        return reply({ ok: 'Hecho' });
      }
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
      // Interruptores: partes del juego que se cierran sin sacar versión (server/flags.js)
      case 'admin.flags': return reply({ rows: flags.list() });
      case 'admin.flag': {
        const id = String(msg.id || ''), on = !!msg.on;
        if (!flags.set(id, on, c.admin.id)) return reply({ err: 'No existe ese interruptor' });
        ctx.flagsChanged();
        audit.log('admin.interruptor', { actor: c.admin.id, ip: c.ip, id, on });
        return reply({ ok: `${flags.FLAGS[id].label}: ${on ? 'abierto' : 'cerrado para los jugadores'}`, rows: flags.list() });
      }
      case 'admin.logout':
        audit.log('admin.logout', { actor: c.admin.id, ip: c.ip });
        c.admin = null;
        return send(c, { t: 'admin.out', msg: 'Sesión cerrada' });
    }
  }

  return { handle, kick };
}

// ---------- Cuenta con todo desbloqueado ----------
// Pokédex completa (normal y shiny); cada legendario, shiny, en cada región (los Pokémon no viajan
// entre regiones) a nivel 100 con IV perfectos, los 510 EV del tope (252 en su ataque, 252 en
// velocidad y 6 en PS) y la naturaleza que sube su ataque; todas las medallas, Alto Mando y Campeón;
// dinero y objetos de sobra; todos los títulos, marcos, símbolos y logros. No toca lo que se gana compitiendo
// (ELO, rachas), y la cuenta deja de salir en los rankings (staff). Repetirlo rellena dinero y objetos
// sin duplicar Pokémon. Devuelve cuántos Pokémon ha añadido.
const UNLOCK_COINS = 999999999, UNLOCK_ITEMS = 999;
function unlockAll(p) {
  story.migrate(p);
  rewards.migrate(p);
  tower.state(p);
  const all = Object.keys(D.SPECIES).map(Number).filter(D.inDex).sort((a, b) => a - b);
  p.caught = [...new Set([...p.caught, ...all])];
  p.shinies = [...new Set([...(p.shinies || []), ...all])];
  let added = 0;
  for (const r of D.REGION_IDS) {
    p.prog[r] = D.leadersOf(r).length;
    if (!p.starters[r] && D.REGION_STARTERS[r]) p.starters[r] = D.REGION_STARTERS[r][0];
    // Uno de cada especie de la generación de esta región (Kanto la 1, Johto la 2…), legendarios incluidos
    const gen = D.REGION_IDS.indexOf(r) + 1;
    for (const dex of all.filter(d => D.SPECIES[d].gen === gen)) {
      if (p.mons.some(m => m.region === r && m.dex === dex && m.met === 'admin')) continue;
      const sp = D.SPECIES[dex], physical = !sp.base || sp.base[1] >= sp.base[3];
      const mon = story.devAddMon(p, dex, 100, true, r);
      Object.assign(mon, { met: 'admin', nat: physical ? 'firme' : 'modesta',
        iv: Object.fromEntries(D.STAT_KEYS.map(k => [k, D.IV_MAX])), ev: { hp: 6, atk: 252, def: 0, spe: 252 } });
      added++;
    }
  }
  p.coins = UNLOCK_COINS;
  for (const it of D.SHOP) p.items[it.id] = UNLOCK_ITEMS;
  const leagues = Object.keys(D.RANKED_REWARDS);
  p.cosmetics.titles = [...new Set([...p.cosmetics.titles, ...leagues.map(l => D.RANKED_REWARDS[l].title), ...leagues.map(l => D.seasonTitle(l, D.SEASON.id))])];
  p.cosmetics.frames = [...new Set([...p.cosmetics.frames, ...leagues.map(l => D.RANKED_REWARDS[l].frame)])];
  p.tower.symbols = [...new Set([...p.tower.symbols, ...Object.values(tower.BRAINS).map(b => b.symbol)])];
  // Todos los logros con sus títulos y marcos, también los de Torre y clasificatoria (sin tocar rachas ni victorias)
  for (const a of D.ACHIEVEMENTS) {
    if (!p.achievements[a.id]) p.achievements[a.id] = Date.now();
    const rw = a.reward || {};
    if (rw.title && !p.cosmetics.titles.includes(rw.title)) p.cosmetics.titles.push(rw.title);
    if (rw.frame && !p.cosmetics.frames.includes(rw.frame)) p.cosmetics.frames.push(rw.frame);
  }
  p.achClaim = [];
  // Todos los avatares de colección: iconos de logros y medallas
  p.cosmetics.avatars = [...new Set([...(p.cosmetics.avatars || []), ...D.avatarIds(),
    ...D.REGION_IDS.flatMap(r => Array.from({ length: 8 }, (_, i) => D.badgeAvatar(r, i)))])];
  // Todo lo cosmético: glows, efectos, marcos de tipo, y en cada línea evolutiva sus retos (con las skins de
  // maestría), la Elemental, sus partículas y su retrato
  const lines = [...new Set(all.filter(d => D.inDex(d)).map(D.lineOf))];
  for (const g of D.AURAS) rewards.unlock(p, 'auras', g);
  for (const fx of D.EFFECTS) rewards.unlock(p, 'effects', fx);
  for (const ty of D.TYPE_NAMES) rewards.unlock(p, 'frames', 'tipo-' + ty);
  p.lineStats = p.lineStats || {};
  for (const stat of ['pvp', 'tower', 'catch']) p.lineStats[stat] = p.lineStats[stat] || {};
  for (const root of lines) {
    p.mastery[root] = Math.max(p.mastery[root] || 0, 500);
    p.lineStats.pvp[root] = Math.max(p.lineStats.pvp[root] || 0, 25);
    p.lineStats.tower[root] = Math.max(p.lineStats.tower[root] || 0, 50);
    p.lineStats.catch[root] = Math.max(p.lineStats.catch[root] || 0, 25);
    p.masteryClaimed[root] = D.MASTERY_TIERS.map((_, i) => i);
    rewards.unlock(p, 'skins', 'elemental:' + root);
    rewards.unlock(p, 'particles', root);
    rewards.unlock(p, 'avatars', 'pt:' + root);
    rewards.unlock(p, 'titles', D.masteryTitle(root));
  }
  rewards.unlock(p, 'auras', 'prisma');
  p.gems = Math.max(p.gems || 0, 99999);
  if (!D.pvpTeam(p.pvpTeam)) p.pvpTeam = D.pvpTeam(D.RANKED_POOL.slice(0, 3).map(dex => ({ dex })));
  p.staff = true;
  story.migrate(p);   // medallas a partir del progreso
  return added;
}

// ---------- Consola (tools/admin.js) ----------
function grant(user, note = '') {
  const p = store.byUser(user);
  if (!p) throw new Error(`No hay ninguna cuenta registrada con el usuario «${user}»`);
  // El panel pide usuario, contraseña y código: una cuenta que entra con Google o con el correo no puede
  if (!p.account.user) throw new Error(`«${user}» entra con Google o con su correo: para ser admin necesita usuario y contraseña`);
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
  .map(r => { const p = store.byId(r.id); return { ...r, name: p ? p.name : '?', user: p && p.account ? userOf(p.account) : '?' }; });

module.exports = { createAdmin, grant, revoke, list, adminRow, unlockAll, BAN_HOURS };
