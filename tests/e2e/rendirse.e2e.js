// En combate, Esc abre la ventana del juego para rendirse (no la del navegador): «Seguir combatiendo» la
// cierra sin más y «Rendirse» acaba el combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rendido' });
  await page.loginAs(me.token);
  await page.tap(/^Tutorial/);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`);
  await page.key('Escape');
  await page.waitFor(`document.querySelector('.ui-confirm-box')`);
  ok(await page.title() === '¿Rendirte?' && await page.eval(`document.querySelectorAll('.ui-confirm-box.forfeit .cf-hero .face').length === 2`), 'Esc abre la ventana del juego para rendirse, con tu Pokémon frente al rival como en la derrota');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/rendirse.png');
  await page.tap('Seguir combatiendo');
  await page.waitFor(`!document.querySelector('.ui-confirm')`);
  ok(await page.title() === '' && await page.see(/1\/6/, { in: '.tutorial-card' }), '«Seguir combatiendo» la cierra y el combate sigue (con la tarjeta del tutorial)');
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Derrota', { ms: 15000 });
  ok(true, '«Rendirse» acaba el combate: sale la derrota');
};
