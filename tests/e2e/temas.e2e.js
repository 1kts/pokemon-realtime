// Propuestas de aspecto (docs/propuestas-ui.md): solo se ven si se piden. Sin ?tema el juego se ve como siempre y no
// carga ninguna hoja de tema; con ?tema=b se ve la propuesta B, se recuerda al volver a entrar y ?tema=no la quita.
// Con el tema puesto, el menú y Historia se siguen usando igual (nada tapado). La propuesta D se mira además por lo
// que ve el jugador: colores limpios y que se leen, el dorado solo en lo que toca y lo listo, un latido a la vez (y
// ninguno sin movimiento) y que en el móvil todo cabe
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'temas' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  const themeLoads = () => page.requests.filter(u => u.includes('/themes/')).length;
  // (el color de fondo de la tarjeta de Historia, tal como se pinta)
  const storyBg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundColor`;
  const enter = async q => {
    await page.goto('/' + q);
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
  };

  ok(themeLoads() === 0, 'sin tema no se pide ninguna hoja de tema');
  const plain = await page.eval(storyBg);

  await enter('?tema=b');
  ok(themeLoads() === 1, 'con ?tema=b se carga su hoja');
  await page.waitFor(`${storyBg} !== ${JSON.stringify(plain)}`, 5000).catch(() => {});
  const themed = await page.eval(storyBg);
  ok(themed === 'rgb(239, 90, 60)', `con la propuesta B, Historia es un bloque de color liso (${themed}; sin tema, ${plain})`);

  // Se recuerda: al volver a entrar sin nada en la dirección sigue el tema
  await enter('');
  ok(themeLoads() === 2 && await page.eval(storyBg) === themed, 'al volver a entrar, el tema elegido sigue');

  // Se usa igual: Historia se abre con el ratón y el botón de desafiar se ve y se puede pulsar
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
  await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);   // atajo: la guía de la primera vez
  const go = await page.eval(`(() => { const b = document.querySelector('.story-side .node-info button.primary'), r = b.getBoundingClientRect();
    return b.textContent.trim() + '|' + (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b); })()`);
  ok(go === '¡Desafiar!|true', `con el tema, «¡Desafiar!» se ve y no lo tapa nada (${go})`);

  // ?tema=no lo quita: vuelve el aspecto de siempre
  const before = themeLoads();
  await enter('?tema=no');
  ok(themeLoads() === before && await page.eval(storyBg) === plain, '?tema=no lo quita y el menú vuelve a ser el de siempre');

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

  // Colores limpios y que se leen: cada modo empieza en su color (con el blanco encima a 4,5:1 o más) y se oscurece
  // hacia su propio tono; Historia acaba en rojo oscuro, no en transparente, y Clasificatoria es ámbar, no caqui
  const modes = await page.eval(`(() => { ${TD}
    return [...document.querySelectorAll('.menu-card')].map(c => { const st = stops(c), a = st[0], z = st[st.length - 1];
      return { m: c.classList[1], white: +onWhite(a).toFixed(2), hA: Math.round(hsl(a)[0]), hZ: Math.round(hsl(z)[0]), sA: +hsl(a)[1].toFixed(2), sZ: +hsl(z)[1].toFixed(2), lZ: +hsl(z)[2].toFixed(2), alphaZ: z.length > 3 ? z[3] : 1 }; }); })()`);
  const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  ok(modes.length >= 7 && modes.every(m => m.white >= 4.5), `con la D, el blanco se lee sobre el color de cada modo (${modes.map(m => m.m + ' ' + m.white).join(', ')})`);
  ok(modes.every(m => hueGap(m.hA, m.hZ) <= 12 && m.sZ >= .6 && m.lZ < m.white),
    `con la D, cada modo se oscurece hacia su propio tono y sin ensuciarse (${modes.map(m => `${m.m} ${m.hA}°→${m.hZ}° s${m.sZ}`).join(', ')})`);
  const story = modes.find(m => m.m === 'story'), ranked = modes.find(m => m.m === 'ranked');
  ok(story && (story.hZ <= 12 || story.hZ >= 350) && story.alphaZ === 1 && story.lZ < .3, `con la D, Historia acaba en rojo oscuro (${JSON.stringify(story)})`);
  ok(ranked && ranked.hA >= 25 && ranked.hA <= 45 && ranked.sA >= .8, `con la D, Clasificatoria es ámbar y no caqui (${JSON.stringify(ranked)})`);

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

  // Un latido a la vez: lo que tiene algo listo late por turnos (8 s mirando cada 150 ms: nunca dos a la vez y
  // laten al menos dos distintos), y con prefers-reduced-motion no late nada
  const beats = async ms => {
    await page.eval(`window.__beat = { max: 0, who: new Set() }; window.__beatT = setInterval(() => {
      const on = [...document.querySelectorAll('.hub-tz, .hub-coll .coll-tile, .mw-head .claim-all')].filter(e => { const t = getComputedStyle(e).transform; return t !== 'none' && !/^matrix\\(1, 0, 0, 1, 0, -?[0-3](\\.\\d+)?\\)$/.test(t); });
      __beat.max = Math.max(__beat.max, on.length); on.forEach(e => __beat.who.add(e.textContent.trim().slice(0, 12))); }, 150); true`);
    await new Promise(r => setTimeout(r, ms));
    return page.eval(`(() => { clearInterval(__beatT); return { max: __beat.max, who: [...__beat.who] }; })()`);
  };
  const b1 = await beats(8500);
  ok(b1.max === 1 && b1.who.length >= 2, `con la D, lo que está listo late de uno en uno (a la vez como mucho ${b1.max}; han latido: ${b1.who.join(' | ')})`);
  await page.media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const b2 = await beats(3000);
  ok(b2.max === 0, `con la D y prefers-reduced-motion, no late nada (${b2.who.join(' | ') || 'nada'})`);
  await page.media();

  // Historia en el escritorio: «¡Desafiar!» dorado, a la vista y sin nada encima
  const desafiar = async () => {
    await page.click('.menu-card.story');
    await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
    if (await page.eval(`!!document.querySelector('body > .modal button.primary')`)) await page.click('body > .modal button.primary');   // la guía de la primera vez: «¡A jugar!»
    await page.waitFor(`!document.querySelector('body > .modal')`, 5000);
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
