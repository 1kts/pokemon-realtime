// El Camino de la Historia (storypath.js) se entiende sin haber jugado nunca a Pokémon: cada gimnasio es una tarjeta
// con su líder y cada ruta una con su primer nombre y lo capturado. El jugador está de pie al principio de su tramo,
// antes de sus rutas (no junto al líder, que parecería que ya las ha hecho), y al abrir está elegida la primera de
// ellas con Pokémon por capturar. El siguiente líder es lo más grande y tiene el único «Desafiar», a la vista y sin
// nada encima; lo bloqueado dice qué lo abre. En el móvil en horizontal cabe entero de alto (se desplaza de lado).
// Pulsar «Desafiar» empieza el combate. Aquí, el escritorio; el móvil, en camino-movil.e2e.js (los tres tamaños juntos
// pasaban de los 5 minutos que tiene cada prueba en el CI)
const camino = (SIZES, more) => async ({ page, player, ok }) => {
  const me = await player({ user: 'camino' });
  // (con un Pidgey, que sale en la Ruta 1: en su tarjeta, él en color y los demás en silueta)
  for (const dex of [4, 16]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');

  // Lo que se ve de cada tarjeta: su etiqueta (texto, si cabe y si se ve sin nada encima) y su tamaño
  const CARDS = `[...document.querySelectorAll('.story-path .sp-node')].map(b => {
    const card = b.querySelector('.sp-card'), tag = b.querySelector('.sp-name'), r = card.getBoundingClientRect(), tr = tag.getBoundingClientRect();
    const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2);
    return { kind: b.classList.contains('sp-route') ? 'route' : b.classList.contains('sp-league') ? 'league' : 'gym', name: b.querySelector('.sp-name').innerText.replace(/\\s+/g, ' ').trim(),
      fits: tag.scrollWidth <= tag.clientWidth + 1, onTop: !hit || tag.contains(hit) || hit === tag, lock: (b.querySelector('.sp-locknote') || {}).innerText || '',
      w: r.width, h: r.height, x: r.left + r.width / 2, label: b.getAttribute('aria-label') || '' };
  })`;
  // Lo que se pinta de cada Pokémon de una tarjeta: cuánto de su dibujo es casi negro (una silueta) con el filtro que lleva
  const go = `(() => { const bs = [...document.querySelectorAll('.story-path button')].filter(b => /Desafiar/.test(b.textContent)), b = bs[0];
    if (!b) return { n: 0 };
    const r = b.getBoundingClientRect(), w = document.querySelector('.story-path').getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { n: bs.length, text: b.textContent.trim(), free: hit === b || b.contains(hit), inside: r.left >= w.left && r.right <= w.right && r.top >= w.top && r.bottom <= Math.min(w.bottom, innerHeight) }; })()`;

  const open = async (W, H, touch) => {
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v);
      ${touch ? `localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1');` : ''} true`);
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.click('.menu-card.story');
    // La primera vez sale la guía: se cierra como un jugador
    await page.waitFor(`[...document.querySelectorAll('body > .modal button')].some(b => b.textContent.includes('¡A jugar!'))`);
    await page.click('¡A jugar!');
    await page.waitFor(`!document.querySelector('body > .modal') && document.querySelector('.story-path .sp-node.now')`);
    // (y a que acaben de entrar y de cargar las fotos que se ven: las demás se cargan al llegar a ellas)
    await page.waitFor(`(() => { const w = document.querySelector('.story-path').getBoundingClientRect();
      return [...document.querySelectorAll('.story-path img')].every(i => { const r = i.getBoundingClientRect(); return i.complete || r.right < w.left || r.left > w.right; })
        && document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity); })()`);
  };

  for (const [W, H, touch] of SIZES) {
    const at = `${W}×${H}`;
    await open(W, H, touch);
    // Al abrir, la ficha de al lado es la de la primera ruta del tramo con Pokémon por capturar, y está a la vista
    const first = await page.eval(`(() => { const h = document.querySelector('.story-side .node-info h3'), b = document.querySelector('.sp-node.sel'), r = b.getBoundingClientRect(), w = document.querySelector('.story-path').getBoundingClientRect();
      return { side: h && h.textContent.trim(), seen: r.left >= w.left - 1 && r.right <= w.right + 1 }; })()`);
    ok(first.side === 'Ruta 11 · Ruta 9 · Ruta 10' && first.seen, `${at}: al abrir, elegida y a la vista la primera ruta por capturar del tramo (${JSON.stringify(first)})`);
    // Recorre el camino de punta a punta (como quien lo desliza) mirando cada tarjeta allí donde se ve
    const seen = new Map();
    // (a pasos que dejan a la vista, en algún momento, cada tarjeta entera)
    const [sw, cw] = await page.eval(`[document.querySelector('.story-path').scrollWidth, document.querySelector('.story-path').clientWidth]`), step = Math.max(80, cw - 200);
    for (let i = 0; i <= Math.ceil(sw / step); i++) {
      await page.eval(`(() => { const w = document.querySelector('.story-path'); w.style.scrollBehavior = 'auto'; w.scrollLeft = ${i * step}; return true; })()`);   // atajo: desplazar el camino
      const vw = await page.eval(`(() => { const r = document.querySelector('.story-path').getBoundingClientRect(); return [r.left, r.right]; })()`);
      for (const c of await page.eval(CARDS)) if (c.x > vw[0] + c.w / 2 && c.x < vw[1] - c.w / 2) seen.set(c.name + c.kind, c);
    }
    const cards = [...seen.values()], gyms = cards.filter(c => c.kind === 'gym'), routes = cards.filter(c => c.kind === 'route');
    ok(gyms.length === 8 && routes.length >= 12 && cards.some(c => c.kind === 'league'), `${at}: se ven los 8 gimnasios, la Liga y las rutas (${gyms.length}, ${routes.length})`);
    ok(cards.every(c => c.fits && c.onTop), `${at}: el nombre de cada sitio cabe y no lo tapa nada (${cards.filter(c => !c.fits || !c.onTop).map(c => c.name)})`);
    // Lo que toca: el más grande, con su líder y el único «Desafiar», a la vista y sin nada encima
    await page.eval(`(() => { const w = document.querySelector('.story-path'), n = document.querySelector('.sp-node.now'); w.scrollLeft += n.getBoundingClientRect().left - w.getBoundingClientRect().left - w.clientWidth / 2 + n.offsetWidth / 2; return true; })()`);   // atajo: volver a lo que toca
    const now = (await page.eval(CARDS)).find(c => c.name.startsWith('Erika'));
    ok(now && cards.filter(c => c.name !== now.name).every(c => c.kind === 'league' ? c.w * c.h <= now.w * now.h : c.w * c.h < now.w * now.h), `${at}: Erika, lo que toca, es la tarjeta más grande (con la Liga, el otro lugar grande, como mucho igual)`);
    const g = await page.eval(go);
    ok(g.n === 1 && g.text === 'Desafiar' && g.free && g.inside, `${at}: un solo «Desafiar» en el camino, a la vista y sin nada encima (${JSON.stringify(g)})`);
    // «Estás aquí»: al principio del tramo, justo antes de su primera ruta y después del último líder vencido
    const you = await page.eval(`(() => { const y = [...document.querySelectorAll('.story-path *')].find(e => e.children.length === 0 && e.textContent === 'Estás aquí');
      const cards = [...document.querySelectorAll('.story-path .sp-node')], i = cards.findIndex(b => b.querySelector('.sp-name').textContent === 'Ruta 11');
      if (!y || i < 1) return null; const a = y.getBoundingClientRect(), next = cards[i].querySelector('.sp-card').getBoundingClientRect(), prev = cards[i - 1].querySelector('.sp-card').getBoundingClientRect();
      return { before: prev.right <= a.left, gap: Math.round(next.left - a.right), prev: cards[i - 1].querySelector('.sp-name').innerText.split('\\n')[0], seen: a.width > 0 && a.top >= 0 }; })()`);
    ok(you && you.seen && you.before && you.prev === 'Lt. Surge' && you.gap >= 0 && you.gap < 60, `${at}: «Estás aquí», con el jugador, al principio de su tramo: entre Lt. Surge y la Ruta 11 (${JSON.stringify(you)})`);
    // Bloqueado: dice qué lo abre
    const koga = cards.find(c => c.name.startsWith('Koga'));
    ok(koga && koga.lock.includes('Se abre al vencer a Erika'), `${at}: Koga, bloqueado, dice «Se abre al vencer a Erika» (${koga && koga.lock})`);
    // Cabe entero de alto: nada del camino por debajo de la pantalla ni recortado por arriba
    const fit = await page.eval(`(() => { const w = document.querySelector('.story-path'), r = w.getBoundingClientRect(), t = document.querySelector('.sp-track').getBoundingClientRect();
      return { inScreen: r.bottom <= innerHeight + 1, track: t.top >= r.top - 1 && t.bottom <= r.bottom + 1 }; })()`);
    if (touch) ok(fit.inScreen && fit.track, `${at}: el camino cabe entero de alto en la pantalla (${JSON.stringify(fit)})`);
    else ok(fit.track, `${at}: el camino se ve entero de alto (${JSON.stringify(fit)})`);
    // La leyenda: un gimnasio es para combatir y una ruta, para capturar (en el móvil en horizontal no hay sitio)
    if (!touch) ok(await page.see('Gimnasio: combate por su medalla') && await page.see('Ruta: captura Pokémon'), `${at}: la leyenda explica qué es un gimnasio y qué una ruta`);
  }

  if (!more) return;
  // La Ruta 1: lo capturado, en su tarjeta
  await open(1280, 800, false);
  const r1 = await page.eval(`(() => { const b = [...document.querySelectorAll('.sp-route')].find(b => b.querySelector('.sp-name').textContent === 'Ruta 1'); b.scrollIntoView({ inline: 'center' }); b.classList.add('r1-test'); return b.querySelector('.sp-count').innerText; })()`);   // atajo: marcar la tarjeta para leerla
  ok(/1\/\d+/.test(r1), `la Ruta 1 dice cuántos llevas con la Poké Ball (${r1})`);
  // Tocar una ruta abre su ficha al lado
  await page.click('.r1-test');
  await page.waitSee(/^Ruta 1 /, { in: '.story-side .node-info h3' });
  ok(true, 'tocar la Ruta 1 abre su ficha al lado');
  // Pulsar «Desafiar» en el camino empieza el combate contra Erika
  await page.eval(`(() => { const w = document.querySelector('.story-path'), n = document.querySelector('.sp-node.now'); w.scrollLeft += n.getBoundingClientRect().left - w.getBoundingClientRect().left - w.clientWidth / 2 + n.offsetWidth / 2; return true; })()`);   // atajo: volver a lo que toca
  await page.click('.story-path .sp-go');
  ok(await page.waitFor(`document.querySelector('.leader-intro b')?.textContent === 'Erika' || !!document.querySelector('.tname .tname-face[src="trainers/erika.png"]')`, 20000).then(() => true, () => false),
    '«Desafiar» del camino empieza el combate contra Erika (su nombre en la presentación o su cara en el marcador)');
};
module.exports = camino([[1280, 800, false]], true);
module.exports.camino = camino;
