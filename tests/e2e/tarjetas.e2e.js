// Tarjetas: cada una lleva el color de su modo o de los tipos del Pokémon; equipo en dorado, shiny con
// borde holográfico y, al escoger Pokémon, el elegido marcado con ✓
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'coleccionista' });
  me.client.send({ t: 'dev', dex: 6, level: 36, region: 'kanto', shiny: true });   // Charizard shiny: fuego / volador
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', dex: 25, level: 30, region: 'kanto' });               // Pikachu: eléctrico
  await me.client.wait(m => m.t === 'profile');
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.storyGuide', '1'); true`);
  await page.reload();
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  // Menú: cada modo con su color en el borde
  const borders = await page.eval(`['story', 'ranked', 'practice'].map(c => getComputedStyle(document.querySelector('.menu-card.' + c)).borderTopColor)`);
  ok(new Set(borders).size === 3, `cada modo del menú tiene su color (${borders.join(' | ')})`);

  // Mis Pokémon: color de los tipos, equipo en dorado y shiny holográfico
  await page.click('Mis Pokémon');
  await page.waitFor(`document.querySelectorAll('.mon-card').length === 2`);
  const cards = await page.eval(`[...document.querySelectorAll('.mon-card')].map(c => ({
    name: c.querySelector('.mon-name').textContent, tc: c.style.getPropertyValue('--tc'), tc2: c.style.getPropertyValue('--tc2'),
    in: c.classList.contains('in'), star: getComputedStyle(c, '::before').content, anim: getComputedStyle(c).animationName }))`);
  const zard = cards.find(c => c.name.startsWith('Charizard')), pika = cards.find(c => c.name.startsWith('Pikachu'));
  const TC = await page.eval(`Data.TYPE_COLOR`);
  ok(zard && zard.tc === TC.fuego && zard.tc2 === TC.volador, `Charizard lleva los colores de fuego y volador (${zard && zard.tc} / ${zard && zard.tc2})`);
  ok(pika && pika.tc === TC.electrico && pika.tc2 === TC.electrico, 'Pikachu lleva el color eléctrico');
  ok(cards.some(c => c.in) && cards.every(c => !c.in || c.star.includes('★')),'los del equipo llevan la estrella dorada');
  ok(zard.anim === 'holoTurn' && pika.anim !== 'holoTurn', 'solo el shiny tiene el borde holográfico');

  // Práctica: el elegido se marca con ✓; los demás no
  await page.eval(`window.__app.ui.show('practice'); true`);
  await page.waitFor(`document.querySelectorAll('.pool-card').length > 3`);
  const before = await page.eval(`getComputedStyle(document.querySelector('.pool-card'), '::before').content`);
  await page.eval(`document.querySelector('.pool-card').click(); true`);
  const after = await page.eval(`getComputedStyle(document.querySelector('.pool-card.sel'), '::before').content`);
  const tinted = await page.eval(`[...document.querySelectorAll('.pool-card')].every(c => c.style.getPropertyValue('--tc'))`);
  ok(!before.includes('✓') && after.includes('✓'), 'al elegir un Pokémon en Práctica se marca con ✓');
  ok(tinted, 'todas las tarjetas de Práctica llevan el color de su tipo');
};
