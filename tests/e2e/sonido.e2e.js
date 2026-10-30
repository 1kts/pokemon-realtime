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

  // Entrar en combate (Práctica): durante el primer segundo aún no ha empezado el tema nuevo; luego sí
  // (se mira dentro de la página medio segundo después de pedir el tema, sin depender de lo que tarde la prueba)
  // atajo: el sonido no se ve: se apunta qué pide la música (el combate se empieza con los botones)
  await page.eval(`(() => { const mu = window.__app.music, play = mu.play.bind(mu);
    mu.play = n => { play(n); if (n === 'battle') setTimeout(() => { window.__mid = { cur: mu.current, sounding: mu.sounding }; }, 500); }; return true; })()`);
  await page.tap(/^Práctica/);
  await page.click('.pool-card');
  await page.click('.draft button.primary');
  await page.waitFor(`window.__mid`, 20000);
  const mid = await page.eval(`window.__mid`);
  ok(mid.cur === 'battle' && !mid.sounding, 'al entrar en combate el tema del menú se apaga y el nuevo aún no ha entrado');
  // atajo: el sonido no se ve (lo mismo en lo que sigue: qué suena, qué se ha reproducido y su volumen)
  ok(await page.waitFor(`window.__app.music.sounding`).then(() => true, () => false), 'después de un respiro entra el tema del combate');

  // Atacar al rival: suena el lanzamiento y, al acertar, el golpe (el ratón apunta al rival y pulsa)
  // atajo: dónde está el rival en la pantalla (la arena es 3D, sin un elemento que buscar)
  const foeAt = `(() => { const b = window.__app.battle; if (!b || !b.renderPos) return null; const p = b.toScreen(b.renderPos[b.foeIdx].x, b.renderPos[b.foeIdx].y); return { x: Math.round(p.x), y: Math.round(p.y) }; })()`;
  const played = k => page.eval(`(window.__app.sfx.played.${k} || 0) > 0`);
  for (let i = 0; i < 160 && !(await played('hit')); i++) {
    const p = await page.eval(foeAt);
    if (p) await page.mouseAt(p.x, p.y, { click: true });
    await new Promise(r => setTimeout(r, 250));
  }
  ok(await played('cast'), 'lanzar un movimiento suena');
  ok(await played('hit'), 'un golpe que acierta suena');
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.tap('Continuar');

  // Ajustes: volumen de los efectos aparte del de la música, y se recuerda
  await page.tap('Volver');
  await page.tap('Ajustes');
  await page.waitFor(`document.querySelector('.music-panel .sfx-vol input[type=range]')`);
  const music0 = await page.eval(`window.__app.music.volume`);
  await page.slide('.music-panel .sfx-vol input[type=range]', 0);
  await page.waitFor(`window.__app.sfx.volume === 0`);
  // atajo: el volumen no se ve (salvo «Sin efectos»): se mira el de la música y el guardado
  ok(await page.eval(`localStorage.getItem('arena.sfx')`) === '0' && await page.see('Sin efectos', { in: '.music-panel .sfx-vol' }) && await page.eval(`window.__app.music.volume`) === music0, 'los efectos se pueden quitar sin tocar la música');
  await page.click('.music-panel .sfx-vol button');
  await page.waitFor(`window.__app.sfx.volume > 0`);
  await page.reload();
  // atajo: el volumen no se ve (ver arriba)
  ok(await page.eval(`window.__app.sfx.volume`) > 0 && await page.eval(`window.__app.sfx.volume`) === await page.eval(`+localStorage.getItem('arena.sfx')`), 'el volumen de los efectos se mantiene al recargar');
};
