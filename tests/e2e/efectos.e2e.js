// Efectos del avatar: van aparte del retrato. Con uno conseguido, en el Perfil (tocando tu foto se abre el
// editor del avatar) se elige y sale por encima de cualquier avatar (aquí, el Pokémon); el retrato de Lucky
// Spin es solo la cara, sin efecto incluido. Los que aún no tienes salen apagados, y el interruptor «Solo los míos» los oculta. Cada efecto es
// pixel art como los Pokémon (formas sin suavizar) y distinto de los demás: su forma y su movimiento
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'efectos' });
  me.client.send({ t: 'dev', dex: 6, level: 36, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', effects: ['llamas'] }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(await page.eval(`!document.querySelector('.hub-ava .ava-fx-layer')`), 'sin efecto puesto, el avatar no lleva capa de efecto');
  await page.tap('Perfil');
  await page.waitFor(`document.querySelector('.trainer-card .tc-ava .ava.editable')`);
  ok(await page.eval(`!document.querySelector('.panel.look')`), 'el Perfil ya no tiene el panel de personalizar: se edita desde la foto');
  ok(await page.eval(`(() => { const k = [...document.querySelector('.pv-flow').children].map(x => x.classList.contains('trainer-card') ? 'card' : x.classList.contains('pv-stats') ? 'stats' : x.classList.contains('pv-cols') ? 'cols' : '?'); return k.join() === 'card,stats,cols' && !!document.querySelector('.pv-cols .badge-case') && !!document.querySelector('.pv-cols .history'); })()`), 'el Perfil va en orden: tarjeta, estadísticas, medallas y partidas junto a los logros');
  await page.click('.trainer-card .tc-ava .ava.editable');
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.tap('Efecto', { in: '.ava-edit .ae-tabs' });
  await page.waitFor(`[...document.querySelectorAll('.ava-edit .frame-opt')].some(b => /Llamas/.test(b.textContent))`);
  // (a propósito: el editor enseña todos, los que no tienes apagados; el interruptor deja solo los tuyos)
  const opciones = () => page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt')].map(b => ({ name: b.querySelector('small').textContent.trim(), off: b.disabled }))`);
  const todos = await opciones();
  ok(todos.length === await page.eval('Data.EFFECTS.length') + 1 && todos.filter(x => x.off).length === todos.length - 2 && !todos.find(x => /Llamas/.test(x.name)).off, `en Efecto salen todos, y los que no tienes no se pueden elegir (${todos.length})`);
  await page.tap('Solo los míos', { in: '.ava-edit' });
  await page.waitFor(`document.querySelectorAll('.ava-edit .frame-opt').length === 2`);
  ok(!(await page.see('Efecto Burbujas', { in: '.ava-edit', ms: 0 })), 'con «Solo los míos» salen «Ninguno» y Llamas');
  await page.reload();
  await page.loginAs(me.token);
  await page.tap('Perfil');
  await page.click('.trainer-card .tc-ava .ava.editable');
  await page.tap('Efecto', { in: '.ava-edit .ae-tabs' });
  await page.waitSee('Efecto Llamas', { in: '.ava-edit' });
  ok(!(await page.see('Efecto Burbujas', { in: '.ava-edit', ms: 0 })), 'y al volver a entrar se recuerda');
  await page.tap(/Llamas/, { in: '.ava-edit' });
  ok(await page.waitFor(`document.querySelector('.trainer-card .ava-fx-layer.fx-llamas, .hub-ava .ava-fx-layer.fx-llamas')`).then(() => true, () => false), 'tocando la foto, en la pestaña Efecto se elige «Efecto Llamas» y sale encima del avatar');
  ok(await page.waitFor(`document.querySelector('.ava-edit .frame-opt.sel') && /Llamas/.test(document.querySelector('.ava-edit .frame-opt.sel').textContent) && !!document.querySelector('.ava-edit .ae-preview .ava-fx-layer.fx-llamas')`).then(() => true, () => false),
    'el editor se queda abierto, con Llamas elegido, y su vista previa ya lleva el efecto');
  const art = await page.eval(`import('/js/missions.js').then(m => m.avatarArt('pt:6:Determined', 64))`);
  ok(art.includes('portraits/emo/6/Determined.png') && !art.includes('fx-'), 'un retrato es solo la cara, sin efecto incluido');
};
