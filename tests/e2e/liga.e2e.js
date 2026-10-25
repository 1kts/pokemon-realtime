// Liga Pokémon: con las 8 medallas, el Alto Mando y el Campeón se juegan seguidos. En el mapa van juntos en un
// recuadro, la ficha enseña los 5 y el botón del desafío; si pierdes uno, vuelves a empezar desde el primero
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'ligera' });
  me.client.send({ t: 'dev', dex: 6, level: 55, region: 'kanto', badges: 8 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); localStorage.removeItem('arena.storyMode'); window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.map .league-zone')`);
  ok(await page.eval(`/Liga Pokémon/.test(document.querySelector('.league-zone').textContent) && document.querySelectorAll('.node.elite:not(.locked), .node.champion:not(.locked)').length === 5`), 'en el mapa, la Liga va junta en un recuadro y se abre entera con las 8 medallas');
  await page.waitFor(`document.querySelector('.node-info .league-box')`);
  ok(await page.eval(`document.querySelectorAll('.league-box .lb-step').length === 5 && !!document.querySelector('.league-box .lb-step.now') && /Empezar el desafío/.test(document.querySelector('.league-box button').textContent)`), 'la ficha enseña los 5 combates y el botón de empezar el desafío');
  await page.eval(`document.querySelector('.league-box button').click(); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 15000);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`document.querySelector('.league-res.failed')`, 15000);
  ok(await page.eval(`/Vuelves a empezar desde/.test(document.querySelector('.league-res').textContent)`), 'si pierdes, los resultados dicen que vuelves a empezar desde el primero');
};
