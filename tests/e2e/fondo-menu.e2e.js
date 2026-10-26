// Fondo de los menús: la cámara ya no da vueltas a la arena (mareaba); se queda en un sitio y solo se
// mece un poco, como mucho unos grados a cada lado
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.camera`);
  // (en el CI, lento, a veces tarda más de dos fotogramas: se deja asentar un segundo y medio)
  await page.eval(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
  await new Promise(r => setTimeout(r, 1500));
  // Las muestras se toman dentro de la página, con su reloj: 6 s de verdad aunque la máquina vaya lenta (desde
  // fuera, en el CI cada consulta tardaba tanto que los «6 s» eran medio minuto y la cámara daba el vaivén entero)
  const samples = await page.eval(`new Promise(r => { const out = [], t0 = performance.now();
    const tick = () => { const p = window.__app.camera.position; out.push([p.x, p.y, p.z]); if (performance.now() - t0 < 6000) setTimeout(tick, 250); else r(out); };
    tick(); })`);
  const first = samples[0];
  const angles = samples.map(([x, , z]) => Math.atan2(x - first[0], z - first[2] + 15) * 180 / Math.PI);   // alrededor del centro de la arena
  const moves = samples.map(([x, y, z]) => Math.hypot(x - first[0], y - first[1], z - first[2]));
  const spread = Math.max(...angles) - Math.min(...angles);
  ok(spread < 8, `en 6 s la cámara gira ${spread.toFixed(1)}° alrededor de la arena (antes daba la vuelta: unos 20°)`);
  ok(Math.max(...moves) < 3.5, `y no se aleja de su sitio (${Math.max(...moves).toFixed(2)} como mucho)`);
  ok(Math.max(...moves) > 0.01, 'pero sigue viva: se mece un poco');
};
