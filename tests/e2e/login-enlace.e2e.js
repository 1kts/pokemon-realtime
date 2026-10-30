// Entrar con el enlace del correo: abre «Entrar con email» con el correo y el código ya escritos y entra con un toque
// (no entra solo: que un antivirus del correo no gaste el código ni nadie meta a otro en su cuenta con un enlace suyo).
// Un enlace que no se pidió desde este navegador avisa, y si aquí hay una partida guardada no deja entrar (se perdería).
// (en las pruebas los correos se quedan en el servidor y se leen con 'devmail')
module.exports = async ({ page, client, player, ok }) => {
  const api = await client();
  const title = async () => {
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
    await page.reload();
    await page.waitFor(`document.querySelector('.title-panel .alt-btn.mail')`);
  };
  await page.goto('/');
  // ---------- El enlace del correo: abre «Entrar con email» con todo escrito y entra con un toque ----------
  // (no entra solo: un antivirus del correo que abra el enlace no gasta el código, y nadie mete a otro en su cuenta)
  await title();
  await page.click('.title-panel .alt-btn.mail');
  await page.waitFor(`document.querySelector('.login-modal input[type=email]')`);
  await page.type('.login-modal input[type=email]', 'ash@example.com');
  await page.click('Mandarme un código');
  await page.waitFor(`document.querySelector('.login-modal .code-input')`);
  const mailText = async to => {
    for (let i = 0; i < 50; i++) { const r = await api.ask('devmail', { to }); if (r.mail) return r.mail.text; await new Promise(x => setTimeout(x, 100)); }
    throw new Error('no llega el correo a ' + to);
  };
  let text = await mailText('ash@example.com');
  ok(/Toca este enlace/.test(text) && /\d{6}/.test(text), 'el correo trae un enlace para entrar y, debajo, el código');
  const link = /\/(#entrar=\S+)/.exec(text)[1];
  await page.goto('/?correo=1' + link);   // (como al tocarlo en el correo: una página nueva, en el navegador que lo pidió)
  await page.waitFor(`document.querySelector('.login-modal .code-input') && document.querySelector('.login-modal .code-input').value.length === 6`);
  ok(await page.eval(`!location.hash && !!document.querySelector('.title-panel') && !document.querySelector('.login-modal .warn')`) && await page.see('Vas a entrar como', { in: '.login-modal' }),
    'abrir el enlace no entra solo: enseña con qué correo vas a entrar, con el código ya escrito, y lo quita de la dirección');
  await page.click('.login-modal button.primary');
  await page.waitFor(`document.querySelector('.login-modal input[autocomplete=nickname]')`);   // (cuenta nueva: su nombre)
  await page.type('.login-modal input[autocomplete=nickname]', 'Ash');
  await page.click('Crear cuenta y jugar');
  await page.waitSee('Aventura');
  ok(await page.see('Ash', { in: '.hub-me' }), 'un toque en «Entrar» y dentro, con su nombre');
  await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.goto('/?otra=1' + link);
  await page.waitFor(`document.querySelector('.login-modal .code-input')`);
  await page.click('.login-modal button.primary');
  await page.waitFor(`document.querySelector('.login-modal .auth-msg.bad') && /Código incorrecto o caducado/.test(document.querySelector('.login-modal .auth-msg').textContent)`);
  ok(!(await page.see('Aventura', { ms: 0 })) && await page.eval(`!!document.querySelector('.title-panel')`), 'el mismo enlace ya no sirve una segunda vez, y lo dice en la ventana');

  // Un enlace que este navegador no pidió (el de otro, para meterte en su cuenta, o el tuyo abierto en otro sitio)
  const askFor = async email => {
    const c = await client();
    c.send({ t: 'mailcode', email, lang: 'es' }); await c.wait(m => m.t === 'mailsent'); c.close();
    return /\/(#entrar=\S+)/.exec(await mailText(email))[1];
  };
  // … con una partida guardada aquí: no deja entrar (la perdería), sino pedir aquí otro código
  const inv = await player({ user: 'Invitada' });
  await page.loginAs(inv.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  let trap = await askFor('okupa@example.com');
  await page.goto('/?trampa=1' + trap);
  await page.waitFor(`document.querySelector('.login-modal .warn')`);
  ok(await page.eval(`/se pidió desde otro sitio/.test(document.querySelector('.login-modal .warn').textContent) && !document.querySelector('.login-modal .code-input')
    && /Mandarme un código aquí/.test(document.querySelector('.login-modal button.primary').textContent) && localStorage.getItem('arena.token') === ${JSON.stringify(inv.token)}`),
    'un enlace que no se pidió aquí, con una partida guardada en este navegador: avisa y solo deja pedir aquí otro código (la partida sigue guardada)');
  // … sin partida guardada: se puede entrar, y la cuenta se crea sin partida de nadie
  await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  trap = await askFor('misty2@example.com');
  await page.goto('/?otro=1' + trap);
  await page.waitFor(`document.querySelector('.login-modal .warn') && document.querySelector('.login-modal .code-input')`);
  await page.click('.login-modal button.primary');
  await page.waitFor(`document.querySelector('.login-modal input[autocomplete=nickname]')`);
  await page.type('.login-modal input[autocomplete=nickname]', 'Misty2');
  await page.click('Crear cuenta y jugar');
  await page.waitSee('Aventura');
  ok(await page.see('Misty2', { in: '.hub-me' }) && await page.eval(`localStorage.getItem('arena.token') !== ${JSON.stringify(inv.token)}`),
    'sin partida guardada se puede entrar: cuenta nueva (Misty2), sin la partida de otro');
  // Con el juego ya abierto en la pestaña, el enlace (solo cambia el #) también abre la ventana
  await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.goto('/');
  await page.waitFor(`document.querySelector('.title-panel')`);
  const again = await askFor('misty2@example.com');
  await page.eval(`location.hash = ${JSON.stringify(again)}; true`);
  ok(await page.waitFor(`document.querySelector('.login-modal .code-input') && !location.hash`).then(() => true, () => false),
    'con el juego ya abierto, el enlace abre la ventana de entrar y se quita de la dirección');
  api.close();
};

module.exports.env = { MAIL_GAP_MS: '0' };   // (aquí se piden códigos seguidos al mismo correo)
