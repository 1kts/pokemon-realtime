// Tesoros: las ruletas de premios que se pagan con gemas (ver Data.treasures y server/treasure.js).
// Pestaña por ruleta (una por tipo, cambian cada 2 semanas), la rueda con sus 10 premios y el botón de
// tirar en el centro, y al lado el premio elegido y las probabilidades de la próxima tirada. Al tirar,
// la rueda recorre los premios que faltan y se para en el que ha salido; después, la animación de premio.
import { t } from './i18n.js';
import { portrait } from './sprites.js';
import { icon, item as itemImg, typeIcon } from './pixicons.js';
import { applySkin, applyGlow, glowName } from './frames.js';
import { portraitArt, avatarName } from './missions.js';

const { SPECIES, TYPE_LABEL, TYPE_COLOR, RARITY, SPIN_COST } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const pct = p => (p >= 0.1 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + ' %';
const gemsHtml = n => `<span class="gem-ico">${icon('gem', 16)}</span>${Number(n).toLocaleString()}`;

// Nombre del premio
export function prizeName(x) {
  if (x.kind === 'skin') return t('Skin Elemental · línea de {m}', { m: SPECIES[x.dex].name });
  if (x.kind === 'glow') return glowName(x.glow, t);
  if (x.kind === 'portrait') return avatarName(x.id);
  if (x.kind === 'coins') return t('{n} de dinero', { n: x.coins.toLocaleString() });
  if (x.kind === 'item') return `${(Data.SHOP.find(i => i.id === x.item) || { name: x.item }).name} ×${x.qty}`;
  return x.id;
}

export const treasureViews = {
  // Gemas de las ruletas que se pueden gastar ya (para avisos en el menú)
  treasureReady() {
    const p = this.profile, got = (p.treasure && p.treasure.got) || {};
    return Data.treasures().some(r => (got[r.id] || []).length < r.prizes.length && (p.gems || 0) >= SPIN_COST[(got[r.id] || []).length]);
  },

  openTreasure() {
    if (this.view !== 'treasure') this.tzBack = this.view;
    this.show('treasure');
  },

  // Dibujo del premio (el retrato con su efecto, el Pokémon con su skin o el glow sobre tu Pokémon…)
  prizeArt(x, size) {
    const box = el('span', 'tz-art');
    if (x.kind === 'skin') box.append(applySkin(portrait(x.dex, size), 'elemental', x.dex));
    else if (x.kind === 'glow') box.append(applyGlow(portrait(this.avatarDex().dex, size), x.glow));
    else if (x.kind === 'portrait') box.innerHTML = portraitArt(x.dex, x.fx, Math.round(size * 0.9));
    else if (x.kind === 'coins') box.innerHTML = icon('coin', Math.round(size * 0.6));
    else if (x.kind === 'item') box.innerHTML = itemImg(x.item, Math.round(size * 0.7));
    return box;
  },

  view_treasure() {
    const p = this.profile;
    const got = (p.treasure && p.treasure.got) || {};
    const list = Data.treasures(p.treasure ? p.treasure.period : undefined);
    const cur = list.find(r => r.id === this.tzSel) || list[0];
    this.tzSel = cur.id;
    const mine = got[cur.id] || [];
    const odds = Data.treasureOdds(cur, mine);
    const wrap = el('div', 'treasure');
    wrap.style.setProperty('--tc', TYPE_COLOR[cur.type]);
    wrap.append(this.topbar(t('Tesoros'), this.tzBack || 'menu'));

    // Cabecera: tus gemas, cuándo cambian y de dónde salen
    const days = Math.max(1, Math.ceil((Data.treasureEnds() - Date.now()) / 86400e3));
    const head = el('div', 'tz-head panel', `<div class="tz-gems">${gemsHtml(p.gems || 0)}<small>${t('gemas')}</small></div>
      <div class="tz-when"><b>${days > 1 ? t('Cambian en {n} días', { n: days }) : t('Cambian mañana')}</b><small>${t('Lo que consigas se queda; lo que falte de estas ruletas se va.')}</small></div>`);
    const how = el('button', 'tz-how', t('¿Cómo se consiguen gemas?'));
    how.onclick = () => this.toast(t('Misiones y cofres, la primera victoria online del día, líderes y Alto Mando, cada 7 de la Torre, subir de liga y los salvajes raros o shiny.'), '', 6000);
    head.append(how);
    wrap.append(head);

    // Pestañas: una ruleta por tipo
    const tabs = el('div', 'tz-tabs');
    for (const r of list) {
      const n = (got[r.id] || []).length;
      const b = el('button', 'tz-tab' + (r === cur ? ' sel' : '') + (n >= r.prizes.length ? ' done' : ''), `${typeIcon(r.type, 22)}<span>${t('Ruleta {type}', { type: TYPE_LABEL[r.type] })}</span><small>${n}/${r.prizes.length}</small>`);
      b.style.setProperty('--tc', TYPE_COLOR[r.type]);
      b.disabled = !!this.tzSpin;
      b.onclick = () => { this.tzSel = r.id; this.tzPick = null; this.show('treasure'); };
      tabs.append(b);
    }
    wrap.append(tabs);

    const body = el('div', 'tz-body');
    // La rueda: 10 premios en círculo y el botón de tirar en el centro
    const wheel = el('div', 'tz-wheel');
    const pick = cur.prizes.find(x => x.id === this.tzPick) || null;
    cur.prizes.forEach((x, i) => {
      const a = (i / cur.prizes.length) * Math.PI * 2 - Math.PI / 2;
      const has = mine.includes(x.id);
      const b = el('button', `tz-prize r-${x.rarity}${has ? ' got' : ''}${pick === x ? ' sel' : ''}`);
      b.style.left = (50 + Math.cos(a) * 40) + '%';
      b.style.top = (50 + Math.sin(a) * 40) + '%';
      b.style.setProperty('--rc', RARITY[x.rarity].color);
      b.dataset.id = x.id;
      b.append(this.prizeArt(x, 56));
      b.append(el('i', 'tz-rar', t(RARITY[x.rarity].name)));
      if (has) b.append(el('i', 'tz-check', '✓'));
      b.title = prizeName(x);
      b.onclick = () => { this.tzPick = x.id; this.show('treasure'); };
      wheel.append(b);
    });
    const n = mine.length, cost = SPIN_COST[n], done = n >= cur.prizes.length;
    const center = el('div', 'tz-center');
    center.append(el('div', 'tz-count', `<small>${t('Conseguido')}</small><b>${n}/${cur.prizes.length}</b>`));
    center.append(el('div', 'tz-seg', cur.prizes.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')));
    if (done) center.append(el('div', 'tz-done', `<b>${t('¡Ruleta completa!')}</b><small>${t('Tienes todos sus premios.')}</small>`));
    else {
      const enough = (p.gems || 0) >= cost;
      center.append(el('div', 'tz-cost' + (enough ? '' : ' short'), `${gemsHtml(cost)}<small>${t('Tirada {n} de {max}', { n: n + 1, max: cur.prizes.length })}</small>`));
      const go = el('button', 'primary tz-go', this.tzSpin ? t('Girando…') : t('¡Tirar!'));
      go.disabled = !enough || !!this.tzSpin;
      go.onclick = () => { this.tzSpin = { id: cur.id }; go.disabled = true; go.textContent = t('Girando…'); this.net.send({ t: 'treasure', id: cur.id }); };
      center.append(go);
      const rest = SPIN_COST.slice(n).reduce((a, b) => a + b, 0);
      center.append(el('small', 'tz-hint' + (enough ? '' : ' short'), !enough ? t('Te faltan {n} gemas.', { n: cost - (p.gems || 0) })
        : n === cur.prizes.length - 1 ? t('La última tirada: el último premio es seguro.') : t('Completar la ruleta: {n} gemas más.', { n: rest })));
    }
    wheel.append(center);
    body.append(wheel);

    // Lateral: el premio elegido y las probabilidades
    const side = el('div', 'tz-side panel');
    if (pick) {
      const o = odds.find(x => x.prize === pick);
      const art = el('div', 'tz-pick-art');
      art.append(this.prizeArt(pick, 96));
      side.append(art);
      side.append(el('h3', '', prizeName(pick)));
      side.append(el('p', 'tz-pick-rar', `<b style="color:${RARITY[pick.rarity].color}">${t(RARITY[pick.rarity].name)}</b> · ${mine.includes(pick.id) ? t('Ya lo tienes') : t('{p} en la próxima tirada', { p: pct(o ? o.p : 0) })}`));
      side.append(el('p', 'small', {
        skin: t('La skin Elemental de la línea: el sprite con la paleta de su tipo, contorno brillante y partículas, en los menús y en combate.'),
        glow: t('Un contorno de luz alrededor del sprite que se suma a cualquier skin. Se pone a la línea que quieras en Colección.'),
        portrait: t('Un avatar con la cara del Pokémon de cerca y su efecto animado dentro de la burbuja.'),
        coins: t('Dinero para la Tienda.'), item: t('Para subir de nivel a tus Pokémon.'),
      }[pick.kind]));
    } else side.append(el('p', 'tz-cap small', t('Toca un premio para ver qué es.')));
    side.append(el('h4', '', t('Probabilidades de la próxima tirada')));
    const ol = el('div', 'tz-odds');
    for (const o of [...odds].sort((a, b) => b.p - a.p)) ol.append(el('div', 'tz-odd', `<i style="background:${RARITY[o.prize.rarity].color}"></i><span>${prizeName(o.prize)}</span><b>${pct(o.p)}</b>`));
    for (const x of cur.prizes.filter(x => mine.includes(x.id))) ol.append(el('div', 'tz-odd got', `<i></i><span>${prizeName(x)}</span><b>✓</b>`));
    side.append(ol);
    side.append(el('p', 'tz-note small', t('Cada tirada da un premio de los que faltan. Lo más común sale más; lo que consigues sale de la bolsa y los demás ganan probabilidad. La ruleta acaba en {n} tiradas como mucho, y en la última el premio que queda es seguro.', { n: cur.prizes.length })));
    body.append(side);
    wrap.append(body);
    this.root.append(wrap);
  },

  // La rueda recorre los premios que faltaban y frena hasta el que ha salido; luego, done()
  treasureSpin(r, done) {
    const wheel = this.root.querySelector('.tz-wheel');
    const cells = wheel ? [...wheel.querySelectorAll('.tz-prize:not(.got)')] : [];
    const target = cells.findIndex(c => c.dataset.id === r.treasure.prize);
    if (!cells.length || target < 0) return done();
    // Momento (ms desde el inicio) de cada paso: rápido al principio y frenando al final
    const steps = cells.length * 3 + target, at = [0];
    for (let i = 1; i <= steps; i++) { const k = (i - 1) / steps; at.push(at[i - 1] + 45 + 260 * k * k * k); }
    const end = at[steps] + 450, t0 = performance.now();
    let shown = -1;
    const frame = now => {
      const ms = now - t0;
      let i = shown < 0 ? 0 : shown;
      while (i < steps && at[i + 1] <= ms) i++;
      if (i !== shown) {
        cells.forEach(c => c.classList.remove('hot'));
        cells[i % cells.length].classList.add('hot');
        shown = i;
      }
      if (ms >= end) done(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
