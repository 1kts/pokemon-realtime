// Menús en el móvil: en horizontal (844×390) y en vertical (390×844) ninguna pantalla se sale de ancho, la
// barra legal ocupa poco (una línea de texto, que se despliega al tocarla) y la cabecera cabe; el mapa de la
// Historia se ve entero en horizontal y la ficha de un Pokémon cabe en la pantalla
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'movilmenus' });
  me.client.send({ t: 'dev', dex: 8, level: 30, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  const views = ['menu', 'story', 'team', 'online', 'treasure', 'settings', 'profile', 'collection', 'missions', 'ladder', 'tower', 'practice', 'dex', 'bag'];
  const wide = () => page.eval(`(() => { const s = document.getElementById('screen'); return s.scrollWidth <= innerWidth + 1; })()`);
  for (const [W, H] of [[844, 390], [390, 844]]) {
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
    const over = [];
    for (const v of views) {
      await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); window.__app.ui.show('${v}'); true`);
      await page.waitFor(`window.__app.ui.view === '${v}'`);
      await new Promise(r => setTimeout(r, 250));
      if (!(await wide())) over.push(v);
    }
    ok(!over.length, `${W}×${H}: ninguna de las ${views.length} pantallas se sale de ancho${over.length ? ' (se salen: ' + over.join(', ') + ')' : ''}`);
    const legal = await page.eval(`Math.round(document.querySelector('.legal-bar').getBoundingClientRect().height)`);
    ok(legal <= 48, `${W}×${H}: la barra legal ocupa poco (${legal} px)`);
    await page.eval(`window.__app.ui.show('menu'); true`);
    await page.waitFor(`document.querySelector('.hub-bar .hub-me')`);
    ok(await page.eval(`(() => { const r = document.querySelector('.hub-bar .hub-me').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; })()`), `${W}×${H}: la cabecera del menú cabe`);
  }

  // La barra legal: en una línea, y al tocar el texto se ve entero
  await page.resize(844, 390);
  const h1 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  await page.eval(`document.querySelector('.legal-text').click(); true`);
  const h2 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  ok(h2 > h1 + 10 && /no está afiliado/i.test(await page.eval(`document.querySelector('.legal-text').textContent`)), 'tocar el texto legal lo despliega entero');
  await page.eval(`document.querySelector('.legal-text').click(); true`);

  // El mapa de la Historia cabe entero en la pantalla en horizontal
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.story .map')`);
  const mapH = await page.eval(`Math.round(document.querySelector('.story .map').getBoundingClientRect().height)`);
  ok(mapH <= 390 - h1, `en horizontal el mapa se ve entero (${mapH} px de alto)`);

  // La ficha de un Pokémon cabe, con el sprite dentro de su recuadro
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card')`);
  await page.eval(`document.querySelector('.mon-card').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet .ms-stage canvas')`);
  ok(await page.eval(`(() => { const s = document.querySelector('.mon-sheet').getBoundingClientRect(), st = document.querySelector('.ms-stage').getBoundingClientRect(), c = document.querySelector('.ms-stage canvas').getBoundingClientRect();
    return s.bottom <= innerHeight + 1 && c.height <= st.height + 1; })()`), 'la ficha cabe en la pantalla y el sprite no se sale de su recuadro');
  await page.resize();
};
