// «Recoger todo» de la pantalla de Misiones: de una vez, todo lo que hay por recoger allí (misiones cumplidas
// y sus cofres, el premio diario, logros y avatares de medalla), en un solo premio sumado para la animación.
const D = require('../public/data.js');
const missions = require('./missions.js');
const rewards = require('./rewards.js');
const daily = require('./daily.js');

function collectAll(p) {
  const total = { coins: 0, items: {}, gems: 0, all: 0, chests: [], extra: 0 };
  const add = l => {
    if (!l) return;
    total.coins += l.coins || 0; total.gems += l.gems || 0;
    for (const [k, q] of Object.entries(l.items || {})) total.items[k] = (total.items[k] || 0) + q;
    for (const k of ['aura', 'title', 'frame', 'avatar']) if (l[k]) total[k] = l[k];
  };
  const m = missions.action(p, { a: 'claimAll' });
  if (m.loot) { add(m.loot); total.all = m.loot.all; total.chests = m.loot.chests; }
  if (daily.view(p).ready) { add(daily.claim(p).loot); total.extra++; }
  rewards.migrate(p);
  for (const id of [...p.achClaim]) { add(rewards.claimAchievement(p, id).loot); total.extra++; }
  for (const id of rewards.badgesToClaim(p)) {
    const [, region, index] = id.split(':');
    add(rewards.claimBadge(p, region, +index).loot); total.extra++;
  }
  if (!total.all && !total.chests.length && !total.extra) return { error: 'No hay nada que recoger' };
  return { loot: total };
}

module.exports = { collectAll };
