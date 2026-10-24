// Pantallas de cuenta y publicación: portada con invitado / inicio de sesión / registro, perfil
// (estadísticas, historial, títulos, marcos, avatar, contraseña), recompensas de clasificatoria,
// novedades y aviso legal. Se añaden como métodos de UI (ver el final de ui.js).
import { portrait, animatedPortrait } from './sprites.js';
import { escapeHtml } from './battle.js';
import { Net, storage } from './net.js';
import { t, locale, LANGS, LANG_CODES, getLang, setLang } from './i18n.js';

const { SPECIES, SHOP, LEAGUES, SEASON, RANKED_REWARDS, SEASON_REWARDS, RANKED_PAY, STARTERS } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const coins = n => `<span class="coin">₽</span>${n.toLocaleString(locale())}`;
const VERSION = CHANGELOG[0].v;
const GEAR_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.6 3.6.9.7-1.3 2.3-1.1-.4a5 5 0 0 1-1.4.8l-.2 1.2H7.9l-.2-1.2a5 5 0 0 1-1.4-.8l-1.1.4-1.3-2.3.9-.7a5 5 0 0 1 0-1.6l-.9-.7 1.3-2.3 1.1.4a5 5 0 0 1 1.4-.8l.2-1.2h2.6l.2 1.2a5 5 0 0 1 1.4.8l1.1-.4 1.3 2.3-.9.7a5 5 0 0 1 0 1.6Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const BOOK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2v-9Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 11.5a2 2 0 0 1 2-2h7.5M6 5h4M6 7h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const GLOBE_SVG = '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2.6 4.2 2.6 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.4 5.7 5.4 8S6 12.5 8 14.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
const SEEN_KEY = 'arena.seenVersion';
const TAG_LABEL = { nuevo: 'Nuevo', cambio: 'Cambio', arreglo: 'Arreglo' };
const FRAME_LABEL = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino', diamante: 'Diamante', maestro: 'Maestro' };
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
    box.innerHTML = `<div class="emblem"></div><h1 class="logo">Arena<br><span>Pokémon</span></h1><p class="tag">${t('Combates Pokémon en tiempo real · 966 Pokémon de 9 generaciones')}</p>`;
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
        const [fu, user] = field('Usuario', 'text', { maxLength: 16, autocomplete: 'username', spellcheck: false });
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
        if (reg) form.append(el('p', 'small', t('De 3 a 16 letras, números o _. Contraseña de al menos 6 caracteres.')));
        else if (Net.hasSession()) form.append(el('p', 'warn', t('Si entras con otra cuenta, este navegador dejará de recordar tu partida de invitado. Regístrala antes desde tu perfil.')));
        setTimeout(() => user.focus(), 50);
      }
      form.append(this.authMsg);
      form.querySelectorAll('input').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') submit(); }; });
    };
    render();
    const lang = this.langPicker();
    lang.classList.add('corner');
    box.append(lang, this.footer());
    this.root.append(box);
  },

  authError(msg) {
    if (this.authMsg) { this.authMsg.textContent = msg; this.authMsg.className = 'auth-msg' + (msg ? ' bad' : ''); }
    if (this.authBtn) this.authBtn.disabled = false;
  },

  footer() {
    const f = el('div', 'footer');
    const v = el('button', 'link', `v${VERSION}${this.hasNews() ? ' <i class="ndot news"></i>' : ''} · ${t('Novedades')}`);
    v.onclick = () => this.patchNotes();
    const legal = el('button', 'link', t('Créditos y aviso legal'));
    legal.onclick = () => this.legal();
    f.append(v, legal);
    return f;
  },

  // Selector de idioma: cambia los textos y vuelve a pintar la pantalla actual
  langPicker() {
    const wrap = el('label', 'lang-pick', GLOBE_SVG);
    wrap.title = 'Idioma / Language';
    const sel = el('select', 'lang-select');
    sel.setAttribute('aria-label', 'Idioma / Language');
    wrap.append(sel);
    for (const [id, name] of Object.entries(LANGS)) {
      const o = el('option', '', name);
      o.value = id;
      o.selected = id === getLang();
      sel.append(o);
    }
    sel.onchange = () => setLang(sel.value).then(ok => { if (ok) { this.app.onLang(); this.show(this.view); } });
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
        <p>${t('Arena Pokémon es un <b>proyecto de fans sin ánimo de lucro</b>. No está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios.')}</p>
        <p>${t('Los sprites proceden de la comunidad de <i>Pokémon Mundo Misterioso</i> (PMD Sprite Collab) y se usan con atribución a sus artistas. Los datos de especies vienen de PokéAPI. Los tiles del mapa son CC0.')}</p>
        <p>${t('La lista completa de autores está en <code>CREDITS.md</code>, en el repositorio del proyecto.')}</p>
        <h4>${t('Datos que guardamos')}</h4>
        <p class="small">${t('Tu nombre de entrenador, tu partida y, si creas cuenta, tu usuario y tu contraseña cifrada (scrypt con sal). No pedimos correo ni datos personales. Este navegador recuerda tu sesión con una clave en el almacenamiento local.')}</p>`));
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
  avatarDex() {
    const p = this.profile;
    if (p.avatar && SPECIES[p.avatar]) return p.avatar;
    const leadUid = p.teams && (p.teams[this.region || 'kanto'] || [])[0];
    const lead = p.mons.find(m => m.uid === leadUid) || p.mons[0];
    return lead ? lead.dex : 25;
  },

  avatar(size, animated) {
    const p = this.profile;
    const a = el('div', 'ava frame-' + (p.frame || 'none'));
    a.style.setProperty('--s', size + 'px');
    const dex = this.avatarDex();
    a.append(animated ? animatedPortrait(dex, size, 'Idle') : portrait(dex, size));
    return a;
  },

  // Botón de la barra superior: avatar, nombre y acceso al perfil (con aviso si hay algo que reclamar)
  profileChip() {
    const p = this.profile;
    const b = el('button', 'me-chip');
    b.append(this.avatar(30));
    b.append(el('span', '', escapeHtml(p.name)));
    if (this.claimable().length || !p.account) b.append(el('i', 'ndot'));
    b.title = p.account ? t('Perfil de {user}', { user: p.account.user }) : t('Perfil (invitado: crea una cuenta para no perder tu partida)');
    b.onclick = () => this.show('profile');
    return b;
  },

  // Icono de diario en el menú: abre las novedades (con un punto si hay algo sin ver)
  newsIcon() {
    const b = el('button', 'news-btn', `${BOOK_SVG}${this.hasNews() ? '<i class="ndot news"></i>' : ''}`);
    b.title = t('Novedades');
    b.setAttribute('aria-label', t('Novedades'));
    b.onclick = () => this.patchNotes();
    return b;
  },

  // Botón de la barra superior que lleva a Ajustes
  settingsButton() {
    const b = el('button', 'settings-btn', `${GEAR_SVG}<span>${t('Ajustes')}</span>`);
    b.title = t('Ajustes: idioma, perfil, novedades y créditos');
    b.onclick = () => this.show('settings');
    return b;
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
      const b = el('button', 'lang-opt' + (id === getLang() ? ' sel' : ''), `<b>${name}</b><small>${LANG_CODES[id] || id.toUpperCase()}</small>`);
      b.onclick = () => setLang(id).then(ok => { if (ok) { this.app.onLang(); this.show('settings'); } });
      langs.append(b);
    }
    lang.append(langs);

    // Perfil y cuenta
    const me = el('div', 'panel');
    me.append(el('h3', '', t('Perfil y cuenta')));
    const who = el('button', 'who settings-who');
    who.append(this.avatar(64), el('div', '', `<b>${escapeHtml(p.name)}</b><span class="elo">${t(p.league)} · ${p.elo}</span><small>${p.account ? t('Cuenta <b>@{user}</b>', { user: escapeHtml(p.account.user) }) : t('Invitado')}</small>`));
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
    about.append(el('h3', '', t('Créditos y aviso legal')), el('p', 'small', t('Arena Pokémon es un <b>proyecto de fans sin ánimo de lucro</b>. No está afiliado, patrocinado ni aprobado por Nintendo, Game Freak, Creatures Inc. ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos propietarios.')));
    const legal = el('button', '', t('Ver créditos y datos que guardamos'));
    legal.onclick = () => this.legal();
    about.append(legal, el('p', 'small', `Arena Pokémon v${VERSION}`));

    body.append(lang, me, news, about);
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
    info.append(el('p', 'small', p.account
      ? t('Cuenta <b>@{user}</b> · desde {date}', { user: escapeHtml(p.account.user), date: fmtDate(p.account.since) })
      : `<span class="warn">${t('Invitado')}</span> · ${t('jugando desde {date}', { date: fmtDate(p.created) })}`));
    info.append(el('div', 'tc-league', `<span class="league">${t(p.league)}</span><span class="elo">${p.elo} ELO</span>${this.rank ? `<span class="pill">${t('#{n} del ranking', { n: this.rank })}</span>` : ''}`));
    card.append(info);
    left.append(card);

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
      for (const d of h.team || []) team.append(portrait(d, 32));
      team.append(el('span', 'vs', 'vs'));
      for (const d of h.foeTeam || []) team.append(portrait(d, 32));
      row.append(team);
      row.append(el('div', 'h-info', `<span>${escapeHtml(h.foe)} <small>(${h.foeElo})</small></span><small>${ago(h.at)}</small>`));
      row.append(el('b', 'delta', `${h.delta >= 0 ? '+' : ''}${h.delta}`));
      hist.append(row);
    }
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
    const frames = el('div', 'chips');
    for (const f of [null, ...cos.frames]) {
      const b = el('button', 'chip frame-swatch' + ((p.frame || null) === f ? ' sel' : ''), `<i class="sw frame-${f || 'none'}"></i>${f ? t(FRAME_LABEL[f] || f) : t('Ninguno')}`);
      b.onclick = () => this.net.send({ t: 'look', frame: f });
      frames.append(b);
    }
    look.append(el('h4', '', t('Marco')), frames);
    look.append(el('p', 'small', t('Consigue más títulos y marcos subiendo de liga en Clasificatoria.')));
    const avaBtn = el('button', '', t('Elegir Pokémon de avatar'));
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
      box.append(el('h3', '', t('Pokémon de avatar')), el('p', 'small', t('Cualquiera que hayas atrapado. Por defecto, el primero de tu equipo.')));
      const grid = el('div', 'ava-grid scroll');
      const auto = el('button', 'ava-opt' + (!p.avatar ? ' sel' : ''), `<small>${t('Automático')}</small>`);
      auto.onclick = () => { this.net.send({ t: 'look', avatar: null }); close(); };
      grid.append(auto);
      for (const dex of [...p.caught].sort((a, b) => a - b)) {
        if (!SPECIES[dex]) continue;
        const b = el('button', 'ava-opt' + (p.avatar === dex ? ' sel' : ''));
        b.append(portrait(dex, 48));
        b.title = SPECIES[dex].name;
        b.onclick = () => { this.net.send({ t: 'look', avatar: dex }); close(); };
        grid.append(b);
      }
      box.append(grid);
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
      const [fu, user] = field('Usuario', 'text', { maxLength: 16, autocomplete: 'username', spellcheck: false });
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
      box.append(el('p', '', t('Usuario <b>@{user}</b>. Entra con él desde cualquier dispositivo.', { user: escapeHtml(p.account.user) })));
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
      card.innerHTML = `<i class="sw frame-${r.frame}"></i><b>${t(name)}</b><small>${min ? min + ' ELO' : t('inicio')}</small>
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
      li.innerHTML = `<span class="pos">${i + 1}</span><span class="who"><i class="sw frame-${b.frame || 'none'}"></i><b>${escapeHtml(b.name)}</b>${b.title ? `<small class="title-chip">${escapeHtml(t(b.title))}</small>` : ''}</span><span class="pts">${b.elo}<small>${t(Data.leagueOf(b.elo))} · ${t('{w}V {l}D', { w: b.wins, l: b.losses })}</small></span>`;
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
