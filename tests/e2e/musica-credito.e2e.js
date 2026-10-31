// La música se ve de quién es: en la barra de abajo se nombra a quienes la han hecho y, al empezar a sonar un tema, sale
// su título y su autor, con enlace a su página.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'oyente' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.waitSee('Aventura');
  ok(await page.see(/Música de .*jannetty.*rckbtm.*Spring Spring.*HydroGene/, { in: '.legal-bar', scroll: true }), 'la barra de abajo nombra a los cuatro autores');
  await page.tap(/^Historia/);
  await page.tap('Desafiar');   // (el gimnasio de Brock tiene su tema)
  await page.waitSee('Hidden Cavern', { in: '.now-playing' });
  ok(await page.see('HydroGene', { in: '.now-playing' }), 'al sonar el tema del combate sale su título y su autor');
  const href = await page.eval(`document.querySelector('.now-playing a').getAttribute('href')`);
  ok(/^https:\/\/hydrogene\.itch\.io\//.test(href), `y enlaza a su página (${href})`);
};
