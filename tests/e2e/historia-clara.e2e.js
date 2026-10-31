// Historia sin ruido: las regiones y las medallas van en la cabecera, junto al título; «Cómo se juega» arriba a la
// izquierda del panel del Camino y la cuenta atrás en ese mismo panel, a la vista, también en el móvil. Las tarjetas
// dicen lo justo: nada de «Ruta · captura» ni de Pokémon, y de cada ruta, solo su primer nombre.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'clara' });
  for (const dex of [4, 16]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  const box = sel => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
  const entra = async (W, H, touch) => {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.${touch ? "setItem('arena.touch', '1')" : "removeItem('arena.touch')"}; true`);
    await page.loginAs(me.token);
    await page.tap('Historia');
  };

  await entra(1280, 800, false);
  await page.waitSee('Cómo se juega al modo historia');   // (la primera vez se abre sola)
  await page.tap('¡A jugar!');
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    const at = `${W}×${H}`;
    if (touch) await entra(W, H, touch);
    await page.waitSee('Cómo se juega');
    const path = await box('.story-pathwrap');
    const h = await page.eval(`(() => { const r = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Cómo se juega').getBoundingClientRect(); return { l: r.left, t: r.top }; })()`);
    ok(h.l - path.l < 30 && h.t - path.t < 30 && h.t >= path.t, `${at}: «Cómo se juega» está arriba a la izquierda del Camino (botón en ${h.l},${h.t}; Camino en ${path.l},${path.t})`);
    ok(await page.see(/\d+:\d\d:\d\d/, { in: '.story-pathwrap' }), `${at}: la cuenta atrás de las rutas se ve en el panel del Camino`);
    const bar = await box('.inner-bar'), kanto = await box('.region-chips button');
    ok(kanto.t >= bar.t && kanto.b <= bar.b, `${at}: las regiones van dentro de la cabecera (Kanto ${kanto.t}-${kanto.b}, cabecera ${bar.t}-${bar.b})`);
    ok(await page.see('Kanto', { in: '.inner-bar' }) && await page.see('Johto', { in: '.inner-bar' }), `${at}: Kanto y Johto se leen en la cabecera`);
    ok(!await page.see('Próximamente', { ms: 0 }), `${at}: no hay una fila aparte con las regiones que llegarán`);
    const texto = await page.eval(`document.querySelector('.story-path').innerText`);
    ok(!/Ruta · captura|Gimnasio · combate/.test(texto), `${at}: las tarjetas no repiten qué es cada sitio`);
    ok(/Ruta 11/.test(texto) && !/Ruta 9/.test(texto), `${at}: de cada ruta sale solo su primer nombre`);
    ok(!await page.eval(`!!document.querySelector('.story-path .sp-route .mon-icon')`), `${at}: las tarjetas de las rutas no llevan Pokémon`);
  }

  // El botón sigue haciendo lo suyo, y el detalle de la ruta está en su ficha
  await page.tap('Cómo se juega');
  await page.waitSee('Cómo se juega al modo historia');
  await page.tap('¡A jugar!');
  await page.waitSee(/Ruta 11 · Ruta 9 · Ruta 10/, { scroll: true });
  ok(true, 'el nombre completo de la ruta está en su ficha');

  // Cambiar de región desde la cabecera
  await page.tap(/^Johto/);
  await page.waitSee(/inicial de Johto/i);
  ok(true, 'tocar Johto en la cabecera lleva a Johto');
};
