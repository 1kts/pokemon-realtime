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
  // (en el Camino, a Blaine, lo que toca; la guía de la primera vez, ya vista)
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-path .sp-node.now')`);
  await page.eval(`(() => { const w = document.querySelector('.story-path'), n = document.querySelector('.sp-node.now'); w.style.scrollBehavior = 'auto'; w.scrollLeft += n.getBoundingClientRect().left - w.getBoundingClientRect().left - w.clientWidth / 2 + n.offsetWidth / 2; return true; })()`);   // atajo: desplazar el camino hasta lo que toca
  // (los avisos duran poco: se apunta cada uno que sale en pantalla)
  await page.eval(`window.__banners = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.contains('banner') && window.__banners.push(n.textContent)))).observe(document.body, { childList: true, subtree: true }); true`);
  await page.click('.story-path .sp-node.now');
  await page.click('.node-info button.primary');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
  ok(await page.eval(`window.__app.battle.mapName === 'g-fuego'`), 'el combate contra Blaine es en su volcán');
  // Sin tocar nada: Blaine lo anuncia (el aviso que sale en pantalla) y se pone sobre la lava
  const said = `window.__banners.some(b => /Blaine pelea desde un terreno que a su equipo no le hace nada/.test(b))`;
  // atajo: estar «sobre la lava» no tiene nada propio que se vea (ni efecto ni texto); se mira la casilla de la arena
  // que hay bajo su Pokémon, con la posición con la que lo dibuja el cliente
  const onLava =`(() => { const b = window.__app.battle; if (!b || !b.latest) return false; const foe = b.latest.ps[b.foeIdx];
    if (foe.x === undefined) return false; const cell = Math.floor(foe.y / 40) * Shared.COLS + Math.floor(foe.x / 40);
    return b.world.types[cell] === 9; })()`;   // (9: lava)
  await page.waitFor(said, 30000).catch(() => {});
  ok(await page.eval(said), `Blaine anuncia su jugada (avisos: ${(await page.eval('window.__banners')).join(' | ')})`);
  // (se mueve un poco dentro de la lava y a ratos pisa el borde: basta con verlo encima)
  ok(await page.waitFor(onLava, 20000).then(() => true, () => false), 'y su Pokémon se planta en la lava');
};
