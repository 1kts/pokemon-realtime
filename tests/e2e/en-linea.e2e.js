// La tarjeta de PvP del menú dice cuánta gente hay en línea y, si alguien busca rival en PvP, cuántos; se actualiza sola
// mientras miras el menú. PvP sin equipo lleva a prepararlo, con su ELO, y desde ahí se busca partida
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mirona' });
  const rival = await player({ user: 'buscona' });
  rival.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await rival.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  ok(await page.see(/\d+ en línea/, { in: '.menu-card.ranked' }) && !(await page.see('buscando rival', { in: '.menu-card.ranked', ms: 0 })), 'la tarjeta de PvP dice cuántos hay en línea');

  // Alguien se pone a buscar partida: se enciende
  rival.client.send({ t: 'pvpteam', team: [{ dex: 6 }, { dex: 9 }, { dex: 3 }] }); await rival.client.wait(m => m.t === 'profile');
  rival.client.send({ t: 'queue', mode: 'ranked' });
  await page.waitSee('1 buscando rival', { in: '.menu-card.ranked', ms: 15000 });
  const chapa = await page.eval(`(() => { const live = document.querySelector('.menu-card.ranked .pvp-live'), r = live.getBoundingClientRect(), b = live.querySelector('b'), q = b.getBoundingClientRect(); return { dentro: q.right <= r.right + 1 && q.left >= r.left - 1, igual: getComputedStyle(b).fontSize === getComputedStyle(live).fontSize }; })()`);
  ok(chapa.dentro && chapa.igual, `«1 buscando rival» va dentro de su chapa y con la letra del resto (${JSON.stringify(chapa)})`);
  rival.client.send({ t: 'unqueue' });
  ok(await page.waitFor(`!/buscando rival/.test(document.querySelector('.menu-card.ranked').innerText)`, 15000).then(() => true, () => false), 'cuando deja de buscar, deja de decirlo');

  // PvP sin equipo: se prepara en su pantalla, con ELO, y entonces se busca
  const shown = `(() => { const b = [...document.querySelectorAll('.online button.primary')].find(x => /Buscar partida/.test(x.textContent));
    return { sign: document.querySelector('.feature-sign h2').textContent, go: b && b.textContent, off: b && b.disabled, elo: !!document.querySelector('.online .big-elo') }; })()`;
  await page.mode('PvP');
  await page.waitFor(`window.__app.ui.view === 'online'`);
  const q1 = await page.eval(shown);
  ok(q1.sign === 'PvP' && q1.go === 'Buscar partida PvP' && q1.off && q1.elo, `PvP sin equipo abre su pantalla, con ELO y el botón esperando al equipo (${JSON.stringify(q1)})`);
  for (let i = 0; i < 3; i++) { await page.click(`.pvp-pool.rent .pvp-pick:nth-child(${i + 1})`); await page.waitFor(`document.querySelectorAll('.pvp-slot:not(.empty)').length === ${i + 1}`); }
  await page.waitFor(`![...document.querySelectorAll('.online button.primary')].find(x => /Buscar partida/.test(x.textContent)).disabled`);
  await page.click('Buscar partida PvP');
  await page.waitFor(`document.querySelector('.q-mode')`);
  ok(await page.eval(`document.querySelector('.q-mode').textContent`) === 'PvP', 'con el equipo listo, busca partida PvP');
  await page.click('.q-cancel');
  await page.waitFor(`!document.querySelector('.q-mode')`, 15000);
  await page.waitFor(`window.__app.ui.view === 'online'`);
  ok((await page.eval(shown)).sign === 'PvP', 'al cancelar la búsqueda vuelves a PvP, donde estabas');
};
