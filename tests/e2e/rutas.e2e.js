// Rutas de la Historia: la ficha de cada ruta enseña todas las especies que salen en ella en los juegos (con su
// probabilidad) y, aparte, sus especiales en silueta hasta que los atrapas (en el Bosque Verde, Pikachu)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rutera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`[...document.querySelectorAll('.node.route')].some(b => /Bosque Verde/.test(b.textContent))`);
  await page.eval(`[...document.querySelectorAll('.node.route')].find(b => /Bosque Verde/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.route-list')`);
  ok(await page.eval(`document.querySelectorAll('.route-list .mini').length === Data.NODES['k-ruta2'].wild.length && /Caterpie/.test(document.querySelector('.route-list').textContent)`), 'la ficha del Bosque Verde enseña sus 7 especies reales');
  ok(await page.eval(`document.querySelectorAll('.route-sp .mini.rare').length === 1 && /\\?\\?\\?/.test(document.querySelector('.route-sp').textContent) && !document.querySelector('.rotation')`), 'y su especial aparte, en silueta, sin cuenta atrás diaria');
};
