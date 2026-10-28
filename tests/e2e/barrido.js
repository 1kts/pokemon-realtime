// Barrido de todas las pantallas y ventanas en varios tamaños, mirando lo que ve el jugador, no cómo está hecho
// (lo usan pantallas-movil.e2e.js, 844 y 667 en horizontal con pantalla táctil, y pantallas-ventana.e2e.js, 390 de
// ancho y escritorio de 1280: juntos pasaban de los 5 minutos que tiene cada prueba en el CI):
//   - nada se sale de ancho (sin scroll horizontal)
//   - ningún botón visible está tapado por otra cosa (un aviso, una barra, otra ventana)
//   - con el dedo, los botones miden al menos MIN_TAP px
// Con E2E_GEOM=archivo.json guarda además la posición y el tamaño de todo lo visible de cada pantalla (para comparar
// un antes y un después al reordenar el CSS: tools/geom-diff.js).
const fs = require('fs');

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
  const tops = [...document.querySelectorAll('body > .modal, body > .loot-pop, body > .install-guide')];
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
    if (${touch} && e.matches('button, a[href], [role=button], summary') && !e.closest('.legal-bar, .node.locked') && !cut && !(hit(-d, 0) && hit(d, 0) && hit(0, -d) && hit(0, d)))
      out.push('pequeño para el dedo (' + Math.round(r.width) + '×' + Math.round(r.height) + '): ' + name(e));
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

module.exports = SIZES => async ({ page, player, ok }) => {
  const other = await player({ user: 'Vecina' });
  other.client.send({ t: 'dev', dex: 6, level: 40, region: 'kanto', badges: 3 });
  const op = await other.client.wait(m => m.t === 'profile');
  const me = await player({ user: 'barrido' });
  for (const dex of [25, 4, 133]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', item: 'pocion', qty: 3 }); await me.client.wait(m => m.t === 'profile');
  const geomFile = process.env.E2E_GEOM, geom = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settle = () => page.waitFor(`[...document.querySelectorAll('#screen > *, body > .modal *')].every(c => c.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity))`).catch(() => {});
  const problems = [];
  for (const [W, H, touch] of SIZES) {
    await page.goto('/');
    await page.eval(`localStorage.clear(); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.storyGuide', '1'); localStorage.setItem('arena.towerGuide', '1');
      ${touch ? `localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1');` : ''} true`);
    await page.resize(W, H);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    const look = async label => {
      await settle(); await sleep(150);
      const r = await page.eval(CHECK(touch, !!geomFile));
      for (const o of r.out) problems.push(`${W}×${H} ${label}: ${o}`);
      if (r.g) geom[`${W}x${H} ${label}`] = r.g;
    };
    for (const v of VIEWS) {
      await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); window.__app.ui.show('${v}'); true`);   // atajo: el barrido mira el diseño de cada pantalla
      await page.waitFor(`window.__app.ui.view === '${v}'`);
      await look(v);
    }
    await page.eval(`window.__app.ui.show('menu'); true`);   // atajo: vuelta al menú para abrir las ventanas encima
    for (const [m, js] of Object.entries(MODALS)) {
      await page.eval(`(() => { const ui = window.__app.ui, OTHER = ${JSON.stringify(op.p.id)}; document.querySelectorAll('body > .modal').forEach(x => x.remove()); ui.sheet && ui.closeSheet(); ${js}; return true; })()`);
      await page.waitFor(`document.querySelector('body > .modal')`, 5000).catch(() => {});
      await look('ventana ' + m);
    }
  }
  if (geomFile) fs.writeFileSync(geomFile, JSON.stringify(geom, null, 1));
  if (process.env.E2E_REPORT) fs.writeFileSync(process.env.E2E_REPORT, problems.join('\n'));
  // Fallos conocidos que aún no tienen arreglo (a la vista aquí, no escondidos): se avisa de ellos en la salida
  const KNOWN = [
    [/667×375 story: pequeño para el dedo .*Ruta 24/, 'en el mapa de 667 de ancho, la Ruta 24 está tan cerca del gimnasio de Misty que sus zonas de toque se pisan'],
  ];
  for (const [re, why] of KNOWN) if (problems.some(p => re.test(p))) console.log('    (conocido) ' + why);
  const known = p => KNOWN.some(([re]) => re.test(p));
  const say = (re, what) => { const l = problems.filter(p => re.test(p) && !known(p)); ok(!l.length, l.length ? `${what}:\n      ${l.slice(0, 12).join('\n      ')}${l.length > 12 ? `\n      … y ${l.length - 12} más` : ''}` : what); };
  const sizes = SIZES.map(([w, h]) => `${w}×${h}`).join(', ');
  say(/de ancho/, `ninguna pantalla ni ventana se sale de ancho en ${sizes}`);
  say(/tapado/, 'ningún botón visible está tapado por otra cosa');
  if (SIZES.some(([, , touch]) => touch)) say(/pequeño para el dedo/, `con el dedo, los botones miden al menos ${MIN_TAP} px`);
};
