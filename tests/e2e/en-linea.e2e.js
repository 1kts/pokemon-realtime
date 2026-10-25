// Tarjetas de PvP del menú: cuánta gente hay en línea y, si alguien busca rival en ese modo, cuántos;
// se actualiza sola mientras miras el menú
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mirona' });
  const rival = await player({ user: 'buscona' });
  rival.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await rival.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`document.querySelector('.menu-card.casual .pvp-live')`);
  ok(await page.eval(`/\\d+ en línea/.test(document.querySelector('.menu-card.casual .pvp-live').textContent) && !document.querySelector('.menu-card.casual .pvp-live.hot')`), 'las tarjetas de PvP dicen cuántos hay en línea');

  // Alguien se pone a buscar partida rápida: en esa tarjeta se enciende, en Clasificatoria no
  rival.client.send({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] }); await rival.client.wait(m => m.t === 'profile');
  rival.client.send({ t: 'queue', mode: 'casual' });
  await page.waitFor(`/1 buscando rival/.test(document.querySelector('.menu-card.casual .pvp-live').textContent)`, 8000);
  ok(await page.eval(`!!document.querySelector('.menu-card.casual .pvp-live.hot') && !document.querySelector('.menu-card.ranked .pvp-live.hot')`), 'si alguien busca partida rápida, su tarjeta lo dice y se ilumina');
  rival.client.send({ t: 'unqueue' });
  await page.waitFor(`!document.querySelector('.menu-card.casual .pvp-live.hot')`, 8000);
  ok(true, 'cuando deja de buscar, se apaga');
};
