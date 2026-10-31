// Logros (2): lo ganado con los retos de una línea se pone fuera de Logros. El glow, desde el editor del Perfil (sale
// alrededor del avatar); la skin Edición Oro, desde el Vestuario de la ficha del Pokémon, donde la pestaña Retos
// enseña los de su línea (se ve en la tarjeta de Historia y en combate). Ganarlos y recogerlos, en maestria.e2e.js
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'maestria' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', mastery: { dex: 6, wins: 500 } });
  await me.client.wait(m => m.t === 'profile');
  // (el glow de fuego, como si saliera del cofre semanal: se ve más abajo, en Glows y en el Perfil)
  me.client.send({ t: 'dev', aura: 'tipo-fuego' }); await me.client.wait(m => m.t === 'profile');
  // (los 5 retos de la línea, ya recogidos: recogerlos por la interfaz es lo que prueba maestria.e2e.js)
  for (let i = 0; i < 8; i++) { me.client.send({ t: 'masteryclaim', dex: 4, i }); await me.client.wait(m => m.t === 'profile'); }
  await page.loginAs(me.token);

  // Desde el Perfil: el glow de fuego
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
