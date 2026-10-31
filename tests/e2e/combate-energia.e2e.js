// La energía es secundaria: una barra fina debajo de los ataques, en escritorio y en el móvil, sin tapar ningún botón.
module.exports = async ({ page, player, ok }) => {
  for (const [W, H, touch] of [[1280, 800, false], [844, 390, true], [667, 375, true]]) {
    const at = `${W}×${H}`;
    const me = await player({ user: 'energia' + W });   // (cada tamaño, su cuenta y su combate)
    for (const d of [4, 7, 1]) { me.client.send({ t: 'dev', dex: d, level: 12, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
    await page.resize(W, H);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.touch', '${touch ? 1 : 0}'); localStorage.setItem('arena.iosTip', '1'); true`);
    await page.loginAs(me.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
    // atajo: lo que se prueba es el combate, no la pantalla de elegir equipo de Práctica
    await page.eval(`window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0], Data.RANKED_POOL[1], Data.RANKED_POOL[2]] }); true`);
    await page.waitFor(`document.querySelector('#hud .energy') && document.querySelector('#hud .mv')`, 20000);
    await page.waitFor(`window.__app.battle && window.__app.battle.latest`, 20000);
    const g = await page.eval(`(() => { const r = s => document.querySelector(s).getBoundingClientRect(), e = r('#hud .energy');
      const mv = [...document.querySelectorAll('#hud .mv')].map(b => b.getBoundingClientRect());
      return { h: e.height, w: e.width, top: e.top, bottom: e.bottom, left: e.left, right: e.right, low: Math.max(...mv.map(x => x.bottom)), l: Math.min(...mv.map(x => x.left)), r: Math.max(...mv.map(x => x.right)), vh: innerHeight }; })()`);
    ok(g.top >= g.low - 1, `${at}: la barra de energía va debajo de los ataques (barra ${g.top}, ataques hasta ${g.low})`);
    ok(g.h <= 7, `${at}: la barra es fina (${g.h} px)`);
    ok(g.w > g.h * 10 && g.left >= g.l - 24 && g.right <= g.r + 1, `${at}: la barra va a lo largo de los ataques (${g.left}-${g.right}, ataques ${g.l}-${g.r})`);
    ok(g.bottom <= g.vh, `${at}: la barra entra en la pantalla (${g.bottom} de ${g.vh})`);
  }
};
