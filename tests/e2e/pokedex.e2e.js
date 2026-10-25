// Pokédex: cuenta solo las generaciones con región abierta (Kanto y Johto: Gen 1 y 2), en la tarjeta del
// menú, en la propia Pokédex (con sus pestañas de generación) y en el perfil
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'pokedexera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const total = await page.eval(`Data.DEX_TOTAL`);
  ok(total === 251 && await page.eval(`[...document.querySelectorAll('.coll-tile small')].some(x => x.textContent.trim() === '1 / 251')`), 'la tarjeta de Pokédex del menú cuenta sobre 251 (Gen 1 y 2)');
  await page.eval(`window.__app.ui.show('dex'); true`);
  await page.waitFor(`document.querySelector('.dex-count')`);
  ok(await page.eval(`/1\\s*\\/\\s*251/.test(document.querySelector('.dex-count').textContent)`), 'la Pokédex dice 1 / 251');
  ok(await page.eval(`[...document.querySelectorAll('.dex-head .chips .chip')].map(b => b.textContent.split(' ')[0] + (b.textContent.includes('Gen') ? ' ' + b.textContent.split(' ')[1] : '')).join() === 'Todas,Gen 1,Gen 2'`), 'y solo tiene las pestañas Todas, Gen 1 y Gen 2');
  await page.waitFor(`document.querySelectorAll('.dex-grid .dex-card').length === 251`);
  ok(true, 'con las 251 especies, sin las de generaciones que aún no están abiertas');
};
