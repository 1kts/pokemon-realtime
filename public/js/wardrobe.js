// Lo que se puede llevar, en un solo sitio: las pestañas del editor del avatar (marcos, glows y efectos) y el Vestuario
// de cada Pokémon (skins y partículas) salen de wearPanel y de las listas de data.js. Un cosmético nuevo solo se añade a
// su lista: sale en su pantalla, apagado para quien no lo tiene, con su procedencia y con el interruptor
// «Solo los míos / Todos», que es el mismo en todas y se recuerda
import { storage } from './net.js';
import { t } from './i18n.js';
import { portrait } from './sprites.js';
import { FRAME_LABEL_EXTRA, achName } from './achievements.js';
import { SKIN_LABEL, FRAME_SOON_LABEL, applySkin, auraName } from './frames.js';
import { effectName } from './missions.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const KEY = 'arena.wearFilter';
const onlyMine = () => storage.get(KEY) === 'mine';
const LEAGUE_LABEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante', maestro: 'Maestro' };
const FRAME_LABEL = { ...LEAGUE_LABEL, ...FRAME_LABEL_EXTRA, ...FRAME_SOON_LABEL };
export const frameLabel = f => f.startsWith('tipo-') ? t('Marco {type}', { type: Data.TYPE_LABEL[f.slice(5)] }) : t(FRAME_LABEL[f] || f);
// De dónde sale: un logro, la liga, Lucky Spin…; lo que aún no tiene fuente, «Próximamente»
const fromAch = (key, id) => { const a = Data.ACHIEVEMENTS.find(x => x.reward && x.reward[key] === id); return a && t('Reto: {name}', { name: achName(a) }); };
const frameSource = f => fromAch('frame', f) || (LEAGUE_LABEL[f] ? t('Liga {name}', { name: t(LEAGUE_LABEL[f]) }) : t('Próximamente'));
const auraSource = g => g.startsWith('tipo-') ? t('En Lucky Spin') : fromAch('aura', g) || (g === 'prisma' ? t('Racha de 50 en la Torre con su línea') : t('Próximamente'));
const effectSource = fx => Data.EFFECTS_SOON.includes(fx) ? t('Próximamente') : t('En Lucky Spin');
const skinSource = id => ({ oro: t('500 victorias con su línea'), holo: t('25 victorias online con su línea'), galaxia: t('Racha de 50 en la Torre con su línea'), elemental: t('En Lucky Spin') })[id] || t('Próximamente');

// Las opciones de cada clase: { label, sel, hint (si no la tienes, de dónde sale), sub, paint, look (lo que se manda) }
const CATALOG = {
  frame(ui) {
    const p = ui.profile, own = (p.cosmetics && p.cosmetics.frames) || [];
    return [{ label: t('Ninguno'), sel: !p.frame, paint: () => ui.avatar(56, false, null), look: { frame: null } },
      ...Data.frameCatalog(own).map(f => ({ label: frameLabel(f), sel: p.frame === f, hint: own.includes(f) ? null : frameSource(f), paint: () => ui.avatar(56, false, f), look: { frame: f } }))];
  },
  aura(ui) {
    const p = ui.profile, own = (p.cosmetics && p.cosmetics.auras) || [];
    return [{ label: t('Ninguno'), sel: !p.aura, paint: () => ui.avatar(56, false, undefined, null), look: { aura: null } },
      ...Data.auraCatalog(own).map(g => ({ label: auraName(g, t), sel: p.aura === g, hint: own.includes(g) ? null : auraSource(g), paint: () => ui.avatar(56, false, undefined, g), look: { aura: g } }))];
  },
  effect(ui) {
    const p = ui.profile, own = (p.cosmetics && p.cosmetics.effects) || [];
    return [{ label: t('Ninguno'), sel: !p.effect, paint: () => ui.avatar(56, false, undefined, undefined, null), look: { effect: null } },
      ...Data.EFFECTS.map(fx => ({ label: effectName(fx), sel: p.effect === fx, hint: own.includes(fx) ? null : effectSource(fx), paint: () => ui.avatar(56, false, undefined, undefined, fx), look: { effect: fx } }))];
  },
  skin(ui, mon) {
    const p = ui.profile, line = Data.lineOf(mon.dex), now = Data.skinOf(p, mon.dex), pic = () => portrait(mon.dex, 84, { shiny: Data.looksShiny(mon) });
    return [{ label: t('Sin skin'), sel: !now, sub: now ? t('Quitársela') : t('Puesta'), paint: pic, look: { skin: { dex: line, skin: null } } },
      ...Data.SKINS.map(id => ({ label: t(SKIN_LABEL[id]), sel: now === id, hint: Data.hasSkin(p, mon.dex, id) ? null : skinSource(id), sub: now === id ? t('Puesta') : t('Ponérsela'),
        paint: () => applySkin(pic(), id, line), look: { skin: { dex: line, skin: id } } }))];
  },
  parts(ui, mon) {
    const p = ui.profile, line = Data.lineOf(mon.dex), on = !!Data.particlesOf(p, mon.dex), own = Data.SPECIES[line].types[0], pic = () => portrait(mon.dex, 84, { shiny: Data.looksShiny(mon) });
    const name = type => t('Partículas de {type}', { type: Data.TYPE_LABEL[type] });
    return [{ label: t('Sin partículas'), sel: !on, sub: on ? t('Quitarlas') : t('Equipado'), paint: pic, look: { particles: { dex: line, on: false } } },
      { label: name(own), sel: on, hint: Data.hasParticles(p, mon.dex) ? null : t('En Lucky Spin'), sub: on ? t('Puestas') : t('Ponérselas'), paint: () => applySkin(pic(), null, line, own), look: { particles: { dex: line, on: true } } },
      ...Data.TYPE_NAMES.filter(x => x !== own).map(x => ({ label: name(x), hint: t('Próximamente'), paint: () => applySkin(pic(), null, line, x) }))];
  },
};

// El interruptor: igual en todas partes; repaint vuelve a pintar la pantalla
function ownFilter(repaint) {
  const box = el('div', 'own-filter');
  box.setAttribute('role', 'group');
  for (const [mine, label] of [[true, t('Solo los míos')], [false, t('Todos')]]) {
    const b = el('button', onlyMine() === mine ? 'sel' : '', label);
    b.setAttribute('aria-pressed', String(onlyMine() === mine));
    b.onclick = () => { storage.set(KEY, mine ? 'mine' : 'all'); repaint(); };
    box.append(b);
  }
  return box;
}

// Una opción, en el formato de su pantalla (sheet: las tarjetas del Vestuario)
function option(ui, it, kind, sheet) {
  const b = el('button', (sheet ? `ms-wear ${kind}` : 'frame-opt') + (it.sel ? ' sel' : '') + (it.hint ? ' locked' : ''));
  b.append(it.paint());
  if (sheet) b.append(el('b', '', it.label), el('small', '', it.hint || it.sub));
  else b.append(el('small', '', it.label));
  if (it.hint) {
    if (!sheet) b.append(el('em', '', it.hint));
    b.disabled = true;
    b.title = `${it.label} · ${it.hint}`;
  } else b.onclick = () => ui.net.send({ t: 'look', ...it.look });
  return b;
}

// sections: [{ kind, title }]; mon: el Pokémon, en el Vestuario
export function wearPanel(body, ui, sections, repaint, mon) {
  body.append(ownFilter(repaint));
  for (const { kind, title } of sections) {
    if (title) body.append(el('h4', '', title));
    const grid = el('div', mon ? 'ms-wardrobe' : 'frame-grid');
    for (const it of CATALOG[kind](ui, mon)) if (!(onlyMine() && it.hint)) grid.append(option(ui, it, kind, !!mon));
    body.append(grid);
  }
}
