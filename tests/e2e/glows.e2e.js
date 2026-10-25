// Glows del sprite: un contorno de luz que se elige en Colección y se pone a una línea evolutiva, se suma
// a la skin que lleve y se ve en los retratos y en combate (también para el rival)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'glows' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', glows: true });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.openCollection('glow'); true`);
  await page.waitFor(`document.querySelector('.glow-chips')`);
  ok(await page.eval(`document.querySelectorAll('.glow-chip:not(.locked)').length === Data.GLOWS.length`), 'salen todos tus glows para elegir');
  // Elegir el dorado y ponérselo a la línea de Charmander
  await page.eval(`[...document.querySelectorAll('.glow-chip')].find(b => b.textContent.includes('Dorado')).click(); true`);
  await page.waitFor(`document.querySelector('.glow-chip.sel') && document.querySelector('.glow-chip.sel').textContent.includes('Dorado')`);
  await page.eval(`document.querySelector('.coll-grid .coll-item').click(); true`);
  await page.waitFor(`window.__app.ui.profile.glows[4] === 'dorado'`);
  ok(await page.eval(`!!document.querySelector('.coll-grid .coll-item.sel canvas.has-glow.glow-dorado')`), 'el glow dorado se pone a la línea de Charmander');
  await page.eval(`window.__app.ui.openFrom('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card canvas')`);
  ok(await page.eval(`document.querySelector('.mon-card canvas').classList.contains('has-glow')`), 'y se ve en Mis Pokémon');
  // En combate (práctica con Charizard, de la misma línea)
  await page.eval(`window.__app.net.send({ t: 'practice', dexes: [6], skill: 0.1 }); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.actors && window.__app.battle.actors[0]`, 15000);
  ok(await page.eval(`window.__app.battle.actors[0].skinU.uGlow.value === 1 && window.__app.battle.actors[1].skinU.uGlow.value === 0`), 'en combate tu Charizard lleva el glow y el rival no');
};
