// Tras un combate en una ruta: «Seguir explorando» es el botón grande y va primero, al lado «Volver» (antes
// «Continuar»), y debajo se llega a Mis Pokémon y también a la Tienda; cada botón con su icono.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Explorador' });
  me.client.send({ t: 'dev', dex: 4, level: 8, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.mode('Historia');
  await page.tap('¡A jugar!');   // (la primera vez se abre sola la guía de Historia)
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Seguir explorando', { in: '.results' });
  ok(!await page.see('Continuar', { in: '.results', ms: 300 }), 'ya no hay «Continuar»');
  ok(await page.see('Volver', { in: '.results' }), 'para salir, «Volver»');
  const caja = txt => page.eval(`(() => { const b = [...document.querySelectorAll('.results button')].find(x => x.textContent.trim() === ${JSON.stringify(txt)}), r = b.getBoundingClientRect(), c = getComputedStyle(b).backgroundImage + getComputedStyle(b).backgroundColor;
    return { x: r.x, y: r.y, area: r.width * r.height, fondo: c }; })()`);
  const seguir = await caja('Seguir explorando'), volver = await caja('Volver');
  ok(seguir.x < volver.x && Math.abs(seguir.y - volver.y) < 8, `«Seguir explorando» va primero, en la misma fila que «Volver»`);
  ok(seguir.fondo !== volver.fondo && seguir.area >= volver.area, `y se ve más: otro color y al menos igual de grande (${Math.round(seguir.area)} frente a ${Math.round(volver.area)} px²)`);
  ok(await page.see('Mis Pokémon', { in: '.results' }), 'se llega a Mis Pokémon');
  // Cada botón lleva su icono delante, a la vista; Mis Pokémon y Tienda, cada uno de su color
  const iconos = await page.eval(`(() => [...document.querySelectorAll('.results button')].filter(b => ['Seguir explorando', 'Volver', 'Mis Pokémon', 'Tienda'].includes(b.textContent.trim())).map(b => {
    const i = b.querySelector('img, svg'), r = i && i.getBoundingClientRect(), q = b.getBoundingClientRect();
    return { b: b.textContent.trim(), ico: !!r && r.width >= 16 && r.left >= q.left && r.right <= q.right && r.left < q.left + q.width / 3, color: getComputedStyle(b).backgroundImage }; }))()`);
  ok(iconos.length === 4 && iconos.every(x => x.ico), `los cuatro botones llevan su icono delante (${iconos.filter(x => !x.ico).map(x => x.b).join(', ') || 'todos'})`);
  const col = n => (iconos.find(x => x.b === n) || {}).color;
  ok(col('Mis Pokémon') !== col('Tienda'), 'Mis Pokémon y Tienda, cada uno de su color');
  await page.tap('Tienda', { in: '.results' });
  await page.waitFor(`window.__app.ui.view !== 'results'`);
  ok(await page.title() === 'Tienda', `y a la Tienda (${await page.title()})`);
};
