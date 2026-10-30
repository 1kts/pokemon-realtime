// Ganar a un líder: desde el Camino se desafía a Brock y, al vencerlo (a golpes con el ratón), los resultados dicen
// que le has vencido y que su medalla es tuya, y el dinero que enseñan es el que se suma de verdad arriba
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'ganadora' });
  me.client.send({ t: 'dev', dex: 7, level: 13, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  const money = async () => +(await page.read('.hub-me .pill.coins')).replace(/\D/g, '');
  const before = await money();

  await page.tap(/^Historia/);
  await page.waitFor(`document.querySelector('.story-path .sp-node.sel')`);   // (el Camino ya se ha colocado en lo que toca)
  await page.tap('Desafiar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 30000);
  // atajo: dejar a los Pokémon de Brock con poca vida (preparar el combate; vencerlo entero tardaría minutos)
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.02 }); true`);
  // A golpes: el ratón apunta al rival y pulsa (Pistola Agua). atajo: dónde está el rival en la pantalla (la arena es 3D,
  // sin un elemento que buscar)
  const foeAt = `(() => { const b = window.__app.battle; if (!b || !b.renderPos) return null; const f = b.renderPos[b.foeIdx]; const p = b.toScreen(f.x, f.y); return { x: Math.round(p.x), y: Math.round(p.y) }; })()`;
  const t0 = Date.now();
  for (let i = 0; Date.now() - t0 < 180000 && !['¡Victoria!', 'Derrota'].includes(await page.title({ ms: 0 })); i++) {
    const p = await page.eval(foeAt);
    // (clic: Pistola Agua; y de vez en cuando Q, Hidrobomba, que también va a donde apunta el ratón)
    if (p && p.x > 0 && p.y > 0) { await page.mouseAt(p.x, p.y, { click: true }); if (i % 4 === 3) await page.key('KeyQ'); }
    await new Promise(r => setTimeout(r, 200));
  }
  log(`(${await page.title({ ms: 0 }) || 'sin acabar'} en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  ok(await page.see('¡Victoria!'), 'al vencer a Brock salen los resultados con «¡Victoria!»');
  ok(await page.see('¡Has vencido a Brock!') && await page.see('Medalla Roca conseguida'), 'dicen que has vencido a Brock y que la Medalla Roca es tuya');
  const won = +(await page.read('.results .reward')).replace(/\D/g, '');
  ok(won > 0, `y cuánto dinero has ganado (+${won})`);

  // El dinero de arriba sube lo que decían los resultados
  await page.tap('Continuar');
  await page.tap('Volver');
  await page.waitSee('Aventura');
  ok(await money() === before + won, `en el menú el dinero sube lo que decían: ${before} + ${won} = ${await money()}`);
};
