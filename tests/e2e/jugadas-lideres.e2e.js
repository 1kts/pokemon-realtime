// Los líderes tienen jugadas propias de su tipo y su arena, y las anuncian la primera vez: contra Blaine, en su
// volcán, tu Machoke solo pega de cerca, así que su Growlithe (al que la lava no le hace nada) pelea desde la lava.
// (La trinchera de Brock y el resto se prueban sin navegador en tools/ai-test.js: dependen de cuándo atacas tú)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'retador' });
  me.client.send({ t: 'dev', dex: 67, level: 43, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 6, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  // (Historia abre en el Camino: aquí se entra por el mapa, como en lideres.e2e.js; la guía de la primera vez, ya vista)
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-mode')`);
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.node.gym.next')`);
  // (los avisos duran poco: se apunta cada uno que sale en pantalla)
  await page.eval(`window.__banners = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.contains('banner') && window.__banners.push(n.textContent)))).observe(document.body, { childList: true, subtree: true }); true`);
  await page.click('.node.gym.next');
  await page.click('.node-info button.primary');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
  ok(await page.eval(`window.__app.battle.mapName === 'g-fuego'`), 'el combate contra Blaine es en su volcán');
  // Sin tocar nada: Blaine lo anuncia y se pone sobre la lava (se mira lo que se ve: dónde está su Pokémon)
  const said = `window.__banners.some(b => /Blaine pelea desde un terreno que a su equipo no le hace nada/.test(b))`;
  const onLava = `(() => { const b = window.__app.battle; if (!b || !b.latest) return false; const foe = b.latest.ps[b.foeIdx];
    if (foe.x === undefined) return false; const cell = Math.floor(foe.y / 40) * Shared.COLS + Math.floor(foe.x / 40);
    return b.world.types[cell] === 9; })()`;   // (9: lava)
  await page.waitFor(said, 30000).catch(() => {});
  ok(await page.eval(said), `Blaine anuncia su jugada (avisos: ${(await page.eval('window.__banners')).join(' | ')})`);
  // (se mueve un poco dentro de la lava y a ratos pisa el borde: basta con verlo encima)
  ok(await page.waitFor(onLava, 20000).then(() => true, () => false), 'y su Pokémon se planta en la lava');
};
