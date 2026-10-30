// Clasificatoria sin draft: en su pantalla preparas tu equipo de 3 (Nv.50) y sus movimientos, se guarda solo, y
// con él buscas partida contra un rival al azar. Sin equipo no se puede buscar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'rankera' });
  await page.loginAs(me.token);
  await page.tap(/^Clasificatoria/);
  await page.waitFor(`document.querySelector('.pvp-team')`);
  ok(await page.eval(`[...document.querySelectorAll('.online button.primary')].find(b => /Buscar partida/.test(b.textContent)).disabled && document.querySelectorAll('.pvp-slot.empty').length === 3`), 'sin equipo, el botón de buscar está desactivado y los 3 huecos vacíos');
  for (const dex of [6, 9, 3]) {
    await page.tap(await page.eval(`Data.SPECIES[${dex}].name`), { in: '.pvp-pool' });
    await page.waitFor(`document.querySelectorAll('.pvp-slot:not(.empty)').length >= ${[6, 9, 3].indexOf(dex) + 1}`);
  }
  await page.waitFor(`(window.__app.ui.profile.pvpTeam || []).length === 3`);
  // (se guarda solo: al volver a entrar siguen los 3)
  await page.reload(); await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000); await page.click('.title-panel button.primary');
  await page.tap(/^Clasificatoria/);
  await page.waitFor(`document.querySelector('.pvp-team')`);
  ok(await page.eval(`[...document.querySelectorAll('.pvp-slot:not(.empty)')].map(s => s.innerText).join(' ')`).then(t => /Charizard/.test(t) && /Blastoise/.test(t) && /Venusaur/.test(t)) && !(await page.eval(`!!document.querySelector('.pvp-slot.empty')`)),
    'elegir 3 del pool llena los huecos y se guarda solo (al volver a entrar siguen Charizard, Blastoise y Venusaur)');
  // Movimientos del primero: quitar uno
  await page.click('.pvp-slot');
  await page.waitFor(`document.querySelectorAll('.pvp-mv.on').length === 4`);
  await page.click('.pvp-mv.on');
  await page.waitFor(`window.__app.ui.profile.pvpTeam[0].moves.length === 3`);
  ok(await page.eval(`![...document.querySelectorAll('.online button.primary')].find(b => /Buscar partida/.test(b.textContent)).disabled`), 'se le cambian los movimientos y ya se puede buscar partida');
  ok(await page.eval(`!/otra pestaña/.test(document.body.textContent)`), 'sin el consejo de abrir otra pestaña');

  // Elegir movimientos con la página bajada no la sube arriba (antes cada toque la repintaba desde el principio)
  await page.resize(1280, 560);
  await page.eval(`document.querySelector('.pvp-mvlist').scrollIntoView({ block: 'center' }); true`);
  const y0 = await page.eval(`document.getElementById('screen').scrollTop`);
  // (un movimiento que ya se ve, pulsado donde está, sin desplazar la página: como quien lo toca)
  const at = await page.eval(`(() => { const b = [...document.querySelectorAll('.pvp-mv:not(.on):not(:disabled)')].find(b => { const r = b.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.mouseAt(at.x, at.y, { click: true });
  await page.waitFor(`window.__app.ui.profile.pvpTeam[0].moves.length === 4`);
  await new Promise(r => setTimeout(r, 200));
  const y1 = await page.eval(`document.getElementById('screen').scrollTop`);
  ok(y0 > 50 && Math.abs(y1 - y0) <= 2, `al elegir un movimiento la página se queda donde estaba (${Math.round(y0)} → ${Math.round(y1)} px)`);
  await page.resize();
};
