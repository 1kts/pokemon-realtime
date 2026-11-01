// Un corte breve de la conexión en combate (en el móvil pasa) no te saca: tras el aviso de reconectar sigues peleando.
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'cortado' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  // atajo: cortar la conexión, que un jugador no puede hacer desde la página
  await page.eval(`window.__was = window.__app.battle; window.__app.net.ws.close(); true`);
  await page.waitFor(`window.__app.net.ws.readyState === 1 && window.__app.battle === window.__was && window.__app.battle.latest && document.getElementById('conn').hidden`, 15000);
  ok(await page.title() === '', 'tras el corte sigues en el combate, no en el menú');

  // Al recargar a media pelea: de vuelta en ella, sin menús encima y con mandos, o, si se tardó más de lo que espera el
  // servidor, fuera y sin combate. Nunca a medias
  const t0 = Date.now();
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
  await page.click('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.profile`, 20000);
  const tarde = Date.now() - t0;
  log(`(de vuelta en ${(tarde / 1000).toFixed(1)} s)`);
  await page.waitFor(`window.__app.battle ? window.__app.battle.latest && window.__app.battle.latest.state === 'fight' : window.__app.ui.view === 'menu' && !document.getElementById('hud').hidden`, 20000);
  if (await page.eval(`!!window.__app.battle`)) {
    ok(await page.title() === '' && !(await page.see('Aventura', { ms: 500 })), 'al volver a entrar a media pelea sigues en ella, sin el menú encima');
    await page.key('Escape');
    await page.tap('Rendirse', { in: '.ui-confirm-box' });
    await page.waitSee('Derrota');
    ok(true, 'y sus mandos responden: rendirse la termina');
  } else {
    ok(tarde > 6000 && await page.see('Aventura'), `solo sales al menú si tardaste más de lo que espera el combate (${tarde} ms)`);
  }
};
