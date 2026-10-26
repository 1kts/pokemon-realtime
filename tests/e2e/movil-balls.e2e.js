// Poké Balls en el móvil: la elegida sale grande con «Lanzar»; tocar otra la elige (sin lanzar) y tocar la elegida
// la lanza al rival
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'lanzador' });
  me.client.send({ t: 'dev', dex: 6, level: 20, region: 'kanto', item: 'superball', qty: 3 }); await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.touch', '1'); true`);
  await page.reload(); await page.waitFor(`document.querySelector('.title-panel button.primary')`); await page.click('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`(() => { const net = window.__app.net, send = net.send.bind(net); net.send = m => { if (m.t === 'in' && m.c === 5) window.__throw = m; return send(m); };
    net.send({ t: 'story', a: 'route', id: 'k-ruta1' }); return true; })()`);
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 15000);
  const tap = sel => page.eval(`(() => { const e = document.querySelector('${sel}'); e.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true, cancelable: true })); return true; })()`);
  ok(await page.eval(`!!document.querySelector('.balls .ball.sel[data-ball="pokeball"] .bgo')`), 'la Poké Ball elegida sale grande con «Lanzar»');
  await tap('.balls .ball[data-ball="superball"]');
  await new Promise(r => setTimeout(r, 300));
  ok(await page.eval(`window.__app.battle.ballType === 'superball' && !window.__throw && !!document.querySelector('.balls .ball.sel[data-ball="superball"]')`), 'tocar la Super Ball la elige sin lanzarla');
  await tap('.balls .ball.sel');
  await page.waitFor(`window.__throw && window.__throw.ball === 'superball'`);
  ok(true, 'tocar la elegida la lanza');
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.resize();
};
