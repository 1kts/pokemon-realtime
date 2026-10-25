// Logros: panel del perfil (progreso, premio y fijar como insignia), aviso al desbloquear y las
// insignias fijadas que se ven en el perfil propio y en la ficha pública. Los datos están en
// Data.ACHIEVEMENTS; el servidor los da y entrega los premios (server/rewards.js).
import { t } from './i18n.js';
import { icon, item as itemImg, badgeImg } from './pixicons.js';
import { glowName } from './frames.js';

const { ACHIEVEMENTS } = Data;
const BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const TIER = { 1: 'bronze', 2: 'silver', 3: 'gold' };
export const FRAME_LABEL_EXTRA = { pokedex: 'Pokédex', shiny: 'Shiny', campeon: 'Campeón', torre: 'Torre' };

// Icono del logro: sprite del objeto (o la medalla de la región) sobre una medalla del color del nivel
export function achIcon(a, size = 48, got = true) {
  const art = a.icon.startsWith('badge:') ? badgeImg(a.icon.slice(6), a.id === 'medalla1' ? 0 : 7, true, Math.round(size * 0.62)) : itemImg(a.icon, Math.round(size * 0.66));
  return `<span class="ach-ico ${TIER[a.tier]}${got ? ' got' : ''}" style="--s:${size}px">${art}<i class="ach-tier">${icon('medal' + a.tier, 16)}</i></span>`;
}

// Insignias fijadas (hasta 3) para tarjetas de perfil
export function showcaseHtml(ids, size = 40) {
  const list = (ids || []).map(id => BY_ID[id]).filter(Boolean);
  if (!list.length) return '';
  return `<div class="showcase">${list.map(a => `<span title="${t(a.name)} · ${t(a.desc)}">${achIcon(a, size)}</span>`).join('')}</div>`;
}

export const achievementViews = {
  // Panel de logros del perfil
  achievementsPanel() {
    const p = this.profile;
    const got = p.achievements || {};
    const pinned = p.showcase || [];
    const box = el('div', 'panel achievements');
    const done = ACHIEVEMENTS.filter(a => got[a.id]).length;
    box.append(el('div', 'ach-head', `<h3>${t('Logros')}</h3><span class="ach-count">${done} / ${ACHIEVEMENTS.length}</span>`));
    box.append(el('p', 'small', t('Fija hasta {n} logros como insignias de tu perfil con la estrella.', { n: Data.SHOWCASE_MAX })));
    const grid = el('div', 'ach-grid');
    // Primero los conseguidos, luego por lo cerca que estás
    const pending = p.achClaim || [];
    const list = [...ACHIEVEMENTS].sort((a, b) => pending.includes(b.id) - pending.includes(a.id) || (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0)
      || Data.achievementProgress(p, b) / b.goal - Data.achievementProgress(p, a) / a.goal);
    for (const a of list) {
      const ok = !!got[a.id], cur = Data.achievementProgress(p, a);
      const ready = (p.achClaim || []).includes(a.id);
      const rw = a.reward || {};
      const prize = [rw.title && `${t('Título')}: <b>${t(rw.title)}</b>`, rw.frame && `${t('Marco')}: <b>${t(FRAME_LABEL_EXTRA[rw.frame] || rw.frame)}</b>`, rw.glow && `<b>${glowName(rw.glow, t)}</b>`, Data.achievementAvatar(a) && t('Avatar'), rw.coins && `${icon('coin', 14)}${rw.coins.toLocaleString()}`].filter(Boolean).join(' · ');
      const card = el('div', 'ach-card' + (ok ? ' got' : '') + (ready ? ' ready' : ''));
      card.innerHTML = `${achIcon(a, 52, ok)}<div class="ach-body"><b>${t(a.name)}</b><small>${t(a.desc)}</small>
        ${ok ? `<em class="ach-done">${t('Conseguido')}</em>` : `<div class="ach-bar"><i style="width:${cur / a.goal * 100}%"></i></div><small class="ach-num">${cur} / ${a.goal}</small>`}
        <small class="ach-prize">${prize}</small></div>`;
      if (ready) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.onclick = () => { b.disabled = true; this.net.send({ t: 'achclaim', id: a.id }); };
        card.querySelector('.ach-body').append(b);
      }
      if (ok) {
        const pin = el('button', 'ach-pin' + (pinned.includes(a.id) ? ' on' : ''), icon('star', 22));
        pin.title = pinned.includes(a.id) ? t('Quitar de las insignias') : t('Fijar como insignia');
        pin.onclick = () => {
          const next = pinned.includes(a.id) ? pinned.filter(x => x !== a.id) : [...pinned, a.id];
          if (next.length > Data.SHOWCASE_MAX) return this.toast(t('Solo puedes fijar {n}: quita una antes', { n: Data.SHOWCASE_MAX }), 'bad');
          this.net.send({ t: 'look', showcase: next });
        };
        card.append(pin);
      }
      grid.append(card);
    }
    box.append(grid);
    return box;
  },

  // Aviso grande al desbloquear logros (al llegar un perfil con logros nuevos)
  celebrateAchievements(prev, next) {
    if (!prev || !next) return;
    const fresh = ACHIEVEMENTS.filter(a => next[a.id] && !prev[a.id]);
    fresh.forEach((a, i) => setTimeout(() => {
      const rw = a.reward || {};
      const pop = el('div', 'ach-pop ' + TIER[a.tier], `${achIcon(a, 64)}<div><small>${t('¡Logro desbloqueado!')}</small><b>${t(a.name)}</b><span>${[rw.title && t(rw.title), rw.frame && `${t('Marco')} ${t(FRAME_LABEL_EXTRA[rw.frame] || rw.frame)}`, rw.glow && glowName(rw.glow, t), rw.coins && '+' + rw.coins.toLocaleString() + ' ₽'].filter(Boolean).join(' · ')}</span><em>${t('Recoge el premio en Misiones')}</em></div>`);
      pop.onclick = () => { pop.remove(); this.show('missions'); };
      document.body.append(pop);
      setTimeout(() => pop.classList.add('out'), 4200);
      setTimeout(() => pop.remove(), 4800);
    }, i * 1600));
  },
};
