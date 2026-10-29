// Menús en el móvil: en horizontal (844×390) ninguna pantalla se sale de ancho, la
// barra legal ocupa poco (una línea de texto, que se despliega al tocarla) y la cabecera cabe; el mapa de la
// Historia se ve entero en horizontal y la ficha de un Pokémon cabe en la pantalla
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'movilmenus' });
  me.client.send({ t: 'dev', dex: 8, level: 30, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  const views = ['menu', 'story', 'team', 'online', 'treasure', 'settings', 'profile', 'collection', 'missions', 'ladder', 'tower', 'practice', 'dex', 'bag'];
  const wide = () => page.eval(`(() => { const s = document.getElementById('screen'); return s.scrollWidth <= innerWidth + 1; })()`);
  // Como app (Añadir a pantalla de inicio): manifest en horizontal y a pantalla completa, con sus iconos, y las
  // etiquetas que pide el iPhone
  await page.goto('/');
  const app = await page.eval(`(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href), m = await r.json();
    const icons = await Promise.all([...m.icons.map(i => i.src), document.querySelector('link[rel=apple-touch-icon]').getAttribute('href')].map(async u => (await fetch(u)).headers.get('content-type')));
    return { type: r.headers.get('content-type'), display: m.display, orientation: m.orientation, icons, ios: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content };
  })()`);
  ok(/manifest\+json/.test(app.type) && app.display === 'fullscreen' && app.orientation === 'landscape' && app.icons.every(t => t === 'image/png') && app.ios === 'yes',
    'se puede añadir a la pantalla de inicio: se abre como app, en horizontal y a pantalla completa, con su icono');
  // (en vertical, las mismas comprobaciones en movil-menus-vertical.e2e.js: juntas pasaban de 3 minutos en el CI)
  for (const [W, H] of [[844, 390]]) {
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
    // El menú cabe en una pantalla: los 7 modos, tu colección y las misiones a la vista sin bajar (tras su animación de entrada)
    await page.waitFor(`[...document.getElementById('screen').children].every(c => c.getAnimations().every(a => a.playState === 'finished'))`);
    ok(await page.eval(`(() => { const all = [...document.querySelectorAll('.menu-card, .hub-coll .coll-tile, .missions-widget .mw-head')];
      return all.length >= 13 && all.every(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }); })()`), `${W}×${H}: el menú cabe en una pantalla (modos, colección y misiones)`);
    const over = [];
    for (const v of views) {
      // atajo: el barrido mira el diseño de cada pantalla, no cómo se llega a ella
      await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); window.__app.ui.show('${v}'); true`);
      await page.waitFor(`window.__app.ui.view === '${v}'`);
      await new Promise(r => setTimeout(r, 250));
      if (!(await wide())) over.push(v);
    }
    ok(!over.length, `${W}×${H}: ninguna de las ${views.length} pantallas se sale de ancho${over.length ? ' (se salen: ' + over.join(', ') + ')' : ''}`);
    const legal = await page.eval(`Math.round(document.querySelector('.legal-bar').getBoundingClientRect().height)`);
    ok(legal <= 48, `${W}×${H}: la barra legal ocupa poco (${legal} px)`);
    await page.eval(`window.__app.ui.show('menu'); true`);   // atajo: vuelta al menú tras el barrido
    await page.waitFor(`document.querySelector('.hub-bar .hub-me')`);
    ok(await page.eval(`(() => { const r = document.querySelector('.hub-bar .hub-me').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; })()`), `${W}×${H}: la cabecera del menú cabe`);
  }

  // Tooltips con el dedo: tocar no los saca (se quedaban pegados); mantener medio segundo, sí. En el botón del idioma
  // (abre su lista, sin cambiar de pantalla: al cambiar de pantalla se iría el tooltip y no se vería si se queda pegado)
  const tipSel = '.hub-bar .lang-cur';
  await page.waitFor(`document.querySelector('${tipSel}')`);
  // (con el dedo de verdad: toques del navegador, no eventos inventados)
  // Un toque corto: la página mide cuánto duró de verdad (con la máquina cargada, los 60 ms pedidos pueden pasar del
  // medio segundo y ser una pulsación larga, que sí saca el tooltip); si no fue corto, se repite
  // (escuchando en el documento: el menú se repinta solo cada poco y el botón puede ser otro)
  await page.eval(`(() => { window.__tap = null; const on = e => e.target instanceof Element && e.target.closest('${tipSel}');
    // (y si a los 100 ms de poner el dedo ya hay tooltip: con el reloj de la página, aunque la máquina vaya lenta)
    document.addEventListener('pointerdown', e => { if (on(e)) { window.__tapT = performance.now(); setTimeout(() => { window.__early = !!document.querySelector('.ui-tip.on'); }, 100); } }, { capture: true });
    document.addEventListener('pointerup', e => { if (on(e)) window.__tap = performance.now() - window.__tapT; }, { capture: true }); return true; })()`);
  let tap = null;
  for (let i = 0; i < 4 && !(tap !== null && tap < 300); i++) {
    await page.eval(`document.querySelectorAll('.ui-tip.on').forEach(t => t.classList.remove('on')); true`);
    await page.press(tipSel, 60);
    tap = await page.eval('window.__tap');
  }
  ok(tap !== null && await page.eval(`window.__early === false`), 'con el dedo, tocar no saca el tooltip al momento (solo al mantenerlo)');
  await new Promise(r => setTimeout(r, 650));   // más que la pulsación larga: no debe salir nada
  if (tap < 300) ok(await page.eval(`!document.querySelector('.ui-tip.on')`), `y un toque corto (${Math.round(tap)} ms) no lo deja pegado`);
  else log(`(la máquina va tan lenta que ningún toque ha sido corto: ${Math.round(tap)} ms; no se mira si se queda pegado)`);
  await page.fingerDown(tipSel);
  // (sale a los 500 ms; en el CI, lento, se espera a que aparezca en vez de un tiempo fijo)
  ok(await page.waitFor(`!!document.querySelector('.ui-tip.on')`, 15000).then(() => true, () => false) && await page.see(await page.eval(`document.querySelector('${tipSel}').dataset.tip || ''`), { in: '.ui-tip' }),
    'manteniendo el dedo medio segundo sale el tooltip, con su texto');
  await page.fingerUp();

  // Las novedades se desplazan dentro de su ventana (en horizontal no cabían y no se podía bajar)
  await page.tap('Novedades');
  await page.waitFor(`document.querySelector('.notes-list')`);
  ok(await page.eval(`(() => { const l = document.querySelector('.notes-list'); l.scrollTop = 400; const b = document.querySelector('.modal-box').getBoundingClientRect(); return l.scrollTop > 100 && b.bottom <= innerHeight + 1; })()`), 'las novedades se desplazan dentro de su ventana, que cabe en la pantalla');
  await page.key('Escape');

  // La barra legal: en una línea, y al tocar el texto se ve entero
  await page.resize(844, 390);
  const h1 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  await page.press('.legal-text');
  const h2 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  ok(h2 > h1 + 10 && /no está afiliado/i.test(await page.eval(`document.querySelector('.legal-text').textContent`)), 'tocar el texto legal lo despliega entero');
  await page.press('.legal-text');

  // La Historia cabe entera en la pantalla en horizontal: el Camino (lo primero que sale) y el mapa
  await page.tap(/^Historia/);
  await page.waitFor(`document.querySelector('.story-pathwrap') && document.querySelector('.story-side .node-info button.primary')`);
  ok(await page.eval(`(() => { const m = document.querySelector('.story-pathwrap').getBoundingClientRect(), b = document.querySelector('.story-side .node-info button.primary').getBoundingClientRect();
    return m.top >= 0 && m.bottom <= innerHeight + 1 && b.left >= m.right && b.bottom <= innerHeight && b.top >= 0 && document.getElementById('screen').scrollTop === 0; })()`), 'en horizontal el Camino se ve entero, con la ficha al lado y su botón de jugar a la vista sin bajar');
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.story .map')`);
  // (el clic del arnés centra la pestaña, que en el móvil está abajo, y baja la pantalla; quien la toca no baja nada)
  await page.eval(`document.getElementById('screen').scrollTo(0, 0); true`);
  const mapH = await page.eval(`Math.round(document.querySelector('.story .map').getBoundingClientRect().height)`);
  ok(mapH <= 390 - h1, `en horizontal el mapa se ve entero (${mapH} px de alto)`);
  ok(await page.eval(`(() => { const m = document.querySelector('.story .map').getBoundingClientRect(), b = document.querySelector('.story-side .node-info button.primary').getBoundingClientRect();
    return b.left >= m.right && b.bottom <= innerHeight && b.top >= 0 && document.getElementById('screen').scrollTop === 0; })()`), 'la ficha del sitio va al lado del mapa, con el botón de jugar a la vista sin bajar');

  // La ficha de un Pokémon cabe, con el sprite dentro de su recuadro
  await page.tap('Volver');
  await page.tap('Mis Pokémon');
  await page.waitFor(`document.querySelector('.mon-card')`);
  await page.press('.mon-card .mon-name');
  await page.waitFor(`document.querySelector('.mon-sheet .ms-stage canvas')`);
  ok(await page.eval(`(() => { const s = document.querySelector('.mon-sheet').getBoundingClientRect(), st = document.querySelector('.ms-stage').getBoundingClientRect(), c = document.querySelector('.ms-stage canvas').getBoundingClientRect();
    return s.bottom <= innerHeight + 1 && c.height <= st.height + 1; })()`), 'la ficha cabe en la pantalla y el sprite no se sale de su recuadro');
  await page.resize();
};
