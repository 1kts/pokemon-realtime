// Reto de capturas (2): con «IV perfectos» recogido (las 25 capturas de una línea), los salvajes de esa línea salen
// siempre con IV perfectos, y en el combate salvaje se ven encima del rival las Poké Balls de su reto. Contarlas y
// recogerlo en Logros, en capturas-reto.e2e.js
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'capturador' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  const ROUTE = 'k-ruta1';
  // La Ruta 1, tocándola en el Camino de Historia (su nombre está en su tooltip, en title o, tras pasar el ratón, en data-tip)
  const ruta1 = '.sp-route[title^="Ruta 1 ·"], .sp-route[data-tip^="Ruta 1 ·"]';
  const openRoute = async () => {
    await page.tap(/^Historia/);
    await page.waitFor(`document.querySelector('${ruta1}')`);
    await page.click(ruta1);
    await page.waitFor(`document.querySelector('.route-list .mini .catch-pips')`);
  };

  // (25 capturas e «IV perfectos» ya recogido, de cada línea que sale ahora en la ruta: así el primer salvaje ya es
  // de una de ellas, sin depender de la suerte. Recogerlo por la interfaz es lo que prueba capturas-reto.e2e.js)
  const lines = await page.eval(`[...new Set(Data.routeWild(Data.NODES['${ROUTE}']).list.map(w => Data.lineOf(w.dex)))]`);
  for (const line of lines) {
    me.client.send({ t: 'dev', catches: { dex: line, n: 25 } }); await me.client.wait(m => m.t === 'profile');
    me.client.send({ t: 'masteryclaim', dex: line, i: 7 }); await me.client.wait(m => m.t === 'loot');
  }
  await page.loginAs(me.token);
  await openRoute();

  // Y el salvaje sale con IV perfectos (si saliera uno de otra línea, el especial de la ruta, se explora otra vez)
  let seen = false;
  for (let i = 0; i < 5 && !seen; i++) {
    if (i) { await page.click(ruta1); await page.waitFor(`document.querySelector('.route-list')`); }
    await page.tap('Explorar', { in: '.story-side' });
    await page.waitFor(`window.__app.battle && window.__app.battle.sides && window.__app.battle.latest`, 20000);
    // atajo: los IV del salvaje no se ven hasta capturarlo: se mira con qué IV ha salido
    const r = await page.eval(`(() => { const s = window.__app.battle.sides[1]; return { line: Data.lineOf(s.team[0].dex), perfect: !!s.perfect }; })()`);
    if (lines.includes(r.line)) { seen = true; ok(r.perfect, 'un salvaje de una línea con «IV perfectos» sale con IV perfectos'); }
    if (i === 0) {   // encima del salvaje, sus Poké Balls del reto
      await page.waitFor(`document.querySelector('.plate.foe .catch-pips')`);
      ok(await page.eval(`document.querySelectorAll('.plate.foe .catch-pips i').length === 5 && !document.querySelector('.plate.mine .catch-pips')`), 'en el combate salvaje, encima del rival salen las 5 Poké Balls de su reto de capturas');
    }
    await page.key('Escape');
    await page.tap('Rendirse', { in: '.ui-confirm-box' });
    await page.tap('Continuar');
  }
  if (!seen) log('(no salió ninguno de esas líneas en 5 encuentros; se comprueba en el resto)');
};
