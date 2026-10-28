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
  ok(await page.eval(`document.querySelectorAll('.lg-card.ready .lg-row.ready').length`) === 5, 'la línea de Charmander tiene 5 retos listos (10, 50, 100, 200 y 500 victorias)');
  ok(await page.eval(`(() => { const asks = [...document.querySelectorAll('.lg-card .lg-row.k-skin small')].map(s => s.textContent); return document.querySelectorAll('.lg-card .lg-row').length >= 7 && asks.some(x => /online/.test(x)) && asks.some(x => /Torre/.test(x)); })()`), 'Holo pide victorias online y Galaxia la Torre, con su progreso');
  // Se recogen uno a uno, cada uno con su animación
  for (let i = 0; i < 5; i++) {
    await page.eval(`document.querySelector('.lg-row.ready .claim-btn').click(); true`);
    await page.waitFor(`document.querySelector('.loot-pop')`);
    await page.waitFor(`(window.__app.ui.profile.masteryClaimed[4] || []).length === ${i + 1}`);
    await page.eval(`document.querySelector('.loot-pop .acts .primary').click(); true`);
    await page.waitFor(`!document.querySelector('.loot-pop')`);
  }
  const p = `window.__app.ui.profile`;
  ok(await page.eval(`${p}.items.caramelo >= 1 && ${p}.cosmetics.titles.includes('Maestro de Charmander') && ${p}.cosmetics.avatars.includes('pt:4') && !document.querySelector('.lg-row.ready')`), 'recogidos: Caramelo Raro, retrato, título de maestro y ya no queda nada por recoger');

  // Retos: por categorías, con los de debilitar por tipo en Combate
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Retos')).click(); true`);
  await page.waitFor(`document.querySelector('.retos-grid')`);
  await page.eval(`[...document.querySelectorAll('.coll-cats button')].find(b => b.textContent.startsWith('Combate')).click(); true`);
  await page.waitFor(`document.querySelectorAll('.retos-grid .ach-card').length === Data.TYPE_NAMES.length`);
  ok(await page.eval(`/Debilita 100 Pokémon con movimientos de tipo Fuego/.test(document.querySelector('.retos-grid').textContent)`), 'en Retos › Combate están los de debilitar con cada tipo, con su marco de premio');

  // Glows: Logros solo enseña (sin botones); se pone en el Perfil. El de fuego, como si saliera del cofre semanal
  me.client.send({ t: 'dev', aura: 'tipo-fuego' }); await me.client.wait(m => m.t === 'profile');
  await page.eval(`window.__app.net.send({ t: 'mission', a: 'refresh' }); true`);
  await page.waitFor(`window.__app.ui.profile.cosmetics.auras.includes('tipo-fuego')`);
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Glows')).click(); true`);
  await page.waitFor(`document.querySelector('.aura-grid')`);
  ok(await page.eval(`document.querySelectorAll('.aura-grid .coll-item.own').length === 1 && !document.querySelector('.aura-grid button') && /Perfil/.test(document.querySelector('.coll-where').textContent)`), 'en Logros › Glows sale el de fuego como tuyo, sin equiparlo desde ahí');
  ok(await page.eval(`[...document.querySelectorAll('.aura-grid .coll-item.locked em')].some(e => /Campeón de Kanto/.test(e.textContent))`), 'los glows especiales dicen de qué reto salen');
  // Marcos: todos, con de dónde sale cada uno
  await page.eval(`[...document.querySelectorAll('.coll-tab')].find(b => b.textContent.startsWith('Marcos')).click(); true`);
  await page.waitFor(`document.querySelector('.frames-grid')`);
  ok(await page.eval(`[...document.querySelectorAll('.frames-grid .frame-item.locked')].some(b => /Marco Fuego/.test(b.textContent) && /Próximamente/.test(b.textContent))`), 'en Marcos se ve el de Fuego bloqueado, para más adelante');

  // Desde el Perfil: el glow de fuego
  await page.eval(`window.__app.ui.show('profile'); true`);
  await page.waitFor(`document.querySelector('.trainer-card .tc-edit')`);
  await page.eval(`document.querySelector('.trainer-card .tc-edit').click(); true`);
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.eval(`[...document.querySelectorAll('.ava-edit .ae-tabs button')].find(b => b.textContent === 'Glow').click(); true`);
  await page.waitFor(`[...document.querySelectorAll('.ava-edit .frame-opt')].some(b => /Glow Fuego/.test(b.textContent))`);
  await page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt')].find(b => /Glow Fuego/.test(b.textContent)).click(); true`);
  await page.waitFor(`${p}.aura === 'tipo-fuego'`);
  ok(await page.eval(`!!window.__app.ui.meModule().querySelector('.hub-ava .ava-aura.aura-tipo')`), 'el glow de fuego, puesto desde el editor del Perfil, sale alrededor del avatar de arriba');
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);

  // Skin Edición Oro: en la ficha del Pokémon
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card .mon-name')`);
  await page.eval(`document.querySelector('.mon-card .mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.eval(`[...document.querySelectorAll('.ms-tab')].find(b => /Retos/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.ms-retos .lg-row')`);
  ok(await page.eval(`document.querySelectorAll('.ms-retos .lg-row.got').length === 5`), 'en la ficha, la pestaña Retos enseña los de su línea con lo ya recogido');
  await page.eval(`[...document.querySelectorAll('.ms-tab')].find(b => /Vestuario/.test(b.textContent)).click(); true`);
  await page.waitFor(`[...document.querySelectorAll('.ms-wear.skin')].some(b => /Oro/.test(b.textContent))`);
  // (con WebGL la skin la pinta el shader en el canvas, skinfx-* es su brillo; sin WebGL, el filtro CSS skin-*)
  ok(await page.eval(`!!document.querySelector('.ms-wear.skin canvas.skinfx-oro[data-fx], .ms-wear.skin canvas.skin-oro') && document.querySelectorAll('.ms-wear.skin.locked').length >= 2`), 'en Vestuario cada skin se ve sobre el Pokémon; las que no tienes, apagadas');
  ok(await page.eval(`(() => { const lk = [...document.querySelectorAll('.ms-wear.parts.locked')].filter(b => /Próximamente/.test(b.textContent));
    return lk.length === Data.TYPE_NAMES.length - 1 && lk.every(b => b.disabled && b.querySelector('canvas')) && !lk.some(b => /de Fuego/.test(b.textContent)); })()`), 'y salen las partículas de todos los tipos sobre el Pokémon: las de otros tipos, bloqueadas para más adelante');
  await page.eval(`[...document.querySelectorAll('.ms-wear.skin')].find(b => /Oro/.test(b.textContent)).click(); true`);
  await page.waitFor(`${p}.skins[4] === 'oro'`);
  ok(true, 'la skin Oro se pone a la línea de Charmander desde su Vestuario');
  await page.eval(`window.__app.ui.closeSheet(); window.__app.ui.show('menu'); true`);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`!!document.querySelector('.menu-card.story .art.skinfx-oro[data-fx], .menu-card.story .art.skin-oro')`), 'y se ve en la tarjeta de Historia con tu Charmander');

  // En combate: el sprite lleva la skin (práctica con Charizard, de la misma línea)
  await page.eval(`window.__app.net.send({ t: 'practice', dexes: [6], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.actors && window.__app.battle.actors[0]`, 15000);
  ok(await page.eval(`window.__app.battle.actors[0].skinU.uSkin.value === 1 && window.__app.battle.actors[1].skinU.uSkin.value === 0`), 'en combate, tu Charizard lleva la skin Oro y el rival no');
};
