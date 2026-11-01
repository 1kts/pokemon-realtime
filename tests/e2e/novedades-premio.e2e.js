// Un premio de maestría se pone desde su propia ventana: «Usar este título» al recogerlo (parte de novedades.e2e.js,
// que juntas pasaban de los 5 minutos en el CI)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'novedades' });
  const dev = async m => { me.client.send({ t: 'dev', ...m }); await me.client.wait(x => x.t === 'profile'); };
  await dev({ dex: 4, level: 20, region: 'kanto' });
  await dev({ mastery: { dex: 4, wins: 500 } });
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.waitSee('Aventura');
  await page.tap('Mis Pokémon');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.tap(/^Retos/, { in: '.mon-sheet' });
  // (el del título, directamente: recoger antes los otros cuatro, uno a uno, pasaba de los 5 minutos en el CI)
  await page.tap('¡Recoger!', { in: await page.within('Maestro de Charmander', '.ms-retos .lg-row') });
  await page.waitSee('Usar este título', { in: '.loot-pop' });
  await page.tap('Usar este título');
  await page.waitSee('Maestro de Charmander', { in: '.ms-retos', scroll: true });
  const puesto = await page.eval(`window.__app.ui.profile.title`);   // atajo: el título solo se ve en otra pantalla
  ok(puesto === 'Maestro de Charmander', `un título ganado se pone desde la ventana del premio (${puesto})`);
};
