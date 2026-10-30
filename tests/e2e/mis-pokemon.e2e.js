// Mis Pokémon: buscador, filtros de la caja y ver un shiny con sus colores normales
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'misdatos' });
  // Los 3 primeros van al equipo; los demás, a la caja (Mew shiny)
  for (const [dex, shiny] of [[1, 0], [4, 0], [7, 0], [151, 1], [150, 0], [25, 0]]) {
    me.client.send({ t: 'dev', dex, level: 50, shiny: !!shiny, region: 'kanto' });
    await me.client.wait(m => m.t === 'profile');
  }
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.waitFor(`document.querySelector('.mon-filters input')`);
  const visible = `[...document.querySelectorAll('.mon-card')].filter(c => c.dataset.box && !c.hidden).length`;
  ok(await page.eval(visible) === 3, 'la caja enseña los 3 que no están en el equipo');

  await page.type('.mon-filters input', 'mew');
  ok(await page.eval(visible) === 2, 'buscar «mew» deja a Mew y Mewtwo');
  ok(/3 Pokémon · se ven 2/.test(await page.eval(`document.querySelectorAll('.sec-title')[1].textContent`)), 'el título de la caja dice cuántos tienes (sin tope) y cuántos se ven');

  await page.type('.mon-filters input', '');
  await page.click('✦ Shiny');
  ok(await page.eval(visible) === 1, 'el filtro shiny deja solo a Mew');

  const mew = () => page.eval(`window.__app.ui.profile.mons.find(m => m.dex === 151)`);
  await page.click('.mon-card[data-shiny="1"] .mon-name');
  await page.waitFor(`document.querySelector('.mon-sheet .ms-seg')`);
  await page.tap('Normal', { in: '.mon-sheet .ms-seg' });
  await page.waitFor(`window.__app.ui.profile.mons.find(m => m.dex === 151).plain`);
  // atajo: que siga siendo shiny con «Normal» puesto no se ve (es justo lo que hace «Normal»): se mira su ficha guardada
  ok((await mew()).plain && (await mew()).shiny, 'Mew se ve normal y sigue siendo shiny');
  ok(await page.eval(visible) === 1 && await page.eval(`/Normal/.test(document.querySelector('.mon-sheet .ms-seg button.sel').textContent)`), 'los filtros se mantienen y el interruptor de la ficha queda en «Normal»');
};
