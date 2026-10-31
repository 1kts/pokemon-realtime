// Mochila: la pantalla cabe entera en todos los tamaños y lo único que se desplaza es la lista de objetos (y el detalle,
// si es largo). Se llega al último objeto de la lista, se elige y la pantalla no se ha movido.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mochilera' });
  for (const dex of [4, 7, 25, 16]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  for (const item of ['pokeball', 'superball', 'ultraball', 'masterball', 'caramelo', 'maspsps', 'proteina', 'hierro', 'carburante', 'agua', 'trueno', 'fuego']) {
    me.client.send({ t: 'dev', item, qty: 3 }); await me.client.wait(m => m.t === 'profile');
  }
  await page.resize(844, 390);
  await page.goto('/');
  await page.eval("localStorage.setItem('arena.touch', '1'); true");
  await page.loginAs(me.token);
  await page.tap('Mochila');
  await page.waitSee(/Tienes: \d/);
  const pantalla = `(() => { const s = document.querySelector('#screen'); return { sobra: s.scrollHeight - s.clientHeight, y: s.scrollTop }; })()`;
  const lastItem = `[...document.querySelectorAll('.bag-item')].pop()`;
  for (const [w, h] of [[844, 390], [667, 375], [1280, 800]]) {
    await page.resize(w, h);
    await page.waitSee(/Tienes: \d/);
    const s = await page.eval(pantalla);
    ok(s.sobra <= 1, `en ${w}×${h} la Mochila cabe y la ventana no se desplaza (sobran ${s.sobra} px)`);
    // (en lo más estrecho, «Volver» es solo su flecha)
    const volver = await page.eval(`(() => { const r = document.querySelector('[aria-label="Volver"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; })()`);
    ok(volver, `en ${w}×${h} el botón de volver está en pantalla`);
    const dentro = await page.eval(`(() => { const l = document.querySelector('.bag-list'), r = l.getBoundingClientRect(); return { rueda: l.scrollHeight > l.clientHeight, abajo: r.bottom, alto: r.height, ventana: innerHeight }; })()`);
    ok(dentro.rueda && dentro.alto >= 100 && dentro.abajo <= dentro.ventana, `en ${w}×${h} la lista se desplaza por dentro y acaba dentro de la pantalla (alto ${dentro.alto}, hasta ${dentro.abajo} de ${dentro.ventana})`);
  }
  await page.resize(844, 390);
  await page.waitSee(/Tienes: \d/);
  const ultimo = await page.eval(`${lastItem}.querySelector('b').textContent`);
  ok(await page.see(ultimo, { in: '.bag-list', scroll: true }), `la lista llega hasta el último objeto (${ultimo})`);
  await page.tap(ultimo, { in: '.bag-list' });
  await page.waitSee(ultimo, { in: '.bag-detail' });
  const s = await page.eval(pantalla);
  ok(s.y === 0 && s.sobra <= 1, 'al elegirlo se abre su detalle y la ventana sigue en su sitio');
};
