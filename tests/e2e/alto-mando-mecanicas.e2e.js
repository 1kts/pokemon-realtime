// El Alto Mando con las mecánicas nuevas de los gimnasios: en un combate en cada sala (Práctica), la etiqueta de la
// arena dice lo que tiene ahora (manos, imanes, arenas movedizas, esporas, grietas de lava y vagonetas), y en la del
// Campeón la vagoneta avisa en pantalla antes de cruzar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'altomando' });
  me.client.send({ t: 'dev', dex: 6, level: 50, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.mode('Práctica');
  const salas = [['Cripta Espectral', /salen manos del suelo/], ['Sala de las Sombras', /imanes que curvan/], ['Dojo de Roca', /arenas movedizas/],
    ['Dojo Ninja', /nubes de esporas/], ['Guarida del Dragón', /suelo que se agrieta/], ['Sala del Campeón', /vagonetas que cruzan/]];
  for (const [i, [sala, dice]] of salas.entries()) {
    if (!(await page.see(/Empezar \(/, { ms: 0 }))) await page.click('.pool-card');   // (el equipo, si no queda elegido)
    await page.tap(sala, { in: '.practice-arenas' });
    await page.tap(/^Empezar/);
    ok(await page.see(dice, { in: '.arena-tag', ms: 15000 }), `en combate en «${sala}», la etiqueta de la arena dice que tiene ${dice.source}`);
    if (i === salas.length - 1) {
      ok(await page.see('¡Vagoneta! Sal de la vía que se ilumina', { ms: 20000 }), 'en la Sala del Campeón, la vagoneta avisa en pantalla antes de cruzar');
      break;
    }
    await page.key('Escape');
    await page.tap('Rendirse', { in: '.ui-confirm-box' });
    await page.tap('Volver');   // (vuelve a Práctica)
  }
};
