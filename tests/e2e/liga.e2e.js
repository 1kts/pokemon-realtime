// Liga Pokémon: con las 8 medallas, el Alto Mando y el Campeón se juegan seguidos. En el mapa es un edificio que
// abre su pantalla (los 5 entrenadores en orden y el botón del desafío); si pierdes uno, vuelves al primero
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'ligera' });
  me.client.send({ t: 'dev', dex: 6, level: 55, region: 'kanto', badges: 8 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); localStorage.removeItem('arena.storyMode'); window.__app.ui.show('story'); true`);
  // (Historia abre en el Camino: lo que se prueba aquí es el mapa; la vista elegida se recuerda)
  await page.waitFor(`document.querySelector('.story-mode')`); await page.eval(`localStorage.setItem('arena.storyGuide', '1'); document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.map .node.league-hq')`);
  ok(await page.eval(`!document.querySelector('.node.elite, .node.champion') && !document.querySelector('.node.league-hq.locked')`), 'en el mapa, la Liga es un solo edificio, abierto con las 8 medallas');
  await page.eval(`document.querySelector('.node.league-hq').click(); true`);
  await page.waitFor(`window.__app.ui.view === 'league' && document.querySelectorAll('.lv-step').length === 5`);
  ok(await page.eval(`!!document.querySelector('.lv-step.now') && !!document.querySelector('.lv-step.champ') && /Empezar el desafío/.test(document.querySelector('.lv-go').textContent)`), 'al entrar se ven los 5 entrenadores en orden, el que toca y el botón de empezar');
  await page.eval(`document.querySelector('.lv-go').click(); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 15000);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`document.querySelector('.league-res.failed')`, 15000);
  ok(await page.eval(`/Vuelves a empezar desde/.test(document.querySelector('.league-res').textContent)`), 'si pierdes, los resultados dicen que vuelves a empezar desde el primero');
};
