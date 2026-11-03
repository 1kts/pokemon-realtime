// Tocar tu dinero lleva a la Tienda: desde el menú y desde Mis Pokémon, con ratón y en el móvil.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Ahorrador' });
  me.client.send({ t: 'dev', dex: 4, level: 8, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  for (const [w, h, touch] of [[1280, 800, false], [844, 390, true]]) {
    await page.resize(w, h);
    if (touch) await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.waitSee('Historia');
    await page.click('.hub-me .pill.coins');
    await page.waitFor(`window.__app.ui.view !== 'menu'`);
    ok(await page.title() === 'Tienda', `${w}×${h}: tocar el dinero del menú abre la Tienda (${await page.title()})`);
    await page.tap('Volver');
    await page.tap('Mis Pokémon');
    await page.waitFor(`document.querySelector('.mon-card')`);
    await page.click('.tb-ctx .pill.coins');
    await page.waitFor(`window.__app.ui.view === 'shop'`);
    ok(await page.title() === 'Tienda', `${w}×${h}: y el de Mis Pokémon también (${await page.title()})`);
  }
};
