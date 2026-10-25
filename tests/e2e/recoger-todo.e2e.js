// Misiones: «Recoger todo» (en el panel de la portada) recoge de una vez las misiones cumplidas, el cofre que
// se completa, el premio diario y los logros y medallas pendientes, con un solo premio sumado
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'recogetodo' });
  me.client.send({ t: 'dev', missionsDone: true });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu' && document.querySelector('.missions-widget .claim-all')`);
  const n = await page.eval(`window.__app.ui.readyCount()`);
  ok(n >= 4 && (await page.eval(`document.querySelector('.missions-widget .claim-all').textContent`)).includes(String(n)), `el panel de misiones ofrece recoger todo (${n} cosas)`);
  const coins0 = await page.eval(`window.__app.ui.profile.coins`);
  await page.eval(`document.querySelector('.loot-pop, .modal') && document.querySelectorAll('.loot-pop, .modal').forEach(x => x.remove()); document.querySelector('.missions-widget .claim-all').click(); true`);
  await page.waitFor(`document.querySelector('.loot-pop')`);
  ok(await page.eval(`/Todo recogido/.test(document.querySelector('.loot-pop h2').textContent)`), 'sale un solo premio: «¡Todo recogido!»');
  await page.waitFor(`window.__app.ui.profile.missions.daily.every(m => m.claimed) && window.__app.ui.profile.missions.chest.daily && window.__app.ui.profile.coins > ${coins0} && window.__app.ui.readyCount() === 0`);
  ok(true, 'las diarias, su cofre y el premio diario quedan recogidos y no queda nada pendiente');
};
