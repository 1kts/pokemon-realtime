// Menús en el móvil en vertical (390×844): ninguna pantalla se sale de ancho, la barra legal ocupa poco y la
// cabecera cabe (lo mismo que movil-menus.e2e.js en horizontal)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'movilvertical' });
  me.client.send({ t: 'dev', dex: 8, level: 30, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  const views = ['menu', 'story', 'team', 'online', 'treasure', 'settings', 'profile', 'collection', 'missions', 'ladder', 'tower', 'practice', 'dex', 'bag'];
  const wide = () => page.eval(`(() => { const s = document.getElementById('screen'); return s.scrollWidth <= innerWidth + 1; })()`);
  await page.goto('/');
  for (const [W, H] of [[390, 844]]) {
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

  await page.resize();
};
