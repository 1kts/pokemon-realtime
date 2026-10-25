// Panel de administración: alta por consola, entrar con usuario + contraseña + código 2FA, resumen y búsqueda
const path = require('path');
const { execFileSync } = require('child_process');
const totp = require('../../server/totp.js');

module.exports = async ({ page, player, env, ok }) => {
  const boss = await player({ user: 'jefa', pass: 'clave-larga-1' });
  await player({ name: 'Gamberro' });
  await new Promise(r => setTimeout(r, 1300));   // el servidor guarda cada segundo; la consola lee la base de datos
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'admin.js'), 'alta', 'jefa'], { env, encoding: 'utf8' });
  const secret = out.match(/Clave: ([A-Z2-7 ]+) ·/)[1].replace(/ /g, '');

  await page.goto('/admin');
  await page.waitFor(`!document.querySelector('#login').hidden`);
  await page.type('#login [name=user]', 'jefa');
  await page.type('#login [name=pass]', 'clave-larga-1');
  await page.type('#login [name=code]', '000000');
  await page.eval(`document.querySelector('#login').requestSubmit(); true`);
  await page.waitFor(`document.querySelector('#login-err').textContent`);
  ok(await page.eval(`document.querySelector('#top').hidden`), 'con un código 2FA malo no entra');

  await page.type('#login [name=code]', totp.code(secret, Math.floor(Date.now() / totp.STEP)));
  await page.eval(`document.querySelector('#login').requestSubmit(); true`);
  await page.waitFor(`!document.querySelector('#top').hidden`);
  ok(/jefa/.test(await page.eval(`document.querySelector('#who').textContent`)), 'con contraseña y código buenos entra');
  await page.waitFor(`document.querySelectorAll('#resumen .stat').length > 5`);
  ok(await page.eval(`[...document.querySelectorAll('#resumen .stat span')].some(s => /conectados/.test(s.textContent))`), 'el resumen enseña los conectados');

  await page.click('[data-tab=jugadores]');
  await page.type('#search [name=q]', 'gamber');
  await page.eval(`document.querySelector('#search').requestSubmit(); true`);
  await page.waitFor(`document.querySelector('#results tr.click')`);
  await page.eval(`document.querySelector('#results tr.click').click(); true`);
  await page.waitFor(`document.querySelector('#player h1')`);
  ok(/Gamberro/.test(await page.eval(`document.querySelector('#player h1').textContent`)), 'buscar un jugador y abrir su ficha');
  ok(boss.id && await page.eval(`!document.querySelector('#player').textContent.includes('Desbloquear todo')`), 'en la ficha de otro no sale «Desbloquear todo»');
};
