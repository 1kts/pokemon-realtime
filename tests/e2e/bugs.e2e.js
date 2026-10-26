// Reportar un bug: desde la barra de abajo (o Ajustes) se escribe qué ha pasado y se envía con la pantalla, la
// versión y el navegador; al admin le sale en la pestaña Bugs del panel (y por Telegram, si hay bot)
const path = require('path');
const { execFileSync } = require('child_process');
const totp = require('../../server/totp.js');

module.exports = async ({ page, player, env, ok }) => {
  const me = await player({ user: 'reportero', pass: 'clave-larga-1' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);
  await page.click('.hub-bar .bug-btn');
  await page.waitFor(`document.querySelector('.bug-report textarea')`);
  ok(true, 'arriba, en la barra del menú, el botón de la mariquita abre la ventana de reportar un bug');
  ok(/Reportar un bug/.test(await page.eval(`document.querySelector('.legal-bar').textContent`)), 'y la barra de abajo también tiene «Reportar un bug»');
  await page.type('.bug-report textarea', 'corto');
  await page.click('.bug-report button.primary');
  await page.waitFor(`[...document.querySelectorAll('.toast')].some(x => /al menos 10/.test(x.textContent))`);
  ok(await page.eval(`!!document.querySelector('.bug-report')`), 'un texto demasiado corto avisa y no se envía');
  await page.type('.bug-report textarea', 'En Mis Pokémon la ficha se queda en blanco al cambiar de pestaña');
  await page.click('.bug-report button.primary');
  await page.waitFor(`[...document.querySelectorAll('.toast')].some(x => /Gracias/.test(x.textContent))`);
  ok(await page.eval(`!document.querySelector('.bug-report')`), 'al enviarlo da las gracias y se cierra');
  await page.eval(`window.__app.ui.show('settings'); true`);
  await page.waitFor(`[...document.querySelectorAll('.settings-view button')].some(b => /Reportar un bug/.test(b.textContent))`);
  ok(true, 'también se puede desde Ajustes');

  // Al admin le sale en el panel, con quién, la pantalla en la que estaba y la versión
  await new Promise(r => setTimeout(r, 1300));   // el servidor guarda cada segundo; la consola lee la base de datos
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'admin.js'), 'alta', 'reportero'], { env, encoding: 'utf8' });
  const secret = out.match(/Clave: ([A-Z2-7 ]+) ·/)[1].replace(/ /g, '');
  await page.goto('/admin');
  await page.waitFor(`!document.querySelector('#login').hidden`);
  await page.type('#login [name=user]', 'reportero');
  await page.type('#login [name=pass]', 'clave-larga-1');
  await page.type('#login [name=code]', totp.code(secret, Math.floor(Date.now() / totp.STEP)));
  await page.eval(`document.querySelector('#login').requestSubmit(); true`);
  await page.waitFor(`!document.querySelector('#top').hidden`);
  await page.waitFor(`document.querySelector('#bugs-n') && !document.querySelector('#bugs-n').hidden`);
  ok(await page.eval(`document.querySelector('#bugs-n').textContent`) === '1', 'la pestaña Bugs avisa de que hay uno nuevo');
  await page.click('[data-tab=bugs]');
  await page.waitFor(`document.querySelector('#bugs-list .bug')`);
  ok(await page.eval(`(() => { const b = document.querySelector('#bugs-list .bug'); return /ficha se queda en blanco/.test(b.textContent) && /reportero/.test(b.textContent) && /menu/.test(b.textContent); })()`),
    'en el panel sale el bug con el texto, quién lo mandó y la pantalla');
  await page.click('Marcar resuelto');
  await page.waitFor(`!document.querySelector('#bugs-list .bug')`);
  ok(true, 'se marca como resuelto y deja de salir entre los nuevos');
};
