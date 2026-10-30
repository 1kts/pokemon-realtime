// Tutorial jugable: desde el menú, un combate contra un muñeco quieto que no ataca; la tarjeta de arriba pide
// cada control y avanza al hacerlo (moverse, atacar, otros movimientos, protegerse, cambiar); al ganar,
// el premio se recoge a mano una sola vez. Todo con el teclado y el ratón de verdad
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'aprendiz' });
  await page.loginAs(me.token);
  const money = async () => +(await page.read('.hub-me .pill.coins')).replace(/\D/g, '');
  const coins0 = await money();
  ok(await page.see('Tutorial', { in: '.menu-card.tutorial', scroll: true }) && await page.eval(`!!document.querySelector('.menu-card.tutorial.ready')`), 'el menú ofrece el tutorial, resaltado mientras no se ha hecho');
  await page.tap(/^Tutorial/);
  await page.waitSee('1/6', { in: '.tutorial-card' });
  ok(true, 'empieza un combate con la tarjeta del paso 1 de 6');

  // 1. Moverse con WASD
  await page.key('KeyD', 400);
  await page.waitSee('2/6', { in: '.tutorial-card', ms: 30000 });
  ok(true, 'moverse con WASD cumple el paso 1');
  // 2. Atacar y acertar: acercarse con WASD y pulsar con el ratón encima del muñeco.
  // atajo: dónde están tu Pokémon y el muñeco en la pantalla (la arena es 3D, sin elementos que buscar)
  const where = `(() => { const b = window.__app.battle; if (!b || !b.pred) return null; const me = b.pred, f = b.posOf(b.foeIdx), p = b.toScreen(f.x, f.y);
    return { dx: f.x - me.x, dy: f.y - me.y, x: Math.round(p.x), y: Math.round(p.y) }; })()`;
  const fight = async (done, extra) => {
    for (let i = 0; i < 200 && !(await done()); i++) {
      const w = await page.eval(where);
      if (!w) continue;
      if (Math.hypot(w.dx, w.dy) > 140) await page.key(Math.abs(w.dx) > Math.abs(w.dy) ? (w.dx > 0 ? 'KeyD' : 'KeyA') : (w.dy > 0 ? 'KeyS' : 'KeyW'), 150);
      await page.mouseAt(w.x, w.y, { click: true });
      if (extra) await page.key(extra[i % extra.length]);
      await new Promise(r => setTimeout(r, 150));
    }
  };
  const at = n => () => page.see(`${n}/6`, { in: '.tutorial-card', ms: 0 });
  await fight(at(3));
  await page.waitSee('3/6', { in: '.tutorial-card', ms: 30000 });
  ok(true, 'atacar y acertar al muñeco cumple el paso 2');
  // 3. Otro movimiento (Q)
  for (let i = 0; i < 20 && !(await at(4)()); i++) { await page.key('KeyQ'); await new Promise(r => setTimeout(r, 400)); }
  await page.waitSee('4/6', { in: '.tutorial-card', ms: 30000 });
  ok(true, 'usar Q cumple el paso 3');
  // 4. Protección (Espacio)
  for (let i = 0; i < 20 && !(await at(5)()); i++) { await page.key('Space'); await new Promise(r => setTimeout(r, 400)); }
  await page.waitSee('5/6', { in: '.tutorial-card', ms: 30000 });
  ok(true, 'protegerse con Espacio cumple el paso 4');
  // 5. Cambiar de Pokémon (2)
  for (let i = 0; i < 20 && !(await at(6)()); i++) { await page.key('Digit2'); await new Promise(r => setTimeout(r, 600)); }
  await page.waitSee('6/6', { in: '.tutorial-card', ms: 30000 });
  ok(await page.see('Derrota', { in: '.tutorial-card' }), 'cambiar con 2 cumple el paso 5 y pide derrotar al muñeco');
  ok(await page.title() === '', 'el muñeco no ha atacado en todo el tutorial (sigue el combate)');

  // 6. Ganar: premio para recoger (el muñeco aguanta mucho: se le deja con poca vida para no tardar un minuto,
  // que en el CI pasaba del límite de la prueba)
  // atajo: dejar al muñeco con poca vida (preparar el combate)
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.04 }); true`);
  const t0 = Date.now();
  await fight(() => page.see('Tutorial completado', { ms: 0 }), ['KeyQ', 'KeyE']);
  log(`(muñeco vencido en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.waitSee('Tutorial completado', { ms: 30000 });
  ok(!(await page.see(/\d\/6/, { in: '.tutorial-card', ms: 0 })), 'al ganar se quita la tarjeta y sale «¡Tutorial completado!» con su premio');
  await page.click('.tutorial-done .claim-btn');
  await page.waitFor(`document.querySelector('.loot-pop .acts .primary')`);
  await page.click('.loot-pop .acts .primary');
  await page.waitFor(`!document.querySelector('.loot-pop')`);
  await page.loginAs(me.token);
  ok(await money() === coins0 + Data.TUTORIAL_REWARD.coins, `el premio se recoge a mano y da su dinero (${coins0} → ${await money()})`);
  ok(await page.eval(`!document.querySelector('.menu-card.tutorial.ready')`), 'después ya no sale resaltado (se puede repetir, sin premio)');
};
