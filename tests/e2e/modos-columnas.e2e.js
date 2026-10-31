// Torre, Partida rápida y Práctica sin bajar por la pantalla: en la Torre, a la izquierda eliges equipo y a la derecha
// ves el ranking; en Partida rápida buscas desde la cabecera; en Práctica, Pokémon a la izquierda y mapas a la derecha.
const lado = (page, a, b) => page.eval(`(() => {
  const rect = q => { const e = [...document.querySelectorAll('h3, h4, button, b, span')].find(x => x.children.length < 3 && x.innerText.trim().toLowerCase().startsWith(q.toLowerCase()) && x.getClientRects().length); return e && e.getBoundingClientRect(); };
  const x = rect(${JSON.stringify(a)}), y = rect(${JSON.stringify(b)});
  return x && y ? { izq: x.right <= y.left, junto: x.top < innerHeight && y.top < innerHeight } : null; })()`);

const columnas = SIZES => async ({ page, player, ok }) => {
  const me = await player({ user: 'columnas' });
  me.client.send({ t: 'dev', dex: 4, level: 30, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  for (const [w, h, touch] of SIZES) {
    await page.resize(w, h);
    if (touch) { await page.eval("localStorage.setItem('arena.touch', '1'); true"); await page.loginAs(me.token); }
    const en = `${w}×${h}`;

    await page.tap(/^Torre Batalla/);
    await page.waitSee('Elige tu equipo');
    ok(await page.see('Ranking de la Torre'), `${en}: el ranking de la Torre se ve sin bajar`);
    const torre = await lado(page, 'Elige tu equipo', 'Ranking de la Torre');
    ok(torre && torre.izq && torre.junto, `${en}: el equipo a la izquierda y el ranking a la derecha (${JSON.stringify(torre)})`);
    await page.tap('Volver');

    await page.tap(/^Partida rápida/);
    await page.waitSee('Partida rápida');
    ok(await page.see(/Buscar partida rápida/, { in: '.inner-bar' }), `${en}: buscar partida se ve en la cabecera`);
    await page.tap('Volver');

    await page.tap(/^Práctica/);
    await page.waitSee('Dificultad');
    ok(await page.see('Empezar', { in: '.inner-bar' }), `${en}: «Empezar» se ve en la cabecera`);
    ok(await page.see('Arena'), `${en}: los mapas se ven sin bajar`);
    const prac = await lado(page, 'Venusaur', 'Arena');
    ok(prac && prac.izq && prac.junto, `${en}: los Pokémon a la izquierda y los mapas a la derecha (${JSON.stringify(prac)})`);
    await page.tap('Volver');
  }
};
module.exports = columnas([[1280, 800, false]]);
module.exports.columnas = columnas;
