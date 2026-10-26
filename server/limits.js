// Límites contra abusos (scripts que inundan de mensajes, fuerza bruta de contraseñas, perfiles
// falsos). Todo en memoria, porque hay un solo servidor, y se limpia solo.
//   - Mensajes por conexión: entradas de combate (30/s normales) y el resto aparte; las consultas
//     caras (ladder, fichas) tienen además un tope por IP. Quien insiste se queda sin conexión.
//   - Conexiones a la vez y conexiones nuevas por minuto, por IP.
//   - Intentos de contraseña por IP y fallos por cuenta (la cuenta se bloquea un rato).
//   - Perfiles nuevos (invitados o registros desde la portada) por IP y hora.
//   - Entrar con el correo: códigos enviados por IP y por correo (y 30 s entre dos al mismo correo) y
//     códigos probados por IP; entrar con Google, intentos por IP.
// Los topes dejan de sobra a varias personas detrás de la misma IP (casa, móvil con CGNAT).

const LIMITS = {
  conns: 20, connsPerMin: 60,
  newProfiles: 30, newProfilesMs: 3600e3,
  authPerIp: 30, authPerIpMs: 600e3,
  failsPerUser: 10, failsPerUserMs: 900e3,
  mailsPerIp: 10, mailsPerEmail: 5, mailsMs: 3600e3, mailTriesPerIp: 30, googlePerIp: 30,
  // (los e2e piden varios códigos seguidos al mismo correo: fuera de producción MAIL_GAP_MS lo acorta)
  mailGapMs: process.env.NODE_ENV !== 'production' && process.env.MAIL_GAP_MS ? +process.env.MAIL_GAP_MS : 30e3,
  dropsToKick: 300,
};

// IP real del cliente. Detrás de Caddy la conexión llega desde 127.0.0.1 y la IP va en
// X-Forwarded-For (la pone Caddy y sustituye la que mande el cliente), así que esa cabecera solo
// se cree si la conexión viene de la propia máquina.
function clientIp(req) {
  const direct = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (direct !== '127.0.0.1' && direct !== '::1') return direct;
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();
  return fwd || direct;
}

// ---------- Ventanas de tiempo ----------
const windows = new Map();   // clave -> instantes de cada intento
const recent = (key, ms, now) => (windows.get(key) || []).filter(t => now - t < ms);
// Cuenta un intento más; true si con él se pasa del tope
function hit(key, max, ms) {
  const now = Date.now(), list = recent(key, ms, now);
  list.push(now);
  windows.set(key, list);
  return list.length > max;
}
// ¿Ya está en el tope? (sin contar uno más)
const full = (key, max, ms) => recent(key, ms, Date.now()).length >= max;
setInterval(() => {
  const now = Date.now();
  for (const [k, list] of windows) {
    const keep = list.filter(t => now - t < 3600e3);
    if (keep.length) windows.set(k, keep); else windows.delete(k);
  }
}, 60e3).unref();

// ---------- Cubos de mensajes ----------
// rate por segundo, burst de golpe. take() gasta uno si queda.
class Bucket {
  constructor(rate, burst) { this.rate = rate; this.burst = burst; this.tokens = burst; this.t = Date.now(); }
  take() {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + (now - this.t) / 1000 * this.rate);
    this.t = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
const EXPENSIVE = new Set(['ladder', 'user', 'friendsearch']);
const ipBuckets = new Map();   // ip -> cubo de consultas caras
setInterval(() => { for (const [ip, b] of ipBuckets) if (b.tokens >= b.burst - 1) ipBuckets.delete(ip); }, 60e3).unref();

// Estado de límites de una conexión nueva
const forConn = ip => ({ ip, inputs: new Bucket(45, 120), other: new Bucket(10, 40), drops: 0 });

// ¿Se atiende este mensaje? Si no, se descarta; tras muchos descartes, kick = true.
function allow(l, type) {
  let ok = type === 'in' ? l.inputs.take() : l.other.take();
  if (ok && EXPENSIVE.has(type)) {
    if (!ipBuckets.has(l.ip)) ipBuckets.set(l.ip, new Bucket(10, 30));
    ok = ipBuckets.get(l.ip).take();
  }
  if (!ok) l.drops++;
  return { ok, kick: l.drops > LIMITS.dropsToKick };
}

// ---------- Conexiones por IP ----------
const open = new Map();   // ip -> conexiones abiertas
function connOpen(ip) {
  if ((open.get(ip) || 0) >= LIMITS.conns || hit('conn:' + ip, LIMITS.connsPerMin, 60e3)) return false;
  open.set(ip, (open.get(ip) || 0) + 1);
  return true;
}
function connClose(ip) {
  const n = (open.get(ip) || 0) - 1;
  if (n > 0) open.set(ip, n); else open.delete(ip);
}

// ---------- Cuentas y perfiles ----------
const newProfile = ip => !hit('new:' + ip, LIMITS.newProfiles, LIMITS.newProfilesMs);
const authAttempt = ip => !hit('auth:' + ip, LIMITS.authPerIp, LIMITS.authPerIpMs);
const userLocked = user => full('fail:' + user.toLowerCase(), LIMITS.failsPerUser, LIMITS.failsPerUserMs);
const userFailed = user => { hit('fail:' + user.toLowerCase(), LIMITS.failsPerUser, LIMITS.failsPerUserMs); };

// Correo: null si se puede mandar otro código, o qué tope se ha pasado ('ip' o 'correo')
function mailSend(ip, email) {
  if (full('mailip:' + ip, LIMITS.mailsPerIp, LIMITS.mailsMs)) return 'ip';
  if (full('mail:' + email, LIMITS.mailsPerEmail, LIMITS.mailsMs) || full('mailgap:' + email, 1, LIMITS.mailGapMs)) return 'correo';
  for (const [k, max, ms] of [['mailip:' + ip, LIMITS.mailsPerIp, LIMITS.mailsMs], ['mail:' + email, LIMITS.mailsPerEmail, LIMITS.mailsMs], ['mailgap:' + email, 1, LIMITS.mailGapMs]]) hit(k, max, ms);
  return null;
}
const mailTry = ip => !hit('mailtry:' + ip, LIMITS.mailTriesPerIp, LIMITS.authPerIpMs);
const googleAttempt = ip => !hit('google:' + ip, LIMITS.googlePerIp, LIMITS.authPerIpMs);

module.exports = { LIMITS, clientIp, forConn, allow, connOpen, connClose, newProfile, authAttempt, userLocked, userFailed, mailSend, mailTry, googleAttempt };
