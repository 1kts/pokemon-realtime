// En el móvil, el Vestuario de un Pokémon enseña casi todo de un vistazo (tarjetas compactas: al menos 12 sin bajar),
// lo que no tienes lleva un candado que se ve (dibujado, no un emoji que puede salir como un cuadro vacío), el buscador
// de Mis Pokémon y su ayuda se leen enteros, y la ficha deja margen alrededor con sus pestañas enteras
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
    // La ayuda de arriba se lee entera (cortada con «…» parecía un fallo)
    // (page.see no ve el «…»: se mira si el texto cabe en su caja o se corta)
    const ayuda = await page.eval(`(() => { const p = [...document.querySelectorAll('#screen p')].find(x => /vence a Brock/.test(x.textContent)); return p ? { corta: p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1 } : null; })()`);
    ok(await page.see(/Tope de nivel en Kanto/) && ayuda && !ayuda.corta, `${W}×${H}: la ayuda de Mis Pokémon se lee entera, hasta «vence a Brock para subir más»`);
    await page.click('.mon-card');
    await page.waitSee('Vestuario', { in: '.mon-sheet' });
    await page.tap(/^Vestuario/, { in: '.mon-sheet' });
    await page.waitSee('Todos', { in: '.mon-sheet' });
    // La ficha (ya abierta del todo) deja margen, pero sin quedarse estrecha: no llega a los bordes ni se encoge
    const ficha = await page.eval(`(() => { const r = document.querySelector('.mon-sheet').getBoundingClientRect(); return { izq: Math.round(r.left), der: Math.round(innerWidth - r.right), arr: Math.round(r.top), aba: Math.round(innerHeight - r.bottom) }; })()`);
    ok(ficha.izq >= 10 && ficha.der >= 10 && ficha.izq <= 40 && ficha.der <= 40 && ficha.arr >= 6 && ficha.aba >= 6, `${W}×${H}: la ficha deja margen alrededor sin encogerse (${ficha.izq} y ${ficha.der} px a los lados, ${ficha.arr} y ${ficha.aba} arriba y abajo)`);
    // Sus cuatro pestañas se ven enteras junto a ‹ › ✕
    // (entera: dentro de la fila de pestañas, que recorta lo que no cabe, y sin ‹ › ✕ encima)
    const tabs = await page.eval(`(() => { const row = document.querySelector('.mon-sheet .ms-tabs').getBoundingClientRect(), nav = document.querySelector('.mon-sheet .ms-nav').getBoundingClientRect();
      return [...document.querySelectorAll('.mon-sheet .ms-tab')].filter(b => { const r = b.getBoundingClientRect(); return r.left < row.left - 1 || r.right > row.right + 1 || r.right > nav.left + 1; }).map(b => b.textContent.trim()); })()`);
    ok(await page.see('Retos', { in: '.mon-sheet' }) && !tabs.length, `${W}×${H}: las cuatro pestañas de la ficha se ven enteras junto a ‹ › ✕${tabs.length ? ' (cortadas: ' + tabs.join(', ') + ')' : ''}`);
    // Cuántas opciones se ven enteras dentro de la ficha, sin bajar
    const vista = await page.eval(`(() => { const sc = document.querySelector('.mon-sheet .ms-body'), b = sc.getBoundingClientRect();
      const all = [...document.querySelectorAll('.mon-sheet .ms-wear')];
      const enteras = all.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; });
      const lock = document.querySelector('.mon-sheet .ms-wear.locked .wear-lock'), lr = lock && lock.getBoundingClientRect();
      return { total: all.length, enteras: enteras.length, candado: !!lr && lr.width >= 10 && lr.height >= 10 && getComputedStyle(lock).visibility !== 'hidden' && lock.tagName.toLowerCase() === 'svg' }; })()`);
    ok(vista.enteras >= 12, `${W}×${H}: el Vestuario enseña al menos 12 opciones sin bajar (${vista.enteras} de ${vista.total})`);
    ok(vista.candado, `${W}×${H}: lo que no tienes lleva un candado dibujado que se ve`);
    // Y al tocar lo que no tienes dice de dónde sale (en la tarjeta compacta no cabe, y con el dedo no hay título)
    await page.tap(/^Skin Holo/, { in: '.mon-sheet' });
    await page.waitSee(/Skin Holo · \d+ victorias/);
    ok(true, `${W}×${H}: tocar «Skin Holo», que no tienes, dice de dónde sale`);
  }
};
