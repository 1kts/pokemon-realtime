// Rutas de la Historia: la ficha de cada ruta enseña las 4 especies de esta tanda de 6 horas (con su
// probabilidad), su especial en silueta hasta que lo atrapas (en el Bosque Verde, Pikachu), cuándo cambian
// y, plegado, todo lo que puede salir allí
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rutera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`[...document.querySelectorAll('.node.route')].some(b => /Bosque Verde/.test(b.textContent))`);
  await page.eval(`[...document.querySelectorAll('.node.route')].find(b => /Bosque Verde/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.route-list')`);
  ok(await page.eval(`document.querySelectorAll('.route-list .mini').length === 4 && !!document.querySelector('.rotation.short')`), 'la ficha del Bosque Verde enseña las 4 especies de esta tanda y cuándo cambian');
  ok(await page.eval(`document.querySelectorAll('.route-sp .mini.rare').length === 1 && /\\?\\?\\?/.test(document.querySelector('.route-sp').textContent)`), 'y su especial aparte, en silueta');
  ok(await page.eval(`document.querySelectorAll('.route-all .ra').length === Data.NODES['k-ruta2'].wild.length + 1 && /Pueden salir aquí \\(8\\)/.test(document.querySelector('.route-all summary').textContent)`), 'plegado, todo lo que puede salir allí: sus 7 especies y Pikachu');
};
