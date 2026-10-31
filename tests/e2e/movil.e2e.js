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
  // atajo: Práctica con un rival quieto (passive), que la interfaz no deja elegir, y siempre en la pradera (al azar,
  // una roca o un pilar en el camino del joystick paraba al Pokémon aunque no se soltara); lo que se manda, se apunta
  await page.eval(`(() => { const net = window.__app.net, send = net.send.bind(net);
    net.send = m => { if (m.t === 'in') { if (m.c >= 0) { const b = window.__app.battle, f = b.renderPos[b.foeIdx]; window.__cast = { ...m, foe: { x: f.x, y: f.y } }; } if (m.sw >= 0) window.__swap = m; } return send(m); };
    net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1]], skill: 0, passive: true, map: 'pradera' }); return true; })()`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 15000);
  ok(await page.eval(`!!document.querySelector('#hud.touch .tc-zone') && !!document.querySelector('#hud.touch .tc-quit') && getComputedStyle(document.querySelector('.mv kbd')).display === 'none'`),
    'con pantalla táctil salen el joystick y el botón de rendirse, y los movimientos sin teclas');
  const fits = await page.eval(`[...document.querySelectorAll('.mv, .team .tm, .tc-quit')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })`);
  ok(fits, 'en 844×390 los movimientos, el equipo y el botón de rendirse caben en pantalla');
  // Cámara cerca, siguiendo a tu Pokémon (sin seguir, a 844×390 va a 23,6 de altura); el rival lejos sale como flecha en el borde
  // (se acerca poco a poco desde el campo entero: con pocos fotogramas tarda más)
  // atajo: lo cerca que va la cámara del 3D no tiene nada que leer: se mira su altura
  ok(await page.waitFor(`window.__app.camera.position.y < 16`, 8000).then(() => true, () => false), 'la cámara del combate va más cerca que en el ordenador');
  // atajo: si el rival queda fuera de la pantalla se calcula con su posición en el 3D
  ok(await page.waitFor(`document.querySelector('.foe-arrow') && (document.querySelector('.foe-arrow').hidden === !(() => { const b = window.__app.battle, f = b.renderPos[b.foeIdx], p = b.toScreen(f.x, f.y); return p.x < 0 || p.y < 0 || p.x > innerWidth || p.y > innerHeight; })())`).then(() => true, () => false),
    'la flecha del rival sale solo cuando el rival queda fuera de la pantalla');
  // (desde la 0.34.0 el nombre va entero y con el icono del tipo a la vista; lo mira a fondo movil-combate.e2e.js)
  ok(await page.eval(`[...document.querySelectorAll('.mv')].every(b => b.querySelector('.tc-name').textContent.trim() && getComputedStyle(b.querySelector('.mv-ico')).display !== 'none')`),
    'cada movimiento lleva su nombre y el icono de su tipo');

  const mid = sel => page.eval(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);

  // Joystick: arrastrar a la derecha mueve al Pokémon a la derecha
  const x0 = await page.eval(`window.__app.battle.pred.x`);
  // (con el dedo de verdad: puesto en el joystick y arrastrado a la derecha)
  await page.fingerAt(120, 280);
  await page.fingerMove(155, 280);
  await page.fingerMove(190, 280);
  // (hasta que avance: en un CI cargado los fotogramas van lentos)
  await page.waitFor(`window.__app.battle.pred.x > ${x0} + 40`, 8000).catch(() => {});
  const x1 = await page.eval(`window.__app.battle.pred.x`);
  await page.fingerUp();
  ok(x1 > x0 + 40, `el joystick a la derecha lo mueve a la derecha (${Math.round(x0)} → ${Math.round(x1)})`);
  // (al soltarlo se para: un rato después sigue donde estaba. Desde que el joystick vuelve a su sitio, que es cuando
  // la página ha recibido el dedo levantado, y en fotogramas de la página, no en milisegundos medidos desde fuera:
  // con el CI cargado, a los 300 ms el dedo levantado a veces ni había llegado y seguía andando (924 → 937))
  await page.waitFor(`!document.querySelector('.tc-base.on')`);
  const [x2, x3] = await page.eval(`new Promise(r => { const frames = (n, f) => n ? requestAnimationFrame(() => frames(n - 1, f)) : f();
    frames(20, () => { const a = window.__app.battle.pred.x; frames(30, () => r([a, window.__app.battle.pred.x])); }); })`);
  ok(Math.abs(x3 - x2) < 3, `al soltar el joystick se para (${Math.round(x2)} → ${Math.round(x3)})`);

  // Tocar el ataque básico: sale hacia el rival
  await page.press('.mv');
  await page.waitFor(`window.__cast && window.__cast.c === 0`);
  // (contra dónde estaba el rival al lanzarlo: luego se sigue moviendo)
  const auto = await page.eval(`Math.hypot(window.__cast.tx - window.__cast.foe.x, window.__cast.ty - window.__cast.foe.y)`);
  ok(auto < 40, `tocar un movimiento lo lanza al rival (apuntado a ${Math.round(auto)} de él)`);

  // Arrastrarlo hacia la izquierda: apunta a la izquierda de tu Pokémon y sale al soltar
  await new Promise(r => setTimeout(r, 900));   // que se recargue
  await page.eval(`window.__cast = null; true`);
  const [cx, cy] = await mid('.mv');
  await page.fingerAt(cx, cy);
  await page.fingerMove(cx - 45, cy);
  await page.fingerMove(cx - 90, cy);
  ok(await page.eval(`window.__cast === null`), 'mientras se arrastra no se lanza todavía');
  await page.fingerUp();
  await page.waitFor(`window.__cast && window.__cast.c === 0`);
  // atajo: hacia dónde sale se mira en lo que se manda (el movimiento es del 3D)
  ok(await page.eval(`window.__cast.tx < window.__app.battle.pred.x - 150`), 'arrastrar a la izquierda y soltar lo lanza hacia la izquierda');

  // Tocar la segunda cara del equipo: cambia a ese Pokémon
  await page.press('.team.mine .tm[data-slot="1"]');
  ok(await page.waitFor(`window.__swap && window.__swap.sw === 1`).then(() => true, () => false), 'tocar la segunda cara del equipo pide el cambio');
  await page.shot('/tmp/e2e-movil.png');

  // En vertical no cabe la arena: aviso para girar el móvil
  await page.resize(390, 844);
  ok(await page.eval(`getComputedStyle(document.querySelector('.rotate-gate')).display !== 'none'`), 'en vertical pide girar el móvil');
  await page.resize(844, 390);
  ok(await page.eval(`getComputedStyle(document.querySelector('.rotate-gate')).display === 'none'`), 'en horizontal no sale el aviso');

  // Sin tecla Esc: el botón abre la ventana de rendirse
  await page.press('.tc-quit');
  await page.waitSee('¿Rendirte?', { in: '.ui-confirm-box' });
  await new Promise(r => setTimeout(r, 400));
  ok(await page.see('¿Rendirte?', { in: '.ui-confirm-box', ms: 0 }), 'el botón de la bandera abre la ventana de rendirse, y se queda abierta al levantar el dedo');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
  ok(await page.eval(`!document.querySelector('.tc-zone') && !document.body.classList.contains('touch-battle')`), 'al acabar, los controles táctiles se quitan');
  ok(await page.waitFor(`!document.querySelector('.foe-arrow')`).then(() => true, () => false), 'y la flecha del rival se quita');
  // Los resultados no caben en 390 px de alto: se puede bajar hasta el botón de seguir (antes se recortaban)
  await page.eval(`(() => { const s = document.getElementById('screen'); s.scrollTop = s.scrollHeight; return true; })()`);
  ok(await page.eval(`(() => { const b = [...document.querySelectorAll('.results button.primary')].pop(), r = b.getBoundingClientRect(), legal = document.querySelector('.legal-bar').getBoundingClientRect().height;
    return r.bottom <= innerHeight - legal + 1 && r.top >= 0; })()`), 'tras el combate se puede bajar hasta el botón de seguir');
  await page.resize();
};
