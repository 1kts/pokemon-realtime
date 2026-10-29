// Combate en el móvil: con pantalla táctil sale un joystick a la izquierda y los movimientos son botones
// grandes a la derecha. Tocar un movimiento lo lanza al rival; arrastrarlo apunta y se lanza al soltar;
// tocar una cara del equipo cambia de Pokémon, y un botón abre la ventana de rendirse (no hay Esc)
module.exports = async ({ page, ok }) => {
  await page.resize(844, 390);   // un móvil en horizontal
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.touch', '1'); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  await page.type('.title-panel input', 'Movil');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  // En el móvil la música no se descarga entera al abrir (eran 15 MB): lo que pide el navegador, el menú y, pasados
  // unos segundos, los salvajes
  const mp3 = `performance.getEntriesByType('resource').map(r => r.name).filter(u => u.includes('/music/')).map(u => u.split('/').pop())`;
  await page.waitFor(`${mp3}.includes('viaje.mp3')`, 10000);
  await new Promise(r => setTimeout(r, 2500));   // (lo que se hubiera pedido con él ya ha tenido tiempo de bajar)
  ok(await page.eval(`!${mp3}.some(f => /campeon|duelo|torre|desierto|gimnasio|lider|maligno|ruta/.test(f))`),
    'en el móvil, al abrir no se descargan los temas de combate, Torre, gimnasios ni Campeón (se piden al sonar)');
  // Ya en el menú, en vertical un aviso tapa todo hasta girar el móvil
  await page.resize(390, 844);
  ok(await page.eval(`document.body.classList.contains('touch') && getComputedStyle(document.querySelector('.rotate-gate')).display !== 'none'`), 'desde el menú, en vertical pide girar el móvil');
  await page.resize(844, 390);
  // Lo que se manda al servidor: el último movimiento lanzado y el último cambio
  await page.eval(`(() => { const net = window.__app.net, send = net.send.bind(net);
    net.send = m => { if (m.t === 'in') { if (m.c >= 0) { const b = window.__app.battle, f = b.renderPos[b.foeIdx]; window.__cast = { ...m, foe: { x: f.x, y: f.y } }; } if (m.sw >= 0) window.__swap = m; } return send(m); };
    net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1]], skill: 0, passive: true }); return true; })()`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 15000);
  ok(await page.eval(`!!document.querySelector('#hud.touch .tc-zone') && !!document.querySelector('#hud.touch .tc-quit') && getComputedStyle(document.querySelector('.mv kbd')).display === 'none'`),
    'con pantalla táctil salen el joystick y el botón de rendirse, y los movimientos sin teclas');
  const fits = await page.eval(`[...document.querySelectorAll('.mv, .team .tm, .tc-quit')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })`);
  ok(fits, 'en 844×390 los movimientos, el equipo y el botón de rendirse caben en pantalla');
  // Cámara cerca, siguiendo a tu Pokémon (sin seguir, a 844×390 va a 23,6 de altura); el rival lejos sale como flecha en el borde
  ok(await page.eval(`window.__app.camera.position.y < 16`), 'la cámara del combate va más cerca que en el ordenador');
  await page.waitFor(`document.querySelector('.foe-arrow') && (document.querySelector('.foe-arrow').hidden === !(() => { const b = window.__app.battle, f = b.renderPos[b.foeIdx], p = b.toScreen(f.x, f.y); return p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight; })())`);
  ok(true, 'la flecha del rival sale solo cuando el rival queda fuera de la pantalla');
  // (desde la 0.34.0 el nombre va entero y con el icono del tipo a la vista; lo mira a fondo movil-combate.e2e.js)
  ok(await page.eval(`[...document.querySelectorAll('.mv')].every(b => b.querySelector('.tc-name').textContent.trim() && getComputedStyle(b.querySelector('.mv-ico')).display !== 'none')`),
    'cada movimiento lleva su nombre y el icono de su tipo');

  const ptr = (sel, type, x, y) => page.eval(`(() => { const t = document.querySelector('${sel}'), r = t.getBoundingClientRect();
    t.dispatchEvent(new PointerEvent('${type}', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true, clientX: ${x === null ? 'r.left + r.width / 2' : x}, clientY: ${y === null ? 'r.top + r.height / 2' : y} })); return true; })()`);

  // Joystick: arrastrar a la derecha mueve al Pokémon a la derecha
  const x0 = await page.eval(`window.__app.battle.pred.x`);
  await ptr('.tc-zone', 'pointerdown', 120, 280);
  await ptr('.tc-zone', 'pointermove', 190, 280);
  // (hasta que avance: en un CI cargado los fotogramas van lentos)
  await page.waitFor(`window.__app.battle.pred.x > ${x0} + 40`, 8000).catch(() => {});
  const x1 = await page.eval(`window.__app.battle.pred.x`);
  await ptr('.tc-zone', 'pointerup', 190, 280);
  ok(x1 > x0 + 40, `el joystick a la derecha lo mueve a la derecha (${Math.round(x0)} → ${Math.round(x1)})`);
  ok(await page.eval(`window.__app.battle.touch.move.mx === 0 && window.__app.battle.touch.move.my === 0`), 'al soltar el joystick se para');

  // Tocar el ataque básico: sale hacia el rival
  await ptr('.mv', 'pointerdown', null, null);
  await ptr('.mv', 'pointerup', null, null);
  await page.waitFor(`window.__cast && window.__cast.c === 0`);
  // (contra dónde estaba el rival al lanzarlo: luego se sigue moviendo)
  const auto = await page.eval(`Math.hypot(window.__cast.tx - window.__cast.foe.x, window.__cast.ty - window.__cast.foe.y)`);
  ok(auto < 40, `tocar un movimiento lo lanza al rival (apuntado a ${Math.round(auto)} de él)`);

  // Arrastrarlo hacia la izquierda: apunta a la izquierda de tu Pokémon y sale al soltar
  await new Promise(r => setTimeout(r, 900));   // que se recargue
  await page.eval(`window.__cast = null; true`);
  const [cx, cy] = await page.eval(`(() => { const r = document.querySelector('.mv').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await ptr('.mv', 'pointerdown', cx, cy);
  await ptr('.mv', 'pointermove', cx - 90, cy);
  ok(await page.eval(`window.__cast === null`), 'mientras se arrastra no se lanza todavía');
  await ptr('.mv', 'pointerup', cx - 90, cy);
  await page.waitFor(`window.__cast && window.__cast.c === 0`);
  ok(await page.eval(`window.__cast.tx < window.__app.battle.pred.x - 150`), 'arrastrar a la izquierda y soltar lo lanza hacia la izquierda');

  // Tocar la segunda cara del equipo: cambia a ese Pokémon
  await ptr('.team.mine .tm[data-slot="1"]', 'pointerdown', null, null);
  await page.waitFor(`window.__swap && window.__swap.sw === 1`);
  ok(true, 'tocar la segunda cara del equipo pide el cambio');
  await page.shot('/tmp/e2e-movil.png');

  // En vertical no cabe la arena: aviso para girar el móvil
  await page.resize(390, 844);
  ok(await page.eval(`getComputedStyle(document.querySelector('.rotate-gate')).display !== 'none'`), 'en vertical pide girar el móvil');
  await page.resize(844, 390);
  ok(await page.eval(`getComputedStyle(document.querySelector('.rotate-gate')).display === 'none'`), 'en horizontal no sale el aviso');

  // Sin tecla Esc: el botón abre la ventana de rendirse
  await ptr('.tc-quit', 'pointerdown', null, null);
  await page.waitFor(`document.querySelector('.ui-confirm-box.forfeit')`);
  ok(true, 'el botón de la bandera abre la ventana de rendirse');
  await page.click('Rendirse');
  await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
  ok(await page.eval(`!document.querySelector('.tc-zone') && !document.body.classList.contains('touch-battle')`), 'al acabar, los controles táctiles se quitan');
  await page.waitFor(`!document.querySelector('.foe-arrow')`);
  ok(true, 'y la flecha del rival se quita');
  // Los resultados no caben en 390 px de alto: se puede bajar hasta el botón de seguir (antes se recortaban)
  await page.eval(`(() => { const s = document.getElementById('screen'); s.scrollTop = s.scrollHeight; return true; })()`);
  ok(await page.eval(`(() => { const b = [...document.querySelectorAll('.results button.primary')].pop(), r = b.getBoundingClientRect(), legal = document.querySelector('.legal-bar').getBoundingClientRect().height;
    return r.bottom <= innerHeight - legal + 1 && r.top >= 0; })()`), 'tras el combate se puede bajar hasta el botón de seguir');
  await page.resize();
};
