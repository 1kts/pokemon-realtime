// Para jugar online no hace falta la Historia: una cuenta recién creada, sin ningún Pokémon, prepara un equipo de
// alquiler y busca partida.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ name: 'Novata' });
  await page.loginAs(me.token);
  await page.click('.menu-card.ranked');
  await page.waitSee('De alquiler', { in: '.pvp-team', scroll: true });
  ok(!(await page.see('Tus Pokémon', { in: '.pvp-team', ms: 0 })), 'sin Pokémon propios no sale esa lista');
  for (const name of ['Charizard', 'Blastoise', 'Venusaur']) { await page.tap(name, { in: '.pvp-pool.rent' }); await page.waitSee(name, { in: '.pvp-slots', scroll: true }); }
  await page.tap('Buscar partida clasificatoria');
  await page.waitSee(/Cancelar|Buscando/);
  ok(true, 'con 3 de alquiler ya está buscando partida');
};
