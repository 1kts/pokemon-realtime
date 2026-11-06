// En el móvil en horizontal: el Vestuario de un Pokémon y el editor del avatar enseñan casi todo de un vistazo (al
// menos 12 opciones sin bajar, con el nombre entero), lo que no tienes lleva un candado que se ve (dibujado, no un emoji
// que puede salir como un cuadro vacío), en Mis Pokémon los filtros y la línea de ayuda caben sin cortarse, y la ficha
// deja margen alrededor con la columna del Pokémon estrecha y sin cortar nada en ninguna pestaña
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'vestuariomovil' });
  for (const dex of [4, 25, 7]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  // Las opciones que se ven enteras (dentro de su lista, sin bajar), cuántas dicen su nombre entero y en letra que se
  // lee, y si cada una de las que no tienes lleva su candado dibujado y a la vista
  const opciones = (lista, opt) => page.eval(`(() => { const sc = document.querySelector('${lista}'), b = sc.getBoundingClientRect();
    const all = [...sc.querySelectorAll('${opt}')];
    const enteras = all.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1; });
    const nombre = e => e.querySelector(':scope > b, :scope > small'), s = e => getComputedStyle(nombre(e));
    const legibles = enteras.filter(e => { const n = nombre(e); if (!n || !n.textContent.trim() || parseFloat(s(e).fontSize) < 10) return false;
      const rg = document.createRange(); rg.selectNodeContents(n); const tr = rg.getBoundingClientRect(), or = e.getBoundingClientRect();
      const recortado = n.clientHeight > 0 && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1);
      return !recortado && tr.left >= or.left - 1 && tr.right <= or.right + 1 && tr.bottom <= or.bottom + 1; });
    const bloq = all.filter(e => e.disabled);
    const sinCandado = bloq.filter(e => { const l = e.querySelector('svg.wear-lock'); if (!l) return true; const r = l.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const encima = y > b.top && y < b.bottom ? document.elementFromPoint(x, y) : l;   // (si está a la vista, nada lo tapa)
      return r.width < 10 || r.height < 10 || getComputedStyle(l).visibility === 'hidden' || !l.querySelector('rect, path') || !(encima === l || l.contains(encima)); });
    return { total: all.length, enteras: enteras.length, legibles: legibles.length, bloq: bloq.length, sinCandado: sinCandado.length }; })()`);
  for (const [W, H] of [[844, 390], [667, 375]]) {
    const en = `${W}×${H}`;
    await page.resize(W, H);
    await page.goto('/');
    await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.reload();
    await page.loginAs(me.token);
    await page.tap('Mis Pokémon');
    await page.waitSee('Equipo');
    // Mis Pokémon: el buscador se lee entero y la fila de filtros no se sale de la pantalla
    const busca = await page.eval(`(() => { const i = document.querySelector('.mon-filters input'), s = getComputedStyle(i), c = document.createElement('canvas').getContext('2d');
      c.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
      const sitio = i.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), r = i.getBoundingClientRect();
      return { texto: Math.ceil(c.measureText(i.placeholder).width), sitio: Math.floor(sitio), dentro: r.left >= 0 && r.right <= innerWidth }; })()`);
    ok(busca.texto <= busca.sitio && busca.dentro, `${en}: «Buscar por nombre o número» se lee entero en el buscador (${busca.texto} px de texto, ${busca.sitio} de sitio)`);
    const fila = await page.eval(`(() => { const f = document.querySelector('.mon-filters'), fuera = [...f.children].filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length;
      return { fuera, desliza: f.scrollWidth - f.clientWidth }; })()`);
    ok(!fila.fuera && fila.desliza <= 1, `${en}: los filtros de Mis Pokémon caben en la pantalla, sin cortarse ni deslizarse (${JSON.stringify(fila)})`);
    for (const filtro of ['Favoritos', 'Todos los tipos', 'Sin shiny', 'Sin legendarios', /Orden: nivel/])
      ok(await page.see(filtro, { in: '.mon-filters', ms: 2000 }), `${en}: el filtro «${filtro}» se ve sin deslizar la fila`);
    // La línea de ayuda: en una línea y sin cortarse; tocarla enseña la explicación entera
    const ayuda = await page.eval(`(() => { const p = document.querySelector('.teamview > .intro'), lh = parseFloat(getComputedStyle(p).fontSize) * 1.6;
      return { alto: Math.round(p.getBoundingClientRect().height), unaLinea: p.getBoundingClientRect().height <= lh + 2, cortada: p.scrollWidth > p.clientWidth + 1 || [...p.querySelectorAll('*')].some(e => e.getBoundingClientRect().right > p.getBoundingClientRect().right + 1) }; })()`);
    ok(ayuda.unaLinea && !ayuda.cortada, `${en}: la línea de ayuda de Mis Pokémon va en una línea sin cortarse (${JSON.stringify(ayuda)})`);
    ok(await page.see('Tope de nivel en Kanto', { ms: 2000 }) && await page.see('vence a Brock para subir más', { ms: 2000 }), `${en}: la línea de ayuda dice el tope de nivel y cómo subirlo`);
    await page.click('.teamview > .intro');
    await page.waitSee('solo combaten en su región');
    ok(true, `${en}: tocar la línea de ayuda enseña la explicación entera`);
    // La ficha: contenida, con margen alrededor y la columna del Pokémon estrecha
    await page.click(await page.within('Charmander', '.mon-card'));
    await page.waitSee('Vestuario', { in: '.mon-sheet' });
    await page.waitFor(`!document.getAnimations().some(a => a.playState === 'running')`, 5000);
    const ficha = await page.eval(`(() => { const r = document.querySelector('.mon-sheet').getBoundingClientRect(), side = document.querySelector('.ms-side').getBoundingClientRect();
      return { izq: Math.round(r.left), der: Math.round(innerWidth - r.right), arr: Math.round(r.top), aba: Math.round(innerHeight - r.bottom), lado: Math.round(side.width), area: +(r.width * r.height / (innerWidth * innerHeight)).toFixed(2) }; })()`);
    ok(Math.min(ficha.izq, ficha.der) >= 20 && Math.min(ficha.arr, ficha.aba) >= 6 && ficha.area <= 0.9, `${en}: la ficha deja margen alrededor y no ocupa casi toda la pantalla (${JSON.stringify(ficha)})`);
    ok(ficha.lado <= 150, `${en}: la columna del Pokémon es estrecha (${ficha.lado} px)`);
    // Ninguna pestaña corta lo suyo: se ven las cuatro y lo de dentro no se sale de lado
    for (const tab of ['Estadísticas', 'Movimientos', 'Retos', 'Vestuario']) {
      for (const otra of ['Estadísticas', 'Movimientos', 'Vestuario', 'Retos'])
        ok(await page.see(otra, { in: '.ms-tabs', ms: 2000 }), `${en}: en ${tab}, la pestaña «${otra}» se ve entera`);
      await page.tap(new RegExp('^' + tab), { in: '.mon-sheet' });
      await page.waitFor(`document.querySelector('.ms-tab.sel') && document.querySelector('.ms-tab.sel').textContent.startsWith(${JSON.stringify(tab)})`, 5000);
      const corte = await page.eval(`(() => { const b = document.querySelector('.ms-body'), br = b.getBoundingClientRect(), side = document.querySelector('.ms-side');
        const fuera = [...b.querySelectorAll('b, small, span, p, h4, button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > br.right + 1 || r.left < br.left - 1); }).length;
        return { deLado: b.scrollWidth - b.clientWidth, fuera, lado: side.scrollHeight - side.clientHeight }; })()`);
      ok(corte.deLado <= 1 && !corte.fuera && corte.lado <= 1, `${en}: en ${tab}, nada se sale de la ficha ni queda cortado (${JSON.stringify(corte)})`);
    }
    // El Vestuario: al menos 12 opciones a la vista con su nombre entero, y candado en todo lo que no tienes
    await page.waitSee('Todos', { in: '.mon-sheet' });
    const vista = await opciones('.mon-sheet .ms-body', '.ms-wear');
    ok(vista.legibles >= 12, `${en}: el Vestuario enseña al menos 12 opciones sin bajar y con su nombre entero (${JSON.stringify(vista)})`);
    ok(vista.bloq > 0 && !vista.sinCandado, `${en}: todo lo que no tienes en el Vestuario lleva un candado dibujado que se ve (${vista.bloq - vista.sinCandado} de ${vista.bloq})`);
    // De dónde sale lo que no tienes: no cabe escrito en la tarjeta, así que se dice al tocarla con el dedo
    // (con el dedo en su sitio: está desactivado, y press no pulsa lo desactivado, pero el dedo del jugador sí llega)
    const oro = await page.eval(`(() => { const r = [...document.querySelectorAll('.mon-sheet .ms-wear.locked')].find(b => /Oro/.test(b.textContent)).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await page.fingerAt(oro.x, oro.y);
    await page.fingerUp();
    await page.waitSee('300 victorias con su línea');
    ok(true, `${en}: tocar una skin que no tienes dice de dónde sale`);
    // El editor del avatar: lo mismo en Marco, Glow y Efecto
    await page.tap('Cerrar');
    await page.loginAs(me.token);
    await page.tap('Perfil');
    await page.waitSee('Editar', { in: '.trainer-card' });
    await page.tap('Editar', { in: '.trainer-card' });
    for (const tab of ['Marco', 'Glow', 'Efecto']) {
      await page.tap(tab, { in: '.ae-tabs' });
      await page.waitSee('Solo los míos', { in: '.ava-edit' });
      const ae = await opciones('.ae-body', '.frame-opt');
      ok(ae.legibles >= 12 || (ae.total < 12 && ae.legibles === ae.total), `${en}: en ${tab}, el editor del avatar enseña al menos 12 opciones sin bajar y con su nombre entero (${JSON.stringify(ae)})`);
      ok(ae.bloq > 0 && !ae.sinCandado, `${en}: en ${tab}, todo lo que no tienes lleva un candado dibujado que se ve (${ae.bloq - ae.sinCandado} de ${ae.bloq})`);
      const lado = await page.eval(`(() => { const b = document.querySelector('.ae-body'); return b.scrollWidth - b.clientWidth; })()`);
      ok(lado <= 1, `${en}: en ${tab}, la lista no se desliza de lado (${lado} px de más)`);
    }
  }
};
