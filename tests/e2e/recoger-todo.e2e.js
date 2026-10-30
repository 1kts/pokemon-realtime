// Misiones: «Recoger todo» (en el panel de la portada) recoge de una vez las misiones cumplidas, el cofre que
// se completa, el premio diario y los logros y medallas pendientes, con un solo premio sumado. En Logros,
// su propio «Recoger todo» cobra los retos de línea y los logros
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'recogetodo' });
  me.client.send({ t: 'dev', missionsDone: true });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu' && document.querySelector('.missions-widget .claim-all')`);
  const n = +(await page.read('.missions-widget .claim-all small'));
  ok(n >= 4 && await page.see('Recoger todo', { in: '.missions-widget' }), `el panel de misiones ofrece recoger todo (${n} cosas: las diarias, su cofre y el premio diario)`);
  const money = async () => +(await page.read('.hub-me .pill.coins')).replace(/\D/g, '');
  const coins0 = await money();
  await page.click('.missions-widget .claim-all');
  await page.waitSee('Todo recogido', { in: '.loot-pop' });
  ok(await page.eval(`document.querySelectorAll('.loot-pop').length`) === 1, 'sale un solo premio: «¡Todo recogido!»');
  await page.waitFor(`window.__app.ui.profile.missions.daily.every(m => m.claimed) && window.__app.ui.profile.missions.chest.daily`);
  // (se cierra con «¡Genial!»; si saliera otro premio detrás, también: se cuentan)
  let pops = 0;
  for (let i = 0; i < 5 && await page.eval(`!!document.querySelector('.loot-pop:not(.out)')`); i++) {
    await page.click('.loot-pop:not(.out) .acts .primary'); pops++;
    await page.waitFor(`!document.querySelector('.loot-pop:not(.out)')`, 3000).catch(() => {});
  }
  ok(pops === 1, `y es uno solo: al cerrarlo no sale otro detrás (${pops})`);
  ok(!(await page.see('Recoger todo', { ms: 0 })) && await money() > coins0, `y no queda nada por recoger en el menú, con el dinero sumado (${coins0} → ${await money()})`);

  // Logros: retos de la línea de Charmander (500 victorias: 5 retos) de una vez
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', mastery: { dex: 4, wins: 500 } }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);   // (vuelve a entrar para ver los retos nuevos)
  await page.click('.coll-tile.wide');
  await page.waitFor(`document.querySelector('.collection .tb-ctx .claim-all')`);
  ok(await page.eval(`/5/.test(document.querySelector('.collection .claim-all').textContent)`), 'en Logros sale «Recoger todo» con los 5 retos de línea listos');
  await page.click('.collection .claim-all');
  await page.waitSee('Todo recogido', { in: '.loot-pop' });
  ok(await page.see('Maestro de Charmander', { in: '.loot-pop', scroll: true }), 'se recogen todos de una vez, con un solo premio (con el título «Maestro de Charmander»)');
};
