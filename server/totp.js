// Códigos de un solo uso (TOTP, RFC 6238) como los de Google Authenticator: 6 cifras que cambian
// cada 30 s, calculadas a partir de un secreto que comparten el servidor y la app del móvil.
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  let bits = 0, val = 0;
  const out = [];
  for (const ch of String(s).toUpperCase().replace(/[\s=-]/g, '')) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Secreto TOTP no válido');
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

const STEP = 30000;
const newSecret = () => base32(crypto.randomBytes(20));

function code(secret, counter, key = unbase32(secret)) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

// Si el código vale, devuelve su intervalo (para no aceptarlo dos veces); si no, null. Se acepta
// el intervalo anterior y el siguiente por si el reloj del móvil va un poco desfasado.
function verify(secret, input, now = Date.now()) {
  const digits = String(input || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const given = Buffer.from(digits);
  const c = Math.floor(now / STEP);
  for (const d of [0, -1, 1]) if (crypto.timingSafeEqual(Buffer.from(code(secret, c + d)), given)) return c + d;
  return null;
}

// Para dar de alta la cuenta en la app (o escribir el secreto a mano)
const uri = (secret, label) => `otpauth://totp/${encodeURIComponent(`Arena Pokémon:${label}`)}?secret=${secret}&issuer=${encodeURIComponent('Arena Pokémon')}`;

module.exports = { newSecret, code, verify, uri, base32, STEP };
