// DIAGNÓSTICO TEMPORAL (rama fix/webkit): recargar con una descarga de música a medias (caso 3)
module.exports = async ({ page, ok, log }) => {
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  const what = await page.eval(`(() => {
    const c = 3;
    if (c === 1) fetch('/music/campeon.mp3?d=' + Math.random()).then(r => r.arrayBuffer()).catch(() => {});
    if (c === 2) { const a = new AbortController(); addEventListener('pagehide', () => a.abort()); fetch('/music/campeon.mp3?d=' + Math.random(), { signal: a.signal }).then(r => r.arrayBuffer()).catch(() => {}); }
    if (c === 3) { window.__app.music.bytes.clear(); window.__app.music.preload('champion'); window.__app.music.preload('tower'); }
    setTimeout(() => location.reload(), 0);
    return c === 1 ? 'fetch sin cortar' : c === 2 ? 'fetch cortado en pagehide' : 'preload del juego';
  })()`);
  log(what);
  await page.waitFor('document.readyState === "complete" && window.__app', 30000);
  await page.eval(`new Promise(r => setTimeout(() => r(true), 1500))`);
  ok(true, 'diagnóstico de música, caso 3 (lo que cuenta es el error de la página)');
};
