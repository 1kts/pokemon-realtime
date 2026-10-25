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
  ok(await page.eval(`document.querySelectorAll('.missions-widget .mission').length`) === 3, 'el menú enseña las 3 misiones diarias');
  ok(await page.eval(`!!document.querySelector('.missions-widget.has-ready .m-ready')`), 'el panel de misiones avisa de que hay algo por recoger');

  await page.click('.mw-head');
  await page.waitFor(`window.__app.ui.view === 'missions'`);
  ok(await page.eval(`document.querySelectorAll('.missions.daily .mission').length === 3 && document.querySelectorAll('.missions.weekly .mission').length === 3`), '3 diarias y 3 semanales');

  // La medalla de Brock: su avatar
  const badgeBtn = `[...document.querySelectorAll('.collect .mission')].find(r => r.querySelector('.m-ico > .badge-img'))`;
  ok(await page.eval(`!!${badgeBtn}`), 'la medalla ganada sale para recoger');
  await page.eval(`${badgeBtn}.querySelector('.claim-btn').click(); true`);
  await page.waitFor(`document.querySelector('.loot-pop')`);
  await page.waitFor(`(window.__app.ui.profile.cosmetics.avatars || []).includes('badge:kanto:0')`);
  ok(true, 'recogerla da el avatar de la medalla, con la animación de premio');
  await page.eval(`[...document.querySelectorAll('.loot-pop .acts button')].find(b => !b.classList.contains('primary')).click(); true`);
  await page.waitFor(`window.__app.ui.profile.avatar === 'badge:kanto:0'`);
  ok(await page.eval(`!!document.querySelector('.me-chip .ava.ava-icon')`), '«Usar de avatar» la pone en el perfil');

  // Cambiar una misión
  const free = await page.eval(`window.__app.ui.profile.missions.freeRerolls.daily`);
  await page.eval(`document.querySelector('.missions.daily .reroll').click(); true`);
  await page.waitFor(`window.__app.ui.profile.missions.freeRerolls.daily === ${free - 1}`);
  ok(true, 'cambiar una misión gasta un cambio gratis');
};
