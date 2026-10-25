// Premio diario por entrar: ventana con los 7 días del ciclo (Data.DAILY_LOGIN), el de hoy brillando y
// listo para recoger a mano. Se abre sola al entrar si hay premio, y también desde Misiones. El
// servidor manda el estado en p.daily (server/daily.js) y lo recogido en un mensaje 'loot'.
import { t } from './i18n.js';
import { prizeHtml, countdown } from './missions.js';
import { item as itemImg } from './pixicons.js';
import { storage } from './net.js';

const SEEN = 'arena.dailySeen';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const dailyViews = {
  dailyReady() { return !!(this.profile && this.profile.daily && this.profile.daily.ready); },
  // Al entrar: se abre sola si hay premio, una vez al día en este navegador (luego sigue en Misiones)
  dailyAuto() {
    if (!this.dailyReady() || storage.get(SEEN) === Data.dayKey()) return;
    storage.set(SEEN, Data.dayKey());
    setTimeout(() => this.dailyModal(), 400);
  },

  // Las 7 casillas: recogidas (✓), la de hoy y las que vienen
  dailyDays(onClaim) {
    const d = this.profile.daily;
    const grid = el('div', 'daily-days');
    Data.DAILY_LOGIN.forEach((rw, i) => {
      const n = i + 1;
      const got = d.claimed ? n <= d.day : n < d.day;
      const today = d.ready && n === d.day;
      const big = n === Data.DAILY_LOGIN.length;
      const main = Object.keys(rw.items || {})[0];
      const tile = el('div', `daily-day${got ? ' got' : ''}${today ? ' today' : ''}${big ? ' big' : ''}`,
        `<small>${t('Día {n}', { n })}</small><span class="dd-art">${itemImg(main, big ? 48 : 36)}</span>
        <div class="m-prize">${prizeHtml(rw)}</div>${got ? '<b class="dd-ok">✓</b>' : ''}`);
      if (today && onClaim) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.onclick = () => { b.disabled = true; onClaim(); };
        tile.append(b);
      }
      grid.append(tile);
    });
    return grid;
  },

  dailyModal() {
    if (!this.profile || !this.profile.daily || document.querySelector('.daily-modal')) return;
    const d = this.profile.daily;
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box daily-modal');
    const close = () => back.remove();
    box.append(el('h3', '', t('Premio diario')),
      el('p', 'small', d.lost ? t('Te saltaste un día y el ciclo ha vuelto a empezar. ¡Entra cada día para llegar al gran premio del día 7!')
        : t('Entra cada día y recoge tu premio: van a más hasta el gran premio del día 7. Si te saltas un día, vuelves al día 1.')));
    box.append(this.dailyDays(() => { this.net.send({ t: 'daily' }); close(); }));
    const acts = el('div', 'acts');
    if (!d.ready) {
      const next = el('p', 'small daily-next', t('Siguiente premio en'));
      next.append(' ', countdown(d.ends));
      acts.append(next);
    }
    const ok = el('button', d.ready ? '' : 'primary', d.ready ? t('Luego') : t('Cerrar'));
    ok.onclick = close;
    acts.append(ok);
    box.append(acts);
    back.append(box);
    back.onclick = e => { if (e.target === back) close(); };
    document.body.append(back);
  },

  // Tarjeta en Misiones: el día del ciclo y el botón para abrir la ventana
  dailyPanel() {
    const d = this.profile.daily;
    const box = el('div', 'panel missions daily-panel' + (d.ready ? ' has-ready' : ''));
    const head = el('div', 'm-head', `<h3>${t('Premio diario')}</h3>`);
    box.append(head);
    const row = el('div', `mission${d.ready ? ' done' : ' claimed'}`,
      `<span class="m-ico">${itemImg(Object.keys(Data.DAILY_LOGIN[d.day - 1].items)[0], 38)}</span>
      <div class="m-body"><b>${t('Día {n} de {total}', { n: d.day, total: Data.DAILY_LOGIN.length })}</b>
      <small>${d.ready ? t('¡Tu premio de hoy te espera!') : t('Recogido. Vuelve mañana a por el siguiente.')}</small>
      <div class="m-prize">${prizeHtml(Data.DAILY_LOGIN[d.day - 1])}</div></div>`);
    const b = el('button', d.ready ? 'primary claim-btn' : '', d.ready ? t('¡Recoger!') : t('Ver'));
    b.onclick = () => this.dailyModal();
    const acts = el('div', 'm-acts');
    acts.append(b);
    row.append(acts);
    box.append(row);
    return box;
  },
};
