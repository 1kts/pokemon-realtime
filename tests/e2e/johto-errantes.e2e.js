// En Johto, la ficha de una ruta enseña sus 4 de la tanda y su especial, y nada más: Raikou, Entei y Suicune vagan por
// todas las rutas como sorpresa, sin salir anunciados (antes llenaban la lista con tres «???» más en cada ruta).
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'errantes' });
  for (const [dex, region] of [[4, 'kanto'], [155, 'johto']]) { me.client.send({ t: 'dev', dex, level: 30, region }); await me.client.wait(m => m.t === 'profile'); }
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.mode('Historia');
  await page.tap('¡A jugar!');   // (la primera vez se abre sola la guía de Historia)
  await page.tap('Johto');
  await page.waitSee('Explorar');
  // Las fichas de la lista de la ruta: cuántas hay y cuántas son especiales que aún no conoces (las «???»)
  const lista = () => page.eval(`(() => { const l = document.querySelector('.route-list'); const cards = [...l.children].filter(c => c.getBoundingClientRect().width > 0);
    return { total: cards.length, ocultos: cards.filter(c => c.innerText.trim().startsWith('???')).length, nombres: cards.map(c => c.innerText.split('\\n')[0]) }; })()`);
  await page.tap('Ruta 29', { in: '.story-path' });
  await page.waitSee(/Ruta 29/, { in: '.story-side' });
  const r29 = await lista();
  ok(r29.total === 5 && r29.ocultos <= 1, `Ruta 29: sus 4 de la tanda y su especial, sin los errantes (${JSON.stringify(r29)})`);
};
