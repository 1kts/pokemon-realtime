// Buscando rival: Poké Ball con radar, el modo, el tiempo y mensajes que rotan (consejos y la invitación a compartir)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'buscon' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.queueMode = 'ranked'; window.__app.ui.show('queue'); true`);
  await page.waitFor(`document.querySelector('.q-tip.on')`);
  ok(await page.eval(`!!document.querySelector('.queue-box .q-radar .q-ball') && /Clasificatoria/.test(document.querySelector('.q-mode').textContent) && /entrenador de la IA/.test(document.querySelector('.q-note').textContent)`),
    'sale la Poké Ball con el radar, el modo y el aviso de la IA');
  const first = await page.eval(`document.querySelector('.q-tip').textContent`);
  await page.waitFor(`document.querySelector('.q-tip.on') && document.querySelector('.q-tip').textContent !== ${JSON.stringify(first)}`, 15000);
  ok(true, 'los mensajes van cambiando');
  // Entre los mensajes está el de compartir, con su botón
  await page.waitFor(`!!document.querySelector('.q-tip .q-share')`, 60000);
  ok(/Compártelo con tus amigos/.test(await page.eval(`document.querySelector('.q-tip').textContent`)), '«¿Te está gustando PokéArenas? ¡Compártelo con tus amigos!» con botón de compartir');
};
