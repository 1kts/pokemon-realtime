// Fotos de las arenas para elegirlas en Práctica: cada una con la cámara del combate, sin menús. Se lanza a mano
// cuando cambian las arenas y deja los PNG en la carpeta de salida (luego se pasan a webp pequeños):
//   node tools/e2e.js tools/arena-thumbs.e2e.js   (con ARENA_THUMBS=<carpeta>; ARENA_ONLY=g-fuego,lago para unas pocas:
//   todas de una vez pasan de los 3 minutos que tiene cada prueba, así que se hacen por tandas)
const OUT = process.env.ARENA_THUMBS || '/tmp/arena-thumbs';
module.exports = async ({ page, ok }) => {
  require('fs').mkdirSync(OUT, { recursive: true });
  await page.resize(1280, 800);
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && window.__app.world`);
  // Sin menús y con la cámara del combate (un combate de mentira que no hace nada)
  await page.eval(`(() => { document.getElementById('screen').style.display = 'none'; document.querySelector('.legal-bar').style.display = 'none';
    document.querySelectorAll('#hud, .hub-bar').forEach(e => e.style.display = 'none'); window.__app.battle = { frame() {}, camShake: null }; return true; })()`);
  const keys = process.env.ARENA_ONLY ? process.env.ARENA_ONLY.split(',') : await page.eval(`[...Object.keys(Data.MAPS), ...Object.keys(Data.ARENAS)]`);
  for (const k of keys) {
    // (en las arenas a oscuras, la luz del Pokémon en el centro, como en combate)
    await page.eval(`window.__app.world.loadMap('${k}', Shared.parseMap('${k}').terrain); window.__app.world.setFocus(Shared.COLS * Shared.CELL / 2, Shared.ROWS * Shared.CELL / 2); true`);
    await new Promise(r => setTimeout(r, 2500));   // modelos del decorado y unos cuantos fotogramas
    await page.shot(`${OUT}/${k}.png`);
  }
  ok(true, `${keys.length} fotos en ${OUT}`);
};
