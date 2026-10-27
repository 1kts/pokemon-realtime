// Tesoros: las ruletas de premios que se pagan con gemas (ver Data.treasures y server/treasure.js).
// Pestaña por ruleta (una por tipo, cambian cada 2 semanas), la rueda con sus 10 premios y el botón de
// tirar en el centro, y al lado el premio elegido y las probabilidades de la próxima tirada. Al tirar,
// la rueda recorre los premios que faltan y se para en el que ha salido; después, la animación de premio.
import { t } from './i18n.js';
import { portrait, faceSrc } from './sprites.js';
import { icon, item as itemImg, typeIcon } from './pixicons.js';
import { applySkin } from './frames.js';
import { frameName } from './achievements.js';
import { portraitArt, avatarName, effectName } from './missions.js';

const { SPECIES, TYPE_LABEL, TYPE_COLOR, RARITY, SPIN_COST } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const pct = p => (p >= 0.1 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + ' %';
const gemsHtml = n => `<span class="gem-ico">${icon('gem', 16)}</span>${Number(n).toLocaleString()}`;

// Nombre de una ruleta (la de su línea evolutiva) y la cara de su Pokémon para la pestaña
const rouletteName = r => r.line ? t('Ruleta de {m}', { m: SPECIES[r.line].name }) : t('Ruleta {type}', { type: TYPE_LABEL[r.type] });
const faceHtml = dex => { const src = faceSrc(dex, 'Happy'); return src ? `<img class="tz-face" src="${src}" alt="" draggable="false">` : typeIcon(SPECIES[dex].types[0], 30); };

// Nombre del premio
export function prizeName(x) {
  if (x.kind === 'skin') return t('Skin Elemental · línea de {m}', { m: SPECIES[x.dex].name });
  if (x.kind === 'frame') return frameName(x.frame);
  if (x.kind === 'particles') return t('Partículas · línea de {m}', { m: SPECIES[x.dex].name });
  if (x.kind === 'portrait') return avatarName(x.id);
  if (x.kind === 'effect') return effectName(x.effect);
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
    else if (x.kind === 'frame') box.append(this.avatar(size, false, x.frame, null, null));
    else if (x.kind === 'particles') box.append(applySkin(portrait(x.dex, size), null, x.dex, true));
    else if (x.kind === 'portrait') box.innerHTML = portraitArt(x.dex, Math.round(size * 0.9), x.emo);
    else if (x.kind === 'effect') box.append(this.avatar(Math.round(size * 0.9), false, null, null, x.effect));
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
    const N = cur.prizes.length, n = mine.length, cost = SPIN_COST[n], done = n >= N, enough = (p.gems || 0) >= cost;
    const wrap = el('div', 'treasure');
    wrap.style.setProperty('--tc', TYPE_COLOR[cur.type]);
    const top = this.topbar(t('Lucky Spin'), this.tzBack || 'menu');
    wrap.append(top);

    // Pestañas (una ruleta por tipo) y, a la derecha, cuándo cambian (las gemas van en la cabecera)
    const days = Math.max(1, Math.ceil((Data.treasureEnds() - Date.now()) / 86400e3));
    const tabs = el('div', 'tz-tabs');
    for (const r of list) {
      const k = (got[r.id] || []).length;
      const b = el('button', 'tz-tab' + (r === cur ? ' sel' : '') + (k >= r.prizes.length ? ' done' : ''), `<span class="tz-tab-ico">${faceHtml(r.line)}</span><span><b>${rouletteName(r)}</b><small>${t('Conseguido {a}/{b}', { a: k, b: r.prizes.length })}</small></span>`);
      b.style.setProperty('--tc', TYPE_COLOR[r.type]);
      b.style.setProperty('--tp', (k / r.prizes.length * 100) + '%');
      b.disabled = !!this.tzSpin;
      b.onclick = () => { this.tzSel = r.id; this.tzPick = null; this.show('treasure'); };
      tabs.append(b);
    }
    const when = el('span', 'tz-when', `${icon('clock', 16)}<span>${days > 1 ? t('Cambian en {n} días', { n: days }) : t('Cambian mañana')}</span>`);
    when.title = t('Lo que consigas se queda; lo que falte de estas ruletas se va.');
    tabs.append(when);
    wrap.append(tabs);
    // En el móvil, las ruletas van en pequeño en la cabecera: la cara, el Pokémon de la línea y lo conseguido
    const chips = el('div', 'tb-mobile tz-chips');
    for (const r of list) {
      const k = (got[r.id] || []).length;
      const b = el('button', 'tz-chip' + (r === cur ? ' sel' : ''), `${faceHtml(r.line)}<span><b>${r.line ? SPECIES[r.line].name : TYPE_LABEL[r.type]}</b><small>${k}/${r.prizes.length}</small></span>`);
      b.style.setProperty('--tc', TYPE_COLOR[r.type]);
      b.title = rouletteName(r);
      b.disabled = !!this.tzSpin;
      b.onclick = () => { this.tzSel = r.id; this.tzPick = null; this.show('treasure'); };
      chips.append(b);
    }
    top.querySelector('.tb-ctx').append(chips);

    const body = el('div', 'tz-body');
    // El tablero: el gran premio (el más raro) en el centro y los otros 9 en cartas alrededor. Al tirar se
    // encienden por turnos y frenan en el que sale.
    const board = el('div', 'tz-board');
    const order = ['mitico', 'legendario', 'epico', 'raro', 'comun'];
    const sorted = [...cur.prizes].sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
    const big = sorted[0];
    const pick = cur.prizes.find(x => x.id === this.tzPick) || null;
    for (const x of sorted) {
      const has = mine.includes(x.id), isBig = x === big;
      const b = el('button', `tz-card r-${x.rarity}${isBig ? ' big' : ''}${has ? ' got' : ''}${pick === x ? ' sel' : ''}`);
      b.style.setProperty('--rc', RARITY[x.rarity].color);
      b.dataset.id = x.id;
      if (isBig) b.append(el('i', 'tz-burst'), el('i', 'tz-corners'));
      b.append(this.prizeArt(x, isBig ? 150 : 64));
      b.append(isBig ? el('span', 'tz-jackpot', `<small>${t('Gran premio')}</small><b>${prizeName(x)}</b>`) : el('span', 'tz-name', prizeName(x)));
      if (!isBig) b.append(el('i', 'tz-rar', t(RARITY[x.rarity].name)));
      if (has) b.append(el('i', 'tz-check', '✓'));
      b.title = `${prizeName(x)} · ${t(RARITY[x.rarity].name)}`;
      b.onclick = () => { if (this.tzSpin) return; this.tzPick = x.id; this.show('treasure'); };
      board.append(b);
    }
    const left = el('div', 'tz-left');
    // En el móvil, en vez del tablero, una tira horizontal con los premios (se desliza con el dedo) y una marca en
    // el centro: al tirar, la tira corre y frena con el premio bajo la marca, como las cajas de los shooters
    const strip = el('div', 'tz-strip');
    const track = el('div', 'tz-track');
    for (const x of sorted) track.append(this.stripCard(x, mine.includes(x.id), pick === x));
    strip.append(el('i', 'tz-marker'), track);
    left.append(board, strip);

    // Barra de abajo: lo elegido o el progreso, las probabilidades y el precio con el botón de tirar
    const bar = el('div', 'tz-bar');
    const prog = el('div', 'tz-prog');
    prog.append(el('div', 'tz-progress', `<b>${n}/${N}</b><span>${t('Conseguido')}</span>`));
    prog.append(el('div', 'tz-seg', cur.prizes.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')));
    bar.append(prog);
    const info = el('div', 'tz-info', pick
      ? `<b style="color:${RARITY[pick.rarity].color}">${t(RARITY[pick.rarity].name)}</b> · ${prizeName(pick)} · ${mine.includes(pick.id) ? t('Ya lo tienes') : t('{p} en la próxima tirada', { p: pct((odds.find(o => o.prize === pick) || { p: 0 }).p) })}<small>${{
        skin: t('La skin Elemental de la línea: el sprite con la paleta de su tipo y un contorno brillante, en los menús y en combate.'),
        frame: t('Un marco animado del tipo de la línea para el contorno de tu avatar. Se pone en tu Perfil.'),
        particles: t('Brasas, burbujas, chispas… del tipo de la línea alrededor de su sprite, con cualquier skin, en los menús y en combate. Se encienden en la ficha del Pokémon.'),
        portrait: t('Un avatar con la cara del Pokémon de cerca. Combínalo con el efecto, el marco y el glow que quieras.'),
        effect: t('Un efecto animado por encima de tu avatar, sea cual sea. Póntelo en tu Perfil.'),
        coins: t('Dinero para la Tienda.'), item: t('Para subir de nivel a tus Pokémon.'),
      }[pick.kind]}</small>`
      : `<span>${t('Toca un premio para ver qué es.')}</span><small>${icon('gem', 14)} ${t('Misiones y cofres, la primera victoria online del día, líderes y Alto Mando, cada 7 de la Torre, subir de liga y los salvajes raros o shiny.')}</small>`);
    bar.append(info);
    const oddsBtn = el('button', 'tb-btn tz-odds-btn', `${icon('star', 16)}<span>${t('Probabilidades')}</span>`);
    oddsBtn.onclick = () => this.treasureOdds(cur, mine, odds);
    bar.append(oddsBtn);
    const buy = el('div', 'tz-buy');
    if (done) buy.append(el('div', 'tz-done', `<b>${t('¡Ruleta completa!')}</b><small>${t('Tienes todos sus premios.')}</small>`));
    else {
      const rest = SPIN_COST.slice(n).reduce((a, b) => a + b, 0);
      const price = el('div', 'tz-price' + (enough ? '' : ' short'), `<b>${gemsHtml(cost)}</b><small>${!enough ? t('Te faltan {n} gemas.', { n: cost - (p.gems || 0) }) : t('Tirada {n} de {max}', { n: n + 1, max: N })}</small>`);
      price.title = n === N - 1 ? t('La última tirada: el último premio es seguro.') : t('Completar la ruleta: {n} gemas más.', { n: rest });
      const go = el('button', 'tz-go', this.tzSpin ? t('Girando…') : t('¡Tirar!'));
      go.disabled = !enough || !!this.tzSpin;
      go.onclick = () => { this.tzSpin = { id: cur.id }; go.disabled = true; go.textContent = t('Girando…'); this.net.send({ t: 'treasure', id: cur.id }); };
      buy.append(price, go);
    }
    bar.append(buy);
    left.append(bar);
    body.append(left);
    wrap.append(body);
    this.root.append(wrap);
  },

  // Carta pequeña de la tira del móvil
  stripCard(x, has = false, sel = false) {
    const b = el('button', `tz-scard r-${x.rarity}${has ? ' got' : ''}${sel ? ' sel' : ''}`);
    b.style.setProperty('--rc', RARITY[x.rarity].color);
    b.dataset.id = x.id;
    b.append(this.prizeArt(x, 48), el('span', 'tz-name', prizeName(x)));
    if (has) b.append(el('i', 'tz-check', '✓'));
    b.title = `${prizeName(x)} · ${t(RARITY[x.rarity].name)}`;
    b.onclick = () => { if (this.tzSpin) return; this.tzPick = x.id; this.show('treasure'); };
    return b;
  },

  // La tirada en la tira del móvil: se llena de premios de los que faltan al azar (más los comunes, como las
  // probabilidades), con el que sale cerca del final, y corre frenando hasta dejarlo bajo la marca
  treasureStrip(r, strip, done) {
    const cur = Data.treasures(this.profile.treasure ? this.profile.treasure.period : undefined).find(x => x.id === r.treasure.roulette) || null;
    const prize = cur && cur.prizes.find(x => x.id === r.treasure.prize);
    if (!prize) return done();
    const got = ((this.profile.treasure && this.profile.treasure.got) || {})[cur.id] || [];
    const pool = cur.prizes.filter(x => !got.includes(x.id) || x === prize);
    const weight = { comun: 6, raro: 4, epico: 2, legendario: 1, mitico: 1 };
    const bag = pool.flatMap(x => Array(weight[x.rarity] || 1).fill(x));
    const track = strip.querySelector('.tz-track');
    track.replaceChildren();
    const N = 46, at = 40;
    for (let i = 0; i < N; i++) track.append(this.stripCard(i === at ? prize : bag[Math.floor(Math.random() * bag.length)]));
    strip.classList.add('spinning');
    const card = track.children[at];
    const w = card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
    const end = -(card.offsetLeft + card.offsetWidth / 2 - strip.clientWidth / 2) + (Math.random() - 0.5) * w * 0.6;
    const ms = 4600, t0 = performance.now();
    track.style.transform = 'translateX(0px)';
    const frame = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 4);
      track.style.transform = `translateX(${end * e}px)`;
      if (k < 1) return requestAnimationFrame(frame);
      card.classList.add('win');
      strip.classList.remove('spinning');
      setTimeout(done, 700);
    };
    requestAnimationFrame(frame);
  },

  // Ventana con las probabilidades de la próxima tirada
  treasureOdds(cur, mine, odds) {
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box tz-odds-modal');
    back.onclick = e => { if (e.target === back) back.remove(); };
    box.append(el('h3', '', t('Probabilidades de la próxima tirada')));
    const ol = el('div', 'tz-odds scroll');
    for (const o of [...odds].sort((a, b) => b.p - a.p)) ol.append(el('div', 'tz-odd', `<i style="background:${RARITY[o.prize.rarity].color}"></i><span>${prizeName(o.prize)}</span><b>${pct(o.p)}</b>`));
    for (const x of cur.prizes.filter(x => mine.includes(x.id))) ol.append(el('div', 'tz-odd got', `<i></i><span>${prizeName(x)}</span><b>✓</b>`));
    box.append(ol, el('p', 'small', t('Cada tirada da un premio de los que faltan. Lo más común sale más; lo que consigues sale de la bolsa y los demás ganan probabilidad. La ruleta acaba en {n} tiradas como mucho, y en la última el premio que queda es seguro.', { n: cur.prizes.length })));
    const acts = el('div', 'acts');
    const ok = el('button', 'primary', t('Entendido'));
    ok.onclick = () => back.remove();
    acts.append(ok);
    box.append(acts);
    back.append(box);
    document.body.append(back);
  },

  // Las cartas que faltaban se encienden por turnos, rápido al principio y frenando hasta el premio; luego, done()
  treasureSpin(r, done) {
    const strip = this.root.querySelector('.tz-strip');
    if (strip && strip.offsetParent) return this.treasureStrip(r, strip, done);   // en el móvil, la tira
    const board = this.root.querySelector('.tz-board');
    const cells = board ? [...board.querySelectorAll('.tz-card:not(.got)')] : [];
    const target = cells.findIndex(c => c.dataset.id === r.treasure.prize);
    if (!cells.length || target < 0) return done();
    board.classList.add('spinning');
    const steps = cells.length * 3 + target, at = [0];
    for (let i = 1; i <= steps; i++) { const k = (i - 1) / steps; at.push(at[i - 1] + 50 + 300 * k * k * k); }
    const end = at[steps] + 600, t0 = performance.now();
    let shown = -1;
    const frame = now => {
      const ms = now - t0;
      let i = shown < 0 ? 0 : shown;
      while (i < steps && at[i + 1] <= ms) i++;
      if (i !== shown) { cells.forEach(c => c.classList.remove('hot')); cells[i % cells.length].classList.add('hot'); shown = i; }
      if (ms >= end) { board.classList.remove('spinning'); cells[target].classList.add('win'); setTimeout(done, 500); } else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
};
