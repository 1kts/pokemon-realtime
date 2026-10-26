// Amigos: desde la barra de arriba se abre Amigos; se añade a alguien por su nombre con la etiqueta, el otro acepta
// y sale en la lista en línea; se ve su perfil y se puede quitar. Si te mandan una solicitud, avisa y se acepta aquí.
// Los invitados no pueden (hace falta cuenta)
module.exports = async ({ page, player, ok }) => {
  const ana = await player({ user: 'anaamiga' });
  const beto = await player({ user: 'betoamigo' });
  const carla = await player({ user: 'carlaamiga' });
  await page.loginAs(ana.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);
  await page.click('.hub-bar .friends-btn');
  await page.waitFor(`window.__app.ui.view === 'friends' && document.querySelector('.fr-add input')`);
  ok(true, 'el botón de la barra de arriba abre Amigos');

  // Añadir a Beto por su nombre con la etiqueta; Beto acepta
  await page.type('.fr-add input', `${beto.profile.name}#${beto.profile.tag}`);
  await page.eval(`document.querySelector('.fr-add').requestSubmit(); true`);
  await page.waitFor(`document.querySelector('.fr-sec.out .fr-card')`);
  ok(true, 'enviar la solicitud por nombre y etiqueta la deja en «Solicitudes enviadas»');
  const req = await beto.client.wait(m => m.t === 'friendreq');
  ok(req.name === ana.profile.name, 'a Beto le llega el aviso al momento');
  beto.client.send({ t: 'friend', a: 'accept', id: ana.id });
  await page.waitFor(`[...document.querySelectorAll('.fr-sec:not(.in):not(.out) .fr-card')].some(c => c.textContent.includes('${beto.profile.name}'))`);
  ok(await page.eval(`[...document.querySelectorAll('.fr-card.on')].some(c => /En el menú|En línea/.test(c.textContent))`), 'al aceptar, Beto sale en tus amigos, en línea');

  // Ver su perfil: la ficha dice que sois amigos
  await page.eval(`[...document.querySelectorAll('.fr-card')].find(c => c.textContent.includes('${beto.profile.name}')).querySelector('button').click(); true`);
  await page.waitFor(`document.querySelector('.user-modal .fr-tag')`);
  ok(/Amigos/.test(await page.eval(`document.querySelector('.user-modal .fr-tag').textContent`)), '«Ver perfil» abre su ficha, que dice que sois amigos');
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);

  // Carla te pide amistad: sale arriba con su número y se acepta desde aquí
  carla.client.send({ t: 'friend', a: 'add', who: `${ana.profile.name}#${ana.profile.tag}` });
  await page.waitFor(`document.querySelector('.fr-sec.in .fr-card')`);
  ok(await page.eval(`[...document.querySelectorAll('.toast')].some(x => /quiere ser tu amigo/.test(x.textContent))`), 'si te piden amistad, avisa y sale en «Solicitudes de amistad»');
  await page.eval(`document.querySelector('.fr-sec.in .fr-card button.primary').click(); true`);
  await page.waitFor(`!document.querySelector('.fr-sec.in') && document.querySelectorAll('.fr-sec:not(.out) .fr-card').length === 2`);
  ok(true, 'aceptarla la pasa a tus amigos');
  if (process.env.SHOT) await page.shot(process.env.SHOT);

  // Quitar a Beto
  await page.eval(`[...document.querySelectorAll('.fr-card')].find(c => c.textContent.includes('${beto.profile.name}')).querySelector('button.danger').click(); true`);
  await page.click('.ui-confirm-box button.ok');
  await page.waitFor(`![...document.querySelectorAll('.fr-card')].some(c => c.textContent.includes('${beto.profile.name}'))`);
  ok(true, 'se puede quitar a un amigo');

  // Un invitado no puede
  const guest = await player({ name: 'Invitado' });
  guest.client.send({ t: 'friend', a: 'add', who: `${ana.profile.name}#${ana.profile.tag}` });
  ok(/cuenta/.test((await guest.client.wait(m => m.t === 'error')).msg), 'un invitado necesita una cuenta para tener amigos');
};
