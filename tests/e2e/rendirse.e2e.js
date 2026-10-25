// En combate, Esc abre la ventana del juego para rendirse (no la del navegador): «Seguir combatiendo» la
// cierra sin más y «Rendirse» acaba el combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rendido' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.click('.menu-card.tutorial');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`);
  const esc = () => page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); true`);
  await esc();
  await page.waitFor(`document.querySelector('.ui-confirm-box')`);
  ok(await page.eval(`/Rendirte/.test(document.querySelector('.ui-confirm-box h3').textContent)`), 'Esc abre la ventana del juego para rendirse');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/rendirse.png');
  await page.click('Seguir combatiendo');
  await page.waitFor(`!document.querySelector('.ui-confirm')`);
  ok(await page.eval(`!!window.__app.battle && !window.__app.battle.over`), '«Seguir combatiendo» la cierra y el combate sigue');
  await esc();
  await page.waitFor(`document.querySelector('.ui-confirm-box')`);
  await page.eval(`document.querySelector('.ui-confirm-box .ok').click(); true`);
  await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
  ok(true, '«Rendirse» acaba el combate');
};
