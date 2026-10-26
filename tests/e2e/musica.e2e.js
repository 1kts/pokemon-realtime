// Música: suena tras tocar la página, cada pantalla y cada combate ponen su tema, al acabar vuelve el del menú
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
  await page.waitFor(`window.__app.music.running && window.__app.music.sounding`);
  ok(await page.eval(`window.__app.music.source`) === 'archivo', 'al tocar la página suena la grabación del menú (public/music/pueblo.mp3, de jannetty)');

  // Fuera de combate suena siempre el mismo tema: moverse por los menús no la corta
  const starts0 = await page.eval(`window.__app.music.starts`);
  for (const v of ['story', 'team', 'shop', 'dex', 'settings', 'menu']) await page.eval(`window.__app.ui.show('${v}'); true`);
  ok(await page.eval(`window.__app.music.current`) === 'menu', 'mapa, equipo, tienda, Pokédex y ajustes usan el mismo tema que el menú');
  ok(await page.eval(`window.__app.music.starts`) === starts0 && await page.eval(`window.__app.music.sounding`), 'y sigue sonando sin reiniciarse al pasar de uno a otro');

  // Sin archivo (no está o no carga) suena el mismo tema sintetizado: se simula con el del combate
  await page.eval(`window.__app.music.bytes.set('desierto', Promise.resolve(null)); true`);
  await page.eval(`window.__app.ui.show('menu'); window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0]], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle`);
  ok(await page.eval(`window.__app.music.current`) === 'battle', 'un combate pone el tema de combate');
  await page.waitFor(`window.__app.music.sounding`);
  ok(await page.eval(`window.__app.music.source`) === 'sintetizado', 'si el archivo del tema falta, suena la versión sintetizada');
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.music.current === 'menu'`);
  ok(true, 'al acabar el combate vuelve el tema del menú (sin fanfarria ni melodía de derrota)');
  await page.waitFor(`window.__app.ui.view === 'results'`);
  await page.waitFor(`window.__app.music.sounding`);
  ok(await page.eval(`window.__app.music.current`) === 'menu' && await page.eval(`window.__app.music.source`) === 'archivo', 'y en los resultados sigue sonando la grabación del menú');

  await page.eval(`window.__app.ui.show('settings'); true`);
  await page.waitFor(`document.querySelector('.music-panel input[type=range]')`);
  await page.type('.music-panel input[type=range]', '0');
  await page.waitFor(`window.__app.music.volume === 0`);
  ok(await page.eval(`localStorage.getItem('arena.music')`) === '0' && /Sin música/.test(await page.eval(`document.querySelector('.music-panel button').textContent`)),
    'bajar el volumen a 0 la silencia y se recuerda');
  await page.click('.music-panel button');
  await page.waitFor(`window.__app.music.volume > 0 && window.__app.music.running && window.__app.music.sounding`);
  ok(await page.eval(`+localStorage.getItem('arena.music')`) > 0, '«Sin música» la vuelve a encender');
  await page.reload();
  ok(await page.eval(`window.__app.music.volume`) > 0 && await page.eval(`window.__app.music.volume`) === await page.eval(`+localStorage.getItem('arena.music')`), 'el volumen se mantiene al recargar');

  // El Alto Mando y el Campeón suenan con el tema largo del Campeón (6 min: no se repite en un combate de 3)
  const tracks = await page.eval(`import('/js/music.js').then(m => { const by = k => Object.values(Data.NODES).find(n => n.kind === k);
    return ['elite', 'champion', 'gym'].map(k => m.trackForBattle({ mode: 'trainer', map: by(k).map }, Data)); })`);
  ok(tracks.join() === 'champion,champion,leader', `el Alto Mando y el Campeón usan el tema del Campeón; los gimnasios, el de los líderes (${tracks.join(', ')})`);
  // El de los líderes (menos de un minuto) enlaza con el de combate en vez de volver a empezar
  await page.realClick('body');
  await page.eval(`window.__app.music.play('leader'); true`);
  await page.waitFor(`window.__app.music.file && window.__app.music.file.name === 'leader' && window.__app.music.file.list.length === 2`, 20000);
  ok(true, 'el tema de los líderes, al acabar, enlaza con el de combate (no vuelve a empezar a medias)');
};
