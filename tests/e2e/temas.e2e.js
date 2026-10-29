// Propuestas de aspecto (docs/propuestas-ui.md): solo se ven si se piden. Sin ?tema el juego se ve como siempre y no
// carga ninguna hoja de tema; con ?tema=b se ve la propuesta B, se recuerda al volver a entrar y ?tema=no la quita.
// Con el tema puesto, el menú y Historia se siguen usando igual (nada tapado)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'temas' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  const themeLoads = () => page.requests.filter(u => u.includes('/themes/')).length;
  // (el color de fondo de la tarjeta de Historia, tal como se pinta)
  const storyBg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundColor`;
  const enter = async q => {
    await page.goto('/' + q);
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
  };

  ok(themeLoads() === 0, 'sin tema no se pide ninguna hoja de tema');
  const plain = await page.eval(storyBg);

  await enter('?tema=b');
  ok(themeLoads() === 1, 'con ?tema=b se carga su hoja');
  await page.waitFor(`${storyBg} !== ${JSON.stringify(plain)}`, 5000).catch(() => {});
  const themed = await page.eval(storyBg);
  ok(themed === 'rgb(239, 90, 60)', `con la propuesta B, Historia es un bloque de color liso (${themed}; sin tema, ${plain})`);

  // Se recuerda: al volver a entrar sin nada en la dirección sigue el tema
  await enter('');
  ok(themeLoads() === 2 && await page.eval(storyBg) === themed, 'al volver a entrar, el tema elegido sigue');

  // Se usa igual: Historia se abre con el ratón y el botón de desafiar se ve y se puede pulsar
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
  await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);   // atajo: la guía de la primera vez
  const go = await page.eval(`(() => { const b = document.querySelector('.story-side .node-info button.primary'), r = b.getBoundingClientRect();
    return b.textContent.trim() + '|' + (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b); })()`);
  ok(go === '¡Desafiar!|true', `con el tema, «¡Desafiar!» se ve y no lo tapa nada (${go})`);

  // ?tema=no lo quita: vuelve el aspecto de siempre
  const before = themeLoads();
  await enter('?tema=no');
  ok(themeLoads() === before && await page.eval(storyBg) === plain, '?tema=no lo quita y el menú vuelve a ser el de siempre');
};
