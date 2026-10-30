// Premio diario: al entrar se abre solo con los 7 días del ciclo; el de hoy se recoge a mano (con la
// animación de premio); al día siguiente toca el siguiente y, si se salta un día, se vuelve al 1.º
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'diario' });
  await page.loginAs(me.token);
  ok(!(await page.eval(`!!document.querySelector('.daily-modal')`)), 'si ya se ha visto hoy en este navegador, no se vuelve a abrir sola');
  const money = async () => +(await page.read('.hub-me .pill.coins')).replace(/\D/g, '');
  const coins0 = await money();
  // Entrar «por primera vez hoy» en este navegador
  const enter = async () => {
    await page.eval(`localStorage.setItem('arena.dailySeen', 'nunca'); true`);
    await page.reload();
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`document.querySelector('.daily-modal')`, 20000);
  };
  await enter();
  ok(await page.eval(`document.querySelectorAll('.daily-modal .daily-day').length`) === 7, 'al entrar se abre el premio diario con los 7 días');
  ok(await page.eval(`!!document.querySelector('.daily-day.today .claim-btn') && document.querySelectorAll('.daily-day')[0].classList.contains('today')`), 'hoy toca el día 1, listo para recoger');

  await page.click('.daily-day.today .claim-btn');
  await page.waitSee('día 1', { in: '.loot-pop' });
  ok(true, 'recogerlo saca la animación del premio del día 1');
  await page.click('.loot-pop .acts .primary');
  await page.waitFor(`!document.querySelector('.loot-pop, .daily-modal')`);
  ok(await money() === coins0 + Data.DAILY_LOGIN[0].coins, `da el dinero del día 1 (${coins0} → ${await money()})`);
  await page.tap(/^Mochila/);
  const balls = 5 + Data.DAILY_LOGIN[0].items.pokeball;
  ok(await page.see(`×${balls}`, { in: await page.within('Poké Ball', '.bag-item') }), `y sus Poké Balls (en la Mochila: ×${balls})`);

  // Ayer recogió el día 3: hoy toca el 4, desde la tarjeta de Misiones
  const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  me.client.send({ t: 'dev', daily: { last: day(1), streak: 3 } }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap('Ver todas');
  await page.waitFor(`document.querySelector('.daily-panel.has-ready .claim-btn')`);
  await page.click('.daily-panel .claim-btn');
  await page.waitFor(`document.querySelector('.daily-modal .daily-day.today')`);
  ok(await page.eval(`document.querySelectorAll('.daily-modal .daily-day.got').length === 3 && [...document.querySelectorAll('.daily-modal .daily-day')].indexOf(document.querySelector('.daily-day.today')) === 3`),
    'al día siguiente sigue el ciclo: desde Misiones se abre la ventana, con los 3 días anteriores recogidos y hoy el 4');
  await page.click('.daily-day.today .claim-btn');
  await page.waitSee('día 4', { in: '.loot-pop' });
  ok(true, 'y se recoge el día 4');

  // Se salta un día: vuelve al 1.º, y la ventana lo explica
  me.client.send({ t: 'dev', daily: { last: day(3), streak: 5 } }); await me.client.wait(m => m.t === 'profile');
  await enter();
  ok(await page.see('Te saltaste un día', { in: '.daily-modal' }) && await page.eval(`document.querySelectorAll('.daily-day')[0].classList.contains('today')`), 'si se salta un día vuelve al día 1 y la ventana lo avisa');
};
