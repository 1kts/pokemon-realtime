// El aspecto del juego es el tema D (docs/propuestas-ui.md): sin pedir nada se carga con la página. Las otras
// propuestas se ven si se piden: con ?tema=b se ve la B, se recuerda al volver a entrar y ?tema=no deja el aspecto de
// antes, sin ninguna hoja de tema; ?tema=d vuelve al de siempre.
// Con el tema puesto, el menú y Historia se siguen usando igual (nada tapado). La propuesta D se mira además por lo
// que ve el jugador: colores limpios y que se leen, el dorado solo en lo que toca y lo listo, lo que tiene un premio esperando parpadea
// y lo cruza un destello (y nada se mueve sin movimiento) y que en el móvil todo cabe
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'temas' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto', gems: 300 });   // (con gemas para una tirada de Lucky Spin)
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  // (el color de fondo de la tarjeta de Historia, tal como se pinta)
  const storyBg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundColor`;
  const enter = async q => {
    await page.goto('/' + q);
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
  };

  // (la hoja que se aplica de verdad: la que está entre las hojas de la página y tiene reglas cargadas)
  const sheet = `(() => { const l = document.getElementById('tema-css'); return l && l.sheet && l.sheet.cssRules.length ? l.getAttribute('href') : null; })()`;
  await page.waitFor(`${sheet} !== null`, 10000).catch(() => {});
  ok(await page.eval(sheet) === '/themes/tema-d.css' && await page.eval(`document.body.classList.contains('tema-d')`), 'sin pedir nada, el juego lleva el tema D');
  const base = await page.eval(storyBg);
  // (la D pinta Historia con un degradado: lo que la distingue de sin tema es su imagen de fondo)
  const storyImg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundImage`;
  const baseImg = await page.eval(storyImg);

  await enter('?tema=b');
  await page.waitFor(`${sheet} === '/themes/tema-b.css'`, 10000).catch(() => {});
  ok(await page.eval(sheet) === '/themes/tema-b.css' && await page.eval(`document.body.classList.contains('tema-b') && !document.body.classList.contains('tema-d')`), 'con ?tema=b se carga su hoja en vez de la D');
  await page.waitFor(`${storyBg} !== ${JSON.stringify(base)}`, 5000).catch(() => {});
  const themed = await page.eval(storyBg);
  ok(themed === 'rgb(239, 90, 60)', `con la propuesta B, Historia es un bloque de color liso (${themed}; con la D, ${base})`);

  // Se recuerda: al volver a entrar sin nada en la dirección sigue el tema
  await enter('');
  ok(await page.eval(sheet) === '/themes/tema-b.css' && await page.eval(storyBg) === themed, 'al volver a entrar, el tema elegido sigue');

  // Se usa igual: Historia se abre con el ratón y el botón de desafiar se ve y se puede pulsar
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
  // (la guía de la primera vez: se cierra como un jugador)
  await page.waitFor(`[...document.querySelectorAll('body > .modal button')].some(b => b.textContent.includes('¡A jugar!'))`);
  await page.click('¡A jugar!');
  await page.waitFor(`!document.querySelector('body > .modal')`);
  await page.eval(`document.querySelector('.story-path .sp-node.now').scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }); true`);   // atajo: desplazar el camino hasta el líder
  await page.click('.story-path .sp-node.now');
  const go = await page.eval(`(() => { const b = document.querySelector('.story-side .node-info button.primary'), r = b.getBoundingClientRect();
    return b.textContent.trim() + '|' + (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b); })()`);
  ok(go === '¡Desafiar!|true', `con el tema, «¡Desafiar!» se ve y no lo tapa nada (${go})`);

  // ?tema=no lo quita todo: el aspecto de antes, sin hoja de tema ni clase
  await enter('?tema=no');
  const plainImg = await page.eval(storyImg);
  ok(await page.eval(`!document.getElementById('tema-css') && ![...document.body.classList].some(c => c.startsWith('tema-'))`) && plainImg !== baseImg,
    '?tema=no quita el tema y el menú se ve como antes (Historia sin el degradado de la D)');
  await enter('?tema=d');
  ok(await page.eval(`document.body.classList.contains('tema-d')`) && await page.eval(storyImg) === baseImg, '?tema=d vuelve al aspecto del juego');

  // ---------- Propuesta D ----------
  // Ayudas para leer los colores tal como se pintan (los de un degradado, su tono y el contraste del blanco encima);
  // se ponen en cada consulta, porque cada entrada recarga la página
  const TD = `const stops = e => (getComputedStyle(e).backgroundImage.match(/rgba?\\([^)]+\\)/g) || []).map(c => c.match(/[\\d.]+/g).map(Number));
    const hsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1));
      return [(mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60, s, l]; };
    const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const onWhite = c => 1.05 / (lum(c) + .05);
    const rgb = s => s.match(/[\\d.]+/g).map(Number);
    const gold = c => { const [h, s, l] = hsl(c); return h >= 38 && h <= 56 && s > .6 && l > .5; };
    const shown = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    const q = s => document.querySelector(s);`;
  const tiles = `[...document.querySelectorAll('.hub-coll .coll-tile')]`;
  await page.eval(`localStorage.setItem('arena.shopSeen', Data.dayKey()); true`);   // la Tienda ya vista hoy: no hay nada nuevo en ella
  await enter('?tema=d');
  await page.waitFor(`document.body.classList.contains('tema-d') && document.querySelector('#tema-css').sheet`, 10000);

  // Colores limpios y que se leen. Los modos, como las tarjetas de siempre: azul noche (el blanco se lee) con su color
  // encendido detrás del sprite, distinto en cada uno: Historia en rojo y Clasificatoria en oro, no en marrón
  const modes = await page.eval(`(() => { ${TD}
    return [...document.querySelectorAll('.menu-card')].map(c => { const st = stops(c), a = st[0], z = st[st.length - 1];
      const glow = st.find(x => (x.length < 4 || x[3] >= .5) && hsl(x)[1] > .5 && x.slice(0, 3).some(v => v > 40)) || a;
      return { m: c.classList[1], white: +onWhite(a).toFixed(2), whiteZ: +onWhite(z).toFixed(2), hA: Math.round(hsl(a)[0]), hZ: Math.round(hsl(z)[0]), lZ: +hsl(z)[2].toFixed(2), alphaZ: z.length > 3 ? z[3] : 1,
        glow: [Math.round(hsl(glow)[0]), +hsl(glow)[1].toFixed(2), +hsl(glow)[2].toFixed(2)], gold: gold(glow) }; }); })()`);
  const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const story = modes.find(m => m.m === 'story'), rest = modes, ranked = modes.find(m => m.m === 'ranked');
  ok(story && (story.glow[0] <= 12 || story.glow[0] >= 350) && story.glow[1] > .8, `con la D, Historia brilla en rojo (${JSON.stringify(story && story.glow)})`);
  ok(rest.length >= 7 && rest.every(m => m.whiteZ >= 4.5 && m.hZ >= 215 && m.hZ <= 245 && m.lZ < .3), `con la D, los modos son azul noche y el blanco se lee (${rest.map(m => `${m.m} ${m.hZ}° ${m.whiteZ}`).join(', ')})`);
  ok(rest.every(m => m.glow[1] > .5) && rest.every((m, i) => rest.every((o, j) => i === j || hueGap(m.glow[0], o.glow[0]) >= 12)), `con la D, cada modo lleva su color encendido y distinto del de los demás (${rest.map(m => m.m + ' ' + m.glow[0] + '°').join(', ')})`);
  ok(ranked && ranked.gold, `con la D, Clasificatoria brilla en oro y no en marrón (${JSON.stringify(ranked && ranked.glow)})`);

  // El dorado, solo en lo que toca: un único «Jugar» a la vista, el de Historia, y es dorado. La Tienda, ya vista, va
  // en su color; Logros, con premios por recoger, en dorado. La colección con sus colores
  const gilt = await page.eval(`(() => { ${TD}
    const play = [...document.querySelectorAll('.menu-card .go')].filter(shown);
    const t = ${tiles}, hue = e => Math.round(hsl(stops(e)[0])[0]), border = e => gold(rgb(getComputedStyle(e).borderTopColor));
    return { play: play.map(g => g.closest('.menu-card').classList[1] + (gold(stops(g)[1] || stops(g)[0]) ? ' dorado' : '')).join(','),
      shop: border(t[2]), logros: border(t[4]), logrosReady: t[4].classList.contains('ready'), hues: t.map(hue) }; })()`);
  ok(gilt.play === 'story dorado', `con la D, el único «Jugar» a la vista es el de Historia, y en dorado (${gilt.play})`);
  ok(!gilt.shop && gilt.logrosReady && gilt.logros, `con la D, la Tienda sin nada nuevo no es dorada y Logros con premios sí (tienda ${gilt.shop}, logros ${gilt.logros})`);
  const [hMons, hBag, , hDex] = gilt.hues;
  ok((hMons <= 12 || hMons >= 350) && hBag >= 205 && hBag <= 235 && hDex >= 250 && hDex <= 285, `con la D, Mis Pokémon es rojo, Mochila azul y Pokédex violeta (${gilt.hues.join('°, ')}°)`);

  // Lo que tiene un premio esperando se mueve (parpadea, late o lo cruza un destello: es lo que engancha): Lucky Spin
  // (con gemas para una tirada), Logros con premios y «Recoger todo»; con prefers-reduced-motion no se mueve nada
  const moving = async (ms, until) => {
    await page.eval(`window.__mv = new Map(); window.__mvT = setInterval(() => {
      for (const e of document.querySelectorAll('.hub-tz.ready, .hub-coll .coll-tile.ready, .mw-head .claim-all')) {
        const c = getComputedStyle(e), a = getComputedStyle(e, '::after'), k = e.textContent.trim().slice(0, 12);
        (__mv.get(k) || __mv.set(k, new Set()).get(k)).add([c.transform, c.boxShadow, c.borderColor, a.backgroundPosition].join('|'));
      } }, 120); true`);
    // (si se pide, hasta que se haya movido todo: el destello solo cruza 0,6 s de cada 3,2 y con la máquina cargada se
    // toman pocas muestras)
    const t0 = Date.now();
    do await new Promise(r => setTimeout(r, until ? 500 : ms));
    while (until && Date.now() - t0 < ms && !await page.eval(`__mv.size >= 3 && [...__mv.values()].every(v => v.size > 1)`));
    return page.eval(`(() => { clearInterval(__mvT); return [...__mv].map(([k, v]) => [k, v.size > 1]); })()`);
  };
  const m1 = await moving(10000, true);
  ok(m1.length >= 3 && m1.every(([, m]) => m), `con la D, lo que tiene premio se mueve para que se vea (${m1.map(([k, m]) => k + (m ? ' sí' : ' NO')).join(' | ')})`);
  await page.media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const m2 = await moving(2500);
  ok(m2.every(([, m]) => !m), `con la D y prefers-reduced-motion, no se mueve nada (${m2.filter(([, m]) => m).map(([k]) => k).join(' | ') || 'nada'})`);
  await page.media();

  // Historia en el escritorio: «¡Desafiar!» dorado, a la vista y sin nada encima
  const desafiar = async () => {
    await page.click('.menu-card.story');
    await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
    if (await page.eval(`!!document.querySelector('body > .modal button.primary')`)) await page.click('body > .modal button.primary');   // la guía de la primera vez: «¡A jugar!»
    await page.waitFor(`!document.querySelector('body > .modal')`, 5000);
    // (al abrir está elegida la primera ruta con Pokémon por capturar: se toca el líder para ver su ficha)
    await page.eval(`document.querySelector('.story-path .sp-node.now').scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }); true`);   // atajo: desplazar el camino hasta el líder
    await page.click('.story-path .sp-node.now');
    return page.eval(`(() => { ${TD} const b = q('.story-side .node-info button.primary'), r = b.getBoundingClientRect();
      return b.textContent.trim() + '|' + (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b) + '|' + (r.bottom <= innerHeight && r.right <= innerWidth) + '|' + gold(stops(b)[1] || stops(b)[0]); })()`);
  };
  const g1 = await desafiar();
  ok(g1 === '¡Desafiar!|true|true|true', `con la D, «¡Desafiar!» se ve, es dorado y no lo tapa nada (${g1})`);

  // Móvil en horizontal (844×390): todo cabe, «Mis Pokémon» se lee entero y «¡Desafiar!» se ve
  await page.eval(`localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.iosTip', '1'); true`);
  await page.resize(844, 390);
  await enter('?tema=d');
  const fit = await page.eval(`(() => { ${TD}
    const out = [...document.querySelectorAll('.menu-card, .hub-coll .coll-tile, .menu-card b')].filter(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + .5 || r.top < 0 || r.bottom > innerHeight + .5; });
    const cut = [...document.querySelectorAll('.menu-card b, .hub-coll .coll-txt b')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > e.closest('button').getBoundingClientRect().right);
    const mons = q('.hub-coll .coll-tile.mons .coll-txt b');
    // (el texto de «Mis Pokémon», tal como se dibuja, dentro de su baldosa)
    const rg = document.createRange(); rg.selectNodeContents(mons);
    const tr = rg.getBoundingClientRect(), br = mons.closest('button').getBoundingClientRect();
    return { out: out.map(e => { const r = e.getBoundingClientRect(); return e.textContent.trim().slice(0, 14) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round); }),
      cut: cut.map(e => e.textContent.trim()), mons: mons.textContent.trim(), monsOk: tr.left >= br.left && tr.right <= br.right && tr.top >= br.top && tr.bottom <= br.bottom,
      scroll: document.documentElement.scrollWidth > innerWidth }; })()`);
  ok(!fit.out.length && !fit.scroll, `con la D en 844×390, los modos y la colección caben en la pantalla (fuera: ${fit.out.join(', ') || 'nada'})`);
  ok(fit.mons === 'Mis Pokémon' && fit.monsOk && !fit.cut.length, `con la D en 844×390, «Mis Pokémon» y los nombres de los modos se leen enteros (Mis Pokémon ${fit.monsOk ? 'entero' : 'cortado'}; modos cortados: ${fit.cut.join(', ') || 'ninguno'})`);
  const g2 = await desafiar();
  ok(g2 === '¡Desafiar!|true|true|true', `con la D en 844×390, «¡Desafiar!» se ve, es dorado y no lo tapa nada (${g2})`);
};
