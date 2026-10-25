// Sonido: los ataques y los golpes suenan en combate, los efectos tienen su propio volumen en Ajustes, y la
// música no cambia de golpe al entrar en un combate (se apaga, respira y el tema nuevo entra poco a poco)
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel')`);
  await page.type('.title-panel input', 'Sonidista');
  await page.realClick('.title-panel button.primary');
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`window.__app.music.sounding && window.__app.sfx.running`);

  // Entrar en combate: durante el primer segundo aún no ha empezado el tema nuevo; luego sí
  // (se mira dentro de la página medio segundo después de pedir el tema, sin depender de lo que tarde la prueba)
  await page.eval(`(() => { const mu = window.__app.music, play = mu.play.bind(mu);
    mu.play = n => { play(n); if (n === 'battle') setTimeout(() => { window.__mid = { cur: mu.current, sounding: mu.sounding }; }, 500); };
    window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0]], skill: 0.1 }); return true; })()`);
  await page.waitFor(`window.__mid`);
  const mid = await page.eval(`window.__mid`);
  ok(mid.cur === 'battle' && !mid.sounding, 'al entrar en combate el tema del menú se apaga y el nuevo aún no ha entrado');
  await page.waitFor(`window.__app.music.sounding`);
  ok(true, 'después de un respiro entra el tema del combate');

  // Atacar al rival: suena el lanzamiento y, al acertar, el golpe
  await page.eval(`(() => { const b = window.__app.battle; b.updateAim = () => { b.aim = { ...b.posOf(b.foeIdx) }; };
    window.__shoot = setInterval(() => { if (window.__app.battle) window.__app.battle.castQueue = 0; }, 250); return true; })()`);
  await page.waitFor(`(window.__app.sfx.played.cast || 0) > 0`);
  ok(true, 'lanzar un movimiento suena');
  await page.waitFor(`(window.__app.sfx.played.hit || 0) > 0`);
  ok(true, 'un golpe que acierta suena');
  await page.eval(`clearInterval(window.__shoot); window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`window.__app.ui.view === 'results'`);

  // Ajustes: volumen de los efectos aparte del de la música, y se recuerda
  await page.eval(`window.__app.ui.show('settings'); true`);
  await page.waitFor(`document.querySelector('.music-panel .sfx-vol input[type=range]')`);
  const music0 = await page.eval(`window.__app.music.volume`);
  await page.type('.music-panel .sfx-vol input[type=range]', '0');
  await page.waitFor(`window.__app.sfx.volume === 0`);
  ok(await page.eval(`localStorage.getItem('arena.sfx')`) === '0' && /Sin efectos/.test(await page.eval(`document.querySelector('.music-panel .sfx-vol button').textContent`))
    && await page.eval(`window.__app.music.volume`) === music0, 'los efectos se pueden quitar sin tocar la música');
  await page.click('.music-panel .sfx-vol button');
  await page.waitFor(`window.__app.sfx.volume > 0`);
  await page.reload();
  ok(await page.eval(`window.__app.sfx.volume`) > 0 && await page.eval(`window.__app.sfx.volume`) === await page.eval(`+localStorage.getItem('arena.sfx')`), 'el volumen de los efectos se mantiene al recargar');
};
