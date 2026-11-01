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
  // (con el navegador del CI a 1-2 fotogramas por segundo los clics no aciertan a un rival que se mueve)
  // atajo: dejar al salvaje casi sin vida, quieto y sin atacar (preparar el combate); el 3D no tiene elemento que buscar
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.02, foeIdle: true }); true`);
  // (dónde está, en la pantalla y respecto al tuyo, en unidades de la arena)
  const foeAt = `(() => { const b = window.__app.battle; if (!b || !b.renderPos) return null; const f = b.renderPos[b.foeIdx], m = b.renderPos[1 - b.foeIdx], p = b.toScreen(f.x, f.y);
    return { x: p.x, y: p.y, dx: f.x - m.x, dy: f.y - m.y, mx: m.x, my: m.y,
      free: (document.elementFromPoint(p.x, p.y) || {}).tagName === 'CANVAS', won: !b.latest.ps[b.foeIdx].hp.some(h => h > 0) }; })()`;
  // Como un jugador: Ascuas (clic) desde lejos y andando hacia él (las rocas de la ruta paran el ascua y el paso: si no
  // avanza, rodea la roca); al lado, Placaje (botón derecho), que no lo para nada
  // (solo se pulsa si ahí está el combate, y hasta ganarlo: un aviso encima, p. ej. «¡Logro desbloqueado!» al acabar, no
  // se toca, que lleva a Misiones)
  const toward = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'KeyD' : 'KeyA') : (dy > 0 ? 'KeyS' : 'KeyW');
  const t0 = Date.now();
  let last = null, detour = 0;
  while (Date.now() - t0 < 90000 && !(await page.title({ ms: 0 }))) {
    const p = await page.eval(foeAt);
    if (!p) { await page.waitFor('window.__app.battle && window.__app.battle.renderPos', 5000).catch(() => {}); continue; }
    if (p.won) break;
    if (Math.hypot(p.dx, p.dy) < 60) { if (p.free) await page.mouseAt(p.x, p.y, { click: true, button: 'right' }); last = null; continue; }
    if (p.free) await page.mouseAt(p.x, p.y, { click: true });
    if (last && Math.hypot(p.mx - last.mx, p.my - last.my) < 2) detour = 2;
    await page.key(detour-- > 0 ? toward(p.dy, -p.dx) : toward(p.dx, p.dy), 300);
    last = p;
  }
  await page.waitFor(`window.__app.ui.view === 'results'`, 30000).catch(() => {});
  await page.waitSee(/Nuevo movimiento: .*Lanzallamas/, { scroll: true });
  await page.tap('Editar movimientos');
  await page.waitSee('Lanzallamas', { in: '.mon-sheet' });
  ok(true, 'los resultados dicen qué ha aprendido y llevan a su ficha, en Movimientos');
};
