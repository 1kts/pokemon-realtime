// Reto de capturas (2): con «IV perfectos» recogido (las 25 capturas de una línea), los salvajes de esa línea salen
// siempre con IV perfectos, y en el combate salvaje se ven encima del rival las Poké Balls de su reto. Contarlas y
// recogerlo en Logros, en capturas-reto.e2e.js
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

  // (25 capturas e «IV perfectos» ya recogido: recogerlo por la interfaz es lo que prueba capturas-reto.e2e.js)
  me.client.send({ t: 'dev', catches: { dex, n: 25 } }); await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'masteryclaim', dex, i: 7 }); await me.client.wait(m => m.t === 'loot');
  await page.loginAs(me.token);
  await openRoute();

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
