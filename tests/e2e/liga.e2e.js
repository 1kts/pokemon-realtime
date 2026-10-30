// Liga Pokémon: con las 8 medallas, el Alto Mando y el Campeón se juegan seguidos. En el mapa es un edificio que
// abre su pantalla (los 5 entrenadores en orden y el botón del desafío); si pierdes uno, vuelves al primero
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'ligera' });
  me.client.send({ t: 'dev', dex: 6, level: 55, region: 'kanto', badges: 8 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); localStorage.removeItem('arena.storyMode'); true`);   // (la guía, ya vista)
  // (Historia abre en el Camino: lo que se prueba aquí es el mapa)
  await page.tap(/^Historia/);
  await page.tap('Mapa', { in: '.story-mode' });
  await page.waitFor(`document.querySelector('.map .node.league-hq')`);
  ok(await page.eval(`!document.querySelector('.node.elite, .node.champion') && !document.querySelector('.node.league-hq.locked')`), 'en el mapa, la Liga es un solo edificio, abierto con las 8 medallas');
  await page.click('.node.league-hq');
  await page.waitFor(`document.querySelectorAll('.lv-step').length === 5`);
  ok(await page.title() === 'Liga Pokémon' && await page.eval(`!!document.querySelector('.lv-step.now') && !!document.querySelector('.lv-step.champ')`) && await page.see('Empezar el desafío'), 'al entrar se ven los 5 entrenadores en orden, el que toca y el botón de empezar');
  await page.tap(/Empezar el desafío/);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 15000);
  // Rendirse con Esc (la tecla de verdad) y «Rendirse»
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Vuelves a empezar desde', { ms: 15000, scroll: true });
  ok(true, 'si pierdes, los resultados dicen que vuelves a empezar desde el primero');
};
