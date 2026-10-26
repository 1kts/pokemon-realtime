// Menús en el móvil: en horizontal (844×390) y en vertical (390×844) ninguna pantalla se sale de ancho, la
// barra legal ocupa poco (una línea de texto, que se despliega al tocarla) y la cabecera cabe; el mapa de la
// Historia se ve entero en horizontal y la ficha de un Pokémon cabe en la pantalla
module.exports = async ({ page, player, ok }) => {
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
  for (const [W, H] of [[844, 390], [390, 844]]) {
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
    const over = [];
    for (const v of views) {
      await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); window.__app.ui.show('${v}'); true`);
      await page.waitFor(`window.__app.ui.view === '${v}'`);
      await new Promise(r => setTimeout(r, 250));
      if (!(await wide())) over.push(v);
    }
    ok(!over.length, `${W}×${H}: ninguna de las ${views.length} pantallas se sale de ancho${over.length ? ' (se salen: ' + over.join(', ') + ')' : ''}`);
    const legal = await page.eval(`Math.round(document.querySelector('.legal-bar').getBoundingClientRect().height)`);
    ok(legal <= 48, `${W}×${H}: la barra legal ocupa poco (${legal} px)`);
    await page.eval(`window.__app.ui.show('menu'); true`);
    await page.waitFor(`document.querySelector('.hub-bar .hub-me')`);
    ok(await page.eval(`(() => { const r = document.querySelector('.hub-bar .hub-me').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; })()`), `${W}×${H}: la cabecera del menú cabe`);
  }

  // Tooltips con el dedo: tocar no los saca (se quedaban pegados); mantener medio segundo, sí
  await page.eval(`window.__app.ui.show('menu'); true`);
  const tipSel = await page.eval(`(() => { const n = [...document.querySelectorAll('#screen [title], #screen [data-tip]')].find(e => e.offsetParent && !e.closest('#hud')); n.id = n.id || 'tip-e2e'; return '#' + n.id; })()`);
  const touch = (type) => page.eval(`(() => { const n = document.querySelector('${tipSel}'), r = n.getBoundingClientRect();
    n.dispatchEvent(new PointerEvent('${type}', { pointerId: 3, pointerType: 'touch', bubbles: true, clientX: r.left + 4, clientY: r.top + 4 })); return true; })()`);
  // Un toque corto: todo en la misma consulta (en el CI cada consulta tarda y parecería una pulsación larga)
  await page.eval(`(() => { const n = document.querySelector('${tipSel}'), r = n.getBoundingClientRect();
    for (const type of ['pointerover', 'pointerdown']) n.dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'touch', bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
    n.focus();
    n.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'touch', bubbles: true, clientX: r.left + 4, clientY: r.top + 4 })); return true; })()`);
  await new Promise(r => setTimeout(r, 650));   // más que la pulsación larga: no debe salir nada
  ok(await page.eval(`!document.querySelector('.ui-tip.on')`), 'con el dedo, tocar no deja un tooltip pegado');
  await touch('pointerdown');
  // (sale a los 500 ms; en el CI, lento, se espera a que aparezca en vez de un tiempo fijo)
  await page.waitFor(`!!document.querySelector('.ui-tip.on')`, 15000);
  ok(true, 'manteniendo el dedo medio segundo sale el tooltip');
  await touch('pointerup'); await touch('pointerdown'); await touch('pointerup');

  // Las novedades se desplazan dentro de su ventana (en horizontal no cabían y no se podía bajar)
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); window.__app.ui.patchNotes(); true`);
  await page.waitFor(`document.querySelector('.notes-list')`);
  ok(await page.eval(`(() => { const l = document.querySelector('.notes-list'); l.scrollTop = 400; const b = document.querySelector('.modal-box').getBoundingClientRect(); return l.scrollTop > 100 && b.bottom <= innerHeight + 1; })()`), 'las novedades se desplazan dentro de su ventana, que cabe en la pantalla');
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);

  // La barra legal: en una línea, y al tocar el texto se ve entero
  await page.resize(844, 390);
  const h1 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  await page.eval(`document.querySelector('.legal-text').click(); true`);
  const h2 = await page.eval(`document.querySelector('.legal-bar').getBoundingClientRect().height`);
  ok(h2 > h1 + 10 && /no está afiliado/i.test(await page.eval(`document.querySelector('.legal-text').textContent`)), 'tocar el texto legal lo despliega entero');
  await page.eval(`document.querySelector('.legal-text').click(); true`);

  // El mapa de la Historia cabe entero en la pantalla en horizontal
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.story .map')`);
  const mapH = await page.eval(`Math.round(document.querySelector('.story .map').getBoundingClientRect().height)`);
  ok(mapH <= 390 - h1, `en horizontal el mapa se ve entero (${mapH} px de alto)`);
  ok(await page.eval(`(() => { const m = document.querySelector('.story .map').getBoundingClientRect(), b = document.querySelector('.story-side .node-info button.primary').getBoundingClientRect();
    return b.left >= m.right && b.bottom <= innerHeight && b.top >= 0 && document.getElementById('screen').scrollTop === 0; })()`), 'la ficha del sitio va al lado del mapa, con el botón de jugar a la vista sin bajar');

  // La ficha de un Pokémon cabe, con el sprite dentro de su recuadro
  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card')`);
  await page.eval(`document.querySelector('.mon-card').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet .ms-stage canvas')`);
  ok(await page.eval(`(() => { const s = document.querySelector('.mon-sheet').getBoundingClientRect(), st = document.querySelector('.ms-stage').getBoundingClientRect(), c = document.querySelector('.ms-stage canvas').getBoundingClientRect();
    return s.bottom <= innerHeight + 1 && c.height <= st.height + 1; })()`), 'la ficha cabe en la pantalla y el sprite no se sale de su recuadro');
  await page.resize();
};
