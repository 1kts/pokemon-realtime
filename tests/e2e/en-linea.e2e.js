// Tarjetas de PvP del menú: cuánta gente hay en línea y, si alguien busca rival en ese modo, cuántos;
// se actualiza sola mientras miras el menú. «Partida rápida» sin equipo lleva a prepararlo en una pantalla de
// Partida rápida (no de Clasificatoria) que busca partida rápida; «Clasificatoria» sigue siendo Clasificatoria
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

  // Partida rápida sin equipo: se prepara en su propia pantalla, sin ELO, y busca partida rápida
  const shown = `(() => { const b = [...document.querySelectorAll('.online button.primary')].find(x => /Buscar partida/.test(x.textContent));
    return { sign: document.querySelector('.feature-sign h2').textContent, go: b && b.textContent, off: b && b.disabled, elo: !!document.querySelector('.online .big-elo') }; })()`;
  await page.click('.menu-card.casual');
  await page.waitFor(`window.__app.ui.view === 'online'`);
  const q1 = await page.eval(shown);
  ok(q1.sign === 'Partida rápida' && q1.go === 'Buscar partida rápida' && q1.off && !q1.elo, `«Partida rápida» sin equipo abre Partida rápida (no Clasificatoria), sin ELO y con el botón esperando al equipo (${JSON.stringify(q1)})`);
  for (let i = 0; i < 3; i++) { await page.click(`.pvp-pool .pvp-pick:nth-child(${i + 1})`); await page.waitFor(`document.querySelectorAll('.pvp-slot:not(.empty)').length === ${i + 1}`); }
  await page.waitFor(`![...document.querySelectorAll('.online button.primary')].find(x => /Buscar partida/.test(x.textContent)).disabled`);
  await page.click('Buscar partida rápida');
  await page.waitFor(`document.querySelector('.q-mode')`);
  ok(await page.eval(`document.querySelector('.q-mode').textContent`) === 'Partida rápida', 'con el equipo listo, «Buscar partida rápida» busca partida rápida');
  await page.click('.q-cancel');
  await page.waitFor(`!document.querySelector('.q-mode')`, 15000);
  await page.waitFor(`window.__app.ui.view === 'online'`);
  ok((await page.eval(shown)).sign === 'Partida rápida', 'al cancelar la búsqueda vuelves a Partida rápida, donde estabas');
  // Clasificatoria sigue abriendo Clasificatoria
  await page.click('.inner-bar .back');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.click('.menu-card.ranked');
  await page.waitFor(`window.__app.ui.view === 'online'`);
  const q2 = await page.eval(shown);
  ok(q2.sign === 'Clasificatoria' && q2.go === 'Buscar partida clasificatoria' && q2.elo, `«Clasificatoria» abre Clasificatoria, con su ELO (${JSON.stringify(q2)})`);
};
