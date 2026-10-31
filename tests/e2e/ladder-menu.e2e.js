// En el menú se ve la ladder: el top 5 de Clasificatoria y tu puesto, sin entrar en ella; «Ver todo» la abre.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Aspirante' });
  const rival = await player({ user: 'Campeona' });
  rival.client.send({ t: 'dev', elo: 2200, ranked: 5 }); await rival.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', elo: 1300, ranked: 5 }); await me.client.wait(m => m.t === 'profile');
  for (const [w, h, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    await page.resize(w, h);
    if (touch) await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.waitSee('Campeona', { in: '.ladder-panel' });
    ok(await page.see('2200', { in: '.ladder-panel' }), `${w}×${h}: el menú enseña a la primera de la ladder con su ELO`);
    ok(await page.see(/Tú: puesto \d+ de \d+|Aspirante/, { in: '.ladder-panel' }), `${w}×${h}: y dónde estás tú`);
  }
  await page.tap('Ver todo', { in: '.ladder-panel' });
  await page.waitSee('Buscar entrenador', { ms: 0 }).catch(() => {});
  ok(await page.title() === 'Ladder', 'y «Ver todo» abre la ladder');
};
