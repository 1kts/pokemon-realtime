// Entrar con el correo, sin contraseña: se manda un código de 6 cifras que caduca a los 10 minutos,
// sirve una sola vez y aguanta 5 intentos. Se guarda solo su huella (sha256 con sal) en la tabla
// mail_codes, junto al correo, y la fila se borra al usarlo, al fallar 5 veces o al caducar.
// El envío va por SMTP con un cliente mínimo (sin dependencias: net y tls de Node), configurado con
// SMTP_HOST, SMTP_PORT (587 con STARTTLS, por defecto, o 465 con TLS directo), SMTP_USER, SMTP_PASS y
// MAIL_FROM. Sin SMTP_HOST ni MAIL_FROM no hay botón de correo. Con MAIL_TEST=1 (o ARENA_DEV sin SMTP)
// los correos no salen: se guardan en memoria para las pruebas (outbox, y 'devmail' por WebSocket).
const net = require('net');
const tls = require('tls');
const os = require('os');
const crypto = require('crypto');
const { db } = require('./store.js');

const CODE_MS = 10 * 60e3, MAX_TRIES = 5;
db.exec(`CREATE TABLE IF NOT EXISTS mail_codes (email TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL,
  expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0)`);

// (nunca en producción: con 'devmail' cualquiera leería los códigos)
const testMode = () => process.env.NODE_ENV !== 'production' && (process.env.MAIL_TEST === '1' || (!!process.env.ARENA_DEV && !process.env.SMTP_HOST));
const config = () => ({ host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.MAIL_FROM });
const enabled = () => testMode() || !!(config().host && config().from);

// Correo válido para mandarle algo: sin espacios, comillas ni nada que pueda colarse en las cabeceras
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const cleanEmail = e => (typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null);

// ---------- Códigos ----------
const digest = (salt, code) => crypto.createHash('sha256').update(salt + ':' + code).digest('hex');
const purge = () => db.prepare('DELETE FROM mail_codes WHERE expires < ?').run(Date.now());

// Código nuevo para ese correo (el anterior deja de valer)
function newCode(email) {
  purge();
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'), salt = crypto.randomBytes(8).toString('hex');
  db.prepare(`INSERT INTO mail_codes (email, salt, hash, expires, tries) VALUES (?, ?, ?, ?, 0)
    ON CONFLICT (email) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, expires = excluded.expires, tries = 0`)
    .run(email, salt, digest(salt, code), Date.now() + CODE_MS);
  return code;
}

// ¿Es bueno? Si lo es, se gasta; si no, cuenta un intento (y al quinto, se borra)
function useCode(email, code) {
  purge();
  const row = db.prepare('SELECT * FROM mail_codes WHERE email = ?').get(email);
  if (!row || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) { if (row) fail(row); return false; }
  const a = Buffer.from(digest(row.salt, code.trim()), 'hex'), b = Buffer.from(row.hash, 'hex');
  if (!crypto.timingSafeEqual(a, b)) { fail(row); return false; }
  db.prepare('DELETE FROM mail_codes WHERE email = ?').run(email);
  return true;
}
function fail(row) {
  if (row.tries + 1 >= MAX_TRIES) db.prepare('DELETE FROM mail_codes WHERE email = ?').run(row.email);
  else db.prepare('UPDATE mail_codes SET tries = tries + 1 WHERE email = ?').run(row.email);
}

// ---------- Textos del correo ----------
// En el idioma del jugador. El mismo correo para todos, tenga cuenta o no (no se puede averiguar quién juega).
// Lleva un enlace para entrar con un toque ({link}: el juego con el correo y el código detrás de #, que no llega al
// servidor ni a sus registros) y el código, por si se abre en otro dispositivo o en la app instalada del iPhone
// (el enlace abre Safari, no la app)
const TEXTS = {
  es: ['Entra en PokéArenas · código {code}', 'Toca este enlace para entrar en PokéArenas:\n\n    {link}\n\nO escribe este código en el juego:\n\n    {code}\n\nCaducan en 10 minutos y solo sirven una vez.\nSi no lo has pedido tú, ignora este correo: nadie puede entrar sin él.'],
  en: ['Sign in to PokéArenas · code {code}', 'Tap this link to sign in to PokéArenas:\n\n    {link}\n\nOr type this code in the game:\n\n    {code}\n\nThey expire in 10 minutes and work only once.\nIf you didn\'t ask for it, ignore this email: nobody can sign in without it.'],
  de: ['Bei PokéArenas anmelden · Code {code}', 'Tippe auf diesen Link, um dich bei PokéArenas anzumelden:\n\n    {link}\n\nOder gib diesen Code im Spiel ein:\n\n    {code}\n\nSie laufen in 10 Minuten ab und gelten nur einmal.\nWenn du das nicht angefordert hast, ignoriere diese E-Mail: Ohne sie kann sich niemand anmelden.'],
  it: ['Accedi a PokéArenas · codice {code}', 'Tocca questo link per accedere a PokéArenas:\n\n    {link}\n\nOppure scrivi questo codice nel gioco:\n\n    {code}\n\nScadono tra 10 minuti e valgono una sola volta.\nSe non l\'hai richiesto tu, ignora questa email: nessuno può accedere senza.'],
  fr: ['Connexion à PokéArenas · code {code}', 'Touche ce lien pour te connecter à PokéArenas :\n\n    {link}\n\nOu tape ce code dans le jeu :\n\n    {code}\n\nIls expirent dans 10 minutes et ne servent qu\'une fois.\nSi tu ne l\'as pas demandé, ignore cet e-mail : personne ne peut se connecter sans lui.'],
  ja: ['PokéArenas にログイン · コード {code}', 'このリンクをタップすると PokéArenas にログインできます:\n\n    {link}\n\nまたはゲームでこのコードを入力してください:\n\n    {code}\n\n有効期限は10分で、1回だけ使えます。\n心当たりがない場合はこのメールを無視してください。これがなければ誰もログインできません。'],
  ko: ['PokéArenas 로그인 · 코드 {code}', '이 링크를 누르면 PokéArenas에 로그인합니다:\n\n    {link}\n\n또는 게임에서 이 코드를 입력하세요:\n\n    {code}\n\n10분 후에 만료되며 한 번만 사용할 수 있습니다.\n요청하지 않았다면 이 메일을 무시하세요. 이것 없이는 아무도 로그인할 수 없습니다.'],
  zh: ['登录 PokéArenas · 验证码 {code}', '点此链接登录 PokéArenas：\n\n    {link}\n\n或在游戏中输入这个验证码：\n\n    {code}\n\n10 分钟后失效，只能使用一次。\n如果不是你本人申请的，请忽略这封邮件：没有它谁也无法登录。'],
};
// Dirección del juego para el enlace (PUBLIC_URL; si no, la de producción)
const site = () => (process.env.PUBLIC_URL || 'https://pokearenas.com').replace(/\/+$/, '');
function codeMail(lang, code, email) {
  const link = `${site()}/#entrar=${encodeURIComponent(email)}~${code}`;
  const [subject, text] = (Object.hasOwn(TEXTS, lang) ? TEXTS[lang] : TEXTS.en).map(s => s.replace('{code}', code).replace('{link}', link));
  return { subject, text: text + `\n\n— PokéArenas · ${site()}\n` };
}

// ---------- Envío ----------
const outbox = [];   // modo de prueba: los últimos correos
async function send(to, { subject, text }) {
  if (testMode()) {
    outbox.push({ to, subject, text, at: Date.now() });
    if (outbox.length > 50) outbox.shift();
    // (en tu PC, con ARENA_DEV, el código sale en la consola para poder probarlo; el correo no)
    if (process.env.ARENA_DEV) console.log('[correo de prueba]', subject.replace(/^.*?(\d{6})$/, 'código $1'));
    return;
  }
  return smtpSend(config(), to, subject, text);
}
const lastTo = to => [...outbox].reverse().find(m => m.to === to) || null;

// Cabecera con caracteres no ASCII (RFC 2047)
const word = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);
const addrOf = from => (/<([^>]+)>/.exec(from) || [, from])[1].trim();
function message(from, to, subject, text) {
  const name = /^(.*?)\s*</.exec(from);
  const domain = addrOf(from).split('@')[1] || 'localhost';
  const body = Buffer.from(text.replace(/\r?\n/g, '\r\n')).toString('base64').replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${name && name[1] ? `${word(name[1].replace(/"/g, ''))} <${addrOf(from)}>` : addrOf(from)}`, `To: <${to}>`, `Subject: ${word(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`, `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', 'Auto-Submitted: auto-generated',
    '', body,
  ].join('\r\n');
}

// Cliente SMTP mínimo: saludo, EHLO, STARTTLS (obligatorio salvo con un servidor en la propia máquina, como
// el de las pruebas), AUTH PLAIN si hay usuario, MAIL FROM, RCPT TO, DATA y QUIT. Cada respuesta puede
// ocupar varias líneas («250-…» hasta la que lleva espacio tras el código).
function smtpSend(cfg, to, subject, text) {
  const local = ['127.0.0.1', 'localhost', '::1'].includes(cfg.host);
  return new Promise((resolve, reject) => {
    let sock, buf = '', waiting = null, done = false;
    const finish = err => { if (done) return; done = true; clearTimeout(timer); try { sock.destroy(); } catch {} err ? reject(err) : resolve(); };
    const timer = setTimeout(() => finish(new Error('SMTP: tiempo agotado')), 20000);
    const onData = d => {
      buf += d.toString('utf8');
      const m = /(?:^|\r\n)(\d{3})(?: [^\r\n]*)?\r\n$/.exec(buf);
      if (m && waiting) { const w = waiting, text = buf; waiting = null; buf = ''; w({ code: +m[1], text }); }
    };
    const attach = s => { sock = s; s.on('data', onData); s.on('error', finish); };
    const read = () => new Promise(r => { waiting = r; });
    const cmd = async (line, ok) => {
      if (line !== null) sock.write(line + '\r\n');
      const r = await read();
      if (!ok.includes(r.code)) throw new Error(`SMTP: ${line ? line.split(' ')[0] : 'saludo'} → ${r.text.trim().slice(0, 120)}`);
      return r;
    };
    const ehlo = () => cmd('EHLO ' + (os.hostname() || 'localhost'), [250]);
    const run = async () => {
      await cmd(null, [220]);
      let caps = await ehlo();
      if (cfg.port !== 465) {
        if (/STARTTLS/i.test(caps.text)) {
          await cmd('STARTTLS', [220]);
          sock.removeListener('data', onData);
          await new Promise((r, j) => { const s = tls.connect({ socket: sock, servername: cfg.host }, r); s.once('error', j); attach(s); });
          caps = await ehlo();
        } else if (!local) throw new Error('SMTP: el servidor no ofrece STARTTLS (no se manda la contraseña sin cifrar)');
      }
      if (cfg.user) await cmd('AUTH PLAIN ' + Buffer.from(`\0${cfg.user}\0${cfg.pass || ''}`).toString('base64'), [235]);
      await cmd(`MAIL FROM:<${addrOf(cfg.from)}>`, [250]);
      await cmd(`RCPT TO:<${to}>`, [250, 251]);
      await cmd('DATA', [354]);
      // (las líneas que empiezan por punto se doblan; en base64 no las hay, pero por si acaso)
      await cmd(message(cfg.from, to, subject, text).replace(/\r\n\./g, '\r\n..') + '\r\n.', [250]);
      sock.write('QUIT\r\n');
      finish();
    };
    const s = cfg.port === 465 ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }) : net.connect({ host: cfg.host, port: cfg.port });
    attach(s);
    run().catch(finish);
  });
}

module.exports = { enabled, testMode, cleanEmail, newCode, useCode, codeMail, send, smtpSend, outbox, lastTo, CODE_MS, MAX_TRIES };
