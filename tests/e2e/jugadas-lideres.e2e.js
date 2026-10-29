// Los líderes tienen jugadas propias de su tipo y su arena, y las anuncian la primera vez: contra Brock, en su
// cueva, tu Charmander le lanza Ascuas desde lejos y él se atrinchera tras las rocas
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'retador' });
  me.client.send({ t: 'dev', dex: 4, level: 14, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  // (Historia abre en el Camino: aquí se entra por el mapa, como en lideres.e2e.js; la guía de la primera vez, ya vista)
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-mode')`);
  await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);
  await page.click('.story-mode button:nth-child(2)');
  await page.waitFor(`document.querySelector('.node.gym.next')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);
  // (los avisos duran poco: se apunta cada uno que sale en pantalla)
  await page.eval(`window.__banners = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.classList && n.classList.contains('banner') && window.__banners.push(n.textContent)))).observe(document.body, { childList: true, subtree: true }); true`);
  await page.click('.node.gym.next');
  await page.click('.node-info button.primary');
  await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
  // Clic en el centro de la arena (hacia Brock, que sale a la derecha): Ascuas. Al verlo cargar, busca cobertura
  const said = `window.__banners.some(b => /Brock se atrinchera tras las rocas/.test(b))`;
  const fighting = `!!window.__app.battle && window.__app.battle.latest.state === 'fight' && window.__app.ui.view !== 'results'`;
  for (let i = 0; i < 30 && !(await page.eval(said)) && await page.eval(fighting); i++) { await page.click('#view'); await new Promise(r => setTimeout(r, 250)); }
  ok(await page.eval(said), `Brock anuncia su jugada: «Brock se atrinchera tras las rocas» (avisos: ${(await page.eval('window.__banners')).join(' | ')})`);
  // Y lo hace: acaba con una roca entre los dos
  const covered = await page.eval(`(async () => {
    const b = window.__app.battle, rocks = b.world.collisionList();
    for (let i = 0; i < 40; i++) {
      const ps = b.latest.ps, me = ps[b.you], foe = ps[b.foeIdx];
      if (foe.x !== undefined && rocks.some(o => { const dx = foe.x - me.x, dy = foe.y - me.y, l2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((o.x - me.x) * dx + (o.y - me.y) * dy) / l2)); return Math.hypot(me.x + dx * k - o.x, me.y + dy * k - o.y) < o.r + 4; })) return true;
      await new Promise(r => setTimeout(r, 250));
    }
    return false; })()`);
  ok(covered, 'y se pone con una roca entre él y tu Pokémon');
};
