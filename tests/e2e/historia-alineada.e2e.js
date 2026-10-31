// Historia: el objetivo va sobre el Camino, con los mismos bordes, y la ficha al lado de los dos, de arriba abajo, con
// o sin siguiente líder.
module.exports = async ({ page, player, ok }) => {
  const box = sel => page.eval(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
  const cerca = (a, b) => Math.abs(a - b) <= 1;
  const mira = async cuando => {
    const [goal, path, side] = await Promise.all(['.story-head .map-goal', '.story-pathwrap', '.story-side'].map(box));
    ok(cerca(goal.l, path.l), `${cuando}: el objetivo empieza donde el Camino (${goal.l} y ${path.l})`);
    ok(cerca(goal.r, path.r), `${cuando}: el objetivo acaba donde el Camino (${goal.r} y ${path.r})`);
    ok(cerca(goal.t, side.t), `${cuando}: la ficha empieza a la altura del objetivo (${goal.t} y ${side.t})`);
    // (con líder la fila es más alta, por su retrato y su medalla)
    if (!/con siguiente/.test(cuando)) ok(goal.b - goal.t <= 100, `${cuando}: la fila del objetivo es baja y deja sitio al Camino (${goal.b - goal.t} px)`);
  };
  const me = await player({ user: 'alineada' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto', badges: 2 });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1776, 932);
  await page.loginAs(me.token);
  await page.tap('Historia');
  await page.waitSee('Cómo se juega al modo historia');   // (la primera vez se abre sola)
  await page.tap('¡A jugar!');
  await page.waitSee('Tu viaje');
  await mira('con siguiente líder');

  me.client.send({ t: 'dev', region: 'kanto', badges: 99 });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap('Historia');
  await page.waitSee(/Has completado Kanto/);
  await mira('con la región completada');
  await page.resize(1280, 800);
  await page.waitSee(/Has completado Kanto/);
  await mira('con la región completada, en 1280×800');
};
