// Idiomas. La clave de cada texto es el propio texto en español: t('Volver') devuelve la traducción
// del idioma elegido o, si aún no está traducida, el español. Así se puede ir traduciendo poco a poco
// sin romper nada. Variables con {nombre}: t('Nv.{n}', { n: 5 }).
// Cada idioma tiene su diccionario (lang/<idioma>.js) y, si los hay, los nombres oficiales de PokeAPI
// (lang/names-<idioma>.js, de tools/fetch-names.js); solo se descargan cuando se elige ese idioma.
// Los nombres de los datos (Pokémon, tipos, movimientos, objetos, naturalezas, regiones) se ponen
// sobre Data al elegir idioma (applyData). `node tools/i18n-check.js` lista lo que falta.
import { storage } from './net.js';

// En el orden del selector: inglés y español, y después de más a menos hablado
export const LANGS = { en: 'English', es: 'Español', zh: '中文（简体）', fr: 'Français', de: 'Deutsch', ja: '日本語' };
// Código corto que se enseña junto a cada idioma
export const LANG_CODES = { en: 'EN', es: 'ES', zh: 'CN', fr: 'FR', de: 'DE', ja: 'JP' };
const LOCALES = { es: 'es-ES', en: 'en-GB', zh: 'zh-CN', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP' };
const KEY = 'arena.lang';
// Idiomas con nombres oficiales de PokeAPI (lang/names-<idioma>.js); en inglés y español ya son los de los datos
const HAS_NAMES = new Set(['en', 'zh', 'fr', 'de', 'ja', 'ko', 'it']);
const DICTS = {}, NAMES = {};

// Por defecto, inglés; si el jugador ha elegido otro idioma, ese
const DEFAULT = 'en';
const initial = () => { const saved = storage.get(KEY); return LANGS[saved] ? saved : DEFAULT; };

// El español es el original: no hay nada que cargar
async function load(l) {
  if (l === 'es' || DICTS[l]) return;
  const [dict, names] = await Promise.all([
    import(`./lang/${l}.js`),
    HAS_NAMES.has(l) ? import(`./lang/names-${l}.js`) : { default: {} },
  ]);
  DICTS[l] = dict.default;
  NAMES[l] = names.default;
}

let lang = initial();
try { await load(lang); } catch (e) { console.warn('idioma', lang, e); lang = 'es'; }

// Textos que se han pedido en este idioma y no tienen traducción (para ir completando)
export const missing = new Set();
window.__i18nMissing = missing;

export const getLang = () => lang;
export const locale = () => LOCALES[lang] || LOCALES[DEFAULT];

// Busca la traducción: frase exacta o, para textos con huecos que llegan ya montados (mensajes del
// servidor, nombres de entrenador, títulos de temporada), un patrón del diccionario
function lookup(s) {
  const d = DICTS[lang];
  if (!d || typeof s !== 'string') return s;
  if (d.text[s] !== undefined) return d.text[s];
  if (DATA_TEXT.has(s)) return DATA_TEXT.get(s);
  // «Pikachu salvaje» (nombre del rival que manda el servidor): con el nombre del Pokémon traducido
  const wild = /^(.+) salvaje$/.exec(s);
  if (wild && SPECIES_BY_NAME[wild[1]]) return (d.text['{m} salvaje'] || '{m} salvaje').replace('{m}', Data.SPECIES[SPECIES_BY_NAME[wild[1]]].name);
  for (const [re, rep] of d.patterns || []) if (re.test(s)) return s.replace(re, rep);
  missing.add(s);
  return s;
}

export function t(s, vars) {
  const out = lookup(s);
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : out;
}

// Mensajes que manda el servidor (errores, avisos, nombres): sin variables
export const tServer = lookup;

// Nombres que vienen en los datos: se guarda el original y se sustituye por el del idioma
const original = {
  species: {}, moves: {}, shop: {}, natures: {}, regions: {},
  types: { ...Data.TYPE_LABEL }, vit: { ...Data.VIT_STATS }, stat6: { ...Data.STAT6 },
};
for (const [k, s] of Object.entries(Data.SPECIES)) original.species[k] = s.name;
for (const [k, m] of Object.entries(Data.MOVES)) original.moves[k] = m.name;
for (const i of Data.SHOP) original.shop[i.id] = { name: i.name, desc: i.desc };
for (const [k, n] of Object.entries(Data.NATURES)) original.natures[k] = n[0];
for (const [k, r] of Object.entries(Data.REGIONS)) original.regions[k] = r.name;
const SPECIES_BY_NAME = Object.fromEntries(Object.entries(original.species).map(([dex, name]) => [name, dex]));
// Datos del mapa: rutas (y sus partes), gimnasios, medallas y líderes de cada nodo
const nodes = new Map();
for (const R of Object.values(Data.REGIONS)) for (const n of R.nodes) nodes.set(n, { name: n.name, leader: n.leader, badge: n.badge, parts: n.parts ? [...n.parts] : null });
// Original en español -> traducción de los nombres de los datos (lugares, gimnasios, medallas, líderes),
// para t() (p. ej. las ciudades del mapa) y para lo que manda el servidor ya montado (el nombre del líder)
const DATA_TEXT = new Map();

export function applyData() {
  const d = DICTS[lang] || {}, n = NAMES[lang] || {};
  // Primero lo del diccionario (corregido a mano), luego el nombre oficial y si no, el original
  const pick = (table, k, fallback, namesTable = table) => (d[table] && d[table][k]) || (n[namesTable] && n[namesTable][k]) || fallback;
  for (const [k, name] of Object.entries(original.species)) Data.SPECIES[k].name = pick('species', k, name);
  for (const k of Object.keys(original.types)) Data.TYPE_LABEL[k] = pick('types', k, original.types[k]);
  for (const [k, name] of Object.entries(original.moves)) Data.MOVES[k].name = pick('moves', k, name);
  for (const i of Data.SHOP) {
    const o = original.shop[i.id];
    const tr = d.shop && d.shop[i.id];
    i.name = i.dex ? Data.SPECIES[i.dex].name : (tr && tr[0]) || (n.shop && n.shop[i.id]) || o.name;
    i.desc = (tr && tr[1]) || (i.dex ? t('Pokémon de la tienda (nivel {n})', { n: i.level }) : o.desc);
  }
  for (const [k, nat] of Object.entries(Data.NATURES)) nat[0] = pick('natures', k, original.natures[k]);
  for (const k of Object.keys(original.vit)) Data.VIT_STATS[k] = pick('vit', k, original.vit[k], 'stats');
  for (const k of Object.keys(original.stat6)) Data.STAT6[k] = pick('stat6', k, original.stat6[k], 'stats');
  for (const [k, name] of Object.entries(original.regions)) Data.REGIONS[k].name = pick('regions', k, name);
  applyMapData(d, n);
  document.documentElement.lang = lang;
}

// Lugares: el nombre del diccionario, el oficial de PokeAPI, o «Ruta N» con la plantilla del idioma
function place(es, d, n) {
  if (d.places && d.places[es]) return d.places[es];
  if (n.places && n.places[es]) return n.places[es];
  const route = /^Ruta (\d+)$/.exec(es);
  return route && d.route ? d.route(route[1]) : es;
}

function applyMapData(d, n) {
  DATA_TEXT.clear();
  const set = (es, val) => { if (val && val !== es) DATA_TEXT.set(es, val); return val || es; };
  const placeNames = new Set([...Object.keys(n.places || {}), ...Object.keys(d.places || {})]);
  for (const es of placeNames) set(es, place(es, d, n));
  // «Gimnasio Plateada» -> su ciudad («Ciudad Plateada») -> nombre del gimnasio en el idioma
  const cityOf = gym => [...placeNames].find(k => /^(Ciudad|Pueblo|Isla) /.test(k) && k.endsWith(' ' + gym.replace(/^Gimnasio /, '')));
  for (const [node, o] of nodes) {
    if (node.kind === 'route') node.name = set(o.name, (o.parts || [o.name]).map(p => set(p, place(p, d, n))).join(' · '));
    else if (node.kind === 'gym') { const city = cityOf(o.name); node.name = set(o.name, city && d.gym ? d.gym(place(city, d, n)) : null); }
    else node.name = t(o.name);
    if (o.leader) node.leader = set(o.leader, d.leaders && d.leaders[node.id]);
    if (o.badge) node.badge = set(o.badge, d.badges && d.badges[node.id]);
  }
}

// Cambia de idioma (descarga su diccionario si hace falta). Devuelve si ha cambiado.
export async function setLang(l) {
  if (!LANGS[l] || l === lang) return false;
  await load(l);
  lang = l;
  storage.set(KEY, l);
  missing.clear();
  applyData();
  return true;
}

applyData();
