// La ficha de un Pokémon cabe entera y centrada: en el móvil, lo importante se ve sin desplazar nada (nombre, nivel, tipo,
// equipo, mote, favorito, las cuatro estadísticas, vender y cerrar) y solo se desliza lo de dentro de cada pestaña.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'cabe' });
  for (const dex of [4, 133]) { me.client.send({ t: 'dev', dex, level: 5, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', item: 'caramelo', qty: 9 }); await me.client.wait(m => m.t === 'profile');
  for (const [w, h, touch] of [[844, 390, true], [667, 375, true], [1280, 800, false]]) {
    await page.resize(w, h);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.touch', '${touch ? 1 : 0}'); true`);
    await page.loginAs(me.token);
    await page.tap('Mis Pokémon');
    await page.click(await page.within('Charmander', '.mon-card'));
    await page.waitSee('Charmander', { in: '.mon-sheet' });
    const en = `${w}×${h}`;
    for (const mon of ['Charmander', 'Eevee']) {
      const caja = await page.eval(`(() => { const r = document.querySelector('.mon-sheet').getBoundingClientRect(), side = document.querySelector('.ms-side'); return { izq: r.left, der: innerWidth - r.right, arr: r.top, aba: innerHeight - r.bottom, sobra: side.scrollHeight - side.clientHeight }; })()`);
      ok(Math.abs(caja.izq - caja.der) <= 2 && Math.abs(caja.arr - caja.aba) <= 2 && Math.min(caja.izq, caja.der, caja.arr, caja.aba) >= 0, `${en} ${mon}: la ficha va centrada y dentro de la pantalla (${JSON.stringify(caja)})`);
      ok(caja.sobra <= 1, `${en} ${mon}: el lado del Pokémon cabe sin deslizar (sobran ${caja.sobra} px)`);
      for (const texto of [mon, 'Mote', /Quitar del equipo|Al equipo/, /Vender por/, /Caramelo Raro/])
        ok(await page.see(texto, { in: '.mon-sheet', ms: 2000 }), `${en} ${mon}: «${texto}» se ve sin desplazar nada`);
      await page.waitFor(`!document.querySelector('.mon-sheet').getAnimations().length`);   // (la ficha entra con un zoom desde el 60 %: se mide ya quieta)
      const estrella = await page.eval(`(() => { const s = document.querySelector('.ms-acts .fav-star').getBoundingClientRect(), f = document.querySelector('.ms-stage').getBoundingClientRect(); return { alto: s.height, encima: !(s.top >= f.bottom || s.bottom <= f.top || s.left >= f.right || s.right <= f.left) }; })()`);
      ok(estrella.alto >= 24 && !estrella.encima, `${en} ${mon}: la estrella de favorito se ve y no tapa el sprite (${JSON.stringify(estrella)})`);
      for (const stat of ['PS', 'Ataque', 'Defensa', 'Velocidad'])
        ok(await page.see(stat, { in: '.ms-stats', ms: 2000 }), `${en} ${mon}: la estadística ${stat} se ve sin desplazar`);
      for (const tab of ['Movimientos', 'Vestuario', 'Retos', 'Estadísticas']) {
        await page.tap(new RegExp('^' + tab), { in: '.mon-sheet' });
        ok(await page.see(/Vender por/, { in: '.mon-sheet', ms: 2000 }), `${en} ${mon}: en ${tab}, el pie sigue a la vista`);
      }
      if (mon === 'Charmander') { await page.tap('Siguiente'); await page.waitSee('Eevee', { in: '.ms-side' }); }
    }
    const nivel = await page.read('.ms-level b');
    await page.tap(/Caramelo Raro/);
    await page.waitFor(`document.querySelector('.ms-level b').textContent !== ${JSON.stringify(nivel)}`);
    ok(await page.see('Mote', { in: '.mon-sheet', ms: 2000 }), `${en}: el Caramelo Raro sube de nivel desde la ficha (${nivel}) y sigue abierta`);
    await page.tap('Cerrar');
    ok(await page.title() === 'Mis Pokémon', `${en}: «Cerrar» vuelve a Mis Pokémon`);
  }
};
