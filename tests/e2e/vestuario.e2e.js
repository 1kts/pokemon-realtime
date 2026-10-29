// Todo lo que se puede llevar sale donde se elige, también lo que aún no tienes: en Mis Pokémon › Vestuario, todas
// las skins (Data.SKINS) y las partículas de todos los tipos, sobre el propio Pokémon; en el editor del avatar,
// todos los efectos (Data.EFFECTS). Lo que no tienes sale apagado, sin poder ponértelo y diciendo de dónde sale,
// debajo y al pasar el ratón. Recorre las listas del juego: una skin, partícula o efecto nuevo entra solo en la
// prueba, y si no sale o no dice de dónde sale, falla
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
  const wear = await page.eval(`[...document.querySelectorAll('.ms-wear')].map(b => ({ kind: b.classList.contains('skin') ? 'skin' : 'parts', off: b.disabled,
    mon: !!b.querySelector('canvas'), name: b.querySelector('b').textContent.trim(), hint: b.querySelector('small').textContent.trim(), tip: b.title }))`);
  const n = await page.eval(`({ skins: Data.SKINS.length, types: Data.TYPE_NAMES.length, effects: Data.EFFECTS.length })`);
  const skins = wear.filter(x => x.kind === 'skin' && x.off), parts = wear.filter(x => x.kind === 'parts' && x.off);
  const told = x => x.mon && x.hint && !/undefined|null/.test(x.hint) && x.tip.includes(x.hint);
  ok(skins.length === n.skins && skins.every(told), `Vestuario enseña las ${n.skins} skins sobre el Pokémon, apagadas y diciendo de dónde salen (${skins.map(x => x.name + ': ' + x.hint).join(' · ')})`);
  ok(parts.length === n.types && parts.every(told), `y las partículas de los ${n.types} tipos, igual (${parts.filter(x => !told(x)).map(x => x.name).join(', ') || 'todas con su pista'})`);
  ok(await page.eval(`[...document.querySelectorAll('.ms-wear.locked')].every(b => b.disabled)`), 'lo que no tienes no se puede poner');
  await page.click('.ms-close');
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  await page.click('.inner-bar .back');
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // El editor del avatar (tocando tu foto en el Perfil) › Efecto: todos, los que no tienes apagados y con su pista
  await page.click('.hub-ava');
  await page.waitFor(`window.__app.ui.view === 'profile' && document.querySelector('.trainer-card .tc-ava .ava.editable')`);
  await page.click('.trainer-card .tc-ava .ava.editable');
  await page.waitFor(`document.querySelector('.ava-edit .ae-tabs')`);
  await page.click('Efecto');
  await page.waitFor(`document.querySelectorAll('.ava-edit .frame-opt.locked').length > 0`);
  const fx = await page.eval(`[...document.querySelectorAll('.ava-edit .frame-opt.locked')].map(b => ({ off: b.disabled, layer: !!b.querySelector('.ava-fx-layer'), name: b.querySelector('small').textContent.trim(), hint: (b.querySelector('em') || {}).textContent || '', tip: b.title }))`);
  ok(fx.length === n.effects && fx.every(x => x.off && x.layer && x.hint && x.tip.includes(x.hint)), `en Efecto salen los ${n.effects} efectos que no tienes, cada uno sobre tu avatar, apagado y diciendo de dónde sale (${fx.map(x => x.name).join(', ')})`);
};
