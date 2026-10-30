// En Práctica, «Ver qué piensa la IA» enseña encima del bot su estado (Atacar, Tantear o Defender), su agresividad y
// su personalidad. Apagado (lo normal) no sale nada; encendido se recuerda y sale en el combate
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'curioso' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const toPractice = async () => {
    await page.click('.menu-card.practice');
    await page.waitFor(`window.__app.ui.view === 'practice' && document.querySelector('.pool-card')`);
  };
  const fight = async () => {
    await page.click('.pool-card');
    await page.click('.draft button.primary');
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
    await new Promise(r => setTimeout(r, 1500));   // (un rato de combate: la IA ya ha decidido algo)
  };
  const plate = `(() => { const d = document.querySelector('.plate.foe .ai-dbg'); if (!d || !d.getClientRects().length) return null;
    const b = d.getBoundingClientRect(); return { text: d.textContent, on: b.top >= 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight }; })()`;

  await toPractice();
  ok(await page.eval(`[...document.querySelectorAll('.practice-dbg button')].some(b => b.textContent === 'Ver qué piensa la IA' && b.getAttribute('aria-pressed') === 'false')`),
    'en Práctica está la opción «Ver qué piensa la IA», apagada de entrada');
  await fight();
  ok(await page.eval(plate) === null && await page.eval(`!window.__app.battle.latest.ps.some(p => p.ai)`), 'apagada, encima del bot no sale nada (y el servidor no lo manda)');
  // atajo: Esc es la tecla para rendirse (no hay botón en pantalla con teclado y ratón)
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); true`);
  await page.waitFor(`document.querySelector('.ui-confirm-box .ok')`);
  await page.click('.ui-confirm-box .ok');
  await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
  await page.click('Continuar');
  await page.waitFor(`window.__app.ui.view === 'practice' && document.querySelector('.pool-card')`);

  await page.click('Ver qué piensa la IA');
  ok(await page.eval(`localStorage.getItem('arena.aiDebug') === '1' && document.querySelector('.practice-dbg button').getAttribute('aria-pressed') === 'true'`), 'al pulsarla se enciende y se recuerda');
  await fight();
  await page.waitFor(plate, 8000);
  const p = await page.eval(plate);
  ok(/^(Atacar|Tantear|Defender) · Agresividad \d+ % · (Luchador|Francotirador|Controlador|Tanque)$/.test(p.text), `encendida, encima del bot sale qué piensa: «${p.text}»`);
  ok(p.on, 'y se ve en la pantalla');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/ia-pensamiento.png');
  // Cambia con el combate: la agresividad se mueve (vida, energía, tipos…) en unos segundos. Si se queda en un tope
  // (100 % o 0 %: p. ej. un Luchador con ventaja de tipo contra un rival que no hace nada) no tiene por qué moverse:
  // se rinde y prueba con otro bot al azar, hasta 3 combates
  let seen = new Set([p.text]), tries = [];
  for (let n = 0; ; n++) {
    for (let i = 0; i < 20 && seen.size < 2; i++) { await new Promise(r => setTimeout(r, 400)); const q = await page.eval(plate); if (q) seen.add(q.text); }
    tries.push([...seen].join(' | '));
    if (seen.size >= 2 || n === 2 || ![...seen].every(x => / (100|0) % /.test(x))) break;
    // atajo: Esc es la tecla para rendirse (como arriba)
    await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); true`);
    await page.waitFor(`document.querySelector('.ui-confirm-box .ok')`);
    await page.click('.ui-confirm-box .ok');
    await page.waitFor(`window.__app.ui.view === 'results'`, 15000);
    await page.click('Continuar');
    await page.waitFor(`window.__app.ui.view === 'practice' && document.querySelector('.pool-card')`);
    await fight();
    await page.waitFor(plate, 8000);
    seen = new Set([(await page.eval(plate)).text]);
  }
  ok(seen.size >= 2, `se actualiza durante el combate (${tries.join(' · otro combate: ')})`);
};
