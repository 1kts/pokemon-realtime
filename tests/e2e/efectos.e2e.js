// Efectos del avatar: van aparte del retrato. Con uno conseguido, en el Perfil (tocando tu foto se abre el
// editor del avatar) se elige y sale por encima de cualquier avatar (aquí, el Pokémon); el retrato de Lucky
// Spin es solo la cara, sin efecto incluido. Los efectos que aún no tienes también salen, apagados. Cada efecto es
// pixel art como los Pokémon (formas sin suavizar) y distinto de los demás: su forma y su movimiento
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'efectos' });
  me.client.send({ t: 'dev', dex: 6, level: 36, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', effects: ['llamas'] }); await me.client.wait(m => m.t === 'profile');
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload(); await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`!document.querySelector('.hub-ava .ava-fx-layer')`), 'sin efecto puesto, el avatar no lleva capa de efecto');
  await page.eval(`window.__app.ui.show('profile'); true`);
  await page.waitFor(`document.querySelector('.trainer-card .tc-ava .ava.editable')`);
  ok(await page.eval(`!document.querySelector('.panel.look')`), 'el Perfil ya no tiene el panel de personalizar: se edita desde la foto');
  ok(await page.eval(`(() => { const k = [...document.querySelector('.pv-flow').children].map(x => x.classList.contains('trainer-card') ? 'card' : x.classList.contains('pv-stats') ? 'stats' : x.classList.contains('pv-cols') ? 'cols' : x.classList.contains('account') ? 'account' : '?'); return k.join() === 'card,stats,cols,account' && !!document.querySelector('.pv-cols .badge-case') && !!document.querySelector('.pv-cols .history'); })()`), 'el Perfil va en orden: tarjeta, estadísticas, medallas y partidas junto a los logros, y la cuenta al final');
  await page.eval(`document.querySelector('.trainer-card .tc-ava .ava.editable').click(); true`);
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.eval(`[...document.querySelectorAll('.ava-edit .ae-tabs button')].find(b => b.textContent === 'Efecto').click(); true`);
  await page.waitFor(`[...document.querySelectorAll('.ava-edit .frame-opt')].some(b => /Llamas/.test(b.textContent))`);
  ok(await page.eval(`(() => { const o = [...document.querySelectorAll('.ava-edit .frame-opt')], lk = o.filter(b => b.classList.contains('locked'));
    return o.length === Data.EFFECTS.length + 1 && lk.length === Data.EFFECTS.length - 1 && lk.every(b => b.disabled && /Lucky Spin/.test(b.textContent)) && !o.find(b => /Llamas/.test(b.textContent)).disabled; })()`), 'en Efecto salen todos: los que no tienes, apagados y con que salen en Lucky Spin');
  // Cada efecto, en pixel art y a su manera: sus partículas son formas sin suavizar, y ni la forma ni el movimiento se
  // repiten de un efecto a otro (lo que se ve en la vista previa de cada opción)
  const looks = await page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt .ava-fx-layer')].map(l => { const b = l.querySelector('.pt-fx b'), c = getComputedStyle(b);
    return { fx: [...l.classList].find(x => x.startsWith('fx-')), pixel: c.backgroundImage.startsWith('url("data:image/svg+xml') && c.imageRendering === 'pixelated', img: c.backgroundImage.slice(0, 400), anim: c.animationName }; })`);
  ok(looks.length === await page.eval('Data.EFFECTS.length') && looks.every(x => x.pixel), `los ${looks.length} efectos son pixel art (${looks.filter(x => !x.pixel).map(x => x.fx).join(', ') || 'todos'})`);
  ok(new Set(looks.map(x => x.img)).size === looks.length, `cada efecto tiene su propia forma o colores (${looks.length} efectos, ${new Set(looks.map(x => x.img)).size} distintos)`);
  ok(new Set(looks.map(x => x.anim)).size >= 7, `y se mueven de formas distintas: llamas que suben, burbujas que estallan, hojas que caen… (${[...new Set(looks.map(x => x.anim))].join(', ')})`);
  await page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt')].find(b => /Llamas/.test(b.textContent)).click(); true`);
  await page.waitFor(`window.__app.ui.profile.effect === 'llamas'`);
  ok(await page.eval(`!!window.__app.ui.meModule().querySelector('.ava-fx-layer.fx-llamas')`), 'tocando la foto, en la pestaña Efecto se elige «Efecto Llamas» y sale encima del avatar');
  await page.waitFor(`document.querySelector('.ava-edit .frame-opt.sel') && /Llamas/.test(document.querySelector('.ava-edit .frame-opt.sel').textContent) && !!document.querySelector('.ava-edit .ae-preview .ava-fx-layer.fx-llamas')`);
  ok(true, 'el editor se queda abierto y su vista previa ya lleva el efecto');
  const art = await page.eval(`import('/js/missions.js').then(m => m.avatarArt('pt:6:Determined', 64))`);
  ok(art.includes('portraits/emo/6/Determined.png') && !art.includes('fx-'), 'un retrato es solo la cara, sin efecto incluido');
};
