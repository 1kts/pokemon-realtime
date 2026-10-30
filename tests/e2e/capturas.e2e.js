// Reto de capturas: cada línea evolutiva cuenta lo que atrapas de ella; en la ficha de la ruta, una Poké Ball llena
// cada 5. A las 25 sale para recoger en Logros «IV perfectos» y desde entonces los de esa línea salen salvajes siempre
// con IV perfectos (las bolas, en dorado)
module.exports = async ({ page, player, ok, log }) => {
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

  // 25: se recoge en Logros
  await setCatches(25);
  await page.click('.coll-tile.wide');
  await page.waitFor(`document.querySelector('.lg-row.k-perfect.ready button')`);
  ok(await page.see('IV perfectos', { in: '.lg-row.k-perfect', scroll: true }), 'a las 25 capturas, «IV perfectos» sale para recoger en Logros');
  await page.click('.lg-row.k-perfect.ready button');
  await page.waitSee('IV perfectos', { in: '.loot-pop' });
  ok(true, 'al recogerlo sale el premio «IV perfectos» de su línea');
  await page.click('.loot-pop .acts .primary');
  await page.tap('Volver');
  await openRoute();
  ok(await page.eval(`!!${card}.querySelector('.catch-pips.perfect') && /Siempre con IV perfectos/.test(${card}.title || ${card}.dataset.tip)`), 'después, en la ruta sus Poké Balls salen doradas');

  // Y salvaje sale con IV perfectos (se explora hasta que salga uno de su línea)
  let seen = false;
  for (let i = 0; i < 5 && !seen; i++) {
    if (i) { await page.click(ruta1); await page.waitFor(`document.querySelector('.route-list')`); }
    await page.tap('Explorar', { in: '.story-side' });
    await page.waitFor(`window.__app.battle && window.__app.battle.sides && window.__app.battle.latest`, 20000);
    // atajo: los IV del salvaje no se ven hasta capturarlo: se mira con qué IV ha salido
    const r = await page.eval(`(() => { const s = window.__app.battle.sides[1]; return { line: Data.lineOf(s.team[0].dex), perfect: !!s.perfect }; })()`);
    if (r.line === await page.eval(`Data.lineOf(${dex})`)) { seen = true; ok(r.perfect, 'un salvaje de esa línea sale con IV perfectos'); }
    if (i === 0) {   // encima del salvaje, sus Poké Balls del reto
      await page.waitFor(`document.querySelector('.plate.foe .catch-pips')`);
      ok(await page.eval(`document.querySelectorAll('.plate.foe .catch-pips i').length === 5 && !document.querySelector('.plate.mine .catch-pips')`), 'en el combate salvaje, encima del rival salen las 5 Poké Balls de su reto de capturas');
    }
    await page.key('Escape');
    await page.tap('Rendirse', { in: '.ui-confirm-box' });
    await page.tap('Continuar');
  }
  if (!seen) log('(no salió ninguno de su línea en 5 encuentros; se comprueba en el resto)');
};
