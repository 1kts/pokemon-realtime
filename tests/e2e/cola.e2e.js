// Buscando rival: Poké Ball con radar, el modo, el tiempo y mensajes que rotan (consejos y la invitación a compartir)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'buscon' });
  await page.loginAs(me.token);
  // atajo: la pantalla de espera sin entrar en la cola de verdad (a los 20 s saldría un rival de la IA y acabaría la espera)
  await page.eval(`window.__app.ui.queueMode = 'ranked'; window.__app.ui.show('queue'); true`);
  await page.waitFor(`document.querySelector('.q-tip.on')`);
  ok(await page.eval(`!!document.querySelector('.queue-box .q-radar .q-ball')`) && await page.see('Clasificatoria', { in: '.q-mode' }) && await page.see('entrenador de la IA', { in: '.q-note' }),
    'sale la Poké Ball con el radar, el modo y el aviso de la IA');
  const first = await page.eval(`document.querySelector('.q-tip').textContent`);
  ok(await page.waitFor(`document.querySelector('.q-tip.on') && document.querySelector('.q-tip').innerText !== ${JSON.stringify(first)}`, 15000).then(() => true, () => false), 'los mensajes van cambiando');
  // Entre los mensajes está el de compartir, con su botón
  await page.waitSee('Compártelo con tus amigos', { in: '.q-tip', ms: 60000 });
  ok(await page.eval(`!!document.querySelector('.q-tip .q-share')`), '«¿Te está gustando PokéArenas? ¡Compártelo con tus amigos!» con botón de compartir');
};
