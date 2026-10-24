// Mochila: todos los objetos que tienes, por bolsillos, y para usarlos eliges el Pokémon (como en los
// juegos). Muestra a quién le sirve cada objeto y por qué no a los demás; el servidor decide al final.
import { portrait } from './sprites.js';
import { t } from './i18n.js';
import { item as itemImg } from './pixicons.js';

const { SHOP, SPECIES } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const BALLS = ['pokeball', 'superball', 'ultraball'];
const POCKETS = [
  ['balls', 'Poké Balls', i => BALLS.includes(i.id)],
  ['meds', 'Objetos', i => !i.dex && !i.vit && !i.stone && !BALLS.includes(i.id)],
  ['vit', 'Vitaminas', i => i.vit],
  ['stones', 'Piedras evolutivas', i => i.stone],
];
const evosOf = s => !s.evo ? [] : Array.isArray(s.evo[0]) ? s.evo : [s.evo];

// ¿Se puede usar este objeto en este Pokémon? { ok, why }
function usable(p, item, mon) {
  if (item.id === 'caramelo') {
    const cap = Data.levelCap(p, mon.region);
    return mon.level >= cap ? { ok: false, why: t('Tope Nv.{n}', { n: cap }) } : { ok: true, why: t('Nv.{a} → {b}', { a: mon.level, b: mon.level + 1 }) };
  }
  if (item.stone) {
    const to = evosOf(SPECIES[mon.dex]).find(([, c]) => c === item.id);
    return to && SPECIES[to[0]] ? { ok: true, why: '→ ' + SPECIES[to[0]].name } : { ok: false, why: t('No tiene efecto') };
  }
  if (item.vit) {
    const ev = mon.ev || {}, tot = Data.evTotal(ev);
    if ((ev[item.vit] || 0) >= Data.EV_MAX) return { ok: false, why: t('EV al máximo') };
    if (tot >= Data.EV_TOTAL) return { ok: false, why: t('EV totales al máximo') };
    return { ok: true, why: `EV ${ev[item.vit] || 0} → ${Math.min(Data.EV_MAX, (ev[item.vit] || 0) + Data.EV_VIT)}` };
  }
  return { ok: false, why: '' };
}

export const bagViews = {
  view_bag() {
    const p = this.profile;
    const wrap = el('div', 'bagview');
    wrap.append(this.topbar(t('Mochila'), this.returnTo || 'menu'));
    const body = el('div', 'bag-body');
    const list = el('div', 'panel bag-list scroll');
    const detail = el('div', 'panel bag-detail');
    const owned = SHOP.filter(i => !i.dex && (p.items[i.id] || 0) > 0);
    let sel = this.bagSel && owned.find(i => i.id === this.bagSel) || owned[0] || null;

    if (!owned.length) {
      list.append(el('p', 'small', t('La mochila está vacía. Compra objetos en la Tienda o consíguelos venciendo a los líderes.')));
      const go = el('button', 'primary', t('Ir a la Tienda'));
      go.onclick = () => this.openFrom('shop');
      list.append(go);
    }
    for (const [, title, test] of POCKETS) {
      const items = owned.filter(test);
      if (!items.length) continue;
      list.append(el('h4', 'bag-pocket', t(title)));
      for (const it of items) {
        const row = el('button', 'bag-item' + (sel && sel.id === it.id ? ' sel' : ''), `${itemImg(it.id, 36)}<b>${it.name}</b><span class="qty">×${p.items[it.id]}</span>`);
        row.onclick = () => { this.bagSel = it.id; this.show('bag', true); };
        list.append(row);
      }
    }

    if (sel) {
      detail.append(el('div', 'bag-head', `${itemImg(sel.id, 64)}<div><h3>${sel.name}</h3><p class="small">${sel.desc}</p><p class="qty">${t('Tienes: {n}', { n: p.items[sel.id] })}</p></div>`));
      if (BALLS.includes(sel.id)) {
        detail.append(el('p', 'bag-hint', t('Las Poké Balls se usan en combate contra Pokémon salvajes: pulsa <kbd>F</kbd> para lanzarla y <kbd>R</kbd> para cambiar de Ball.')));
      } else {
        detail.append(el('h4', 'bag-pocket', t('¿En qué Pokémon?')));
        const grid = el('div', 'bag-mons');
        const regions = Data.REGION_IDS.filter(r => p.mons.some(m => (m.region || 'kanto') === r));
        for (const rid of regions) {
          const mons = p.mons.filter(m => (m.region || 'kanto') === rid);
          if (regions.length > 1) grid.append(el('small', 'bag-region', Data.REGIONS[rid].name));
          for (const m of mons) {
            const u = usable(p, sel, m);
            const b = el('button', 'bag-mon' + (u.ok ? '' : ' no'));
            b.append(portrait(m.dex, 48, { shiny: m.shiny }));
            b.append(el('span', '', `<b>${SPECIES[m.dex].name}</b><small>${t('Nv.{n}', { n: m.level })} · ${u.why}</small>`));
            b.disabled = !u.ok;
            b.onclick = () => { this.bagSel = sel.id; this.net.send({ t: 'story', a: 'use', item: sel.id, uid: m.uid }); };
            grid.append(b);
          }
        }
        detail.append(grid);
      }
    } else detail.append(el('p', 'small', t('Elige un objeto de la lista.')));

    body.append(list, detail);
    wrap.append(body);
    this.root.append(wrap);
  },
};
