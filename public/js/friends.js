// Amigos: añadir por nombre con su etiqueta (Ash#4821) o desde la ficha de un entrenador, solicitudes recibidas
// (aceptar o rechazar) y enviadas (cancelar), y la lista con quién está en línea y qué hace, para ver su perfil o
// quitarlo. Hace falta cuenta (ver server/friends.js)
import { monIcon } from './sprites.js';
import { escapeHtml, tagName } from './battle.js';
import { el } from './ui.js';
import { t, tServer } from './i18n.js';
import { confirmBox } from './dialog.js';
import { icon, item as itemImg } from './pixicons.js';

const DOING = { menu: 'En el menú', combate: 'En combate', cola: 'Buscando partida' };

export const friendViews = {
  // Botón de la barra de arriba: abre Amigos, con un punto si hay solicitudes por responder
  friendsButton() {
    const n = (this.profile.friendIn || []).length;
    const b = el('button', 'tb-btn icon friends-btn', `${icon('user', 24)}${n ? `<i class="nbadge">${n}</i>` : ''}`);
    b.setAttribute('aria-label', t('Amigos'));
    b.onclick = () => this.openFrom('friends');
    return this.hoverTip(b, `<b>${t('Amigos')}</b><p>${n ? t('Tienes {n} solicitudes de amistad.', { n }) : t('Añade amigos, mira si están en línea y su perfil.')}</p>`);
  },

  view_friends() {
    const p = this.profile;
    const wrap = el('div', 'friends-view');
    wrap.append(this.topbar(t('Amigos'), 'menu'));
    const body = el('div', 'friends-body');
    wrap.append(body);
    this.root.append(wrap);
    if (!p.account) {
      const box = el('div', 'panel fr-noacc', `<h3>${t('Crea una cuenta para tener amigos')}</h3><p>${t('Los amigos se guardan con tu cuenta. Créala en tu Perfil: te quedas con todo lo que ya tienes.')}</p>`);
      const go = el('button', 'primary', t('Ir a mi Perfil'));
      go.onclick = () => this.show('profile');
      box.append(go);
      body.append(box);
      return;
    }
    // Añadir
    const add = el('form', 'panel fr-add');
    add.append(el('h3', '', t('Añadir amigo')), el('p', 'small', t('Escribe su nombre con la etiqueta, como sale en su ficha: Ash#4821. Tu nombre es <b>{me}</b>.', { me: tagName(p.name, p.tag) })));
    const row = el('div', 'fr-row');
    const input = el('input', '');
    input.placeholder = 'Ash#4821'; input.maxLength = 30; input.autocomplete = 'off';
    const send = el('button', 'primary', t('Enviar solicitud'));
    row.append(input, send);
    add.append(row);
    add.onsubmit = e => { e.preventDefault(); if (input.value.trim()) this.net.send({ t: 'friend', a: 'add', who: input.value.trim() }); };
    body.append(add);
    this.friendsBox = el('div', 'fr-lists');
    this.friendsBox.append(el('p', 'small', t('Cargando…')));
    body.append(this.friendsBox);
    this.net.send({ t: 'friends' });
  },

  // Llega la lista del servidor
  onFriends(m) {
    this.friendsData = m;
    if (this.view !== 'friends' || !this.friendsBox || !this.friendsBox.isConnected) return;
    const box = this.friendsBox;
    box.innerHTML = '';
    const act = (a, id) => this.net.send({ t: 'friend', a, id });
    const person = (f, extra) => {
      const r = el('div', 'fr-card' + (f.doing ? ' on' : ''));
      const ava = el('span', 'fr-ava');
      if (f.dex) ava.append(monIcon(f.dex, 40, { shiny: f.shiny })); else ava.innerHTML = itemImg('pokeball', 26);
      const doing = f.doing ? t(DOING[f.doing] || 'En línea') : t('Desconectado');
      r.append(ava, el('div', 'fr-info', `<b>${tagName(f.name, f.tag)}</b><small><i class="dot${f.doing ? ' on' : ''}"></i> ${escapeHtml(doing)}${f.ranked ? ` · ${f.elo} ELO` : ''}</small>`));
      const btns = el('div', 'fr-acts');
      for (const [label, cls, fn] of extra) { const b = el('button', cls, label); b.onclick = fn; btns.append(b); }
      r.append(btns);
      return r;
    };
    if (m.in.length) {
      const sec = el('section', 'panel fr-sec in');
      sec.append(el('h3', '', `${t('Solicitudes de amistad')} <i class="nbadge">${m.in.length}</i>`));
      for (const f of m.in) sec.append(person(f, [[t('Aceptar'), 'primary', () => act('accept', f.id)], [t('Rechazar'), '', () => act('decline', f.id)]]));
      box.append(sec);
    }
    const sec = el('section', 'panel fr-sec');
    sec.append(el('h3', '', `${t('Tus amigos')} <small>${m.friends.filter(f => f.doing).length} ${t('en línea')} · ${m.friends.length}</small>`));
    if (!m.friends.length) sec.append(el('p', 'small', t('Todavía no tienes amigos. Pídele a alguien su nombre con la etiqueta, o añádelo desde su ficha en los rankings.')));
    for (const f of m.friends) sec.append(person(f, [[t('Ver perfil'), '', () => this.userModal(f.id)],
      [t('Quitar'), 'danger', () => confirmBox({ title: t('¿Quitar amigo?'), text: t('¿Quitar a {name} de tus amigos?', { name: f.name }), ok: t('Quitar'), cancel: t('Cancelar'), danger: true }).then(y => { if (y) act('remove', f.id); })]]));
    box.append(sec);
    if (m.out.length) {
      const out = el('section', 'panel fr-sec out');
      out.append(el('h3', '', t('Solicitudes enviadas')));
      for (const f of m.out) out.append(person(f, [[t('Cancelar'), '', () => act('cancel', f.id)]]));
      box.append(out);
    }
  },

  // Botón de amistad en la ficha de otro entrenador (Añadir, Pendiente o Amigos)
  friendAction(u) {
    const p = this.profile;
    if (!p.account || u.id === p.id) return null;
    if ((p.friends || []).includes(u.id)) return el('span', 'fr-tag', `✓ ${t('Amigos')}`);
    if ((p.friendOut || []).includes(u.id)) return el('span', 'fr-tag', t('Solicitud enviada'));
    const b = el('button', '', (p.friendIn || []).some(x => x.id === u.id) ? t('Aceptar solicitud') : t('Añadir amigo'));
    b.onclick = () => { b.disabled = true; this.net.send({ t: 'friend', a: 'add', who: u.id }); };
    return b;
  },
};

// Avisos que llegan del servidor
export function friendNotices(net, ui) {
  net.on('friends', m => ui.onFriends(m));
  net.on('friendok', m => ui.toast(tServer(m.msg)));
  net.on('friendreq', m => ui.toast(t('{name} quiere ser tu amigo', { name: `${m.name}#${m.tag}` })));
}
