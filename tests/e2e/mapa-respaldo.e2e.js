// Mapa de Historia sin 3D: si no se puede crear el contexto WebGL de la maqueta, sale el mapa SVG de respaldo con
// sus caminos, y los nodos siguen en su sitio
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'mapasvg' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  // Sin WebGL para el lienzo del mapa (el fondo del juego sigue con el suyo)
  await page.eval(`(() => { const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, opts) { return this.classList.contains('map3d-canvas') ? null : get.call(this, type, opts); };
    return true; })()`);
  await page.eval(`window.__app.ui.show('story'); true`);
  await page.waitFor(`document.querySelector('.you-pin')`);
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);
  await page.waitFor(`document.querySelector('.mapart')`);
  ok(await page.eval(`document.querySelectorAll('.mapart polyline').length`) > 0, 'el SVG de respaldo dibuja los caminos');
  ok(await page.eval(`document.querySelectorAll('.mapart [stroke-dasharray]').length`) === 0, 'sin línea discontinua en los caminos: solo las de a dónde puedes ir');
  ok(!await page.eval(`document.querySelector('.map.map3d-on')`), 'sin el 3D encima');
  ok(await page.eval(`document.querySelectorAll('.node.gym').length`) === 8, 'los gimnasios, en el mapa');
  ok(await page.eval(`!!document.querySelector('.node.league-hq .league-ico')`) && await page.eval(`getComputedStyle(document.querySelector('.node.league-hq .league-ico')).display !== 'none'`), 'la Liga, con su edificio de siempre');
};
