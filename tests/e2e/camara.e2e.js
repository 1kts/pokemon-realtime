// Cámara del combate: se ve el campo entero y centrado, y las esquinas de abajo quedan por encima de la
// barra de movimientos (antes se podía esconder un Pokémon ahí, fuera de la pantalla o bajo el HUD)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'camara' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); window.__app.ui.startStory('route', 'k-ruta1'); true`);
  await page.waitFor(`!!window.__app.battle && !!document.querySelector('.moves .mv')`);

  // Esquinas del campo en pantalla (la cámara ya está colocada para el combate)
  const r = await page.eval(`(() => {
    const cam = window.__app.world.camera, V = cam.position.constructor;
    cam.updateMatrixWorld();
    const at = (x, z) => { const v = new V(x, 0, z).project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
    const C = Shared.COLS, R = Shared.ROWS;
    return { corners: [at(0, 0), at(C, 0), at(0, R), at(C, R)], movesTop: document.querySelector('.moves').getBoundingClientRect().top, w: innerWidth, h: innerHeight };
  })()`);
  ok(r.corners.every(c => c.x >= 0 && c.x <= r.w && c.y >= 0 && c.y <= r.h), 'las 4 esquinas del campo se ven en pantalla');
  ok(r.corners.slice(2).every(c => c.y < r.movesTop), 'las esquinas de abajo quedan por encima de la barra de movimientos');
  const mid = (r.corners[0].y + r.corners[2].y) / 2;
  ok(Math.abs(mid - r.h / 2) < r.h * 0.06, 'el campo está centrado en vertical (no pegado arriba)');
};
