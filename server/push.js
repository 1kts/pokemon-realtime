// Avisos al móvil o al PC aunque el juego esté cerrado (Web Push, sin librerías): el jugador los activa con «Avísame»
// (o en Ajustes) y el navegador da una suscripción (a dónde mandar y sus claves). El servidor la guarda y manda:
//   - recordatorios automáticos, como mucho uno al día por persona, a la hora a la que suele jugar y nunca de 22 a 9 h
//     (su hora): el premio diario listo (el del día 7, aparte), las ruletas nuevas de los lunes, un legendario en una
//     ruta suya, y si lleva 3 o 7 días sin entrar (luego uno por semana como mucho, y al mes ya ninguno);
//   - los que mande un admin desde el panel (a todos o a los que llevan X días sin entrar).
// Cada tipo se apaga en Ajustes (p.notif). El cifrado es el de la norma (RFC 8291, aes128gcm) y la firma, VAPID
// (RFC 8292). Solo se manda a los servicios de push de los navegadores (nunca a una dirección cualquiera: el
// servidor no hace de proxy). Con PUSH_TEST=1, nada sale: se queda en `sent` (para las pruebas).
const crypto = require('crypto');
const https = require('https');
const D = require('../public/data.js');
const store = require('./store.js');
const TEXTS = require('./push-texts.js');
const daily = require('./daily.js');

const db = store.db;
db.exec(`CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, profile TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0)`);
db.exec(`CREATE INDEX IF NOT EXISTS push_subs_profile ON push_subs (profile)`);
db.exec(`CREATE TABLE IF NOT EXISTS push_keys (id INTEGER PRIMARY KEY CHECK (id = 1), pub TEXT NOT NULL, priv TEXT NOT NULL)`);

const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
const DAY = 864e5, HOUR = 3600e3;
const SUBJECT = process.env.PUSH_SUBJECT || 'mailto:contact@pokearenas.com';
const TYPES = ['daily', 'wheels', 'rare', 'back', 'events'];
const MAX_SUBS = 5;   // aparatos por jugador

// ---------- Claves VAPID del servidor (se crean una vez y se guardan en la base de datos) ----------
function vapidKeys() {
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) return { pub: process.env.VAPID_PUBLIC, priv: process.env.VAPID_PRIVATE };
  let row = db.prepare('SELECT pub, priv FROM push_keys WHERE id = 1').get();
  if (!row) {
    const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
    row = { pub: b64u(ec.getPublicKey()), priv: b64u(ec.getPrivateKey()) };
    db.prepare('INSERT INTO push_keys (id, pub, priv) VALUES (1, ?, ?)').run(row.pub, row.priv);
  }
  return row;
}
const KEYS = vapidKeys();
const publicKey = () => KEYS.pub;
const PRIVATE = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: KEYS.priv,
  x: b64u(unb64u(KEYS.pub).subarray(1, 33)), y: b64u(unb64u(KEYS.pub).subarray(33, 65)) }, format: 'jwk' });

// Firma VAPID: un JWT ES256 para el servicio de push de esa dirección, válido 12 h
function vapidAuth(endpoint) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: PRIVATE, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${KEYS.pub}`;
}

// Cifrado del mensaje para ese navegador (RFC 8291): solo él lo puede leer
function encrypt(payload, p256dh, auth) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
  const as = ec.getPublicKey(), shared = ec.computeSecret(ua);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head.writeUInt8(65, 20);
  return Buffer.concat([head, as, body]);
}

// Solo los servicios de push de los navegadores (Chrome/Edge/Android, Firefox, Safari/iPhone, Windows)
const HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];
function validSub(sub) {
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string' || sub.endpoint.length > 600) return false;
  let u; try { u = new URL(sub.endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || u.port || !HOSTS.some(h => h.test(u.hostname))) return false;
  const k = sub.keys || {};
  return typeof k.p256dh === 'string' && unb64u(k.p256dh).length === 65 && typeof k.auth === 'string' && unb64u(k.auth).length === 16;
}

// ---------- Suscripciones ----------
function subscribe(p, sub, tz) {
  if (!validSub(sub)) return 'Esa suscripción no es válida';
  db.prepare(`INSERT INTO push_subs (endpoint, profile, p256dh, auth, created) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET profile = excluded.profile, p256dh = excluded.p256dh, auth = excluded.auth, created = excluded.created, fails = 0`)
    .run(sub.endpoint, p.id, sub.keys.p256dh, sub.keys.auth, Date.now());
  // (como mucho MAX_SUBS aparatos: se quitan los más antiguos)
  const rows = db.prepare('SELECT endpoint FROM push_subs WHERE profile = ? ORDER BY created DESC').all(p.id);
  for (const r of rows.slice(MAX_SUBS)) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(r.endpoint);
  p.notif = { ...Object.fromEntries(TYPES.map(k => [k, true])), ...(p.notif || {}), on: true };
  if (Number.isFinite(tz)) p.tz = Math.max(-720, Math.min(840, Math.round(tz)));   // (minutos respecto a UTC)
  return null;
}
function unsubscribe(p, endpoint) {
  db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND profile = ?').run(String(endpoint || ''), p.id);
  if (!db.prepare('SELECT 1 FROM push_subs WHERE profile = ?').get(p.id)) p.notif = { ...(p.notif || {}), on: false };
}
function setPrefs(p, prefs) {
  p.notif = p.notif || { on: false };
  for (const k of TYPES) if (typeof (prefs || {})[k] === 'boolean') p.notif[k] = prefs[k];
}
const view = p => ({ on: !!(p.notif && p.notif.on), ...Object.fromEntries(TYPES.map(k => [k, !p.notif || p.notif[k] !== false])) });

// ---------- Envío ----------
const sent = [];   // (con PUSH_TEST: lo que se habría mandado)
function deliver(row, msg) {
  const body = JSON.stringify(msg);
  if (process.env.PUSH_TEST) { sent.push({ profile: row.profile, endpoint: row.endpoint, ...msg }); return Promise.resolve(201); }
  const data = encrypt(body, row.p256dh, row.auth);
  return new Promise(resolve => {
    const req = https.request(row.endpoint, { method: 'POST', timeout: 10e3, headers: {
      'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'Content-Length': data.length,
      TTL: String(msg.ttl || 12 * 3600), Urgency: 'normal', Authorization: vapidAuth(row.endpoint) } }, res => {
      res.resume();
      // Ya no existe (desinstaló, quitó el permiso): fuera. Otros errores: se apuntan y a los 5 seguidos, fuera
      if (res.statusCode === 404 || res.statusCode === 410) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(row.endpoint);
      else if (res.statusCode >= 400) db.prepare('UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?').run(row.endpoint);
      else db.prepare('UPDATE push_subs SET fails = 0 WHERE endpoint = ?').run(row.endpoint);
      resolve(res.statusCode);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => { db.prepare('UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?').run(row.endpoint); resolve(0); });
    req.end(data);
  });
}
// A todos los aparatos de un jugador
function sendTo(p, msg) {
  const rows = db.prepare('SELECT * FROM push_subs WHERE profile = ? AND fails < 5').all(p.id);
  return Promise.all(rows.map(r => deliver(r, msg)));
}
// Muchos a la vez, por tandas de BATCH (cada envío tarda lo que tarda el servicio de push: en fila serían minutos)
const BATCH = 50;
async function inBatches(list, f) {
  for (let i = 0; i < list.length; i += BATCH) await Promise.all(list.slice(i, i + BATCH).map(f));
}

// Texto en su idioma (si no lo hay, en inglés) con sus {datos}
function text(p, key, vars = {}) {
  const lang = TEXTS[p.lang] ? p.lang : 'en';
  const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const tx = TEXTS[lang][key] || TEXTS.en[key];
  return { title: fill(tx[0]), body: fill(tx[1]) };
}
const prizeText = rw => [rw.coins && `${rw.coins.toLocaleString('en')} 🪙`, rw.gems && `${rw.gems} 💎`].filter(Boolean).join(' + ');

// ---------- Qué toca mandar a cada uno ----------
const localHour = (p, now) => new Date(now + (p.tz || 0) * 60e3).getUTCHours();
const localDay = (p, now) => D.dayKey(now + (p.tz || 0) * 60e3);
// La hora a la que suele jugar (la de su última conexión, en su hora), dentro de 9 a 21
const playHour = p => Math.max(9, Math.min(21, Number.isInteger(p.playHour) ? p.playHour : 18));
// Rutas con un legendario ahora mismo (lo mismo para todos: se calcula una vez por tanda de rutas)
const ROUTES = Object.values(D.NODES).filter(n => n.kind === 'route');
let rareCache = { at: -1, list: [] };
function rareRoutes(now) {
  const k = D.rotIndex(now);
  if (rareCache.at !== k) {
    rareCache = { at: k, list: ROUTES.map(route => ({ route, w: D.routeWild(route, now) }))
      .filter(x => x.w.specials.some(s => D.SPECIES[s.dex] && D.SPECIES[s.dex].leg)).map(x => ({ route: x.route, ends: x.w.ends })) };
  }
  return rareCache.list;
}
// La primera de esas que tiene abierta (su región empezada y con las medallas que pide)
const rareNow = (p, now) => rareRoutes(now).find(x => p.starters && p.starters[x.route.region] && (x.route.req || 0) <= D.progOf(p, x.route.region)) || null;
function pick(p, now = Date.now()) {
  const n = p.notif;
  if (!n || !n.on) return null;
  const st = p.notifSt || {};
  const idle = now - (p.seen || p.created || now);
  if (idle > 30 * DAY) return null;                                   // al mes sin entrar, silencio
  const h = localHour(p, now);
  if (h < 9 || h >= 22) return null;                                  // de noche, nada
  if (st.day === localDay(p, now)) return null;                       // ya ha tenido uno hoy
  if (idle > 7 * DAY && now - (st.at || 0) < 7 * DAY) return null;   // sin entrar más de una semana: uno por semana
  if (h < playHour(p)) return null;                                   // a su hora
  // Lleva días sin entrar (una vez cada cosa)
  if (n.back) {
    if (idle >= 7 * DAY && !st.back7) return { key: 'back7', mark: { back7: true }, url: '/' };
    if (idle >= 3 * DAY && idle < 7 * DAY && !st.back3) return { key: 'back3', mark: { back3: true }, url: '/' };
  }
  // Ruletas nuevas (la tanda de esta semana, una vez)
  const period = D.treasurePeriod(now);
  if (n.wheels && st.wheels !== period && now - D.treasureEnds(now) + D.TREASURE_DAYS * DAY < 2 * DAY)
    return { key: 'wheels', mark: { wheels: period }, url: '/?ir=ruletas' };
  // Premio diario sin recoger (el del día 7, con su texto)
  if (n.daily) {
    const d = daily.view(p, now);
    if (d.ready) {
      const rw = D.DAILY_LOGIN[d.day - 1];
      return { key: d.day === D.DAILY_LOGIN.length ? 'day7' : 'daily', vars: { n: d.day, prize: prizeText(rw) }, url: '/?ir=premio' };
    }
  }
  // Un legendario en una de sus rutas (como mucho cada 3 días)
  if (n.rare && now - (st.rare || 0) > 3 * DAY) {
    const r = rareNow(p, now);
    if (r) return { key: 'rare', vars: { h: Math.max(1, Math.round((r.ends - now) / HOUR)) }, mark: { rare: now }, url: `/?ir=ruta&id=${r.route.id}` };
  }
  return null;
}

// Una vuelta: a cada uno con suscripción, lo que le toque
let ticking = false;
async function tick(now = Date.now()) {
  if (ticking) return 0;   // (una vuelta larga no se pisa con la siguiente)
  ticking = true;
  try {
    const ids = db.prepare('SELECT DISTINCT profile FROM push_subs WHERE fails < 5').all().map(r => r.profile);
    const due = [];
    for (const id of ids) {
      const p = store.byId(id);
      const what = p && pick(p, now);
      if (!what) continue;
      p.notifSt = { ...(p.notifSt || {}), ...(what.mark || {}), day: localDay(p, now), at: now };
      store.persist(p);   // (casi siempre está desconectado: se guarda él, no solo los que están en uso)
      due.push([p, what]);
    }
    await inBatches(due, ([p, what]) => sendTo(p, { ...text(p, what.key, what.vars), url: what.url, tag: what.key }));
    return due.length;
  } finally { ticking = false; }
}

// Solo páginas del juego: «/…», nunca «//otra-web» (el navegador lo leería como otra web)
const safePath = url => typeof url === 'string' && /^\/(?!\/)[\w\-/?=&.]*$/.test(url) ? url : '/';

// Del panel de admin: a todos los que tienen avisos (y los de eventos encendidos) o solo a los que llevan `idle` días
// sin entrar. El texto es el mismo para todos (lo escribe el admin)
async function broadcast({ title, body, url, idle }, now = Date.now()) {
  title = String(title || '').trim().slice(0, 60); body = String(body || '').trim().slice(0, 180);
  if (!title || !body) return { error: 'Falta el título o el texto' };
  const safeUrl = safePath(url);
  const ids = db.prepare('SELECT DISTINCT profile FROM push_subs WHERE fails < 5').all().map(r => r.profile);
  const to = ids.map(id => store.byId(id)).filter(p => p && p.notif && p.notif.on && p.notif.events !== false && !(idle && now - (p.seen || p.created || now) < idle * DAY));
  await inBatches(to, p => sendTo(p, { title, body, url: safeUrl, tag: 'event' }));
  return { n: to.length };
}

// La hora a la que juega (para mandar los avisos a esa hora)
function touch(p, now = Date.now()) {
  if (p.notif && p.notif.on) p.playHour = localHour(p, now);
  if (p.notifSt && (p.notifSt.back3 || p.notifSt.back7)) p.notifSt = { ...p.notifSt, back3: false, back7: false };
}
// Perfil borrado (o invitado caducado): fuera sus suscripciones
store.onRemove(p => db.prepare('DELETE FROM push_subs WHERE profile = ?').run(p.id));

if (!process.env.PUSH_TEST) setInterval(() => { tick().catch(e => console.error('Avisos:', e.message)); }, 10 * 60e3).unref();

const count = () => db.prepare('SELECT COUNT(DISTINCT profile) n FROM push_subs WHERE fails < 5').get().n;

module.exports = { safePath, count, publicKey, subscribe, unsubscribe, setPrefs, view, tick, pick, broadcast, touch, encrypt, validSub, vapidAuth, sent, TYPES };
