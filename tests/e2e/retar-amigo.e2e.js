// Retar a un amigo, solo desde Amigos: te llega un aviso con Aceptar y Rechazar; y si retas tú y acepta, combatís sin ELO
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'Retadora' }), amigo = await player({ user: 'Amigo' });
  amigo.client.send({ t: 'friend', a: 'add', who: me.id }); await amigo.client.wait(m => m.t === 'friendok' || m.t === 'error');
  me.client.send({ t: 'friend', a: 'accept', id: amigo.id }); await me.client.wait(m => m.t === 'friendok' || m.t === 'error');
  for (const [p, team] of [[me, [{ dex: 6 }, { dex: 9 }, { dex: 3 }]], [amigo, [{ dex: 26 }, { dex: 131 }, { dex: 94 }]]]) {
    p.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await p.client.wait(m => m.t === 'profile');
    p.client.send({ t: 'pvpteam', team }); await p.client.wait(m => m.t === 'profile');
  }
  await page.loginAs(me.token);

  // Te retan: sale el aviso y lo rechazas
  amigo.client.send({ t: 'challenge', a: 'send', id: me.id });
  await page.waitSee('¡Te retan!');
  ok(await page.see(/Amigo#\d+ te reta/), 'el aviso dice quién te reta');
  const no = amigo.client.wait(m => m.t === 'challengeend');
  await page.tap('Rechazar');
  ok((await no).why === 'declined', 'rechazar se lo dice al que retó');

  // Retas tú, desde Amigos
  await page.click('.friends-btn');
  await page.waitSee('Tus amigos');
  const inv = amigo.client.wait(m => m.t === 'challenge');
  await page.tap('Retar');
  ok((await inv).from.id === me.id, 'al amigo le llega el reto');
  await page.waitSee('Cancelar reto');
  // Un cuadro abierto cuando empieza el combate se cierra como «no»: Intro ya no lo confirma
  await page.tap('Quitar');
  await page.waitSee('¿Quitar amigo?');
  amigo.client.send({ t: 'challenge', a: 'accept' });
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
  await page.key('Enter');
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Derrota');
  ok(!(await page.see(/\d+ ELO|ELO/, { in: '.results', ms: 0 })), 'un combate amistoso no mueve el ELO');
  await page.tap('Continuar');
  await page.waitSee('Tus amigos');
  ok(true, 'al acabar vuelves a Amigos');
  ok(await page.see('Ver perfil', { ms: 3000 }), 'el amigo sigue en la lista: el Intro en combate no ha confirmado el cuadro');
  await page.waitSee('Retar');
  ok(!(await page.see('Cancelar reto', { ms: 0 })), 'y vuelve «Retar», no «Cancelar reto»');
};
