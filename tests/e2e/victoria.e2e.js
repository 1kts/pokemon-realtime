// Ganar a un líder: desde el Camino se desafía a Brock y, al vencerlo (a golpes con el ratón), los resultados dicen
// que le has vencido y que su medalla es tuya, y el dinero que enseñan es el que se suma de verdad arriba
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'ganadora' });
  // (Nv.30: con el CI a pocos fotogramas los clics fallan más y a Nv.13 Brock llegaba a ganar aun con su equipo al 2 %)
  me.client.send({ t: 'dev', dex: 7, level: 30, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  // (una ventana baja, de portátil pequeño: los resultados no caben enteros y se nota si salen ya bajados)
  await page.resize(1280, 520);
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  const money = async () => +(await page.read('.hub-me .pill.coins')).replace(/\D/g, '');
  const before = await money();

  await page.mode('Historia');
  await page.waitFor(`document.querySelector('.story-path .sp-node.sel')`);   // (el Camino ya se ha colocado en lo que toca)
  // (como quien baja a mirar su equipo antes de desafiar: la pantalla queda bajada, y los resultados tienen que salir
  // igualmente desde arriba, con «¡Victoria!» a la vista)
  await page.see('Gestionar', { scroll: true });
  await page.waitFor(`document.querySelector('#screen').scrollTop > 0`);
  // («¡Desafiar!» sigue a la vista: se pulsa ahí mismo, con el ratón, sin que nada vuelva a subir la pantalla)
  ok(await page.see('Desafiar'), 'con la pantalla bajada, «Desafiar» se ve');
  // (el único botón que dice «Desafiar»: si hubiera otro, el test lo dice en vez de pulsar uno cualquiera)
  const go = await page.eval(`(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.getClientRects().length && /^\\W*Desafiar\\W*$/.test(x.textContent.trim()));
    if (bs.length !== 1) return null; const r = bs[0].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  ok(!!go, 'y es un solo botón');
  if (go) await page.mouseAt(...go, { click: true });
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 30000);
  // (vencerlo entero tardaría minutos, y con el navegador del CI a 1-2 fotogramas por segundo los clics no aciertan a un
  // rival que se mueve)
  // atajo: dejar a los Pokémon de Brock con poca vida, quietos y sin atacar (preparar el combate)
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.02, foeIdle: true }); true`);
  // A golpes: el ratón apunta al rival y pulsa (su básico). atajo: dónde está el rival en la pantalla y respecto al
  // tuyo, en unidades de la arena (la arena es 3D, sin un elemento que buscar)
  const foeAt = `(() => { const b = window.__app.battle; if (!b || !b.renderPos) return null; const f = b.renderPos[b.foeIdx], m = b.renderPos[1 - b.foeIdx], p = b.toScreen(f.x, f.y);
    return { x: Math.round(p.x), y: Math.round(p.y), dx: f.x - m.x, dy: f.y - m.y, mx: m.x, my: m.y,
      free: (document.elementFromPoint(p.x, p.y) || {}).tagName === 'CANVAS', won: !b.latest.ps[b.foeIdx].hp.some(h => h > 0) }; })()`;
  // (en la cueva de Brock caen rocas del techo cerca de cada Pokémon: quedarse quieto es recibirlas todas, y las caídas
  // paran el agua. Como un jugador: andando hacia él, que esquiva las marcas, y rodeando la roca si no avanza)
  // (solo se pulsa si ahí está el combate, y hasta ganarlo: un aviso encima, p. ej. «¡Logro desbloqueado!» al acabar, no
  // se toca, que lleva a Misiones)
  const toward = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'KeyD' : 'KeyA') : (dy > 0 ? 'KeyS' : 'KeyW');
  const t0 = Date.now();
  let last = null, detour = 0;
  for (let i = 0; Date.now() - t0 < 180000 && !['¡Victoria!', 'Derrota'].includes(await page.title({ ms: 0 })); i++) {
    const p = await page.eval(foeAt);
    if (!p) { await page.waitFor('window.__app.battle && window.__app.battle.renderPos', 5000).catch(() => {}); continue; }
    if (p.won) break;
    await page.eval('new Promise(r => requestAnimationFrame(() => r(true)))');   // (un fotograma de la página entre vuelta y vuelta)
    // (clic: su básico; y de vez en cuando Q, otro de sus ataques, que también va a donde apunta el ratón)
    if (p.free) { await page.mouseAt(p.x, p.y, { click: true }); if (i % 4 === 3) await page.key('KeyQ'); }
    if (Math.hypot(p.dx, p.dy) < 70) { last = null; continue; }
    if (last && Math.hypot(p.mx - last.mx, p.my - last.my) < 2) detour = 2;
    await page.key(detour-- > 0 ? toward(p.dy, -p.dx) : toward(p.dx, p.dy), 300);
    last = p;
  }
  await page.waitFor(`window.__app.ui.view === 'results'`, 30000).catch(() => {});
  log(`(${await page.eval(`window.__app.ui.view`) === 'results' ? 'resultados' : 'sin acabar'} en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  ok(await page.see('¡Victoria!'), 'al vencer a Brock salen los resultados con «¡Victoria!»');
  ok(await page.see('Has vencido a Brock') && await page.see('Medalla Roca conseguida'), 'dicen que has vencido a Brock y que la Medalla Roca es tuya');
  const won = +(await page.read('.results .reward')).replace(/\D/g, '');
  ok(won > 0, `y cuánto dinero has ganado (+${won})`);

  // El dinero de arriba sube lo que decían los resultados
  await page.tap('Continuar');
  await page.waitSee('Tu viaje');   // (ya de vuelta en Historia, con el CI lento: «Volver» es el de esa pantalla)
  await page.tap('Volver');
  await page.waitSee('Aventura');
  ok(await money() === before + won, `en el menú el dinero sube lo que decían: ${before} + ${won} = ${await money()}`);
};
