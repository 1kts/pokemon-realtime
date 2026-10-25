// Maestría y Colección: con victorias de una línea evolutiva, sus premios salen para recoger (aviso en el
// menú), se recogen con la animación de premio y se equipan: brillo de burbuja en el avatar y skin en los
// retratos y en el sprite del combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'maestria' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', mastery: { dex: 6, wins: 150 } });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`document.querySelector('.coll-tile.wide.ready .nbadge').textContent`) === '5', 'el menú avisa de los 5 premios de maestría por recoger');

  await page.click('.coll-tile.wide');
  await page.waitFor(`window.__app.ui.view === 'collection'`);
  ok(await page.eval(`document.querySelectorAll('.ml-row.ready .ml-pip.ready').length`) === 5, 'la línea de Charmander tiene 5 premios listos (10, 25, 50, 100 y 150)');
  // Se recogen uno a uno, cada uno con su animación
  for (let i = 0; i < 5; i++) {
    await page.eval(`document.querySelector('.ml-row.ready .claim-btn').click(); true`);
    await page.waitFor(`document.querySelector('.loot-pop')`);
    await page.waitFor(`(window.__app.ui.profile.masteryClaimed[4] || []).length === ${i + 1}`);
    await page.eval(`document.querySelector('.loot-pop .acts .primary').click(); true`);
    await page.waitFor(`!document.querySelector('.loot-pop')`);
  }
  const p = `window.__app.ui.profile`;
  ok(await page.eval(`${p}.cosmetics.frames.includes('tipo-fuego') && ${p}.cosmetics.auras.includes('tipo-fuego') && !document.querySelector('.ml-row.ready')`), 'recogidos: marco y brillo de fuego, y ya no queda nada por recoger');

  // Brillo de burbuja
  await page.click('.coll-tab:nth-child(3)');
  await page.waitFor(`document.querySelector('.aura-grid')`);
  await page.eval(`[...document.querySelectorAll('.aura-grid button.coll-item')].find(b => b.querySelector('.aura-tipo') && getComputedStyle(b.querySelector('.ava-aura')).getPropertyValue('--aura').trim() === Data.TYPE_COLOR.fuego).click(); true`);
  await page.waitFor(`${p}.aura === 'tipo-fuego'`);
  ok(await page.eval(`!!document.querySelector('.me-chip .ava-aura.aura-tipo')`), 'el brillo de fuego sale alrededor del avatar de arriba');
  ok(await page.eval(`document.querySelectorAll('.aura-grid .coll-item.locked').length`) > 10, 'los brillos que faltan salen bloqueados, con cómo conseguirlos');

  // Skin Edición Oro
  await page.click('.coll-tab:nth-child(4)');
  await page.waitFor(`document.querySelector('.skin-sec')`);
  await page.eval(`document.querySelector('.skin-sec button.coll-item.skin').click(); true`);
  await page.waitFor(`${p}.skins[4] === 'oro'`);
  ok(await page.eval(`!!document.querySelector('.skin-sec .coll-item.sel canvas.skin-oro')`), 'la skin Oro se pone a la línea de Charmander');
  await page.click('Volver');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`!!document.querySelector('.menu-card.story .art.skin-oro')`), 'y se ve en la tarjeta de Historia con tu Charmander');

  // En combate: el sprite lleva la skin (práctica con Charizard, de la misma línea)
  await page.eval(`window.__app.net.send({ t: 'practice', dexes: [6], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.actors && window.__app.battle.actors[0]`, 15000);
  ok(await page.eval(`window.__app.battle.actors[0].skinU.uSkin.value === 1 && window.__app.battle.actors[1].skinU.uSkin.value === 0`), 'en combate, tu Charizard lleva la skin Oro y el rival no');
};
