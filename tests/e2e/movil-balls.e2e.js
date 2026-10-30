// Poké Balls en el móvil: la elegida sale grande con «Lanzar»; tocar otra la elige (sin lanzar) y tocar la elegida
// la lanza al rival
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'lanzador' });
  me.client.send({ t: 'dev', dex: 6, level: 20, region: 'kanto', item: 'superball', qty: 3 }); await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.storyGuide', '1'); true`);
  await page.reload(); await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000); await page.click('.title-panel button.primary');
  // (lo que se manda al servidor al lanzar: se apunta, sin cambiarlo)
  await page.eval(`(() => { const net = window.__app.net, send = net.send.bind(net); net.send = m => { if (m.t === 'in' && m.c === 5) window.__throw = m; return send(m); }; return true; })()`);
  await page.tap(/^Historia/);
  await page.click('.sp-route[title^="Ruta 1 ·"], .sp-route[data-tip^="Ruta 1 ·"]');
  await page.tap('Explorar', { in: '.story-side' });
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
  ok(await page.see('Lanzar', { in: '.balls .ball.sel[data-ball="pokeball"]' }), 'la Poké Ball elegida sale grande con «Lanzar»');
  await page.press('.balls .ball[data-ball="superball"]');
  await new Promise(r => setTimeout(r, 300));
  ok(await page.eval(`!window.__throw && !!document.querySelector('.balls .ball.sel[data-ball="superball"] .bgo')`), 'tocar la Super Ball la elige (sale grande, con «Lanzar») sin lanzarla');
  await page.press('.balls .ball.sel');
  ok(await page.waitFor(`window.__throw && window.__throw.ball === 'superball'`).then(() => true, () => false), 'tocar la elegida lanza la Super Ball');
  await page.resize();
};
