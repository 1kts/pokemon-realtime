// Motes (2): un Pokémon con mote lo lleva en combate, y «Quitar mote» en Mis Pokémon le devuelve el nombre de su
// especie. Ponerlo y cambiarlo, en motes.e2e.js
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'conmotes' });
  me.client.send({ t: 'dev', dex: 25, level: 12, region: 'kanto' });
  const prof = await me.client.wait(m => m.t === 'profile');
  const uid = prof.p.mons.find(m => m.dex === 25).uid;
  // (el mote, ya puesto: ponerlo por la interfaz es lo que prueba motes.e2e.js)
  me.client.send({ t: 'story', a: 'nick', uid, nick: '<b>Rayo</b>' });
  await me.client.wait(m => m.t === 'profile' && m.p.mons.some(x => x.uid === uid && x.nick === '<b>Rayo</b>'));
  await page.loginAs(me.token);

  // En combate su Pokémon lleva el mote (explorando la Ruta 1)
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.click('.sp-route[title^="Ruta 1 ·"], .sp-route[data-tip^="Ruta 1 ·"]');
  await page.tap('Explorar', { in: '.story-side' });
  await page.waitFor(`window.__app.battle && document.querySelector('.tinfo')`, 20000);
  ok(await page.see('<b>Rayo</b>', { in: '.hud, #hud' }), `en combate se ve con su mote`);
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.tap('Continuar');

  // Quitarlo: vuelve a llamarse como su especie
  await page.tap('Volver');
  await page.tap('Mis Pokémon');
  await page.click(await page.within('<b>Rayo</b>', '.mon-card'));
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.click('.ms-acts button:nth-child(2)');
  await page.waitFor(`document.querySelector('.nick-modal')`);
  await page.click('Quitar mote');
  await page.waitFor(`[...document.querySelectorAll('.mon-card .mon-name')].some(x => x.textContent.trim() === 'Pikachu')`).catch(() => {});
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  ok(await page.see('Pikachu', { in: '.mon-card .mon-name' }) && !(await page.see('<b>Rayo</b>', { ms: 0 })), '«Quitar mote» lo deja con el nombre de la especie');
};
