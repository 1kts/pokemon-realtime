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
  ok(await page.eval(`!window.__app.ui.profile && window.__app.ui.view === 'title'`), 'un nombre de entrenador ofensivo no entra: avisa y sigue en la portada');
  await page.waitFor(`document.querySelector('.title-panel button.primary') && !document.querySelector('.title-panel button.primary').disabled`);
  await page.type('.title-panel input', 'Ash');
  await page.click('Jugar');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`window.__app.ui.profile.name === 'Ash'`), 'con otro nombre entra');

  const me = await player({ user: 'conmotes' });
  me.client.send({ t: 'dev', dex: 25, level: 12, region: 'kanto' });
  const prof = await me.client.wait(m => m.t === 'profile');
  const uid = prof.p.mons.find(m => m.dex === 25).uid;
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // Resultados de una captura (Pikachu recién atrapado): el campo del mote, opcional
  await page.eval(`window.__app.ui.results({ winner: 0, you: 0, captured: { dex: 25, level: 12, shiny: false }, reward: { won: true, captured: { uid: ${uid}, dex: 25, level: 12, inTeam: true } } }); true`);
  await page.waitFor(`document.querySelector('.results .nick-form input')`);
  ok(await page.eval(`document.querySelector('.nick-form input').placeholder === 'Pikachu' && document.querySelector('.nick-form input').maxLength === 12`),
    'al capturarlo pregunta por un mote, con el nombre de la especie de ejemplo y 12 caracteres como mucho');
  await page.type('.nick-form input', 'M1erda');
  await page.click('.nick-form button');
  await page.waitFor(`[...document.querySelectorAll('.toast')].some(x => x.textContent.includes('mote no está permitido'))`);
  ok(await page.eval(`!window.__app.ui.profile.mons.find(m => m.uid === ${uid}).nick && !document.querySelector('.nick-form button.saved')`), 'un mote ofensivo no se guarda y avisa');
  await page.type('.nick-form input', 'Chispitas');
  await page.click('.nick-form button');
  await page.waitFor(`document.querySelector('.nick-form button.saved')`);
  ok(await page.eval(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).nick === 'Chispitas'`), 'con un mote normal: «Mote guardado»');

  // Mis Pokémon: el mote en la tarjeta (con la especie al lado) y el botón para cambiarlo
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card')`);
  const card = `[...document.querySelectorAll('.mon-card')].find(c => c.querySelector('.mon-name').textContent.includes('Chispitas'))`;
  ok(await page.eval(`!!${card} && ${card}.querySelector('.species').textContent === 'Pikachu'`), 'en Mis Pokémon sale con su mote y la especie al lado');
  await page.eval(`${card}.querySelector('.mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.click('.ms-acts button:nth-child(2)');
  await page.waitFor(`document.querySelector('.nick-modal input')`);
  ok(await page.eval(`document.querySelector('.nick-modal input').value === 'Chispitas'`), '«Mote» abre el cambio con el mote actual');
  await page.type('.nick-modal input', '<b>Rayo</b>');
  await page.click('.nick-modal button.primary');
  await page.waitFor(`window.__app.ui.profile.mons.find(m => m.uid === ${uid}).nick === '<b>Rayo</b>'`);
  await page.waitFor(`[...document.querySelectorAll('.mon-card .mon-name')].some(x => x.textContent.includes('<b>Rayo</b>'))`);
  ok(await page.eval(`!document.querySelector('.mon-card .mon-name b')`), 'cambiarlo: el mote se ve tal cual lo escribió, sin colar HTML');

  // En combate su Pokémon lleva el mote
  await page.eval(`window.__app.ui.startStory('route', 'k-ruta1'); true`);
  await page.waitFor(`window.__app.battle && document.querySelector('.tinfo')`);
  const hud = await page.eval(`[...document.querySelectorAll('.tinfo b')].map(b => b.textContent).join(' / ')`);
  ok(hud.includes('<b>Rayo</b>'), `en combate se ve con su mote (${hud})`);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.ui.view === 'results'`);

  // Quitarlo: vuelve a llamarse como su especie
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card .mon-name')`);
  await page.eval(`document.querySelector('.mon-card .mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.click('.ms-acts button:nth-child(2)');
  await page.waitFor(`document.querySelector('.nick-modal')`);
  await page.click('Quitar mote');
  await page.waitFor(`!window.__app.ui.profile.mons.find(m => m.uid === ${uid}).nick`);
  await page.waitFor(`[...document.querySelectorAll('.mon-card .mon-name')].some(x => x.textContent.trim() === 'Pikachu')`);
  ok(true, '«Quitar mote» lo deja con el nombre de la especie');
};
