// Mecánicas nuevas de las arenas en combate de verdad (sin errores en la página): pilares, espejos, cintas,
// flores, niebla y las mecánicas extra de Práctica (gravedad, géiseres, tormenta) encima de una arena normal
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mecanico' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  for (const [map, mod, check] of [['g-lucha', null, 'pillar'], ['g-psiquico', null, 'mirrors'], ['g-electrico', null, 'belts'], ['g-planta', null, 'flowers'], ['lago', 'gravity', 'gravity'], ['pradera', 'storm', 'storm']]) {
    await page.eval(`window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0]], skill: 0, passive: true, map: '${map}', mod: ${mod ? `'${mod}'` : 'null'} }); true`);
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
    ok(await page.eval(`window.__app.battle.mapName === '${map}' && !!window.__app.battle.mech.${check === 'pillar' ? 'pillars' : check}`), `${map}${mod ? ' + ' + mod : ''}: el combate lleva su mecánica (${check})`);
    if (check === 'pillar') { await page.waitFor(`[...window.__app.world.obstacles.values()].some(o => o.data.k === 'pillar')`, 10000); ok(true, 'los pilares salen en el campo'); }
    if (mod) { await page.waitFor(`window.__app.battle.arena && /${mod === 'gravity' ? 'gravedad' : 'rayos'}/i.test(window.__app.battle.arena.desc)`); ok(true, 'la etiqueta de la arena explica la mecánica extra'); }
    await new Promise(r => setTimeout(r, 4000));
    await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
    await page.waitFor(`!window.__app.battle`, 15000);
  }
};
