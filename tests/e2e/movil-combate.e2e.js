// En el móvil (844×390 y 667×375), los botones del combate se entienden: cada movimiento con su nombre entero (sin
// recortar), el icono de su tipo y lo que gasta de energía, y la barra de energía con su ⚡. Al acabar, la ventana de
// resultados va en corto: lo ganado en una fila, cada Pokémon en una ficha pequeña, y «Volver» siempre a la vista
// sin tener que bajar. Un nombre de tres palabras («Pantalla de Humo») sale entero, en dos líneas
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'combatemovil' });
  for (const d of [4, 7, 1]) { me.client.send({ t: 'dev', dex: d, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  for (const [W, H] of [[844, 390], [667, 375], [1280, 800]]) {
    const at = `${W}×${H}`;
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(`window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1], Data.RANKED_POOL[2]] }); true`);   // atajo: empezar una práctica (los botones de Práctica tienen su prueba)
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && document.querySelector('#hud.touch .mv .tc-name')`, 20000);
    // Cada botón: su nombre tal cual (el del movimiento), que cabe en el botón, el icono de su tipo a la vista y, si gasta, cuánto
    const mv = await page.eval(`[...document.querySelectorAll('#hud.touch .mv')].map(b => { const n = b.querySelector('.tc-name'), r = b.getBoundingClientRect(), nr = n.getBoundingClientRect(), ico = b.querySelector('.mv-ico'), ir = ico.getBoundingClientRect();
      return { name: n.innerText.replace(/\\s+/g, ' ').trim(), real: b.querySelector('b').textContent.trim(), fits: nr.left >= r.left - 1 && nr.right <= r.right + 1 && n.scrollWidth <= n.clientWidth + 1,
        icon: ir.width >= 12 && ir.left >= r.left && ir.right <= r.right && getComputedStyle(ico).display !== 'none', cost: (b.querySelector('.tc-cost') || {}).textContent || '', small: b.querySelector('small').textContent }; })`);
    ok(mv.length === 5 && mv.every(m => m.name === m.real && m.fits), `${at}: cada movimiento con su nombre entero y que cabe en su botón (${mv.map(m => m.name).join(', ')})`);
    ok(mv.every(m => m.icon), `${at}: cada botón enseña el icono de su tipo`);
    ok(mv.filter(m => /⚡/.test(m.small)).every(m => m.cost && m.small.includes(m.cost.replace('⚡', ''))), `${at}: los que gastan energía dicen cuánto (${mv.map(m => m.cost || '—').join(', ')})`);
    ok(await page.eval(`getComputedStyle(document.querySelector('#hud.touch .bottom'), '::before').content.includes('⚡')`), `${at}: la barra de energía lleva su ⚡`);
    await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);   // atajo: acabar el combate (rendirse con la bandera lo prueba movil.e2e)
    await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
    // Una victoria contra Brock con de todo (medalla, dinero, objeto, tres Pokémon que suben y dos misiones)
    await page.eval(`(() => { const ui = window.__app.ui, p = ui.profile, mons = p.mons, team = mons.map(m => ({ dex: m.dex }));
      ui.lastMode = { kind: 'story', a: 'gym', id: 'k-brock' };
      ui.results({ winner: 0, you: 0, sum: [{ name: p.name, team, dmg: 1234, taken: 456, kos: 2, casts: 20, landed: 15 }, { name: 'Brock', team: [{ dex: 74, fainted: true }, { dex: 95, fainted: true }], dmg: 456, taken: 1234, kos: 0, casts: 10, landed: 4 }],
        reward: { coins: 1500, items: { rare: 1 }, badge: { region: 'kanto', index: 0, kind: 'gym' }, xp: mons.map((m, i) => ({ uid: m.uid, dex: m.dex, from: m.dex, xp: 240, fromLevel: 12, level: i ? 12 : 13, learned: i < 2 ? ['lanzallamas'] : [] })),
          missions: p.missions.daily.slice(0, 2).map((d, i) => ({ ...d, kind: 'daily', i, n: i ? 1 : 3, goal: i ? 5 : 3, from: 0 })) } }, null); return true; })()`);   // atajo: unos resultados con de todo
    await page.waitFor(`document.querySelector('.results .acts button.primary')`);
    // (se ve: dentro de la pantalla y, en su centro, el propio botón, no la barra legal ni otra cosa; en una fila: sus
    // centros a la misma altura, aunque la medalla sea más alta)
    const res = await page.eval(`(() => { const b = document.querySelector('.results .acts button.primary'), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const mid = [...document.querySelectorAll('.res-loot .rl')].map(x => { const q = x.getBoundingClientRect(); return q.top + q.height / 2; });
      return { text: b.textContent, seen: r.top >= 0 && r.bottom <= innerHeight + 1, free: hit === b || b.contains(hit), loot: mid.length, oneRow: Math.max(...mid) - Math.min(...mid) < 6,
        tall: Math.round(document.querySelector('.results').scrollHeight / innerHeight * 100) / 100 }; })()`);
    ok(res.text === 'Volver' && res.seen && res.free, `${at}: «Volver» se ve y se puede tocar sin bajar (${JSON.stringify(res)})`);
    ok(res.loot >= 3 && res.oneRow, `${at}: la medalla, el dinero y el objeto, en una sola fila`);
    ok(res.tall <= 1.35, `${at}: los resultados ocupan poco más de una pantalla (${res.tall} pantallas; antes, unas 2,4)`);
    // Quien aprende un movimiento: su fila se lee en horizontal, a todo el ancho, con el botón a mano
    const learn = await page.eval(`(() => { const list = document.querySelector('.results .xp-list').getBoundingClientRect();
      return [...document.querySelectorAll('.results .xp-row')].filter(r => r.querySelector('.learn-go')).map(r => { const q = r.getBoundingClientRect(), b = r.querySelector('.learn-go').getBoundingClientRect(),
        t = [...r.querySelectorAll('.lvup')].pop(), u = t.getBoundingClientRect(), line = parseFloat(getComputedStyle(t).lineHeight) || u.height;
        return { wide: q.width >= list.width * 0.95, oneLine: u.height <= line * 1.6, boton: Math.round(b.height), dentro: b.right <= q.right + 1 && b.left >= q.left - 1, text: t.textContent }; }); })()`);
    ok(learn.length === 2 && learn.every(x => x.wide && x.oneLine && x.dentro && x.boton >= 44), `${at}: quien aprende un movimiento se lee en horizontal y su botón se toca bien (${JSON.stringify(learn)})`);
    // En escritorio, cada Pokémon en una fila a todo el ancho que se lee de un vistazo: el nombre y su EXP en la misma
    // línea (antes, en tres columnas estrechas, «Charm…» y el resto en cascada) y las caras, todas igual de grandes
    if (W > 1000) {
      const filas = await page.eval(`(() => { const list = document.querySelector('.results .xp-list').getBoundingClientRect();
        return [...document.querySelectorAll('.results .xp-row')].map(r => { const q = r.getBoundingClientRect(), b = r.querySelector('b'), sm = r.querySelector('small'), pic = r.querySelector('img, canvas').getBoundingClientRect();
          return { ancho: q.width >= list.width * 0.95, nombre: b.scrollWidth <= b.clientWidth + 1, misma: Math.abs(b.getBoundingClientRect().top - sm.getBoundingClientRect().top) < 8, cara: Math.round(pic.width) }; }); })()`);
      ok(filas.length === 3 && filas.every(f => f.ancho && f.nombre && f.misma), `${at}: cada Pokémon, en una fila a todo el ancho con su nombre entero y la EXP al lado (${JSON.stringify(filas)})`);
      ok(new Set(filas.map(f => f.cara)).size === 1 && filas[0].cara >= 36, `${at}: las caras, todas igual de grandes (${filas.map(f => f.cara).join(', ')} px)`);
    }
    await page.click('Volver');
    await page.waitFor(`window.__app.ui.view !== 'results'`);
  }

  // Charmander (Nv.20, lo lleva entre sus 4) en una ruta: «Pantalla de Humo» entera (antes se quedaba en «Pantalla de»), en dos líneas y dentro del botón
  const g = await player({ user: 'combatemovil2' });
  g.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await g.client.wait(m => m.t === 'profile');
  await page.resize(667, 375);
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.loginAs(g.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.net.send({ t: 'story', a: 'route', id: 'k-ruta1' }); true`);   // atajo: empezar un combate de ruta (entrar por el Camino lo prueba camino.e2e)
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && document.querySelector('#hud.touch .mv .tc-name')`, 20000);
  const smoke = await page.eval(`(() => { const b = [...document.querySelectorAll('#hud.touch .mv')].find(x => x.querySelector('b').textContent.trim() === 'Pantalla de Humo');
    if (!b) return null; const n = b.querySelector('.tc-name'), r = b.getBoundingClientRect(), nr = n.getBoundingClientRect();
    return { name: n.innerText.replace(/\\s+/g, ' ').trim(), lines: n.innerText.trim().split('\\n').length, fits: nr.left >= r.left - 1 && nr.right <= r.right + 1 && n.scrollWidth <= n.clientWidth + 1 }; })()`);
  ok(smoke && smoke.name === 'Pantalla de Humo' && smoke.lines === 2 && smoke.fits, `667×375: «Pantalla de Humo» sale entera, en dos líneas y dentro de su botón (${JSON.stringify(smoke)})`);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);   // atajo: acabar el combate
};
