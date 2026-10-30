// Mis Pokémon: tocar un Pokémon abre su ficha completa; desde ella se usan vitaminas, se cambian los
// movimientos y se pasa al siguiente sin cerrarla
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'fichas' });
  for (const [dex, level] of [[6, 36], [25, 30]]) { me.client.send({ t: 'dev', dex, level, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', item: 'proteina', qty: 2 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.waitFor(`document.querySelectorAll('.mon-card').length === 2`);
  await page.click(await page.within('Charizard', '.mon-card'));
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  ok(await page.title() === 'Charizard' && await page.eval(`document.querySelectorAll('.ms-tab').length === 4 && document.querySelectorAll('.ms-stat').length === 4`),
    'tocar la tarjeta de Charizard abre su ficha, con 4 pestañas y sus estadísticas');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/ficha-stats.png');

  // Vitamina desde la ficha: suben los EV repartidos y la ficha sigue abierta
  const evs = async () => +(await page.read('.ms-evtotal b')).split('/')[0].trim();
  const ev0 = await evs();
  await page.tap(/^Proteína/, { in: '.mon-sheet' });
  await page.waitFor(`/^${ev0 + 10}\\b/.test(document.querySelector('.ms-evtotal b').textContent)`).catch(() => {});
  ok(await evs() === ev0 + 10 && await page.title() === 'Charizard', `una Proteína desde la ficha sube los EV repartidos (${ev0} → ${await evs()}) y la ficha sigue abierta`);

  // Movimientos: quitar uno y guardar
  await page.tap('Movimientos', { in: '.mon-sheet' });
  await page.waitFor(`document.querySelector('.ms-slots')`);
  const moves = () => page.eval(`[...document.querySelectorAll('.ms-movelist .move-row.sel')].length`);
  const before = await moves();
  await page.click('.ms-movelist .move-row.sel');
  await page.tap(/Guardar/, { in: '.ms-movebar' });
  // (se guarda de verdad: al volver a abrir la ficha, sigue con uno menos)
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  await page.click(await page.within('Charizard', '.mon-card'));
  await page.tap('Movimientos', { in: '.mon-sheet' });
  await page.waitFor(`document.querySelector('.ms-slots')`);
  ok(await moves() === before - 1, `en Movimientos se quita uno y se guarda (${before} → ${await moves()})`);
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/ficha-moves.png');

  // Siguiente Pokémon
  await page.tap('Siguiente', { in: '.ms-nav' });
  await page.waitFor(`document.querySelector('.mon-sheet') && !/Charizard/.test(document.querySelector('.mon-sheet').innerText.split('\\n')[0] || '')`).catch(() => {});
  ok(await page.title() === 'Pikachu', 'con › pasa al siguiente Pokémon (Pikachu) sin cerrar la ficha');
};
