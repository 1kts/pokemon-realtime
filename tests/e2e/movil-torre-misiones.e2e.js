// Móvil en horizontal: el ranking de la Torre con avatares que caben (y el 4.º en su fila, como los demás), «Retirarse»
// a la vista en una racha y los movimientos de cada Pokémon del equipo; Misiones sin el hueco bajo el premio diario; y la
// Historia sin una franja vacía entre el Camino y la barra de abajo
module.exports = async ({ page, player, ok }) => {
  for (const [n, best, dex] of [['Iloveredsaurio', 20, 6], ['Zerathul', 4, 130], ['Kaiser', 2, 94], ['Portte', 1, 25]]) {
    const o = await player({ user: n.toLowerCase(), name: n });
    o.client.send({ t: 'dev', dex, level: 50, region: 'kanto', towerBest: best }); await o.client.wait(m => m.t === 'profile');
  }
  const me = await player({ user: 'torremovil' });
  me.client.send({ t: 'dev', dex: 3, level: 50, region: 'kanto', badges: 1 });
  const pr = await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390); await page.goto('/');
  await page.eval("localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.storyGuide', '1'); true");
  await page.loginAs(me.token);

  // 1. Torre: empezar una racha con su Venusaur y dos de alquiler
  await page.mode('Torre Batalla');
  me.client.send({ t: 'tower', a: 'start', team: [{ uid: pr.p.mons[0].uid }, { dex: 6 }, { dex: 9 }] });
  await me.client.wait(m => m.t === 'profile' && m.p.tower && m.p.tower.team);
  await page.loginAs(me.token);
  await page.mode('Torre Batalla');
  await page.waitSee('Portte', { in: '.tower-board' });
  const rank = await page.eval(`(() => { const box = document.querySelector('.tower-board');
    const li = [...box.querySelectorAll('li')].find(l => /portte/i.test(l.textContent)), name = li.querySelector('.who b').getBoundingClientRect(), num = li.querySelector('.pts').getBoundingClientRect();
    const avas = [...box.querySelectorAll('.pod-stage')].map(s => Math.round(s.getBoundingClientRect().width));
    return { sameLine: Math.abs((name.top + name.bottom) / 2 - (num.top + num.bottom) / 2) < 8, nameW: Math.round(name.width), avas }; })()`);
  ok(rank.sameLine && rank.nameW > 30, `el 4.º del ranking, en su fila: nombre y récord en la misma línea (${JSON.stringify(rank)})`);
  ok(rank.avas.every(w => w <= 56), `los avatares del podio caben en la columna estrecha (${rank.avas.join(', ')} px)`);
  const retire = await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Retirarse'); const r = b && b.getBoundingClientRect(); return r ? Math.round(r.bottom) : -1; })()`);
  ok(retire > 0 && retire <= 390, `en la racha, «Retirarse» se ve sin bajar (abajo en ${retire} px de 390)`);
  ok(await page.see('Rayo Solar', { in: '.tower-team', scroll: true }) && await page.see('se pueden cambiar también a mitad de racha', { scroll: true }),
    'cada Pokémon del equipo enseña sus movimientos, y dónde se cambian');
  await page.tap('Retirarse');
  await page.waitSee('¿Retirarte?');
  await page.tap('Retirarse', { in: '.ui-confirm-box' });
  await page.waitSee('Elige tu equipo');
  ok(true, 'y con confirmación acaba la racha');

  // 2. Misiones: cada panel justo debajo del anterior de su columna (sin el hueco bajo el premio diario)
  await page.loginAs(me.token);
  await page.click('button.mw-title');
  await page.waitSee('Misiones semanales', { in: '.mv-body', scroll: true });
  const gap = await page.eval(`(() => { const ps = [...document.querySelectorAll('.mv-body > *')].map(e => e.getBoundingClientRect());
    let worst = 0; ps.forEach((r, i) => { const above = ps.filter((q, j) => j !== i && Math.abs(q.left - r.left) < 20 && q.bottom <= r.top + 1).sort((a, b) => b.bottom - a.bottom)[0];
      if (above) worst = Math.max(worst, r.top - above.bottom); }); return Math.round(worst); })()`);
  ok(gap <= 24, `Misiones: cada panel justo bajo el de encima en su columna, sin huecos (el mayor: ${gap} px)`);

  // 3. Historia con el juego instalado (~915×412): el Camino llega hasta la barra de abajo
  await page.resize(915, 412);
  await page.loginAs(me.token);
  await page.tap(/Historia/);
  await page.waitSee('Explorar');
  const band = await page.eval(`(() => { const a = document.querySelector('.story-pathwrap').getBoundingClientRect(), b = document.querySelector('.story-side').getBoundingClientRect(); return Math.round(b.top - a.bottom); })()`);
  ok(band <= 16, `Historia: sin franja vacía entre el Camino y la barra de abajo (${band} px)`);
  // (y el nombre de cada parada, entero: el del gimnasio bloqueado, «Lt. Surge», se cortaba por arriba y por abajo)
  const cut = await page.eval(`[...document.querySelectorAll('.sp-name')].filter(e => e.getBoundingClientRect().width).filter(e => {
    const box = e.getBoundingClientRect(), line = (e.querySelector('b') || e).getBoundingClientRect();
    return line.top < box.top - 1 || line.height > box.height + 1; }).map(e => e.textContent.trim())`);
  ok(!cut.length && await page.see('Lt. Surge', { in: '.story-path', scroll: true }), `Historia: el nombre de cada parada se lee entero (cortados: ${cut.join(', ') || 'ninguno'})`);
};
