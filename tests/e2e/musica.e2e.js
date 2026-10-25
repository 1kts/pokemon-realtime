// Música: suena tras tocar la página, cada pantalla y cada combate ponen su tema, fanfarria al acabar
// y volumen/silencio en Ajustes que se recuerda
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  ok(await page.eval(`window.__app.music.current === 'menu' && !window.__app.music.running`), 'la portada pide el tema del menú, pero no suena hasta tocar la página');

  await page.type('.title-panel input', 'Melómano');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`window.__app.music.running && window.__app.music.notes > 10`);
  ok(true, 'al tocar la página empieza a sonar el menú');

  await page.eval(`window.__app.ui.show('story'); true`);
  ok(await page.eval(`window.__app.music.current`) === 'map', 'el mapa de historia tiene su tema');

  await page.eval(`window.__app.ui.show('menu'); window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0]], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle`);
  ok(await page.eval(`window.__app.music.current`) === 'battle', 'un combate pone el tema de combate');
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.music.current === 'defeat'`);
  ok(true, 'al perder suena la melodía de derrota');
  await page.waitFor(`window.__app.ui.view === 'results'`);   // los resultados salen un momento después
  ok(await page.eval(`window.__app.music.current`) === 'defeat', 'la pantalla de resultados deja sonar la melodía hasta el final');

  await page.eval(`window.__app.ui.show('settings'); true`);
  await page.waitFor(`document.querySelector('.music-panel input[type=range]')`);
  await page.type('.music-panel input[type=range]', '0');
  await page.waitFor(`!window.__app.music.running`);
  ok(await page.eval(`localStorage.getItem('arena.music')`) === '0' && /Sin música/.test(await page.eval(`document.querySelector('.music-panel button').textContent`)),
    'bajar el volumen a 0 la silencia y se recuerda');
  await page.click('.music-panel button');
  await page.waitFor(`window.__app.music.running`);
  ok(await page.eval(`+localStorage.getItem('arena.music')`) > 0, '«Sin música» la vuelve a encender');
  await page.reload();
  ok(await page.eval(`window.__app.music.volume`) > 0 && await page.eval(`window.__app.music.volume`) === await page.eval(`+localStorage.getItem('arena.music')`), 'el volumen se mantiene al recargar');
};
