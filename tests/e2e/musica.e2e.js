// Música: suena tras tocar la página y las pantallas del menú comparten su tema sin cortarlo. Los combates, al acabar
// vuelve el del menú, y volumen/silencio en Ajustes que se recuerda: musica-combate.e2e.js
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.current === 'menu' && !window.__app.music.running`), 'la portada pide el tema del menú, pero no suena hasta tocar la página');

  await page.type('.title-panel input', 'Melómano');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`window.__app.music.running && window.__app.music.sounding`);
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.source`) === 'archivo', 'al tocar la página suena la grabación del menú (public/music/pueblo.mp3, de jannetty)');
  // Fuera de combate, al de jannetty le siguen tres de HydroGene, en su orden (por la duración de cada uno)
  await page.waitFor(`window.__app.music.file && window.__app.music.file.list.filter(Boolean).length === 4`, 20000);
  const menuDurs = await page.eval(`window.__app.music.file.list.map(b => Math.round(b.duration))`);
  ok(menuDurs.length === 4 && Math.abs(menuDurs[0] - 41) < 3 && Math.abs(menuDurs[1] - 86) < 3 && Math.abs(menuDurs[2] - 65) < 3 && Math.abs(menuDurs[3] - 119) < 3,
    `el tema del menú enlaza con «Peaceful Village», «Lively City» y «Wood Forest Town» (${menuDurs.join(', ')} s)`);

  // Fuera de combate suena siempre el mismo tema: moverse por los menús no la corta
  const starts0 = await page.eval(`window.__app.music.starts`);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de Historia, ya vista)
  for (const b of [/^Historia/, 'Mis Pokémon', /^Tienda/, /^Pokédex/, 'Ajustes']) { await page.tap(b); await page.waitFor(`document.querySelector('.inner-bar')`); await page.tap('Volver'); await page.waitSee('Aventura'); }
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.current`) === 'menu', 'mapa, equipo, tienda, Pokédex y ajustes usan el mismo tema que el menú');
  // atajo: la música no se ve: se mira qué tema pide el juego y de dónde suena
  ok(await page.eval(`window.__app.music.starts`) === starts0 && await page.eval(`window.__app.music.sounding`), 'y sigue sonando sin reiniciarse al pasar de uno a otro');
  // (los combates, los resultados y el volumen: musica-combate.e2e.js; juntas pasaban de los 5 minutos del CI)
};
