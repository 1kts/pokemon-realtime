// Al capturar un Pokémon, los resultados caben sin bajar en cualquier pantalla: qué has atrapado, lo ganado, el mote en
// una línea y los botones; los Pokémon de tu equipo que no han subido de nivel no salen.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'capturamovil' });
  let prof;
  for (const dex of [6, 9, 3]) { me.client.send({ t: 'dev', dex, level: 30, region: 'kanto' }); prof = await me.client.wait(m => m.t === 'profile'); }
  const [a, b, c] = prof.p.mons;
  const reward = { won: true, coins: 120, captured: { uid: a.uid, dex: 25, level: 4, inTeam: false },
    xp: [{ uid: a.uid, dex: a.dex, from: a.dex, xp: 40, fromLevel: 30, level: 30 }, { uid: b.uid, dex: b.dex, from: b.dex, xp: 40, fromLevel: 30, level: 31 }, { uid: c.uid, dex: c.dex, from: c.dex, xp: 40, fromLevel: 30, level: 30 }] };
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    const at = `${W}×${H}`;
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.touch', '${touch ? 1 : 0}'); localStorage.setItem('arena.iosTip', '1'); true`);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
    await page.eval(`window.__app.ui.lastMode = { kind: 'story', a: 'route', id: 'k-ruta1' }; true`);
    // atajo: atrapar uno de verdad depende de la suerte de la Poké Ball y de un combate entero en cada tamaño; se pintan sus resultados
    await page.eval(`window.__app.ui.results({ winner: 0, you: 0, captured: { dex: 25, level: 4, shiny: false }, reward: ${JSON.stringify(reward)} }); true`);
    await page.waitSee('¡Capturado!');
    ok(await page.see('Pikachu', { ms: 1000 }), `${at}: dice a quién has atrapado, sin bajar`);
    ok(await page.see('Continuar', { ms: 1000 }), `${at}: «Continuar» se ve sin bajar`);
    ok(await page.see('Seguir explorando', { ms: 1000 }), `${at}: «Seguir explorando» se ve sin bajar`);
    ok(await page.see('Guardar mote', { ms: 1000 }), `${at}: el mote se puede guardar sin bajar`);
    const form = await page.eval(`(() => { const f = document.querySelector('.nick-form'); return f.getBoundingClientRect().height; })()`);
    ok(form <= 50, `${at}: el mote va en una línea (${form} px)`);
    ok(await page.see('¿Le pones un mote?', { ms: 0 }) === false, `${at}: sin el rótulo del mote ni su aviso`);
    const rows = await page.eval(`document.querySelector('.results').innerText`);
    ok(/Blastoise/.test(rows) && !/Charizard/.test(rows) && !/Venusaur/.test(rows), `${at}: del equipo solo sale quien ha subido de nivel`);
  }
};
