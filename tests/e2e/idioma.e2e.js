// Idiomas: en Ajustes se elige otro idioma y el juego cambia al momento; el menú sale traducido (también los textos
// con números) y se recuerda al volver a entrar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'poliglota' });
  me.client.send({ t: 'dev', dex: 4, level: 10, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(await page.see('Historia') && await page.see('Mis Pokémon'), 'en español, el menú dice «Historia» y «Mis Pokémon»');

  await page.tap('Ajustes');
  await page.waitSee('Idioma');
  await page.tap('English');
  await page.waitSee('Language');
  ok(await page.title() === 'Settings', 'al elegir English, Ajustes cambia al inglés al momento');
  await page.tap('Back');
  await page.waitSee('Adventure');
  ok(await page.see('Story') && await page.see('My Pokémon') && await page.see(/Kanto 0\/8 · Johto 0\/8 · 1 Pokémon/), 'el menú sale en inglés: «Story», «My Pokémon» y la cuenta de Pokémon');
  ok(!(await page.see('Historia', { ms: 0 })) && !(await page.see('Aventura', { ms: 0 })), 'sin textos en español');

  // Al volver a entrar sigue en inglés
  await page.reload();
  await page.waitSee('Continue as');
  ok(true, 'al recargar, la portada sigue en inglés');
};
