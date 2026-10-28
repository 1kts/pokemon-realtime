// Líderes con su sprite: el Alto Mando y el Campeón se ven por su cara en la pantalla de la Liga (en el mapa,
// su edificio), el panel de cada líder enseña su sprite, y al desafiarlo se presenta antes del combate y su cara queda en el marcador
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'lideres' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  // (Historia abre en el Camino: lo que se prueba aquí es el mapa; la vista elegida se recuerda)
  await page.waitFor(`document.querySelector('.story-mode')`); await page.eval(`localStorage.setItem('arena.storyGuide', '1'); document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.node.league-hq')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);   // la guía de la primera vez

  // La Liga: sus caras, en su pantalla (caras cargadas: naturalWidth > 0)
  await page.eval(`window.__app.ui.leagueRegion = 'kanto'; window.__app.ui.show('league'); true`);
  await page.waitFor(`document.querySelectorAll('.lv-step .lv-face').length === 5 && [...document.querySelectorAll('.lv-step .lv-face')].every(i => i.complete && i.naturalWidth > 0)`);
  ok(await page.eval(`document.querySelectorAll('.lv-step:not(.champ) .lv-face').length`) === 4, 'el Alto Mando sale en la Liga con sus 4 caras');
  ok(await page.eval(`!!document.querySelector('.lv-step.champ .lv-face') && /♛/.test(document.querySelector('.lv-step.champ .lv-n').textContent)`), 'el Campeón con su cara y su corona');
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.node.gym.next')`);

  await page.click('.node.gym.next');
  await page.waitFor(`document.querySelector('.leader-head .leader-sprite')?.naturalWidth > 0`);
  ok((await page.eval(`document.querySelector('.leader-head .leader-sprite').getAttribute('src')`)) === 'trainers/erika.png', 'el panel de Erika enseña su sprite');

  // Se espera directamente a lo que se comprueba (en un paso): la presentación dura poco y en una
  // máquina lenta, como la del CI, puede haber desaparecido entre «ya está» y «léela»
  await page.click('.node-info button.primary');
  await page.waitFor(`document.querySelector('.leader-intro b')?.textContent === 'Erika'`);
  ok(true, 'al desafiarla se presenta antes del combate');
  await page.waitFor(`!document.querySelector('.leader-intro') && !!document.querySelector('.tname .tname-face[src="trainers/erika.png"]')`);
  ok(true, 'su cara queda junto a su nombre en el marcador');
};
