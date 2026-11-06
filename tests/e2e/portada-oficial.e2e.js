// La portada avisa de que esta es la web oficial y de que el juego es gratis: si alguien pide pagar o descargar algo, no
// es el juego. Se lee entero y sin tapar nada, en el ordenador y en el móvil.
module.exports = async ({ page, ok }) => {
  for (const [w, h, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    await page.resize(w, h);
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); ${touch ? "localStorage.setItem('arena.touch', '1');" : ''} true`);
    await page.reload();
    await page.waitSee('Jugar', { in: '.title-panel' });
    ok(await page.see(/Web oficial: pokearenas\.com/, { in: '.title-panel', scroll: true }) && await page.see(/pagar o descargar algo, no somos nosotros/, { in: '.title-panel', scroll: true }), `${w}×${h}: la portada dice que la web oficial es pokearenas.com y que no pide pagar ni descargar nada`);
    ok(await page.see('Jugar', { in: '.title-panel' }), `${w}×${h}: y el botón Jugar se sigue viendo sin bajar`);
  }
};
