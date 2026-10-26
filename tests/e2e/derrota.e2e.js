// Pantalla de derrota: tu Pokémon y el líder cara a cara, el resumen del combate (equipos, daño, KOs,
// aciertos y mejor movimiento), un consejo para la próxima y, contra un líder, Reintentar o Mejorar equipo.
// Si desde ahí vas a Logros, «Volver» te deja donde empezaste el combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'derrotado' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.startStory('gym', 'brock'); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 15000);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.ui.view === 'results' && document.querySelector('.results.is-lose')`, 15000);
  ok(await page.eval(`/Derrota/.test(document.querySelector('.res-hero h1.lose').textContent) && /Brock/.test(document.querySelector('.res-hero').textContent) && !!document.querySelector('.res-hero .rh-trainer')`),
    'la derrota enseña tu Pokémon frente al retrato de Brock');
  ok(await page.eval(`document.querySelectorAll('.rs-team.me .rs-mon').length === 1 && document.querySelectorAll('.rs-stat').length >= 4`), 'con los dos equipos y el resumen del combate');
  ok(await page.eval(`/Contra Brock van bien los ataques de tipo/.test(document.querySelector('.res-tip').textContent) && /Agua/.test(document.querySelector('.res-tip').textContent)`), 'y un consejo: qué tipos le van bien contra Brock');
  await page.click('Reintentar');
  await page.waitFor(`window.__app.battle && window.__app.battle.mode === 'trainer'`, 15000);
  ok(true, 'Reintentar vuelve a combatir contra Brock');

  // Desde los resultados a Logros y «Volver»: se vuelve a la Historia, no a una pantalla vacía
  await page.waitFor(`window.__app.battle.latest`, 15000);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
  await page.eval(`window.__app.ui.openCollection('mastery'); true`);
  await page.waitFor(`window.__app.ui.view === 'collection'`);
  // En el CI, Logros puede tardar un poco en pintar su cabecera: esperar al botón antes de pulsarlo
  await page.waitFor(`[...document.querySelectorAll('button')].some(b => b.offsetParent && /Volver/.test(b.textContent))`, 10000);
  await page.click('Volver');
  await page.waitFor(`window.__app.ui.view === 'story' && window.__app.ui.root.children.length > 0`);
  ok(true, 'ir a Logros desde los resultados y volver lleva a la Historia');
};
