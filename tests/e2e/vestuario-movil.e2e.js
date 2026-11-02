// En el móvil, el Vestuario de un Pokémon enseña casi todo de un vistazo (tarjetas compactas: al menos 12 sin bajar),
// lo que no tienes lleva un candado que se ve (dibujado, no un emoji que puede salir como un cuadro vacío), el buscador
// de Mis Pokémon se lee entero y la ficha deja margen alrededor
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'vestuariomovil' });
  for (const dex of [4, 25, 7]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  for (const [W, H] of [[844, 390], [667, 375]]) {
    await page.resize(W, H);
    await page.goto('/');
    await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.reload();
    await page.loginAs(me.token);
    await page.tap('Mis Pokémon');
    await page.waitSee('Equipo');
    // El buscador: su texto de ayuda cabe en la caja (medido con la letra que lleva de verdad)
    const busca = await page.eval(`(() => { const i = document.querySelector('.mon-filters input'), s = getComputedStyle(i), c = document.createElement('canvas').getContext('2d');
      c.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
      const sitio = i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), r = i.getBoundingClientRect();
      return { texto: Math.ceil(c.measureText(i.placeholder).width), sitio: Math.floor(sitio), dentro: r.left >= 0 && r.right <= innerWidth }; })()`);
    ok(busca.texto <= busca.sitio && busca.dentro, `${W}×${H}: «${'Buscar por nombre'}» se lee entero en el buscador (${busca.texto} px de texto, ${busca.sitio} de sitio)`);
    await page.click('.mon-card');
    await page.waitSee('Vestuario', { in: '.mon-sheet' });
    await page.tap(/^Vestuario/, { in: '.mon-sheet' });
    await page.waitSee('Todos', { in: '.mon-sheet' });
    // La ficha (ya abierta del todo) deja margen, pero sin quedarse estrecha: no llega a los bordes ni se encoge
    const ficha = await page.eval(`(() => { const r = document.querySelector('.mon-sheet').getBoundingClientRect(); return { izq: Math.round(r.left), der: Math.round(innerWidth - r.right) }; })()`);
    ok(ficha.izq >= 10 && ficha.der >= 10 && ficha.izq <= 40 && ficha.der <= 40, `${W}×${H}: la ficha deja margen a los lados sin encogerse (${ficha.izq} y ${ficha.der} px)`);
    // Cuántas opciones se ven enteras dentro de la ficha, sin bajar
    const vista = await page.eval(`(() => { const sc = document.querySelector('.mon-sheet .ms-body'), b = sc.getBoundingClientRect();
      const all = [...document.querySelectorAll('.mon-sheet .ms-wear')];
      const enteras = all.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; });
      const lock = document.querySelector('.mon-sheet .ms-wear.locked .wear-lock'), lr = lock && lock.getBoundingClientRect();
      return { total: all.length, enteras: enteras.length, candado: !!lr && lr.width >= 10 && lr.height >= 10 && getComputedStyle(lock).visibility !== 'hidden' && lock.tagName.toLowerCase() === 'svg' }; })()`);
    ok(vista.enteras >= 12, `${W}×${H}: el Vestuario enseña al menos 12 opciones sin bajar (${vista.enteras} de ${vista.total})`);
    ok(vista.candado, `${W}×${H}: lo que no tienes lleva un candado dibujado que se ve`);
  }
};
