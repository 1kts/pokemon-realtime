// Clasificatoria: los movimientos del Pokémon elegido salen entre el equipo y la lista de Pokémon
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'equipador' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('online'); true`);
  await page.waitFor(`document.querySelector('.pvp-pick')`);
  await page.eval(`document.querySelector('.pvp-pick').click(); true`);
  await page.waitFor(`document.querySelector('.pvp-slot:not(.empty)')`);
  await page.eval(`document.querySelector('.pvp-slot:not(.empty)').click(); true`);
  await page.waitFor(`document.querySelector('.pvp-mvbox .pvp-mv')`);
  ok(await page.eval(`(() => { const box = document.querySelector('.pvp-team'), kids = [...box.children]; return kids.indexOf(box.querySelector('.pvp-mvbox')) < kids.indexOf(box.querySelector('.pvp-pool')); })()`), 'los movimientos van entre el equipo y la lista de Pokémon');
  // Repintar al elegir no vuelve a lanzar la animación de entrada de la pantalla (parecía que la página se recargaba)
  ok(await page.eval(`document.getElementById('screen').classList.contains('repaint') && getComputedStyle(document.querySelector('#screen > *')).animationName === 'none'`), 'al elegir, la pantalla se repinta sin animación de entrada');
};
