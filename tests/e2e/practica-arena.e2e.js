// En Práctica se elige la arena en tarjetas con su foto (al azar, una de las de siempre o la de un gimnasio o del
// Alto Mando, con sus mecánicas) y una mecánica extra encima, y se recuerda
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'practicante' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.eval(`window.__app.ui.show('practice'); true`);
  await page.waitFor(`document.querySelector('.arena-card')`);
  ok(await page.eval(`document.querySelector('.arena-card.sel').dataset.map === '' && document.querySelectorAll('.arena-card img.arena-prev').length === Object.keys(Data.MAPS).length + Object.keys(Data.ARENAS).length`),
    'las arenas salen en tarjetas, cada una con su foto, y por defecto está «Al azar»');
  await page.waitFor(`[...document.querySelectorAll('.arena-card img.arena-prev')].every(i => i.complete && i.naturalWidth > 0) || document.querySelectorAll('.arena-card canvas').length`, 20000);
  ok(await page.eval(`!document.querySelector('.arena-card canvas')`), 'todas las fotos existen (ninguna cae al plano de respaldo)');
  ok(await page.eval(`document.querySelectorAll('.arena-card.mech').length === Object.keys(Data.ARENAS).length && !document.querySelector('.arena-card[data-map=pradera]').classList.contains('mech')`), 'las que tienen mecánicas lo dicen');
  if (process.env.SHOT) { await page.eval(`document.querySelector('.practice-arenas').scrollIntoView(); true`); await new Promise(r => setTimeout(r, 800)); await page.shot('/tmp/claude-1000/-home-pau-projects/917103ca-7484-4a18-bc59-4ad4e6485525/scratchpad/practica.png'); }
  await page.eval(`document.querySelector('.arena-card[data-map="g-fuego"]').click(); true`);
  ok(await page.eval(`localStorage.getItem('arena.practiceMap')`) === 'g-fuego', 'elegir la del gimnasio de fuego la recuerda');
  await page.eval(`document.querySelector('.practice-mods button[data-mod="fog"]').click(); true`);
  ok(await page.eval(`localStorage.getItem('arena.practiceMod')`) === 'fog', 'se elige una mecánica extra (niebla) y se recuerda');
  await page.eval(`document.querySelector('.pool-card').click(); true`);
  await page.eval(`document.querySelector('.draft button.primary').click(); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.mapName`, 20000);
  ok(await page.eval(`window.__app.battle.mapName === 'g-fuego' && window.__app.battle.mod === 'fog' && !!window.__app.battle.mech.lava !== undefined && !!window.__app.battle.mech.fog`), 'y el combate es en esa arena, con la niebla encima');
  if (process.env.SHOT) { await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`); }
};
