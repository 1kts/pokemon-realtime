// Proyectiles iguales en todas las arenas: en un suelo claro (la sala de Lorelei) y en uno normal (la
// pradera) llevan el mismo núcleo de color intenso del tipo, el mismo halo y la sombra que los recorta
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'proyectiles' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const look = map => page.eval(`(() => {
    const app = window.__app;
    app.ui.hide(); document.querySelectorAll('.modal').forEach(m => m.remove());
    app.world.loadMap('${map}', Shared.parseMap('${map}').terrain);
    app.effects.syncProjectiles([{ id: 777, x: 300, y: 300, r: Data.MOVES.ascuas.radius || 10, mk: 'ascuas', o: 0, a: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    const o = app.effects.proj.get(777), kids = o.obj.children;
    const core = kids.find(k => k.isMesh && k.geometry.type === 'SphereGeometry' && k.material.color.getHex() !== 0xffffff);
    const halo = kids.find(k => k.isSprite && k.renderOrder === 1), shade = kids.find(k => k.isSprite && k.renderOrder === 2);
    const hsl = {}; core.material.color.getHSL(hsl);
    const res = { core: core.material.color.getHexString(), sat: hsl.s, halo: halo && halo.material.blending, shade: !!shade };
    app.effects.syncProjectiles([], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    return res;
  })()`);
  const bright = await look('e-lorelei'), normal = await look('pradera');
  ok(bright.core === normal.core && bright.halo === normal.halo, 'el mismo proyectil se ve igual en una arena clara y en una normal');
  ok(bright.shade && normal.shade, 'con su sombra oscura detrás en las dos');
  ok(bright.sat > 0.8, 'el núcleo lleva el color del tipo intenso (saturado)');
};
