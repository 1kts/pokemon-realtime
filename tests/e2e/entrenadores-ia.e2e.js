// Entrenadores IA de Clasificatoria: salen en la ladder con la etiqueta «IA» (nunca como personas) y, si buscas
// partida y nadie aparece en unos segundos, te toca uno de ELO parecido, también marcado como «IA» en el combate.
// El resultado cuenta para el ELO como cualquier otro
const Data = require('../../public/data.js');

module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'retador' });
  // Su equipo de Clasificatoria (con sus movimientos por defecto), preparado antes de entrar
  me.client.send({ t: 'pvpteam', team: [6, 9, 3].map(dex => ({ dex, moves: Data.defaultMoves(dex, Data.RANKED_LEVEL) })) }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);

  // La ladder: los entrenadores IA, marcados
  await page.tap(/^Ladder/);
  await page.waitFor(`document.querySelectorAll('.ladder-rows tbody tr .ia-tag').length >= 10`);
  ok(await page.eval(`[...document.querySelectorAll('.ladder-rows tbody tr')].filter(r => r.querySelector('.ia-tag') && /IA/.test(r.innerText)).length >= 10`), 'la ladder tiene entrenadores de la IA, cada uno con la etiqueta «IA»');
  await page.eval(`[...document.querySelectorAll('.ladder-rows tbody tr')].find(r => r.querySelector('.ia-tag')).id = 'ia-e2e'; true`);
  await page.click('#ia-e2e');
  await page.waitFor(`document.querySelector('.user-modal h3 .ia-tag')`);
  ok(await page.see('Entrenador de la IA', { in: '.user-modal' }) && await page.eval(`document.querySelectorAll('.user-modal .mini-team .mini').length === 3 && !document.querySelector('.user-modal .acts button:not(.primary)')`),
    'su ficha dice que es de la IA, enseña su equipo de 3 y no se puede añadir de amigo');
  // Son líderes y campeones, con su sprite de entrenador (cargado, no roto) y sin etiqueta #
  await page.waitFor(`(() => { const i = document.querySelector('.user-modal .npc-face img'); return i && i.complete && i.naturalWidth > 0; })()`);
  ok(await page.eval(`/trainers\\//.test(document.querySelector('.user-modal .npc-face img').src) && !/poke-ball/.test(document.querySelector('.user-modal .npc-face img').src) && !document.querySelector('.user-modal .ntag')`),
    'su ficha lleva el sprite de su entrenador y no lleva etiqueta #');
  await page.key('Escape');
  await page.waitFor(`!document.querySelector('.user-modal')`);

  // Buscar partida sin nadie más: a los ~20 s toca un entrenador IA
  await page.tap('Volver');
  await page.tap(/^Clasificatoria/);
  const elo = async () => +(await page.read('.online-me .big-elo')).replace(/\D/g, '');
  const elo0 = await elo();
  await page.tap('Buscar partida clasificatoria');
  await page.waitFor(`window.__app.battle && window.__app.battle.sides`, 40000);
  await page.waitSee('IA', { in: '.team.foe' });
  ok(true, 'si nadie aparece, te toca un entrenador de la IA, marcado con «IA»');
  await page.waitFor(`window.__app.battle.latest`, 15000);
  await page.key('Escape');
  await page.tap('Rendirse', { in: '.ui-confirm-box' });
  await page.waitSee('Derrota', { ms: 15000 });
  ok(await page.eval(`!/undefined|NaN/.test(document.querySelector('.results').innerText) && !document.querySelector('.results .league-res, .results .league-box')`), 'los resultados no muestran la Liga Pokémon ni «undefined»');
  await page.tap('Continuar');
  await page.waitFor(`document.querySelector('.online-me .big-elo')`);
  ok(await elo() < elo0, `el resultado cuenta para el ELO (${elo0} → ${await elo()})`);
};
