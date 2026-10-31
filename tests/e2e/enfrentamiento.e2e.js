// Al encontrar rival en Partida rápida, las tarjetas de los dos entrenadores chocan antes de empezar: nombre, liga, ELO
// y medallas de cada uno. Se van solas y el combate empieza como siempre
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Retadora' });
  const rival = await player({ user: 'Retador' });
  for (const [who, badges, team] of [[me, 2, [{ dex: 6 }, { dex: 9 }, { dex: 3 }]], [rival, 1, [{ dex: 26 }, { dex: 131 }, { dex: 94 }]]]) {
    who.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto', badges }); await who.client.wait(m => m.t === 'profile');
    who.client.send({ t: 'pvpteam', team }); await who.client.wait(m => m.t === 'profile');
  }
  await page.loginAs(me.token);
  rival.client.send({ t: 'queue', mode: 'casual' });
  await page.waitSee('1 buscando rival', { in: '.menu-card.casual' });
  await page.tap(/^Partida rápida/);   // (con equipo, la tarjeta ya busca rival)
  // (de una vez y en cuanto salen: están en pantalla 2,5 s, y con la máquina cargada una lectura aparte llega tarde)
  await page.waitFor(`(window.__vsAva = (document.querySelector('.vs-card.you .ava') || { offsetWidth: 0 }).offsetWidth) && (window.__vs = document.querySelector('.versus').innerText)`, 20000);
  const [izq, der = ''] = (await page.eval(`window.__vs`)).split(/\bVS\b/);
  ok(/Retadora/.test(izq) && /Bronce/.test(izq) && /1000 ELO/.test(izq) && /2 medallas/i.test(izq), `tu tarjeta dice quién eres, tu liga, tu ELO y tus medallas (${izq.replace(/\s+/g, ' ')})`);
  ok(/Retador/.test(der) && !/Retadora/.test(der) && /1000 ELO/.test(der) && /1 medalla/i.test(der), `la del rival, lo mismo de él (${der.replace(/\s+/g, ' ')})`);
  ok(!/\bIA\b/.test(der), 'y un rival de verdad no sale como IA');
  ok(await page.eval(`window.__vsAva`) >= 100, `tu foto sale grande, con su marco y sus efectos (${await page.eval(`window.__vsAva`)} px)`);
  await page.waitFor(`!document.querySelector('.versus')`, 6000);
  ok(await page.title() === '' && await page.see(/Pokémon|Charizard/, { in: '#hud', ms: 3000 }), 'las tarjetas se van solas y queda el combate');
};
