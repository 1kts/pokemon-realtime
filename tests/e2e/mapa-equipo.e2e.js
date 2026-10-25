// Mapa de Historia: «Tu equipo» se gestiona desde el panel del lugar (enlace Gestionar, cada Pokémon o
// un hueco libre abren Mis Pokémon en esa región) y Volver regresa al mapa
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mapaequipo' });
  for (const dex of [4, 16]) {
    me.client.send({ t: 'dev', dex, level: 8, region: 'kanto' });
    await me.client.wait(m => m.t === 'profile');
  }
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.node-info .team-head .link')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);   // la guía de la primera vez
  ok(await page.eval(`document.querySelectorAll('.node-info .mini.pick:not(.empty)').length`) === 2, 'el panel enseña los 2 Pokémon del equipo');
  ok(await page.eval(`document.querySelectorAll('.node-info .mini.pick.empty').length`) === 1, 'y un hueco libre para el tercero');
  ok(!(await page.eval(`!!document.querySelector('.node-info .manage-team')`)), 'sin botón grande de gestionar');

  await page.click('.node-info .team-head .link');
  await page.waitFor(`window.__app.ui.view === 'team'`);
  ok(await page.eval(`window.__app.ui.teamRegion`) === 'kanto', '«Gestionar» abre Mis Pokémon en la región del mapa');
  await page.click('.tb-btn.back');
  await page.waitFor(`window.__app.ui.view === 'story'`);
  ok(true, 'Volver regresa al mapa');

  await page.click('.node-info .mini.pick.empty');
  await page.waitFor(`window.__app.ui.view === 'team'`);
  ok(true, 'el hueco libre también abre Mis Pokémon');
};
