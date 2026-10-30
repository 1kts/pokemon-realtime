// Pokédex: cuenta solo las generaciones con región abierta (Kanto y Johto: Gen 1 y 2), en la tarjeta del
// menú, en la propia Pokédex (con sus pestañas de generación) y en el perfil
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'pokedexera' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(await page.see('1 / 251', { in: '.hub-coll' }), 'la tarjeta de Pokédex del menú cuenta sobre 251 (Gen 1 y 2)');
  await page.tap(/^Pokédex/);
  await page.waitSee(/1\s*\/\s*251/, { in: '.dex-count' });
  ok(await page.title() === 'Pokédex', 'la tarjeta abre la Pokédex, que dice 1 / 251');
  ok(await page.eval(`[...document.querySelectorAll('.dex-head .chips .chip')].map(b => b.innerText.split(/\\s+/).slice(0, b.innerText.includes('Gen') ? 2 : 1).join(' ')).join()`) === 'Todas,Gen 1,Gen 2', 'y solo tiene las pestañas Todas, Gen 1 y Gen 2');
  ok(await page.waitFor(`document.querySelectorAll('.dex-grid .dex-card').length === 251`).then(() => true, () => false), 'con las 251 especies, sin las de generaciones que aún no están abiertas');
};
