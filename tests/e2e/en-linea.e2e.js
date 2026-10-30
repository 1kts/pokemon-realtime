// Tarjetas de PvP del menú: cuánta gente hay en línea y, si alguien busca rival en ese modo, cuántos;
// se actualiza sola mientras miras el menú
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mirona' });
  const rival = await player({ user: 'buscona' });
  rival.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await rival.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(await page.see(/\d+ en línea/, { in: '.menu-card.casual' }) && !(await page.see('buscando rival', { in: '.menu-card.casual', ms: 0 })), 'las tarjetas de PvP dicen cuántos hay en línea');

  // Alguien se pone a buscar partida rápida: en esa tarjeta se enciende, en Clasificatoria no
  rival.client.send({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] }); await rival.client.wait(m => m.t === 'profile');
  rival.client.send({ t: 'queue', mode: 'casual' });
  await page.waitSee('1 buscando rival', { in: '.menu-card.casual', ms: 15000 });
  ok(!(await page.see('buscando rival', { in: '.menu-card.ranked', ms: 0 })) && await page.eval(`!!document.querySelector('.menu-card.casual .pvp-live.hot')`), 'si alguien busca partida rápida, su tarjeta lo dice (la de Clasificatoria no) y se ilumina');
  rival.client.send({ t: 'unqueue' });
  ok(await page.waitFor(`!/buscando rival/.test(document.querySelector('.menu-card.casual').innerText)`, 15000).then(() => true, () => false), 'cuando deja de buscar, deja de decirlo');
};
