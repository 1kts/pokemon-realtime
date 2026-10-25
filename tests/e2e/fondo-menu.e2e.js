// Fondo de los menús: la cámara ya no da vueltas a la arena (mareaba); se queda en un sitio y solo se
// mece un poco, como mucho unos grados a cada lado
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.camera`);
  const sample = () => page.eval(`(() => { const p = window.__app.camera.position; return [p.x, p.y, p.z]; })()`);
  // Esperar a que el bucle de render haya colocado ya la cámara del menú (en CI la portada puede salir
  // antes del primer fotograma y la primera muestra quedaría en otro sitio)
  await page.eval(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
  const first = await sample();
  const angles = [], moves = [];
  for (let i = 0; i < 12; i++) {
    const [x, y, z] = await sample();
    angles.push(Math.atan2(x - first[0], z - first[2] + 15) * 180 / Math.PI);   // alrededor del centro de la arena
    moves.push(Math.hypot(x - first[0], y - first[1], z - first[2]));
    await new Promise(r => setTimeout(r, 500));
  }
  const spread = Math.max(...angles) - Math.min(...angles);
  ok(spread < 8, `en 6 s la cámara gira ${spread.toFixed(1)}° alrededor de la arena (antes daba la vuelta: unos 20°)`);
  ok(Math.max(...moves) < 3.5, `y no se aleja de su sitio (${Math.max(...moves).toFixed(2)} como mucho)`);
  ok(Math.max(...moves) > 0.01, 'pero sigue viva: se mece un poco');
};
