// Tu personaje avanza por el Camino: al completar una ruta llega hasta ella, y al ganar una medalla camina hasta el
// tramo siguiente, una sola vez. Nunca pasa de lo desbloqueado.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'caminante' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.resize(1280, 800);
  // Dónde está el personaje respecto a una tarjeta del Camino, por lo que se ve (en px, el centro de cada uno)
  const lejos = name => page.eval(`(() => { const y = [...document.querySelectorAll('.story-path *')].find(e => !e.children.length && e.textContent === 'Estás aquí').getBoundingClientRect();
    const c = document.querySelector(${JSON.stringify(`.sp-route[title^="${name}"] .sp-card`)}).getBoundingClientRect(); return Math.round((y.left + y.width / 2) - (c.left + c.width / 2)); })()`);
  const entra = async () => { await page.mode('Historia'); await page.waitSee('Estás aquí'); };
  const sale = async () => { await page.tap('Volver'); await page.waitSee('Aventura'); };

  await entra();
  ok(await lejos('Ruta 1 ·') < -40, 'sin rutas completas, al principio del tramo');
  await sale();

  // Toda la Ruta 1 capturada: llega hasta ella, andando desde donde estaba
  const dexes = await page.eval(`[...new Set(Data.NODES['k-ruta1'].wild.map(w => w[0]))]`);
  for (const dex of dexes) { me.client.send({ t: 'dev', dex, level: 5, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  await page.loginAs(me.token);   // (lo preparado por el WebSocket llega a la página al volver a entrar)
  await entra();
  await page.eval(`new Promise(r => setTimeout(() => r(true), 3200))`);
  ok(Math.abs(await lejos('Ruta 1 ·')) < 80, `con la Ruta 1 completa, llega hasta ella (${await lejos('Ruta 1 ·')} px)`);
  ok(await lejos('Ruta 2 ·') < -40, 'y no pasa de la siguiente');
  await sale();

  // Una medalla: camina hasta el tramo siguiente, sale una vez y las rutas nuevas quedan a la vista al llegar
  me.client.send({ t: 'dev', badges: 1, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  // (si anda, se apunta en cuanto empieza: con la máquina lenta, una lectura aparte llega tarde)
  const vigila = `(() => { window.__anda = false; new MutationObserver(() => { if (document.querySelector('.sp-you.walking')) window.__anda = true; }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); return true; })()`;
  await page.eval(vigila);
  await page.mode('Historia');
  await page.waitSee('Estás aquí');
  await page.eval(`new Promise(r => setTimeout(() => r(true), 3200))`);
  ok(await page.eval(`window.__anda`), 'al ganar la medalla, el personaje va andando');
  ok(await page.eval(`!document.querySelector('.sp-you.walking')`), 'y llega');
  ok(await lejos('Ruta 3 ·') < -40, 'al principio del tramo nuevo, antes de sus rutas');
  await sale();
  await page.eval(`window.__anda = false; true`);
  await page.mode('Historia');
  await page.waitSee('Estás aquí');
  await page.eval(`new Promise(r => setTimeout(() => r(true), 800))`);
  ok(!(await page.eval(`window.__anda`)), 'al volver a entrar ya no repite el paseo');
};
