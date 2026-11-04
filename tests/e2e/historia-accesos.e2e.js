// En el móvil, desde Historia se llega de un toque a Mis Pokémon, la Mochila y la Tienda (botones compactos en la
// cabecera, siempre a mano), sin que nada se mueva ni tape «Explorar», y «Volver» devuelve a Historia
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'accesos' });
  me.client.send({ t: 'dev', dex: 4, level: 15, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile');
  for (const [W, H] of [[844, 390], [667, 375]]) {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval("localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.storyGuide', '1'); true");
    await page.reload();
    await page.loginAs(me.token);
    await page.mode('Historia');
    await page.waitSee('Explorar');
    // Cada acceso dice a dónde lleva (solo el icono no se entendía), y los Pokémon de la ruta, abajo, su probabilidad
    for (const nombre of ['Mis Pokémon', 'Mochila', 'Tienda', 'Misiones']) ok(await page.see(nombre, { in: '.story-quick' }), `${W}×${H}: el acceso «${nombre}» lleva su nombre escrito`);
    ok(await page.see(/\d+(\.\d)?%/, { in: '.story-side' }), `${W}×${H}: los Pokémon de la ruta, en la franja de abajo, dicen su probabilidad`);
    for (const [btn, screen] of [['Mochila', 'Mochila'], ['Tienda', 'Tienda'], ['Mis Pokémon', 'Mis Pokémon']]) {
      ok(await page.see('Explorar') && await page.see('Kanto'), `${W}×${H}: con los accesos en la cabecera, «Explorar» y las regiones se siguen viendo`);
      await page.tap(btn, { in: '.story' });
      await page.waitFor(`document.querySelector('.inner-bar h2') && document.querySelector('.inner-bar h2').textContent === ${JSON.stringify(screen)}`, 10000).catch(() => {});
      ok(await page.title() === screen, `${W}×${H}: el botón ${btn} de Historia lleva a ${screen} (${await page.title()})`);
      await page.tap('Volver');
      await page.waitSee('Explorar');
      ok(await page.title() === 'Historia', `${W}×${H}: «Volver» desde ${screen} devuelve a Historia`);
    }
  }
};
