// Logros (antes Maestría): con victorias de una línea evolutiva, sus retos salen para recoger (aviso en el
// menú) y se recogen con la animación de premio. Logros enseña lo que tienes y cómo se consigue lo demás,
// pero no equipa: el glow se pone en el Perfil y la skin en la ficha del Pokémon. Los retos generales van
// por categorías y los marcos de tipo salen de debilitar con movimientos de ese tipo
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'maestria' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', mastery: { dex: 6, wins: 500 } });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`+document.querySelector('.coll-tile.wide.ready .nbadge').textContent >= 5`), 'el menú avisa de los premios de Logros por recoger');

  await page.click('.coll-tile.wide');
  await page.waitFor(`window.__app.ui.view === 'collection'`);
  ok(await page.eval(`document.querySelectorAll('.lg-card.ready .lg-row.ready').length`) === 6, 'la línea de Charmander tiene 6 retos listos (10, 25, 50, 100, 150 y 500 victorias)');
  ok(await page.eval(`document.querySelectorAll('.lg-card .lg-row').length >= 8 && /online/.test(document.querySelector('.lg-row.k-skin:nth-last-child(2) small').textContent)`), 'Holo pide victorias online y Galaxia la Torre, con su progreso');
  // Se recogen uno a uno, cada uno con su animación
  for (let i = 0; i < 6; i++) {
    await page.eval(`document.querySelector('.lg-row.ready .claim-btn').click(); true`);
    await page.waitFor(`document.querySelector('.loot-pop')`);
    await page.waitFor(`(window.__app.ui.profile.masteryClaimed[4] || []).length === ${i + 1}`);
    await page.eval(`document.querySelector('.loot-pop .acts .primary').click(); true`);
    await page.waitFor(`!document.querySelector('.loot-pop')`);
  }
  const p = `window.__app.ui.profile`;
  ok(await page.eval(`${p}.cosmetics.auras.includes('tipo-fuego') && ${p}.cosmetics.titles.includes('Maestro de Charmander') && ${p}.cosmetics.avatars.includes('pt:4') && !document.querySelector('.lg-row.ready')`), 'recogidos: glow de fuego, retrato, título de maestro y ya no queda nada por recoger');

  // Retos: por categorías, con los de debilitar por tipo en Combate
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Retos')).click(); true`);
  await page.waitFor(`document.querySelector('.retos-grid')`);
  await page.eval(`[...document.querySelectorAll('.coll-cats button')].find(b => b.textContent.startsWith('Combate')).click(); true`);
  await page.waitFor(`document.querySelectorAll('.retos-grid .ach-card').length === Data.TYPE_NAMES.length`);
  ok(await page.eval(`/Debilita 100 Pokémon con movimientos de tipo Fuego/.test(document.querySelector('.retos-grid').textContent)`), 'en Retos › Combate están los de debilitar con cada tipo, con su marco de premio');

  // Glows: Logros solo enseña (sin botones); se pone en el Perfil
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Glows')).click(); true`);
  await page.waitFor(`document.querySelector('.aura-grid')`);
  ok(await page.eval(`document.querySelectorAll('.aura-grid .coll-item.own').length === 1 && !document.querySelector('.aura-grid button') && /Perfil/.test(document.querySelector('.coll-where').textContent)`), 'en Logros › Glows sale el de fuego como tuyo, sin equiparlo desde ahí');
  ok(await page.eval(`[...document.querySelectorAll('.aura-grid .coll-item.locked em')].some(e => /Campeón de Kanto/.test(e.textContent))`), 'los glows especiales dicen de qué reto salen');
  // Marcos: todos, con de dónde sale cada uno
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Marcos')).click(); true`);
  await page.waitFor(`document.querySelector('.frames-grid')`);
  ok(await page.eval(`[...document.querySelectorAll('.frames-grid .frame-item.locked em')].some(e => /Especialista en Fuego/.test(e.textContent))`), 'en Marcos se ve el de Fuego bloqueado, con el reto que lo da');

  // Desde el Perfil: el glow de fuego
  await page.eval(`window.__app.ui.show('profile'); true`);
  await page.waitFor(`document.querySelector('.look .frame-opt')`);
  await page.eval(`[...document.querySelectorAll('.look .frame-opt')].find(b => /Glow Fuego/.test(b.textContent)).click(); true`);
  await page.waitFor(`${p}.aura === 'tipo-fuego'`);
  ok(await page.eval(`!!window.__app.ui.meModule().querySelector('.hub-ava .ava-aura.aura-tipo')`), 'el glow de fuego, puesto en el Perfil, sale alrededor del avatar de arriba');

  // Skin Edición Oro: en la ficha del Pokémon
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card .mon-name')`);
  await page.eval(`document.querySelector('.mon-card .mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.eval(`[...document.querySelectorAll('.ms-tab')].find(b => /Aspecto/.test(b.textContent)).click(); true`);
  await page.waitFor(`[...document.querySelectorAll('.ms-chip')].some(b => /Oro/.test(b.textContent))`);
  await page.eval(`[...document.querySelectorAll('.ms-chip')].find(b => /Oro/.test(b.textContent)).click(); true`);
  await page.waitFor(`${p}.skins[4] === 'oro'`);
  ok(true, 'la skin Oro se pone a la línea de Charmander desde su ficha');
  await page.eval(`window.__app.ui.closeSheet(); window.__app.ui.show('menu'); true`);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`!!document.querySelector('.menu-card.story .art.skin-oro')`), 'y se ve en la tarjeta de Historia con tu Charmander');

  // En combate: el sprite lleva la skin (práctica con Charizard, de la misma línea)
  await page.eval(`window.__app.net.send({ t: 'practice', dexes: [6], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.actors && window.__app.battle.actors[0]`, 15000);
  ok(await page.eval(`window.__app.battle.actors[0].skinU.uSkin.value === 1 && window.__app.battle.actors[1].skinU.uSkin.value === 0`), 'en combate, tu Charizard lleva la skin Oro y el rival no');
};
