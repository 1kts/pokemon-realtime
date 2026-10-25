// Torre Batalla: desde «Tu récord» se abren la guía (Cómo se juega) y la lista de premios, con los números
// de Data.TOWER; los Símbolos de la Frontera dicen en su tooltip cómo se gana cada uno
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'torrero' });
  me.client.send({ t: 'dev', dex: 6, level: 36, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('tower'); true`);
  await page.waitFor(`document.querySelector('.tower-tools')`);

  // Símbolos: su tooltip explica dónde se ganan
  await page.eval(`document.querySelector('.symbol.plata').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); true`);
  ok(await page.eval(`/combate 21/.test(document.querySelector('.ui-tip.on').textContent)`), 'el Símbolo Plata dice que se gana venciendo al Cerebro en el combate 21');

  // Cómo se juega
  await page.click('Cómo se juega');
  await page.waitFor(`document.querySelector('.tower-guide')`);
  const secs = await page.eval(`[...document.querySelectorAll('.tower-guide h4')].map(h => h.textContent)`);
  ok(secs.join() === 'El desafío,La racha,Premios', `la guía tiene sus 3 apartados (${secs.join(', ')})`);
  await page.click('Entendido');
  await page.waitFor(`!document.querySelector('.modal')`);

  // Premios: las 5 filas, con el dinero de cada victoria y el del Cerebro
  await page.eval(`[...document.querySelectorAll('.tower-tools .tb-btn')].find(b => /Premios/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.tower-rewards')`);
  ok(await page.eval(`document.querySelectorAll('.tower-rewards .tr-row').length === 5`), 'la ventana de premios tiene 5 filas');
  ok(await page.eval(`(r => r[0].textContent.includes(String(Data.TOWER.coins.base)) && r[2].textContent.includes((Data.TOWER.coins.brain).toLocaleString('es')))([...document.querySelectorAll('.tower-rewards .tr-row')])`),
    'enseña el dinero por victoria y el extra del Cerebro');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/torre-premios.png');
};
