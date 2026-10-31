// Al encontrar rival en Clasificatoria o Partida rápida: las dos tarjetas de entrenador entran por los lados y chocan.
// Va encima de la cuenta atrás de 3 s del combate, sin pararla, y no atrapa toques ni clics
import { t } from './i18n.js';
import { trainerImg } from './sprites.js';
import { badgeImg } from './pixicons.js';
import { escapeHtml, tagName } from './battle.js';

const OUT = 2500, GONE = 2950;   // (ms: empieza a irse y ya no está)

// Hasta 8 medallas, las últimas ganadas de la región más avanzada
function medals(c) {
  const [region, n] = Object.entries(c.prog || {}).sort((a, b) => b[1] - a[1])[0] || [];
  return n ? Array.from({ length: n }, (_, i) => badgeImg(region, i, true, 22)).join('') : '';
}

function card(ui, c, side) {
  const box = document.createElement('div');
  box.className = 'vs-card ' + side;
  const pic = c.npcKey ? Object.assign(document.createElement('div'), { className: 'vs-npc', innerHTML: trainerImg(c.npcKey) }) : ui.avatar(matchMedia('(max-height: 500px)').matches ? 76 : 118, true, undefined, undefined, undefined, c);
  const league = Data.leagueOf(c.elo);
  const info = document.createElement('div');
  info.className = 'vs-info';
  info.innerHTML = `<b>${tagName(c.name, c.npc ? null : c.tag)}${c.npc ? ` <em class="vs-ai">${t('IA')}</em>` : ''}</b>`
    + (c.title ? `<span class="title-chip">${escapeHtml(t(c.title))}</span>` : '')
    + `<span class="vs-elo">${t(league)} · ${c.elo} ELO</span>`
    + (c.badges ? `<span class="vs-medals">${medals(c)}<small>${c.badges === 1 ? t('1 medalla') : t('{n} medallas', { n: c.badges })}</small></span>` : '');
  box.append(pic, info);
  return box;
}

export function versusIntro(ui, me, foe) {
  const v = document.createElement('div');
  v.className = 'versus';
  v.append(card(ui, me, 'you'), Object.assign(document.createElement('div'), { className: 'vs-mark', textContent: 'VS' }), card(ui, foe, 'foe'));
  // El choque: una onda y chispas que salen del centro
  const hit = document.createElement('div');
  hit.className = 'vs-hit';
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('i'), a = i / 16 * Math.PI * 2, d = 18 + (i * 7 % 5) * 7;
    s.style.setProperty('--x', Math.cos(a) * d + 'vmin');
    s.style.setProperty('--y', Math.sin(a) * d + 'vmin');
    hit.append(s);
  }
  v.append(hit);
  document.body.append(v);
  setTimeout(() => v.classList.add('out'), OUT);
  setTimeout(() => v.remove(), GONE);
}
