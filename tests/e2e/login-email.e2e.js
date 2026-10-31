// Entrar sin contraseña: con un código por correo (en las pruebas los correos se quedan en el servidor y se
// leen con 'devmail') y con Google (un token firmado con una clave de prueba que el servidor acepta en lugar
// de las de Google; en las pruebas no se carga nada de Google). Desde la portada crea la cuenta pidiendo el
// nombre de entrenador; desde el perfil de un invitado, la cuenta se queda con su partida.
const crypto = require('crypto');

const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLIENT = 'e2e.apps.googleusercontent.com';
module.exports = async ({ page, client, player, ok }) => {
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

  // ---------- Portada: correo nuevo → código → nombre de entrenador → menú ----------
  await page.goto('/');
  await title();
  ok(await page.eval(`!!document.querySelector('.title-panel .alt-btn.google') && !!document.querySelector('.title-panel .alt-or')`), 'la portada tiene «Continuar con Google» y «Entrar con email»');
  await page.resize(740, 360);
  ok(await page.eval(`(() => { const b = document.querySelector('.title-panel .alt-btn.google').getBoundingClientRect(); return b.width > 120 && b.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()`),
    'en un móvil en horizontal los botones caben sin desbordar');
  await page.resize();
  await page.click('.title-panel .alt-btn.mail');
  await page.waitFor(`document.querySelector('.login-modal input[type=email]')`);
  await page.type('.login-modal input[type=email]', 'Ash@Example.com');
  await page.click('Mandarme un código');
  await page.waitFor(`document.querySelector('.login-modal .code-input')`);
  ok(await page.eval(`document.querySelector('.login-modal').textContent.includes('Ash@Example.com')`), 'pide el código que ha llegado al correo');
  await page.type('.login-modal .code-input', '000000');
  await page.waitFor(`document.querySelector('.login-modal .auth-msg.bad')`);
  ok(await page.eval(`/incorrecto/.test(document.querySelector('.login-modal .auth-msg').textContent)`), 'un código equivocado se avisa en la ventana');
  await page.type('.login-modal .code-input', await codeFor('ash@example.com'));   // (con la sexta cifra se manda solo)
  await page.waitFor(`document.querySelector('.login-modal input[autocomplete=nickname]')`);
  await page.type('.login-modal input[autocomplete=nickname]', 'Ash');
  await page.click('Crear cuenta y jugar');
  await page.waitSee('Aventura');
  ok(await page.see('Ash', { in: '.hub-me' }) && !(await page.eval(`!!document.querySelector('.login-modal')`)), 'crea la cuenta con el nombre elegido y entra al menú');
  await page.tap('Perfil');
  ok(await page.see('ash@example.com', { in: '.trainer-card' }) && !(await page.see('Cambiar contraseña', { ms: 0 })), 'en el perfil: la cuenta es la de su correo y no hay contraseña que cambiar');

  // ---------- Invitado → perfil → «Entrar con email»: su partida pasa a la cuenta ----------
  const guest = await player({ name: 'Gary' });
  guest.client.send({ t: 'story', a: 'starter', dex: 7 });
  await guest.client.wait(m => m.t === 'profile');
  guest.client.close();
  await page.eval(`localStorage.clear(); true`);
  await page.loginAs(guest.token);
  await page.tap('Perfil');
  await page.tap('Crear cuenta', { in: '.trainer-card' });
  await page.waitFor(`document.querySelector('.account .alt-btn.mail')`);
  await page.click('.account .alt-btn.mail');
  await page.type('.login-modal input[type=email]', 'gary@example.com');
  await page.click('Mandarme un código');
  await page.waitFor(`document.querySelector('.login-modal .code-input')`);
  await page.type('.login-modal .code-input', await codeFor('gary@example.com'));
  await page.waitSee('gary@example.com', { in: '.trainer-card' });
  await page.tap('Volver');
  await page.tap('Mis Pokémon');
  ok(await page.see('Squirtle') && await page.eval(`document.querySelectorAll('.mon-card').length`) === 1, 'el invitado se lleva su partida (y su Squirtle) a la cuenta del correo');

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
