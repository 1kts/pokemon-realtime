// Motes: ponerle uno al capturar, cambiarlo y quitarlo en Mis Pokémon, verlo en combate, y el filtro de
// nombres ofensivos (mote y nombre de entrenador)
module.exports = async ({ page, player, ok }) => {
  // En la portada, un nombre de entrenador ofensivo no entra y se puede probar con otro
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  await page.type('.title-panel input', 'P.u.t.4');
  await page.click('Jugar');
  await page.waitFor(`[...document.querySelectorAll('.toast')].some(x => x.textContent.includes('no está permitido'))`);
  ok(await page.see('Jugar', { in: '.title-panel' }) && !(await page.see('Aventura', { ms: 0 })), 'un nombre de entrenador ofensivo no entra: avisa y sigue en la portada');
  await page.waitFor(`document.querySelector('.title-panel button.primary') && !document.querySelector('.title-panel button.primary').disabled`);
  await page.type('.title-panel input', 'Ash');
  await page.click('Jugar');
  await page.waitSee('Aventura');
  ok(await page.see('Ash', { in: '.hub-me' }), 'con otro nombre entra');

  const me = await player({ user: 'conmotes' });
  me.client.send({ t: 'dev', dex: 25, level: 12, region: 'kanto' });
  const prof = await me.client.wait(m => m.t === 'profile');
  const uid = prof.p.mons.find(m => m.dex === 25).uid;
  await page.loginAs(me.token);

  // Resultados de una captura (Pikachu recién atrapado): el campo del mote, opcional
  // atajo: atrapar uno de verdad depende de la suerte de la Poké Ball; se pintan los resultados de esa captura
  await page.eval(`window.__app.ui.results({ winner: 0, you: 0, captured: { dex: 25, level: 12, shiny: false }, reward: { won: true, captured: { uid: ${uid}, dex: 25, level: 12, inTeam: true } } }); true`);
  await page.waitFor(`document.querySelector('.results .nick-form input')`);
  ok(await page.eval(`document.querySelector('.nick-form input').placeholder === 'Pikachu' && document.querySelector('.nick-form input').maxLength === 12`),
    'al capturarlo pregunta por un mote, con el nombre de la especie de ejemplo y 12 caracteres como mucho');
  await page.type('.nick-form input', 'M1erda');
  await page.click('.nick-form button');
  await page.waitSee('mote no está permitido', { in: '#toasts' });
  ok(!(await page.see('Mote guardado', { ms: 0 })), 'un mote ofensivo no se guarda y avisa');
  await page.type('.nick-form input', 'Chispitas');
  await page.click('.nick-form button');
  await page.waitSee('Mote guardado');
  ok(true, 'con un mote normal: «Mote guardado»');

  // Mis Pokémon: el mote en la tarjeta (con la especie al lado) y el botón para cambiarlo
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.waitFor(`document.querySelector('.mon-card')`);
  const card = `[...document.querySelectorAll('.mon-card')].find(c => c.querySelector('.mon-name').textContent.includes('Chispitas'))`;
  ok(await page.eval(`!!${card} && ${card}.querySelector('.species').textContent === 'Pikachu'`), 'en Mis Pokémon sale con su mote y la especie al lado');
  await page.click(await page.within('Chispitas', '.mon-card'));
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.click('.ms-acts button:nth-child(2)');
  await page.waitFor(`document.querySelector('.nick-modal input')`);
  ok(await page.eval(`document.querySelector('.nick-modal input').value === 'Chispitas'`), '«Mote» abre el cambio con el mote actual');
  await page.type('.nick-modal input', '<b>Rayo</b>');
  await page.click('.nick-modal button.primary');
  await page.waitFor(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).nick === '<b>Rayo</b>'`);
  await page.waitFor(`[...document.querySelectorAll('.mon-card .mon-name')].some(x => x.textContent.includes('<b>Rayo</b>'))`);
  ok(await page.eval(`!document.querySelector('.mon-card .mon-name b')`), 'cambiarlo: el mote se ve tal cual lo escribió, sin colar HTML');

  // En combate su Pokémon lleva el mote (explorando la Ruta 1)
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  await page.tap('Volver');
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
