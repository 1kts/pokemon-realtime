// El Vestuario (de cada Pokémon: skins y partículas) y el editor del avatar (marcos, glows y efectos) enseñan todo lo que
// se puede llevar, también lo que aún no tienes: apagado, sin poder ponértelo y diciendo de dónde sale, debajo y al pasar
// el ratón. Los dos tienen el mismo interruptor «Solo los míos / Todos», que empieza en Todos y se recuerda. Recorre las
// listas del juego: lo nuevo entra solo en la prueba, y si no sale o no dice de dónde sale, falla
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'vestuario' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // Mis Pokémon › la ficha de Charmander › Vestuario, pulsando como un jugador
  await page.click('.hub-coll .coll-tile.mons');
  await page.waitFor(`document.querySelector('.mon-card .mon-name')`);
  await page.click('.mon-card .mon-name');
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.click('Vestuario');
  await page.waitFor(`document.querySelector('.ms-wear.parts canvas')`);
  // (cada opción: si se puede tocar, si enseña al Pokémon, su nombre, lo que dice debajo y lo que dice al pasar el ratón)
  const wear = await page.eval(`[...document.querySelectorAll('.ms-wear.skin, .ms-wear.parts')].map(b => ({ kind: b.classList.contains('skin') ? 'skin' : 'parts', off: b.disabled,
    mon: !!b.querySelector('canvas'), name: b.querySelector('b').textContent.trim(), hint: b.querySelector('small').textContent.trim(), tip: b.title }))`);
  const n = await page.eval(`({ skins: Data.SKINS.length, types: Data.TYPE_NAMES.length, effects: Data.EFFECTS.length })`);
  const skins = wear.filter(x => x.kind === 'skin' && x.off), parts = wear.filter(x => x.kind === 'parts' && x.off);
  const told = x => x.mon && x.hint && !/undefined|null/.test(x.hint) && x.tip.includes(x.hint);
  ok(skins.length === n.skins && skins.every(told), `Vestuario enseña las ${n.skins} skins sobre el Pokémon, apagadas y diciendo de dónde salen (${skins.map(x => x.name + ': ' + x.hint).join(' · ')})`);
  ok(parts.length === n.types && parts.every(told), `y las partículas de los ${n.types} tipos, igual (${parts.filter(x => !told(x)).map(x => x.name).join(', ') || 'todas con su pista'})`);
  ok(await page.eval(`[...document.querySelectorAll('.ms-wear.locked')].every(b => b.disabled)`), 'lo que no tienes no se puede poner');
  ok(!(await page.see('Efecto Llamas', { in: '.mon-sheet', ms: 0, scroll: true })), 'el Vestuario es del Pokémon: los efectos del avatar no salen aquí');
  // El interruptor, pulsándolo: con «Solo los míos» se van las skins que no tienes, y con «Todos» vuelven
  ok(await page.see('Skin Holo', { in: '.mon-sheet' }), 'de entrada están todas (Skin Holo, que no tienes, se ve)');
  await page.tap('Solo los míos', { in: '.mon-sheet' });
  await page.waitSee('Sin skin', { in: '.mon-sheet' });
  ok(!(await page.see('Skin Holo', { in: '.mon-sheet', ms: 0 })) && !(await page.see('Partículas de Hielo', { in: '.mon-sheet', ms: 0, scroll: true })), 'con «Solo los míos» desaparecen las skins y partículas que no tienes');
  await page.click('.ms-close');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  await page.click('.inner-bar .back');
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // El editor del avatar (tocando tu foto en el Perfil): el mismo interruptor, y se acuerda de lo elegido en el Vestuario
  await page.click('.hub-ava');
  await page.waitFor(`window.__app.ui.view === 'profile' && document.querySelector('.trainer-card .tc-ava .ava.editable')`);
  await page.click('.trainer-card .tc-ava .ava.editable');
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.click('Efecto');
  await page.waitSee('Ninguno', { in: '.ava-edit' });
  const opts = sel => page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt${sel}')].map(b => { const l = b.querySelector('.ava-fx-layer'), k = l && l.querySelector('.pt-fx b'), c = k && getComputedStyle(k);
    return { off: b.disabled, name: b.querySelector('small').textContent.trim(), hint: (b.querySelector('em') || {}).textContent, tip: b.title || b.dataset.tip, svg: !!b.querySelector('.ava-fx'), aura: !!b.querySelector('.ava-aura'), pixel: !!c && c.backgroundImage.startsWith('url("data:image/svg+xml') && c.imageRendering === 'pixelated', img: c ? c.backgroundImage.slice(0, 400) : '', anim: c ? c.animationName : '' }; })`);
  ok((await opts('')).length === 1, 'sigue en «Solo los míos»: sin efectos, solo «Ninguno»');
  await page.tap('Todos', { in: '.ava-edit' });
  await page.waitSee('Efecto Burbujas', { in: '.ava-edit', scroll: true });
  const dicen = x => x.off && x.hint && !/undefined|null/.test(x.hint) && x.tip.includes(x.hint);
  const fx = await opts('.locked');
  ok(fx.length === n.effects && fx.every(x => dicen(x) && x.pixel), `con «Todos», los ${n.effects} efectos, en pixel art, apagados y con su procedencia (${fx.map(x => x.name + ': ' + x.hint).join(' · ')})`);
  ok(new Set(fx.map(x => x.img)).size === fx.length, `cada efecto tiene su propia forma o colores (${new Set(fx.map(x => x.img)).size} de ${fx.length})`);
  ok(new Set(fx.map(x => x.anim)).size >= 9, `y se mueven de formas distintas (${[...new Set(fx.map(x => x.anim))].join(', ')})`);
  await page.click('Marco');
  await page.waitSee('Marco Eclipse', { in: '.ava-edit', scroll: true });
  const marcos = await opts('.locked');
  const catalogo = await page.eval(`Data.frameCatalog(window.__app.ui.profile.cosmetics.frames).length`), todos = (await opts('')).length - 1;   // (sin «Ninguno»)
  ok(todos === catalogo && marcos.length > 20 && marcos.every(dicen) && marcos.filter(x => /Próximamente/.test(x.hint)).some(x => x.name === 'Marco Vidriera'), `en Marco, los ${catalogo}, y los que no tienes apagados y con su procedencia (${marcos.length})`);
  await page.click('Glow');
  await page.waitSee('Glow del vacío', { in: '.ava-edit', scroll: true });
  const glows = await opts('.locked');
  ok(glows.length === await page.eval('Data.auraCatalog().length') && glows.every(x => dicen(x) && x.aura), `en Glow, todos, apagados y con su procedencia (${glows.length})`);
};
