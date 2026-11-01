// Al evolucionar sale una ventana propia: con un Caramelo Raro o varias a la vez, con lo aprendido, y cabe en el móvil.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'evoluciona' });
  me.client.send({ t: 'dev', dex: 4, level: 15, region: 'kanto', badges: 3, item: 'caramelo', qty: 1 }); await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.tap(/^Mis Pokémon/);
  await page.tap(/Caramelo Raro/);
  await page.waitSee('¡Ha evolucionado a Charmeleon!', { in: '.evo-scene' });
  ok(true, 'con un Caramelo Raro sale la ventana de la evolución');
  await page.tap('Continuar', { in: '.evo-scene' });
  ok(!(await page.see('¡Ha evolucionado a Charmeleon!', { ms: 0 })), 'y «Continuar» la cierra');

  // En el móvil cabe entera, y si evolucionan varios van de uno en uno, con lo aprendido y «Editar movimientos»
  await page.resize(844, 390);
  await page.eval(`localStorage.setItem('arena.touch', '1'); true`);
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.profile`);
  // atajo: dos evoluciones a la vez: ganarlas en combate depende del salvaje que salga y de los fps de la máquina
  const uid = await page.eval(`window.__app.ui.profile.mons[0].uid`);
  await page.eval(`import('/js/evolve.js').then(m => { m.playEvolutions(window.__app.ui, [{ uid: ${uid}, from: 5, to: 6, learned: ['lanzallamas'] }, { uid: ${uid + 1000}, from: 1, to: 2, learned: [] }]); return true; })`);
  await page.waitSee('¡Ha evolucionado a Charizard!', { in: '.evo-scene' });
  ok(await page.see('Continuar', { in: '.evo-scene' }) && await page.see('Editar movimientos', { in: '.evo-scene' }), 'en 844×390 cabe entera, con lo aprendido y «Editar movimientos»');
  await page.tap('Continuar', { in: '.evo-scene' });
  await page.waitSee('¡Ha evolucionado a Ivysaur!', { in: '.evo-scene' });
  ok(!(await page.see('Editar movimientos', { in: '.evo-scene', ms: 0 })), 'el siguiente sale después, sin botón si no ha aprendido nada');
};
