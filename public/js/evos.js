// Evoluciones de una especie, como fichas: el Pokémon en gris (aún no lo tienes) con su nombre y cómo se
// consigue: el nivel, o la imagen y el nombre del objeto (piedras y objetos de intercambio, siempre a la vista).
// Se usan en la ficha del Pokémon, en sus estadísticas, en la Pokédex y en las tarjetas del equipo.
import { monIcon } from './sprites.js';
import { item as itemImg } from './pixicons.js';
import { t } from './i18n.js';

const { SPECIES, SHOP } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const evosOf = s => !s || !s.evo ? [] : Array.isArray(s.evo[0]) ? s.evo : [s.evo];

// Cómo evoluciona: «Nv.30» o el objeto con su imagen
export function evoHow(c) {
  if (typeof c === 'number') return t('Nv.{n}', { n: c });
  const it = SHOP.find(i => i.id === c);
  return `${itemImg(c, 24, 'evo-item')}${it ? it.name : c}`;
}

// Bloque con el título «Evoluciones» y una ficha por evolución; null si no evoluciona.
// size: tamaño del sprite; compact: sin título (tarjetas del equipo); big: fichas grandes con el título
// como encabezado de sección (ficha del Pokémon)
export function evoChips(dex, { size = 48, compact = false, big = false } = {}) {
  const list = evosOf(SPECIES[dex]).filter(([to]) => SPECIES[to]);
  if (!list.length) return null;
  const box = el('div', 'evo-chips' + (compact ? ' compact' : '') + (big ? ' big' : ''));
  if (big) box.append(el('h4', 'evo-title', t('Evoluciones')));
  else if (!compact) box.append(el('small', 'evo-title', t('Evoluciones')));
  for (const [to, c] of list) {
    const chip = el('span', 'evo-chip');
    const mon = el('span', 'evo-mon');
    mon.append(monIcon(to, size));
    chip.append(mon, el('span', 'evo-txt', `<b>${SPECIES[to].name}</b><small>${evoHow(c)}</small>`));
    box.append(chip);
  }
  return box;
}
