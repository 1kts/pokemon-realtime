// Logros: los filtros van en la misma línea que el título, sin el rótulo «Colección» ocupando sitio, todos se alcanzan
// (también en el móvil, deslizando) y el contenido empieza justo debajo.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'logrera' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.goto('/');
  await page.eval("localStorage.setItem('arena.touch', '1'); true");
  await page.loginAs(me.token);
  await page.tap(/Logros/);
  await page.waitSee('Retos');
  // (los retos de cada línea están en la ficha de cada Pokémon, no aquí)
  ok(!(await page.see('Líneas', { ms: 0 })), 'Logros no tiene pestaña de Líneas');
  const altura = (a, b) => `(() => { const r = [...document.querySelectorAll('${a}')].find(x => x.textContent.trim().startsWith('${b}')).getBoundingClientRect(); return (r.top + r.bottom) / 2; })()`;
  for (const [w, h] of [[844, 390], [667, 375], [1280, 800]]) {
    await page.resize(w, h);
    await page.waitSee('Retos');
    const titulo = await page.eval(altura('.feature-sign h2', 'Logros')), tab = await page.eval(altura('button', 'Retos'));
    ok(Math.abs(titulo - tab) <= 12, `en ${w}×${h} los filtros van a la altura del título (título ${titulo}, filtro ${tab})`);
    ok(!(await page.see('Colección', { in: '.coll-tabs', ms: 0 })), `en ${w}×${h} no hay rótulo «Colección» gastando sitio`);
    const hueco = await page.eval(`(() => { const b = document.querySelector('.inner-bar').getBoundingClientRect().bottom; return document.querySelector('.coll-body').getBoundingClientRect().top - b; })()`);
    ok(hueco <= 16, `en ${w}×${h} el contenido empieza justo debajo de la cabecera (${hueco} px)`);
  }
  await page.resize(844, 390);
  await page.waitSee('Retos');
  ok(await page.see('Títulos', { scroll: true }), 'en el móvil se llega al último filtro');
  await page.tap('Títulos');
  await page.waitSee('Para ponértelo, ve a tu Perfil');
  ok(await page.see('Títulos', { ms: 0 }), 'al elegirlo, el filtro elegido sigue a la vista');
};
