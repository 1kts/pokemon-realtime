// Mapa de Historia: medallas en los gimnasios (en color las conseguidas), «Estás aquí» en la ciudad del
// último líder vencido, líneas hacia las rutas nuevas y el siguiente líder, el mapa en 3D y la Liga en su rascacielos
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mapa' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  // (Historia abre en el Camino: lo que se prueba aquí es el mapa; la vista elegida se recuerda)
  await page.tap(/^Historia/);
  await page.tap('Mapa', { in: '.story-mode' });
  await page.waitFor(`document.querySelector('.you-pin')`);

  ok(await page.eval(`document.querySelectorAll('.node.gym.done .node-badge.got').length`) === 3, 'las 3 medallas conseguidas salen en color en sus gimnasios');
  ok(await page.eval(`document.querySelectorAll('.node.gym:not(.done) .node-badge:not(.got)').length`) === 5, 'las otras 5, sin conseguir');
  ok(await page.eval(`document.querySelector('.node.gym.next')?.title.includes('Erika')`), 'el siguiente reto es Erika');
  // Estás aquí: en Ciudad Carmín (Lt. Surge, el último vencido)
  const [px, sx] = await page.eval(`[document.querySelector('.you-pin').style.left, document.querySelector('.node.gym.done[title*="Surge"]').style.left]`);
  ok(px === sx, '«Estás aquí» está en la ciudad de Lt. Surge');
  const fresh = await page.eval(`document.querySelectorAll('.node.route.new').length`);
  ok(fresh === 2 && await page.eval(`document.querySelectorAll('.paths .leg').length`) === fresh + 1, 'una línea a cada ruta nueva y otra al siguiente líder');
  // El mapa es la maqueta 3D (el navegador de las pruebas tiene WebGL por software): sale sin pasar por el SVG
  await page.waitFor(`document.querySelector('.map.map3d-on .map3d-canvas')`, 60000);
  // (si la maqueta tarda más de 4 s, como en un CI cargado, se ve el SVG mientras tanto; ya con el 3D, queda oculto)
  ok(await page.eval(`(() => { const s = document.querySelector('.mapart'); return !s || getComputedStyle(s).visibility === 'hidden'; })()`), 'con el 3D no se ve el mapa SVG');
  ok(await page.eval(`(() => { const c = document.querySelector('.map3d-canvas'); return c.width > 100 && c.height > 100; })()`), 'el lienzo 3D ocupa el mapa');
  // La Liga: su nodo queda encima del rascacielos, transparente y del tamaño del edificio, y se puede pulsar
  ok(await page.eval(`(() => { const b = document.querySelector('.node.league-hq').getBoundingClientRect(); return b.height > b.width && b.width > 10; })()`), 'el nodo de la Liga cubre su rascacielos');
  // Volver a Historia: la maqueta ya está montada y sale al instante
  await page.tap('Volver');
  await page.tap(/^Historia/);
  ok(await page.eval(`!!document.querySelector('.map.map3d-on') && !document.querySelector('.mapart')`), 'al volver, el mapa 3D sale ya montado, sin pasar por el SVG');
  ok(await page.eval(`document.querySelectorAll('.map-goal .goal-routes .chip').length`) === fresh, 'el objetivo lista las rutas nuevas');
  await page.click('.node.league-hq');
  await page.waitSee('Liga Pokémon');
  ok(await page.title() === 'Liga Pokémon', 'el edificio de la Liga se puede pulsar y abre su pantalla');
};
