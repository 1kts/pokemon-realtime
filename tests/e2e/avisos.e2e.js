// Avisos y premio de mañana: al recoger el premio diario sale lo que toca mañana y «Avísame» (una razón para volver);
// en Ajustes > Avisos se activan, se elige cuáles (premio diario, ruletas, legendarios…) y se quitan
const crypto = require('crypto');
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'avisado' });
  await page.loginAs(me.token);
  // 1. Premio diario: tras recogerlo, lo de mañana (día 2, con su premio) y el botón para que avise el móvil
  await page.eval(`localStorage.setItem('arena.dailySeen', 'nunca'); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
  await page.click('.title-panel button.primary');
  await page.waitSee('Premio diario', { ms: 20000 });
  await page.tap('¡Recoger!', { in: '.daily-modal' });
  await page.waitSee('día 1', { in: '.loot-pop' });
  const coins2 = Data.DAILY_LOGIN[1].coins.toLocaleString('es-ES');
  ok(await page.see('Mañana · día 2', { in: '.loot-pop' }) && await page.see(coins2, { in: '.loot-pop .tomorrow' }),
    `al recoger el premio de hoy sale lo que toca mañana: el día 2, con sus ${coins2} monedas`);
  ok(await page.see('Avísame', { in: '.loot-pop' }), 'y «Avísame», para que el móvil recuerde volver');
  await page.tap('¡Genial!', { in: '.loot-pop' });
  await page.waitFor(`!document.querySelector('.loot-pop:not(.out)')`);

  // 2. Ajustes > Avisos, sin activar: el mismo botón
  await page.tap(/Ajustes/);
  await page.waitSee('Avisos', { in: '.notif-panel', scroll: true });
  ok(await page.see('Avísame', { in: '.notif-panel' }), 'en Ajustes, los avisos se activan con «Avísame»');

  // 3. Con los avisos activados en otro aparato (el móvil; la suscripción la da su navegador, aquí como la daría): aquí
  //    sale cada tipo con su interruptor (van por cuenta) y «Avísame» para añadir este aparato, sin quitar los del otro
  const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
  const endpoint = 'https://fcm.googleapis.com/fcm/send/e2e-movil';
  me.client.send({ t: 'push', a: 'sub', sub: { endpoint, keys: { p256dh: ec.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }, tz: 60 });
  await me.client.wait(m => m.t === 'profile' && m.p.notif && m.p.notif.on);
  await page.loginAs(me.token);
  await page.tap(/Ajustes/);
  await page.waitSee('Ruletas nuevas en Lucky Spin', { in: '.notif-panel', scroll: true });
  ok(await page.see('Tu premio diario está listo', { in: '.notif-panel' }) && await page.see('Avísame', { in: '.notif-panel' }) && !await page.see('Quitar los avisos', { ms: 0 }),
    'activados en el móvil: aquí, un interruptor por tipo y «Avísame» para este aparato (sin poder quitar los del móvil desde aquí)');
  await page.click(await page.within('Ruletas nuevas en Lucky Spin', '.notif-row'));
  await new Promise(r => setTimeout(r, 500));
  await page.loginAs(me.token);
  await page.tap(/Ajustes/);
  await page.waitSee('Ruletas nuevas en Lucky Spin', { in: '.notif-panel', scroll: true });
  const marked = await page.eval(`[...document.querySelectorAll('.notif-row')].map(r => r.textContent.trim() + ':' + r.querySelector('input').checked).join(' | ')`);
  ok(/Ruletas nuevas en Lucky Spin:false/.test(marked) && /Tu premio diario está listo:true/.test(marked), `quitar el de las ruletas lo apaga solo a él, y se recuerda (${marked})`);
  // Quitados en el móvil (el único aparato): aquí ya solo «Avísame», sin los interruptores
  me.client.send({ t: 'push', a: 'unsub', endpoint });
  await me.client.wait(m => m.t === 'profile' && m.p.notif && !m.p.notif.on);
  await page.loginAs(me.token);
  await page.tap(/Ajustes/);
  await page.waitSee('Avísame', { in: '.notif-panel', scroll: true });
  ok(!await page.see('Ruletas nuevas en Lucky Spin', { ms: 0 }), 'sin ningún aparato con avisos, solo «Avísame»');
};
