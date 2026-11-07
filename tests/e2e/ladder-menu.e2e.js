// En el menú se ve la ladder: el top 5 de Clasificatoria y tu puesto, sin entrar en ella; «Ver todo» la abre.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Aspirante' });
  const rival = await player({ user: 'Campeona' });
  rival.client.send({ t: 'dev', elo: 2200, ranked: 5, dex: 4, level: 5, region: 'kanto' }); await rival.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', elo: 1300, ranked: 5 }); await me.client.wait(m => m.t === 'profile');
  for (const [w, h, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    await page.resize(w, h);
    if (touch) await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.waitSee('Campeona', { in: '.ladder-panel' });
    ok(await page.see('2200', { in: '.ladder-panel' }), `${w}×${h}: el menú enseña a la primera de la ladder con su ELO`);
    ok(await page.see(/Tu posición|Tú: puesto \d+ de \d+|Aspirante/, { in: '.ladder-panel' }), `${w}×${h}: y dónde estás tú`);
    // Cada fila se ve con la cara del entrenador y, la primera, con la medalla y su liga; en escritorio, con sitio de sobra
    const fila = await page.eval(`(() => { const li = [...document.querySelectorAll('.ladder-panel li, .ladder-panel .lp-card')].find(x => x.innerText.includes('Campeona')), pic = li.querySelector('img, canvas, svg'), r = li.getBoundingClientRect(), p = pic && pic.getBoundingClientRect(), panel = document.querySelector('.ladder-panel').getBoundingClientRect(); return { alto: r.height, cara: p ? p.width : 0, liga: li.innerText, panel: panel.height, ancho: panel.width, medalla: getComputedStyle(li.querySelector('i')).backgroundImage !== 'none' }; })()`);
    ok(fila.cara >= (touch ? 16 : 28), `${w}×${h}: la fila lleva la cara del entrenador (${fila.cara} px)`);
    ok(fila.medalla, `${w}×${h}: el top 3 lleva su medalla de color`);
    if (!touch) {
      ok(/Maestr|Diamante|Platino|Oro/.test(fila.liga), `${w}×${h}: la fila dice su liga (${fila.liga.replace(/\s+/g, ' ')})`);
      ok(fila.alto >= 34 && fila.panel >= 230, `${w}×${h}: el panel se ve grande (fila ${fila.alto}, panel ${fila.panel})`);
    }
  }
  // En escritorio es una columna: temporada, tablas, podio y la clasificación completa
  await page.resize(1280, 800);
  await page.eval("localStorage.removeItem('arena.touch'); true");
  await page.loginAs(me.token);
  await page.waitSee('Campeona', { in: '.ladder-panel' });
  // El podio, como el de la ladder completa: corona al primero y, en cada tarjeta, rayos tras la cara y destellos que se mueven
  ok(await page.see('♛', { in: '.ladder-panel' }), 'el primero de la ladder del menú lleva su corona');
  const brillo = await page.eval(`[...document.querySelectorAll('.ladder-panel .lp-card')].slice(0, 3).map(c => { const rays = c.querySelector('.pod-rays'), sp = c.querySelectorAll('.pod-sparks i');
    return !!rays && rays.getBoundingClientRect().width > 40 && sp.length >= 4 && getComputedStyle(sp[0]).animationName !== 'none'; })`);
  ok(brillo.length === 3 && brillo.every(Boolean), `y los tres del podio, rayos y destellos (${JSON.stringify(brillo)})`);
  ok(await page.see(/Temporada 1/, { in: '.ladder-panel' }) && await page.see(/Termina en|Último día/, { in: '.ladder-panel' }), 'la cabecera dice la temporada y cuánto le queda');
  ok(await page.see('Premios de temporada', { in: '.ladder-panel', scroll: true }), 'y sus premios');
  const col = await page.eval(`(() => { const r = q => document.querySelector(q).getBoundingClientRect(), p = r('.ladder-panel'), m = r('.menu-main'), s = r('.menu-side'), top = [...document.querySelectorAll('.lp-top > *')], a = document.querySelector('.lp-top .ava, .lp-top .lp-face').getBoundingClientRect(), caja = top[0].getBoundingClientRect();
    return { columna: s.left >= m.right && p.left >= s.right, alto: p.height, podio: top.length, ancho: caja.width / p.width, cara: a.width, fuera: a.top < caja.top }; })()`);
  ok(col.columna, `el panel es la columna de la derecha del todo, tras los modos y tu colección (${JSON.stringify(col)})`);
  ok(col.podio >= 2 && col.ancho > 0.8 && col.cara >= 52 && col.fuera, `el top 3 va en tarjetas anchas con la foto grande, que sobresale (${JSON.stringify(col)})`);
  ok(col.alto <= 800, `cabe sin estirar la pantalla (${col.alto} px)`);
  // (ninguna cara en blanco: un retrato copiado por HTML saldría vacío)
  ok(await page.waitFor(`[...document.querySelectorAll('.ladder-panel canvas')].every(c => c.width && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v))`, 8000).then(() => true, () => false), 'todas las caras del panel se ven');
  // Las tablas se cambian desde el panel
  await page.tap('Pokédex', { in: '.lp-tabs' });
  await page.waitSee('Especies', { in: '.ladder-panel' });
  ok(await page.see('Pokédex', { in: '.lp-tabs' }), 'la pestaña elegida dice su nombre');
  await page.tap('PvP', { in: '.lp-tabs' });
  await page.waitSee('2200', { in: '.ladder-panel' });
  await page.tap('Ver la ladder completa', { in: '.ladder-panel' });
  await page.waitSee('Buscar entrenador', { ms: 0 }).catch(() => {});
  ok(await page.title() === 'Ladder', 'y «Ver todo» abre la ladder');
};
