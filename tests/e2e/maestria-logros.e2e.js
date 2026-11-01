// Logros enseña lo que tienes y cómo se consigue lo demás, sin equipar: los retos generales van por categorías, los
// glows dicen de dónde salen (el tuyo se pone en el Perfil) y los marcos de tipo salen de debilitar con ese tipo
// (parte de maestria.e2e.js, que junta pasaba de los 5 minutos del CI)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'maestria' });
  // (el glow de fuego, como si saliera del cofre semanal)
  me.client.send({ t: 'dev', aura: 'tipo-fuego' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.click('.coll-tile.wide');

  // Retos: por categorías, con los de debilitar por tipo en Combate
  await page.waitFor(`document.querySelector('.retos-grid')`);
  await page.tap(/^Combate/, { in: '.coll-cats' });
  await page.waitFor(`document.querySelectorAll('.retos-grid .ach-card').length === Data.TYPE_NAMES.length`);
  ok(await page.see('Debilita 100 Pokémon con movimientos de tipo Fuego', { in: '.retos-grid', scroll: true }), 'en Retos › Combate están los de debilitar con cada tipo, con su marco de premio');

  // Glows: Logros solo enseña (sin botones); se pone en el Perfil
  await page.tap(/^Glows/, { in: '.coll-tabs, .collection' });
  await page.waitFor(`document.querySelector('.aura-grid')`);
  ok(await page.eval(`document.querySelectorAll('.aura-grid .coll-item.own').length === 1 && !document.querySelector('.aura-grid button')`) && await page.see('Perfil', { in: '.coll-where' }), 'en Logros › Glows sale el de fuego como tuyo, sin equiparlo desde ahí (se pone en el Perfil)');
  ok(await page.eval(`[...document.querySelectorAll('.aura-grid .coll-item.locked em')].some(e => /Campeón de Kanto/.test(e.textContent))`), 'los glows especiales dicen de qué reto salen');
  // Marcos: todos, con de dónde sale cada uno
  await page.tap(/^Marcos/, { in: '.coll-tabs, .collection' });
  await page.waitFor(`document.querySelector('.frames-grid')`);
  ok(await page.eval(`[...document.querySelectorAll('.frames-grid .frame-item.locked')].some(b => /Marco Fuego/.test(b.textContent) && /Próximamente/.test(b.textContent))`), 'en Marcos se ve el de Fuego bloqueado, para más adelante');

};
