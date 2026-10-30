// Panel de administración: alta por consola, entrar con usuario + contraseña + código 2FA, resumen y búsqueda
const path = require('path');
const { execFileSync } = require('child_process');
const totp = require('../../server/totp.js');

module.exports = async ({ page, player, env, ok }) => {
  const boss = await player({ user: 'jefa', pass: 'clave-larga-1' });
  await player({ name: 'Gamberro' });
  await new Promise(r => setTimeout(r, 1300));   // el servidor guarda cada segundo; la consola lee la base de datos
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'admin.js'), 'alta', 'jefa'], { env, encoding: 'utf8' });
  const secret = out.match(/Clave: ([A-Z2-7 ]+) ·/)[1].replace(/ /g, '');

  await page.goto('/admin');
  await page.waitFor(`!document.querySelector('#login').hidden`);
  await page.type('#login [name=user]', 'jefa');
  await page.type('#login [name=pass]', 'clave-larga-1');
  await page.type('#login [name=code]', '000000');
  await page.key('Enter');   // (Intro en el campo del código, como quien entra)
  await page.waitFor(`document.querySelector('#login-err').textContent`);
  ok(await page.eval(`document.querySelector('#top').hidden`), 'con un código 2FA malo no entra');

  await page.type('#login [name=code]', totp.code(secret, Math.floor(Date.now() / totp.STEP)));
  await page.key('Enter');
  await page.waitFor(`!document.querySelector('#top').hidden`);
  ok(/jefa/.test(await page.eval(`document.querySelector('#who').textContent`)), 'con contraseña y código buenos entra');
  await page.waitFor(`document.querySelectorAll('#resumen .stat').length > 5`);
  ok(await page.eval(`[...document.querySelectorAll('#resumen .stat span')].some(s => /conectados/.test(s.textContent))`), 'el resumen enseña los conectados');

  // Métricas: jugadores de hoy, nuevos y cuántos vuelven, día a día
  await page.click('[data-tab=metricas]');
  const daysRows = `[...document.querySelectorAll('#met .card')].find(c => /Últimos/.test(c.textContent)).querySelectorAll('tbody tr')`;
  await page.waitFor(`document.querySelector('#met .card') && ${daysRows}.length === 14`);
  const todayRow = await page.eval(`[...${daysRows}[0].children].map(td => td.textContent)`);
  ok(+todayRow[1] >= 2 && +todayRow[2] >= 2 && await page.eval(`[...document.querySelectorAll('#metricas .stat span')].some(s => /vuelven al día siguiente/.test(s.textContent))`),
    `Métricas: los últimos 14 días con los jugadores y los nuevos de hoy (${todayRow.slice(1, 3).join(' / ')}) y cuántos vuelven`);

  // Balance: un combate de práctica (rendido) ya cuenta para su Pokémon, en el modo Práctica
  const pr = await player({ user: 'practicante' });
  pr.client.send({ t: 'practice', dexes: [6], skill: 0.1 });
  await pr.client.wait(m => m.t === 'start');
  pr.client.send({ t: 'forfeit' });
  await pr.client.wait(m => m.t === 'over');
  await page.click('[data-tab=balance]');
  await page.eval(`document.querySelector('#bal-f [name=mode]').value = 'practice'; document.querySelector('#bal-f').dispatchEvent(new Event('change')); true`);
  await page.waitFor(`[...document.querySelectorAll('#bal tbody tr')].some(tr => /Charizard/.test(tr.textContent))`);
  ok(await page.eval(`(() => { const tr = [...document.querySelectorAll('#bal tbody tr')].find(tr => /Charizard/.test(tr.textContent)); return tr.children[1].textContent === '1' && tr.children[2].textContent === '0 %' && /pocos datos/.test(tr.textContent); })()`),
    'Balance: el combate cuenta para Charizard (1 partida, 0 % de victorias, con aviso de pocos datos)');
  await page.click('#bal table th:nth-child(3)');   // (el «% victoria» de la primera tabla, la de los Pokémon)
  ok(await page.eval(`!!document.querySelector('#bal th.sort.on')`), 'las columnas se ordenan al tocarlas');
  ok(await page.eval(`[...document.querySelectorAll('#bal h2')].some(h => /Por tipo/.test(h.textContent)) && [...document.querySelectorAll('#bal h2')].some(h => /Torre Batalla/.test(h.textContent))`),
    'Combate: además por tipo y la Torre combate a combate');

  // Actividad: desde qué aparato y en qué idioma, y qué pantallas (lo manda el juego al conectar y al cambiar de pantalla)
  pr.client.send({ t: 'ctx', device: 'pc', lang: 'es' }); pr.client.send({ t: 'view', v: 'menu' });
  await new Promise(r => setTimeout(r, 200));
  await page.click('[data-tab=metricas]');
  await page.waitSee('PC', { in: await page.within('aparato', '#met .dist'), scroll: true });
  ok(true, 'Actividad: sesiones por aparato (PC)');
  // Progreso: el viaje del jugador y dónde está cada uno en la historia
  await page.click('[data-tab=progreso]');
  await page.waitFor(`document.querySelector('#progreso .funnel tr')`);
  ok(await page.eval(`/Han entrado/.test(document.querySelector('#progreso .funnel').textContent) && [...document.querySelectorAll('#progreso .dist h2')].some(h => /Kanto: dónde están/.test(h.textContent))`),
    'Progreso: el embudo del jugador y en qué medalla está cada uno, con el líder que le toca');
  await page.eval(`document.querySelector('#progreso .who-f [name=who]').value = 'cuentas'; document.querySelector('#progreso .who-f').dispatchEvent(new Event('change')); true`);
  await page.waitSee('tienen cuenta', { in: '#progreso .stat span' });
  ok(true, 'Progreso: se filtra por los que tienen cuenta');
  // Colección y Economía
  await page.click('[data-tab=coleccion]');
  await page.waitSee('Los que más gente tiene', { in: '#coleccion', scroll: true });
  ok(await page.see('Pokémon en total', { in: '#coleccion .stats', scroll: true }), 'Colección: qué Pokémon tiene la gente (los que más gente tiene y cuántos en total)');
  await page.click('[data-tab=economia]');
  await page.waitSee('Dinero de cada jugador', { in: '#economia', scroll: true });
  ok(true, 'Economía: el dinero de cada jugador');

  await page.click('[data-tab=jugadores]');
  await page.waitFor(`document.querySelectorAll('#results tr.click').length >= 2`);
  ok(await page.eval(`/perfiles en total/.test(document.querySelector('#results').textContent)`), 'Jugadores: al entrar sale la lista de todos, con cuántas cuentas e invitados hay');
  await page.type('#search [name=q]', 'gamber');
  await page.key('Enter');
  await page.waitFor(`document.querySelector('#results tr.click') && /Gamberro/.test(document.querySelector('#results').innerText)`);
  await page.click(await page.within('Gamberro', '#results tr.click'));
  await page.waitFor(`document.querySelector('#player h1')`);
  ok(/Gamberro/.test(await page.eval(`document.querySelector('#player h1').textContent`)), 'buscar un jugador y abrir su ficha');
  ok(boss.id && await page.eval(`!document.querySelector('#player').textContent.includes('Desbloquear todo')`), 'en la ficha de otro no sale «Desbloquear todo»');
};
