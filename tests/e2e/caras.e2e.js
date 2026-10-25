// Caras con emoción (retratos de SpriteCollab de la Gen 1 y 2): en combate, la barra de equipos lleva la
// cara de cada Pokémon y cambia de emoción con lo que pasa; los retratos de Tesoros salen con emoción
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'caras' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // Las imágenes existen y cargan (normal y shiny)
  const loads = src => page.eval(`new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = ${JSON.stringify(src)}; })`);
  ok(await loads('portraits/emo/25/Happy.png') && await loads('portraits/emo/25/s/Happy.png') && await loads('sprites/1/Sleep.png'),
    'hay retratos con emoción (normal y shiny) y animaciones nuevas de la Gen 1 y 2');

  // Retrato de Tesoros con emoción
  const art = await page.eval(`import('/js/missions.js').then(m => m.portraitArt(1, 64, 'Happy'))`);
  ok(art.includes('portraits/emo/1/Happy.png'), 'un retrato de Tesoros con emoción usa su cara con esa emoción');

  // Combate (el del tutorial: Pokémon de la Gen 1 contra Snorlax): caras en la barra y emociones
  await page.click('.menu-card.tutorial');
  await page.waitFor(`window.__app.battle && document.querySelectorAll('.tm img.face').length >= 2`);
  ok(await page.eval(`[...document.querySelectorAll('.tm img.face')].every(i => /portraits\\/emo\\/\\d+\\/(s\\/)?Normal\\.png$/.test(i.src))`),
    'en combate la barra de equipos lleva la cara normal de cada Pokémon');
  await page.eval(`window.__app.battle.emote(window.__app.battle.foeIdx, 'Pain', 4000); true`);
  await page.waitFor(`[...document.querySelectorAll('.team.foe .tm.active img.face')].some(i => /Pain\\.png$/.test(i.src))`);
  ok(true, 'al recibir un golpe, el Pokémon pone cara de dolor');
};
