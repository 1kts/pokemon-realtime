// La Ladder del menú llena su columna: tantos entrenadores como quepan (antes, 7 y un hueco debajo), ninguno cortado a
// medias, y abajo, siempre a la vista, tu posición con el total (o, sin puesto, cómo entrar).
module.exports = async ({ page, player, ok }) => {
  for (let i = 0; i < 10; i++) {
    const r = await player({ user: `rival${i}` });
    r.client.send({ t: 'dev', elo: 1900 - i * 40, ranked: 5, dex: 4, level: 5, region: 'kanto' }); await r.client.wait(m => m.t === 'profile');
  }
  const me = await player({ user: 'Aspirante' });
  me.client.send({ t: 'dev', elo: 1010, ranked: 5, dex: 4, level: 5, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.waitSee('rival0', { in: '.ladder-panel' });
  await page.waitSee('Tu posición', { in: '.ladder-panel' });
  const m = await page.eval(`(() => { const body = document.querySelector('.ladder-panel .lp-body'), b = body.getBoundingClientRect();
    const rows = [...body.querySelectorAll('.lp-card, .lp-rest li')].filter(e => e.getBoundingClientRect().height > 0);
    const cortadas = rows.filter(e => { const r = e.getBoundingClientRect(); return r.top < b.top - 16 || r.bottom > b.bottom + 1; }).length;
    const you = body.querySelector('.lp-you').getBoundingClientRect();
    return { n: rows.length, cortadas, tu: you.bottom <= b.bottom + 1 && you.top >= b.top }; })()`);
  ok(m.n > 7 && !m.cortadas, `la Ladder del menú enseña a más de 7 entrenadores, sin cortar ninguno (${m.n}; cortados ${m.cortadas})`);
  ok(m.tu && await page.see(/Tu posición\s*de \d+/, { in: '.ladder-panel' }), 'y abajo, a la vista, tu posición con el total');
};
