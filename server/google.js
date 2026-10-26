// Inicio de sesión con Google (Google Identity Services). El navegador consigue un ID token (un JWT
// firmado por Google) y aquí se comprueba sin dependencias: la firma RS256 con las claves públicas de
// Google (que se descargan y se guardan el tiempo que dice su Cache-Control), que el token es para
// nuestro GOOGLE_CLIENT_ID (aud), que lo emite Google (iss), que no ha caducado (exp) y que el correo
// está verificado. Sin GOOGLE_CLIENT_ID no hay botón de Google y todo sigue como antes.
// En las pruebas, GOOGLE_TEST_JWKS (un JWKS en JSON) sustituye a las claves de Google y el navegador
// no carga nada de Google; en producción (NODE_ENV=production) se ignora.
const crypto = require('crypto');

const CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const SKEW = 60;   // segundos de margen entre relojes

const clientId = () => process.env.GOOGLE_CLIENT_ID || null;
function testKeys() {
  if (!process.env.GOOGLE_TEST_JWKS || process.env.NODE_ENV === 'production') return null;
  try { return JSON.parse(process.env.GOOGLE_TEST_JWKS).keys || null; } catch { return null; }
}
const testMode = () => !!(clientId() && testKeys());

// Claves de Google: kid -> clave pública, hasta que caduquen. Si llega un kid desconocido (Google las
// rota) se vuelven a pedir, como mucho una vez por minuto.
let keys = new Map(), keysUntil = 0, lastFetch = 0;
async function keyFor(kid) {
  const test = testKeys();
  if (test) { const k = test.find(x => x.kid === kid); return k ? crypto.createPublicKey({ key: k, format: 'jwk' }) : null; }
  const now = Date.now();
  if ((now > keysUntil || !keys.has(kid)) && now - lastFetch > 60e3) {
    lastFetch = now;
    const res = await fetch(CERTS, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('claves de Google: HTTP ' + res.status);
    const age = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
    keys = new Map((await res.json()).keys.filter(k => k.kty === 'RSA').map(k => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })]));
    keysUntil = now + (age ? +age[1] : 3600) * 1000;
  }
  return keys.get(kid) || null;
}

const part = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// Devuelve { sub, email } si el token es bueno, o null
async function verify(token) {
  const aud = clientId();
  if (!aud || typeof token !== 'string' || token.length > 4096) return null;
  const bits = token.split('.');
  if (bits.length !== 3) return null;
  let head, body;
  try { head = part(bits[0]); body = part(bits[1]); } catch { return null; }
  if (head.alg !== 'RS256' || typeof head.kid !== 'string') return null;
  let key;
  try { key = await keyFor(head.kid); } catch (e) { console.error('Google:', e.message); return null; }
  if (!key) return null;
  const good = crypto.verify('RSA-SHA256', Buffer.from(bits[0] + '.' + bits[1]), key, Buffer.from(bits[2], 'base64url'));
  if (!good) return null;
  const now = Date.now() / 1000;
  if (body.aud !== aud || !ISSUERS.includes(body.iss)) return null;
  if (!(body.exp > now - SKEW) || (body.iat && body.iat > now + SKEW)) return null;
  if (body.email_verified !== true && body.email_verified !== 'true') return null;
  if (typeof body.sub !== 'string' || !body.sub || typeof body.email !== 'string') return null;
  return { sub: body.sub, email: body.email.toLowerCase() };
}

module.exports = { clientId, testMode, verify };
