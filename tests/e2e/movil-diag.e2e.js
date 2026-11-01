// DIAGNÓSTICO TEMPORAL (rama fix/webkit, no se sube a develop): por qué en WebKit «¿Rendirte?» sale transparente y
// por qué salta «viaje.mp3 due to access control checks»
module.exports = async ({ page, ok, log }) => {
  await page.resize(844, 390);
  const t0 = Date.now();
  await page.goto('/');
  log('goto ' + (Date.now() - t0) + ' ms');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); localStorage.setItem('arena.touch', '1'); true`);
  // A: recargar con los temas bajándose (sin táctil, a los 4 s se piden todos)
  await page.eval(`new Promise(r => setTimeout(() => r(true), 4600))`);
  log('antes de recargar: ' + JSON.stringify(await page.eval(`performance.getEntriesByType('resource').filter(r => r.name.includes('/music/')).map(r => r.name.split('/').pop() + ':' + Math.round(r.responseEnd))`)));
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  await page.type('.title-panel input', 'Movil');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`(() => { window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1]], skill: 0, passive: true, map: 'pradera' }); return true; })()`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 15000);
  await page.eval(`(() => { const L = window.__diag = []; const T = () => Math.round(performance.now());
    document.addEventListener('click', e => L.push(T() + ' click ' + (e.target.className || e.target.tagName) + ' trusted=' + e.isTrusted), true);
    for (const k of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) document.addEventListener(k, e => L.push(T() + ' ' + k + ' ' + (e.target.className && e.target.className.baseVal === undefined ? e.target.className : e.target.tagName)), true);
    addEventListener('keydown', e => L.push(T() + ' keydown ' + e.key), true);
    new MutationObserver(ms => { for (const m of ms) { for (const n of m.addedNodes) if (n.classList && n.classList.contains('ui-confirm')) L.push(T() + ' +confirm'); for (const n of m.removedNodes) if (n.classList && n.classList.contains('ui-confirm')) L.push(T() + ' -confirm'); } }).observe(document.body, { childList: true });
    let f = 0; const raf = () => { f++; requestAnimationFrame(raf); }; requestAnimationFrame(raf); window.__frames = () => f; return true; })()`);
  const state = `(() => { const h = document.querySelector('.ui-confirm-box h3'); if (!h) return 'sin h3; confirm=' + document.querySelectorAll('.ui-confirm').length;
    const out = []; for (let a = h; a && a.nodeType === 1; a = a.parentElement) { const cs = getComputedStyle(a); const an = a.getAnimations().map(x => x.animationName + ':' + x.playState + '@' + Math.round(x.currentTime) + (x.pending ? '(pending)' : ''));
      if (+cs.opacity < 1 || an.length) out.push(a.tagName + '.' + a.className + ' op=' + cs.opacity + ' an=' + an.join(',') + ' cssAnim=' + cs.animationName); }
    return 'confirm=' + document.querySelectorAll('.ui-confirm').length + ' t=' + Math.round(performance.now()) + ' tl=' + Math.round(document.timeline.currentTime) + ' frames=' + window.__frames() + ' vis=' + document.visibilityState + ' | ' + out.join(' ; '); })()`;
  let bad = 0;
  for (let i = 0; i < 12; i++) {
    await page.eval(`window.__diag.length = 0; true`);
    await page.press('.tc-quit');
    await page.waitSee('¿Rendirte?', { in: '.ui-confirm-box' });
    const s1 = await page.eval(state);
    await new Promise(r => setTimeout(r, 400));
    const s2 = await page.eval(state);
    const seen = await page.see('¿Rendirte?', { in: '.ui-confirm-box', ms: 0 });
    if (!seen) bad++;
    log(`#${i} ${seen ? 'OK' : 'MAL ' + page.lastSee}`);
    log('   al ver: ' + s1);
    log('   +400:   ' + s2);
    log('   ev: ' + (await page.eval(`window.__diag.join(' | ')`)));
    await page.tap('Seguir combatiendo', { in: '.ui-confirm-box' });
    await page.waitFor(`!document.querySelector('.ui-confirm')`);
    await page.eval(`new Promise(r => setTimeout(() => r(true), 300))`);
  }
  ok(bad === 0, `diagnóstico: ${bad} de 12 veces transparente`);
};
