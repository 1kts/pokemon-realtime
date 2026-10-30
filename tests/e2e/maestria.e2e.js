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
  // (el glow de fuego, como si saliera del cofre semanal: se ve más abajo, en Glows y en el Perfil)
  me.client.send({ t: 'dev', aura: 'tipo-fuego' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(+(await page.read('.coll-tile.wide .nbadge')) >= 5, 'el menú avisa de los premios de Logros por recoger');

  await page.click('.coll-tile.wide');
  await page.waitFor(`document.querySelector('.lg-card')`);
  ok(await page.title() === 'Logros' && await page.eval(`document.querySelectorAll('.lg-card.ready .lg-row.ready').length`) === 5, 'la línea de Charmander tiene 5 retos listos (10, 50, 100, 200 y 500 victorias)');
  ok(await page.eval(`(() => { const asks = [...document.querySelectorAll('.lg-card .lg-row.k-skin small')].map(s => s.textContent); return document.querySelectorAll('.lg-card .lg-row').length >= 7 && asks.some(x => /online/.test(x)) && asks.some(x => /Torre/.test(x)); })()`), 'Holo pide victorias online y Galaxia la Torre, con su progreso');
  // Se recogen uno a uno, cada uno con su animación (y se apunta qué dice cada premio)
  const prizes = [];
  for (let i = 0; i < 5; i++) {
    await page.click('.lg-row.ready .claim-btn');
    await page.waitFor(`document.querySelector('.loot-pop .acts .primary')`);
    prizes.push(await page.read('.loot-pop'));
    await page.click('.loot-pop .acts .primary');
    await page.waitFor(`!document.querySelector('.loot-pop')`);
  }
  const all = prizes.join(' | ');
  ok(/Caramelo Raro/.test(all) && /Maestro de Charmander/.test(all) && /Retrato/i.test(all) && !(await page.eval(`!!document.querySelector('.lg-row.ready')`)),
    'recogidos uno a uno, con su premio: Caramelo Raro, retrato, título «Maestro de Charmander»… y ya no queda nada por recoger');

  // Retos: por categorías, con los de debilitar por tipo en Combate
  await page.tap(/^Retos/, { in: '.coll-tabs, .collection' });
  await page.waitFor(`document.querySelector('.retos-grid')`);
  await page.tap(/^Combate/, { in: '.coll-cats' });
  await page.waitFor(`document.querySelectorAll('.retos-grid .ach-card').length === Data.TYPE_NAMES.length`);
  ok(await page.see('Debilita 100 Pokémon con movimientos de tipo Fuego', { in: '.retos-grid', scroll: true }), 'en Retos › Combate están los de debilitar con cada tipo, con su marco de premio');

  // Glows: Logros solo enseña (sin botones); se pone en el Perfil
  await page.tap(/^Glows/, { in: '.coll-tabs, .collection' });
  await page.waitFor(`document.querySelector('.aura-grid')`);
  ok(await page.eval(`document.querySelectorAll('.aura-grid .coll-item.own').length === 1 && !document.querySelector('.aura-grid button')`) && await page.see('Perfil', { in: '.coll-where' }), 'en Logros › Glows sale el de fuego como tuyo, sin equiparlo desde ahí (se pone en el Perfil)');
  ok(await page.eval(`[...document.querySelectorAll('.aura-grid .coll-item.locked em')].some(e => /Campeón de Kanto/.test(e.textContent))`), 'los glows especiales dicen de qué reto salen');
  // Marcos: todos, con de dónde sale cada uno
  await page.tap(/^Marcos/, { in: '.coll-tabs, .collection' });
  await page.waitFor(`document.querySelector('.frames-grid')`);
  ok(await page.eval(`[...document.querySelectorAll('.frames-grid .frame-item.locked')].some(b => /Marco Fuego/.test(b.textContent) && /Próximamente/.test(b.textContent))`), 'en Marcos se ve el de Fuego bloqueado, para más adelante');

  // Desde el Perfil: el glow de fuego
  await page.tap('Volver');
  await page.tap('Perfil');
  await page.click('.trainer-card .tc-edit');
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.tap('Glow', { in: '.ava-edit .ae-tabs' });
  await page.tap(/Glow Fuego/, { in: '.ava-edit' });
  await page.waitFor(`window.__app.ui.profile.aura === 'tipo-fuego'`);
  await page.key('Escape');
  await page.tap('Volver');
  ok(await page.waitFor(`document.querySelector('.hub-ava .ava-aura.aura-tipo')`).then(() => true, () => false), 'el glow de fuego, puesto desde el editor del Perfil, sale alrededor del avatar de arriba');

  // Skin Edición Oro: en la ficha del Pokémon
  await page.tap('Mis Pokémon');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.tap(/^Retos/, { in: '.mon-sheet' });
  await page.waitFor(`document.querySelector('.ms-retos .lg-row')`);
  ok(await page.eval(`document.querySelectorAll('.ms-retos .lg-row.got').length === 5`), 'en la ficha, la pestaña Retos enseña los de su línea con lo ya recogido');
  await page.tap(/^Vestuario/, { in: '.mon-sheet' });
  await page.waitFor(`[...document.querySelectorAll('.ms-wear.skin')].some(b => /Oro/.test(b.textContent))`);
  // (con WebGL la skin la pinta el shader en el canvas, skinfx-* es su brillo; sin WebGL, el filtro CSS skin-*)
  ok(await page.eval(`!!document.querySelector('.ms-wear.skin canvas.skinfx-oro[data-fx], .ms-wear.skin canvas.skin-oro') && document.querySelectorAll('.ms-wear.skin.locked').length >= 2`), 'en Vestuario cada skin se ve sobre el Pokémon; las que no tienes, apagadas');
  ok(await page.eval(`(() => { const lk = [...document.querySelectorAll('.ms-wear.parts.locked')].filter(b => /Próximamente/.test(b.textContent));
    return lk.length === Data.TYPE_NAMES.length - 1 && lk.every(b => b.disabled && b.querySelector('canvas')) && !lk.some(b => /de Fuego/.test(b.textContent)); })()`), 'y salen las partículas de todos los tipos sobre el Pokémon: las de otros tipos, bloqueadas para más adelante');
  await page.click(await page.within('Oro', '.ms-wear.skin'));
  await page.waitFor(`window.__app.ui.profile.skins[4] === 'oro'`);
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  await page.tap('Volver');
  ok(await page.waitFor(`document.querySelector('.menu-card.story .art.skinfx-oro[data-fx], .menu-card.story .art.skin-oro')`).then(() => true, () => false), 'la skin Oro, puesta en su Vestuario, se ve en la tarjeta de Historia con tu Charmander');

  // En combate: el sprite lleva la skin (práctica con Charizard, de la misma línea)
  await page.tap(/^Práctica/);
  await page.click(await page.within('Charizard', '.pool-card'));
  await page.click('.draft button.primary');
  await page.waitFor(`window.__app.battle && window.__app.battle.actors && window.__app.battle.actors[0]`, 20000);
  // atajo: la skin en combate la pinta el shader del 3D (sin elemento que mirar): se mira el uniforme de cada sprite
  ok(await page.eval(`window.__app.battle.actors[0].skinU.uSkin.value === 1 && window.__app.battle.actors[1].skinU.uSkin.value === 0`), 'en combate, tu Charizard lleva la skin Oro y el rival no');
};
