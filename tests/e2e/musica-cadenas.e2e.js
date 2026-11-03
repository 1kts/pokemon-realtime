// Música (3): los temas cortos enlazan con el siguiente en vez de volver a empezar (parte de musica-temas.e2e.js, que
// juntas pasaban de los 5 minutos en el CI)
module.exports = async ({ page, ok }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.music`);

  // El de los líderes (menos de un minuto) enlaza con el de combate en vez de volver a empezar
  await page.realClick('body');
  await page.eval(`window.__app.music.play('leader'); true`);
  // atajo: la música no se ve: se mira qué grabaciones encadena el tema
  ok(await page.waitFor(`window.__app.music.file && window.__app.music.file.name === 'leader' && window.__app.music.file.list.length === 2`, 45000).then(() => true, () => false), 'el tema de los líderes, al acabar, enlaza con el de combate (no vuelve a empezar a medias)');

  // Las cadenas nuevas: Torre (Battle Theme IV y The Evil One), salvajes y gimnasios de Johto (enlazan con los de Kanto)
  // y los gimnasios con tema propio enlazan con los de los líderes de su región
  for (const [name, next, n] of [['tower', 'maligno', 2], ['wild', 'ruta', 2], ['wildJohto', 'viaje', 2], ['route-cueva', 'caverna, mina y salvajes', 4], ['route-lagoJohto', 'isla y salvajes', 3], ['leaderJohto', 'lider', 2], ['gym-fuego', 'lider y desierto', 3], ['gym-dragon', 'gimnasio y lider', 3]]) {
    await page.eval(`window.__app.music.play('${name}'); true`);
    // atajo: la música no se ve (ver arriba). Hasta 60 s: al empezar se están descargando las demás grabaciones
    ok(await page.waitFor(`window.__app.music.file && window.__app.music.file.name === '${name}' && window.__app.music.file.list.filter(Boolean).length === ${n}`, 60000).then(() => true, () => false), `el tema «${name}», al acabar, enlaza con ${next}`);
  }
};
