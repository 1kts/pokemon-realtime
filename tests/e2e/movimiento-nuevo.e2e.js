// Si un Pokémon aprende un movimiento en el combate, los resultados lo dicen y llevan a su ficha para ponérselo.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'aprendiz' });
  // (a Nv.8 aprende Lanzallamas; a 1 punto de subir: cualquier salvaje de la Ruta 1 da para el nivel, que su nivel es al azar
  // y uno de Nv.2 da 36 de los 104 que hacen falta desde cero)
  me.client.send({ t: 'dev', dex: 4, level: 7, xp: 103, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  // atajo: dejar al salvaje casi sin vida (preparar el combate) y apuntarle: el 3D no tiene elemento que buscar
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.02 }); true`);
  const foeAt = `(() => { const b = window.__app.battle; if (!b || !b.renderPos) return null; const f = b.renderPos[b.foeIdx], p = b.toScreen(f.x, f.y); return { x: p.x, y: p.y }; })()`;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !(await page.title({ ms: 0 }))) {
    const p = await page.eval(foeAt);
    if (p) await page.mouseAt(p.x, p.y, { click: true });
    await new Promise(r => setTimeout(r, 200));
  }
  await page.waitSee(/Nuevo movimiento: .*Lanzallamas/, { scroll: true });
  await page.tap('Editar movimientos');
  await page.waitSee('Lanzallamas', { in: '.mon-sheet' });
  ok(true, 'los resultados dicen qué ha aprendido y llevan a su ficha, en Movimientos');
};
