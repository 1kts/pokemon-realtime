// Torre Batalla: desde «Tu récord» se abren la guía (Cómo se juega) y la lista de premios, con los números
// de Data.TOWER; los Símbolos de la Frontera dicen en su tooltip cómo se gana cada uno
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'torrero' });
  me.client.send({ t: 'dev', dex: 6, level: 36, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap(/^Torre Batalla/);
  await page.waitFor(`document.querySelector('.tower-tools')`);

  // Símbolos: su tooltip explica dónde se ganan
  // (el ratón de verdad encima del símbolo)
  const at = await page.eval(`(() => { const e = document.querySelector('.symbol.plata'); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await page.mouseAt(at.x, at.y);
  ok(await page.see('combate 21', { in: '.ui-tip' }), 'al pasar el ratón por el Símbolo Plata dice que se gana venciendo al Cerebro en el combate 21');

  // Cómo se juega
  await page.click('Cómo se juega');
  await page.waitFor(`document.querySelector('.tower-guide')`);
  const secs = await page.eval(`[...document.querySelectorAll('.tower-guide h4')].map(h => h.textContent)`);
  ok(secs.join() === 'El desafío,La racha,Premios', `la guía tiene sus 3 apartados (${secs.join(', ')})`);
  await page.click('Entendido');
  await page.waitFor(`!document.querySelector('.modal')`);

  // Premios: las 5 filas, con el dinero de cada victoria y el del Cerebro
  await page.tap(/Premios/, { in: '.tower-tools' });
  await page.waitFor(`document.querySelector('.tower-rewards')`);
  ok(await page.eval(`document.querySelectorAll('.tower-rewards .tr-row').length === 5`), 'la ventana de premios tiene 5 filas');
  ok(await page.eval(`(r => r[0].textContent.includes(String(Data.TOWER.coins.base)) && r[2].textContent.includes((Data.TOWER.coins.brain).toLocaleString('es')))([...document.querySelectorAll('.tower-rewards .tr-row')])`),
    'enseña el dinero por victoria y el extra del Cerebro');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/torre-premios.png');
};
