// Historia en el móvil, en una sola pantalla: el Camino arriba y, debajo, una franja con lo elegido (nombre, sus Pokémon,
// capturados y el botón de jugar), sin bajar la página. El detalle no se pierde: está en «Más».
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'unapantalla' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto', badges: 3 }); await me.client.wait(m => m.t === 'profile');
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.storyGuide', '1'); true`);
  const mide = `(() => { const p = document.querySelector('.story-pathwrap').getBoundingClientRect(), i = document.querySelector('.story-side .node-info').getBoundingClientRect();
    return { baja: document.scrollingElement.scrollHeight - innerHeight + document.querySelector('#screen').scrollHeight - document.querySelector('#screen').clientHeight, encima: p.bottom <= i.top + 1, alto: i.height, dentro: i.bottom <= innerHeight + 1 }; })()`;
  for (const [w, h] of [[844, 390], [667, 375]]) {
    const en = `${w}×${h}`;
    await page.resize(w, h);
    await page.loginAs(me.token);
    await page.tap(/^Historia/);
    await page.waitSee('Explorar', { in: '.node-info' });
    const m = await page.eval(mide);
    ok(m.baja <= 1, `${en}: Historia cabe en una pantalla, sin bajar (sobran ${m.baja} px)`);
    ok(m.encima && m.dentro && m.alto <= 96, `${en}: la franja de lo elegido va debajo del Camino, fina y a la vista (${JSON.stringify(m)})`);
    ok(await page.see(/\d+\/\d+ capturados/, { in: '.node-info', ms: 0 }), `${en}: dice cuántos llevas capturados`);
    ok(!(await page.see(/\d+ %/, { in: '.node-info', ms: 0 })) && !(await page.see('Debilítalo', { in: '.node-info', ms: 0 })), `${en}: sin porcentajes ni textos largos`);
    await page.tap('Más', { in: '.node-info' });
    await page.waitSee(/\d+ %/, { in: '.node-info' });
    ok(await page.see('Debilítalo', { in: '.node-info', scroll: true }), `${en}: «Más» enseña el detalle`);
    await page.tap('Menos', { in: '.node-info' });
    await page.waitSee(/\d+\/\d+ capturados/, { in: '.node-info' });
    await page.click('.sp-gym.now');
    await page.waitSee('Erika', { in: '.node-info' });
    ok(await page.see('¡Desafiar!', { in: '.node-info' }), `${en}: con un gimnasio, el líder y «¡Desafiar!» a la vista`);
    const g = await page.eval(mide);
    ok(g.baja <= 1 && g.alto <= 96, `${en}: el gimnasio tampoco baja la página (${JSON.stringify(g)})`);
  }
};
