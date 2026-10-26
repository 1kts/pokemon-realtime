// Proyectiles en pixel art (formas de PokéSurvivor): cada uno con su forma (llama, gota, hoja, rayo…) en la paleta de
// su tipo, sobre un halo pequeño de su color, igual en una sala clara (la de Lorelei) y en una normal (la pradera).
// Sobre suelo claro el halo no puede ser aditivo (no se vería), así que usa el color intenso del tipo con mezcla normal
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'proyectiles' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  const look = (map, mk) => page.eval(`(() => {
    const app = window.__app;
    app.ui.hide(); document.querySelectorAll('.modal').forEach(m => m.remove());
    app.world.loadMap('${map}', Shared.parseMap('${map}').terrain);
    app.effects.syncProjectiles([{ id: 777, x: 300, y: 300, r: Data.MOVES['${mk}'].radius || 10, mk: '${mk}', o: 0, a: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    const kids = app.effects.proj.get(777).obj.children;
    const sprites = kids.filter(k => k.isSprite), pixel = sprites.find(k => k.material.map && k.material.map.magFilter === 1003), halo = sprites.find(k => k !== pixel);
    const hsl = {}; halo.material.color.getHSL(hsl);
    const res = { parts: kids.length, pixel: !!pixel, w: pixel && pixel.scale.x, img: pixel && pixel.material.map.image.width, blending: halo.material.blending, haloSat: hsl.s };
    app.effects.syncProjectiles([], [{ x: 0, y: 0 }, { x: 0, y: 0 }], 0.05);
    return res;
  })()`);
  const bright = await look('e-lorelei', 'ascuas'), normal = await look('pradera', 'ascuas');
  ok(bright.parts === 2 && normal.parts === 2 && bright.pixel && normal.pixel, 'Ascuas es una llama en pixel art (sprite nítido) con su halo, en las dos arenas');
  ok(bright.w === normal.w, 'el mismo tamaño en una arena clara y en una normal');
  ok(normal.blending === 2 && bright.blending === 1, 'halo aditivo en la normal y de mezcla normal en la clara (el aditivo no se ve sobre blanco)');
  ok(bright.haloSat > 0.7, 'sobre suelo claro el halo lleva el color intenso del tipo');
  const leaf = await look('pradera', 'hojaAfilada'), drop = await look('pradera', 'pistolaAgua');
  ok(leaf.pixel && drop.pixel && leaf.img !== bright.img, 'cada movimiento con su forma: Hoja Afilada una hoja y Pistola Agua una gota');
};
