// Desde Historia se abre la Tienda (para comprar Balls sin salir al menú) y Volver regresa a Historia
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'compradora' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.story-shop')`);
  if (process.env.SHOT) await page.shot('/tmp/claude-1000/-home-pau-projects/917103ca-7484-4a18-bc59-4ad4e6485525/scratchpad/story-shop.png');
  await page.eval(`document.querySelector('.story-shop').click(); true`);
  await page.waitFor(`window.__app.ui.view === 'shop' && document.querySelector('.shop')`);
  ok(true, 'el botón Tienda de Historia abre la Tienda');
  await page.eval(`document.querySelector('.inner-bar .back, .tb-left button').click(); true`);
  await page.waitFor(`window.__app.ui.view === 'story'`);
  ok(true, 'y Volver regresa a Historia');
};
