// Mapa de Historia: «Tu equipo» se gestiona desde el panel del lugar (enlace Gestionar, cada Pokémon o
// un hueco libre abren Mis Pokémon en esa región) y Volver regresa al mapa
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mapaequipo' });
  for (const dex of [4, 16]) {
    me.client.send({ t: 'dev', dex, level: 8, region: 'kanto' });
    await me.client.wait(m => m.t === 'profile');
  }
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.waitFor(`document.querySelector('.node-info .team-head .link')`);
  ok(await page.eval(`document.querySelectorAll('.node-info .mini.pick:not(.empty)').length`) === 2, 'el panel enseña los 2 Pokémon del equipo');
  ok(await page.eval(`document.querySelectorAll('.node-info .mini.pick.empty').length`) === 1, 'y un hueco libre para el tercero');
  ok(!(await page.eval(`!!document.querySelector('.node-info .manage-team')`)), 'sin botón grande de gestionar');

  await page.click('.node-info .team-head .link');
  await page.waitSee('Pokémon de Kanto');
  ok(await page.title() === 'Mis Pokémon', '«Gestionar» abre Mis Pokémon en la región del mapa (Kanto)');
  await page.tap('Volver');
  await page.waitFor(`document.querySelector('.node-info .mini.pick.empty')`);
  ok(await page.title() === 'Historia', 'Volver regresa a Historia');

  await page.click('.node-info .mini.pick.empty');
  await page.waitSee('Pokémon de Kanto');
  ok(true, 'el hueco libre también abre Mis Pokémon de Kanto');
};
