// Tutorial jugable: desde el menú, un combate contra un muñeco quieto que no ataca; la tarjeta de arriba pide
// cada control y avanza al hacerlo (moverse, atacar, otros movimientos, protegerse, cambiar); al ganar,
// el premio se recoge a mano una sola vez
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'aprendiz' });
  const coins0 = me.profile.coins;
  await page.loginAs(me.token);
  await page.waitFor(`document.querySelector('.menu-card.tutorial.ready')`);
  ok(true, 'el menú ofrece el tutorial, resaltado mientras no se ha hecho');
  await page.click('.menu-card.tutorial');
  await page.waitFor(`window.__app.battle && document.querySelector('.tutorial-card')`);
  ok(/1\/6/.test(await page.eval(`document.querySelector('.tutorial-card small').textContent`)), 'empieza un combate con la tarjeta del paso 1 de 6');

  const key = (code, type = 'keydown') => page.eval(`window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}' })); true`);
  const step = () => page.eval(`window.__app.tutorial ? window.__app.tutorial.step : -1`);
  // Apuntar siempre al muñeco
  await page.eval(`(() => { const b = window.__app.battle; b.updateAim = () => { b.aim = { ...b.posOf(b.foeIdx) }; }; return true; })()`);

  // 1. Moverse
  await key('KeyD'); await page.waitFor(`window.__app.tutorial.step === 1`); await key('KeyD', 'keyup');
  ok(true, 'moverse con WASD cumple el paso 1');
  // 2. Atacar y acertar (acercándose: el primer movimiento puede ser cuerpo a cuerpo)
  await page.eval(`window.__tut = setInterval(() => { const b = window.__app.battle; if (!b) return; const me = b.pred, foe = b.posOf(b.foeIdx);
    b.keys = me && Math.hypot(foe.x - me.x, foe.y - me.y) > 140 ? { [foe.x > me.x ? 'KeyD' : 'KeyA']: true, [foe.y > me.y ? 'KeyS' : 'KeyW']: Math.abs(foe.y - me.y) > 30 } : {};
    b.castQueue = 0; }, 250); true`);
  await page.waitFor(`window.__app.tutorial.step === 2`);
  await page.eval(`clearInterval(window.__tut); window.__app.battle.keys = {}; true`);
  ok(true, 'atacar y acertar al muñeco cumple el paso 2');
  // 3. Otro movimiento (Q)
  await page.eval(`window.__tut = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })), 400); true`);
  await page.waitFor(`window.__app.tutorial.step === 3`);
  await page.eval(`clearInterval(window.__tut); true`);
  ok(true, 'usar Q cumple el paso 3');
  // 4. Protección
  await page.eval(`window.__tut = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })), 400); true`);
  await page.waitFor(`window.__app.tutorial.step === 4`);
  await page.eval(`clearInterval(window.__tut); true`);
  ok(true, 'protegerse con Espacio cumple el paso 4');
  // 5. Cambiar de Pokémon
  await page.eval(`window.__tut = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })), 600); true`);
  await page.waitFor(`window.__app.tutorial.step === 5`);
  await page.eval(`clearInterval(window.__tut); true`);
  ok(/Derrota/.test(await page.eval(`document.querySelector('.tutorial-card p').textContent`)), 'cambiar con 2 cumple el paso 5 y pide derrotar al muñeco');
  ok(await step() === 5, 'el muñeco no ha atacado en todo el tutorial (sigue el combate)');

  // 6. Ganar: premio para recoger (el muñeco aguanta mucho: se le deja con poca vida para no tardar un minuto,
  // que en el CI pasaba del límite de la prueba)
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.04 }); true`);
  await page.eval(`window.__tut = setInterval(() => { const b = window.__app.battle; if (!b) return; const me = b.pred, foe = b.posOf(b.foeIdx);
    b.keys = me && Math.hypot(foe.x - me.x, foe.y - me.y) > 140 ? { [foe.x > me.x ? 'KeyD' : 'KeyA']: true, [foe.y > me.y ? 'KeyS' : 'KeyW']: Math.abs(foe.y - me.y) > 30 } : {};
    b.castQueue = [0, 1, 2, 3][Math.floor(Math.random() * 4)]; }, 250); true`);
  const t0 = Date.now();
  await page.waitFor(`document.querySelector('.tutorial-done .claim-btn')`, 60000);
  log(`(muñeco vencido en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.eval(`clearInterval(window.__tut); true`);
  ok(!(await page.eval(`!!document.querySelector('.tutorial-card')`)), 'al ganar se quita la tarjeta y sale «¡Tutorial completado!» con su premio');
  await page.click('.tutorial-done .claim-btn');
  await page.waitFor(`window.__app.ui.profile.tutorial`);
  ok(await page.eval(`window.__app.ui.profile.coins`) === coins0 + Data.TUTORIAL_REWARD.coins, 'el premio se recoge a mano y da su dinero');
  await page.waitFor(`document.querySelector('.loot-pop')`);
  await page.eval(`document.querySelectorAll('.loot-pop').forEach(x => x.remove()); window.__app.ui.show('menu'); true`);
  await page.waitFor(`document.querySelector('.menu-card.tutorial')`);
  ok(await page.eval(`!document.querySelector('.menu-card.tutorial.ready')`), 'después ya no sale resaltado (se puede repetir, sin premio)');
};
