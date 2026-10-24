// Genera public/regions.js a partir de tools/regions-src.js añadiendo a cada ruta sus encuentros
// reales (PokeAPI): especies, niveles y peso, juntando andar, surf, cañas y golpe roca de las
// versiones de cada región. Solo especies con sprites.
//
//   node tools/fetch-regions.js
const fs = require('fs');
const path = require('path');
const SRC = require('./regions-src.js');
const Data = require('../public/data.js');

// Hierba/cueva primero; agua y caña solo suman si la ruta no tiene hierba (o con sus niveles
// ajustados a los de la hierba). Sin encuentros especiales (radio, enjambres, Pokéwalker…).
const LAND = { walk: 1, 'rock-smash': 0.3, headbutt: 0.3 };
const WATER = { surf: 0.5, 'old-rod': 0.4, 'good-rod': 0.25 };
const BAD_CONDITIONS = ['radio-hoenn', 'radio-sinnoh', 'swarm-yes', 'slot2-ruby', 'slot2-sapphire', 'slot2-emerald', 'slot2-firered', 'slot2-leafgreen'];

async function q(query) {
  const r = await fetch('https://beta.pokeapi.co/graphql/v1beta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const j = await r.json();
  if (!j.data) throw new Error(JSON.stringify(j).slice(0, 300));
  return j.data;
}

(async () => {
  const out = {};
  for (const [rid, reg] of Object.entries(SRC)) {
    const locs = reg.nodes.flatMap(n => n.loc || []);
    const vers = reg.version.map(v => `"${v}"`).join(',');
    const d = await q(`query { pokemon_v2_location(where: {name: {_in: [${locs.map(l => `"${l}"`).join(',')}]}}) { name
      pokemon_v2_locationareas { pokemon_v2_encounters(where: {pokemon_v2_version: {name: {_in: [${vers}]}}}) {
        min_level max_level pokemon_v2_pokemon { pokemon_species_id }
        pokemon_v2_encounterconditionvaluemaps { pokemon_v2_encounterconditionvalue { name } }
        pokemon_v2_encounterslot { rarity pokemon_v2_encountermethod { name } } } } } }`);
    const byLoc = Object.fromEntries(d.pokemon_v2_location.map(l => [l.name, l.pokemon_v2_locationareas.flatMap(a => a.pokemon_v2_encounters)]));
    const nodes = reg.nodes.map(n => {
      if (!n.loc) return { kind: 'gym', ...n };
      const enc = n.loc.flatMap(loc => { if (!byLoc[loc]) console.warn(`  ${rid}: no existe ${loc}`); return byLoc[loc] || []; })
        .filter(e => !e.pokemon_v2_encounterconditionvaluemaps.some(c => BAD_CONDITIONS.includes(c.pokemon_v2_encounterconditionvalue.name)))
        .filter(e => Data.SPECIES[e.pokemon_v2_pokemon.pokemon_species_id]);
      const methodOf = e => e.pokemon_v2_encounterslot.pokemon_v2_encountermethod.name;
      const land = enc.filter(e => LAND[methodOf(e)]);
      const lmin = Math.min(...land.map(e => e.min_level)), lmax = Math.max(...land.map(e => e.max_level));
      const acc = new Map();   // dex -> { min, max, w }
      for (const e of enc) {
        const method = methodOf(e);
        const w = LAND[method] || WATER[method];
        if (!w) continue;
        let min = e.min_level, max = e.max_level;
        if (land.length && WATER[method]) { min = Math.max(lmin, Math.min(min, lmax)); max = Math.min(lmax + 4, Math.max(max, min)); }
        if (!land.length && WATER[method]) max = Math.min(max, min + 10);
        const dex = e.pokemon_v2_pokemon.pokemon_species_id;
        const o = acc.get(dex) || { min: 99, max: 0, w: 0 };
        o.min = Math.min(o.min, min); o.max = Math.max(o.max, max);
        o.w += e.pokemon_v2_encounterslot.rarity * w * (land.length && WATER[method] ? 0.5 : 1);
        acc.set(dex, o);
      }
      const total = [...acc.values()].reduce((a, o) => a + o.w, 0) || 1;
      // Peso relativo en % (mínimo 1) y como mucho 9 especies (las más comunes)
      const wild = [...acc.entries()].sort((a, b) => b[1].w - a[1].w).slice(0, 9)
        .map(([dex, o]) => [dex, o.min, o.max, Math.max(1, Math.round(o.w / total * 100))]);
      if (!wild.length) console.warn(`  ${rid}: ${n.name} sin encuentros`);
      const { loc, ...rest } = n;
      return { kind: 'route', ...rest, wild };
    });
    out[rid] = { id: rid, name: reg.name, legends: reg.legends.filter(d => Data.SPECIES[d]), nodes };
    console.log(`${reg.name}: ${nodes.filter(n => n.kind === 'route').length} rutas, ${nodes.filter(n => n.kind !== 'route').length} combates de líder`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'regions.js'),
    `// Generado por tools/fetch-regions.js (tools/regions-src.js + encuentros reales de PokeAPI). No editar a mano.\n` +
    `// Ruta: wild = [[dex, nivel mín, nivel máx, peso %], ...]. Líderes: team real completo.\n` +
    `(function (root) {\n  const REGIONS = ${JSON.stringify(out, null, 1)};\n` +
    `  if (typeof module !== 'undefined' && module.exports) module.exports = REGIONS;\n  else root.REGIONS = REGIONS;\n})(this);\n`);
})().catch(e => { console.error(e); process.exit(1); });
