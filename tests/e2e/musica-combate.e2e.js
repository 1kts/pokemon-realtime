// Música (2): cada combate pone su tema (y si falta el archivo, su versión sintetizada), al acabar vuelve el del menú,
// y volumen/silencio en Ajustes que se recuerda. Lo del menú, en musica.e2e.js
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  // (entrar como invitado: el toque que deja sonar la música)
  await page.type('.title-panel input', 'Melómano');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`window.__app.music.running && window.__app.music.sounding`);

  // Sin archivo (no está o no carga) suena el mismo tema sintetizado: se simula con el del combate
  await page.eval(`window.__app.music.bytes.set('desierto', Promise.resolve(null)); true`);
  await page.tap(/^Práctica/);
  await page.click('.pool-card');
  await page.click('.draft button.primary');
  await page.waitFor(`window.__app.battle`, 20000);
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.current`) === 'battle', 'un combate pone el tema de combate');
  await page.waitFor(`window.__app.music.sounding`);
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.source`) === 'sintetizado', 'si el archivo del tema falta, suena la versión sintetizada');
  await page.waitFor(`window.__app.battle.latest`, 15000);
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.waitFor(`window.__app.music.current === 'menu'`).then(() => true, () => false), 'al acabar el combate vuelve el tema del menú (sin fanfarria ni melodía de derrota)');
  await page.waitSee('Derrota');
  await page.waitFor(`window.__app.music.sounding`);
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.current`) === 'menu' && await page.eval(`window.__app.music.source`) === 'archivo', 'y en los resultados sigue sonando la grabación del menú');

  await page.tap('Continuar');
  await page.tap('Volver');
  await page.tap('Ajustes');
  await page.waitFor(`document.querySelector('.music-panel input[type=range]')`);
  await page.slide('.music-panel input[type=range]', 0);
  await page.waitFor(`window.__app.music.volume === 0`);
  ok(await page.eval(`localStorage.getItem('arena.music')`) === '0' && /Sin música/.test(await page.eval(`document.querySelector('.music-panel button').textContent`)),
    'bajar el volumen a 0 la silencia y se recuerda');
  await page.click('.music-panel button');
  await page.waitFor(`window.__app.music.volume > 0 && window.__app.music.running && window.__app.music.sounding`);
  ok(await page.eval(`+localStorage.getItem('arena.music')`) > 0, '«Sin música» la vuelve a encender');
  await page.reload();
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.volume`) > 0 && await page.eval(`window.__app.music.volume`) === await page.eval(`+localStorage.getItem('arena.music')`), 'el volumen se mantiene al recargar');
};
