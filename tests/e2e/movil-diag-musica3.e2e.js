// DIAGNÓSTICO TEMPORAL (rama fix/webkit): recargar con page.reload (como movil) y descargas de música a medias (caso 3)
module.exports = async ({ page, ok, log }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  const what = await page.eval(`(() => {
    const c = 3, files = ['campeon', 'desierto', 'bosque', 'duelo', 'torre', 'maligno', 'castillo', 'volcan'];
    if (c === 1) files.forEach(f => fetch('/music/' + f + '.mp3?d=' + Math.random()).then(r => r.arrayBuffer()).catch(() => {}));
    if (c === 2) { const m = window.__app.music; m.bytes.clear(); ['champion', 'battle', 'ranked', 'tower', 'towerBoss', 'forest', 'town', 'city'].forEach(n => m.preload(n)); }
    if (c === 3) { const a = new AbortController(); addEventListener('pagehide', () => a.abort()); files.forEach(f => fetch('/music/' + f + '.mp3?d=' + Math.random(), { signal: a.signal }).then(r => r.arrayBuffer()).catch(() => {})); }
    return c === 1 ? 'fetch sin cortar' : c === 2 ? 'preload del juego' : 'fetch cortado en pagehide';
  })()`);
  await page.reload();
  log(what + ' · pedidas: ' + await page.eval(`performance.getEntriesByType('resource').filter(r => r.name.includes('/music/')).length`));
  await page.eval(`new Promise(r => setTimeout(() => r(true), 1500))`);
  ok(true, 'diagnóstico de música, caso 3 (lo que cuenta es el error de la página)');
};
