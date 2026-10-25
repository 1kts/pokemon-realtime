// Mapa de Historia: medallas en los gimnasios (en color las conseguidas), «Estás aquí» en la ciudad del
// último líder vencido, líneas hacia las rutas nuevas y el siguiente líder, y caminos sin línea discontinua
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mapa' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.you-pin')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);   // la guía de la primera vez

  ok(await page.eval(`document.querySelectorAll('.node.gym.done .node-badge.got').length`) === 3, 'las 3 medallas conseguidas salen en color en sus gimnasios');
  ok(await page.eval(`document.querySelectorAll('.node.gym:not(.done) .node-badge:not(.got)').length`) === 5, 'las otras 5, sin conseguir');
  ok(await page.eval(`document.querySelector('.node.gym.next')?.title.includes('Erika')`), 'el siguiente reto es Erika');
  // Estás aquí: en Ciudad Carmín (Lt. Surge, el último vencido)
  const [px, sx] = await page.eval(`[document.querySelector('.you-pin').style.left, document.querySelector('.node.gym.done[title*="Surge"]').style.left]`);
  ok(px === sx, '«Estás aquí» está en la ciudad de Lt. Surge');
  const fresh = await page.eval(`document.querySelectorAll('.node.route.new').length`);
  ok(fresh === 2 && await page.eval(`document.querySelectorAll('.paths .leg').length`) === fresh + 1, 'una línea a cada ruta nueva y otra al siguiente líder');
  ok(await page.eval(`document.querySelectorAll('.mapart polyline').length`) > 0, 'las carreteras siguen dibujadas');
  ok(await page.eval(`document.querySelectorAll('.mapart [stroke-dasharray]').length`) === 0, 'sin línea discontinua en los caminos: solo las de a dónde puedes ir');
  ok(await page.eval(`document.querySelectorAll('.map-goal .goal-routes .chip').length`) === fresh, 'el objetivo lista las rutas nuevas');
};
