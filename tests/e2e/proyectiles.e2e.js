// Proyectiles con el mismo diseño en todas las arenas: núcleo casi blanco y halo del color del tipo, igual en
// una sala clara (la de Lorelei) y en una normal (la pradera). Sobre suelo claro el halo no puede ser
// aditivo (no se vería), así que usa el color intenso del tipo con mezcla normal; sin manchas ni sombras
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'proyectiles' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const look = map => page.eval(`(() => {
    const app = window.__app;
    app.ui.hide(); document.querySelectorAll('.modal').forEach(m => m.remove());
    app.world.loadMap('${map}', Shared.parseMap('${map}').terrain);
    app.effects.syncProjectiles([{ id: 777, x: 300, y: 300, r: Data.MOVES.ascuas.radius || 10, mk: 'ascuas', o: 0, a: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    const kids = app.effects.proj.get(777).obj.children;
    const core = kids.find(k => k.isMesh), halo = kids.find(k => k.isSprite);
    const hsl = {}; halo.material.color.getHSL(hsl);
    const res = { parts: kids.length, radius: core.geometry.parameters.radius, blending: halo.material.blending, haloSat: hsl.s, core: core.material.color.getHexString() };
    app.effects.syncProjectiles([], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    return res;
  })()`);
  const bright = await look('e-lorelei'), normal = await look('pradera');
  ok(bright.parts === 2 && normal.parts === 2, 'el proyectil es núcleo y halo, sin sombras ni manchas, en las dos arenas');
  ok(bright.radius === normal.radius, 'el mismo tamaño en una arena clara y en una normal');
  ok(normal.blending === 2 && bright.blending === 1, 'halo aditivo en la normal y de mezcla normal en la clara (el aditivo no se ve sobre blanco)');
  ok(bright.haloSat > 0.7, 'sobre suelo claro el halo lleva el color intenso del tipo');
  ok(bright.core !== 'ffffff', 'y el núcleo no es blanco puro, que se perdería');
};
