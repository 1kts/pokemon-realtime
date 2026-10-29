// Historia como un camino («Camino»): al entrar en Historia se ve el viaje en una línea, con los gimnasios en orden.
// Lo ganado sale como medalla ganada, el siguiente reto destaca (el más grande, con «Desafiar» debajo) y lo que falta
// sale bloqueado y dice qué lo abre; cada ruta dice cuántos de sus Pokémon tienes. Tocar un sitio abre su ficha al
// lado. En el móvil el siguiente reto se ve entero, con su nombre. La pestaña Mapa cambia de vista y se recuerda
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'camino' });
  // Charmander, y Pidgey, Rattata y Caterpie capturados (salen en las dos primeras rutas); 2 medallas de Kanto
  for (const dex of [4, 16, 19, 10]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', badges: 2, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);

  const openStory = async () => {
    await page.click('Historia');
    await page.waitFor(`document.querySelector('.story-mode')`);
  };
  await openStory();
  // La primera vez sale la guía de cómo se juega: se cierra como un jugador
  await page.waitFor(`document.querySelector('.story-guide')`);
  await page.click('.story-guide .acts button.primary');
  await page.waitFor(`!document.querySelector('.story-guide')`);

  // Abre en el Camino, con una frase de qué va y una leyenda que dice qué es una ruta
  const pressed = `[...document.querySelectorAll('.story-mode button')].find(b => b.getAttribute('aria-pressed') === 'true')?.textContent`;
  ok(await page.eval(pressed) === 'Camino' && await page.eval(`!!document.querySelector('.story-path') && !document.querySelector('.story .map')`),
    'Historia abre en el Camino (la pestaña Camino marcada), no en el mapa');
  // Lo que dice cada sitio al pasar por encima (tips.js lo pasa de title a data-tip la primera vez que se pasa)
  const node = (sel, op, text) => `${sel}[title${op}"${text}"], ${sel}[data-tip${op}"${text}"]`;
  const tip = "(b => b.title || b.dataset.tip || '')";
  const shown = sel => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')`;
  ok(await page.eval(`${shown('.story-pathwrap p, .sp-legend span')}.some(e => e.textContent.includes('Vence a los líderes de gimnasio en orden'))`)
    && await page.eval(`${shown('.sp-legend span')}.some(e => e.textContent.includes('Ruta: opcional, para capturar Pokémon'))`),
    'se explica en palabras sencillas: vencer a los líderes en orden, y que las rutas son opcionales para capturar');

  // Los gimnasios, en orden; los dos primeros ganados, el tercero es el siguiente reto y el cuarto está bloqueado
  const gyms = await page.eval(`${shown('.sp-gym:not(.sp-league)')}.map(b => ({ name: b.querySelector('.sp-name b').textContent, title: ${tip}(b), w: b.querySelector('.sp-dot').getBoundingClientRect().width, x: b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 }))`);
  ok(gyms.slice(0, 5).map(g => g.name).join(',') === 'Brock,Misty,Lt. Surge,Erika,Koga', 'los gimnasios salen en orden: Brock, Misty, Lt. Surge, Erika, Koga…');
  ok(/Medalla ganada/.test(gyms[0].title) && /Medalla ganada/.test(gyms[1].title), 'Brock y Misty salen con la medalla ganada');
  ok(/Tu siguiente reto/.test(gyms[2].title) && gyms.slice(3).every(g => /Aún bloqueado/.test(g.title)), 'Lt. Surge es el siguiente reto y los que vienen después están bloqueados');
  ok(gyms.every((g, i) => i === 2 || g.w < gyms[2].w), 'el siguiente reto es el círculo más grande del camino');
  const go = await page.eval(`(() => { const b = ${shown('.story-path button')}.filter(b => b.textContent === 'Desafiar'); return b.length === 1 ? b[0].getBoundingClientRect().left + b[0].getBoundingClientRect().width / 2 : null; })()`);
  ok(go !== null && Math.abs(go - gyms[2].x) < 4, 'el único «Desafiar» del camino está debajo de Lt. Surge');
  // El tramo bloqueado dice qué lo abre (encima de Erika); los ganados, no
  const lock = await page.eval(`(() => { const p = ${shown('.story-path p')}.find(p => p.textContent === 'Se abre al vencer a Lt. Surge'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.right]; })()`);
  ok(lock && lock[0] < gyms[3].x && gyms[3].x < lock[1], 'encima de Erika dice «Se abre al vencer a Lt. Surge»');
  ok(await page.eval(`!${shown('.story-path p')}.some(p => /Se abre al vencer a (Brock|Misty)/.test(p.textContent))`), 'los tramos ya abiertos no dicen que estén bloqueados');

  // Cada ruta abierta dice cuántos de los Pokémon que viven en ella tienes; las bloqueadas, no
  const count = await page.eval(`(() => {
    const n = Data.REGIONS.kanto.nodes.find(x => x.id === 'k-ruta2'), dexes = [...new Set(n.wild.map(([d]) => d))];
    const want = dexes.filter(d => window.__app.ui.profile.caught.includes(d)).length + '/' + dexes.length;
    const b = ${shown('.sp-route')}.find(b => b.querySelector('.sp-name').textContent === n.name);
    return { want, got: b && b.querySelector('.sp-count')?.textContent };
  })()`);
  ok(count.got === count.want && +count.want.split('/')[0] >= 3, `la ruta «Ruta 2 · Bosque Verde» dice cuántos tienes de los que viven en ella (${count.got}, deben ser ${count.want})`);
  ok(await page.eval(`${shown('.sp-route')}.filter(b => /Aún bloqueado/.test(${tip}(b))).every(b => !/\\d+\\/\\d+/.test(b.textContent))`), 'las rutas bloqueadas no enseñan cuenta');

  // Tocar un sitio abre su ficha al lado
  const side = `document.querySelector('.story-side').innerText`;
  await page.click(node('.sp-gym', '^=', 'Brock'));
  await page.waitFor(`/Gimnasio Plateada/.test(${side})`);
  ok(await page.eval(`/Revancha/.test(${side}) && /para ganar su medalla/.test(${side})`), 'al tocar a Brock (ganado) su ficha dice qué es un gimnasio y ofrece la revancha');
  await page.click(node('.sp-route', '^=', 'Ruta 2 · Bosque Verde'));
  await page.waitFor(`/Explorar/.test(${side})`);
  ok(await page.eval(`/Ruta 2 · Bosque Verde/.test(${side}) && /Opcional/.test(${side})`), 'al tocar una ruta su ficha dice que es opcional y deja explorarla');
  await page.click(node('.sp-gym', '^=', 'Erika'));
  await page.waitFor(`/Gimnasio Azulona/.test(${side})`);
  ok(await page.eval(`/Vence antes al anterior/.test(${side}) && !/¡Desafiar!/.test(${side})`), 'al tocar a Erika (bloqueada) su ficha dice que antes hay que vencer al anterior');

  // La pestaña Mapa cambia de vista, y al volver a Historia sigue en el mapa
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.story .map .node')`);
  ok(await page.eval(`!document.querySelector('.story-path') && ${pressed} === 'Mapa'`), 'la pestaña Mapa enseña el mapa');
  await page.click('Volver');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await openStory();
  ok(await page.eval(`!!document.querySelector('.story .map .node') && ${pressed} === 'Mapa'`), 'al volver a entrar en Historia sigue en el mapa');
  await page.click('.story-mode button:nth-child(1)');
  await page.waitFor(`document.querySelector('.story-path .sp-gym')`);

  // En el móvil en horizontal, el siguiente reto se ve entero (círculo y nombre) y la ficha de al lado tiene «¡Desafiar!»
  for (const [w, h] of [[844, 390], [667, 375]]) {
    await page.resize(w, h);
    await page.eval(`localStorage.setItem('arena.touch', '1'); true`);
    await page.reload();
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await openStory();
    // (al abrir se elige el siguiente reto, y en ese mismo momento el camino se coloca en él)
    await page.waitFor(`/Gimnasio Carmín/.test(${side})`);
    const fits = await page.eval(`(() => {
      const box = document.querySelector('.story-path').getBoundingClientRect(), now = document.querySelector(${JSON.stringify(node('.sp-gym', '*=', 'Tu siguiente reto'))});
      const inside = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom && r.bottom <= innerHeight; };
      const name = now.querySelector('.sp-name'), r = name.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return inside(now.querySelector('.sp-dot')) && inside(name) && name.innerText.trim() === 'Lt. Surge' && !!top && name.contains(top);
    })()`);
    ok(fits, `en ${w}×${h} se ve entero el siguiente reto con su nombre, sin nada encima`);
    const inView = text => `(() => { const b = [...document.querySelectorAll('.story-side button')].find(b => b.textContent.includes(${JSON.stringify(text)})); if (!b) return false;
      const r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.bottom <= innerHeight && r.top >= 0 && !!top && b.contains(top); })()`;
    ok(await page.eval(inView('¡Desafiar!')), `en ${w}×${h} el «¡Desafiar!» de la ficha está a la vista`);
    // (y al tocar una ruta, su «Explorar», aunque su ficha sea más larga)
    await page.click(node('.sp-route', '^=', 'Ruta 6 · Cueva Diglett'));
    await page.waitFor(`/Explorar/.test(${side})`);
    ok(await page.eval(inView('Explorar')), `en ${w}×${h}, al tocar una ruta, el «Explorar» de su ficha está a la vista`);
  }

  // En el ordenador, «Desafiar» del camino empieza el combate contra Lt. Surge
  await page.resize();
  await page.eval(`localStorage.setItem('arena.touch', '0'); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
  await page.click('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await openStory();
  await page.waitFor(`document.querySelector('.story-path .sp-go')`);
  await page.click('.story-path .sp-go');
  await page.waitFor(`document.querySelector('.leader-intro b')?.textContent === 'Lt. Surge' || document.querySelector('.tname .tname-face[src="trainers/surge.png"]')`, 20000);
  ok(true, '«Desafiar» del camino empieza el combate contra Lt. Surge');
};
