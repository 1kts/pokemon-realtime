// El menú en escritorio aprovecha la pantalla: PvP en grande, con Práctica y Tutorial debajo, y las tres columnas
// (los modos, tu colección con las misiones y la Ladder) llegan igual de abajo, sin hueco vacío debajo de ninguna.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Columnas' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 });
  await me.client.wait(m => m.t === 'profile');
  for (const [w, h] of [[1772, 1005], [1440, 900], [1280, 800]]) {
    await page.resize(w, h);
    await page.loginAs(me.token);
    await page.waitSee('Práctica');
    await page.waitSee('Ladder', { in: '.ladder-panel' });
    const caja = q => `(() => { const r = document.querySelector('${q}').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; })()`;
    const pvp = await page.eval(caja('.menu-card.ranked')), story = await page.eval(caja('.menu-card.story'));
    const prac = await page.eval(caja('.menu-card.practice')), tuto = await page.eval(caja('.menu-card.tutorial'));
    ok(pvp.w >= story.w - 2 && pvp.h >= 180, `${w}×${h}: PvP se ve en grande, como Historia (${Math.round(pvp.w)}×${Math.round(pvp.h)} px)`);
    ok(prac.y >= pvp.b && tuto.y >= pvp.b && Math.abs(prac.y - tuto.y) < 2, `${w}×${h}: Práctica y Tutorial, juntos debajo de PvP`);
    ok(prac.x < tuto.x && tuto.r <= pvp.r + 1 && prac.x >= pvp.x - 1, `${w}×${h}: y entre los dos ocupan el ancho de PvP`);
    // Los bordes de abajo de las columnas
    const lad = await page.eval(caja('.ladder-panel')), side = await page.eval(caja('.menu-side'));
    const fondo = Math.max(tuto.b, side.b, lad.b);
    ok(fondo - lad.b < 4, `${w}×${h}: la Ladder llega tan abajo como las otras columnas (le faltan ${Math.round(fondo - lad.b)} px)`);
    ok(fondo - tuto.b < 4, `${w}×${h}: los modos también (les faltan ${Math.round(fondo - tuto.b)} px)`);
    ok(fondo - side.b < 4, `${w}×${h}: y la colección con las misiones (le faltan ${Math.round(fondo - side.b)} px)`);
    ok(fondo <= h, `${w}×${h}: todo cabe en la pantalla sin bajar (llega a ${Math.round(fondo)} px)`);
    if (process.env.SHOT) await page.shot(`${process.env.SHOT}-${w}.png`);
  }
};
