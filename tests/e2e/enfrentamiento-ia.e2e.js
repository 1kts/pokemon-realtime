// Si tras esperar te toca un entrenador IA, su tarjeta dice que lo es
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Esperona' });
  me.client.send({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap(/^Partida rápida/);   // (con equipo, la tarjeta ya busca rival)
  // (a los 20 s sin rival; de una vez: las tarjetas están en pantalla 2,5 s)
  await page.waitFor(`window.__vs = (document.querySelector('.versus') || {}).innerText`, 40000);
  const der = (await page.eval(`window.__vs`)).split(/\bVS\b/)[1] || '';
  ok(/\bIA\b/.test(der) && /ELO/.test(der), `la tarjeta del entrenador IA lo dice (${der.replace(/\s+/g, ' ')})`);
};
