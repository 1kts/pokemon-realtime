// Reto de capturas: cada línea evolutiva cuenta lo que atrapas de ella; en la ficha de la ruta, una Poké Ball llena
// cada 5. A las 25 sale para recoger en Logros «IV perfectos» y desde entonces sus bolas salen en dorado. Que los
// salvajes de esa línea salgan con IV perfectos, en capturas.e2e.js (juntas pasaban de los 5 minutos del CI)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'capturador' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  const ROUTE = 'k-ruta1';
  const dex = await page.eval(`Data.routeWild(Data.NODES['${ROUTE}']).list[0].dex`);
  const name = await page.eval(`Data.SPECIES[${dex}].name`);
  // La Ruta 1, tocándola en el Camino de Historia (su nombre está en su tooltip, en title o, tras pasar el ratón, en data-tip)
  const ruta1 = '.sp-route[title^="Ruta 1 ·"], .sp-route[data-tip^="Ruta 1 ·"]';
  const openRoute = async () => {
    await page.tap(/^Historia/);
    await page.waitFor(`document.querySelector('${ruta1}')`);
    await page.click(ruta1);
    await page.waitFor(`document.querySelector('.route-list .mini .catch-pips')`);
  };
  const card = `[...document.querySelectorAll('.route-list .mini')].find(c => c.title.startsWith(${JSON.stringify(name)}) || (c.dataset.tip || '').startsWith(${JSON.stringify(name)}))`;
  // (las capturas, con el gancho de pruebas; al volver a entrar, el juego ya las tiene)
  const setCatches = async n => { me.client.send({ t: 'dev', catches: { dex, n } }); await me.client.wait(m => m.t === 'profile'); await page.loginAs(me.token); };

  // 12 capturas: 2 de 5 Poké Balls
  await setCatches(12);
  await openRoute();
  ok(await page.eval(`${card}.querySelectorAll('.catch-pips i.on').length === 2 && /12\\/25/.test(${card}.title || ${card}.dataset.tip)`), `con 12 capturas de ${name}, su tarjeta en la ruta enseña 2 de 5 Poké Balls y «12/25»`);

  // 25: se recoge en la ficha de un Pokémon de la línea
  me.client.send({ t: 'dev', dex, level: 5, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await setCatches(25);
  await page.tap('Mis Pokémon');
  await page.click(await page.within(name, '.mon-card'));
  await page.tap(/^Retos/, { in: '.mon-sheet' });
  await page.waitFor(`document.querySelector('.lg-row.k-perfect.ready button')`);
  ok(await page.see('IV perfectos', { in: '.lg-row.k-perfect', scroll: true }), 'a las 25 capturas, «IV perfectos» sale para recoger en su ficha');
  await page.click('.lg-row.k-perfect.ready button');
  await page.waitSee('IV perfectos', { in: '.loot-pop' });
  ok(true, 'al recogerlo sale el premio «IV perfectos» de su línea');
  await page.click('.loot-pop .acts .primary');
  await page.key('Escape');
  await page.tap('Volver');
  await openRoute();
  ok(await page.eval(`!!${card}.querySelector('.catch-pips.perfect') && /Siempre con IV perfectos/.test(${card}.title || ${card}.dataset.tip)`), 'después, en la ruta sus Poké Balls salen doradas');
};
