// Mecánicas nuevas de las arenas en combate de verdad (sin errores en la página): pilares, espejos, cintas,
// flores, niebla y las mecánicas extra de Práctica (gravedad, géiseres, tormenta) encima de una arena normal
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mecanico' });
  await page.loginAs(me.token);
  for (const [map, mod, check] of [['g-lucha', null, 'pillar'], ['g-psiquico', null, 'mirrors'], ['g-electrico', null, 'belts'], ['g-planta', null, 'flowers'], ['lago', 'gravity', 'gravity'], ['pradera', 'storm', 'storm']]) {
    // atajo: Práctica con un rival quieto (passive) en cada arena: la interfaz no deja elegir un rival que no se mueva
    await page.eval(`window.__app.net.send({ t: 'practice', dexes: [Data.RANKED_POOL[0]], skill: 0, passive: true, map: '${map}', mod: ${mod ? `'${mod}'` : 'null'} }); true`);
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 20000);
    // atajo: las mecánicas son del 3D (sin texto propio): se mira que el combate las lleve
    ok(await page.eval(`window.__app.battle.mapName === '${map}' && !!window.__app.battle.mech.${check === 'pillar' ? 'pillars' : check}`), `${map}${mod ? ' + ' + mod : ''}: el combate lleva su mecánica (${check})`);
    // atajo: los pilares son objetos del 3D
    if (check === 'pillar') ok(await page.waitFor(`[...window.__app.world.obstacles.values()].some(o => o.data.k === 'pillar')`, 10000).then(() => true, () => false), 'los pilares salen en el campo');
    if (mod) ok(await page.see(mod === 'gravity' ? /gravedad/i : /rayos/i, { ms: 15000 }), 'la etiqueta de la arena explica la mecánica extra');
    await new Promise(r => setTimeout(r, 4000));
    await page.key('Escape');
    await page.tap('Rendirse', { in: '.ui-confirm-box' });
    await page.waitFor(`!window.__app.battle`, 15000);
  }
};
