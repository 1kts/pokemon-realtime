// Entrenadores IA de Clasificatoria: salen en la ladder con la etiqueta «IA» (nunca como personas) y, si buscas
// partida y nadie aparece en unos segundos, te toca uno de ELO parecido, también marcado como «IA» en el combate.
// El resultado cuenta para el ELO como cualquier otro
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'retador' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  // Equipo desde la propia página (con sus movimientos por defecto)
  await page.eval(`window.__app.net.send({ t: 'pvpteam', team: [6, 9, 3].map(dex => ({ dex, moves: Data.defaultMoves(dex, Data.RANKED_LEVEL) })) }); true`);
  await page.waitFor(`(window.__app.ui.profile.pvpTeam || []).length === 3`);

  // La ladder: los entrenadores IA, marcados
  await page.eval(`window.__app.ui.ladderBoard = 'ranked'; window.__app.ui.openLadder(); true`);
  await page.waitFor(`document.querySelectorAll('.ladder-rows tbody tr .ia-tag').length >= 10`);
  ok(await page.eval(`[...document.querySelectorAll('.ladder-rows tbody tr')].filter(r => r.querySelector('.ia-tag')).length >= 10`), 'la ladder tiene entrenadores de la IA, cada uno con la etiqueta «IA»');
  await page.eval(`[...document.querySelectorAll('.ladder-rows tbody tr')].find(r => r.querySelector('.ia-tag')).click(); true`);
  await page.waitFor(`document.querySelector('.user-modal h3 .ia-tag')`);
  ok(await page.eval(`/Entrenador de la IA/.test(document.querySelector('.user-modal').textContent) && document.querySelectorAll('.user-modal .mini-team .mini').length === 3 && !document.querySelector('.user-modal .acts button:not(.primary)')`),
    'su ficha dice que es de la IA, enseña su equipo de 3 y no se puede añadir de amigo');
  await page.eval(`document.querySelectorAll('.modal').forEach(m => m.remove()); true`);

  // Buscar partida sin nadie más: a los ~20 s toca un entrenador IA
  const elo0 = await page.eval(`window.__app.ui.profile.elo`);
  await page.eval(`window.__app.net.send({ t: 'queue', mode: 'ranked' }); true`);
  await page.waitFor(`window.__app.battle && window.__app.battle.sides`, 35000);
  ok(await page.eval(`(() => { const b = window.__app.battle; return !!b.sides[b.foeIdx].npc && !!document.querySelector('.team.foe .ia-tag'); })()`), 'si nadie aparece, te toca un entrenador de la IA, marcado con «IA»');
  await page.waitFor(`window.__app.battle.latest`, 15000);
  await page.eval(`window.__app.net.send({ t: 'forfeit' }); true`);
  await page.waitFor(`!window.__app.battle && window.__app.ui.view === 'results'`, 15000);
  await page.waitFor(`window.__app.ui.profile.elo !== ${elo0}`);
  ok(await page.eval(`window.__app.ui.profile.elo`) < elo0, 'el resultado cuenta para el ELO');
};
