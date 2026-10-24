// Idiomas. La clave de cada texto es el propio texto en español: t('Volver') devuelve la traducción
// del idioma elegido o, si aún no está traducida, el español. Así se puede ir traduciendo poco a poco
// sin romper nada. Variables con {nombre}: t('Nv.{n}', { n: 5 }). Los nombres de los datos (tipos,
// movimientos, objetos, naturalezas) se traducen sobre Data al elegir idioma (applyData).
// `node tools/i18n-check.js` lista lo que falta por traducir en cada idioma.
import { storage } from './net.js';
import en from './lang/en.js';

export const LANGS = { es: 'Español', en: 'English' };
const DICTS = { en };
const LOCALES = { es: 'es-ES', en: 'en-GB' };
const KEY = 'arena.lang';

// Por defecto, inglés; si el jugador ha elegido otro idioma, ese
const DEFAULT = 'en';
const initial = () => { const saved = storage.get(KEY); return LANGS[saved] ? saved : DEFAULT; };

let lang = initial();
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

// Nombres que vienen en los datos: se guarda el original (español) y se sustituye por el del idioma
const original = { types: { ...Data.TYPE_LABEL }, moves: {}, shop: {}, natures: {}, vit: { ...Data.VIT_STATS }, stat6: { ...Data.STAT6 } };
for (const [k, m] of Object.entries(Data.MOVES)) original.moves[k] = m.name;
for (const i of Data.SHOP) original.shop[i.id] = { name: i.name, desc: i.desc };
for (const [k, n] of Object.entries(Data.NATURES)) original.natures[k] = n[0];

export function applyData() {
  const d = DICTS[lang] || {};
  const pick = (table, k, fallback) => (d[table] && d[table][k]) || fallback;
  for (const k of Object.keys(original.types)) Data.TYPE_LABEL[k] = pick('types', k, original.types[k]);
  for (const [k, name] of Object.entries(original.moves)) Data.MOVES[k].name = pick('moves', k, name);
  for (const i of Data.SHOP) {
    const o = original.shop[i.id];
    const tr = d.shop && d.shop[i.id];
    i.name = (tr && tr[0]) || o.name;
    i.desc = (tr && tr[1]) || (i.dex ? t('Pokémon de la tienda (nivel {n})', { n: i.level }) : o.desc);
  }
  for (const [k, n] of Object.entries(Data.NATURES)) n[0] = pick('natures', k, original.natures[k]);
  for (const k of Object.keys(original.vit)) Data.VIT_STATS[k] = pick('vit', k, original.vit[k]);
  for (const k of Object.keys(original.stat6)) Data.STAT6[k] = pick('stat6', k, original.stat6[k]);
  document.documentElement.lang = lang;
}

export function setLang(l) {
  if (!LANGS[l] || l === lang) return false;
  lang = l;
  storage.set(KEY, l);
  missing.clear();
  applyData();
  return true;
}

applyData();
