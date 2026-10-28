// Pantallas de cuenta y publicación: portada con invitado / inicio de sesión / registro, perfil
// (estadísticas, historial, títulos, marcos, avatar, contraseña), recompensas de clasificatoria,
// novedades y aviso legal. Se añaden como métodos de UI (ver el final de ui.js).
import { confirmBox } from './dialog.js';
import { portrait, animatedPortrait, monIcon, face, trainerImg } from './sprites.js';
import { escapeHtml, tagName } from './battle.js';
import { Net, storage } from './net.js';
import { t, locale, LANGS, LANG_CODES, getLang, setLang } from './i18n.js';
import { flag } from './flags.js';
import { icon, badgeImg } from './pixicons.js';
import { showcaseHtml, FRAME_LABEL_EXTRA } from './achievements.js';
import { avatarArt, avatarName, effectHtml, effectName } from './missions.js';
import { frameFx, frameRing, frameBadge, auraHtml, applySkin, auraName } from './frames.js';
import { CURSOR_COLORS, cursorSvg, getCursor, setCursor } from './cursor.js';
import { DEFAULT_VOLUME as DEFAULT_MUSIC } from './music.js';
import { DEFAULT_SFX } from './sfx.js';

const KOFI_URL = 'https://ko-fi.com/1kts_';

const { SPECIES, SHOP, LEAGUES, SEASON, RANKED_REWARDS, SEASON_REWARDS, RANKED_PAY, STARTERS } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const coins = n => `<span class="coin">${icon('coin', 16)}</span>${n.toLocaleString(locale())}`;
const VERSION = CHANGELOG[0].v;
// Cómo se enseña el usuario de la cuenta: @nombre, o el correo tal cual (las cuentas que entran con
// Google o con el correo no tienen usuario: su correo, que solo ve su dueño)
const handle = u => (u.includes('@') ? u : '@' + u);
const accountName = a => (a.user ? handle(a.user) : a.email || '');
// Formas de entrar que tiene el servidor ({ google: id de cliente, googleTest, mail }): se piden una vez
let authCfg = null;
const authConfig = () => authCfg || (authCfg = fetch('/auth/config').then(r => r.json()).catch(() => { authCfg = null; return {}; }));
// El script de Google solo se carga al pulsar «Continuar con Google»: hasta entonces el navegador no se
// conecta a Google (ni a nadie más)
let gsiLoad = null, gsiReady = false;
const gsi = () => gsiLoad || (gsiLoad = new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => (window.google && window.google.accounts ? ok(window.google) : ko());
  s.onerror = () => { gsiLoad = null; s.remove(); ko(); };
  document.head.append(s);
}));
const G_SVG = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
const MAIL_SVG = '<svg class="m-logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="m4 7 8 6.2L20 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const GEAR_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.6 3.6.9.7-1.3 2.3-1.1-.4a5 5 0 0 1-1.4.8l-.2 1.2H7.9l-.2-1.2a5 5 0 0 1-1.4-.8l-1.1.4-1.3-2.3.9-.7a5 5 0 0 1 0-1.6l-.9-.7 1.3-2.3 1.1.4a5 5 0 0 1 1.4-.8l.2-1.2h2.6l.2 1.2a5 5 0 0 1 1.4.8l1.1-.4 1.3 2.3-.9.7a5 5 0 0 1 0 1.6Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const BOOK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2v-9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5h4M6 7h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const GLOBE_SVG = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2.6 4.2 2.6 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.4 5.7 5.4 8S6 12.5 8 14.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const SEEN_KEY = 'arena.seenVersion';
const TAG_LABEL = { nuevo: 'Nuevo', cambio: 'Cambio', arreglo: 'Arreglo' };
const FRAME_LABEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante', maestro: 'Maestro', ...FRAME_LABEL_EXTRA };
const frameLabel = f => f.startsWith('tipo-') ? t('Marco {type}', { type: Data.TYPE_LABEL[f.slice(5)] }) : t(FRAME_LABEL[f] || f);
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

function modal(cls, build, onClose) {
  const back = el('div', 'modal');
  const box = el('div', 'panel modal-box ' + cls);
  const close = () => { back.remove(); if (onClose) onClose(); };
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
    box.innerHTML = `<div class="emblem"></div><h1 class="logo">Poké<br><span data-t="Arenas">Arenas</span></h1><p class="tag">${t('Combates Pokémon en tiempo real · 966 Pokémon de 9 generaciones')}</p>`;
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
        // (al entrar vale también el correo de las cuentas de antes; al registrarse, solo un usuario)
        const [fu, user] = field(reg ? 'Usuario' : 'Usuario o correo', 'text', { maxLength: reg ? 24 : 64, autocomplete: 'username', spellcheck: false, autocapitalize: 'off' });
        const [fp, pass] = field('Contraseña', 'password', { maxLength: 72, autocomplete: reg ? 'new-password' : 'current-password' });
        form.append(fu, fp);
        let pass2;
        if (reg) { const [f2, p2] = field('Repite la contraseña', 'password', { maxLength: 72, autocomplete: 'new-password' }); pass2 = p2; form.append(f2); }
        // (con la misma forma que «Continuar con Google» y «Entrar con email», en el amarillo del juego)
        const go = el('button', 'primary alt-btn go', reg ? t('Crear cuenta y jugar') : t('Entrar'));
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
      form.append(this.authMsg, this.altLogin());
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

  // ---------- Entrar con Google o con el correo ----------
  // Botones «Continuar con Google» y «Entrar con email» (solo los que tenga configurados el servidor). Sirven
  // para entrar en una cuenta o crearla: un invitado que lo hace se lleva su partida a la cuenta nueva.
  altLogin() {
    const box = el('div', 'alt-login');
    authConfig().then(cfg => {
      if (!cfg.google && !cfg.mail) return box.remove();
      box.append(el('div', 'alt-or', `<span>${t('o también')}</span>`));
      const row = el('div', 'alt-btns');
      if (cfg.google) {
        const g = el('button', 'alt-btn google', `${G_SVG}<span>${t('Continuar con Google')}</span>`);
        g.onclick = () => this.googleLogin(cfg);
        row.append(g);
      }
      if (cfg.mail) {
        const m = el('button', 'alt-btn mail', `${MAIL_SVG}<span>${t('Entrar con email')}</span>`);
        m.onclick = () => this.mailLogin();
        row.append(m);
      }
      box.append(row);
    });
    return box;
  },

  // Ventana para entrar: cada paso (correo, código, nombre) sustituye al anterior debajo del título.
  // Mientras está abierta, los errores del servidor salen en ella
  loginModal(cls, title, build) {
    this.closeLogin();
    const prevMsg = this.authMsg;
    this.loginClose = modal('login-modal ' + cls, box => {
      box.append(el('h3', '', title));
      this.loginBox = box;
      build(box);
    }, () => { this.loginClose = this.loginBox = this.onMailSent = null; this.authMsg = prevMsg; this.authBtn = null; });
  },
  closeLogin() { if (this.loginClose) this.loginClose(); },
  // Vacía la ventana (menos el título) para el paso siguiente y prepara su línea de errores
  loginStep(box) {
    while (box.children.length > 1) box.lastChild.remove();
    this.authMsg = el('p', 'auth-msg');
    return this.authMsg;
  },
  // Desde la portada va también el token de este navegador: si el correo aún no tiene cuenta, su
  // partida de invitado pasa a ser la cuenta (como al registrarse desde el perfil)
  identitySend(msg) {
    if (!this.profile && Net.token() && msg.t !== 'mailcode') msg.token = Net.token();
    this.net.auth(msg);
  },

  // Con el enlace del correo (link: { email, code }) se abre en el paso del código, con los dos ya escritos: falta
  // un toque en «Entrar» (que un antivirus del correo al abrir el enlace no gaste el código, y que nadie meta a otro
  // en su cuenta con un enlace suyo). La partida de invitado solo se la lleva si este navegador pidió ese código
  mailLogin(link = null) {
    this.loginModal('mail', t('Entrar con email'), box => {
      const askEmail = (value = '') => {
        const msg = this.loginStep(box);
        const [f, input] = field('Tu correo', 'email', { maxLength: 254, autocomplete: 'email', spellcheck: false, autocapitalize: 'off', value });
        const go = el('button', 'primary', t('Mandarme un código'));
        const submit = () => {
          const email = input.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return this.authError(t('Escribe un correo válido'));
          this.authError('');
          go.disabled = true;
          this.authBtn = go;
          this.onMailSent = () => askCode(email);
          storage.set('arena.mailAsked', email.toLowerCase());   // (lo pidió este navegador: ver mailLogin)
          this.identitySend({ t: 'mailcode', email, lang: getLang() });
        };
        go.onclick = submit;
        input.onkeydown = e => { if (e.key === 'Enter') submit(); };
        box.append(el('p', 'small', t('Te mandamos un enlace para entrar con un toque (y un código, por si lo abres en otro sitio): sin contraseñas. Si aún no tienes cuenta, se crea al entrar.')), f, go, msg);
        setTimeout(() => input.focus(), 50);
      };
      // fromLink: el código del enlace del correo. Si el enlace no se pidió desde este navegador (el de otro, para
      // meterte en su cuenta, o el tuyo abierto en otro navegador o en la app del correo): con una partida guardada
      // aquí no se ofrece entrar (se perdería), sino pedir aquí otro código; sin ella, se puede entrar avisando
      const askCode = (email, fromLink = null) => {
        const msg = this.loginStep(box);
        const [f, code] = field('Código', 'text', { maxLength: 6, inputMode: 'numeric', autocomplete: 'one-time-code', spellcheck: false, value: fromLink || '' });
        code.classList.add('code-input');
        const go = el('button', 'primary', t('Entrar'));
        const foreign = !!fromLink && storage.get('arena.mailAsked') !== email.toLowerCase();
        const saved = foreign && !this.profile && !!Net.token();
        const submit = () => {
          const v = code.value.replace(/\D/g, '');
          if (v.length !== 6) return this.authError(t('El código tiene 6 cifras'));
          this.authError('');
          go.disabled = true;
          this.authBtn = go;
          this.identitySend({ t: 'mailverify', email, code: v, ...(foreign ? { noGuest: true } : {}) });
        };
        go.onclick = submit;
        // Al escribir (o pegar) la sexta cifra se manda solo
        code.oninput = () => { const v = code.value.replace(/\D/g, '').slice(0, 6); if (v !== code.value) code.value = v; if (v.length === 6 && !go.disabled) submit(); };
        code.onkeydown = e => { if (e.key === 'Enter') submit(); };
        const other = el('button', 'link', t('Usar otro correo'));
        other.onclick = () => askEmail(email);
        // Reenviar: un código nuevo pedido desde aquí (el del enlace deja de valer), con su campo vacío
        const again = el('button', saved ? 'primary' : 'link', saved ? t('Mandarme un código aquí') : t('Reenviar el código'));
        again.onclick = () => {
          this.authError('');
          storage.set('arena.mailAsked', email.toLowerCase());
          this.onMailSent = () => { if (fromLink) askCode(email); else this.toast(t('Código reenviado')); };
          this.identitySend({ t: 'mailcode', email, lang: getLang() });
        };
        const links = el('div', 'alt-links');
        links.append(other, ...(saved ? [] : [again]));
        if (!fromLink) {
          box.append(el('p', '', t('Te hemos mandado un enlace y un código a <b>{email}</b>: toca el enlace o escribe aquí el código. Caducan en 10 minutos; si no llega, mira en spam.', { email: escapeHtml(email) })), f, go, msg, links);
          return setTimeout(() => code.focus(), 50);
        }
        box.append(el('p', '', t('Vas a entrar como <b>{email}</b>.', { email: escapeHtml(email) })));
        if (saved) {
          box.append(el('p', 'warn', t('Este enlace se pidió desde otro sitio. Para que la partida guardada en este navegador pase a tu cuenta, pide aquí otro código. Si no lo pediste tú, ciérralo.')), again, msg, links);
          return setTimeout(() => again.focus(), 50);
        }
        if (foreign) box.append(el('p', 'warn', t('Este enlace se pidió desde otro sitio: si no lo pediste tú, ciérralo. Si es tuyo, entra: la cuenta no se lleva la partida de invitado de otro navegador.')));
        box.append(f, go, msg, links);
        setTimeout(() => go.focus(), 50);
      };
      if (link) askCode(link.email, link.code); else askEmail();
    });
  },

  // Google: en la ventana se carga su botón oficial (abre la elección de cuenta de Google) y su respuesta,
  // un token firmado, la comprueba el servidor
  googleLogin(cfg) {
    this.loginModal('google', t('Continuar con Google'), box => {
      const msg = this.loginStep(box);
      const slot = el('div', 'gsi-slot');
      box.append(el('p', 'small', t('Elige tu cuenta de Google. Solo guardamos tu correo para que puedas entrar; si aún no tienes cuenta, se crea al entrar.')), slot, msg);
      if (cfg.googleTest) return slot.append(el('small', '', 'Google (pruebas)'));   // en las pruebas no se carga nada de Google
      slot.append(el('small', '', t('Cargando…')));
      gsi().then(g => {
        if (!slot.isConnected) return;
        if (!gsiReady) { g.accounts.id.initialize({ client_id: cfg.google, callback: r => this.googleCredential(r.credential), ux_mode: 'popup' }); gsiReady = true; }
        slot.innerHTML = '';
        g.accounts.id.renderButton(slot, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'left', width: Math.min(320, slot.clientWidth || 280), locale: getLang() });
      }).catch(() => { slot.innerHTML = ''; this.authError(t('No se ha podido cargar Google: revisa tu conexión o el bloqueador de anuncios.')); });
    });
  },
  googleCredential(credential) {
    if (this.authMsg) { this.authMsg.textContent = t('Conectando…'); this.authMsg.className = 'auth-msg'; }
    this.identitySend({ t: 'google', credential });
  },

  // El servidor ha comprobado el correo y no hay cuenta ni partida de invitado: falta el nombre de entrenador
  onAuthName() {
    const show = box => {
      const msg = this.loginStep(box);
      const [f, name] = field('Nombre de entrenador', 'text', { maxLength: 16, value: Net.savedName(), autocomplete: 'nickname' });
      const go = el('button', 'primary', t('Crear cuenta y jugar'));
      const submit = () => {
        if (!name.value.trim()) return this.authError(t('Escribe tu nombre de entrenador'));
        this.authError('');
        go.disabled = true;
        this.authBtn = go;
        this.net.send({ t: 'authname', name: name.value.trim() });
      };
      go.onclick = submit;
      name.onkeydown = e => { if (e.key === 'Enter') submit(); };
      box.append(el('p', '', t('¡Bienvenido a PokéArenas! Elige tu nombre de entrenador: es el que verán los demás.')), f, go, msg);
      setTimeout(() => name.focus(), 50);
    };
    if (this.loginBox) show(this.loginBox); else this.loginModal('name', t('Cuenta nueva'), show);
  },
  onMailSentMsg() {
    if (this.authBtn) this.authBtn.disabled = false;
    const f = this.onMailSent;
    this.onMailSent = null;
    if (f) f();
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
      ok.onclick = () => { close(); this.dailyAuto(); };   // luego, el premio diario
      acts.append(ok);
      box.append(list, acts);
    });
  },

  // Reportar un bug: qué ha pasado y, solos, la pantalla, la versión, el navegador y el tamaño de pantalla (para
  // poder reproducirlo). Llega al panel de admin
  bugReport() {
    const where = this.view;
    modal('bug-report', (box, close) => {
      box.append(el('h3', '', t('Reportar un bug')), el('p', 'small', t('¿Qué ha pasado y qué estabas haciendo? Cuanto más detalle, antes lo arreglamos.')));
      const text = el('textarea', 'bug-text');
      text.maxLength = 1000; text.rows = 5; text.placeholder = t('Ej.: al elegir un movimiento en Clasificatoria la página se queda en blanco');
      box.append(text, el('p', 'small bug-meta', t('Se envía también la pantalla en la que estabas, la versión del juego y tu navegador.')));
      const acts = el('div', 'acts');
      const cancel = el('button', '', t('Cancelar'));
      cancel.onclick = close;
      const send = el('button', 'primary', t('Enviar'));
      send.onclick = () => {
        if (text.value.trim().length < 10) { this.toast(t('Cuéntanos un poco más (al menos 10 letras)'), 'bad'); return; }
        send.disabled = true;
        this.onBugSent = () => { close(); this.toast(t('¡Gracias! Hemos recibido tu reporte.')); };
        this.net.send({ t: 'bug', text: text.value, view: where, version: CHANGELOG[0].v, ua: navigator.userAgent, screen: `${innerWidth}×${innerHeight}` });
        setTimeout(() => { send.disabled = false; }, 3000);
      };
      acts.append(cancel, send);
      box.append(acts);
      setTimeout(() => text.focus(), 50);
    });
  },

  legal() {
    modal('legal', (box, close) => {
      box.append(el('h3', '', t('Créditos y aviso legal')));
      box.append(el('div', 'scroll', `
        <p>${t('PokéArenas es un <b>proyecto de fans sin ánimo de lucro</b>. No está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios.')}</p>
        <p>${t('Los sprites proceden de la comunidad de <i>Pokémon Mundo Misterioso</i> (PMD Sprite Collab) y se usan con atribución a sus artistas. Los datos de especies vienen de PokéAPI. Los mapas de región son dibujos propios.')}</p>
        <p>${t('Los iconos de objetos vienen de PokeAPI, y los iconos pixel art de la interfaz y las formas de los ataques, de PokéSurvivor (JPTER78, licencia PolyForm Noncommercial).')}</p>
        <p>${t('La música de los menús y los combates es de jannetty, rckbtm, Spring Spring y HydroGene, con su permiso o con licencia CC BY o CC0.')}</p>
        <p>${t('Los artistas de cada sprite, las licencias y la política de privacidad completa están en el <a href="{url}" target="_blank" rel="noopener">aviso legal</a>.', { url: getLang() === 'es' ? '/legal' : '/legal/en' })}</p>
        <p>${t('El juego es gratis y lo seguirá siendo. Si quieres ayudar a pagar el servidor, puedes invitarme a un café en <a href="{url}" target="_blank" rel="noopener noreferrer">Ko-fi</a>. Donar no da ninguna ventaja en el juego.', { url: KOFI_URL })}</p>
        <h4>${t('Datos que guardamos')}</h4>
        <p class="small">${t('Guardamos tu nombre de entrenador y tu partida; si creas cuenta, tu usuario y tu contraseña cifrada (scrypt con sal), o tu correo si entras con Google o con un código por correo; y, durante 40 días, un registro de seguridad con tu IP. No hay publicidad, cookies ni seguimiento. Para borrar tu cuenta o cualquier duda: contact@pokearenas.com.')}</p>`));
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
  // (who: la ficha pública de otro entrenador; sin su equipo completo, el primero de su equipo que se ve)
  avatarDex(who) {
    const p = who || this.profile;
    if (p.avatar && SPECIES[p.avatar]) return { dex: p.avatar, shiny: !!p.avatarShiny };
    if (who) return who.team && who.team[0] ? { dex: who.team[0].dex, shiny: !!who.team[0].shiny } : { dex: 25, shiny: false };
    const leadUid = p.teams && (p.teams[this.region || 'kanto'] || [])[0];
    const lead = p.mons.find(m => m.uid === leadUid) || p.mons[0];
    return lead ? { dex: lead.dex, shiny: Data.looksShiny(lead) } : { dex: 25, shiny: false };
  },

  // frame / aura: para previsualizar otro marco o brillo (undefined = el del perfil)
  // Avatar: la imagen (Pokémon, retrato, medalla…), su efecto por encima, el marco alrededor y el brillo
  // who: el de otro entrenador (su ficha pública trae avatar, marco, brillo y efecto)
  avatar(size, animated, frame, aura, effect, who) {
    const p = who || this.profile;
    const f = frame === undefined ? p.frame || null : frame;
    const au = aura === undefined ? p.aura || null : aura;
    const fx = effect === undefined ? (who ? who.effect : (p.cosmetics && p.cosmetics.effects || []).includes(p.effect) ? p.effect : null) : effect;
    const a = el('div', 'ava frame-' + (f || 'none'));
    a.style.setProperty('--s', size + 'px');
    if (frameRing(f)) a.style.setProperty('--ring', frameRing(f));
    if (au) a.insertAdjacentHTML('afterbegin', auraHtml(au));
    // Avatar de colección (medalla o icono de logro)
    if (typeof p.avatar === 'string' && avatarArt(p.avatar, size)) {
      a.classList.add('ava-icon');
      a.append(el('span', 'ava-pic', avatarArt(p.avatar, size) + effectHtml(fx)));
      a.insertAdjacentHTML('beforeend', frameFx(f));
      return a;
    }
    const { dex, shiny } = this.avatarDex(who);
    const pic = el('span', 'ava-pic');
    const sprite = () => animated ? animatedPortrait(dex, size, 'Idle', shiny) : portrait(dex, size, { shiny });
    if (p.avatar && p.avatarArt) {
      const img = el('img', 'ava-art');
      img.src = `art/${shiny ? 'shiny/' : ''}${dex}.png`; img.alt = ''; img.draggable = false;
      img.onerror = () => img.replaceWith(sprite());   // sin conexión con PokeAPI: el sprite de siempre
      pic.append(img);
    } else {
      pic.append(sprite());
      if (!who) applySkin(pic, Data.skinOf(p, dex), dex, Data.particlesOf(p, dex));
    }
    pic.insertAdjacentHTML('beforeend', effectHtml(fx));
    a.append(pic);
    a.insertAdjacentHTML('beforeend', frameFx(f));
    return a;
  },

  // Icono de diario en el menú: abre las novedades (con un punto si hay algo sin ver)
  newsIcon() {
    const b = el('button', 'tb-btn icon news-btn', `${icon('book', 24)}${this.hasNews() ? '<i class="ndot news"></i>' : ''}`);
    b.setAttribute('aria-label', t('Novedades'));
    b.onclick = () => this.patchNotes();
    return this.hoverTip(b, `<b>${t('Novedades de la v{v}', { v: VERSION })}</b><p>${escapeHtml(t(CHANGELOG[0].title))}</p>
      <p class="${this.hasNews() ? 'tip-good' : ''}">${this.hasNews() ? t('Hay novedades que aún no has leído.') : t('Lo nuevo de cada versión del juego.')}</p>`);
  },

  // Botón de la barra superior para reportar un bug
  bugButton() {
    const b = el('button', 'tb-btn icon bug-btn', icon('bug', 24));
    b.setAttribute('aria-label', t('Reportar un bug'));
    b.onclick = () => this.bugReport();
    return this.hoverTip(b, `<b>${t('Reportar un bug')}</b><p>${t('¿Algo no funciona? Cuéntanos qué ha pasado y lo arreglamos lo antes posible.')}</p>`);
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
    who.append(this.avatar(64), el('div', '', `<b>${escapeHtml(p.name)}</b><span class="elo">${t(p.league)} · ${p.elo}</span><small>${p.account ? t('Cuenta <b>{user}</b>', { user: escapeHtml(accountName(p.account)) }) : t('Invitado')}</small>`));
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

    // Reportar un bug
    const bug = el('div', 'panel');
    bug.append(el('h3', '', t('¿Algo no funciona?')), el('p', 'small', t('Cuéntanos qué ha pasado y lo arreglamos lo antes posible.')));
    const bugBtn = el('button', 'primary', t('Reportar un bug'));
    bugBtn.onclick = () => this.bugReport();
    bug.append(bugBtn);

    body.append(lang, mus, cursorBox, me, news, bug, about);
    wrap.append(body);
    this.root.append(wrap);
  },

  // ---------- Perfil ----------
  view_profile() {
    const p = this.profile;
    const wrap = el('div', 'profile-view');
    wrap.append(this.topbar(t('Perfil'), 'menu'));
    // Orden: tarjeta de entrenador arriba (a todo el ancho), una franja con todas las estadísticas, y debajo
    // dos columnas (medallas y últimas partidas | logros); la cuenta, al final
    const body = el('div', 'pv-body pv-flow scroll');
    const left = el('div', 'pv-col');
    const mid = el('div', 'pv-col');

    // Tarjeta de entrenador
    const card = el('div', 'panel trainer-card');
    // Tu foto: al tocarla (o «Editar») se abre el editor del avatar
    const ava = el('div', 'tc-ava');
    const pic = this.avatar(120, true);
    pic.classList.add('editable');
    pic.title = t('Editar avatar');
    pic.onclick = () => this.avatarEditor();
    const editAva = el('button', 'primary tc-edit', t('Editar'));
    editAva.onclick = () => this.avatarEditor();
    ava.append(pic, editAva);
    card.append(ava);
    const info = el('div', 'tc-info');
    const nameRow = el('div', 'name-row', `<h2>${tagName(p.name, p.tag)}</h2>`);
    const edit = el('button', 'icon', '✎');
    edit.title = t('Cambiar nombre');
    edit.onclick = () => {
      nameRow.innerHTML = '';
      const input = el('input');
      input.maxLength = 16; input.value = p.name;
      const save = el('button', 'primary', t('Guardar'));
      const done = () => { const v = input.value.trim(); if (v && v !== p.name) this.net.send({ t: 'name', name: v }); else this.show('profile'); };
      save.onclick = done;
      input.onkeydown = e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { e.preventDefault(); this.show('profile'); } };
      nameRow.append(input, save);
      input.focus(); input.select();
    };
    nameRow.append(edit);
    info.append(nameRow);
    if (p.title) info.append(el('span', 'title-chip', escapeHtml(t(p.title))));
    info.append(el('p', 'small', p.account
      ? t('Cuenta <b>{user}</b> · desde {date}', { user: escapeHtml(accountName(p.account)), date: fmtDate(p.account.since) })
      : `<span class="warn">${t('Invitado')}</span> · ${t('jugando desde {date}', { date: fmtDate(p.created) })}`));
    info.append(el('div', 'tc-league', `<span class="league">${t(p.league)}</span><span class="elo">${p.elo} ELO</span>${this.rank ? `<span class="pill">${t('#{n} del ranking', { n: this.rank })}</span>` : ''}`));
    // Progreso hacia la siguiente liga
    const li = LEAGUES.findIndex(l => l[1] === p.league), nextL = LEAGUES[li + 1];
    if (nextL) {
      const from = LEAGUES[li][0], pct = Math.max(0, Math.min(100, (p.elo - from) / (nextL[0] - from) * 100));
      info.append(el('div', 'tc-lbar', `<div class="bar"><i style="width:${pct}%"></i></div><small>${t('Faltan {n} ELO para {league}', { n: nextL[0] - p.elo, league: t(nextL[1]) })}</small>`));
    } else info.append(el('div', 'tc-lbar', `<small>${t('Liga máxima')}</small>`));
    card.append(info);
    // En medio: tu equipo de la región en la que más has avanzado y datos destacados (tu Pokémon favorito,
    // que es la línea con más victorias, y tu récord en la Torre)
    const mid0 = el('div', 'tc-mid');
    const region = [...Data.REGION_IDS].sort((a, b) => Data.progOf(p, b) - Data.progOf(p, a))[0];
    const team = ((p.teams && p.teams[region]) || []).map(uid => p.mons.find(m => m.uid === uid)).filter(Boolean);
    if (team.length) {
      const row = el('div', 'tc-team');
      for (const m of team) {
        const c = el('span', 'tc-mon');
        c.append(face(m.dex, 52, 'Normal', Data.looksShiny(m)) || portrait(m.dex, 52, { shiny: Data.looksShiny(m) }));
        c.append(el('small', '', `Nv.${m.level}`));
        c.title = SPECIES[m.dex].name;
        row.append(c);
      }
      mid0.append(el('small', 'tc-lbl', t('Equipo de {r}', { r: Data.REGIONS[region].name })), row);
    }
    const lines = Object.keys(p.mastery || {}).map(Number).filter(d => SPECIES[d]);
    const fav = lines.sort((a, b) => Data.masteryWins(p, b) - Data.masteryWins(p, a))[0];
    const chips = [];
    if (fav && Data.masteryWins(p, fav)) chips.push(`<span class="tc-chip fav">${t('Favorito: {m} · {n} victorias', { m: SPECIES[fav].name, n: Data.masteryWins(p, fav) })}</span>`);
    if (p.tower && p.tower.best) chips.push(`<span class="tc-chip">${t('Torre: récord {n}', { n: p.tower.best })}</span>`);
    if (chips.length) mid0.append(el('div', 'tc-chips', chips.join('')));
    if (mid0.children.length) card.append(mid0);
    // A la derecha de la tarjeta, los logros fijados como insignias
    const pins = el('div', 'tc-pins');
    pins.innerHTML = (p.showcase || []).length ? `<small>${t('Insignias')}</small>${showcaseHtml(p.showcase, 52)}` : `<small>${t('Fija hasta 3 logros con la estrella para lucirlos aquí')}</small>`;
    card.append(pins);
    body.append(card);

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

    // Estadísticas: una franja con dos filas, Clasificatoria e Historia
    const games = p.wins + p.losses;
    const badges = Data.REGION_IDS.map(r => Math.min(8, Data.progOf(p, r))).reduce((a, b) => a + b, 0);
    const stat = (label, value) => `<div class="stat"><small>${t(label)}</small><b>${value}</b></div>`;
    const champ = Data.REGION_IDS.filter(r => Data.progOf(p, r) >= Data.leadersOf(r).length).map(r => Data.REGIONS[r].name).join(', ') || '—';
    body.append(el('div', 'panel pv-stats', `<div class="pv-srow"><h3>${t('Clasificatoria')}</h3><div class="stat-grid">
      ${stat('Partidas', games)}${stat('Mejor ELO', p.peakElo || p.elo)}${stat('Victorias', p.wins)}${stat('Derrotas', p.losses)}${stat('% victorias', games ? Math.round(p.wins / games * 100) + ' %' : '—')}${stat('Puesto', this.rank ? '#' + this.rank : '—')}</div></div>
      <div class="pv-srow"><h3>${t('Historia')}</h3><div class="stat-grid">
      ${stat('Medallas', `${badges}/${8 * Data.REGION_IDS.length}`)}${stat('Pokédex', `${Data.dexCount(p)}/${Data.DEX_TOTAL}`)}${stat('Pokémon', p.mons.length)}${stat('Shinies', p.mons.filter(m => m.shiny).length)}${stat('Dinero', coins(p.coins))}${stat('Campeón', champ)}</div></div>`));


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
    left.append(hist);
    mid.append(this.achievementsPanel());
    const cols = el('div', 'pv-cols');
    cols.append(left, mid);
    body.append(cols, this.accountPanel());
    wrap.append(body);
    this.root.append(wrap);
  },

  // Editor del avatar (se abre tocando tu foto en el Perfil): vista previa arriba y pestañas para la
  // imagen, el marco, el glow, el efecto y el título. Cada cambio se guarda al momento y el editor se
  // repinta con el perfil nuevo (setProfile llama a avaEditDraw)
  avatarEditor(tab) {
    if (tab) this.avaTab = tab;
    modal('ava-edit', box => {
      const draw = () => {
        const p = this.profile, cos = p.cosmetics || {}, tabId = this.avaTab || 'avatar';
        box.innerHTML = '';
        box.append(el('h3', '', t('Editar avatar')));
        const prev = el('div', 'ae-preview');
        prev.append(this.avatar(104, true), el('div', 'ae-who', `<b>${escapeHtml(p.name)}</b>${p.title ? `<span class="title-chip">${escapeHtml(t(p.title))}</span>` : `<small>${t('Sin título')}</small>`}`));
        box.append(prev);
        const tabs = el('div', 'ae-tabs');
        for (const [id, label] of [['avatar', 'Imagen'], ['frame', 'Marco'], ['aura', 'Glow'], ['effect', 'Efecto'], ['title', 'Título']]) {
          const b = el('button', id === tabId ? 'sel' : '', t(label));
          b.onclick = () => { this.avaTab = id; draw(); };
          tabs.append(b);
        }
        box.append(tabs);
        const body = el('div', 'ae-body scroll');
        const opts = (list, render, msg) => {
          const g = el('div', 'frame-grid');
          for (const v of list) {
            const [node, label, sel, locked] = render(v);
            const b = el('button', 'frame-opt' + (sel ? ' sel' : '') + (locked ? ' locked' : ''));
            b.append(node, el('small', '', label));
            if (locked) { b.disabled = true; b.append(el('em', '', t('En Lucky Spin'))); }
            else b.onclick = () => this.net.send({ t: 'look', ...msg(v) });
            g.append(b);
          }
          return g;
        };
        if (tabId === 'avatar') this.avatarOptions(body);
        if (tabId === 'frame') body.append(opts([null, ...(cos.frames || [])], f => [this.avatar(56, false, f), f ? frameLabel(f) : t('Ninguno'), (p.frame || null) === f], f => ({ frame: f })));
        if (tabId === 'aura') body.append(opts([null, ...(cos.auras || [])], au => [this.avatar(56, false, undefined, au), au ? auraName(au, t) : t('Ninguno'), (p.aura || null) === au], au => ({ aura: au })));
        if (tabId === 'effect') {
          // Todos los efectos: los que aún no tienes, apagados (salen en Lucky Spin)
          const own = cos.effects || [];
          body.append(opts([null, ...own, ...Data.EFFECTS.filter(fx => !own.includes(fx))], fx => [this.avatar(56, false, undefined, undefined, fx), fx ? effectName(fx) : t('Ninguno'), (p.effect || null) === fx, !!fx && !own.includes(fx)], fx => ({ effect: fx })));
        }
        if (tabId === 'title') {
          const chips = el('div', 'chips');
          for (const ti of [null, ...(cos.titles || [])]) {
            const b = el('button', 'chip' + ((p.title || null) === ti ? ' sel' : ''), ti ? escapeHtml(t(ti)) : t('Sin título'));
            b.onclick = () => this.net.send({ t: 'look', title: ti });
            chips.append(b);
          }
          body.append(chips);
        }
        box.append(body);
        const more = el('button', 'ae-more', t('Ver cómo conseguir más en Logros'));
        more.onclick = () => { document.querySelectorAll('.modal').forEach(m => m.remove()); this.avaEditDraw = null; this.openCollection(tabId === 'avatar' ? 'art' : tabId === 'title' ? 'titles' : tabId === 'effect' ? 'effects' : tabId === 'frame' ? 'frames' : 'aura'); };
        box.append(more);
      };
      this.avaEditDraw = draw;
      draw();
    }, () => { this.avaEditDraw = null; });
  },

  // Imágenes para el avatar: las de colección (medallas, logros, retratos) y cualquier Pokémon atrapado
  avatarOptions(box) {
    const p = this.profile;
    const col = (p.cosmetics && p.cosmetics.avatars) || [];
    box.append(el('h4', '', t('Colección')));
    const cgrid = el('div', 'ava-grid ava-col');
    if (!col.length) cgrid.append(el('p', 'small', t('Recoge medallas y logros en Misiones para conseguir avatares de colección.')));
    for (const id of col) {
      const b = el('button', 'ava-opt' + (p.avatar === id ? ' sel' : ''), avatarArt(id, 48));
      b.title = avatarName(id);
      b.onclick = () => this.net.send({ t: 'look', avatar: id });
      cgrid.append(b);
    }
    box.append(cgrid, el('h4', '', t('Pokémon')));
    box.append(el('p', 'small', t('Cualquiera que hayas atrapado, también en shiny si lo tienes. Con {n} victorias de su línea evolutiva, también su ilustración oficial. Por defecto, el primero de tu equipo.', { n: Data.MASTERY_ART })));
    const search = el('input');
    search.type = 'search'; search.placeholder = t('Buscar por nombre o número'); search.value = this.avaQ || '';
    const grid = el('div', 'ava-grid');
    const empty = el('p', 'small', t('No hay ningún Pokémon con esos filtros.'));
    empty.hidden = true;
    const auto = el('button', 'ava-opt' + (!p.avatar ? ' sel' : ''), `<small>${t('Automático')}</small>`);
    auto.onclick = () => this.net.send({ t: 'look', avatar: null });
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
        b.onclick = () => this.net.send({ t: 'look', avatar: dex, avatarShiny: shiny, avatarArt: art });
        grid.append(b);
        opts.push(b);
      }
    }
    const filter = () => {
      this.avaQ = search.value;
      const q = search.value.trim().toLowerCase().replace('#', '').replace(/^0+(?=\d)/, '');
      let n = 0;
      for (const b of opts) { b.hidden = !!q && !b.dataset.q.split(' ').some(w => w.startsWith(q)) && !b.dataset.q.includes(q); n += !b.hidden; }
      auto.hidden = !!q;
      empty.hidden = !q || n > 0;
    };
    search.oninput = filter;
    filter();
    box.append(search, empty, grid);
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
      const [fu, user] = field('Usuario', 'text', { maxLength: 24, autocomplete: 'username', spellcheck: false, autocapitalize: 'off' });
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
      box.append(fu, fp, f2, go, msg, this.altLogin());
    } else if (!p.account.pass) {
      // Cuenta sin contraseña: entra con Google o con un código por correo
      box.append(el('p', '', p.account.google ? t('Entras con Google (<b>{email}</b>) desde cualquier dispositivo.', { email: escapeHtml(p.account.email || '') })
        : t('Entras con tu correo (<b>{email}</b>): te mandamos un código cada vez, desde cualquier dispositivo.', { email: escapeHtml(p.account.email || '') })), msg);
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
      if (p.account) return this.logout();
      confirmBox({ title: t('Cerrar sesión'), text: t('Eres invitado: si cierras sesión sin crear una cuenta, perderás esta partida para siempre. ¿Seguro?'), ok: t('Cerrar sesión'), danger: true })
        .then(yes => yes && this.logout());
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

  // Podio de un ranking: los 3 primeros en tarjetas grandes (oro, plata y bronce) con su avatar, su marco, su título
  // y su marca; value(r) da [cifra grande, texto pequeño]. Los de la IA, con el sprite de su clase
  podium(rows, value) {
    const box = el('div', 'podium');
    rows.slice(0, 3).forEach((r, i) => {
      const card = el('button', `pod-card p${i + 1}${r.id === this.profile.id ? ' me' : ''}`);
      // Su avatar entero (animado, con marco, brillo y efecto), más grande cuanto más arriba; corona al primero
      const size = [84, 68, 58][i];
      const pic = r.npcKey ? el('div', 'pod-npc', trainerImg(r.npcKey)) : this.avatar(size, true, undefined, undefined, undefined, r);
      pic.style.setProperty('--s', size + 'px');
      if (i === 0) pic.insertAdjacentHTML('beforeend', '<i class="pod-crown">♛</i>');
      const [big, small] = value(r);
      // Capas: rayos que giran detrás del avatar, destellos, un pedestal de luz bajo el avatar y el puesto en una
      // medalla con cinta; el nombre en metal (oro, plata o bronce)
      const stage = el('span', 'pod-stage');
      stage.append(el('span', 'pod-rays'), el('span', 'pod-halo'), pic);
      const sparks = el('span', 'pod-sparks', Array.from({ length: 7 }, (_, k) => `<i style="--x:${(k * 37 + 11) % 100}%;--y:${(k * 53 + 7) % 100}%;--d:${(k * 0.43).toFixed(2)}s"></i>`).join(''));
      card.append(sparks, el('span', 'pod-rank', `<b>${i + 1}</b>`), stage,
        el('span', 'pod-who', `<b class="pod-name">${tagName(r.name, r.tag, r.npc)}</b>${r.title ? `<small class="title-chip">${escapeHtml(t(r.title))}</small>` : ''}`),
        el('span', 'pod-val', `<b>${big}</b><small>${small}</small>`));
      card.onclick = () => this.userModal(r.id);
      box.append(card);
    });
    return box;
  },

  // Foto de un entrenador en una fila de ranking: solo la imagen, sin marco ni efectos
  rowFace(r, size = 34) {
    if (r.npcKey) return `<span class="row-face npc">${trainerImg(r.npcKey)}</span>`;
    const a = this.avatar(size, false, null, null, null, r);
    a.classList.add('row-face');
    return a.outerHTML;
  },

  boardPanel() {
    const p = this.profile;
    const board = el('div', 'panel board');
    board.append(el('h3', '', t('Mejores entrenadores')));
    if (!this.board.length) { board.append(el('p', 'small', t('Todavía nadie ha jugado una clasificatoria. ¡Sé el primero!'))); return board; }
    board.append(this.podium(this.board, b => [b.elo, `${t(Data.leagueOf(b.elo))} · ${t('{w}V {l}D', { w: b.wins, l: b.losses })}`]));
    const ol = el('ol');
    ol.start = 4;
    this.board.forEach((b, i) => {
      if (i < 3) return;   // (los 3 primeros, en el podio)
      const li = el('li', 'clickable' + (b.id === p.id ? ' me' : ''));
      li.onclick = () => this.userModal(b.id);
      li.innerHTML = `<span class="pos">${i + 1}</span><span class="who">${this.rowFace(b, 30)}<b>${tagName(b.name, b.tag, b.npc)}</b>${b.title ? `<small class="title-chip">${escapeHtml(t(b.title))}</small>` : ''}</span><span class="pts">${b.elo}<small>${t(Data.leagueOf(b.elo))} · ${t('{w}V {l}D', { w: b.wins, l: b.losses })}</small></span>`;
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
