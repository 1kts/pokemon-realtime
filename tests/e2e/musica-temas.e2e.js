// Música (2): qué tema pide cada tipo de combate, que existen todas las grabaciones y que los temas cortos
// enlazan con el siguiente (aparte de musica.e2e.js, para que ninguna de las dos pase de 3 minutos en el CI)
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.music`);

  // El Alto Mando y el Campeón suenan con el tema largo del Campeón (6 min: no se repite en un combate de 3)
  const tracks = await page.eval(`import('/js/music.js').then(m => { const by = k => Object.values(Data.NODES).find(n => n.kind === k);
    return ['elite', 'champion', 'gym'].map(k => m.trackForBattle({ mode: 'trainer', map: by(k).map }, Data)); })`);
  ok(tracks.join() === 'champion,champion,gym-roca', `el Alto Mando y el Campeón usan el tema del Campeón; el gimnasio de Brock, el suyo (${tracks.join(', ')})`);
  // El de los líderes (menos de un minuto) enlaza con el de combate en vez de volver a empezar
  await page.realClick('body');
  await page.eval(`window.__app.music.play('leader'); true`);
  // atajo: la música no se ve: se mira qué grabaciones encadena el tema
  ok(await page.waitFor(`window.__app.music.file && window.__app.music.file.name === 'leader' && window.__app.music.file.list.length === 2`, 20000).then(() => true, () => false), 'el tema de los líderes, al acabar, enlaza con el de combate (no vuelve a empezar a medias)');

  // Cada tipo de combate pide su tema: Práctica, Clasificatoria y Partida rápida, Torre, salvajes y gimnasios de cada región
  const byMode = await page.eval(`import('/js/music.js').then(m => {
    const nodes = Object.values(Data.NODES), first = (r, k) => nodes.find(n => n.region === r && n.kind === k);
    const t = (mode, map) => m.trackForBattle({ mode, map }, Data);
    return {
      practice: t('practice', Object.keys(Data.MAPS)[0]), practiceGym: t('practice', 'g-fuego'), ranked: t('ranked', Object.keys(Data.MAPS)[0]), casual: t('casual', Object.keys(Data.MAPS)[1]),
      tower: t('tower', Object.keys(Data.MAPS)[0]),
      wildKanto: t('wild', 'r:' + first('kanto', 'route').id), wildJohto: t('wild', 'r:' + first('johto', 'route').id),
      gymKanto: t('trainer', 'g-fuego'), gymJohto: t('trainer', 'g-volador'), gymJohtoPlain: t('trainer', 'g-bicho'),
      gymAll: nodes.filter(n => n.kind === 'gym').map(n => [n.region, n.type, t('trainer', n.map)]),
      eliteJohto: t('trainer', first('johto', 'elite').map), champJohto: t('trainer', first('johto', 'champion').map),
    }; })`);
  const want = { practice: 'battle', practiceGym: 'battle', ranked: 'ranked', casual: 'ranked', tower: 'tower', wildKanto: 'wild', wildJohto: 'wildJohto',
    gymKanto: 'gym-fuego', gymJohto: 'gym-volador', gymJohtoPlain: 'leaderJohto', eliteJohto: 'champion', champJohto: 'champion' };
  for (const [k, v] of Object.entries(want)) ok(byMode[k] === v, `${k} usa el tema «${v}» (${byMode[k]})`);
  // Cada gimnasio: el tema de su tipo, o si no tiene, el de los líderes de su región
  const badGym = byMode.gymAll.filter(([r, type, tr]) => tr !== 'gym-' + type && tr !== (r === 'johto' ? 'leaderJohto' : 'leader'));
  ok(byMode.gymAll.length === 16 && !badGym.length, `los 16 gimnasios tienen tema (${badGym.map(g => g.join(':')).join(', ') || 'todos bien'})`);
  ok(byMode.gymAll.filter(g => g[2].startsWith('gym-')).length === 12, '12 gimnasios suenan con el tema de su tipo');

  // Todas las grabaciones existen, y los temas que pueden sonar solos tienen versión sintetizada por si falta el archivo
  const files = await page.eval(`import('/js/music.js').then(async m => {
    const out = {};
    for (const [name, file] of Object.entries(m.FILES)) {
      const r = await fetch('/music/' + file + '.mp3');
      out[name] = { file, ok: r.ok && (await r.arrayBuffer()).byteLength > 100000 };
    }
    const heads = ['menu', 'battle', 'ranked', 'tower', 'wild', 'wildJohto', 'leader', 'leaderJohto', 'champion', ...Object.keys(m.GYM_THEMES).map(t => 'gym-' + t)];
    const synth = heads.every(n => { try { return m.compile(n).steps.length > 0; } catch { return false; } });
    const chained = Object.values(m.CHAIN).flat().every(n => m.FILES[n]);
    const ruta = (map, region) => m.trackForBattle({ mode: 'wild', map: 'r:x' }, { NODES: { x: { map, region } } });
    const torre = new Set(Array.from({ length: 5 }, () => m.trackForBattle({ mode: 'tower' }, {}))).size;
    const especial = m.trackForBattle({ mode: 'wild', map: 'r:x', you: 0, sides: [{}, { rare: true }] }, { NODES: { x: { map: 'cueva', region: 'kanto' } } });
    const rutas = [ruta('cueva', 'kanto'), ruta('lago', 'johto'), ruta('bosque', 'kanto'), ruta('pradera', 'kanto')].join();
    const hold = [m.passes('menu', 41), m.passes('menu', 119), m.passes('wild', 46)];
    return { out, synth, chained, hold, rutas, torre, especial, castillo: m.FILES[especial] }; })`);
  for (const [name, f] of Object.entries(files.out)) ok(f.ok, `existe public/music/${f.file}.mp3 (tema «${name}»)`);
  const grabaciones = new Set(Object.values(files.out).map(f => f.file)).size;   // (varios temas comparten grabación)
  ok(grabaciones === 25, `hay 25 grabaciones (${grabaciones})`);
  ok(files.synth, 'cada tema que puede sonar solo tiene su versión sintetizada');
  ok(files.chained, 'cada tema enlazado tiene su grabación');
  ok(files.castillo === 'castillo', `un salvaje especial suena con Demon King Castle, sea cual sea la ruta (${files.castillo})`);
  ok(files.torre === 5, `cinco combates seguidos de la Torre empiezan con 5 temas distintos (${files.torre})`);
  ok(files.rutas === 'route-cueva,route-lagoJohto,route-bosque,wild', `cada estilo de ruta pide su tema y la pradera, el de siempre (${files.rutas})`);
  ok(files.hold.join() === '5,2,1', `en el menú cada tema dura al menos 3 minutos antes de pasar al siguiente, y en combate pasa al acabar (${files.hold})`);

  // Las cadenas nuevas: Torre (Battle Theme IV y The Evil One), salvajes y gimnasios de Johto (enlazan con los de Kanto)
  // y los gimnasios con tema propio enlazan con los de los líderes de su región
  for (const [name, next, n] of [['tower', 'maligno', 2], ['wild', 'ruta', 2], ['wildJohto', 'viaje', 2], ['route-cueva', 'caverna, mina y salvajes', 4], ['route-lagoJohto', 'isla y salvajes', 3], ['leaderJohto', 'lider', 2], ['gym-fuego', 'lider y desierto', 3], ['gym-dragon', 'gimnasio y lider', 3]]) {
    await page.eval(`window.__app.music.play('${name}'); true`);
    // atajo: la música no se ve (ver arriba). Hasta 60 s: al empezar se están descargando las demás grabaciones
    ok(await page.waitFor(`window.__app.music.file && window.__app.music.file.name === '${name}' && window.__app.music.file.list.filter(Boolean).length === ${n}`, 60000).then(() => true, () => false), `el tema «${name}», al acabar, enlaza con ${next}`);
  }
};
