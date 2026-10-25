// Mis Pokémon: tocar un Pokémon abre su ficha completa; desde ella se usan vitaminas, se cambian los
// movimientos y se pasa al siguiente sin cerrarla
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'fichas' });
  for (const [dex, level] of [[6, 36], [25, 30]]) { me.client.send({ t: 'dev', dex, level, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', item: 'proteina', qty: 2 }); await me.client.wait(m => m.t === 'profile');
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload(); await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelectorAll('.mon-card').length === 2`);
  await page.eval(`document.querySelector('.mon-card .mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  ok(await page.eval(`document.querySelectorAll('.ms-tab').length === 4 && document.querySelectorAll('.ms-stat').length === 4`), 'tocar la tarjeta abre la ficha con 4 pestañas y sus estadísticas');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/ficha-stats.png');

  // Vitamina desde la ficha: sube el EV de Ataque y la ficha sigue abierta
  const uid = await page.eval(`window.__app.ui.sheet.uid`);
  const ev0 = await page.eval(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).ev.atk`);
  await page.eval(`[...document.querySelectorAll('.ms-vit')].find(b => /Proteína/.test(b.textContent)).click(); true`);
  await page.waitFor(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).ev.atk > ${ev0} && document.querySelector('.mon-sheet')`);
  ok(true, 'una Proteína desde la ficha sube el EV de Ataque y la ficha sigue abierta');

  // Movimientos: quitar uno y guardar
  await page.eval(`[...document.querySelectorAll('.ms-tab')].find(b => /Movimientos/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.ms-slots')`);
  const before = await page.eval(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).moves.length`);
  await page.eval(`document.querySelector('.ms-movelist .move-row.sel').click(); true`);
  await page.eval(`[...document.querySelectorAll('.ms-movebar button')].find(b => /Guardar/.test(b.textContent)).click(); true`);
  await page.waitFor(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).moves.length === ${before - 1}`);
  ok(true, 'en Movimientos se quita uno y se guarda');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/ficha-moves.png');

  // Siguiente Pokémon
  await page.eval(`document.querySelectorAll('.ms-nav .tb-btn')[1].click(); true`);
  await page.waitFor(`window.__app.ui.sheet.uid !== ${uid}`);
  ok(true, 'con › pasa al siguiente Pokémon sin cerrar la ficha');
};
