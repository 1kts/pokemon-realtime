// Clasificatoria: los movimientos del Pokémon elegido salen entre el equipo y la lista de Pokémon
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'equipador' });
  await page.loginAs(me.token);
  await page.tap(/^Clasificatoria/);
  await page.click('.pvp-pick');
  await page.waitFor(`document.querySelector('.pvp-slot:not(.empty)')`);
  await page.click('.pvp-slot:not(.empty)');
  await page.waitFor(`document.querySelector('.pvp-mvbox .pvp-mv')`);
  ok(await page.eval(`(() => { const box = document.querySelector('.pvp-team'), kids = [...box.children]; return kids.indexOf(box.querySelector('.pvp-mvbox')) < kids.indexOf(box.querySelector('.pvp-pool')); })()`), 'los movimientos van entre el equipo y la lista de Pokémon');
  // Repintar al elegir no vuelve a lanzar la animación de entrada de la pantalla (parecía que la página se recargaba)
  ok(await page.eval(`document.getElementById('screen').classList.contains('repaint') && getComputedStyle(document.querySelector('#screen > *')).animationName === 'none'`), 'al elegir, la pantalla se repinta sin animación de entrada');
};
