// Portada → jugar como invitado → menú principal con la ayuda «Cómo se juega»
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  ok(await page.eval(`!!document.querySelector('canvas') && typeof window.__app === 'object'`), 'la portada carga con la escena 3D');

  await page.type('.title-panel input', 'Probador');
  await page.click('Jugar');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`window.__app.ui.profile.name === 'Probador' && !window.__app.ui.profile.account`), 'entra como invitado con su nombre');

  await page.eval(`document.querySelector('details.howto').open = true; true`);
  const cols = await page.eval(`[...document.querySelectorAll('details.howto h4')].map(h => h.textContent)`);
  ok(cols.join() === 'Controles,Combate,Terreno,Arenas', `«Cómo se juega» con sus 4 apartados (${cols.join(', ')})`);
};
