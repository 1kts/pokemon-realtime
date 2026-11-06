// Los primeros pasos de un jugador nuevo: al entrar por primera vez, la bienvenida le dice qué es el juego y le da sus
// dos primeros pasos (el tutorial con premio o elegir su primer Pokémon); eligiendo el Pokémon llega a escogerlo y su
// primer salvaje es fácil, de Nv.2. (Que tras el tutorial le lleve a elegirlo: tutorial.e2e.js)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'novata' });
  await page.resize(1280, 800);
  await page.goto('/');
  await page.eval("localStorage.setItem('arena.welcome', 'nunca'); localStorage.setItem('arena.storyGuide', '1'); true");
  await page.loginAs(me.token);
  await page.waitSee('¡Bienvenido a PokéArenas!');
  ok(await page.see('Empezar el tutorial') && await page.see('Elegir mi primer Pokémon'), 'al entrar por primera vez, la bienvenida ofrece el tutorial o elegir su primer Pokémon');
  await page.tap('Elegir mi primer Pokémon');
  await page.waitSee(/Elige a tu compañero/);
  ok(await page.title() === 'Tu inicial de Kanto', `y «Elegir mi primer Pokémon» lleva a escogerlo (${await page.title()})`);
  await page.click(await page.within('Charmander', '.starter-card'));
  await page.waitSee('Explorar', { ms: 20000 });
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  ok(await page.see(/salvaje[\s\S]*Nv\.2\b|Nv\.2\b/, { in: '#hud' }), 'su primer salvaje es de Nv.2: la primera victoria, al alcance');
  // Volver a entrar: la bienvenida ya no sale
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Volver', { in: '.results' });
  await page.eval("localStorage.removeItem('arena.welcome'); true");
  await page.loginAs(me.token);
  ok(!await page.see('¡Bienvenido a PokéArenas!', { ms: 1500 }), 'con su primer Pokémon, la bienvenida ya no vuelve a salir');
};
