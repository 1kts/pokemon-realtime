// Pantallas de cuenta y publicación: portada con invitado / inicio de sesión / registro, perfil
// (estadísticas, historial, títulos, marcos, avatar, contraseña), recompensas de clasificatoria,
// novedades y aviso legal. Se añaden como métodos de UI (ver el final de ui.js).
import { portrait, animatedPortrait, monIcon } from './sprites.js';
import { escapeHtml } from './battle.js';
import { Net, storage } from './net.js';
import { t, locale, LANGS, LANG_CODES, getLang, setLang } from './i18n.js';
import { flag } from './flags.js';
import { icon, badgeImg } from './pixicons.js';
import { showcaseHtml, FRAME_LABEL_EXTRA } from './achievements.js';
import { avatarArt, avatarName } from './missions.js';
import { frameFx, frameRing, frameBadge, auraHtml, applySkin } from './frames.js';
import { CURSOR_COLORS, cursorSvg, getCursor, setCursor } from './cursor.js';
import { DEFAULT_VOLUME as DEFAULT_MUSIC } from './music.js';
import { DEFAULT_SFX } from './sfx.js';

const KOFI_URL = 'https://ko-fi.com/1kts_';

const { SPECIES, SHOP, LEAGUES, SEASON, RANKED_REWARDS, SEASON_REWARDS, RANKED_PAY, STARTERS } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const coins = n => `<span class="coin">${icon('coin', 16)}</span>${n.toLocaleString(locale())}`;
const VERSION = CHANGELOG[0].v;
// Cómo se enseña el usuario de la cuenta: @nombre, o el correo tal cual
const handle = u => (u.includes('@') ? u : '@' + u);
const GEAR_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.6 3.6.9.7-1.3 2.3-1.1-.4a5 5 0 0 1-1.4.8l-.2 1.2H7.9l-.2-1.2a5 5 0 0 1-1.4-.8l-1.1.4-1.3-2.3.9-.7a5 5 0 0 1 0-1.6l-.9-.7 1.3-2.3 1.1.4a5 5 0 0 1 1.4-.8l.2-1.2h2.6l.2 1.2a5 5 0 0 1 1.4.8l1.1-.4 1.3 2.3-.9.7a5 5 0 0 1 0 1.6Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const BOOK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2v-9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5h4M6 7h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const GLOBE_SVG = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2.6 4.2 2.6 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.4 5.7 5.4 8S6 12.5 8 14.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const SEEN_KEY = 'arena.seenVersion';
const TAG_LABEL = { nuevo: 'Nuevo', cambio: 'Cambio', arreglo: 'Arreglo' };
const FRAME_LABEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante', maestro: 'Maestro', ...FRAME_LABEL_EXTRA };
const frameLabel = f => f.startsWith('tipo-') ? t('Maestría {type}', { type: Data.TYPE_LABEL[f.slice(5)] }) : t(FRAME_LABEL[f] || f);
const swatch = f => `<i class="sw frame-${f || 'none'}"${frameRing(f) ? ` style="--ring:${frameRing(f)}"` : ''}></i>`;
const itemName = id => (SHOP.find(i => i.id === id) || { name: id }).name;
const fmtDate = ts => new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = () => Math.max(0, Math.ceil((new Date(SEASON.end + 'T23:59:59') - Date.now()) / 86400000));
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('ahora');
  if (m < 60) return t('hace {n} min', { n: m });
  const h = Math.round(m / 60);
  return h < 24 ? t('hace {n} h', { n: h }) : t('hace {n} d', { n: Math.round(h / 24) });
}

// Campo de formulario con etiqueta
function field(label, type, opts = {}) {
  const wrap = el('label', 'field', `<span>${t(label)}</span>`);
  const input = el('input');
  input.type = type;
  Object.assign(input, opts);
  wrap.append(input);
  return [wrap, input];
}

function modal(cls, build) {
  const back = el('div', 'modal');
  const box = el('div', 'panel modal-box ' + cls);
  const close = () => back.remove();
  build(box, close);
  back.append(box);
  back.onclick = e => { if (e.target === back) close(); };
  document.body.append(back);
  return close;
}

export const accountViews = {
  // ---------- Portada ----------
  view_title() {
    const box = el('div', 'panel title-panel');
    box.innerHTML = `<div class="emblem"></div><h1 class="logo">Poké<br><span>Arenas</span></h1><p class="tag">${t('Combates Pokémon en tiempo real · 966 Pokémon de 9 generaciones')}</p>`;
    const mons = el('div', 'title-mons');
    for (const d of [...STARTERS].sort(() => Math.random() - 0.5).slice(0, 3)) mons.append(animatedPortrait(d, 96, 'Idle'));
    box.append(mons);
    const form = el('div', 'auth');
    box.append(form);
    const saved = Net.hasSession() && Net.savedName();
    this.authTab = this.authTab || (saved ? 'continue' : 'guest');
    const render = () => {
      form.innerHTML = '';
      box.classList.toggle('compact', this.authTab === 'login' || this.authTab === 'register');
      this.authMsg = el('p', 'auth-msg');
      if (this.authTab === 'continue') {
        const go = el('button', 'primary', t('Continuar como <b>{name}</b>', { name: escapeHtml(saved) }));
        go.onclick = () => { go.disabled = true; go.textContent = t('Conectando…'); this.app.connect(saved); };
        const other = el('button', 'link', t('Entrar con otra cuenta'));
        other.onclick = () => { this.authTab = 'login'; render(); };
        form.append(go, other, this.authMsg);
        setTimeout(() => go.focus(), 50);
        return;
      }
      const tabs = el('div', 'auth-tabs');
      for (const [id, label] of [['guest', 'Invitado'], ['login', 'Iniciar sesión'], ['register', 'Crear cuenta']]) {
        const tab = el('button', id === this.authTab ? 'sel' : '', t(label));
        tab.onclick = () => { this.authTab = id; render(); };
        tabs.append(tab);
      }
      form.append(tabs);
      let submit;
      if (this.authTab === 'guest') {
        const [f, name] = field('Nombre de entrenador', 'text', { maxLength: 16, value: Net.savedName(), autocomplete: 'nickname' });
        const go = el('button', 'primary', t('Jugar'));
        submit = () => { go.disabled = true; go.textContent = t('Conectando…'); this.app.connect(name.value.trim() || t('Entrenador')); };
        go.onclick = submit;
        form.append(f, go, el('p', 'small', t('Tu partida se guarda en este navegador. Crea una cuenta cuando quieras desde tu perfil para no perderla.')));
        setTimeout(() => name.focus(), 50);
      } else {
        const reg = this.authTab === 'register';
        const [fu, user] = field('Usuario o correo', 'text', { maxLength: 64, autocomplete: 'username', spellcheck: false, autocapitalize: 'off' });
        const [fp, pass] = field('Contraseña', 'password', { maxLength: 72, autocomplete: reg ? 'new-password' : 'current-password' });
        form.append(fu, fp);
        let pass2;
        if (reg) { const [f2, p2] = field('Repite la contraseña', 'password', { maxLength: 72, autocomplete: 'new-password' }); pass2 = p2; form.append(f2); }
        const go = el('button', 'primary', reg ? t('Crear cuenta y jugar') : t('Entrar'));
        submit = () => {
          if (reg && pass.value !== pass2.value) return this.authError(t('Las contraseñas no coinciden'));
          this.authError('');
          go.disabled = true;
          this.authBtn = go;
          this.net.auth({ t: reg ? 'register' : 'login', user: user.value.trim(), pass: pass.value });
        };
        go.onclick = submit;
        form.append(go);
        if (reg) form.append(el('p', 'small', t('Usuario de 3 a 24 letras, números, _ . o -, o tu correo. Contraseña de al menos 6 caracteres.')));
        else if (Net.hasSession()) form.append(el('p', 'warn', t('Si entras con otra cuenta, este navegador dejará de recordar tu partida de invitado. Regístrala antes desde tu perfil.')));
        setTimeout(() => user.focus(), 50);
      }
      form.append(this.authMsg);
      form.querySelectorAll('input').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') submit(); }; });
    };
    render();
    const lang = this.langPicker();
    lang.classList.add('corner');
    box.append(lang);
    this.root.append(box);
  },

  authError(msg) {
    if (this.authMsg) { this.authMsg.textContent = msg; this.authMsg.className = 'auth-msg' + (msg ? ' bad' : ''); }
    if (this.authBtn) this.authBtn.disabled = false;
  },

  // Botón de apoyo con corazón para la barra superior (mismo enlace a Ko-fi)
  // Tarjeta que sale al pasar el ratón (o con el foco) por un botón de la barra superior
  hoverTip(node, html, cls = '') {
    const wrap = el('span', 'tip-wrap');
    const tip = el('div', 'tb-tip ' + cls, html);
    tip.setAttribute('role', 'tooltip');
    node.removeAttribute('title');   // la tarjeta sustituye al título nativo
    wrap.append(node, tip);
    return wrap;
  },

  // Al pasar el ratón, lo que cuesta de verdad mantener el juego
  supportButton() {
    const a = el('a', 'tb-btn support', `${icon('heart', 24)}<span>${t('Apoyar')}</span>`);
    a.href = KOFI_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', t('Apoyar'));
    return this.hoverTip(a, `<b>${t('Lo que cuesta mantener PokéArenas')}</b>
      <ul><li><span>${t('Servidor')}</span><b>${t('unos 10 € al mes')}</b></li><li><span>${t('Dominio')}</span><b>${t('12 € al año')}</b></li></ul>
      <p>${t('Las donaciones ayudan a cubrir estos gastos. El juego es gratis, sin anuncios, y donar no da ninguna ventaja.')}</p>`, 'support-tip');
  },


  // Selector de idioma: cambia los textos y vuelve a pintar la pantalla actual
  // Selector de idioma de la portada: botón con la bandera y el código que abre la lista de idiomas
  langPicker() {
    const wrap = el('div', 'lang-pick');
    const cur = getLang();
    const btn = el('button', 'lang-cur', `${flag(cur)}<b>${LANG_CODES[cur] || cur.toUpperCase()}</b><i class="chev"></i>`);
    btn.title = 'Idioma / Language';
    btn.setAttribute('aria-haspopup', 'listbox');
    const menu = el('div', 'lang-menu');
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    for (const [id, name] of Object.entries(LANGS)) {
      const o = el('button', 'lang-item' + (id === cur ? ' sel' : ''), `${flag(id)}<span>${name}</span><small>${LANG_CODES[id] || id.toUpperCase()}</small>`);
      o.setAttribute('role', 'option');
      o.onclick = () => { menu.hidden = true; setLang(id).then(ok => { if (ok) { this.app.onLang(); this.show(this.view); } }); };
      menu.append(o);
    }
    // Se cierra al pulsar fuera
    const outside = e => { if (!wrap.contains(e.target)) { menu.hidden = true; document.removeEventListener('pointerdown', outside); } };
    btn.onclick = () => {
      menu.hidden = !menu.hidden;
      if (!menu.hidden) document.addEventListener('pointerdown', outside);
    };
    wrap.append(btn, menu);
    return wrap;
  },


  // ---------- Novedades ----------
  hasNews() { return storage.get(SEEN_KEY) !== VERSION; },

  patchNotes() {
    storage.set(SEEN_KEY, VERSION);
    document.querySelectorAll('.ndot.news').forEach(d => d.remove());
    modal('notes', (box, close) => {
      box.append(el('h3', '', t('Novedades')));
      const list = el('div', 'notes-list scroll');
      CHANGELOG.forEach((r, i) => {
        const sec = el('section', i === 0 ? 'current' : '');
        sec.append(el('div', 'nv', `<b>v${r.v}</b><span>${escapeHtml(t(r.title))}</span><small>${fmtDate(r.date)}</small>${i === 0 ? `<em>${t('actual')}</em>` : ''}`));
        sec.append(el('ul', '', r.items.map(([tag, text]) => `<li><span class="ntag ${tag}">${t(TAG_LABEL[tag])}</span>${escapeHtml(t(text))}</li>`).join('')));
        list.append(sec);
      });
      const acts = el('div', 'acts');
      const ok = el('button', 'primary', t('¡A jugar!'));
      ok.onclick = close;
      acts.append(ok);
      box.append(list, acts);
    });
  },

  legal() {
    modal('legal', (box, close) => {
      box.append(el('h3', '', t('Créditos y aviso legal')));
      box.append(el('div', 'scroll', `
        <p>${t('PokéArenas es un <b>proyecto de fans sin ánimo de lucro</b>. No está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios.')}</p>
        <p>${t('Los sprites proceden de la comunidad de <i>Pokémon Mundo Misterioso</i> (PMD Sprite Collab) y se usan con atribución a sus artistas. Los datos de especies vienen de PokéAPI. Los mapas de región son dibujos propios.')}</p>
        <p>${t('Los iconos de objetos vienen de PokeAPI y los iconos pixel art de la interfaz, de PokéSurvivor (JPTER78, licencia PolyForm Noncommercial).')}</p>
        <p>${t('La música de los menús y los combates es de jannetty, rckbtm, Navet56 (OPMon Lazuli) y Spring Spring, con su permiso o con licencia CC BY.')}</p>
        <p>${t('Los artistas de cada sprite, las licencias y la política de privacidad completa están en el <a href="{url}" target="_blank" rel="noopener">aviso legal</a>.', { url: getLang() === 'es' ? '/legal' : '/legal/en' })}</p>
        <p>${t('El juego es gratis y lo seguirá siendo. Si quieres ayudar a pagar el servidor, puedes invitarme a un café en <a href="{url}" target="_blank" rel="noopener noreferrer">Ko-fi</a>. Donar no da ninguna ventaja en el juego.', { url: KOFI_URL })}</p>
        <h4>${t('Datos que guardamos')}</h4>
        <p class="small">${t('Guardamos tu nombre de entrenador y tu partida; si creas cuenta, tu usuario y tu contraseña cifrada (scrypt con sal); y, durante 40 días, un registro de seguridad con tu IP. No hay publicidad, cookies ni seguimiento. Para borrar tu cuenta o cualquier duda: contact@pokearenas.com.')}</p>`));
      const acts = el('div', 'acts');
      const ok = el('button', 'primary', t('Cerrar'));
      ok.onclick = close;
      acts.append(ok);
      box.append(acts);
    });
  },

  // El servidor ya va por otra versión (se ha desplegado mientras jugabas). La partida está en el
  // servidor, así que recargar no pierde nada: en los menús se recarga sola tras 5 s de aviso; en
  // cola, draft, combate, resultados, con una ventana abierta o escribiendo, espera a que acabe.
  versionCheck(serverVersion) {
    if (!serverVersion || serverVersion === VERSION || document.getElementById('update-bar')) return;
    const bar = el('div');
    bar.id = 'update-bar';
    const text = el('span');
    const b = el('button', 'primary', t('Recargar'));
    b.onclick = () => location.reload();
    bar.append(text, b);
    document.body.append(bar);
    const idle = () => !this.app.battle && !['queue', 'draft', 'results'].includes(this.view) && !document.querySelector('.modal')
      && !document.activeElement?.matches('input, textarea, select');
    let left = 5;
    const tick = () => {
      if (!idle()) { left = 5; text.textContent = t('Hay una versión nueva (v{v}): se cargará al terminar lo que estás haciendo.', { v: serverVersion }); }
      else if (left === 0) return location.reload();
      else text.textContent = t('Hay una versión nueva (v{v}). Recargando en {n} s…', { v: serverVersion, n: left-- });
      setTimeout(tick, 1000);
    };
    tick();
  },

  // Premios de fin de temporada pendientes de ver
  showInbox() {
    const p = this.profile;
    if (!p.inbox || !p.inbox.length || this.inboxOpen) return;
    this.inboxOpen = true;
    modal('inbox', (box, close) => {
      box.append(el('h3', '', t('¡Ha terminado la temporada!')));
      for (const m of p.inbox) {
        box.append(el('p', '', t('Temporada {n}: llegaste a <b>{league}</b>. Premio: {prize}.', { n: m.season, league: t(m.league), prize: coins(m.coins) + (m.title ? ' ' + t('y el título {title}', { title: `<b class="title-chip">${escapeHtml(t(m.title))}</b>` }) : '') })));
      }
      box.append(el('p', 'small', t('Empieza {season}. Tu ELO se ha acercado a 1000 y los premios por liga se pueden volver a ganar.', { season: t(SEASON.name) })));
      const acts = el('div', 'acts');
      const ok = el('button', 'primary', t('Recoger'));
      ok.onclick = close;
      acts.append(ok);
      box.append(acts);
    });
    // Se marca como leído en cuanto se enseña
    this.net.send({ t: 'inboxread' });
    setTimeout(() => { this.inboxOpen = false; }, 500);
  },

  // ---------- Avatar con marco ----------
  // { dex, shiny }: el elegido, o si no el primero del equipo tal como se ve
  avatarDex() {
    const p = this.profile;
    if (p.avatar && SPECIES[p.avatar]) return { dex: p.avatar, shiny: !!p.avatarShiny };
    const leadUid = p.teams && (p.teams[this.region || 'kanto'] || [])[0];
    const lead = p.mons.find(m => m.uid === leadUid) || p.mons[0];
    return lead ? { dex: lead.dex, shiny: Data.looksShiny(lead) } : { dex: 25, shiny: false };
  },

  // frame / aura: para previsualizar otro marco o brillo (undefined = el del perfil)
  avatar(size, animated, frame, aura) {
    const p = this.profile;
    const f = frame === undefined ? p.frame || null : frame;
    const au = aura === undefined ? p.aura || null : aura;
    const a = el('div', 'ava frame-' + (f || 'none'));
    a.style.setProperty('--s', size + 'px');
    if (frameRing(f)) a.style.setProperty('--ring', frameRing(f));
    if (au) a.insertAdjacentHTML('afterbegin', auraHtml(au));
    // Avatar de colección (medalla o icono de logro)
    if (typeof p.avatar === 'string' && avatarArt(p.avatar, size)) {
      a.classList.add('ava-icon');
      a.append(el('span', 'ava-pic', avatarArt(p.avatar, size)));
      a.insertAdjacentHTML('beforeend', frameFx(f));
      return a;
    }
    const { dex, shiny } = this.avatarDex();
    const pic = el('span', 'ava-pic');
    const sprite = () => animated ? animatedPortrait(dex, size, 'Idle', shiny) : portrait(dex, size, { shiny });
    if (p.avatar && p.avatarArt) {
      const img = el('img', 'ava-art');
      img.src = `art/${shiny ? 'shiny/' : ''}${dex}.png`; img.alt = ''; img.draggable = false;
      img.onerror = () => img.replaceWith(sprite());   // sin conexión con PokeAPI: el sprite de siempre
      pic.append(img);
    } else {
      pic.append(sprite());
      applySkin(pic, Data.skinOf(p, dex), dex);
    }
    a.append(pic);
    a.insertAdjacentHTML('beforeend', frameFx(f));
    return a;
  },

  // Botón de la barra superior: avatar, nombre y acceso al perfil (con aviso si hay algo que reclamar)
  profileChip() {
    const p = this.profile;
    const b = el('button', 'me-chip');
    b.append(this.avatar(30));
    b.append(el('span', '', escapeHtml(p.name)));
    if (this.claimable().length || !p.account) b.append(el('i', 'ndot'));
    b.setAttribute('aria-label', t('Perfil'));
    b.onclick = () => this.show('profile');
    const ready = this.claimable().length;
    return this.hoverTip(b, `<b>${escapeHtml(p.name)}</b><span class="tip-sub">${t(p.league)} · ${p.elo} ELO${p.account ? ` · ${escapeHtml(handle(p.account.user))}` : ''}</span>
      <p>${t('Tu perfil: tarjeta de entrenador, historial, títulos, marcos y cuenta.')}</p>
      ${!p.account ? `<p class="tip-warn">${t('Invitado: crea una cuenta para no perder tu partida.')}</p>` : ''}
      ${ready ? `<p class="tip-good">${ready > 1 ? t('¡{n} premios por reclamar!', { n: ready }) : t('¡1 premio por reclamar!')}</p>` : ''}`);
  },

  // Icono de diario en el menú: abre las novedades (con un punto si hay algo sin ver)
  newsIcon() {
    const b = el('button', 'tb-btn icon news-btn', `${icon('book', 24)}${this.hasNews() ? '<i class="ndot news"></i>' : ''}`);
    b.setAttribute('aria-label', t('Novedades'));
    b.onclick = () => this.patchNotes();
    return this.hoverTip(b, `<b>${t('Novedades de la v{v}', { v: VERSION })}</b><p>${escapeHtml(t(CHANGELOG[0].title))}</p>
      <p class="${this.hasNews() ? 'tip-good' : ''}">${this.hasNews() ? t('Hay novedades que aún no has leído.') : t('Lo nuevo de cada versión del juego.')}</p>`);
  },

  // Botón de la barra superior que lleva a Ajustes
  settingsButton() {
    const b = el('button', 'tb-btn settings-btn', `${icon('gear', 24)}<span>${t('Ajustes')}</span>`);
    b.setAttribute('aria-label', t('Ajustes'));
    b.onclick = () => this.show('settings');
    return this.hoverTip(b, `<b>${t('Ajustes')}</b><p>${t('Idioma, perfil y cuenta, novedades y créditos.')}</p>`);
  },

  // ---------- Ajustes ----------
  view_settings() {
    const p = this.profile;
    const wrap = el('div', 'settings-view');
    wrap.append(this.topbar(t('Ajustes'), 'menu'));
    const body = el('div', 'settings-body scroll');

    // Idioma: un botón por idioma
    const lang = el('div', 'panel');
    lang.append(el('h3', '', `${GLOBE_SVG} ${t('Idioma')}`), el('p', 'small', t('Cambia los textos del juego al momento. Se recuerda en este navegador.')));
    const langs = el('div', 'lang-list');
    for (const [id, name] of Object.entries(LANGS)) {
      const b = el('button', 'lang-opt' + (id === getLang() ? ' sel' : ''), `${flag(id)}<span><b>${name}</b><small>${LANG_CODES[id] || id.toUpperCase()}</small></span>`);
      b.onclick = () => setLang(id).then(ok => { if (ok) { this.app.onLang(); this.show('settings'); } });
      langs.append(b);
    }
    lang.append(langs);

    // Sonido: volumen de la música y de los efectos del combate (se guardan en este navegador) y silenciar
    const mus = el('div', 'panel music-panel');
    mus.append(el('h3', '', `♫ ${t('Música')}`), el('p', 'small', t('Un tema para los menús y otros para cada tipo de combate, de músicos de la comunidad. Los efectos son el sonido de los ataques y los golpes. Se recuerda en este navegador.')));
    const volumeRow = (player, cls, label, off, def, test) => {
      const row = el('div', 'music-row ' + cls);
      row.append(el('span', 'music-label', label));
      const range = el('input');
      Object.assign(range, { type: 'range', min: 0, max: 100, step: 5, value: Math.round(player.volume * 100) });
      range.setAttribute('aria-label', label);
      const pct = el('b', 'music-pct', `${range.value} %`);
      const mute = el('button', player.volume ? '' : 'sel', player.volume ? t('Silenciar') : off);
      range.oninput = () => { player.setVolume(range.value / 100); pct.textContent = `${range.value} %`; mute.textContent = +range.value ? t('Silenciar') : off; mute.classList.toggle('sel', !+range.value); };
      if (test) range.onchange = test;   // al soltar, se oye cómo queda
      mute.onclick = () => { range.value = +range.value ? 0 : Math.round(def * 100); range.oninput(); if (test) test(); };
      row.append(range, pct, mute);
      return row;
    };
    const sfx = this.app.sfx;
    mus.append(volumeRow(this.app.music, 'music-vol', t('Volumen de la música'), t('Sin música'), DEFAULT_MUSIC),
      volumeRow(sfx, 'sfx-vol', t('Efectos de sonido'), t('Sin efectos'), DEFAULT_SFX, () => { sfx.start(); sfx.hit({ e: 1 }); }));

    // Color del cursor: paleta, color libre y vista previa (normal y al pasar por algo pulsable)
    const cursorBox = el('div', 'panel cursor-panel');
    cursorBox.append(el('h3', '', t('Cursor')), el('p', 'small', t('Elige el color del ratón. También tiñe la retícula para apuntar en combate. Se recuerda en este navegador.')));
    const chosen = getCursor();
    const sw = el('div', 'cursor-list');
    const pick = c => { setCursor(c); this.show('settings', true); };
    for (const c of CURSOR_COLORS) {
      const b = el('button', 'cursor-opt' + (chosen === c ? ' sel' : ''), `<img src="data:image/svg+xml,${encodeURIComponent(cursorSvg(c))}" width="28" height="28" alt="">${c === 'classic' ? `<small>${t('Clásico')}</small>` : ''}`);
      b.title = c === 'classic' ? t('Clásico') : c;
      if (c !== 'classic') b.style.setProperty('--sw', c);
      b.onclick = () => pick(c);
      sw.append(b);
    }
    // Color libre: el selector del sistema detrás de un botón con el estilo del juego
    const custom = !CURSOR_COLORS.includes(chosen);
    const free = el('label', 'cursor-opt custom' + (custom ? ' sel' : ''), `<img src="data:image/svg+xml,${encodeURIComponent(cursorSvg(custom ? chosen : '#ffffff'))}" width="28" height="28" alt=""><small>${t('Otro color')}</small>`);
    const input = el('input');
    input.type = 'color';
    input.value = custom ? chosen : '#4fd6ff';
    input.onchange = () => pick(input.value);
    free.append(input);
    sw.append(free);
    cursorBox.append(sw);
    const prev = el('div', 'cursor-preview', `<span><img src="data:image/svg+xml,${encodeURIComponent(cursorSvg(chosen))}" width="42" height="42" alt=""><small>${t('Normal')}</small></span>
      <span><img src="data:image/svg+xml,${encodeURIComponent(cursorSvg(chosen, true))}" width="42" height="42" alt=""><small>${t('Al pasar por un botón')}</small></span>`);
    cursorBox.append(prev);

    // Perfil y cuenta
    const me = el('div', 'panel');
    me.append(el('h3', '', t('Perfil y cuenta')));
    const who = el('button', 'who settings-who');
    who.append(this.avatar(64), el('div', '', `<b>${escapeHtml(p.name)}</b><span class="elo">${t(p.league)} · ${p.elo}</span><small>${p.account ? t('Cuenta <b>{user}</b>', { user: escapeHtml(handle(p.account.user)) }) : t('Invitado')}</small>`));
    who.onclick = () => this.show('profile');
    me.append(who);
    if (!p.account) me.append(el('p', 'warn', t('Juegas como invitado: tu partida solo vive en este navegador. Si borras sus datos o cambias de dispositivo, la perderás.')));
    const open = el('button', 'primary', t('Abrir perfil'));
    open.onclick = () => this.show('profile');
    me.append(el('p', 'small', t('Nombre, título, marco, avatar, historial y contraseña.')), open);

    // Novedades
    const news = el('div', 'panel');
    const cur = CHANGELOG[0];
    news.append(el('h3', '', `${t('Novedades')}${this.hasNews() ? ' <i class="ndot news"></i>' : ''}`),
      el('p', 'small', `<b>v${cur.v}</b> · ${escapeHtml(t(cur.title))} · ${fmtDate(cur.date)}`),
      el('ul', 'news-peek', cur.items.slice(0, 4).map(([tag, text]) => `<li><span class="ntag ${tag}">${t(TAG_LABEL[tag])}</span>${escapeHtml(t(text))}</li>`).join('')));
    const all = el('button', '', t('Ver todas las novedades'));
    all.onclick = () => this.patchNotes();
    news.append(all);

    // Créditos
    const about = el('div', 'panel');
    about.append(el('h3', '', t('Créditos y aviso legal')), el('p', 'small', t('PokéArenas es un <b>proyecto de fans sin ánimo de lucro</b>. No está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios.')));
    const legal = el('button', '', t('Ver créditos y datos que guardamos'));
    legal.onclick = () => this.legal();
    about.append(legal, el('p', 'small', `PokéArenas v${VERSION}`));

    body.append(lang, mus, cursorBox, me, news, about);
    wrap.append(body);
    this.root.append(wrap);
  },

  // ---------- Perfil ----------
  view_profile() {
    const p = this.profile;
    const wrap = el('div', 'profile-view');
    wrap.append(this.topbar(t('Perfil'), 'menu'));
    const body = el('div', 'pv-body scroll');
    const left = el('div', 'pv-col');
    const mid = el('div', 'pv-col');
    const right = el('div', 'pv-col');

    // Tarjeta de entrenador
    const card = el('div', 'panel trainer-card');
    card.append(this.avatar(120, true));
    const info = el('div', 'tc-info');
    const nameRow = el('div', 'name-row', `<h2>${escapeHtml(p.name)}</h2>`);
    const edit = el('button', 'icon', '✎');
    edit.title = t('Cambiar nombre');
    edit.onclick = () => {
      nameRow.innerHTML = '';
      const input = el('input');
      input.maxLength = 16; input.value = p.name;
      const save = el('button', 'primary', t('Guardar'));
      const done = () => { const v = input.value.trim(); if (v && v !== p.name) this.net.send({ t: 'name', name: v }); else this.show('profile'); };
      save.onclick = done;
      input.onkeydown = e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') this.show('profile'); };
      nameRow.append(input, save);
      input.focus(); input.select();
    };
    nameRow.append(edit);
    info.append(nameRow);
    if (p.title) info.append(el('span', 'title-chip', escapeHtml(t(p.title))));
    if ((p.showcase || []).length) info.append(el('div', '', showcaseHtml(p.showcase, 44)));
    info.append(el('p', 'small', p.account
      ? t('Cuenta <b>{user}</b> · desde {date}', { user: escapeHtml(handle(p.account.user)), date: fmtDate(p.account.since) })
      : `<span class="warn">${t('Invitado')}</span> · ${t('jugando desde {date}', { date: fmtDate(p.created) })}`));
    info.append(el('div', 'tc-league', `<span class="league">${t(p.league)}</span><span class="elo">${p.elo} ELO</span>${this.rank ? `<span class="pill">${t('#{n} del ranking', { n: this.rank })}</span>` : ''}`));
    card.append(info);
    left.append(card);

    // Estuche de medallas: las 8 de cada región, a color las ganadas
    const caseBox = el('div', 'panel badge-case');
    caseBox.append(el('h3', '', t('Medallas')));
    for (const rid of Data.REGION_IDS) {
      const prog = Data.progOf(p, rid), leaders = Data.leadersOf(rid).slice(0, 8);
      const row = el('div', 'case-row');
      row.append(el('b', 'case-region', `${Data.REGIONS[rid].name}<small>${Math.min(8, prog)}/8</small>`));
      const slots = el('div', 'case-slots');
      const avatars = (p.cosmetics && p.cosmetics.avatars) || [];
      leaders.forEach((g, i) => {
        const got = i < prog;
        // Ganada y sin recoger su avatar: brilla y se recoge al pulsarla
        const ready = got && !avatars.includes(Data.badgeAvatar(rid, i));
        const slot = el(ready ? 'button' : 'span', 'case-slot' + (got ? ' got' : '') + (ready ? ' ready' : ''), badgeImg(rid, i, got, 44));
        slot.title = ready ? t('¡Recoge el avatar de la {badge}!', { badge: g.badge }) : got ? `${g.badge} · ${g.leader}` : t('Vence a {who} para conseguirla', { who: g.leader });
        if (ready) slot.onclick = () => { slot.disabled = true; this.net.send({ t: 'badgeclaim', region: rid, index: i }); };
        slots.append(slot);
      });
      row.append(slots);
      caseBox.append(row);
    }
    left.append(caseBox);

    // Estadísticas
    const total = Object.keys(SPECIES).length;
    const games = p.wins + p.losses;
    const badges = Data.REGION_IDS.map(r => Math.min(8, Data.progOf(p, r))).reduce((a, b) => a + b, 0);
    const stat = (label, value) => `<div class="stat"><small>${t(label)}</small><b>${value}</b></div>`;
    left.append(el('div', 'panel', `<h3>${t('Clasificatoria')}</h3><div class="stat-grid">
      ${stat('ELO', p.elo)}${stat('Mejor ELO', p.peakElo || p.elo)}${stat('Victorias', p.wins)}
      ${stat('Derrotas', p.losses)}${stat('% victorias', games ? Math.round(p.wins / games * 100) + ' %' : '—')}${stat('Puesto', this.rank ? '#' + this.rank : '—')}</div>`));
    left.append(el('div', 'panel', `<h3>${t('Historia')}</h3><div class="stat-grid">
      ${stat('Medallas', `${badges}/${8 * Data.REGION_IDS.length}`)}${stat('Pokédex', `${p.caught.length}/${total}`)}${stat('Pokémon', p.mons.length)}
      ${stat('Shinies', p.mons.filter(m => m.shiny).length)}${stat('Dinero', coins(p.coins))}${stat('Campeón', Data.REGION_IDS.filter(r => Data.progOf(p, r) >= Data.leadersOf(r).length).map(r => Data.REGIONS[r].name).join(', ') || '—')}</div>`));


    // Historial
    const hist = el('div', 'panel history');
    hist.append(el('h3', '', t('Últimas clasificatorias')));
    if (!(p.history || []).length) hist.append(el('p', 'small', t('Aún no has jugado ninguna. ¡Prueba en Clasificatoria!')));
    for (const h of p.history || []) {
      const row = el('div', 'h-row ' + (h.won ? 'won' : 'lost'));
      row.append(el('b', 'res', h.won ? t('V') : t('D')));
      const team = el('div', 'h-team');
      for (const d of h.team || []) team.append(monIcon(d, 40));
      team.append(el('span', 'vs', 'vs'));
      for (const d of h.foeTeam || []) team.append(monIcon(d, 40));
      row.append(team);
      row.append(el('div', 'h-info', `<span>${escapeHtml(h.foe)} <small>(${h.foeElo})</small></span><small>${ago(h.at)}</small>`));
      row.append(el('b', 'delta', `${h.delta >= 0 ? '+' : ''}${h.delta}`));
      hist.append(row);
    }
    mid.append(this.achievementsPanel());
    mid.append(hist);

    // Personalizar
    const look = el('div', 'panel look');
    look.append(el('h3', '', t('Personalizar')));
    const cos = p.cosmetics || { titles: [], frames: [] };
    const titles = el('div', 'chips');
    for (const ti of [null, ...cos.titles]) {
      const b = el('button', 'chip' + ((p.title || null) === ti ? ' sel' : ''), ti ? escapeHtml(t(ti)) : t('Sin título'));
      b.onclick = () => this.net.send({ t: 'look', title: ti });
      titles.append(b);
    }
    look.append(el('h4', '', t('Título')), titles);
    const frames = el('div', 'frame-grid');
    for (const f of [null, ...cos.frames]) {
      const b = el('button', 'frame-opt' + ((p.frame || null) === f ? ' sel' : ''));
      b.append(this.avatar(44, false, f), el('small', '', f ? frameLabel(f) : t('Ninguno')));
      b.onclick = () => this.net.send({ t: 'look', frame: f });
      frames.append(b);
    }
    look.append(el('h4', '', t('Marco')), frames);
    // Brillo de burbuja: los conseguidos con la maestría
    const auras = el('div', 'frame-grid');
    for (const au of [null, ...(cos.auras || [])]) {
      const b = el('button', 'frame-opt' + ((p.aura || null) === au ? ' sel' : ''));
      b.append(this.avatar(44, false, undefined, au), el('small', '', !au ? t('Ninguno') : au === 'prisma' ? t('Prismático') : Data.TYPE_LABEL[au.slice(5)]));
      b.onclick = () => this.net.send({ t: 'look', aura: au });
      auras.append(b);
    }
    look.append(el('h4', '', t('Brillo de burbuja')), auras);
    look.append(el('p', 'small', t('Consigue más títulos y marcos subiendo de liga en Clasificatoria y completando logros. Ganando combates con una línea evolutiva consigues su ilustración, brillos, el marco de su tipo y skins.')));
    const collBtn = el('button', '', t('Ver colección y maestría'));
    collBtn.onclick = () => this.openCollection('mastery');
    look.append(collBtn);
    const avaBtn = el('button', '', t('Elegir avatar'));
    avaBtn.onclick = () => this.avatarPicker();
    look.append(el('h4', '', t('Avatar')), avaBtn);
    right.append(look);

    right.append(this.accountPanel());
    body.append(left, mid, right);
    wrap.append(body);
    this.root.append(wrap);
  },

  avatarPicker() {
    const p = this.profile;
    modal('avatar-pick', (box, close) => {
      box.append(el('h3', '', t('Avatar')));
      // Colección: medallas e iconos de logros recogidos
      const col = (p.cosmetics && p.cosmetics.avatars) || [];
      box.append(el('h4', '', t('Colección')));
      const cgrid = el('div', 'ava-grid ava-col');
      if (!col.length) cgrid.append(el('p', 'small', t('Recoge medallas y logros en Misiones para conseguir avatares de colección.')));
      for (const id of col) {
        const b = el('button', 'ava-opt' + (p.avatar === id ? ' sel' : ''), avatarArt(id, 48));
        b.title = avatarName(id);
        b.onclick = () => { this.net.send({ t: 'look', avatar: id }); close(); };
        cgrid.append(b);
      }
      box.append(cgrid, el('h4', '', t('Pokémon')));
      box.append(el('p', 'small', t('Cualquiera que hayas atrapado, también en shiny si lo tienes. Con {n} victorias de su línea evolutiva, también su ilustración oficial. Por defecto, el primero de tu equipo.', { n: Data.MASTERY_ART })));
      const search = el('input');
      search.type = 'search'; search.placeholder = t('Buscar por nombre o número');
      const grid = el('div', 'ava-grid scroll');
      const empty = el('p', 'small', t('No hay ningún Pokémon con esos filtros.'));
      empty.hidden = true;
      const auto = el('button', 'ava-opt' + (!p.avatar ? ' sel' : ''), `<small>${t('Automático')}</small>`);
      auto.onclick = () => { this.net.send({ t: 'look', avatar: null }); close(); };
      grid.append(auto);
      const shinies = new Set(p.shinies || []);
      const opts = [];
      for (const dex of [...p.caught].sort((a, b) => a - b)) {
        if (!SPECIES[dex]) continue;
        // Con la maestría de su línea, también la ilustración oficial
        const arts = Data.hasMastery(p, dex, 'art') ? [false, true] : [false];
        for (const [shiny, art] of (shinies.has(dex) ? [false, true] : [false]).flatMap(s => arts.map(a => [s, a]))) {
          const b = el('button', 'ava-opt' + (shiny ? ' is-shiny' : '') + (art ? ' is-art' : '') + (p.avatar === dex && !!p.avatarShiny === shiny && !!p.avatarArt === art ? ' sel' : ''));
          if (art) b.innerHTML = `<img class="ava-art" src="art/${shiny ? 'shiny/' : ''}${dex}.png" alt="" loading="lazy" draggable="false"><i class="art-tag">${t('Arte')}</i>`;
          else b.append(portrait(dex, 48, { shiny }));
          if (shiny) b.append(el('i', 'shiny-star', '✦'));
          b.title = SPECIES[dex].name + (shiny ? ' ✦' : '') + (art ? ' · ' + t('Ilustración oficial') : '');
          b.dataset.q = `${SPECIES[dex].name.toLowerCase()} ${dex}`;
          b.onclick = () => { this.net.send({ t: 'look', avatar: dex, avatarShiny: shiny, avatarArt: art }); close(); };
          grid.append(b);
          opts.push(b);
        }
      }
      search.oninput = () => {
        const q = search.value.trim().toLowerCase().replace('#', '').replace(/^0+(?=\d)/, '');
        let n = 0;
        for (const b of opts) { b.hidden = !!q && !b.dataset.q.split(' ').some(w => w.startsWith(q)) && !b.dataset.q.includes(q); n += !b.hidden; }
        auto.hidden = !!q;
        empty.hidden = !q || n > 0;
      };
      box.append(search, empty, grid);
      setTimeout(() => search.focus(), 0);
    });
  },

  accountPanel() {
    const p = this.profile;
    const box = el('div', 'panel account');
    box.append(el('h3', '', t('Cuenta')));
    const msg = el('p', 'auth-msg');
    this.authMsg = msg;
    if (!p.account) {
      box.append(el('p', 'warn', t('Juegas como invitado: tu partida solo vive en este navegador. Si borras sus datos o cambias de dispositivo, la perderás.')));
      box.append(el('p', 'small', t('Crea una cuenta y conservarás todo lo que tienes.')));
      const [fu, user] = field('Usuario o correo', 'text', { maxLength: 64, autocomplete: 'username', spellcheck: false, autocapitalize: 'off' });
      const [fp, pass] = field('Contraseña', 'password', { maxLength: 72, autocomplete: 'new-password' });
      const [f2, pass2] = field('Repite la contraseña', 'password', { maxLength: 72, autocomplete: 'new-password' });
      const go = el('button', 'primary', t('Crear cuenta'));
      const submit = () => {
        if (pass.value !== pass2.value) return this.authError(t('Las contraseñas no coinciden'));
        this.authError('');
        go.disabled = true;
        this.authBtn = go;
        this.net.auth({ t: 'register', user: user.value.trim(), pass: pass.value });
      };
      go.onclick = submit;
      [user, pass, pass2].forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') submit(); }; });
      box.append(fu, fp, f2, go, msg);
    } else {
      box.append(el('p', '', t('Tu usuario: <b>{user}</b>. Entra con él desde cualquier dispositivo.', { user: escapeHtml(handle(p.account.user)) })));
      const d = el('details', 'pw');
      d.append(el('summary', '', t('Cambiar contraseña')));
      const [fo, old] = field('Contraseña actual', 'password', { maxLength: 72, autocomplete: 'current-password' });
      const [fn, pass] = field('Nueva contraseña', 'password', { maxLength: 72, autocomplete: 'new-password' });
      const [f2, pass2] = field('Repite la nueva', 'password', { maxLength: 72, autocomplete: 'new-password' });
      const go = el('button', '', t('Cambiar'));
      go.onclick = () => {
        if (pass.value !== pass2.value) return this.authError(t('Las contraseñas no coinciden'));
        go.disabled = true;
        this.authBtn = go;
        this.net.send({ t: 'passwd', old: old.value, pass: pass.value });
      };
      d.append(fo, fn, f2, go);
      box.append(d, msg);
    }
    const out = el('button', 'danger', t('Cerrar sesión'));
    out.onclick = () => {
      if (!p.account && !confirm(t('Eres invitado: si cierras sesión sin crear una cuenta, perderás esta partida para siempre. ¿Seguro?'))) return;
      this.logout();
    };
    box.append(out);
    return box;
  },

  logout() {
    this.net.logout();
    this.profile = null;
    this.authTab = 'login';
    this.show('title');
  },

  // ---------- Recompensas de clasificatoria ----------
  // Ligas alcanzadas en la temporada cuyo premio aún no se ha reclamado
  claimable() {
    const p = this.profile;
    const s = p.season || { peak: p.elo, claimed: [] };
    return LEAGUES.filter(([min, name]) => min > 0 && s.peak >= min && !s.claimed.includes(name)).map(l => l[1]);
  },

  seasonPanel() {
    const p = this.profile;
    const s = p.season || { peak: p.elo, claimed: [] };
    const box = el('div', 'panel season');
    const left = daysLeft();
    box.append(el('div', 'season-head', `<h3>${t(SEASON.name)}</h3><span class="pill">${!left ? t('Último día') : left > 1 ? t('Termina en {n} días', { n: left }) : t('Termina en 1 día')}</span>`));
    // La barra va del ELO inicial (1000) a Maestro
    const top = LEAGUES[LEAGUES.length - 1][0], base = 1000;
    box.append(el('p', 'small', t('Mejor ELO de la temporada: <b>{peak}</b>. Cada liga que alcances te da un premio una vez por temporada. Además, {win} por victoria, {loss} por derrota y {first} extra por la primera victoria del día.', { peak: s.peak, win: coins(RANKED_PAY.win), loss: coins(RANKED_PAY.loss), first: coins(RANKED_PAY.firstWin) })));
    const track = el('div', 'reward-track');
    track.append(el('div', 'track-bar', `<div style="width:${Math.max(0, Math.min(100, (s.peak - base) / (top - base) * 100))}%"></div>`));
    for (const [min, name] of LEAGUES) {
      const r = RANKED_REWARDS[name];
      const reached = s.peak >= min;
      const claimed = min === 0 || s.claimed.includes(name);
      const card = el('div', `lr ${name.toLowerCase()}${reached ? ' reached' : ''}${reached && !claimed ? ' ready' : ''}${claimed && reached ? ' claimed' : ''}`);
      const loot = [r.coins ? coins(r.coins) : '', ...Object.entries(r.items).map(([id, n]) => `${itemName(id)} ×${n}`)].filter(Boolean);
      card.innerHTML = `${frameBadge(r.frame, 42)}<b>${t(name)}</b><small>${min ? min + ' ELO' : t('inicio')}</small>
        <div class="loot">${loot.map(x => `<span>${x}</span>`).join('')}<span class="title-chip">${escapeHtml(t(r.title))}</span><span>${t('Marco {name}', { name: t(FRAME_LABEL[r.frame]) })}</span></div>`;
      if (min === 0) card.append(el('em', 'state', t('De serie')));
      else if (!reached) card.append(el('em', 'state', t('Faltan {n}', { n: min - s.peak })));
      else if (claimed) card.append(el('em', 'state', t('✓ Reclamado')));
      else {
        const b = el('button', 'primary', t('Reclamar'));
        b.onclick = () => { b.disabled = true; this.net.send({ t: 'claim', league: name }); this.toast(t('Premio de {league} reclamado', { league: t(name) })); };
        card.append(b);
      }
      track.append(card);
    }
    box.append(track);
    const peakLeague = Data.leagueOf(s.peak);
    const idx = LEAGUES.findIndex(l => l[1] === peakLeague);
    box.append(el('p', 'small season-end', `${t('Al acabar la temporada: {prize} según tu mejor liga (ahora <b>{league}</b>)', { prize: coins(SEASON_REWARDS[peakLeague]), league: t(peakLeague) })}${idx >= 2 ? ' ' + t('y el título {title}', { title: `<span class="title-chip">${t(Data.seasonTitle(peakLeague, SEASON.id))}</span>` }) : ' · ' + t('desde Oro, también un título exclusivo de la temporada')}. ${t('Después tu ELO se acerca a la mitad hacia 1000.')}`));
    return box;
  },

  boardPanel() {
    const p = this.profile;
    const board = el('div', 'panel board');
    board.append(el('h3', '', t('Mejores entrenadores')));
    if (!this.board.length) { board.append(el('p', 'small', t('Todavía nadie ha jugado una clasificatoria. ¡Sé el primero!'))); return board; }
    const ol = el('ol');
    this.board.forEach((b, i) => {
      const li = el('li', 'clickable' + (b.id === p.id ? ' me' : '') + (i < 3 ? ' top' + (i + 1) : ''));
      li.onclick = () => this.userModal(b.id);
      li.innerHTML = `<span class="pos">${i + 1}</span><span class="who">${swatch(b.frame)}<b>${escapeHtml(b.name)}</b>${b.title ? `<small class="title-chip">${escapeHtml(t(b.title))}</small>` : ''}</span><span class="pts">${b.elo}<small>${t(Data.leagueOf(b.elo))} · ${t('{w}V {l}D', { w: b.wins, l: b.losses })}</small></span>`;
      ol.append(li);
    });
    board.append(ol);
    const all = el('button', '', t('Ver la ladder completa'));
    all.onclick = () => { this.ladderBoard = 'ranked'; this.openLadder(); };
    board.append(all);
    if (this.rank && this.rank > this.board.length) board.append(el('p', 'my-rank', t('Tú: <b>#{n}</b> · {elo} ELO', { n: this.rank, elo: p.elo })));
    else if (!this.rank) board.append(el('p', 'small', t('Juega una clasificatoria para entrar en el ranking.')));
    return board;
  },
};
