// Misiones: la pantalla con diarias, semanales y lo que hay por recoger; recoger una medalla da su
// avatar (con la animación de premio) y se puede usar en el perfil; cambiar una misión gasta un cambio gratis
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'misiones' });
  me.client.send({ t: 'dev', dex: 7, level: 10, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 1, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`document.querySelectorAll('.missions-widget .mission').length`) === 6 && await page.eval(`document.querySelectorAll('.missions-widget .mw-sub').length`) === 2, 'el menú enseña las 3 misiones diarias y las 3 semanales');
  ok(await page.eval(`!!document.querySelector('.missions-widget.has-ready .claim-all')`), 'el panel de misiones avisa de que hay algo por recoger');

  await page.click('.mw-head .go');   // (el «Ver todas ›» de la cabecera; en su centro está «Recoger todo»)
  await page.waitFor(`window.__app.ui.view === 'missions'`);
  ok(await page.eval(`document.querySelectorAll('.missions.daily .mission').length === 3 && document.querySelectorAll('.missions.weekly .mission').length === 3`), '3 diarias y 3 semanales');

  // La medalla de Brock: su avatar
  const badgeBtn = `[...document.querySelectorAll('.collect .mission')].find(r => r.querySelector('.m-ico > .badge-img'))`;
  ok(await page.eval(`!!${badgeBtn}`), 'la medalla ganada sale para recoger');
  await page.eval(`${badgeBtn}.querySelector('.claim-btn').id = 'badge-e2e'; true`);
  await page.click('#badge-e2e');
  await page.waitSee('Usar de avatar', { in: '.loot-pop' });
  ok(true, 'recogerla saca la animación de premio, que ofrece usarla de avatar');
  await page.tap('Usar de avatar', { in: '.loot-pop' });
  await page.waitFor(`window.__app.ui.profile.avatar === 'badge:kanto:0'`);
  await page.tap('Volver');
  ok(await page.waitFor(`document.querySelector('.hub-ava .ava.ava-icon')`).then(() => true, () => false), '«Usar de avatar» la pone en tu avatar, arriba en el menú');

  // Cambiar una misión
  await page.tap('Ver todas');
  // (los de las diarias: las semanales tienen los suyos)
  const free = +(await page.read('.m-rerolls', { in: '.missions.daily' })).replace(/\D/g, '');
  await page.click('.missions.daily .reroll');
  await page.waitSee(`Cambios gratis: ${free - 1}`, { in: '.missions.daily' });
  ok(true, `cambiar una misión diaria gasta un cambio gratis (quedan ${free - 1})`);
};
