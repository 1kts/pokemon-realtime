// Reto de capturas: cada línea evolutiva cuenta lo que atrapas de ella; en la ficha de la ruta, una Poké Ball llena
// cada 5. A las 25 sale para recoger en Logros «IV perfectos» y desde entonces los de esa línea salen salvajes siempre
// con IV perfectos (las bolas, en dorado)
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'capturador' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const ROUTE = 'k-ruta1';
  const dex = await page.eval(`Data.routeWild(Data.NODES['${ROUTE}']).list[0].dex`);
  const openRoute = async () => {
    await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); localStorage.setItem('arena.storyGuide', '1'); window.__app.ui.show('story'); true`);
    await page.waitFor(`document.querySelector('.node.route')`);
    await page.eval(`[...document.querySelectorAll('.node.route')].find(b => /Ruta 1/.test(b.title || b.textContent)).click(); true`);
    await page.waitFor(`document.querySelector('.route-list .mini .catch-pips')`);
  };
  const card = `[...document.querySelectorAll('.route-list .mini')].find(c => c.title.startsWith(Data.SPECIES[${dex}].name))`;

  // 12 capturas: 2 de 5 Poké Balls
  // (desde el propio juego, para que le llegue el perfil nuevo)
  const setCatches = n => page.eval(`window.__app.net.send({ t: 'dev', catches: { dex: ${dex}, n: ${n} } }); true`).then(() => page.waitFor(`Data.lineStat(window.__app.ui.profile, ${dex}, 'catch') === ${n}`));
  await setCatches(12);
  await openRoute();
  ok(await page.eval(`${card}.querySelectorAll('.catch-pips i.on').length === 2 && /12\\/25/.test(${card}.title)`), 'con 12 capturas de la línea, su tarjeta en la ruta enseña 2 de 5 Poké Balls y «12/25»');

  // 25: se recoge en Logros
  await setCatches(25);
  await page.eval(`window.__app.ui.openCollection('mastery'); true`);
  await page.waitFor(`document.querySelector('.lg-row.k-perfect.ready button')`);
  ok(true, 'a las 25 capturas, «IV perfectos» sale para recoger en Logros');
  await page.eval(`document.querySelector('.lg-row.k-perfect.ready button').click(); true`);
  await page.waitFor(`document.querySelector('.loot-pop') && /IV perfectos/.test(document.querySelector('.loot-pop').textContent)`);
  ok(true, 'al recogerlo sale el premio «IV perfectos» de su línea');
  await page.eval(`document.querySelectorAll('.loot-pop').forEach(x => x.remove()); true`);
  await openRoute();
  ok(await page.eval(`!!${card}.querySelector('.catch-pips.perfect') && /Siempre con IV perfectos/.test(${card}.title)`), 'después, en la ruta sus Poké Balls salen doradas');

  // Y salvaje sale con IV perfectos (se repite el encuentro hasta que salga uno de su línea)
  let seen = false;
  for (let i = 0; i < 14 && !seen; i++) {
    await page.eval(`window.__app.net.send({ t: 'story', a: 'route', id: '${ROUTE}' }); true`);
    await page.waitFor(`window.__app.battle && window.__app.battle.sides`, 15000);
    const r = await page.eval(`(() => { const s = window.__app.battle.sides[1]; return { line: Data.lineOf(s.team[0].dex), perfect: !!s.perfect }; })()`);
    if (r.line === await page.eval(`Data.lineOf(${dex})`)) { seen = true; ok(r.perfect, 'un salvaje de esa línea sale con IV perfectos'); }
    await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
    await page.waitFor(`!window.__app.battle`, 15000);
  }
  if (!seen) log('(no salió ninguno de su línea en 14 encuentros; se comprueba en el resto)');
};
