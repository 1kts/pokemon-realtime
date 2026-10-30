// Rutas de la Historia: la ficha de cada ruta enseña las 4 especies de esta tanda de 6 horas (con su
// probabilidad), su especial en silueta hasta que lo atrapas (en el Bosque Verde, Pikachu), cuándo cambian
// y, plegado, todo lo que puede salir allí. El viaje se ve en el mapa o, paso a paso, en una lista
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rutera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  // (Historia abre en el Camino: lo que se prueba aquí es el mapa)
  await page.tap(/^Historia/);
  await page.tap('Mapa', { in: '.story-mode' });
  await page.waitFor(`[...document.querySelectorAll('.node.route')].some(b => /Bosque Verde/.test(b.textContent))`);
  await page.click(await page.eval(`(() => { const n = [...document.querySelectorAll('.node.route')].find(b => /Bosque Verde/.test(b.textContent)); n.id = n.id || 'ruta-e2e'; return '#' + n.id; })()`));
  await page.waitFor(`document.querySelector('.route-list')`);
  ok(await page.eval(`document.querySelectorAll('.route-list .mini').length === 4 && !!document.querySelector('.rotation.short')`), 'la ficha del Bosque Verde enseña las 4 especies de esta tanda y cuándo cambian');
  ok(await page.eval(`document.querySelectorAll('.route-sp .mini.rare').length === 1 && /\\?\\?\\?/.test(document.querySelector('.route-sp').textContent)`), 'y su especial aparte, en silueta');
  ok(await page.eval(`document.querySelectorAll('.route-all .ra').length === Data.NODES['k-ruta2'].wild.length + 1 && /Pueden salir aquí \\(8\\)/.test(document.querySelector('.route-all summary').textContent)`), 'plegado, todo lo que puede salir allí: sus 7 especies y Pikachu');

  // Mapa o lista: la lista ordena el viaje (rutas y líderes) y resalta lo que toca
  await page.tap('Lista', { in: '.story-mode' });
  await page.waitFor(`document.querySelector('.story-list .sl-step')`);
  ok(await page.eval(`(() => { const s = [...document.querySelectorAll('.sl-step')]; const brock = s.findIndex(x => /Brock/.test(x.textContent)); return brock > 0 && s.slice(0, brock).every(x => x.classList.contains('route')) && s[brock].classList.contains('now') && !!document.querySelector('.sl-step.locked'); })()`), 'en Lista, el viaje paso a paso: las primeras rutas, luego Brock (lo que toca) y lo bloqueado al final');
  await page.tap(/Brock/, { in: '.story-list' });
  await page.waitSee('Brock', { in: '.node-info' });
  ok(true, 'cada paso de la lista abre su ficha (Brock)');
  await page.tap('Mapa', { in: '.story-mode' });
  ok(await page.waitFor(`document.querySelector('.map.focus .node.gym .ord')`).then(() => true, () => false), 'y se puede volver al mapa, con el orden de los gimnasios numerado');
};
