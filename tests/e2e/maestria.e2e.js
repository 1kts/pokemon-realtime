// Logros: con victorias de una línea evolutiva, sus retos salen para recoger (aviso en el menú) en la ficha de cada
// Pokémon, con la animación de premio. Logros enseña lo que tienes y cómo se consigue lo demás,
// pero no equipa (el glow se pone en el Perfil y la skin en la ficha del Pokémon: maestria-vestuario.e2e.js).
// Los retos generales van por categorías y los marcos de tipo salen de debilitar con movimientos de ese tipo
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'maestria' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', mastery: { dex: 6, wins: 500 } });
  await me.client.wait(m => m.t === 'profile');
  // (el glow de fuego, como si saliera del cofre semanal: se ve más abajo, en Glows y en el Perfil)
  me.client.send({ t: 'dev', aura: 'tipo-fuego' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(+(await page.read('.coll-tile.wide .nbadge')) >= 5, 'el menú avisa de los premios de Logros por recoger');

  // Logros avisa, pero los retos de cada línea están en la ficha de cada Pokémon
  await page.click('.coll-tile.wide');
  await page.waitSee('Retos', { in: '.coll-tabs' });
  ok(await page.title() === 'Logros' && !(await page.see('Líneas', { ms: 0 })) && await page.see('Recoger todo'), 'en Logros no hay pestaña de Líneas y «Recoger todo» sigue a mano');
  await page.tap('Volver');
  await page.tap('Mis Pokémon');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.waitFor(`document.querySelector('.mon-sheet')`);
  await page.tap(/^Retos/, { in: '.mon-sheet' });
  await page.waitFor(`document.querySelector('.ms-retos .lg-row')`);
  ok(await page.eval(`[...document.querySelectorAll('.ms-retos button')].filter(b => /Recoger/.test(b.innerText)).length`) === 5, 'en su ficha, la línea de Charmander tiene 5 retos listos (10, 50, 100, 200 y 500 victorias)');
  ok(await page.eval(`(() => { const asks = [...document.querySelectorAll('.ms-retos .lg-row.k-skin small')].map(s => s.textContent); return document.querySelectorAll('.ms-retos .lg-row').length >= 7 && asks.some(x => /online/.test(x)) && asks.some(x => /Torre/.test(x)); })()`), 'Holo pide victorias online y Galaxia la Torre, con su progreso');
  // Se recogen uno a uno, cada uno con su animación (y se apunta qué dice cada premio)
  const prizes = [];
  for (let i = 0; i < 5; i++) {
    await page.click('.ms-retos .lg-row.ready .claim-btn');
    await page.waitFor(`document.querySelector('.loot-pop .acts .primary')`);
    prizes.push(await page.read('.loot-pop'));
    await page.click('.loot-pop .acts .primary');
    await page.waitFor(`!document.querySelector('.loot-pop')`);
  }
  const all = prizes.join(' | ');
  ok(/Caramelo Raro/.test(all) && /Maestro de Charmander/.test(all) && /Retrato/i.test(all) && (await page.eval(`[...document.querySelectorAll('.ms-retos button')].filter(b => /Recoger/.test(b.innerText)).length`)) === 0,
    'recogidos uno a uno, con su premio: Caramelo Raro, retrato, título «Maestro de Charmander»… y ya no queda nada por recoger');

  await page.key('Escape');
  await page.tap('Volver');
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

  // (el glow desde el Perfil, la ficha, la tarjeta de Historia y la skin en combate: maestria-vestuario.e2e.js;
  // juntas pasaban de los 5 minutos del CI)
};
