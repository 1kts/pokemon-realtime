// Desde Historia se abre la Tienda (para comprar Balls sin salir al menú) y Volver regresa a Historia
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'compradora' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.tap(/^Tienda/, { in: '.story-side' });
  await page.waitSee('Poké Balls');
  ok(await page.title() === 'Tienda', 'el botón Tienda de Historia abre la Tienda');
  await page.tap('Volver');
  await page.waitSee('Desafiar');
  ok(await page.title() === 'Historia', 'y Volver regresa a Historia');
};
