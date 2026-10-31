// Lo que ganas se puede seguir: una bolita, sin número, lleva hasta donde está lo nuevo y se apaga al verlo; y la ventana
// de premio deja ponérselo ahí mismo.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'novedades' });
  const dev = async m => { me.client.send({ t: 'dev', ...m }); await me.client.wait(x => x.t === 'profile'); };
  await dev({ dex: 4, level: 20, region: 'kanto' });
  await page.resize(1280, 800);
  await page.loginAs(me.token);   // (lo que ya tienes al entrar la primera vez no avisa)
  const dot = q => page.eval(`[...document.querySelectorAll('${q} [aria-label="Novedad"]')].some(d => d.getClientRects().length > 0)`);
  ok(!(await dot('.coll-tile.mons')), 'sin nada nuevo, Mis Pokémon no lleva bolita');

  // Una skin nueva: de Mis Pokémon a su Vestuario
  await dev({ elemental: true });
  await page.loginAs(me.token);
  await page.waitSee('Aventura');
  ok(await dot('.coll-tile.mons'), 'con una skin nueva, Mis Pokémon lleva bolita');
  await page.tap('Mis Pokémon');
  await page.waitSee('Charmander', { in: '.mon-card' });
  ok(await dot('.mon-card'), 'y también la tarjeta del Pokémon');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.waitFor(`document.querySelector('.ms-tabs')`);
  ok(await dot('.ms-tabs'), 'y su pestaña Vestuario');
  await page.tap(/^Vestuario/, { in: '.mon-sheet' });
  await page.waitSee('Elemental', { in: '.mon-sheet' });
  ok(!(await dot('.ms-tabs')), 'al verla se apaga');
  await page.key('Escape');
  await page.tap('Volver');
  await page.waitSee('Aventura');
  ok(!(await dot('.coll-tile.mons')), 'y vuelve a estar apagada en el menú');

  // Un efecto nuevo: del avatar a su pestaña
  await dev({ effects: ['llamas'] });
  await page.loginAs(me.token);
  await page.waitSee('Aventura');
  await page.click('.hub-ava');
  await page.waitFor(`document.querySelector('.tc-ava')`);
  ok(await dot('.tc-ava'), 'con un efecto nuevo, tu foto del perfil lleva bolita');
  const sobreFoto = () => page.eval(`(() => { const f = document.querySelector('.tc-ava .ava').getBoundingClientRect(), d = document.querySelector('.tc-ava [aria-label="Novedad"]').getBoundingClientRect();
    const c = { x: d.x + d.width / 2, y: d.y + d.height / 2 }; return c.x >= f.left && c.x <= f.right && c.y >= f.top && c.y <= f.bottom && d.right <= f.right + 8 && d.top >= f.top - 8; })()`);
  ok(await sobreFoto(), 'y la bolita queda sobre la foto, entera');
  await page.mouseAt(...await page.eval(`(() => { const f = document.querySelector('.tc-ava .ava').getBoundingClientRect(); return [f.x + f.width / 2, f.y + f.height / 2]; })()`));
  await page.eval(`new Promise(r => setTimeout(() => r(true), 300))`);
  ok(await sobreFoto(), 'también al pasar el ratón por encima');
  await page.click('.tc-ava .ava');
  await page.waitFor(`document.querySelector('.ae-tabs')`);
  ok(await dot('.ae-tabs'), 'y su pestaña en el editor');
  await page.tap('Efecto', { in: '.ae-tabs' });
  await page.waitSee('Llamas', { in: '.ava-edit' });
  ok(!(await dot('.ae-tabs')), 'al abrirla se apaga');
  await page.key('Escape');

  // Un premio de maestría se pone desde su propia ventana
  await dev({ mastery: { dex: 4, wins: 500 } });
  await page.loginAs(me.token);
  await page.waitSee('Aventura');
  await page.tap('Mis Pokémon');
  await page.click(await page.within('Charmander', '.mon-card'));
  await page.tap(/^Retos/, { in: '.mon-sheet' });
  // (el del título, directamente: recoger antes los otros cuatro, uno a uno, pasaba de los 5 minutos en el CI)
  await page.tap('¡Recoger!', { in: await page.within('Maestro de Charmander', '.ms-retos .lg-row') });
  await page.waitSee('Usar este título', { in: '.loot-pop' });
  await page.tap('Usar este título');
  await page.waitSee('Maestro de Charmander', { in: '.ms-retos', scroll: true });
  const puesto = await page.eval(`window.__app.ui.profile.title`);   // atajo: el título solo se ve en otra pantalla
  ok(puesto === 'Maestro de Charmander', `un título ganado se pone desde la ventana del premio (${puesto})`);
};
