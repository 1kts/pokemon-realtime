// Misiones diarias y semanales, sus cofres y todo lo que hay por recoger (logros y avatares de
// medallas): pantalla de Misiones, tarjeta del menú, progreso en los resultados del combate y la
// animación al recoger. El servidor manda las misiones en p.missions (server/missions.js) y lo
// recogido en un mensaje 'loot'. Se añaden como métodos de UI (ver el final de ui.js).
import { t, locale } from './i18n.js';
import { icon, item as itemImg, badgeImg, typeIcon } from './pixicons.js';
import { frameBadge, SKIN_LABEL, applySkin, applyGlow, glowName } from './frames.js';
import { portrait } from './sprites.js';
import { achIcon, FRAME_LABEL_EXTRA } from './achievements.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const num = n => n.toLocaleString(locale());
const coinsHtml = n => `<span class="coin">${icon('coin', 16)}</span>${num(n)}`;
const KIND_TITLE = { daily: 'Misiones diarias', weekly: 'Misiones semanales' };
// Icono de cada misión: el tipo si lo tiene; si no, un objeto que la represente
const EV_ICON = { wild: 'town-map', catch: 'great-ball', dex: 'rotom-catalog', win: 'vs-seeker', gym: 'medal-box', tower: 'relic-crown',
  towerStreak: 'relic-crown', online: 'vs-seeker', rankedWin: 'master-ball', level: 'rare-candy', evolve: 'moon-stone' };
const FRAME_LABEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante', maestro: 'Maestro', ...FRAME_LABEL_EXTRA };
// Cofre en píxeles (la tapa se abre al recogerlo)
const CHEST_SVG = `<svg class="chest-svg" viewBox="0 0 32 28" aria-hidden="true" shape-rendering="crispEdges">
  <g class="lid"><rect x="3" y="4" width="26" height="9" rx="1" fill="#b8682a"/><rect x="3" y="4" width="26" height="2" fill="#e09a50"/><rect x="3" y="11" width="26" height="2" fill="#ffd23f"/><rect x="14" y="4" width="4" height="9" fill="#ffd23f"/></g>
  <rect x="3" y="13" width="26" height="12" fill="#8a4a1a"/><rect x="3" y="13" width="26" height="2" fill="#ffd23f"/><rect x="3" y="23" width="26" height="2" fill="#5a2e0e"/>
  <rect x="14" y="13" width="4" height="12" fill="#ffd23f"/><rect x="15" y="16" width="2" height="3" fill="#5a2e0e"/></svg>`;

// Avatar de colección: medalla ('badge:<región>:<n>') u objeto ('item:<sprite>')
export function avatarArt(id, size) {
  const [kind, a, b] = String(id).split(':');
  if (kind === 'badge') return badgeImg(a, +b, true, Math.round(size * 0.8), 'col-art');
  if (kind === 'item') return itemImg(a, Math.round(size * 0.8), 'col-art');
  return '';
}
// Nombre de un avatar de colección
export function avatarName(id) {
  const [kind, a, b] = String(id).split(':');
  if (kind === 'badge') { const g = Data.leadersOf(a)[+b]; return g ? (g.badge || g.name) : ''; }
  const ach = Data.ACHIEVEMENTS.find(x => Data.achievementAvatar(x) === id);
  return ach ? t(ach.name) : '';
}

export const missionText = m => t(Data.MISSION_BY_ID[m.id].name, { n: m.goal, type: m.type ? Data.TYPE_LABEL[m.type] : '' });
const missionIcon = (m, size) => m.type ? typeIcon(m.type, size) : itemImg(EV_ICON[Data.MISSION_BY_ID[m.id].ev] || 'poke-ball', size);
const itemName = id => (Data.SHOP.find(i => i.id === id) || { name: id }).name;
// Premio en fichas: dinero y objetos
const prizeHtml = rw => [rw.coins ? `<span class="mp coins">${coinsHtml(rw.coins)}</span>` : '',
  ...Object.entries(rw.items || {}).map(([k, n]) => `<span class="mp" title="${itemName(k)}">${itemImg(k, 22)}×${n}</span>`)].join('');

// Cuenta atrás hasta un instante (se para sola cuando el elemento sale de la pantalla)
function countdown(at, onEnd) {
  const box = el('span', 'mcount');
  const tick = () => {
    if (!box.isConnected && box.dataset.started) return;
    box.dataset.started = '1';
    const left = Math.max(0, at - Date.now());
    const d = Math.floor(left / 86400e3), h = Math.floor(left / 3600e3) % 24, m = Math.floor(left / 60e3) % 60, s = Math.floor(left / 1e3) % 60;
    box.innerHTML = `${icon('clock', 14)} ${d ? t('{d} d {h} h', { d, h }) : `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}`;
    if (left <= 0) return onEnd && onEnd();
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  };
  tick();
  return box;
}

export const missionViews = {
  // Medallas ganadas cuyo avatar aún no se ha recogido ([región, n])
  badgesReady() {
    const p = this.profile, have = new Set((p.cosmetics && p.cosmetics.avatars) || []);
    return Data.REGION_IDS.flatMap(r => Array.from({ length: Math.min(8, Data.progOf(p, r)) }, (_, i) => [r, i]))
      .filter(([r, i]) => !have.has(Data.badgeAvatar(r, i)));
  },

  // Todo lo que se puede recoger ahora: misiones cumplidas, cofres, logros y medallas
  readyCount() {
    const p = this.profile, ms = p.missions;
    let n = (p.achClaim || []).length + this.badgesReady().length;
    if (ms) for (const kind of ['daily', 'weekly']) {
      n += ms[kind].filter(m => m.n >= m.goal && !m.claimed).length;
      if (ms[kind].every(m => m.claimed) && !ms.chest[kind]) n++;
    }
    return n;
  },

  // Una misión: icono, texto, barra, premio y botones de recoger o cambiar
  missionCard(kind, m, i, compact = false) {
    const ms = this.profile.missions;
    const tpl = Data.MISSION_BY_ID[m.id];
    const done = m.n >= m.goal;
    const card = el('div', `mission${done ? ' done' : ''}${m.claimed ? ' claimed' : ''}${compact ? ' compact' : ''}`);
    card.innerHTML = `<span class="m-ico">${missionIcon(m, compact ? 30 : 38)}</span>
      <div class="m-body"><b>${missionText(m)}</b>
        <div class="m-bar"><i style="width:${Math.min(100, m.n / m.goal * 100)}%"></i><span>${num(m.n)} / ${num(m.goal)}</span></div>
        ${compact ? '' : `<div class="m-prize">${prizeHtml(tpl.reward)}</div>`}</div>`;
    const acts = el('div', 'm-acts');
    if (m.claimed) acts.append(el('em', 'm-ok', `✓ ${t('Recogida')}`));
    else if (done) {
      const b = el('button', 'primary claim-btn', t('¡Recoger!'));
      b.onclick = () => { b.disabled = true; this.net.send({ t: 'mission', a: 'claim', kind, i }); };
      acts.append(b);
    } else if (!compact) {
      const free = ms.freeRerolls[kind];
      const cost = Data.MISSION_REROLL_COST[kind];
      const b = el('button', 'reroll', `↻ <small>${free ? t('Gratis') : coinsHtml(cost)}</small>`);
      b.title = free ? t('Cambiar por otra misión (te quedan {n} cambios gratis)', { n: free }) : t('Cambiar por otra misión por {n}', { n: num(cost) });
      b.onclick = () => {
        if (!free && !confirm(t('¿Cambiar esta misión por {n}? Perderás su progreso.', { n: num(cost) + ' ₽' }))) return;
        if (free && m.n > 0 && !confirm(t('¿Cambiar esta misión? Perderás su progreso.'))) return;
        b.disabled = true;
        this.net.send({ t: 'mission', a: 'reroll', kind, i });
      };
      acts.append(b);
    }
    card.append(acts);
    return card;
  },

  // Cofre de un tipo de misión: se abre al recoger las 3
  chestRow(kind) {
    const ms = this.profile.missions;
    const got = ms[kind].filter(m => m.claimed).length;
    const ready = got === ms[kind].length && !ms.chest[kind];
    const row = el('div', `chest-row${ready ? ' ready' : ''}${ms.chest[kind] ? ' opened' : ''}`);
    row.innerHTML = `<span class="chest">${CHEST_SVG}</span><div class="m-body"><b>${t(kind === 'daily' ? 'Cofre diario' : 'Cofre semanal')}</b>
      <small>${ms.chest[kind] ? t('Abierto. Vuelve cuando se renueven las misiones.') : t('Recoge las {n} misiones para abrirlo', { n: ms[kind].length })} · ${got}/${ms[kind].length}</small>
      <div class="m-prize">${prizeHtml(Data.MISSION_CHEST[kind])}${kind === 'weekly' ? `<span class="mp"><i class="glow-dot glow-prisma"></i>${t('Glow de tipo al azar')}</span>` : ''}</div></div>`;
    if (ready) {
      const b = el('button', 'primary claim-btn', t('¡Abrir!'));
      b.onclick = () => { b.disabled = true; row.classList.add('opening'); this.net.send({ t: 'mission', a: 'chest', kind }); };
      row.append(b);
    }
    return row;
  },

  missionPanel(kind) {
    const ms = this.profile.missions;
    const box = el('div', 'panel missions ' + kind);
    const head = el('div', 'm-head', `<h3>${t(KIND_TITLE[kind])}</h3>`);
    const meta = el('div', 'm-meta');
    meta.append(el('span', 'm-rerolls', t('Cambios gratis: {n}', { n: ms.freeRerolls[kind] })));
    const cd = countdown(ms.ends[kind], () => this.view === 'missions' && this.net.send({ t: 'mission', a: 'refresh' }));
    cd.title = t(kind === 'daily' ? 'Nuevas misiones diarias en' : 'Nuevas misiones semanales en');
    meta.append(cd);
    head.append(meta);
    box.append(head);
    ms[kind].forEach((m, i) => box.append(this.missionCard(kind, m, i)));
    box.append(this.chestRow(kind));
    return box;
  },

  // Logros y medallas pendientes de recoger
  collectPanel() {
    const p = this.profile;
    const box = el('div', 'panel missions collect');
    box.append(el('div', 'm-head', `<h3>${t('Logros y medallas')}</h3>`));
    const ach = (p.achClaim || []).map(id => Data.ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
    const badges = this.badgesReady();
    if (!ach.length && !badges.length) box.append(el('p', 'small', t('Cada logro y cada medalla de gimnasio te dan un avatar nuevo para tu perfil. Cuando consigas uno, recógelo aquí.')));
    for (const a of ach) {
      const rw = a.reward || {};
      const row = el('div', 'mission done', `<span class="m-ico">${achIcon(a, 40)}</span><div class="m-body"><b>${t(a.name)}</b><small>${t(a.desc)}</small>
        <div class="m-prize">${prizeHtml(rw)}${rw.title ? `<span class="mp title-chip">${t(rw.title)}</span>` : ''}${rw.frame ? `<span class="mp">${frameBadge(rw.frame, 16)}${t(FRAME_LABEL[rw.frame] || rw.frame)}</span>` : ''}${rw.glow ? `<span class="mp"><i class="glow-dot glow-${rw.glow in Data.GLOW_SPECIAL ? rw.glow : 'tipo'}" style="--gc:${Data.glowColor(rw.glow) || '#fff'}"></i>${glowName(rw.glow, t)}</span>` : ''}${Data.achievementAvatar(a) ? `<span class="mp">${avatarArt(Data.achievementAvatar(a), 26)}${t('Avatar')}</span>` : ''}</div></div>`);
      const b = el('button', 'primary claim-btn', t('¡Recoger!'));
      b.onclick = () => { b.disabled = true; this.net.send({ t: 'achclaim', id: a.id }); };
      row.append(b);
      box.append(row);
    }
    for (const [r, i] of badges) {
      const g = Data.leadersOf(r)[i];
      const row = el('div', 'mission done', `<span class="m-ico">${badgeImg(r, i, true, 40)}</span><div class="m-body"><b>${(g.badge || g.name)}</b><small>${t('Avatar de la medalla para tu perfil')}</small></div>`);
      const b = el('button', 'primary claim-btn', t('¡Recoger!'));
      b.onclick = () => { b.disabled = true; this.net.send({ t: 'badgeclaim', region: r, index: i }); };
      row.append(b);
      box.append(row);
    }
    return box;
  },

  view_missions() {
    const wrap = el('div', 'missions-view');
    wrap.append(this.topbar(t('Misiones'), 'menu'));
    const body = el('div', 'mv-body scroll');
    body.append(this.missionPanel('daily'), this.missionPanel('weekly'), this.collectPanel());
    wrap.append(body);
    this.root.append(wrap);
  },

  // Tarjeta del menú: las diarias con su progreso y el aviso de lo que hay por recoger
  missionsWidget() {
    const ms = this.profile.missions;
    const ready = this.readyCount();
    const box = el('div', 'panel missions-widget' + (ready ? ' has-ready' : ''));
    const head = el('button', 'mw-head', `<b>${t('Misiones diarias')}</b>${ready ? `<span class="m-ready">${ready > 1 ? t('¡{n} por recoger!', { n: ready }) : t('¡1 por recoger!')}</span>` : ''}<i class="go">${t('Ver todas')} ›</i>`);
    head.onclick = () => this.show('missions');
    box.append(head);
    ms.daily.forEach((m, i) => box.append(this.missionCard('daily', m, i, true)));
    if (ms.daily.every(m => m.claimed)) box.append(this.chestRow('daily'));
    return box;
  },

  // Progreso de misiones en la pantalla de resultados (con botón para recoger las que se cumplen)
  resultsMissions(box, list) {
    if (!list || !list.length) return;
    const wrap = el('div', 'results-missions');
    for (const d of list) {
      const done = d.n >= d.goal;
      const row = el('div', 'rm' + (done ? ' done' : ''), `<span class="m-ico">${missionIcon(d, 28)}</span><div class="m-body"><small>${t(KIND_TITLE[d.kind])}</small><b>${missionText(d)}</b>
        <div class="m-bar"><i style="width:${d.from / d.goal * 100}%"></i><span>${num(d.n)} / ${num(d.goal)}</span></div></div>`);
      // La barra avanza desde donde estaba
      requestAnimationFrame(() => setTimeout(() => { row.querySelector('.m-bar i').style.width = Math.min(100, d.n / d.goal * 100) + '%'; }, 250));
      if (done) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.onclick = () => { b.disabled = true; b.textContent = '✓'; this.net.send({ t: 'mission', a: 'claim', kind: d.kind, i: d.i }); };
        row.append(b);
      }
      wrap.append(row);
    }
    box.append(wrap);
  },

  // Animación al recoger: lo recibido salta uno a uno, el dinero cuenta hacia arriba y confeti
  onLoot(r) {
    document.querySelectorAll('.loot-pop').forEach(x => x.remove());
    this.coinBump = r.coins > 0;
    const pop = el('div', 'loot-pop');
    const box = el('div', 'loot-box' + (r.chest ? ' chest-open' : ''));
    const head = r.chest ? t(r.chest === 'daily' ? '¡Cofre diario abierto!' : '¡Cofre semanal abierto!')
      : r.mastery ? t('¡Premio de maestría!')
        : r.badge || (r.avatar && !r.coins) ? t('¡Nuevo avatar!') : r.achievement ? t('¡Logro recogido!') : t('¡Misión completada!');
    const conf = el('div', 'confetti');
    const colors = ['#ffcb05', '#3b78d8', '#e8403a', '#4fd06a', '#ff9ee0', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      const c = el('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
      c.style.animationDelay = Math.random() * 0.4 + 's';
      conf.append(c);
    }
    box.append(el('div', 'rays'), conf, el('h2', '', head));
    if (r.chest) box.append(el('span', 'chest big', CHEST_SVG));
    if (r.mission) box.append(el('p', 'loot-sub', missionText({ ...r.mission, goal: Data.MISSION_BY_ID[r.mission.id].goal })));
    if (r.mastery) box.append(el('p', 'loot-sub', t('Línea de {m}', { m: Data.SPECIES[r.mastery.dex].name })));
    const list = el('div', 'loot-items');
    const add = (art, label) => { const it = el('div', 'li', `<span class="li-art">${art}</span><small>${label}</small>`); it.style.animationDelay = (0.25 + list.children.length * 0.18) + 's'; list.append(it); };
    if (r.coins) {
      add(icon('coin', 48), `<b class="count">+0</b>`);
      const target = r.coins, start = performance.now(), dur = 900;
      const step = now => {
        const k = Math.min(1, (now - start - 250) / dur);
        const c = list.querySelector('.count');
        if (c) c.textContent = '+' + num(Math.round(target * Math.max(0, k) * (2 - Math.max(0, k))));
        if (k < 1 && pop.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    for (const [k, n] of Object.entries(r.items || {})) add(itemImg(k, 48), `${itemName(k)} ×${n}`);
    if (r.title) add(`<span class="title-chip">${t(r.title)}</span>`, t('Título'));
    if (r.frame) add(frameBadge(r.frame, 44), t('Marco {name}', { name: r.frame.startsWith('tipo-') ? t('Maestría {type}', { type: Data.TYPE_LABEL[r.frame.slice(5)] }) : t(FRAME_LABEL[r.frame] || r.frame) }));
    // Premios de maestría: estrella, ilustración, brillo de burbuja y skin
    const addEl = (node, label) => { add('', label); list.lastChild.querySelector('.li-art').append(node); };
    if (r.mastery && r.mastery.kind === 'star') add('<b class="loot-star">★</b>', t('Estrella de bronce'));
    if (r.art) add(`<img class="loot-art" src="art/${r.art}.png" alt="">`, t('Ilustración oficial'));
    for (const au of [r.aura, r.aura2].filter(Boolean)) addEl(this.avatar(52, false, undefined, au), au === 'prisma' ? t('Brillo prismático') : t('Brillo {type}', { type: Data.TYPE_LABEL[au.slice(5)] }));
    if (r.glow) { const { dex } = this.avatarDex(); addEl(applyGlow(portrait(dex, 64), r.glow), glowName(r.glow, t)); }
    if (r.skin) { addEl(applySkin(portrait(r.mastery.dex, 64), r.skin, r.mastery.dex), t(SKIN_LABEL[r.skin])); }
    if (r.avatar) add(`<span class="ava-preview">${avatarArt(r.avatar, 56)}</span>`, `${t('Avatar')}: ${avatarName(r.avatar)}`);
    box.append(list);
    const acts = el('div', 'acts');
    if (r.avatar) {
      const use = el('button', '', t('Usar de avatar'));
      use.onclick = () => { this.net.send({ t: 'look', avatar: r.avatar }); close(); };
      acts.append(use);
    }
    const equip = (label, msg) => { const b = el('button', '', label); b.onclick = () => { this.net.send({ t: 'look', ...msg }); close(); }; acts.append(b); };
    if (r.art) equip(t('Usar de avatar'), { avatar: r.art, avatarShiny: false, avatarArt: true });
    if (r.aura || r.aura2) equip(t('Ponerme el brillo'), { aura: r.aura2 || r.aura });
    if (r.skin) equip(t('Ponérsela'), { skin: { dex: r.mastery.dex, skin: r.skin } });
    if (r.glow) { const b = el('button', '', t('Ponérselo a una línea')); b.onclick = () => { close(); this.glowPick = r.glow; this.openCollection('glow'); }; acts.append(b); }
    const ok = el('button', 'primary', t('¡Genial!'));
    acts.append(ok);
    if (r.chestReady) acts.append(el('p', 'small chest-hint', t('¡Has completado las 3! Abre el cofre en Misiones.')));
    box.append(acts);
    pop.append(box);
    const close = () => { pop.classList.add('out'); setTimeout(() => pop.remove(), 250); };
    ok.onclick = close;
    pop.onclick = e => { if (e.target === pop) close(); };
    document.body.append(pop);
    setTimeout(() => ok.focus(), 50);
  },
};
