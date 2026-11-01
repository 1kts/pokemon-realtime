// Con el salvaje casi sin vida, el combate avisa de que toca capturarlo: una vez, y diciendo la tecla.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'avisado' });
  me.client.send({ t: 'dev', dex: 4, level: 30, region: 'kanto', item: 'pokeball', qty: 5 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.mode('Historia');
  await page.tap('Explorar');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  ok(!(await page.see('¡Pulsa F para capturarlo!', { ms: 0 })), 'con la vida entera no sale el aviso');
  // atajo: dejar al salvaje con poca vida (preparar el combate; bajársela a golpes podría debilitarlo)
  await page.eval(`window.__app.net.send({ t: 'dev', foeHp: 0.1 }); true`);
  await page.waitSee('¡Pulsa F para capturarlo!');
  ok(true, 'con poca vida avisa de que toca capturarlo, con la tecla');
};
