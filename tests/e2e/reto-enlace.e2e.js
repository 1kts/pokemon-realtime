// Retar a un amigo con un enlace: desde PvP, «Retar con un enlace» da un enlace para copiar o compartir; quien lo abre,
// aunque sea nuevo y sin equipo (lleva uno de alquiler), entra directo a un combate amistoso con quien lo mandó.
module.exports = async ({ page, player, ok }) => {
  // 1. Lo abre alguien nuevo: el enlace de un amigo (que lo ha creado desde su PvP) lleva directo al combate
  const amigo = await player({ user: 'retador', name: 'Retador' });
  amigo.client.send({ t: 'invite', a: 'create' });
  const { code } = await amigo.client.wait(m => m.t === 'invite' && m.a === 'created');
  const nuevo = await player({ user: 'invitado' });
  await page.resize(1280, 800);
  await page.goto(`/?reto=${code}`);
  await page.loginAs(nuevo.token);
  await amigo.client.wait(m => m.t === 'start', 15000);
  await page.waitFor(`window.__app.battle`, 15000);
  ok(await page.see(/retador/i, { ms: 8000 }), 'quien abre el enlace entra directo al combate con quien se lo mandó, aunque no tenga equipo de PvP');
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Volver', { in: '.results' });
  ok(!await page.see(/ELO/, { in: '.results', ms: 0 }), 'es amistoso: sin ELO');
  await page.tap('Volver', { in: '.results' });

  // 2. Lo crea él, desde PvP: el enlace sale para copiar y, cuando su amigo lo abre, empieza el combate
  await page.mode('PvP');
  await page.tap('Retar con un enlace');
  await page.waitSee('Copiar enlace');
  const url = await page.eval(`document.querySelector('.invite-box input').value`);
  ok(/\/\?reto=[A-Za-z0-9]{6}$/.test(url) && await page.see(/Esperando a tu amigo/), `PvP da el enlace para copiar (${url}) y espera a su amigo`);
  const otro = await player({ user: 'otroamigo' });
  otro.client.send({ t: 'invite', a: 'join', code: url.split('reto=')[1] });
  await otro.client.wait(m => m.t === 'start', 15000);
  await page.waitSee(/otroamigo/i, { ms: 15000 });
  ok(true, 'cuando su amigo abre el enlace, empieza el combate contra él');
};
