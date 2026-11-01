// Música (2): qué tema pide cada tipo de combate, que existen todas las grabaciones y que los temas cortos
// enlazan con el siguiente (eso, en musica-cadenas.e2e.js; aparte de musica.e2e.js, para que ninguna pase de 3 minutos en el CI)
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.music`);

  // El Alto Mando y el Campeón suenan con el tema largo del Campeón (6 min: no se repite en un combate de 3)
  const tracks = await page.eval(`import('/js/music.js').then(m => { const by = k => Object.values(Data.NODES).find(n => n.kind === k);
    return ['elite', 'champion', 'gym'].map(k => m.trackForBattle({ mode: 'trainer', map: by(k).map }, Data)); })`);
  ok(tracks.join() === 'champion,champion,gym-roca', `el Alto Mando y el Campeón usan el tema del Campeón; el gimnasio de Brock, el suyo (${tracks.join(', ')})`);
  // Cada tipo de combate pide su tema: Práctica, PvP y el combate amistoso con un amigo, Torre, salvajes y gimnasios de cada región
  const byMode = await page.eval(`import('/js/music.js').then(m => {
    const nodes = Object.values(Data.NODES), first = (r, k) => nodes.find(n => n.region === r && n.kind === k);
    const t = (mode, map) => m.trackForBattle({ mode, map }, Data);
    return {
      practice: t('practice', Object.keys(Data.MAPS)[0]), practiceGym: t('practice', 'g-fuego'), ranked: t('ranked', Object.keys(Data.MAPS)[0]), friendly: t('friendly', Object.keys(Data.MAPS)[1]),
      tower: t('tower', Object.keys(Data.MAPS)[0]),
      wildKanto: t('wild', 'r:' + first('kanto', 'route').id), wildJohto: t('wild', 'r:' + first('johto', 'route').id),
      gymKanto: t('trainer', 'g-fuego'), gymJohto: t('trainer', 'g-volador'), gymJohtoPlain: t('trainer', 'g-bicho'),
      gymAll: nodes.filter(n => n.kind === 'gym').map(n => [n.region, n.type, t('trainer', n.map)]),
      eliteJohto: t('trainer', first('johto', 'elite').map), champJohto: t('trainer', first('johto', 'champion').map),
    }; })`);
  const want = { practice: 'battle', practiceGym: 'battle', ranked: 'ranked', friendly: 'ranked', tower: 'tower', wildKanto: 'wild', wildJohto: 'wildJohto',
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
  // (qué grabaciones encadena cada tema, en musica-cadenas.e2e.js: juntas pasaban de los 5 minutos en el CI)
};
