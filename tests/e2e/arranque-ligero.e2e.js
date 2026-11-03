// Abrir el juego es rápido también con mala red: no se baja de golpe la música de todo el juego (eran 20 MB a los 4 s en
// el ordenador), solo la del menú y la de los salvajes, y las letras de chino, japonés y coreano se piden cuando la página
// ya ha cargado, sin bloquear la portada
module.exports = async ({ page, ok }) => {
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true]]) {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); ${touch ? "localStorage.setItem('arena.touch', '1');" : ''} true`);
    await page.reload();
    await page.waitSee('Jugar');
    // (lo que tarda en bajar no se ve: se mira cuándo pidió el navegador cada cosa, de la lista de la página)
    const list = `performance.getEntriesByType('resource').map(e => ({ u: new URL(e.name).pathname, t: e.startTime }))`;
    // (se espera a que pida la de los salvajes, a los 4 s, y un poco más: lo que se pidiera de golpe ya estaría)
    await page.waitFor(`${list}.some(e => e.u === '/music/viaje.mp3') && ${list}.some(e => e.u.endsWith('fonts-cjk.css'))`, 25000).catch(() => {});
    await page.eval(`new Promise(r => setTimeout(() => r(true), 1500))`);
    const got = await page.eval(list), loaded = await page.eval(`performance.getEntriesByType('navigation')[0].loadEventStart`);
    const cjk = got.filter(e => e.u.endsWith('fonts-cjk.css'));
    ok(cjk.length && loaded > 0 && cjk.every(e => e.t >= loaded), `${W}×${H}: las letras de otros idiomas se piden cuando la portada ya ha cargado`);
    ok(got.some(e => e.u === '/music/pueblo.mp3') && got.some(e => e.u === '/music/viaje.mp3'), `${W}×${H}: la música del menú y la de los salvajes sí llegan`);
    const more = got.filter(e => e.u.startsWith('/music/') && !/\/(pueblo|viaje)\.mp3$/.test(e.u));
    ok(!more.length, `${W}×${H}: sin bajar de golpe la música del resto del juego${more.length ? ` (${more.length} temas más)` : ''}`);
  }
};
