// Entrar con Google (un token firmado con una clave de prueba que el servidor acepta en lugar de las de Google; en
// las pruebas no se carga nada de Google): desde la portada crea la cuenta pidiendo el nombre de entrenador, y con
// el correo de una cuenta que ya existe entra en ella. Con un código por correo, en login-email.e2e.js
const crypto = require('crypto');

const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLIENT = 'e2e.apps.googleusercontent.com';
module.exports = async ({ page, client, ok }) => {
  const api = await client();
  const codeFor = async to => {
    for (let i = 0; i < 50; i++) {
      const r = await api.ask('devmail', { to });
      if (r.mail) return /(\d{6})/.exec(r.mail.text)[1];
      await new Promise(x => setTimeout(x, 100));
    }
    throw new Error('no llega el correo a ' + to);
  };
  const googleToken = (sub, email) => {
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
    const data = b64({ alg: 'RS256', kid: 'e2e', typ: 'JWT' }) + '.' + b64({ iss: 'https://accounts.google.com', aud: CLIENT, sub, email, email_verified: true, iat: now, exp: now + 600 });
    return data + '.' + crypto.sign('RSA-SHA256', Buffer.from(data), key.privateKey).toString('base64url');
  };
  const title = async () => {
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
    await page.reload();
    await page.waitFor(`document.querySelector('.title-panel .alt-btn.mail')`);
  };

  // (la cuenta de ash@example.com, ya creada con un código por correo: crearla así lo prueba login-email.e2e.js)
  const ash = await client();
  ash.send({ t: 'mailcode', email: 'ash@example.com', lang: 'es' });
  const code = await codeFor('ash@example.com');
  ash.send({ t: 'mailverify', email: 'ash@example.com', code });
  await ash.wait(m => m.t === 'authname');
  ash.send({ t: 'authname', name: 'Ash' });
  await ash.wait(m => m.t === 'profile');
  ash.close();
  await page.goto('/');

  // ---------- Google desde la portada ----------
  await title();
  await page.click('.title-panel .alt-btn.google');
  await page.waitFor(`document.querySelector('.login-modal .gsi-slot')`);
  // atajo: el botón de Google es de Google (en las pruebas no se carga): se le pasa al juego lo que devolvería
  await page.eval(`window.__app.ui.googleCredential(${JSON.stringify(googleToken('g-1', 'misty@example.com'))}); true`);
  await page.waitFor(`document.querySelector('.login-modal input[autocomplete=nickname]')`);
  await page.type('.login-modal input[autocomplete=nickname]', 'Misty');
  await page.click('Crear cuenta y jugar');
  await page.waitSee('Aventura');
  await page.tap('Perfil');
  ok(await page.see('Misty', { in: '.trainer-card' }) && await page.see('misty@example.com', { in: '.trainer-card' }), 'con Google crea la cuenta (Misty, con su correo) y entra');
  // Google con el correo de una cuenta que ya existe: entra en ella (sin pedir nombre)
  await title();
  await page.click('.title-panel .alt-btn.google');
  await page.waitFor(`document.querySelector('.login-modal .gsi-slot')`);
  // atajo: lo que devolvería el botón de Google (ver arriba)
  await page.eval(`window.__app.ui.googleCredential(${JSON.stringify(googleToken('g-2', 'ash@example.com'))}); true`);
  await page.waitSee('Aventura');
  ok(await page.see('Ash', { in: '.hub-me' }), 'con Google y el correo de una cuenta que ya existe, entra en ella (sin pedir nombre)');

  api.close();
};

// Su servidor acepta como «Google» la clave de prueba de arriba
module.exports.env = {
  MAIL_GAP_MS: '0',   // (aquí se piden códigos seguidos al mismo correo)
  GOOGLE_CLIENT_ID: CLIENT,
  GOOGLE_TEST_JWKS: JSON.stringify({ keys: [{ ...key.publicKey.export({ format: 'jwk' }), kid: 'e2e', alg: 'RS256', use: 'sig' }] }),
};
