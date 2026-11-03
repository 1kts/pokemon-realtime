// Desde Historia se llega a las Misiones sin salir al menú (en escritorio y en el móvil): el botón avisa con su bolita
// cuando hay premios por recoger, se recogen allí y «Volver» devuelve a Historia.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'misionero' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile');
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true]]) {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.touch', '${touch ? 1 : ''}'); localStorage.setItem('arena.storyGuide', '1'); true`);
    await page.reload();
    await page.loginAs(me.token);
    await page.mode('Historia');
    await page.waitSee('Explorar');
    if (!touch) {
      const dot = await page.eval(`(() => { const b = [...document.querySelectorAll('.story-quick button')].find(x => /Misiones/.test(x.getAttribute('aria-label'))), d = b && b.lastElementChild, r = d && d.getBoundingClientRect();
        return !!r && r.width >= 6 && getComputedStyle(d).visibility !== 'hidden' && d.tagName !== 'IMG'; })()`);
      ok(dot, `${W}×${H}: el botón de Misiones de Historia lleva su bolita a la vista (hay premios por recoger)`);
    }
    await page.tap('Misiones', { in: '.story' });
    await page.waitFor(`document.querySelector('.inner-bar h2') && document.querySelector('.inner-bar h2').textContent === 'Misiones'`, 10000).catch(() => {});
    ok(await page.title() === 'Misiones', `${W}×${H}: el botón Misiones de Historia lleva a Misiones (${await page.title()})`);
    if (!touch) {
      await page.tap('Recoger todo');
      await page.waitSee('¡Genial!');
      await page.tap('¡Genial!');
      ok(!await page.see('Recoger todo', { ms: 1500 }), `${W}×${H}: allí se recogen los premios`);
    }
    await page.tap('Volver');
    await page.waitSee('Explorar');
    ok(await page.title() === 'Historia', `${W}×${H}: «Volver» desde Misiones devuelve a Historia`);
  }
};
