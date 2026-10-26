// Clasificatoria sin draft: en su pantalla preparas tu equipo de 3 (Nv.50) y sus movimientos, se guarda solo, y
// con él buscas partida contra un rival al azar. Sin equipo no se puede buscar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rankera' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('online'); true`);
  await page.waitFor(`document.querySelector('.pvp-team')`);
  ok(await page.eval(`[...document.querySelectorAll('.online button.primary')].find(b => /Buscar partida/.test(b.textContent)).disabled && document.querySelectorAll('.pvp-slot.empty').length === 3`), 'sin equipo, el botón de buscar está desactivado y los 3 huecos vacíos');
  for (const dex of [6, 9, 3]) {
    await page.eval(`[...document.querySelectorAll('.pvp-pick')].find(b => b.title === Data.SPECIES[${dex}].name).click(); true`);
    await page.waitFor(`document.querySelectorAll('.pvp-slot:not(.empty)').length >= ${[6, 9, 3].indexOf(dex) + 1}`);
  }
  await page.waitFor(`(window.__app.ui.profile.pvpTeam || []).length === 3`);
  ok(await page.eval(`window.__app.ui.profile.pvpTeam.map(x => x.dex).join() === '6,9,3' && !document.querySelector('.pvp-slot.empty')`), 'elegir 3 del pool llena los huecos y se guarda solo');
  // Movimientos del primero: quitar uno
  await page.eval(`document.querySelector('.pvp-slot').click(); true`);
  await page.waitFor(`document.querySelectorAll('.pvp-mv.on').length === 4`);
  await page.eval(`document.querySelector('.pvp-mv.on').click(); true`);
  await page.waitFor(`window.__app.ui.profile.pvpTeam[0].moves.length === 3`);
  ok(await page.eval(`![...document.querySelectorAll('.online button.primary')].find(b => /Buscar partida/.test(b.textContent)).disabled`), 'se le cambian los movimientos y ya se puede buscar partida');
  ok(await page.eval(`!/otra pestaña/.test(document.body.textContent)`), 'sin el consejo de abrir otra pestaña');

  // Elegir movimientos con la página bajada no la sube arriba (antes cada toque la repintaba desde el principio)
  await page.resize(1280, 560);
  await page.eval(`document.querySelector('.pvp-mvlist').scrollIntoView({ block: 'center' }); true`);
  const y0 = await page.eval(`document.getElementById('screen').scrollTop`);
  await page.eval(`document.querySelector('.pvp-mv:not(.on):not(:disabled)').click(); true`);
  await page.waitFor(`window.__app.ui.profile.pvpTeam[0].moves.length === 4`);
  await new Promise(r => setTimeout(r, 200));
  const y1 = await page.eval(`document.getElementById('screen').scrollTop`);
  ok(y0 > 50 && Math.abs(y1 - y0) <= 2, `al elegir un movimiento la página se queda donde estaba (${Math.round(y0)} → ${Math.round(y1)} px)`);
  await page.resize();
};
