// Nombres oficiales de PokeAPI por idioma: Pokémon, movimientos, tipos, objetos, naturalezas y
// estadísticas. Genera public/js/lang/names-<idioma>.js (lo carga i18n.js junto al diccionario).
//   node tools/fetch-names.js zh fr de ...
// Nuestros movimientos, tipos y naturalezas se identifican por su nombre en inglés (lang/en.js);
// los objetos de la tienda, por la tabla ITEMS de aquí abajo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
// Nuestro código de idioma -> id de idioma en PokeAPI
const POKEAPI_LANG = { ja: 11, ko: 3, 'zh-hant': 4, fr: 5, de: 6, it: 8, en: 9, zh: 12, 'pt-br': 13 };
const ITEMS = {
  pokeball: 'poke-ball', superball: 'great-ball', ultraball: 'ultra-ball', caramelo: 'rare-candy', maspsps: 'hp-up',
  proteina: 'protein', hierro: 'iron', carburante: 'carbos', agua: 'water-stone', trueno: 'thunder-stone', fuego: 'fire-stone',
  hoja: 'leaf-stone', lunar: 'moon-stone', sol: 'sun-stone', hielo: 'ice-stone', noche: 'dusk-stone', alba: 'dawn-stone', dia: 'shiny-stone',
};
const STATS = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' };

// CSV con comillas
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// Descarga a una carpeta temporal propia (son datos externos: solo se leen como texto)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeapi-csv-'));
async function csv(name) {
  const file = path.join(tmp, name + '.csv');
  if (!fs.existsSync(file)) {
    const res = await fetch(BASE + name + '.csv');
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

// Tablas del diccionario inglés (para casar nuestros ids con los de PokeAPI)
function englishTables() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lang', 'en.js'), 'utf8').replace(/export default/, 'module.exports =');
  const mod = { exports: {} };
  new Function('module', src)(mod);
  return mod.exports;
}

(async () => {
  const langs = process.argv.slice(2);
  if (!langs.length || langs.some(l => !POKEAPI_LANG[l])) {
    console.error(`Uso: node tools/fetch-names.js <${Object.keys(POKEAPI_LANG).join('|')}> ...`);
    process.exit(1);
  }
  const en = englishTables();
  const DEX = require('../public/dex.js');
  const [species, moveNames, typeNames, types, itemNames, items, natureNames, natures, statNames, stats] = await Promise.all(
    ['pokemon_species_names', 'move_names', 'type_names', 'types', 'item_names', 'items', 'nature_names', 'natures', 'stat_names', 'stats'].map(csv));
  const EN = POKEAPI_LANG.en;
  const byLang = (rows, idKey, lang) => new Map(rows.filter(r => +r.local_language_id === lang).map(r => [r[idKey], r.name]));
  const idOf = (rows, ident) => (rows.find(r => r.identifier === ident) || {}).id;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const l of langs) {
    const lang = POKEAPI_LANG[l];
    const out = { species: {}, moves: {}, types: {}, shop: {}, natures: {}, stats: {} };
    const sp = byLang(species, 'pokemon_species_id', lang);
    for (const dex of Object.keys(DEX)) if (sp.get(dex)) out.species[dex] = sp.get(dex);
    // Movimientos: por su nombre en inglés
    const moveEn = new Map([...byLang(moveNames, 'move_id', EN)].map(([id, name]) => [norm(name), id]));
    const moveL = byLang(moveNames, 'move_id', lang);
    for (const [k, name] of Object.entries(en.moves)) { const id = moveEn.get(norm(name)); if (id && moveL.get(id)) out.moves[k] = moveL.get(id); }
    const typeL = byLang(typeNames, 'type_id', lang);
    for (const [k, name] of Object.entries(en.types)) { const id = idOf(types, name.toLowerCase()); if (id && typeL.get(id)) out.types[k] = typeL.get(id); }
    const itemL = byLang(itemNames, 'item_id', lang);
    for (const [k, ident] of Object.entries(ITEMS)) { const id = idOf(items, ident); if (id && itemL.get(id)) out.shop[k] = itemL.get(id); }
    const natL = byLang(natureNames, 'nature_id', lang);
    for (const [k, name] of Object.entries(en.natures)) { const id = idOf(natures, name.toLowerCase()); if (id && natL.get(id)) out.natures[k] = natL.get(id); }
    const statL = byLang(statNames, 'stat_id', lang);
    for (const [k, ident] of Object.entries(STATS)) { const id = idOf(stats, ident); if (id && statL.get(id)) out.stats[k] = statL.get(id); }

    const file = path.join(__dirname, '..', 'public', 'js', 'lang', `names-${l}.js`);
    fs.writeFileSync(file, `// Generado por tools/fetch-names.js con datos de PokeAPI (https://pokeapi.co). No editar a mano.\nexport default ${JSON.stringify(out)};\n`);
    const n = k => Object.keys(out[k]).length;
    console.log(`${l}: ${n('species')} Pokémon, ${n('moves')}/${Object.keys(en.moves).length} movimientos, ${n('types')} tipos, ${n('shop')} objetos, ${n('natures')} naturalezas, ${n('stats')} estadísticas -> ${path.relative(process.cwd(), file)}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
