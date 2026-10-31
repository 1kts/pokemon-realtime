// Pantalla de derrota: tu Pokémon y el líder cara a cara, el resumen del combate (equipos, daño, KOs,
// aciertos y mejor movimiento), un consejo para la próxima y, contra un líder, Reintentar o Mejorar equipo.
// Si desde ahí vas a Logros, «Volver» te deja donde empezaste el combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'derrotado' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.tap('Desafiar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 20000);
  // Rendirse: Esc (la tecla de verdad) y «Rendirse»
  const forfeit = async () => { await page.key('Escape'); await page.tap('Rendirse', { in: '.ui-confirm-box' }); };
  await forfeit();
  await page.waitFor(`document.querySelector('.results.is-lose')`, 15000);
  ok(await page.eval(`/Derrota/.test(document.querySelector('.res-hero h1.lose').textContent) && /Brock/.test(document.querySelector('.res-hero').textContent) && !!document.querySelector('.res-hero .rh-trainer')`),
    'la derrota enseña tu Pokémon frente al retrato de Brock');
  ok(await page.eval(`document.querySelectorAll('.rs-team.me .rs-mon').length === 1 && document.querySelectorAll('.rs-stat').length >= 4`), 'con los dos equipos y el resumen del combate');
  ok(await page.eval(`/Contra Brock van bien los ataques de tipo/.test(document.querySelector('.res-tip').textContent) && /Agua/.test(document.querySelector('.res-tip').textContent)`), 'y un consejo: qué tipos le van bien contra Brock');
  await page.tap('Reintentar');
  ok(await page.waitFor(`document.querySelector('.tname') && /Brock/.test(document.querySelector('.tname').innerText)`, 20000).then(() => true, () => false),
    'Reintentar vuelve a combatir contra Brock (su nombre en el marcador)');

  // Desde los resultados a Logros y «Volver»: se vuelve a la Historia, no a una pantalla vacía
  await page.waitFor(`window.__app.battle.latest`, 15000);
  await forfeit();
  // (ui.view sigue en 'results' desde el primer combate: hay que esperar a que este acabe de verdad, o sus
  // resultados llegan después y tapan Logros)
  await page.waitFor(`!window.__app.battle && window.__app.ui.view === 'results'`, 15000);
  // atajo: desde los resultados se llega a Logros con «Recoger en Logros», que solo sale si hay algo por recoger
  await page.eval(`window.__app.ui.openCollection('retos'); true`);
  await page.waitFor(`window.__app.ui.view === 'collection'`);
  await page.tap('Volver');
  await page.waitSee('Desafiar');
  ok(await page.title() === 'Historia', 'ir a Logros desde los resultados y volver lleva a la Historia');
};
