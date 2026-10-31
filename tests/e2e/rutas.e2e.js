// Rutas de la Historia: la ficha de cada ruta enseña las 4 especies de esta tanda de 6 horas (con su
// probabilidad), su especial en silueta hasta que lo atrapas (en el Bosque Verde, Pikachu), cuándo cambian
// y, plegado, todo lo que puede salir allí. Se abre tocando su tarjeta en el Camino
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rutera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.tap(/^Historia/);
  await page.waitFor(`[...document.querySelectorAll('.story-path .sp-route')].some(b => /Bosque Verde/.test(b.title + b.getAttribute('aria-label')))`);
  // (en el Camino, la tarjeta del Bosque Verde: se lleva a la vista y se toca)
  await page.eval(`(() => { const b = [...document.querySelectorAll('.story-path .sp-route')].find(b => /Bosque Verde/.test(b.title + b.getAttribute('aria-label'))); b.classList.add('bv-test'); document.querySelector('.story-path').style.scrollBehavior = 'auto'; b.scrollIntoView({ inline: 'center', block: 'nearest' }); return true; })()`);   // atajo: desplazar el camino hasta el Bosque Verde
  await page.click('.bv-test');
  await page.waitFor(`/Bosque Verde/.test(document.querySelector('.story-side .node-info h3').textContent)`);
  await page.waitFor(`document.querySelector('.route-list')`);
  ok(await page.eval(`document.querySelectorAll('.route-list .mini:not(.rare)').length === 4`), 'la ficha del Bosque Verde enseña las 4 especies de esta tanda');
  // (el especial, en la misma lista, el último, en silueta y dorado: su borde, tal como se pinta)
  const sp = await page.eval(`(() => { const all = [...document.querySelectorAll('.route-list .mini')], r = document.querySelectorAll('.route-list .mini.rare'), last = all[all.length - 1];
    const [R, G, B] = getComputedStyle(last).borderTopColor.match(/[\\d.]+/g).map(Number);
    return { n: r.length, last: r[0] === last, hidden: /\\?\\?\\?/.test(last.textContent), gold: R > 200 && G > 160 && B < 120 }; })()`);
  ok(sp.n === 1 && sp.last && sp.hidden && sp.gold, `y su especial en la misma lista, al final, en silueta y en dorado (${JSON.stringify(sp)})`);
  ok(await page.eval(`document.querySelectorAll('.route-all .ra').length === Data.NODES['k-ruta2'].wild.length + 1 && /Pueden salir aquí \\(8\\)/.test(document.querySelector('.route-all summary').textContent)`), 'plegado, todo lo que puede salir allí: sus 7 especies y Pikachu');

};
