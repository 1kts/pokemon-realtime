// El menú no gasta como un combate: el fondo 3D va sin el resplandor (ahí no hay efectos que brillen); en combate, sí.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'ligero' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.waitSee('Aventura');
  // atajo: cuánto trabaja la tarjeta gráfica no se ve: se cuentan las pasadas con resplandor del bucle
  const pasadas = () => page.eval(`window.__app.bloomFrames`);
  const a = await pasadas();
  await page.eval(`new Promise(r => setTimeout(() => r(true), 1500))`);
  ok(await pasadas() === a, 'en el menú no se pinta el resplandor');
  await page.tap(/^Historia/);
  await page.tap('Desafiar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  const b = await pasadas();
  await page.eval(`new Promise(r => setTimeout(() => r(true), 1500))`);
  ok(await pasadas() > b, 'en combate sí se pinta');
};
