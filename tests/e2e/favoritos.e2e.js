// Favoritos en Mis Pokémon: la estrella se queda aunque recargues, los favoritos salen primero, se pueden ver solos y
// no se venden sin quitarles la estrella.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'favorita' });
  for (const [dex, level] of [[4, 20], [7, 15], [1, 12], [19, 8], [16, 5]]) { me.client.send({ t: 'dev', dex, level, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.waitSee('Pidgey', { scroll: true });
  const caja = `[...document.querySelectorAll('.team-sections .mon-grid:last-of-type .mon-card:not([hidden])')].map(c => c.querySelector('.mon-name').innerText.trim())`;
  const antes = await page.eval(caja);
  ok(antes[antes.length - 1].startsWith('Pidgey'), `sin favoritos, Pidgey (Nv.5) va el último de la caja (${antes})`);
  await page.tap('Marcar como favorito', { in: await page.within('Pidgey', '.mon-card') });
  await page.waitFor(`${caja}[0].startsWith('Pidgey')`, 10000).catch(() => {});
  ok((await page.eval(caja))[0].startsWith('Pidgey'), `la estrella lleva a Pidgey al principio de la caja (${await page.eval(caja)})`);
  // Se guarda en la cuenta: sigue tras volver a entrar
  await page.loginAs(me.token);
  await page.tap('Mis Pokémon');
  await page.waitSee('Pidgey', { scroll: true });
  ok((await page.eval(caja))[0].startsWith('Pidgey'), 'tras volver a entrar sigue siendo favorito y sale el primero');
  await page.tap(/Favoritos/);
  await page.waitFor(`${caja}.length === 1`, 10000);
  ok((await page.eval(caja))[0].startsWith('Pidgey'), 'el filtro Favoritos enseña solo los favoritos');
  await page.tap('Vender', { in: await page.within('Pidgey', '.mon-card') });
  await page.waitSee('Quítale la estrella para venderlo');
  ok(true, 'un favorito no se vende sin quitarle la estrella');
};
