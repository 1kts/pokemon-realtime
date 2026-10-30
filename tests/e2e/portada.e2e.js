// Portada → jugar como invitado → menú principal con la ayuda «Cómo se juega»
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  ok(await page.eval(`!!document.querySelector('canvas')`) && await page.see('Jugar', { in: '.title-panel' }), 'la portada carga con la escena 3D y el botón Jugar');

  await page.type('.title-panel input', 'Probador');
  await page.click('Jugar');
  await page.waitSee('Aventura');
  ok(await page.see('Probador', { in: '.hub-me' }), 'entra al menú con su nombre');

  await page.click('details.howto summary');
  await page.waitSee('Controles', { in: 'details.howto', scroll: true });
  const cols = await page.eval(`[...document.querySelectorAll('details.howto h4')].map(h => h.innerText)`);
  ok(cols.join() === 'Controles,Combate,Terreno,Arenas', `«Cómo se juega» se despliega con sus 4 apartados (${cols.join(', ')})`);

  await page.tap('Perfil');
  ok(await page.see('Invitado', { in: '.account', scroll: true }), 'y en su perfil pone que es invitado (sin cuenta)');
};
