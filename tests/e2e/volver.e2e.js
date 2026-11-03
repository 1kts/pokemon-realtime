// «Volver» y Esc llevan siempre a la pantalla de la que vienes, no a un sitio fijo; y al acabar un combate puedes ir a
// Mis Pokémon y volver adonde empezaste el combate.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'volvedor' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', item: 'pokeball', qty: 3 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.resize(1280, 800);
  await page.waitSee('Aventura');

  // Una cadena de tres: Ajustes › Perfil › Volver › Volver
  await page.tap('Ajustes');
  await page.tap('Abrir perfil');
  await page.waitSee('volvedor', { in: '.trainer-card' });
  await page.tap('Volver');
  await page.waitFor(`!document.querySelector('.trainer-card')`);
  ok(await page.title() === 'Ajustes', `Volver desde el Perfil regresa a Ajustes, de donde venías (${await page.title()})`);
  await page.tap('Volver');
  await page.waitSee('Aventura');
  ok(true, 'y otro Volver, al menú');

  // A la ladder por dos caminos: vuelve a cada uno
  await page.mode('Torre Batalla');
  await page.tap('Ver la ladder completa');
  await page.waitFor(`document.querySelector('.ladder')`);
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.ladder') && document.querySelector('.tower-side')`);
  ok(await page.title() === 'Torre Batalla', `Esc desde la ladder vuelve a la Torre (${await page.title()})`);
  await page.tap('Volver');
  await page.waitSee('Aventura');

  // Tras un combate: a Mis Pokémon desde los resultados, y Volver deja donde se empezó
  await page.mode('Historia');
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Volver');
  await page.tap('Mis Pokémon', { in: '.results' });
  await page.waitFor(`document.querySelector('.mon-card')`);
  ok(await page.title() === 'Mis Pokémon', `desde los resultados se llega a Mis Pokémon (${await page.title()})`);
  await page.tap('Volver');
  await page.waitFor(`document.querySelector('.story-path')`);
  ok(await page.title() === 'Historia', `y Volver deja en Historia, donde empezó el combate (${await page.title()})`);
};
