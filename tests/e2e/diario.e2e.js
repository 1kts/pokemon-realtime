// Premio diario: al entrar se abre solo con los 7 días del ciclo; el de hoy se recoge a mano (con la
// animación de premio); al día siguiente toca el siguiente y, si se salta un día, se vuelve al 1.º
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'diario' });
  const coins0 = me.profile.coins;
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(!(await page.eval(`!!document.querySelector('.daily-modal')`)), 'si ya se ha visto hoy en este navegador, no se vuelve a abrir sola');
  // Primera vez hoy en este navegador
  await page.eval(`localStorage.setItem('arena.dailySeen', 'nunca'); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel button.primary')`);
  await page.click('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`document.querySelector('.daily-modal')`);
  ok(await page.eval(`document.querySelectorAll('.daily-modal .daily-day').length`) === 7, 'al entrar se abre el premio diario con los 7 días');
  ok(await page.eval(`!!document.querySelector('.daily-day.today .claim-btn') && document.querySelectorAll('.daily-day')[0].classList.contains('today')`), 'hoy toca el día 1, listo para recoger');

  await page.click('.daily-day.today .claim-btn');
  await page.waitFor(`document.querySelector('.loot-pop h2')`);
  ok(/día 1/.test(await page.eval(`document.querySelector('.loot-pop h2').textContent`)), 'recogerlo saca la animación del premio del día 1');
  await page.waitFor(`window.__app.ui.profile.daily.claimed`);
  ok(await page.eval(`window.__app.ui.profile.coins`) === coins0 + Data.DAILY_LOGIN[0].coins
    && await page.eval(`window.__app.ui.profile.items.pokeball || 0`) >= Data.DAILY_LOGIN[0].items.pokeball, 'da el dinero y las Poké Balls del día 1');
  await page.eval(`document.querySelector('.loot-pop .acts .primary').click(); true`);

  // Ayer recogió el día 3: hoy toca el 4, desde la tarjeta de Misiones
  const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  await page.eval(`window.__app.net.send({ t: 'dev', daily: { last: '${day(1)}', streak: 3 } }); true`);
  await page.waitFor(`window.__app.ui.profile.daily.ready && window.__app.ui.profile.daily.day === 4`);
  ok(true, 'al día siguiente sigue el ciclo: toca el día 4');
  await page.eval(`window.__app.ui.show('missions'); true`);
  await page.waitFor(`document.querySelector('.daily-panel.has-ready .claim-btn')`);
  await page.click('.daily-panel .claim-btn');
  await page.waitFor(`document.querySelector('.daily-modal .daily-day.today')`);
  ok(await page.eval(`document.querySelectorAll('.daily-modal .daily-day.got').length`) === 3, 'desde Misiones se abre la ventana, con los 3 días anteriores recogidos');
  await page.click('.daily-day.today .claim-btn');
  await page.waitFor(`window.__app.ui.profile.daily.claimed && window.__app.ui.profile.daily.day === 4`);
  ok(true, 'y se recoge el día 4');

  // Se salta un día: vuelve al 1.º, y la ventana lo explica
  await page.eval(`document.querySelectorAll('.loot-pop').forEach(x => x.remove()); window.__app.net.send({ t: 'dev', daily: { last: '${day(3)}', streak: 5 } }); true`);
  await page.waitFor(`window.__app.ui.profile.daily.ready && window.__app.ui.profile.daily.day === 1`);
  await page.eval(`window.__app.ui.dailyModal(); true`);
  await page.waitFor(`document.querySelector('.daily-modal')`);
  ok(/saltaste/.test(await page.eval(`document.querySelector('.daily-modal p').textContent`)), 'si se salta un día vuelve al día 1 y la ventana lo avisa');
};
