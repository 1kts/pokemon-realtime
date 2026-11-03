// Abrir el juego es rápido también con mala red: mientras carga la portada no se baja nada que no haga falta para verla
// (la música y las letras de chino, japonés y coreano se piden cuando la página ya ha cargado, sin competir con ella),
// y la música del menú llega igual, sin bajar de golpe la del resto del juego
module.exports = async ({ page, ok }) => {
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true]]) {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); ${touch ? "localStorage.setItem('arena.touch', '1');" : ''} true`);
    await page.reload();
    await page.waitSee('Jugar');
    // (lo que tarda en bajar no se ve: se mira cuándo pidió el navegador cada cosa, de la lista de la página)
    const list = `performance.getEntriesByType('resource').map(e => ({ u: new URL(e.name).pathname, t: e.startTime }))`;
    await page.waitFor(`${list}.some(e => e.u === '/music/viaje.mp3')`, 25000).catch(() => {});
    const got = await page.eval(list), loaded = await page.eval(`performance.getEntriesByType('navigation')[0].loadEventStart`);
    const extra = got.filter(e => /^\/music\/|fonts-cjk/.test(e.u));
    const early = extra.filter(e => e.t < loaded);
    ok(loaded > 0 && !early.length, `${W}×${H}: hasta que carga la portada no se pide música ni letras de otros idiomas${early.length ? ` (${early.slice(0, 4).map(e => e.u).join(', ')}${early.length > 4 ? '…' : ''})` : ''}`);
    ok(extra.some(e => e.u === '/music/pueblo.mp3'), `${W}×${H}: después llega la música del menú`);
    const more = extra.filter(e => e.u.startsWith('/music/') && !/\/(pueblo|viaje)\.mp3$/.test(e.u));
    ok(!more.length, `${W}×${H}: sin bajar de golpe la música del resto del juego${more.length ? ` (${more.length} temas más)` : ''}`);
  }
};
