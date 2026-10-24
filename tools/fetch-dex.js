// Descarga de PokeAPI (https://pokeapi.co, datos abiertos) los datos de todas las especies que
// tienen sprites en SpriteCollab/PokéSurvivor y genera public/dex.js.
//
//   node tools/fetch-dex.js <ruta a pokesurvivor>
//
// Por especie: [nombre en español, tipos, stats base [ps, atq, def, atqEsp, defEsp, vel], generación,
//               0 normal / 1 legendario / 2 singular, evoluciona de, ratio de captura, cómo se obtiene]
// "cómo se obtiene": nivel (número), id de piedra ('agua', 'sol'…) u otro disparador ('trade', …).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = process.argv[2];
if (!src) { console.error('Uso: node tools/fetch-dex.js <ruta a pokesurvivor>'); process.exit(1); }
const ctx = { G: {} };
vm.runInNewContext(fs.readFileSync(path.join(src, 'js/data/sprites-meta.js'), 'utf8'), ctx);
const withSprites = new Set(Object.keys(ctx.G.SPRITE_META).map(Number));

const TYPES = { normal: 'normal', fire: 'fuego', water: 'agua', grass: 'planta', electric: 'electrico', ice: 'hielo',
  fighting: 'lucha', poison: 'veneno', ground: 'tierra', flying: 'volador', psychic: 'psiquico', bug: 'bicho',
  rock: 'roca', ghost: 'fantasma', dragon: 'dragon', steel: 'acero', dark: 'siniestro', fairy: 'hada' };
const STONES = { 'water-stone': 'agua', 'thunder-stone': 'trueno', 'fire-stone': 'fuego', 'leaf-stone': 'hoja',
  'moon-stone': 'lunar', 'sun-stone': 'sol', 'ice-stone': 'hielo', 'dusk-stone': 'noche', 'dawn-stone': 'alba', 'shiny-stone': 'dia' };
const STAT_ORDER = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

const query = (from, to) => `query { pokemon_v2_pokemonspecies(order_by: {id: asc}, where: {id: {_gte: ${from}, _lte: ${to}}}) {
  id name is_legendary is_mythical generation_id evolves_from_species_id capture_rate
  pokemon_v2_pokemonspeciesnames(where: {language_id: {_eq: 7}}) { name }
  pokemon_v2_pokemons(where: {is_default: {_eq: true}}) {
    pokemon_v2_pokemontypes(order_by: {slot: asc}) { pokemon_v2_type { name } }
    pokemon_v2_pokemonstats { base_stat pokemon_v2_stat { name } } }
  pokemon_v2_pokemonevolutions { min_level pokemon_v2_item { name } pokemon_v2_evolutiontrigger { name } } } }`;

async function fetchRange(from, to) {
  const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query(from, to) }),
  });
  const json = await res.json();
  if (!json.data) throw new Error(JSON.stringify(json).slice(0, 300));
  return json.data.pokemon_v2_pokemonspecies;
}

(async () => {
  const out = {};
  for (let from = 1; from <= 1025; from += 250) {
    for (const s of await fetchRange(from, from + 249)) {
      if (!withSprites.has(s.id)) continue;
      const p = s.pokemon_v2_pokemons[0];
      const stats = STAT_ORDER.map(n => p.pokemon_v2_pokemonstats.find(x => x.pokemon_v2_stat.name === n).base_stat);
      const types = p.pokemon_v2_pokemontypes.map(t => TYPES[t.pokemon_v2_type.name]);
      const evo = s.pokemon_v2_pokemonevolutions[0];
      let how = null;
      if (evo) how = evo.min_level || (evo.pokemon_v2_item && STONES[evo.pokemon_v2_item.name]) || evo.pokemon_v2_evolutiontrigger.name;
      const name = (s.pokemon_v2_pokemonspeciesnames[0] || {}).name || s.name;
      out[s.id] = [name, types, stats, s.generation_id, s.is_mythical ? 2 : s.is_legendary ? 1 : 0, s.evolves_from_species_id, s.capture_rate, how];
    }
  }
  const lines = Object.entries(out).map(([id, v]) => `  ${id}: ${JSON.stringify(v)},`).join('\n');
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'dex.js'),
    `// Generado por tools/fetch-dex.js con datos de PokeAPI (https://pokeapi.co). No editar a mano.\n` +
    `// [nombre, tipos, [ps, atq, def, atqEsp, defEsp, vel], generación, 0 normal/1 legendario/2 singular,\n` +
    `//  evoluciona de, ratio de captura, cómo se obtiene (nivel, piedra u otro)]\n` +
    `(function (root) {\n  const DEX = {\n${lines}\n  };\n` +
    `  if (typeof module !== 'undefined' && module.exports) module.exports = DEX;\n  else root.DEX = DEX;\n})(this);\n`);
  console.log(`${Object.keys(out).length} especies con sprites`);
})().catch(e => { console.error(e); process.exit(1); });
