// Tesoros: las gemas (moneda propia, aparte del dinero) y las ruletas de premios que cambian cada
// 2 semanas (Data.treasures). Cada tirada da uno de los premios que faltan, con la probabilidad de su
// rareza (Data.treasureOdds), y cuesta más que la anterior (Data.SPIN_COST). Al cambiar de periodo lo
// conseguido se queda (skins, glows, retratos) y lo que faltaba de las ruletas viejas se va.
//   p.gems · p.treasure = { period, got: { [ruleta]: [ids de premio] } }
const D = require('../public/data.js');
const rewards = require('./rewards.js');

function migrate(p) {
  if (p.gems === undefined) p.gems = 0;
  const period = D.treasurePeriod();
  if (!p.treasure || p.treasure.period !== period) p.treasure = { period, got: {} };
  return p.treasure;
}

const addGems = (p, n) => { migrate(p); return rewards.addGems(p, n); };

// Entrega un premio y devuelve lo recibido para la animación (el mismo formato que misiones y logros)
function grant(p, x) {
  rewards.migrate(p);
  const loot = { coins: 0, items: {} };
  if (x.kind === 'skin') { rewards.unlock(p, 'skins', `${x.skin}:${D.lineOf(x.dex)}`); loot.skin = x.skin; loot.skinDex = D.lineOf(x.dex); }
  if (x.kind === 'particles') { rewards.migrate(p); rewards.unlock(p, 'particles', D.lineOf(x.dex)); p.particles[D.lineOf(x.dex)] = true; loot.particles = D.lineOf(x.dex); }
  if (x.kind === 'portrait') { rewards.unlock(p, 'avatars', x.id); loot.avatar = x.id; }
  if (x.kind === 'effect') { rewards.unlock(p, 'effects', x.effect); loot.effect = x.effect; }
  if (x.kind === 'coins') { p.coins += x.coins; loot.coins = x.coins; }
  if (x.kind === 'item') { p.items[x.item] = (p.items[x.item] || 0) + x.qty; loot.items[x.item] = x.qty; }
  return loot;
}

// Una tirada de la ruleta id
function spin(p, id, rand = Math.random) {
  const t = migrate(p);
  const r = D.treasures(t.period).find(x => x.id === id);
  if (!r) return { error: 'Esa ruleta ya no está: han cambiado' };
  const got = t.got[id] || [];
  if (got.length >= r.prizes.length) return { error: 'Ya tienes todos sus premios' };
  const cost = D.SPIN_COST[got.length];
  if (p.gems < cost) return { error: 'No tienes gemas suficientes' };
  const odds = D.treasureOdds(r, got);
  let k = rand(), prize = odds[odds.length - 1].prize;
  for (const o of odds) { if (k < o.p) { prize = o.prize; break; } k -= o.p; }
  p.gems -= cost;
  t.got[id] = [...got, prize.id];
  const loot = grant(p, prize);
  loot.treasure = { roulette: id, prize: prize.id, rarity: prize.rarity, cost, n: got.length + 1 };
  return { loot };
}

module.exports = { migrate, addGems, spin };
