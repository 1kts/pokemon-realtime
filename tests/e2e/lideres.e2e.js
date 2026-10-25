// Líderes con su sprite: el Alto Mando y el Campeón se ven por su cara en el mapa de Historia, el panel de
// cada líder enseña su sprite, y al desafiarlo se presenta antes del combate y su cara queda en el marcador
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'lideres' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.node.champion')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);   // la guía de la primera vez

  // Caras cargadas (naturalWidth > 0: la imagen existe y se ha dibujado)
  await page.waitFor(`[...document.querySelectorAll('.node.elite .trainer-img, .node.champion .trainer-img')].every(i => i.complete && i.naturalWidth > 0)`);
  ok(await page.eval(`document.querySelectorAll('.node.elite .trainer-img').length`) === 4, 'el Alto Mando sale en el mapa con sus 4 caras');
  ok(await page.eval(`!!document.querySelector('.node.champion .trainer-img') && !!document.querySelector('.node.champion .crown')`), 'el Campeón con su cara y su corona');

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
