// La cámara del combate en el móvil va cerca, pero tu Pokémon se ve siempre: en las cuatro esquinas de la arena queda
// dentro de la pantalla, con su nombre y su vida a la vista, y sin que lo tapen el joystick ni los botones.
const paso = (page, dx, dy, hasta) => (async () => {
  // Andar con el dedo hasta el borde: se mantiene el joystick hasta que el Pokémon deja de avanzar
  await page.fingerAt(120, 280);
  await page.fingerMove(120 + dx * 25, 280 + dy * 25);
  await page.fingerMove(120 + dx * 50, 280 + dy * 50);
  // atajo: la posición dentro de la arena 3D no tiene elemento que buscar
  await page.waitFor(hasta, 25000).catch(() => {});
  await page.fingerUp();
  await page.waitFor(`!document.querySelector('.tc-base.on')`);
})();
module.exports = async ({ page, player, ok, log }) => {
  for (const [W, H] of [[844, 390], [667, 375]]) {
    const me = await player({ user: 'camara' + W });
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.touch', '1'); true`);
    await page.loginAs(me.token);
    await page.waitSee('Práctica');
    // atajo: Práctica con un rival quieto (passive), que la interfaz no deja elegir
    await page.eval(`window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1]], skill: 0, passive: true, map: 'pradera' }); true`);
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
    for (const [nombre, dx, dy, cx, cy] of [['arriba a la izquierda', -1, -1, '< 60', '< 60'], ['arriba a la derecha', 1, -1, '> 900', '< 60'], ['abajo a la derecha', 1, 1, '> 900', '> 540'], ['abajo a la izquierda', -1, 1, '< 60', '> 540']]) {
      await paso(page, dx, 0, `window.__app.battle.pred.x ${cx}`);
      await paso(page, 0, dy, `window.__app.battle.pred.y ${cy}`);
      // (la cámara tarda un poco en llegar)
      await page.eval(`new Promise(r => setTimeout(() => r(true), 900))`);
      // atajo: dónde cae tu Pokémon en la pantalla: el 3D no tiene elemento que buscar
      const v = await page.eval(`(() => { const b = window.__app.battle, m = b.renderPos[b.you], p = b.toScreen(m.x, m.y), s = 26;
        const hit = q => [...document.querySelectorAll(q)].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()).some(r => p.x + s > r.left && p.x - s < r.right && p.y + s > r.top && p.y - 2 * s < r.bottom);
        const n = b.plates[b.you].getBoundingClientRect();
        return { x: Math.round(p.x), y: Math.round(p.y), dentro: p.x > s && p.x < innerWidth - s && p.y > 2 * s && p.y < innerHeight - s, tapado: hit('.mv, .tc-base, .tc-zone .stick, .balls .ball'), nombre: n.left >= 0 && n.right <= innerWidth && n.top >= 0 && n.bottom <= innerHeight }; })()`);
      ok(v.dentro && !v.tapado, `${W}×${H}, ${nombre}: tu Pokémon se ve y no lo tapan los controles (${JSON.stringify(v)})`);
      ok(v.nombre, `${W}×${H}, ${nombre}: su nombre y su vida caben en la pantalla (${JSON.stringify(v)})`);
    }
    await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);   // atajo: acabar la práctica sin pasar por la ventana de rendirse: aquí no se prueba
    await page.waitFor(`document.querySelector('.results')`, 20000).catch(() => {});
  }
};
