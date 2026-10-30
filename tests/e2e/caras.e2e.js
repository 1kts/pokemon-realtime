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
  // Un golpe de verdad: acercarse con WASD y pulsar con el ratón encima del muñeco hasta acertarle.
  // atajo: dónde están tu Pokémon y el muñeco en la pantalla (la arena es 3D, sin elementos que buscar)
  const where = `(() => { const b = window.__app.battle; if (!b || !b.pred) return null; const me = b.pred, f = b.posOf(b.foeIdx), p = b.toScreen(f.x, f.y);
    return { dx: f.x - me.x, dy: f.y - me.y, x: Math.round(p.x), y: Math.round(p.y) }; })()`;
  // (la cara de dolor dura un segundo: se apunta cada cara que sale en la barra del rival)
  await page.eval(`window.__faces = []; new MutationObserver(() => document.querySelectorAll('.team.foe img.face').forEach(i => window.__faces.push(i.src))).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] }); true`);
  const pain = `window.__faces.some(s => /Pain\\.png$/.test(s))`;
  for (let i = 0; i < 200 && !(await page.eval(pain)); i++) {
    const w = await page.eval(where);
    if (!w) continue;
    if (Math.hypot(w.dx, w.dy) > 140) await page.key(Math.abs(w.dx) > Math.abs(w.dy) ? (w.dx > 0 ? 'KeyD' : 'KeyA') : (w.dy > 0 ? 'KeyS' : 'KeyW'), 150);
    await page.mouseAt(w.x, w.y, { click: true });
  }
  ok(await page.eval(pain), 'al recibir un golpe, el Pokémon pone cara de dolor');
};
