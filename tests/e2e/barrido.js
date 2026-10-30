// Barrido de todas las pantallas y ventanas en varios tamaños, mirando lo que ve el jugador, no cómo está hecho
// (lo usan pantallas-movil, pantallas-movil-pequeno, pantallas-ventana y pantallas-escritorio, un tamaño cada una:
// juntos pasaban de los 5 minutos que tiene cada prueba en el CI):
//   - nada se sale de ancho (sin scroll horizontal)
//   - ningún botón visible está tapado por otra cosa (un aviso, una barra, otra ventana)
//   - con el dedo, los botones miden al menos MIN_TAP px
//   - sin problemas de accesibilidad graves (axe-core: WCAG 2 A y AA)
// Con E2E_GEOM=archivo.json guarda además la posición y el tamaño de todo lo visible de cada pantalla (para comparar
// un antes y un después al reordenar el CSS: tools/geom-diff.js).
const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');   // accesibilidad (axe-core, solo en las pruebas)

const MIN_TAP = 24;   // px en el lado corto de un botón con el dedo (Apple recomienda 44: subirlo según se arregle)
const VIEWS = ['menu', 'story', 'team', 'online', 'treasure', 'settings', 'profile', 'collection', 'missions', 'ladder', 'tower', 'practice', 'dex', 'bag', 'shop', 'friends'];
// Ventanas: cómo se abren (atajo: el barrido mira el diseño de cada una, no cómo se llega)
const MODALS = {
  novedades: `ui.patchNotes()`, creditos: `ui.legal()`, bug: `ui.bugReport()`, avatar: `ui.avatarEditor('effect')`, diario: `ui.dailyModal()`,
  ficha: `ui.monSheet(ui.profile.mons[0].uid)`, vestuario: `ui.monSheet(ui.profile.mons[0].uid, 'look')`, movimientos: `ui.monSheet(ui.profile.mons[0].uid, 'moves')`,
  mote: `ui.nickModal(ui.profile.mons[0])`, entrenador: `ui.userModal(OTHER)`,
};

// En la página: lo que falla en lo que se ve ahora (y, con geom, dónde está cada cosa)
const CHECK = (touch, geom) => `(() => {
  const out = [], W = innerWidth, H = innerHeight;
  const name = n => n ? n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + (n.textContent ? ' «' + n.textContent.trim().slice(0, 24) + '»' : '') : 'nada';
  const sc = document.getElementById('screen');
  if (document.documentElement.scrollWidth > W + 1) out.push('la página se sale de ancho: ' + document.documentElement.scrollWidth + ' > ' + W);
  if (sc && !sc.hidden && sc.scrollWidth > sc.clientWidth + 1) out.push('la pantalla se sale de ancho: ' + sc.scrollWidth + ' > ' + sc.clientWidth);
  // Lo que se puede pulsar ahora: si hay una ventana abierta, solo lo de la de encima
  const tops = [...document.querySelectorAll('body > .modal, body > .loot-pop, body > .install-guide, body > .mon-sheet-back')];
  const scope = tops.length ? tops[tops.length - 1] : document;
  for (const e of scope.querySelectorAll('button, a[href], [role=button], input, select, summary')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden' || e.closest('[hidden], .tb-mobile:not(:has(*))')) continue;
    // La parte que se ve: recortada por la pantalla y por cada contenedor con scroll (lo que queda fuera se ve
    // al desplazarlo, no está tapado)
    let L = Math.max(0, r.left), T = Math.max(0, r.top), R = Math.min(W, r.right), B = Math.min(H, r.bottom);
    for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = a.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); }
    }
    if (R - L < 4 || B - T < 4) continue;   // fuera de la vista: se llega desplazando
    const x = (L + R) / 2, y = (T + B) / 2;
    const top = document.elementFromPoint(x, y);
    // No es tapar: lo que hay encima lo contiene (lo recorta un scroll) o es una barra que se queda pegada
    // (sticky) mientras lo de debajo pasa por detrás al bajar
    const sticky = n => { for (; n && n !== document.body; n = n.parentElement) if (/sticky|fixed/.test(getComputedStyle(n).position) && !n.matches('.modal, .mon-sheet-back')) return true; return false; };
    if (top && !(top === e || e.contains(top) || top.contains(e) || (e.labels && [...e.labels].some(l => l.contains(top)))) && !sticky(top))
      out.push('tapado: ' + name(e) + ' por ' + name(top));
    // (los enlaces de texto de la barra legal no cuentan: son texto, como en cualquier web)
    // Lo que responde al dedo, no el dibujo: el botón tiene que recibir el toque a MIN_TAP/2 de su centro en las
    // cuatro direcciones (cuenta su zona de toque invisible si la tiene)
    // (a medio desplazar, con menos de MIN_TAP a la vista, no se mide: se ve entero al desplazarlo; los sitios
    // bloqueados del mapa solo dicen que están cerrados)
    const hit = (dx, dy) => { const n = document.elementFromPoint(x + dx, y + dy); return !!n && (n === e || e.contains(n) || sticky(n)); };
    const d = ${MIN_TAP} / 2 - 1, cut = (R - L < ${MIN_TAP} && r.width >= ${MIN_TAP}) || (B - T < ${MIN_TAP} && r.height >= ${MIN_TAP});
    if (${touch} && e.matches('button, a[href], [role=button], summary') && !e.closest('.legal-bar') && !cut && !(hit(-d, 0) && hit(d, 0) && hit(0, -d) && hit(0, d)))
      out.push('pequeño para el dedo (' + Math.round(r.width) + '×' + Math.round(r.height) + '): ' + name(e));
  }
  // La barra legal (al final de la pantalla, sin fondo) no puede quedar encima de textos de la pantalla
  const bar = sc && sc.querySelector(':scope > .legal-bar');
  if (bar && !tops.length && getComputedStyle(bar).display !== 'none') {
    const b = bar.getBoundingClientRect();
    for (const e of sc.querySelectorAll('*')) {
      // (lo de un desplegable cerrado no se ve, aunque el navegador le dé sitio)
      // (cada elemento con texto propio, también los que tienen negritas u otros dentro)
      if (bar.contains(e) || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || e.closest('details:not([open]) > :not(summary)')) continue;
      // (la parte que se ve: lo recortado por un contenedor con scroll no cuenta)
      const q = e.getBoundingClientRect();
      let L = q.left, T = q.top, R = q.right, B = q.bottom;
      for (let a = e.parentElement; a && a !== sc; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const c = a.getBoundingClientRect(); L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom); }
      }
      if (R - L > 1 && B - T > 1 && B > b.top + 2 && T < b.bottom - 2 && R > b.left && L < b.right && getComputedStyle(e).visibility !== 'hidden') out.push('la barra legal pisa: ' + name(e));
    }
  }
  let g = null;
  if (${geom}) {
    g = {};
    const seen = new Map();
    for (const e of scope.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > H * 3) continue;
      const k = e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).sort().join('.') : '');
      const i = seen.get(k) || 0; seen.set(k, i + 1);
      if (i < 12) g[k + '#' + i] = [r.left, r.top, r.width, r.height].map(Math.round);
    }
  }
  return { out: [...new Set(out)], g };
})()`;

// only: 'pantallas' o 'ventanas' para mirar solo una parte (juntas, en escritorio, pasaban de los 5 minutos del CI)
module.exports = (SIZES, only) => async ({ page, player, ok }) => {
  const other = await player({ user: 'Vecina' });
  other.client.send({ t: 'dev', dex: 6, level: 40, region: 'kanto', badges: 3 });
  const op = await other.client.wait(m => m.t === 'profile');
  const me = await player({ user: 'barrido' });
  for (const dex of [25, 4, 133]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', item: 'pocion', qty: 3 }); await me.client.wait(m => m.t === 'profile');
  const geomFile = process.env.E2E_GEOM, geom = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // (espera a que acaben las animaciones de entrada de toda la página; las que no acaban nunca, como un brillo, no)
  const settle = () => page.waitFor(`document.getAnimations().every(a => a.playState !== 'running' || !a.effect || a.effect.getTiming().iterations === Infinity
    || !(a.effect.target instanceof Element) || !a.effect.target.closest('#screen, body > .modal, body > .mon-sheet-back'))`).catch(() => {});   // (las de la pantalla y las ventanas)
  const problems = [], a11y = [];
  for (const [W, H, touch] of SIZES) {
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.storyGuide', '1'); localStorage.setItem('arena.towerGuide', '1');
      ${touch ? `localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1');` : ''} true`);
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(AXE + '; true');
    const look = async label => {
      await settle(); await sleep(150);
      const r = await page.eval(CHECK(touch, !!geomFile));
      for (const o of r.out) problems.push(`${W}×${H} ${label}: ${o}`);
      if (r.g) geom[`${W}x${H} ${label}`] = r.g;
      // Accesibilidad (WCAG 2 A y AA) de lo que hay a la vista: la ventana de encima o la pantalla
      const ax = await page.eval(`(async () => { const tops = [...document.querySelectorAll('body > .modal, body > .loot-pop, body > .install-guide, body > .mon-sheet-back')], scope = tops.length ? tops[tops.length - 1] : document.getElementById('screen');
        const r = await axe.run(scope, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] });
        return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ej: v.nodes.slice(0, 2).map(x => x.target.join(' ') + ' · ' + (x.failureSummary || '').split('\\n')[1]) })); })()`);
      for (const v of ax) a11y.push({ where: `${W}×${H} ${label}`, ...v });
    };
    for (const v of only === 'ventanas' ? [] : VIEWS) {
      await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); window.__app.ui.show('${v}'); true`);   // atajo: el barrido mira el diseño de cada pantalla
      await page.waitFor(`window.__app.ui.view === '${v}'`);
      await look(v);
    }
    await page.eval(`window.__app.ui.show('menu'); true`);   // atajo: vuelta al menú para abrir las ventanas encima
    for (const [m, js] of only === 'pantallas' ? [] : Object.entries(MODALS)) {
      await page.eval(`(() => { const ui = window.__app.ui, OTHER = ${JSON.stringify(op.p.id)}; document.querySelectorAll('body > .modal').forEach(x => x.remove()); ui.sheet && ui.closeSheet(); ${js}; return true; })()`);
      await page.waitFor(`document.querySelector('body > .modal')`, 5000).catch(() => {});
      await look('ventana ' + m);
    }
  }
  if (geomFile) fs.writeFileSync(geomFile, JSON.stringify(geom, null, 1));
  if (process.env.E2E_REPORT) fs.writeFileSync(process.env.E2E_REPORT, problems.join('\n'));
  if (process.env.E2E_A11Y) fs.writeFileSync(process.env.E2E_A11Y, JSON.stringify(a11y, null, 1));
  // Fallos conocidos que aún no tienen arreglo (a la vista aquí, no escondidos): se avisa de ellos en la salida
  const KNOWN = [];   // ([/patrón/, 'por qué'])
  for (const [re, why] of KNOWN) if (problems.some(p => re.test(p))) console.log('    (conocido) ' + why);
  const known = p => KNOWN.some(([re]) => re.test(p));
  const say = (re, what) => { const l = problems.filter(p => re.test(p) && !known(p)); ok(!l.length, l.length ? `${what}:\n      ${l.slice(0, 12).join('\n      ')}${l.length > 12 ? `\n      … y ${l.length - 12} más` : ''}` : what); };
  const sizes = SIZES.map(([w, h]) => `${w}×${h}`).join(', ');
  say(/de ancho/, `ninguna pantalla ni ventana se sale de ancho en ${sizes}`);
  say(/tapado/, 'ningún botón visible está tapado por otra cosa');
  say(/barra legal pisa/, 'la barra legal no se monta sobre el contenido de ninguna pantalla');
  // Accesibilidad (axe-core, WCAG 2 A y AA): nada grave ni crítico
  const bad = a11y.filter(v => v.impact === 'serious' || v.impact === 'critical');
  ok(!bad.length, bad.length ? `accesibilidad:\n      ${bad.slice(0, 10).map(v => `${v.where}: ${v.id} (${v.impact}) ${v.ej[0] || ''}`).join('\n      ')}` : 'sin problemas de accesibilidad graves (axe-core, WCAG 2 A y AA)');
  if (SIZES.some(([, , touch]) => touch)) say(/pequeño para el dedo/, `con el dedo, los botones miden al menos ${MIN_TAP} px`);
};
