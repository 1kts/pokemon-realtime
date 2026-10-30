// El aspecto del juego es el tema D (docs/propuestas-ui.md): sin pedir nada se carga con la página. Las otras
// propuestas se ven si se piden: con ?tema=b se ve la B, se recuerda al volver a entrar y ?tema=no deja el aspecto de
// antes, sin ninguna hoja de tema; ?tema=d vuelve al de siempre.
// Con el tema puesto, el menú y Historia se siguen usando igual (nada tapado). Cómo se ve la D lo mira tema-d.e2e.js
// (juntas pasaban de los 5 minutos que tiene cada prueba en el CI)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'temas' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', badges: 3, region: 'kanto', gems: 300 });   // (con gemas para una tirada de Lucky Spin)
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  // (el color de fondo de la tarjeta de Historia, tal como se pinta)
  const storyBg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundColor`;
  const enter = async q => {
    await page.goto('/' + q);
    await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
    await page.click('.title-panel button.primary');
    await page.waitFor(`window.__app.ui.view === 'menu'`, 20000);
  };

  // (la hoja que se aplica de verdad: la que está entre las hojas de la página y tiene reglas cargadas)
  const sheet = `(() => { const l = document.getElementById('tema-css'); return l && l.sheet && l.sheet.cssRules.length ? l.getAttribute('href') : null; })()`;
  await page.waitFor(`${sheet} !== null`, 10000).catch(() => {});
  ok(await page.eval(sheet) === '/themes/tema-d.css' && await page.eval(`document.body.classList.contains('tema-d')`), 'sin pedir nada, el juego lleva el tema D');
  const base = await page.eval(storyBg);
  // (la D pinta Historia con un degradado: lo que la distingue de sin tema es su imagen de fondo)
  const storyImg = `getComputedStyle(document.querySelector('.menu-card.story')).backgroundImage`;
  const baseImg = await page.eval(storyImg);

  await enter('?tema=b');
  await page.waitFor(`${sheet} === '/themes/tema-b.css'`, 10000).catch(() => {});
  ok(await page.eval(sheet) === '/themes/tema-b.css' && await page.eval(`document.body.classList.contains('tema-b') && !document.body.classList.contains('tema-d')`), 'con ?tema=b se carga su hoja en vez de la D');
  await page.waitFor(`${storyBg} !== ${JSON.stringify(base)}`, 5000).catch(() => {});
  const themed = await page.eval(storyBg);
  ok(themed === 'rgb(239, 90, 60)', `con la propuesta B, Historia es un bloque de color liso (${themed}; con la D, ${base})`);

  // Se recuerda: al volver a entrar sin nada en la dirección sigue el tema
  await enter('');
  ok(await page.eval(sheet) === '/themes/tema-b.css' && await page.eval(storyBg) === themed, 'al volver a entrar, el tema elegido sigue');

  // Se usa igual: Historia se abre con el ratón y el botón de desafiar se ve y se puede pulsar
  await page.click('.menu-card.story');
  await page.waitFor(`document.querySelector('.story-path .sp-node')`, 20000);
  // (la guía de la primera vez: se cierra como un jugador)
  await page.waitFor(`[...document.querySelectorAll('body > .modal button')].some(b => b.textContent.includes('¡A jugar!'))`);
  await page.click('¡A jugar!');
  await page.waitFor(`!document.querySelector('body > .modal')`);
  await page.eval(`document.querySelector('.story-path .sp-node.now').scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }); true`);   // atajo: desplazar el camino hasta el líder
  await page.click('.story-path .sp-node.now');
  const go = await page.eval(`(() => { const b = document.querySelector('.story-side .node-info button.primary'), r = b.getBoundingClientRect();
    return b.textContent.trim() + '|' + (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b); })()`);
  ok(go === '¡Desafiar!|true', `con el tema, «¡Desafiar!» se ve y no lo tapa nada (${go})`);

  // ?tema=no lo quita todo: el aspecto de antes, sin hoja de tema ni clase
  await enter('?tema=no');
  const plainImg = await page.eval(storyImg);
  ok(await page.eval(`!document.getElementById('tema-css') && ![...document.body.classList].some(c => c.startsWith('tema-'))`) && plainImg !== baseImg,
    '?tema=no quita el tema y el menú se ve como antes (Historia sin el degradado de la D)');
  await enter('?tema=d');
  ok(await page.eval(`document.body.classList.contains('tema-d')`) && await page.eval(storyImg) === baseImg, '?tema=d vuelve al aspecto del juego');
};
