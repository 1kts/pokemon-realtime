// Lo que un Pokémon aprende por MT en los juegos también se puede elegir al llegar a Nv.50: en la ficha de Charizard (Nv.50)
// sale Llamarada, marcada como MT, y se pone en lugar de uno de los suyos. A un Charmander de Nv.10, Llamarada le sale
// para más adelante, con el nivel al que se puede poner.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mtfan' });
  for (const [dex, level] of [[6, 50], [4, 10]]) { me.client.send({ t: 'dev', dex, level, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.click(await page.within('Charizard', '.mon-card'));
  await page.tap(/^Movimientos/, { in: '.mon-sheet' });
  await page.waitSee('Llamarada', { in: '.ms-movelist', scroll: true });
  ok(await page.see(/Llamarada\s*Fuego\s*MT/, { in: '.ms-movelist', scroll: true }), 'Charizard puede elegir Llamarada, marcada como MT');
  // Quita el primero de los que lleva y pone Llamarada
  const primero = await page.read('.ms-slot b');
  await page.tap(primero, { in: '.ms-movelist' });
  await page.tap('Llamarada', { in: '.ms-movelist' });
  await page.tap('Guardar', { in: '.mon-sheet' });
  await page.waitSee('Llamarada', { in: '.ms-slots' });
  ok(true, 'y al guardar, Llamarada queda entre sus 4 movimientos');
  await page.key('Escape');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.tap(/^Movimientos/, { in: '.mon-sheet' });
  await page.waitSee('Próximamente', { in: '.ms-movelist', scroll: true });
  ok(await page.see(/Por MT, a Nv\.50[\s\S]*Llamarada/, { in: '.move-soon', scroll: true }), 'a Charmander (Nv.10), Llamarada le sale para más adelante: por MT, a Nv.50');
};
