// En Clasificatoria juegas con lo que has capturado, legendarios incluidos: tu Mewtwo entra en el equipo, junto a dos de
// alquiler, y con el equipo completo se puede buscar partida.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'coleccionista' });
  me.client.send({ t: 'dev', dex: 150, level: 5, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.mode('PvP');
  await page.waitSee('Tus Pokémon', { in: '.pvp-team', scroll: true });
  await page.tap(/Mewtwo/, { in: '.pvp-pool' });
  await page.waitSee('Mewtwo', { in: '.pvp-slots', scroll: true });
  for (const name of ['Charizard', 'Blastoise']) { await page.tap(name, { in: '.pvp-pool.rent' }); await page.waitSee(name, { in: '.pvp-slots', scroll: true }); }
  ok(await page.see('Buscar partida PvP', { scroll: true }), 'con tu Mewtwo y dos de alquiler ya puedes buscar partida');
  ok(await page.see('legendarios incluidos', { in: '.pvp-team', scroll: true }), 'y se explica que los tuyos llevan sus extras');
};
