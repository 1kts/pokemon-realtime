// Pantallas fuera de combate: menú, historia (inicial, mapa, equipo, tienda),
// clasificatoria (cola, draft, ranking), práctica y resultados. Torre Batalla y Ladder en tower.js;
// la portada, el perfil, las recompensas y las novedades en account.js.
import { confirmBox } from './dialog.js';
import { portrait, monIcon, animatedPortrait, trainerImg, typeTint, face, hasAnim } from './sprites.js';
import { escapeHtml, describeMove, monLabel } from './battle.js';
import { REGION_ART, regionMapSVG } from './regionmap.js';
import { towerViews } from './tower.js';
import { pokedexViews } from './pokedex.js';
import { bagViews } from './bag.js';
import { achievementViews } from './achievements.js';
import { missionViews } from './missions.js';
import { legalBarViews } from './legalbar.js';
import { collectionViews } from './collection.js';
import { treasureViews } from './treasure.js';
import { dropdown, typeDropdown } from './dropdown.js';
import { storage } from './net.js';
import { icon, item as itemImg, badgeImg, typeIcon } from './pixicons.js';
import { masteryHtml, frameBadge, masteryPrize } from './frames.js';
import { accountViews } from './account.js';
import { t, locale } from './i18n.js';
import { trackForView } from './music.js';
import { dailyViews } from './daily.js';
import { tutorialViews } from './tutorial.js';
import { monSheetViews } from './monsheet.js';

const { SPECIES, MOVES, TYPE_LABEL, TYPE_COLOR, ROUTES, GYMS, SHOP, STARTERS, RANKED_POOL, xpToNext, LEAGUES } = Data;
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
export const typeChips = dex => SPECIES[dex].types.map(t => `<span class="type" style="--tc:${TYPE_COLOR[t]}">${TYPE_LABEL[t]}</span>`).join('');
export const coins = n => `<span class="coin">${icon('coin', 16)}</span>${n.toLocaleString(locale())}`;
export const lv = n => t('Nv.{n}', { n });
// Para buscar sin que importen mayúsculas ni tildes (Flabébé = flabebe)
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const wl = (w, l) => t('{w}V {l}D', { w, l });
// Orden del recorrido por el mapa (rutas y gimnasios intercalados)
const DIFFICULTIES = [['Fácil', 0.1], ['Normal', 0.28], ['Difícil', 0.5], ['Maestro', 0.85]];
// Regiones que llegarán más adelante: se enseñan con candado en la barra de región
const UPCOMING_REGIONS = ['Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
// Iconos de la barra superior
const svg = body => `<svg viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;
// Ruleta de Lucky Spin (8 sectores de colores, aro dorado y puntero)
const WHEEL_SVG = '<svg class="wheel-ico" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><circle cx="16" cy="17" r="13.5" fill="#2a1c00"/><path d="M16 17L16.00 5.00A12 12 0 0 1 24.49 8.51Z" fill="#ff5a7a"/><path d="M16 17L24.49 8.51A12 12 0 0 1 28.00 17.00Z" fill="#ffd23f"/><path d="M16 17L28.00 17.00A12 12 0 0 1 24.49 25.49Z" fill="#5fc8ff"/><path d="M16 17L24.49 25.49A12 12 0 0 1 16.00 29.00Z" fill="#9dff7a"/><path d="M16 17L16.00 29.00A12 12 0 0 1 7.51 25.49Z" fill="#ff7ad8"/><path d="M16 17L7.51 25.49A12 12 0 0 1 4.00 17.00Z" fill="#ffa63a"/><path d="M16 17L4.00 17.00A12 12 0 0 1 7.51 8.51Z" fill="#7a8cff"/><path d="M16 17L7.51 8.51A12 12 0 0 1 16.00 5.00Z" fill="#5fe0c0"/><circle cx="16" cy="17" r="12.5" fill="none" stroke="#ffd23f" stroke-width="2"/><circle cx="16" cy="17" r="3" fill="#fff4b0" stroke="#2a1c00" stroke-width="1.2"/><path d="M12.5 1.5h7L16 7.5Z" fill="#fff" stroke="#2a1c00" stroke-width="1.2" stroke-linejoin="round"/></svg>';
// Cartel de cada pantalla interior: su color (el de su carta del menú) y qué es
const FEATURE = {
  treasure: ['#ff4f8a', () => t('Gasta tus gemas en una ruleta de premios')], tower: ['#a070ff', () => t('Combates seguidos a Nv.50: ¿hasta dónde llegas?')],
  shop: ['#2fbf8a', () => t('Balls, objetos y los Pokémon del día')], bag: ['#30b8c8', () => t('Tus objetos: úsalos en tus Pokémon')],
  team: ['#c070e0', () => t('Tu equipo y tu caja de cada región')], story: ['#ff5a3a', () => t('Tu viaje: rutas, gimnasios y Campeón')],
  starter: ['#ff5a3a', () => t('Tu viaje: rutas, gimnasios y Campeón')], online: ['#e8a800', () => t('Draft, ELO y ligas contra otros entrenadores')],
  practice: ['#4fd06a', () => t('Contra la IA, sin arriesgar nada')], missions: ['#3b78d8', () => t('Cúmplelas, recoge su premio y abre el cofre')],
  collection: ['#e8a800', () => t('Retos para conseguir skins, marcos, títulos y más')], dex: ['#e8403a', () => t('Todas las especies y dónde encontrarlas')],
  profile: ['#3b78d8', () => t('Tu tarjeta de entrenador, títulos y marcos')], settings: ['#7a86a8', () => t('Idioma, sonido, cursor y cuenta')],
  ladder: ['#30c8d8', () => t('Rankings de clasificatoria, Torre y Pokédex')],
};
export const ICON = {
  dex: svg('<rect x="4" y="3" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 13h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  help: svg('<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.9 7.8a2.2 2.2 0 1 1 3 2c-.6.3-.9.8-.9 1.4v.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="14.3" r="1" fill="currentColor"/>'),
  back: svg('<path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  ball: svg('<circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.8 10h4.6M12.6 10h4.6" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.3 8.6a7.2 7.2 0 0 1 13.4 0" fill="currentColor" opacity=".35"/>'),
  bag: svg('<path d="M4.5 7.5h11l-.9 9h-9.2l-.9-9Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.3 7.5V6a2.7 2.7 0 0 1 5.4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  trophy: svg('<path d="M6 3.5h8v4a4 4 0 0 1-8 0v-4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 5H3.5a2.5 2.5 0 0 0 2.6 3M14 5h2.5a2.5 2.5 0 0 1-2.6 3M10 11.5V14M6.8 16.5h6.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
};
// Color de cada región en su pestaña
const REGION_COLOR = { kanto: '#ff5a3a', johto: '#e8b020' };
const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screen');
    this.toastEl = document.getElementById('toasts');
    this.profile = null;
    this.board = [];
    this.view = 'title';
    this.lastMode = null;
    this.legalBar();   // aviso legal fijo abajo, en todas las pantallas menos el combate
  }

  get net() { return this.app.net; }

  setProfile(p, board, rank) {
    const first = !this.profile;
    if (!first) this.celebrateAchievements(this.profile.achievements, p.achievements);
    this.profile = p;
    this.board = board || this.board;
    this.rank = rank;
    if (this.onProfile) this.onProfile(p);
    if (this.sheet) setTimeout(() => this.refreshSheet(), 0);
    if (this.pendingFicha) {
      const mon = p.mons.find(m => m.uid === this.pendingFicha);
      this.pendingFicha = null;
      if (mon && !this.root.hidden) setTimeout(() => this.statsModal(mon), 0);
    }
    if (first) {
      this.show('menu');
      // Primera vez en esta versión: enseñar las novedades; si no, el premio diario si está por recoger
      if (this.hasNews() && !p.inbox?.length) setTimeout(() => this.patchNotes(), 400);
      else this.dailyAuto();
    } else if (!this.root.hidden && ['menu', 'story', 'team', 'shop', 'bag', 'online', 'tower', 'profile', 'settings', 'missions', 'collection', 'treasure'].includes(this.view) && !this.tzSpin) this.show(this.view, true);
    if (!this.root.hidden) this.showInbox();
  }

  toast(text, cls = '', ms = 3200) {
    const t = el('div', 'toast ' + cls, escapeHtml(text));
    this.toastEl.append(t);
    setTimeout(() => t.remove(), ms);
  }

  show(view, keepScroll) {
    const scroll = keepScroll ? (this.root.querySelector('.scroll') || {}).scrollTop : 0;
    this.view = view;
    // Durante un combate (y el momento final antes de los resultados) la música la pone el combate:
    // repintar el menú de debajo, p. ej. al llegar el perfil nuevo, no debe cortar la fanfarria
    const track = !this.app.battle && trackForView(view);
    if (track) this.app.music.play(track);
    this.root.hidden = false;
    this.root.innerHTML = '';
    this.refreshLegalBar();   // idioma y aviso de novedades al día
    document.querySelectorAll('body > .dd-menu').forEach(m => m.remove());   // desplegables que quedaran abiertos
    const fn = this['view_' + view];
    if (fn) fn.call(this);
    const sc = this.root.querySelector('.scroll');
    if (sc && scroll) sc.scrollTop = scroll;
  }

  // Abre Mis Pokémon o la Tienda recordando de dónde se viene para que "Volver" regrese allí
  openFrom(view) {
    if (!['team', 'shop', 'dex', 'bag'].includes(this.view)) this.returnTo = this.view;
    this.show(view);
  }

  hide() { this.root.hidden = true; this.root.innerHTML = ''; }

  // Cabecera de las pantallas interiores: la misma que la de la portada (logo en medio y tu perfil, dinero y
  // Ajustes a la derecha), con Volver y el título de la pantalla a la izquierda en vez del idioma
  // Cabecera de las pantallas interiores (a pantalla completa, sin logo ni perfil): Volver, el cartel de la
  // pantalla (su nombre y qué es, del color de la sección) y a la derecha el dinero donde se gasta
  topbar(title, back) {
    const bar = el('header', 'hub-bar inner-bar');
    const VIEW_NAME = { menu: t('Menú principal'), story: t('Historia'), team: t('Mis Pokémon'), bag: t('Mochila'), shop: t('Tienda'), dex: t('Pokédex'),
      ladder: t('Ladder'), online: t('Clasificatoria'), tower: t('Torre Batalla'), profile: t('Perfil'), settings: t('Ajustes'), practice: t('Práctica'), missions: t('Misiones'), collection: t('Logros'), treasure: t('Lucky Spin') };
    const left = el('div', 'hub-mod tb-left');
    if (back) {
      const b = el('button', 'tb-btn back', `${ICON.back}<span>${t('Volver')}</span>`);
      b.setAttribute('aria-label', t('Volver'));
      b.onclick = () => this.show(back);
      left.append(VIEW_NAME[back] ? this.hoverTip(b, `<b>${t('Volver')}</b><p>${t('Volver a {view}', { view: VIEW_NAME[back] })}</p>`) : b);
    }
    const [color, sub] = FEATURE[this.view] || ['#6f7dff', null];
    const sign = el('div', 'feature-sign sign-' + this.view, `<div><h2>${title}</h2>${sub ? `<small>${sub()}</small>` : ''}</div>`);
    sign.style.setProperty('--fc', color);
    const right = el('div', 'tb-ctx');
    if (['shop', 'bag', 'team'].includes(this.view)) right.append(el('span', 'pill coins' + (this.coinBump ? ' bump' : ''), coins(this.profile.coins)));
    this.coinBump = false;
    bar.append(left, sign, right);
    return bar;
  }

  // ---------- Menú ----------
  view_menu() {
    const p = this.profile;
    const wrap = el('div', 'menu');
    wrap.append(this.hubBar());
    const top = el('div', 'menu-top');
    const main = el('div', 'menu-main');
    // Cada sección: cabecera y su rejilla de tarjetas
    const section = (title, sub) => {
      const sec = el('section', 'menu-sec');
      sec.append(el('div', 'sec-head', `<h3>${title}</h3><small>${sub}</small>`));
      const grid = el('div', 'menu-grid');
      sec.append(grid);
      main.append(sec);
      return grid;
    };
    const CARD_ICON = { story: 'town-map', tower: 'relic-crown', ranked: 'master-ball', casual: 'vs-seeker', practice: 'tm-normal', ladder: 'medal-box', tutorial: 'exp-share' };
    const card = (grid, title, desc, cls, art, onClick) => {
      const ic = CARD_ICON[cls.split(' ')[0]];
      const c = el('button', 'menu-card ' + cls, `<b>${ic ? itemImg(ic, 40, 'card-ico') : ''}${title}</b><span>${desc}</span><i class="go">${t('Jugar')} ›</i>`);
      // El Pokémon de la carta salta mientras tienes el ratón encima
      const sprite = anim => { const a = this.skinned(animatedPortrait(art, 120, anim), art); a.classList.add('art'); return a; };
      c.prepend(sprite('Idle'));
      c.onmouseenter = () => c.querySelector('.art').replaceWith(sprite('Hop'));
      c.onmouseleave = () => c.querySelector('.art').replaceWith(sprite('Idle'));
      c.onclick = onClick;
      grid.append(c);
    };
    const leadUid = p.teams && (p.teams[this.region || 'kanto'] || [])[0];
    const lead = p.mons.find(m => m.uid === leadUid) || p.mons[0] || null;
    const regs = Data.REGION_IDS.map(r => `${Data.REGIONS[r].name} ${Data.progOf(p, r) >= 13 ? '♛' : Math.min(8, Data.progOf(p, r)) + '/8'}`).join(' · ');
    const tw = p.tower;
    const adventure = section(t('Aventura'), t('Tu viaje por las regiones y los retos de la Torre'));
    card(adventure, t('Historia'), p.mons.length ? `${regs} · ${t('{n} Pokémon', { n: p.mons.length })}` : t('Elige tu primer Pokémon y viaja por Kanto y Johto'), 'story wide', lead ? lead.dex : 25, () => this.show('story'));
    card(adventure, t('Torre Batalla'), tw.team ? t('Racha en curso: {s} · bloque {b}', { s: tw.streak, b: tw.block }) : t('Combates seguidos a Nv.50 · récord {n}', { n: tw.best }), 'tower', 248, () => this.show('tower'));
    const online = section(t('Online'), t('Contra otros entrenadores y sus rankings'));
    const ready = this.claimable().length;
    card(online, t('Clasificatoria'), `${t(p.league)} · ${p.elo} ELO · ${wl(p.wins, p.losses)}${ready ? ` · <em class="ready">${ready > 1 ? t('¡{n} premios por reclamar!', { n: ready }) : t('¡1 premio por reclamar!')}</em>` : ''}`, 'ranked', 149, () => this.show('online'));
    card(online, t('Partida rápida'), t('Online sin ELO: elige 3 y a combatir'), 'casual', 6, () => { this.lastMode = 'casual'; this.net.send({ t: 'queue', mode: 'casual' }); });
    card(online, t('Ladder'), t('Rankings de clasificatoria, Torre y Pokédex: busca a cualquier entrenador'), 'ladder', 448, () => this.openLadder());
    const training = section(t('Entrenamiento'), t('Contra la IA, sin arriesgar nada'));
    card(training, t('Práctica'), t('Contra la IA, con la dificultad que quieras'), 'practice', 68, () => this.show('practice'));
    card(training, t('Tutorial'), p.tutorial ? t('Repasa los controles en 1 minuto') : t('Aprende a jugar en 1 minuto y llévate un premio'), 'tutorial' + (p.tutorial ? '' : ' ready'), 6, () => this.startTutorial());
    // Lateral: accesos a lo tuyo y misiones (el perfil se abre desde el avatar de arriba)
    const side = el('div', 'menu-side');
    side.append(this.collectionTiles());
    if (p.missions) side.append(this.missionsWidget());
    top.append(main, side);
    wrap.append(top, this.howTo());
    this.root.append(wrap);
  }

  // Cabecera de la portada: idioma y pantalla completa a la izquierda, tu perfil, dinero y novedades a la derecha
  hubBar() {
    const bar = el('header', 'hub-bar');
    const tools = el('div', 'hub-mod hub-tools');
    tools.append(this.langPicker(), this.fullscreenButton());
    // Lucky Spin (las ruletas de Tesoros), en su propia burbuja junto a la de idioma y pantalla completa (brilla si te llega para una tirada)
    const p = this.profile;
    const tz = el('button', 'hub-mod hub-tz' + (this.treasureReady() ? ' ready' : ''), `${WHEEL_SVG}<span><b>${t('Lucky Spin')}</b><small>${t('{n} gemas', { n: (p.gems || 0).toLocaleString() })}</small></span>`);
    tz.onclick = () => this.openTreasure();
    const left = el('div', 'hub-left');
    left.append(tools, this.hoverTip(tz, `<b>${t('Lucky Spin')}</b><p>${t('Ruletas de skins, partículas, efectos y retratos que se giran con gemas.')}</p>`));
    bar.append(left, el('h1', 'hub-logo', 'Poké<b>Arenas</b>'), this.meModule());
    return bar;
  }

  // Tu perfil (avatar, nombre y liga), dinero, novedades, apoyo y Ajustes: a la derecha de todas las cabeceras
  meModule() {
    const p = this.profile;
    const me = el('div', 'hub-mod hub-me');
    const ava = el('button', 'hub-ava');
    ava.setAttribute('aria-label', t('Perfil'));
    ava.append(this.avatar(80, true));
    if (this.claimable().length || !p.account || this.masteryReadyCount()) ava.append(el('i', 'ndot'));
    ava.onclick = () => this.show('profile');
    const info = el('div', 'hub-who', `<b>${escapeHtml(p.name)}</b><small>${t(p.league)} · ${p.elo}</small>`);
    const coinPill = el('span', 'pill coins' + (this.coinBump ? ' bump' : ''), coins(p.coins));
    this.coinBump = false;
    const gemPill = el('button', 'pill gems', `${icon('gem', 16)}${(p.gems || 0).toLocaleString()}`);
    gemPill.onclick = () => this.openTreasure();
    const ready = this.claimable().length;
    me.append(this.hoverTip(ava, `<b>${escapeHtml(p.name)}</b><span class="tip-sub">${t(p.league)} · ${p.elo} ELO</span><p>${t('Tu perfil: tarjeta de entrenador, historial, títulos, marcos y cuenta.')}</p>
      ${!p.account ? `<p class="tip-warn">${t('Invitado: crea una cuenta para no perder tu partida.')}</p>` : ''}
      ${ready ? `<p class="tip-good">${ready > 1 ? t('¡{n} premios por reclamar!', { n: ready }) : t('¡1 premio por reclamar!')}</p>` : ''}`),
      info,
      this.hoverTip(coinPill, `<b>${t('Dinero')}</b><span class="tip-sub">${coins(p.coins)}</span><p>${t('Se gana en combates, en la Torre y en clasificatoria, y se gasta en la Tienda.')}</p>`),
      this.hoverTip(gemPill, `<b>${t('Gemas')}</b><span class="tip-sub">${(p.gems || 0).toLocaleString()}</span><p>${t('Para las ruletas de Lucky Spin. Salen de misiones, líderes, la Torre, la primera victoria online del día y los salvajes raros.')}</p>`),
      el('i', 'hub-sep'), this.newsIcon(), this.supportButton(), this.settingsButton());
    return me;
  }

  // Pantalla completa: solo si el navegador la permite
  fullscreenButton() {
    const b = el('button', 'tb-btn icon fs-btn', svg('<path d="M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'));
    b.setAttribute('aria-label', t('Pantalla completa'));
    b.title = t('Pantalla completa');
    b.hidden = !document.fullscreenEnabled;
    b.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
    const sync = () => b.classList.toggle('on', !!document.fullscreenElement);
    document.onfullscreenchange = sync;   // una sola escucha: se pisa al repintar
    sync();
    return b;
  }

  // Accesos a lo tuyo con su cuenta: Pokémon, mochila, tienda y Pokédex
  collectionTiles() {
    const p = this.profile;
    const box = el('section', 'panel hub-coll');
    box.append(el('h3', '', t('Tu colección')));
    const grid = el('div', 'coll-grid');
    const items = Object.values(p.items || {}).reduce((a, n) => a + (n > 0 ? n : 0), 0);
    const tile = (ico, label, sub, view, cls = '') => {
      const b = el('button', 'coll-tile ' + cls, `${ico.startsWith('<') ? ico : itemImg(ico, 40)}<span class="coll-txt"><b>${label}</b><small>${sub}</small></span>`);
      b.onclick = typeof view === 'function' ? view : () => this.openFrom(view);
      grid.append(b);
      return b;
    };
    tile('pokeball', t('Mis Pokémon'), t('{n} Pokémon', { n: p.mons.length }), 'team');
    tile('seal-bag', t('Mochila'), t('{n} objetos', { n: items }), 'bag');
    // La Tienda avisa cuando han rotado los Pokémon del día y aún no la has abierto
    tile('forage-bag', t('Tienda'), coins(p.coins), 'shop', storage.get('arena.shopSeen') === Data.dayKey() ? '' : 'ready');
    tile('rotom-catalog', t('Pokédex'), `${p.caught.length} / ${Object.keys(SPECIES).length}`, 'dex');
    // Logros: retos de línea y generales, y la colección (con aviso si hay premios por recoger)
    const ready = this.masteryReadyCount() + (p.achClaim || []).length;
    const m = tile('relic-crown', t('Logros'), ready ? t('¡{n} premios por recoger!', { n: ready }) : t('Retos para conseguir skins, marcos, títulos y más'), () => this.openCollection(), 'wide' + (ready ? ' ready' : ''));
    if (ready) m.append(el('i', 'nbadge', String(ready)));
    box.append(grid);
    return box;
  }

  howTo() {
    const d = el('details', 'howto');
    const li = items => items.map(x => `<li>${x}</li>`).join('');
    d.innerHTML = `<summary>${t('Cómo se juega')}</summary>
      <div class="cols">
      <div><h4>${t('Controles')}</h4><ul>${li([
        t('<kbd>WASD</kbd> moverte · <kbd>Ratón</kbd> apuntar'),
        t('<kbd>Clic</kbd> <kbd>Clic dcho</kbd> <kbd>Q</kbd> <kbd>E</kbd> los 4 movimientos'),
        t('<kbd>Espacio</kbd> Protección · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> cambiar de Pokémon'),
        t('<kbd>F</kbd> lanzar Poké Ball · <kbd>R</kbd> cambiar de Ball (salvajes) · <kbd>Esc</kbd> rendirse')])}</ul></div>
      <div><h4>${t('Combate')}</h4><ul>${li([
        t('Cada ataque tiene <b>preparación</b> (se ve en el suelo: ¡esquívalo!) y <b>recuperación</b> (eres vulnerable).'),
        t('<b>Protección</b> bloquea el 80 %. Si el golpe llega en sus primeros {ms} ms haces <b>parry</b>: devuelves el proyectil o aturdes al atacante.', { ms: Math.round(Data.PROTECT.perfect * 1000) }),
        t('Los ataques fuertes gastan <b>energía</b>; se recarga sola y al golpear.'),
        t('<b>Cambio perfecto</b>: si el que entra recibe un ataque de un tipo que resiste, no le hace nada y ganas energía.'),
        t('Cada ataque tiene su <b>forma</b>: proyectil, cono delante de ti, rayo, ola o explosión donde apuntas. Te lo dice el emblema del movimiento.')])}</ul></div>
      <div><h4>${t('Terreno')}</h4><ul>${li([
        t('En la <b>hierba alta</b> te escondes si no atacas. El <b>vapor</b> también oculta.'),
        t('El fuego <b>quema la hierba</b> y se propaga. Fuego + agua = <b>vapor</b>.'),
        t('Un ataque eléctrico en un charco <b>electrocuta</b> a quien esté en el agua. Mojado = más daño eléctrico y de hielo.'),
        t('El hielo <b>congela el agua</b> y el fuego derrite el hielo.'),
        t('A los 2 min, <b>muerte súbita</b>: más daño y sin curar. A los 3 min gana quien tenga más PS.')])}</ul></div>
      <div><h4>${t('Arenas')}</h4><ul>${li([
        t('Cada líder pelea en <b>su arena</b>, con su escenario y su mecánica: rocas que caen, marea, placas eléctricas, lava, teletransportes…'),
        t('Los Pokémon del tipo de la arena <b>aguantan su peligro</b>: los de fuego la lava, los eléctricos las placas, los voladores el viento…'),
        t('Contra el <b>Terremoto</b>, escóndete detrás de una roca (zona verde) y la onda no te alcanza.'),
        t('El Alto Mando y los Campeones tienen <b>salas propias</b>, con varias mecánicas a la vez y Pokémon muy entrenados.')])}</ul></div>
      </div>`;
    return d;
  }

  // ---------- Historia ----------
  view_story() {
    const p = this.profile;
    const region = this.region = this.region || 'kanto';
    if (!p.mons.some(m => (m.region || 'kanto') === region)) return this.view_starter(region);
    const R = Data.REGIONS[region];
    const prog = Data.progOf(p, region);
    const wrap = el('div', 'story');
    const bar = this.topbar(t('Historia'), 'menu');
    const sb = this.regionBar(region, rid => { this.region = rid; this.show('story'); }, true);
    // Bajo las regiones, dos bloques: tu objetivo (más abajo) y la rotación de las rutas con la guía. El
    // «Siguiente: líder · tope» de la barra sobra aquí: lo dice ya «Tu objetivo»
    sb.querySelector('.next-goal').remove();
    const tools = el('div', 'panel story-info');
    tools.append(this.rotationTimer('long'));
    const help = el('button', 'tb-btn help', `${ICON.help}<span>${t('Cómo se juega')}</span>`);
    help.onclick = () => this.storyGuide();
    tools.append(help);
    wrap.append(bar, sb);
    if (!storage.get('arena.storyGuide')) { storage.set('arena.storyGuide', '1'); setTimeout(() => this.storyGuide(), 400); }
    const body = el('div', 'story-body');
    const map = el('div', 'map region-' + region);
    // Lienzo con la proporción del mapa (16:10), centrado; el mar del SVG rellena lo que sobre
    const stage = el('div', 'map-stage', regionMapSVG(region));
    map.append(stage);
    const art = REGION_ART[region];
    // Ciudad con líder: su nombre va en la etiqueta del líder; si no, etiqueta propia
    const cityAt = n => art.cities.find(([, x, y]) => Math.hypot(x - n.x, y - n.y) < 4);
    const leaderCities = new Set(R.nodes.filter(n => n.kind !== 'route').map(cityAt).filter(Boolean));
    for (const city of art.cities) {
      if (leaderCities.has(city)) continue;
      const [name, x, y] = city;
      const c = el('div', 'city', `<span>${t(name)}</span>`);
      c.style.left = x + '%'; c.style.top = y + '%';
      stage.append(c);
    }
    const nodes = R.nodes;
    const leaders = nodes.filter(n => n.kind !== 'route');
    const allDone = prog >= leaders.length;
    const nextLeader = leaders.find(n => n.index === prog);
    // Dónde estás: la ciudad del último líder vencido, o el pueblo de salida
    const lastBeaten = leaders.find(n => n.index === prog - 1);
    const here = lastBeaten ? { x: lastBeaten.x, y: lastBeaten.y } : { x: art.cities[0][1], y: art.cities[0][2] };
    // A dónde puedes ir: las rutas que abre la última medalla y el siguiente líder
    const fresh = nodes.filter(n => n.kind === 'route' && n.req === prog);
    const targets = [...fresh, ...(nextLeader ? [nextLeader] : [])];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('paths');
    svg.innerHTML = targets.map(n => `<line class="leg${n === nextLeader ? ' goal' : ''}" x1="${here.x}" y1="${here.y}" x2="${n.x}" y2="${n.y}" vector-effect="non-scaling-stroke"/>`).join('');
    stage.append(svg);
    const pin = el('div', 'you-pin');
    pin.style.left = here.x + '%'; pin.style.top = here.y + '%';
    pin.append(this.avatar(26), el('span', '', t('Estás aquí')));
    stage.append(pin);
    const info = el('div', 'node-info');
    const buttons = new Map();
    nodes.forEach(n => {
      const isLeader = n.kind !== 'route';
      const unlocked = isLeader ? n.index <= prog : n.req <= prog;
      const done = isLeader && n.index < prog;
      const isNew = !isLeader && n.req === prog && unlocked;
      const b = el('button', `node ${isLeader ? 'gym ' + n.kind : 'route'}${unlocked ? '' : ' locked'}${done ? ' done' : ''}${n === nextLeader ? ' next' : ''}${isNew ? ' new' : ''}`);
      b.style.left = n.x + '%'; b.style.top = n.y + '%';
      if (isLeader) b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = isLeader ? `${n.name} · ${n.leader}` : n.name;
      const city = isLeader && cityAt(n);
      // Gimnasio: su medalla (en color si la tienes); Alto Mando y Campeón, estrella y corona
      const face = n.kind === 'gym' ? badgeImg(region, n.index, done, 28, 'node-badge') : isLeader ? `<span class="node-face">${trainerImg(n.id)}</span>${n.kind === 'champion' ? '<i class="crown">♛</i>' : ''}` : '';
      let extra = '';
      if (!isLeader && unlocked) {
        const dexes = [...new Set(n.wild.map(([d]) => d))];
        const got = dexes.filter(d => p.caught.includes(d)).length;
        extra = `<em class="caught-count${got === dexes.length ? ' full' : ''}">${got === dexes.length ? '✓' : got + '/' + dexes.length}</em>`;
      }
      if (!unlocked) extra = `<em class="lock">${LOCK_SVG}</em>`;
      if (isNew) extra += `<em class="new-tag">${t('Nueva')}</em>`;
      if (n === nextLeader) extra += `<em class="goal-tag">${t('Siguiente reto')}</em>`;
      b.innerHTML = `${face}<label>${isLeader ? n.leader : n.name}${city ? `<small>${t(city[0])}</small>` : ''}</label>${extra}`;
      if (!isLeader && unlocked && n.wild.length) b.prepend(monIcon(n.wild[0][0], 36));
      b.onclick = () => { map.querySelectorAll('.node').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); this.nodeInfo(info, n, unlocked, done); };
      buttons.set(n.id, b);
      stage.append(b);
    });
    // Objetivo actual y leyenda
    const goal = el('div', 'map-goal');
    const cap = Data.levelCap(p, region);
    if (allDone) goal.innerHTML = `<b>${t('¡Has completado {r}!', { r: R.name })}</b><small>${t('Puedes repetir cualquier combate y seguir capturando en las rutas.')}</small>`;
    else {
      const where = nextLeader.kind === 'gym' ? (cityAt(nextLeader) ? t(cityAt(nextLeader)[0]) : nextLeader.name) : nextLeader.kind === 'champion' ? t('Campeón de {r}', { r: R.name }) : t('Alto Mando de {r}', { r: R.name });
      goal.innerHTML = `<small>${t('Tu objetivo')}</small><b>${t('Vence a {who}', { who: nextLeader.leader })} <span class="where">· ${where}</span></b><small>${t('Tus Pokémon de {r} suben hasta el Nv.{n}', { r: R.name, n: cap })}</small>`;
      // El líder que toca, en grande a la derecha, y la medalla (o su silueta) que se gana
      goal.classList.add('has-leader');
      goal.style.setProperty('--tc', TYPE_COLOR[nextLeader.type]);
      goal.insertAdjacentHTML('beforeend', `<span class="goal-leader">${trainerImg(nextLeader.id, 'goal-face')}${nextLeader.kind === 'gym' ? `<i class="goal-badge">${badgeImg(region, nextLeader.index, false, 30)}</i>` : ''}</span>`);
    }
    if (fresh.length) {
      const row = el('div', 'goal-routes', `<small>${t('Rutas nuevas')}:</small>`);
      for (const n of fresh) { const c = el('button', 'chip', n.name); c.onclick = () => buttons.get(n.id).click(); row.append(c); }
      goal.append(row);
    }
    map.append(el('div', 'map-legend', [
      `<span><i class="lg you"></i>${t('Estás aquí')}</span>`,
      `<span><i class="lg goal"></i>${t('Siguiente reto')}</span>`,
      `<span><i class="lg new"></i>${t('Ruta nueva')}</span>`,
      `<span><i class="lg route"></i>${t('Ruta abierta · capturados')}</span>`,
      `<span><i class="lg locked">${LOCK_SVG}</i>${t('Bloqueado')}</span>`].join('')));
    const side = el('div', 'story-side');
    side.append(info);
    body.append(map, side);
    const head = el('div', 'story-head');
    head.append(goal, tools);
    wrap.append(head, body);
    this.root.append(wrap);
    const next = map.querySelector('.node.next') || map.querySelector('.node.route:not(.locked)');
    if (next) next.click();
  }

  nodeInfo(box, n, unlocked, done) {
    box.innerHTML = '';
    const p = this.profile;
    const R = Data.REGIONS[n.region];
    if (n.kind !== 'route') {
      const title = n.kind === 'gym' ? n.name : n.kind === 'champion' ? t('Campeón de {r}', { r: R.name }) : t('Alto Mando de {r}', { r: R.name });
      const head = el('div', 'leader-head', `<div><h3>${title}</h3><p class="leader">${n.kind === 'gym' ? t('Líder') : n.kind === 'champion' ? t('Campeón') : t('Miembro')}: <b>${n.leader}</b> · ${t('tipo')} <span class="type" style="--tc:${TYPE_COLOR[n.type]}">${TYPE_LABEL[n.type]}</span></p></div>${trainerImg(n.id, 'leader-sprite')}`);
      head.style.setProperty('--tc', TYPE_COLOR[n.type]);
      box.append(head);
      const used = Data.leaderTeam(n, p.starter || (p.mons[0] && p.mons[0].dex));
      const team = el('div', 'mini-team');
      for (const [dex, lvl] of used) { const c = el('div', 'mini'); c.append(portrait(dex, 56)); c.append(el('small', '', `${SPECIES[dex].name}<br>${lv(lvl)}`)); team.append(c); }
      box.append(team);
      const arena = Data.ARENAS[n.map];
      if (arena) box.append(el('div', 'arena-info', `<b>${t(arena.name)}</b> · ${t(arena.desc)}`));
      if (n.kind === 'elite' || n.kind === 'champion') box.append(el('p', 'small', t('Su equipo está criado a conciencia: IV perfectos y entrenamiento en todas las estadísticas.')));
      box.append(el('p', 'small', t('Dificultad de la IA: {ai} % · Premio {prize} · la primera vez también Caramelo Raro y una vitamina', { ai: Math.round(n.ai * 100), prize: coins(n.reward) + (n.badge ? t(' y {b}', { b: n.badge }) : '') })));
      if (!unlocked) box.append(el('p', 'warn', n.index >= 8 ? t('Consigue las 8 medallas de la región y vence a los anteriores.') : t('Vence antes al anterior.')));
      else {
        const go = el('button', 'primary', done ? t('Revancha') : t('¡Desafiar!'));
        go.onclick = () => this.startStory('gym', n.id);
        box.append(go);
      }
    } else {
      const w = Data.routeWild(n);
      box.append(el('h3', '', n.name), el('p', 'small', t('{r} · Nv.{a}-{b} · encuentros reales del juego', { r: R.name, a: n.lvl[0], b: n.lvl[1] })));
      box.append(this.rotationTimer('short'));
      const list = el('div', 'mini-team');
      const total = w.list.reduce((a, x) => a + x.weight, 0) / (1 - w.rare.chance);
      for (const { dex, weight, min, max } of w.list) {
        const c = el('div', 'mini' + (p.caught.includes(dex) ? ' caught' : ''));
        c.append(portrait(dex, 56));
        c.append(el('small', '', `${SPECIES[dex].name}<br>${Math.max(1, Math.round(weight / total * 100))} % · ${lv(min === max ? min : min + '-' + max)}`));
        c.title = `${SPECIES[dex].name} · ${SPECIES[dex].types.map(t => TYPE_LABEL[t]).join('/')} · Gen ${SPECIES[dex].gen}`;
        list.append(c);
      }
      // El misterioso del día: silueta hasta que lo atrapas
      const known = p.caught.includes(w.rare.dex);
      const rare = el('div', 'mini rare' + (known ? ' caught' : ''));
      rare.append(portrait(w.rare.dex, 56, { silhouette: !known }));
      rare.append(el('small', '', `${known ? SPECIES[w.rare.dex].name : '???'}<br>${+(w.rare.chance * 100).toFixed(1)} % · ${lv(n.lvl[1] + 3)}`));
      rare.title = t('Pokémon misterioso del día: aparece muy de vez en cuando, cuesta mucho atraparlo y 1 de cada 3 tiene IV perfectos');
      list.append(rare);
      box.append(list);
      const balls = Data.BALL_IDS.reduce((n, k) => n + (p.items[k] || 0), 0);
      box.append(el('p', 'small', t('Debilítalo para ganar experiencia, o bájale los PS y lánzale una Poké Ball (<kbd>F</kbd>). Tienes {balls} Balls. Shiny: 1 de {n}.', { balls, n: Math.round(1 / Data.SHINY_RATE) })));
      if (!unlocked) box.append(el('p', 'warn', t('Necesitas {n} medallas de {r}.', { n: n.req, r: R.name })));
      else {
        const go = el('button', 'primary', t('Explorar'));
        go.onclick = () => this.startStory('route', n.id);
        box.append(go);
      }
    }
    // Tu equipo de la región: se gestiona desde aquí (el enlace, cada Pokémon o un hueco libre abren Mis Pokémon en esta región)
    const manage = () => { this.teamRegion = n.region; this.openFrom('team'); };
    const head = el('div', 'team-head', `<h4>${t('Tu equipo')}</h4>`);
    const edit = el('button', 'link', t('Gestionar'));
    edit.title = t('Gestionar equipo');
    edit.onclick = manage;
    head.append(edit);
    box.append(head);
    const team = el('div', 'mini-team');
    const uids = ((p.teams && p.teams[n.region]) || []).filter(uid => p.mons.some(x => x.uid === uid));
    for (const uid of uids) {
      const m = p.mons.find(x => x.uid === uid);
      const c = el('button', 'mini pick');
      c.title = t('Gestionar equipo');
      c.append(this.skinned(portrait(m.dex, 48, { shiny: Data.looksShiny(m) }), m.dex), el('small', '', `${monLabel(m)}${m.shiny ? ' ✦' : ''}<br>${lv(m.level)}`));
      c.onclick = manage;
      team.append(c);
    }
    // Huecos libres (máximo 3): invitan a completar el equipo
    for (let i = uids.length; i < 3; i++) {
      const c = el('button', 'mini pick empty', `<span class="plus">+</span><small>${t('Añadir')}</small>`);
      c.title = t('Añadir al equipo');
      c.onclick = manage;
      team.append(c);
    }
    box.append(team);
  }

  startStory(a, id) {
    this.lastMode = { kind: 'story', a, id };
    this.net.send({ t: 'story', a, id });
  }

  view_starter(region = 'kanto') {
    const R = Data.REGIONS[region];
    const wrap = el('div', 'starter');
    const bar = this.topbar(t('Tu inicial de {r}', { r: R.name }), 'menu');
    wrap.append(bar, this.regionBar(region, rid => { this.region = rid; this.show('story'); }, true));
    wrap.append(el('p', 'intro', t('Cada región es un viaje nuevo: tus Pokémon de otras regiones no vienen contigo. Elige a tu compañero para {r}.', { r: R.name })));
    const row = el('div', 'starter-row');
    for (const dex of Data.REGION_STARTERS[region]) {
      const c = el('button', 'starter-card');
      c.style.setProperty('--tc', TYPE_COLOR[SPECIES[dex].types[0]]);
      c.append(animatedPortrait(dex, 150, 'Idle'));
      c.append(el('b', '', SPECIES[dex].name));
      c.append(el('div', 'types', typeChips(dex)));
      c.append(el('small', '', Data.defaultMoves(dex, 5).map(k => MOVES[k].name).join(' · ')));
      c.onclick = () => this.net.send({ t: 'story', a: 'starter', dex, region });
      row.append(c);
    }
    wrap.append(row);
    this.root.append(wrap);
  }

  // Barra propia de región (debajo de la barra global): elegir región y, en Historia, sus medallas
  // y el siguiente objetivo.
  // Cuenta atrás hasta que cambian los Pokémon de las rutas (medianoche UTC). Al llegar a cero,
  // si estás en el mapa, se vuelve a dibujar con los nuevos.
  rotationTimer(kind) {
    const box = el('div', 'rotation ' + kind);
    const at = Data.nextDay();
    const hour = new Date(at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    const label = kind === 'long' ? t('Pokémon de las rutas nuevos en') : kind === 'instore' ? t('Pokémon nuevos en la tienda en') : t('Estos Pokémon cambian en');
    box.title = t('Cada día a las {h} (tu hora) cambian los 4 Pokémon y el misterioso de cada ruta', { h: hour });
    const tick = () => {
      if (!box.isConnected && box.dataset.started) return;
      box.dataset.started = '1';
      const left = Math.max(0, at - Date.now());
      const hh = Math.floor(left / 3600e3), mm = Math.floor(left / 60e3) % 60, ss = Math.floor(left / 1e3) % 60;
      box.innerHTML = `<span>${label}</span> <b>${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</b>`;
      if (left <= 0) { if (['story', 'shop'].includes(this.view) && !this.root.hidden) this.show(this.view); return; }
      setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return box;
  }

  // Cómo se juega al modo historia (se abre sola la primera vez)
  storyGuide() {
    const hour = new Date(Data.nextDay()).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box story-guide');
    const close = () => back.remove();
    back.onclick = e => { if (e.target === back) close(); };
    const sec = (title, items) => `<section><h4>${title}</h4><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></section>`;
    box.append(el('h3', '', t('Cómo se juega al modo historia')));
    box.append(el('div', 'guide-body scroll', [
      sec(t('El viaje'), [
        t('Cada región (Kanto y Johto) es un viaje propio: eliges un inicial y tus Pokémon <b>no viajan</b> a otras regiones.'),
        t('Llevas un equipo de <b>hasta 3 Pokémon</b> de esa región. Elígelos y ordénalos en <b>Mis Pokémon</b>.'),
      ]),
      sec(t('El mapa'), [
        t('Los círculos con número son los <b>líderes</b>, en orden: 8 gimnasios, el Alto Mando (★) y el Campeón (♛). Vence a cada uno para poder retar al siguiente.'),
        t('Cada <b>medalla</b> abre nuevas rutas. Los candados indican lo que aún no puedes visitar.'),
      ]),
      sec(t('Rutas y Pokémon salvajes'), [
        t('En las rutas luchas contra Pokémon salvajes. Cada día salen <b>4 especies</b> de las que viven en esa ruta en los juegos, más un <b>Pokémon misterioso</b> muy raro.'),
        t('Cambian cada día a las <b>{h}</b> (tu hora). El contador de arriba indica cuánto falta.', { h: hour }),
        t('Ganar da dinero y experiencia.'),
      ]),
      sec(t('Capturar'), [
        t('Lanza una Poké Ball con <kbd>F</kbd> y cambia de Ball con <kbd>R</kbd>. La Ball tiene que darle.'),
        t('Es más fácil cuanta <b>menos vida</b> le quede y si tiene un <b>estado</b> (quemado, envenenado, aturdido…). La Súper Ball y la Ultra Ball ayudan mucho.'),
        t('Si se escapa, puedes volver a intentarlo. Uno de cada 300 es <b>shiny</b> (el misterioso, el triple).'),
        t('El Pokémon misterioso tiene <b>IV perfectos</b> 1 de cada 3 veces.'),
      ]),
      sec(t('Subir de nivel'), [
        t('Los Pokémon que combaten ganan experiencia (la mitad si se debilitan).'),
        t('Hay un <b>tope de nivel</b>: la media del equipo del siguiente líder. Sube cada vez que ganas una medalla.'),
        t('Aprenden movimientos al subir de nivel: elige sus 4 movimientos en <b>Mis Pokémon</b>. Evolucionan por nivel o con piedras de la tienda.'),
      ]),
      sec(t('Líderes, Alto Mando y Campeón'), [
        t('Cada líder pelea en una <b>arena de su tipo</b> con su propia mecánica: lee su ficha en el mapa antes de entrar.'),
        t('Sacan sus 3 mejores Pokémon. La primera victoria da dinero, la medalla, un Caramelo Raro y una vitamina; la revancha, la mitad del dinero.'),
        t('El Alto Mando y el Campeón tienen salas más duras y Pokémon con IV perfectos y entrenados.'),
      ]),
      sec(t('Si pierdes'), [
        t('No pierdes nada: tus Pokémon se recuperan y puedes volver a intentarlo cuando quieras.'),
      ]),
      sec(t('Mejorar tu equipo'), [
        t('En la <b>tienda</b>: Balls, Caramelos Raros (suben un nivel hasta el tope), vitaminas (EV) y piedras evolutivas.'),
        t('También vende <b>4 Pokémon al día</b> con IV perfectos, caros y de uno en uno; cambian a la vez que las rutas.'),
        t('Usa los objetos desde la <b>Mochila</b>: eliges el objeto y luego el Pokémon.'),
        t('En la ficha de cada Pokémon ves su naturaleza, IV y EV, y puedes venderlo.'),
        t('La <b>Pokédex</b> muestra todas las especies, las que te faltan y en qué rutas aparecen.'),
      ]),
    ].join('')));
    const acts = el('div', 'acts');
    const ok = el('button', 'primary', t('¡A jugar!'));
    ok.onclick = close;
    acts.append(ok);
    box.append(acts);
    back.append(box);
    document.body.append(back);
  }

  regionBar(current, onPick, withBadges) {
    const p = this.profile;
    const bar = el('div', 'subbar');
    const tabs = el('div', 'region-tabs');
    for (const rid of Data.REGION_IDS) {
      const done = Math.min(8, Data.progOf(p, rid));
      const champ = Data.progOf(p, rid) >= Data.leadersOf(rid).length;
      const tab = el('button', 'rg' + (rid === current ? ' sel' : '') + (champ ? ' champ' : ''), `<b>${Data.REGIONS[rid].name}</b><small>${champ ? t('♛ Campeón') : t('{n}/8 medallas', { n: done })}</small>
        <span class="rg-pips">${Array.from({ length: 8 }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</span>`);
      tab.style.setProperty('--rc', REGION_COLOR[rid] || '#6f7dff');
      tab.onclick = () => onPick(rid);
      tabs.append(tab);
    }
    // Las que llegarán: juntas y pequeñas al final
    const soon = el('div', 'rg-soon', `<small>${t('Próximamente')}</small>`);
    tabs.append(soon);
    for (const name of UPCOMING_REGIONS) {
      const rname = t(name);
      const tab = el('button', 'soon', `${LOCK_SVG}<b>${rname}</b>`);
      tab.setAttribute('aria-disabled', 'true');
      tab.title = t('{r} llegará en una próxima actualización', { r: rname });
      tab.onclick = () => this.toast(t('{r} todavía no está disponible: ¡llegará pronto!', { r: rname }));
      soon.append(tab);
    }
    bar.append(tabs);
    if (withBadges) {
      const prog = Data.progOf(p, current);
      const leaders = Data.leadersOf(current);
      bar.append(el('div', 'badges', leaders.slice(0, 8).map((g, i) => `<span class="badge-slot${i < prog ? ' got' : ''}" title="${g.badge} · ${g.leader}">${badgeImg(current, i, i < prog, 26)}</span><i hidden class="badge${i < prog ? ' got' : ''}" style="--tc:${TYPE_COLOR[g.type]}" title="${g.badge} · ${g.leader}"></i>`).join('')));
      const next = leaders[prog];
      bar.append(el('div', 'next-goal', next ? `${t('Siguiente: <b>{who}</b>', { who: next.leader })} · ${next.kind === 'gym' ? next.name : next.kind === 'champion' ? t('Campeón') : t('Alto Mando')} <span class="cap">${t('tope Nv.{n}', { n: Data.levelCap(p, current) })}</span>` : t('♛ ¡Región completada!')));
    }
    return bar;
  }

  // ---------- Equipo ----------
  view_team() {
    const p = this.profile;
    const wrap = el('div', 'teamview');
    const region = this.teamRegion = this.teamRegion || this.region || 'kanto';
    const bar = this.topbar(t('Mis Pokémon'), this.returnTo || 'menu');
    wrap.append(bar, this.regionBar(region, rid => { this.teamRegion = rid; this.show('team'); }, false));
    const cap = Data.levelCap(p, region);
    const next = Data.leadersOf(region)[Data.progOf(p, region)];
    const team = (p.teams && p.teams[region]) || [];
    const mine = p.mons.filter(m => (m.region || 'kanto') === region);
    wrap.append(el('p', 'intro', `${t('Pokémon de {r}: solo combaten en su región. Mete o saca del equipo (máximo 3) y gestiona su ficha.', { r: Data.REGIONS[region].name })} <span class="cap">${t('Tope de nivel en {r}: <b>{n}</b>', { r: Data.REGIONS[region].name, n: cap })}${next && cap < 100 ? ` · ${t('vence a {who} para subir más', { who: next.leader })}` : ''}</span>`));
    if (!mine.length) wrap.append(el('p', 'warn', t('Aún no tienes Pokémon en {r}: elige tu inicial en Historia.', { r: Data.REGIONS[region].name })));
    // Buscador y filtros de la caja (se recuerdan al volver). Filtran al momento ocultando tarjetas, sin
    // volver a pintar la pantalla (así no se pierde lo que se escribe); el orden sí la vuelve a pintar.
    const f = this.monFilter = this.monFilter || { q: '', type: '', shiny: 'all', leg: 'all', sort: 'level' };
    const filters = el('div', 'dex-filters mon-filters');
    const search = el('input');
    search.type = 'search'; search.placeholder = t('Buscar por nombre o número'); search.value = f.q;
    search.oninput = () => { f.q = search.value; apply(); };
    const type = typeDropdown(Object.keys(TYPE_LABEL), f.type, v => { f.type = v; apply(); });
    const seg = (key, opts) => {
      const s = el('div', 'seg');
      for (const [k, label] of opts) {
        const b = el('button', f[key] === k ? 'sel' : '', label);
        b.onclick = () => { f[key] = k; s.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); apply(); };
        s.append(b);
      }
      return s;
    };
    const SORT_ICON = '<svg class="dd-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3v10M1.8 10.8 4 13l2.2-2.2M9 4h6M9 8h4.5M9 12h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sort = dropdown({ cls: 'dd-sort', value: f.sort, label: t('Orden'), onChange: v => { f.sort = v; this.show('team', true); },
      options: [['level', t('Orden: nivel')], ['dex', t('Orden: nº de Pokédex')], ['name', t('Orden: nombre')], ['new', t('Orden: más recientes')]].map(([value, label]) => ({ value, label, icon: SORT_ICON })) });
    filters.append(search, type, seg('shiny', [['all', t('Todos')], ['shiny', '✦ ' + t('Shiny')], ['plain', t('Sin shiny')]]),
      seg('leg', [['all', t('Todos')], ['leg', t('Legendarios')], ['noleg', t('Sin legendarios')]]), sort);
    if (mine.length > 1) wrap.append(filters);
    // Dos secciones: el equipo (máximo 3) y la caja con el resto
    const scroll = el('div', 'team-sections scroll');
    const inTeamList = team.map(u => mine.find(m => m.uid === u)).filter(Boolean);
    const nameOf = m => m.nick || SPECIES[m.dex].name;
    const SORTS = { level: (a, b) => b.level - a.level || a.dex - b.dex, dex: (a, b) => a.dex - b.dex || b.level - a.level,
      name: (a, b) => nameOf(a).localeCompare(nameOf(b), locale()) || b.level - a.level, new: (a, b) => b.uid - a.uid };
    const boxList = mine.filter(m => !team.includes(m.uid)).sort(SORTS[f.sort] || SORTS.level);
    const grids = {};
    let boxTitle = null;
    for (const [key, title, list] of [['team', t('Equipo ({n}/3)', { n: inTeamList.length }), inTeamList], ['box', t('Caja ({n})', { n: boxList.length }), boxList]]) {
      if (!list.length) continue;
      const h = el('h3', 'sec-title', title);
      if (key === 'box') boxTitle = h;
      scroll.append(h);
      scroll.append(grids[key] = el('div', 'mon-grid'));
    }
    for (const m of [...inTeamList, ...boxList]) {
      const grid = grids[team.includes(m.uid) ? 'team' : 'box'];
      const inTeam = team.includes(m.uid);
      const card = typeTint(el('div', 'mon-card' + (inTeam ? ' in' : '') + (m.shiny ? ' is-shiny' : '')), m.dex);
      Object.assign(card.dataset, { q: norm(`${nameOf(m)} ${SPECIES[m.dex].name} ${m.dex}`), types: SPECIES[m.dex].types.join(' '), shiny: m.shiny ? '1' : '', leg: SPECIES[m.dex].leg ? '1' : '', box: inTeam ? '' : '1' });
      // Los de la caja duermen (animación Sleep de SpriteCollab, si la especie la tiene)
      card.append(this.skinned(inTeam || !hasAnim(m.dex, 'Sleep') ? portrait(m.dex, 72, { shiny: Data.looksShiny(m) }) : animatedPortrait(m.dex, 72, 'Sleep', Data.looksShiny(m)), m.dex));
      const need = xpToNext(m.level);
      const moves = (m.moves && m.moves.length ? m.moves : SPECIES[m.dex].moves).filter(k => MOVES[k]);
      const known = Data.learnedAt(m.dex, m.level).filter(k => !moves.includes(k));
      const upcoming = Data.learnset(m.dex).find(([l]) => l > m.level);
      card.append(el('div', 'mi', `<b class="mon-name">${monLabel(m)}${m.shiny ? ` <i class="shiny-star">${t('✦ shiny')}</i>` : ''}</b>${m.nick ? ` <small class="species">${SPECIES[m.dex].name}</small>` : ''} <small>${lv(m.level)}${m.level >= cap ? ` · <span class="cap">${t('tope')}</span>` : ''}</small><div class="types">${typeChips(m.dex)}</div><div class="xp"><div style="width:${m.level >= cap ? 100 : Math.min(100, m.xp / need * 100)}%"></div></div>
        <div class="movechips">${moves.map(k => `<span class="mchip" style="--tc:${TYPE_COLOR[MOVES[k].type]}">${typeIcon(MOVES[k].type, 16)}${MOVES[k].name}</span>`).join('')}</div>
        ${known.length ? `<small class="newmoves">${known.length > 1 ? t('{n} movimientos más para elegir', { n: known.length }) : t('1 movimiento más para elegir')}</small>` : ''}
        ${upcoming ? `<small class="moves">${t('Aprende {m} al Nv.{n}', { m: MOVES[upcoming[1]].name, n: upcoming[0] })}</small>` : ''}
        ${masteryHtml(p, m.dex, t)}`));
      const acts = el('div', 'acts');
      const toggle = el('button', inTeam ? 'on' : '', inTeam ? t('En el equipo') : t('Al equipo'));
      toggle.onclick = () => {
        let next = team.filter(u => u !== m.uid);
        if (!inTeam) { if (team.length >= 3) return this.toast(t('El equipo ya tiene 3 Pokémon: saca uno antes'), 'bad'); next = [...team, m.uid]; }
        if (!next.length) return this.toast(t('El equipo necesita al menos un Pokémon'), 'bad');
        this.net.send({ t: 'story', a: 'team', uids: next, region });
      };
      acts.append(toggle);
      // Tocar la tarjeta (fuera de sus botones) abre la ficha completa; en la tarjeta quedan solo equipo,
      // Caramelo Raro y vender (lo demás está en la ficha)
      const openSheet = tab => this.monSheet(m.uid, tab, [...this.root.querySelectorAll('.mon-card:not([hidden])')].map(c => +c.dataset.uid));
      card.dataset.uid = m.uid;
      card.onclick = e => { if (!e.target.closest('button')) openSheet(); };
      if ((p.items.caramelo || 0) > 0) {
        const b = el('button', 'with-ico', `${itemImg('caramelo', 24)}${SHOP.find(i => i.id === 'caramelo').name} (${p.items.caramelo})`);
        b.disabled = m.level >= cap;
        b.onclick = () => this.net.send({ t: 'story', a: 'use', item: 'caramelo', uid: m.uid });
        acts.append(b);
      }
      const evo = SPECIES[m.dex].evo;
      if (evo && typeof evo[1] === 'number') acts.append(el('small', 'evohint', t('Evoluciona a {m} al Nv.{n}', { m: SPECIES[evo[0]].name, n: evo[1] })));
      if (mine.length > 1) {
        const price = Data.sellPrice(m);
        const sell = el('button', 'danger sell-btn', t('Vender por {price}', { price: coins(price) }));
        sell.onclick = () => { confirmBox({ title: t('Vender'), text: t('¿Vender a {m} ({lv}) por {price} ₽? No se puede deshacer.', { m: nameOf(m), lv: lv(m.level), price }), ok: t('Vender'), danger: true }).then(yes => { if (yes) { this.net.send({ t: 'story', a: 'sell', uid: m.uid }); } }); };
        acts.append(sell);
      }
      card.append(acts);
      grid.append(card);
    }
    const empty = el('p', 'small mon-empty', t('Ningún Pokémon con estos filtros.'));
    scroll.append(empty);
    // Solo se filtra la caja: el equipo (3 como mucho) se ve siempre
    const apply = () => {
      const q = norm(f.q.trim()).replace(/^#/, '');
      let shown = 0, total = 0;
      for (const card of scroll.querySelectorAll('.mon-card')) {
        const d = card.dataset;
        if (!d.box) continue;
        const ok = (!q || d.q.includes(q)) && (!f.type || d.types.split(' ').includes(f.type))
          && (f.shiny === 'all' || (f.shiny === 'shiny') === !!d.shiny) && (f.leg === 'all' || (f.leg === 'leg') === !!d.leg);
        card.hidden = !ok;
        total++;
        if (ok) shown++;
      }
      if (boxTitle) boxTitle.textContent = shown === total ? t('Caja ({n})', { n: total }) : t('Caja ({n} de {total})', { n: shown, total });
      empty.hidden = shown > 0 || !total;
    };
    apply();
    wrap.append(scroll);
    this.root.append(wrap);
  }

  // Mote al capturarlo, en la pantalla de resultados: opcional, se puede cambiar luego en Mis Pokémon
  nickForm(uid, dex) {
    const f = el('form', 'nick-form');
    const input = el('input');
    Object.assign(input, { maxLength: Data.NICK_MAX, placeholder: SPECIES[dex].name, autocomplete: 'off', spellcheck: false });
    input.setAttribute('aria-label', t('Mote'));
    const save = el('button', '', t('Guardar mote'));
    save.type = 'submit';
    const note = el('small', 'nick-note', t('Opcional: puedes cambiarlo cuando quieras en Mis Pokémon'));
    f.append(el('label', '', t('¿Le pones un mote?')), input, save, note);
    input.oninput = () => { save.textContent = t('Guardar mote'); save.classList.remove('saved'); };
    f.onsubmit = e => {
      e.preventDefault();
      const nick = input.value.trim();
      // Se marca como guardado cuando el servidor lo confirma (si no lo acepta, avisa con un error)
      this.onProfile = p => {
        const m = p.mons.find(x => x.uid === uid);
        if (!m || (m.nick || '') !== (nick === SPECIES[m.dex].name ? '' : nick.slice(0, Data.NICK_MAX).trim())) return;
        this.onProfile = null;
        save.textContent = nick ? t('Mote guardado ✓') : t('Sin mote ✓');
        save.classList.add('saved');
      };
      this.net.send({ t: 'story', a: 'nick', uid, nick });
    };
    return f;
  }

  // Cambiar o quitar el mote de un Pokémon desde Mis Pokémon
  nickModal(mon) {
    const back = el('div', 'modal');
    const box = el('form', 'panel modal-box nick-modal');
    const input = el('input');
    Object.assign(input, { maxLength: Data.NICK_MAX, value: mon.nick || '', placeholder: SPECIES[mon.dex].name, autocomplete: 'off', spellcheck: false });
    input.setAttribute('aria-label', t('Mote'));
    box.append(el('h3', '', t('Mote de {m}', { m: SPECIES[mon.dex].name })),
      el('p', 'small', t('Hasta {n} caracteres. Se ve en combate, en tu equipo y en tu perfil público. Vacío, vuelve a llamarse como su especie.', { n: Data.NICK_MAX })), input);
    const acts = el('div', 'acts');
    const save = el('button', 'primary', t('Guardar'));
    save.type = 'submit';
    const cancel = el('button', '', t('Cancelar'));
    cancel.type = 'button';
    cancel.onclick = () => back.remove();
    acts.append(save);
    if (mon.nick) {
      const clear = el('button', '', t('Quitar mote'));
      clear.type = 'button';
      clear.onclick = () => { this.net.send({ t: 'story', a: 'nick', uid: mon.uid, nick: '' }); back.remove(); };
      acts.append(clear);
    }
    acts.append(cancel);
    box.append(acts);
    box.onsubmit = e => { e.preventDefault(); this.net.send({ t: 'story', a: 'nick', uid: mon.uid, nick: input.value }); back.remove(); };
    back.append(box);
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.append(back);
    input.focus();
    input.select();
  }

  // Ficha de un Pokémon: estadísticas (con vitaminas), stats base reales, movimientos, evolución y venta
  statsModal(mon) {
    const p = this.profile;
    const sp = SPECIES[mon.dex];
    const ev = mon.ev || { hp: 0, atk: 0, def: 0, spe: 0 }, iv = mon.iv || { hp: 0, atk: 0, def: 0, spe: 0 };
    const st = Shared.monStats(mon.dex, mon.level, mon);
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box ficha');
    const head = el('div', 'ficha-head');
    head.append(this.skinned(animatedPortrait(mon.dex, 120, 'Idle', !!mon.shiny), mon.dex));
    const route = mon.met ? Data.NODES[mon.met] || null : null;
    const nat = Data.NATURES[mon.nat] || ['—', null, null];
    const natTxt = nat[1] ? `<b>${nat[0]}</b> (+${Data.STAT6[nat[1]]}, −${Data.STAT6[nat[2]]})` : `<b>${nat[0]}</b> (${t('neutra')})`;
    head.append(el('div', '', `<h3>${monLabel(mon)}${mon.shiny ? ` <i class="shiny-star">${t('✦ shiny')}</i>` : ''} <small>${mon.nick ? sp.name + ' · ' : ''}${lv(mon.level)}</small></h3><div class="types">${typeChips(mon.dex)}</div>
      <p class="small">Nº ${mon.dex} · Gen ${sp.gen}${sp.leg ? ` · <b>${t('legendario')}</b>` : ''} · Hitbox ${Shared.hitboxOf(mon.dex)} px${route ? ` · ${t('Capturado en {r}', { r: route.name })}` : ''}</p>
      <p class="small">${t('Naturaleza')}: ${natTxt}</p>`));
    box.append(head);
    // Estadísticas de combate: valor actual, barra, IV, EV y vitaminas
    const rows = el('div', 'stat-rows');
    const total = Data.evTotal(ev);
    rows.append(el('div', 'small vit-total', t('EV: <b>{n}/{total}</b> en total (máx. {max} por stat; solo con vitaminas: +{vit} cada una) · IV fijos de nacimiento (0-{iv})', { n: total, total: Data.EV_TOTAL, max: Data.EV_MAX, vit: Data.EV_VIT, iv: Data.IV_MAX })));
    const bars = [
      ['hp', t('PS'), st.maxHp, 400, `${st.maxHp}`],
      ['atk', t('Ataque'), st.atk, 2, `×${st.atk.toFixed(2)}`],
      ['def', t('Defensa'), st.def, 1.7, `×${st.def.toFixed(2)}`],
      ['spe', t('Velocidad'), sp.spd * st.spdMult, 340, `${Math.round(sp.spd * st.spdMult)} px/s`],
    ];
    const vitItems = SHOP.filter(i => i.vit);
    for (const [key, label, val, max, text] of bars) {
      const row = el('div', 'stat-row');
      const item = vitItems.find(i => i.vit === key);
      const have = p.items[item.id] || 0;
      const ivq = t(iv[key] >= 31 ? 'perfecto' : iv[key] >= 26 ? 'muy bueno' : iv[key] >= 16 ? 'bueno' : iv[key] >= 8 ? 'normal' : 'flojo');
      row.innerHTML = `<span class="sl">${label}</span><div class="sbar"><div style="width:${Math.min(100, val / max * 100)}%"></div></div><b>${text}</b>
        <span class="vdots" title="IV ${iv[key]}/31 (${ivq}) · EV ${ev[key]}/${Data.EV_MAX}">IV <b class="${iv[key] >= 31 ? 'iv-top' : ''}">${iv[key]}</b> · EV <b>${ev[key]}</b></span>`;
      const canUse = have && ev[key] < Data.EV_MAX && total < Data.EV_TOTAL;
      const use = el('button', canUse ? 'evo' : 'dim', `${item.name}${have ? ` (${have})` : ''}`);
      use.disabled = !canUse;
      use.title = have ? t('+{n} EV de {stat}', { n: Data.EV_VIT, stat: label }) : t('Cómpralo en la tienda: {item}', { item: item.name });
      use.onclick = () => { this.net.send({ t: 'story', a: 'use', item: item.id, uid: mon.uid }); back.remove(); this.pendingFicha = mon.uid; };
      row.append(use);
      rows.append(row);
    }
    box.append(rows);
    // Stats base reales de la especie
    const base = sp.base || [0, 0, 0, 0, 0, 0];
    const names = ['PS', 'Atq', 'Def', 'At.Esp', 'Df.Esp', 'Vel'].map(x => t(x));
    box.append(el('div', 'base-stats', `<small>${t('Stats base de la especie (total {n})', { n: sp.bst })}</small><div class="bs">${base.map((v, i) => `<div><i style="height:${Math.min(100, v / 1.6)}%"></i><b>${v}</b><span>${names[i]}</span></div>`).join('')}</div>`));
    const moves = (mon.moves && mon.moves.length ? mon.moves : sp.moves).filter(k => MOVES[k]);
    box.append(el('div', 'movechips', moves.map(k => `<span class="mchip" style="--tc:${TYPE_COLOR[MOVES[k].type]}">${typeIcon(MOVES[k].type, 16)}${MOVES[k].name}</span>`).join('')));
    const evo = sp.evo;
    if (evo) {
      const list = Array.isArray(evo[0]) ? evo : [evo];
      box.append(el('p', 'small', t('Evoluciona a {list}', { list: list.map(([to, c]) => `${SPECIES[to].name} (${typeof c === 'number' ? lv(c) : (SHOP.find(i => i.id === c) || { name: c }).name})`).join(', ') })));
    }
    const acts = el('div', 'acts');
    const price = Data.sellPrice(mon);
    const sell = el('button', 'danger', t('Vender por {price}', { price: coins(price) }));
    sell.disabled = p.mons.filter(x => (x.region || 'kanto') === (mon.region || 'kanto')).length <= 1;
    sell.onclick = () => confirmBox({ title: t('Vender'), text: t('¿Vender a {m} ({lv}) por {price} ₽? No se puede deshacer.', { m: (mon.nick || sp.name) + (mon.shiny ? ' shiny' : ''), lv: lv(mon.level), price }), ok: t('Vender'), danger: true })
      .then(yes => { if (yes) { this.net.send({ t: 'story', a: 'sell', uid: mon.uid }); back.remove(); } });
    const close = el('button', 'primary', t('Cerrar'));
    close.onclick = () => back.remove();
    acts.append(sell, close);
    box.append(acts);
    back.append(box);
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.append(back);
  }

  // Gestor de movimientos: elegir hasta 4 de los aprendidos
  moveManager(mon) {
    const current = (mon.moves && mon.moves.length ? mon.moves : SPECIES[mon.dex].moves).filter(k => MOVES[k]);
    const levels = new Map(Data.learnset(mon.dex).map(([l, k]) => [k, l]));
    const options = [...new Set([...Data.learnedAt(mon.dex, mon.level), ...current])];
    const chosen = [...current];
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box');
    box.append(el('h3', '', `${t('Movimientos de {m}', { m: monLabel(mon) })} <small>${lv(mon.level)}</small>`), el('p', 'small', t('Elige hasta 4. El orden es el de las teclas: Clic, Clic dcho, Q y E.')));
    const list = el('div', 'move-list');
    const render = () => {
      list.innerHTML = '';
      for (const k of options) {
        const m = MOVES[k];
        const i = chosen.indexOf(k);
        const row = el('button', 'move-row' + (i >= 0 ? ' sel' : ''));
        row.style.setProperty('--tc', TYPE_COLOR[m.type]);
        row.innerHTML = `<span class="slot">${typeIcon(m.type, 28)}<i>${i >= 0 ? t(['Clic', 'Dcho', 'Q', 'E'][i]) : ''}</i></span><b>${m.name}</b><span class="type" style="--tc:${TYPE_COLOR[m.type]}">${TYPE_LABEL[m.type]}</span><em>${levels.has(k) ? lv(levels.get(k)) : t('aprendido')}</em><small>${describeMove(m).split('\n').join(' · ')}</small>`;
        row.onclick = () => {
          if (i >= 0) { if (chosen.length > 1) chosen.splice(i, 1); }
          else if (chosen.length < 4) chosen.push(k);
          else this.toast(t('Ya lleva 4: quita uno antes'), 'bad');
          render();
        };
        list.append(row);
      }
      const upcoming = Data.learnset(mon.dex).filter(([l]) => l > mon.level);
      if (upcoming.length) list.append(el('p', 'small', t('Próximamente: {list}', { list: upcoming.map(([l, k]) => `${MOVES[k].name} (${lv(l)})`).join(' · ') })));
    };
    render();
    const acts = el('div', 'acts');
    const cancel = el('button', '', t('Cancelar'));
    const save = el('button', 'primary', t('Guardar'));
    cancel.onclick = () => back.remove();
    save.onclick = () => { this.net.send({ t: 'story', a: 'moves', uid: mon.uid, moves: chosen }); back.remove(); };
    acts.append(cancel, save);
    box.append(list, acts);
    back.append(box);
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.append(back);
  }

  // ---------- Tienda ----------
  view_shop() {
    const p = this.profile;
    storage.set('arena.shopSeen', Data.dayKey());
    const wrap = el('div', 'shop');
    wrap.append(this.topbar(t('Tienda'), this.returnTo || 'menu'));
    // Por categorías, con accesos rápidos arriba
    const cats = [
      ['balls', t('Poké Balls'), i => Data.BALL_IDS.includes(i.id)],
      ['items', t('Objetos'), i => !i.dex && !i.vit && !i.stone && !Data.BALL_IDS.includes(i.id)],
      ['vit', t('Vitaminas'), i => i.vit],
      ['stones', t('Piedras evolutivas'), i => i.stone],
      ['mons', t('Pokémon del día'), i => i.dex],
    ];
    const bought = p.shopBought && p.shopBought.day === Data.dayKey() ? p.shopBought.ids : [];
    const jump = el('div', 'subbar shop-tabs');
    const scroll = el('div', 'shop-sections scroll');
    for (const [id, title, test] of cats) {
      const items = id === 'mons' ? Data.shopMons() : SHOP.filter(test);
      if (!items.length) continue;
      const b = el('button', '', `${title} <small>${items.length}</small>`);
      b.onclick = () => scroll.querySelector(`#shop-${id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      jump.append(b);
      scroll.append(el('h3', 'sec-title', title));
      scroll.lastChild.id = 'shop-' + id;
      if (id === 'mons') {
        scroll.append(el('p', 'small', t('Con IV perfectos y al tope de nivel de tu región. Cada uno se puede comprar una vez; cambian cada día.')));
        scroll.append(this.rotationTimer('instore'));
      }
      const grid = el('div', 'shop-grid');
      for (const item of items) {
        const locked = (item.req || 0) > p.badges;
        const c = el('div', 'shop-item' + (locked ? ' locked' : '') + (item.dex ? ' has-mon' : ''));
        if (item.dex) typeTint(c, item.dex);
        const pic = item.dex ? portrait(item.dex, 64) : el('span', 'item-pic', itemImg(item.id, 48));
        c.append(pic);
        const desc = item.daily ? t('IV perfectos · Nv.{n}', { n: Data.levelCap(p, this.region || 'kanto') }) : item.desc;
        c.append(el('div', 'si', `<b>${item.name}</b><small>${desc}</small><span class="price">${coins(item.price)}</span>${item.dex ? '' : `<small>${t('Tienes: {n}', { n: p.items[item.id] || 0 })}</small>`}`));
        const acts = el('div', 'acts');
        if (locked) acts.append(el('small', 'warn', t('Requiere {n} medallas', { n: item.req })));
        else if (bought.includes(item.id)) acts.append(el('small', 'ok', t('Comprado hoy')));
        else for (const qty of item.dex ? [1] : item.cap ? [1, 5, 10] : [1]) {
          const b = el('button', 'buy', qty === 1 ? t('Comprar') : `×${qty}`);
          b.disabled = p.coins < item.price * qty;
          b.onclick = () => this.net.send({ t: 'story', a: 'buy', id: item.id, qty, region: this.region || 'kanto' });
          acts.append(b);
        }
        c.append(acts);
        grid.append(c);
      }
      scroll.append(grid);
    }
    wrap.append(jump, scroll);
    this.root.append(wrap);
  }

  // ---------- Online ----------
  view_online() {
    const p = this.profile;
    const wrap = el('div', 'online');
    wrap.append(this.topbar(t('Clasificatoria'), 'menu'));
    const body = el('div', 'online-body');
    const me = el('div', 'panel');
    const next = LEAGUES.find(l => l[0] > p.elo);
    me.innerHTML = `<h3>${escapeHtml(p.name)}</h3><div class="league">${t(p.league)}</div><div class="big-elo">${p.elo}</div>
      <p class="small">${t('{w} victorias · {l} derrotas', { w: p.wins, l: p.losses })}${next ? ` · ${t('{n} puntos para {league}', { n: next[0] - p.elo, league: t(next[1]) })}` : ''}</p>
      <p class="small">${t('Draft: cada jugador veta 1 Pokémon y elige 3. Todos a nivel {n}.', { n: Data.RANKED_LEVEL })}</p>`;
    const go = el('button', 'primary', t('Buscar partida clasificatoria'));
    go.onclick = () => { this.lastMode = 'ranked'; this.net.send({ t: 'queue', mode: 'ranked' }); };
    me.append(go);
    const col = el('div', 'online-col');
    col.append(me, this.boardPanel());
    body.append(col, this.seasonPanel());
    wrap.append(body);
    this.root.append(wrap);
  }

  view_queue() {
    const box = el('div', 'panel center-panel');
    const mode = this.queueMode === 'ranked' ? t('Buscando rival para clasificatoria…') : t('Buscando rival para partida rápida…');
    box.innerHTML = `<div class="spinner"></div><h3>${mode}</h3><p class="small qtime">0:00</p><p class="small">${t('Para probar solo, abre otra pestaña y busca partida también.')}</p>`;
    const cancel = el('button', '', t('Cancelar'));
    cancel.onclick = () => this.net.send({ t: 'unqueue' });
    box.append(cancel);
    this.root.append(box);
    const t0 = Date.now();
    const tick = () => {
      if (this.view !== 'queue') return;
      const s = Math.floor((Date.now() - t0) / 1000);
      box.querySelector('.qtime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setTimeout(tick, 500);
    };
    tick();
  }

  // ---------- Draft ----------
  draft(msg) {
    this.view = 'draft';
    this.root.hidden = false;
    this.root.innerHTML = '';
    const wrap = el('div', 'draft');
    const ban = msg.phase === 'ban';
    wrap.append(el('div', 'draft-head', `<h2>${ban ? t('Fase de veto') : t('Elige tu equipo')}</h2><p>${t('contra <b>{foe}</b>', { foe: escapeHtml(msg.foe) })}${msg.foeElo ? ` (${msg.foeElo})` : ''} · ${ban ? t('Veta 1 Pokémon: nadie podrá usarlo') : t('Elige 3 Pokémon')}</p><div class="dtimer"></div>`));
    const grid = el('div', 'pool scroll');
    const chosen = [];
    const confirm = el('button', 'primary', ban ? t('Vetar') : t('Confirmar equipo'));
    confirm.disabled = true;
    for (const dex of msg.pool) {
      const banned = msg.bans.includes(dex);
      const c = typeTint(el('button', 'pool-card' + (banned ? ' banned' : '')), dex);
      c.append(this.skinned(portrait(dex, 64), dex));
      c.append(el('b', '', SPECIES[dex].name), el('div', 'types', typeChips(dex)));
      c.title = SPECIES[dex].moves.map(k => `${MOVES[k].name}: ${describeMove(MOVES[k]).split('\n').join(' · ')}`).join('\n');
      c.disabled = banned;
      c.onclick = () => {
        const i = chosen.indexOf(dex);
        if (i >= 0) chosen.splice(i, 1);
        else { if (chosen.length >= (ban ? 1 : 3)) chosen.shift(); chosen.push(dex); }
        grid.querySelectorAll('.pool-card').forEach(x => x.classList.toggle('sel', chosen.includes(+x.dataset.dex)));
        confirm.disabled = chosen.length !== (ban ? 1 : 3);
      };
      c.dataset.dex = dex;
      grid.append(c);
    }
    confirm.onclick = () => {
      this.net.send(ban ? { t: 'ban', dex: chosen[0] } : { t: 'pick', dexes: chosen });
      confirm.disabled = true;
      confirm.textContent = t('Esperando al rival…');
      grid.querySelectorAll('.pool-card').forEach(x => { x.disabled = true; });
    };
    wrap.append(grid, confirm);
    this.root.append(wrap);
    const end = Date.now() + msg.time * 1000;
    const tick = () => {
      if (this.view !== 'draft' || !wrap.isConnected) return;
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      wrap.querySelector('.dtimer').textContent = s + ' s';
      setTimeout(tick, 250);
    };
    tick();
  }

  // ---------- Práctica ----------
  view_practice() {
    const wrap = el('div', 'draft');
    wrap.append(this.topbar(t('Práctica contra la IA'), 'menu'));
    const chosen = [];
    let skill = 0.28;
    const grid = el('div', 'pool scroll');
    const start = el('button', 'primary', t('Empezar'));
    start.disabled = true;
    for (const dex of RANKED_POOL) {
      const c = typeTint(el('button', 'pool-card'), dex);
      c.append(this.skinned(portrait(dex, 64), dex));
      c.append(el('b', '', SPECIES[dex].name), el('div', 'types', typeChips(dex)));
      c.title = SPECIES[dex].moves.map(k => MOVES[k].name).join(' · ');
      c.dataset.dex = dex;
      c.onclick = () => {
        const i = chosen.indexOf(dex);
        if (i >= 0) chosen.splice(i, 1); else { if (chosen.length >= 3) chosen.shift(); chosen.push(dex); }
        grid.querySelectorAll('.pool-card').forEach(x => x.classList.toggle('sel', chosen.includes(+x.dataset.dex)));
        start.disabled = !chosen.length;
        start.textContent = chosen.length ? t('Empezar ({n} Pokémon)', { n: chosen.length }) : t('Empezar');
      };
      grid.append(c);
    }
    const diff = el('div', 'diff');
    diff.append(el('span', '', t('Dificultad:')));
    for (const [name, v] of DIFFICULTIES) {
      const b = el('button', v === skill ? 'sel' : '', t(name));
      b.onclick = () => { skill = v; diff.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); };
      diff.append(b);
    }
    start.onclick = () => {
      this.lastMode = { kind: 'practice', dexes: [...chosen], skill };
      this.net.send({ t: 'practice', dexes: chosen, skill });
    };
    wrap.append(el('p', 'intro', t('Elige hasta 3 Pokémon (nivel 50). El bot lleva el mismo número.')), grid, diff, start);
    this.root.append(wrap);
  }

  // ---------- Resultados ----------
  results(msg, battle) {
    this.view = 'results';
    this.root.hidden = false;
    this.root.innerHTML = '';
    const r = msg.reward || {};
    const won = msg.winner === msg.you, draw = msg.winner === -1;
    const box = el('div', 'panel results');
    const title = t(msg.captured ? '¡Capturado!' : draw ? 'Empate' : won ? '¡Victoria!' : 'Derrota');
    if (won || msg.captured) {
      const conf = el('div', 'confetti');
      const colors = ['#ffcb05', '#3b78d8', '#e8403a', '#4fd06a', '#ff9ee0', '#ffffff'];
      for (let i = 0; i < 70; i++) {
        const c = el('i');
        c.style.left = Math.random() * 100 + '%';
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
        c.style.animationDelay = Math.random() * 0.6 + 's';
        conf.append(c);
      }
      box.append(conf);
    }
    box.append(el('h1', won || msg.captured ? 'win' : draw ? '' : 'lose', title));
    if (msg.captured) {
      const c = el('div', 'caught');
      // Render 3D de HOME (si no carga, el sprite animado de siempre)
      const home = el('img', 'caught-home');
      home.src = `home/${msg.captured.shiny ? 'shiny/' : ''}${msg.captured.dex}.png`; home.alt = ''; home.draggable = false;
      home.onerror = () => home.replaceWith(animatedPortrait(msg.captured.dex, 140, 'Idle', !!msg.captured.shiny));
      c.append(home);
      c.append(el('p', '', `${t('¡Has atrapado a <b>{m}</b>{shiny} ({lv})!', { m: SPECIES[msg.captured.dex].name, shiny: msg.captured.shiny ? ` <i class="shiny-star">${t('✦ ¡SHINY!')}</i>` : '', lv: lv(msg.captured.level) })}${r.captured && r.captured.perfect ? `<br><b class="perfect">${t('¡Con IV perfectos!')}</b>` : ''}${r.captured && !r.captured.inTeam ? `<br><small>${t('Tu equipo está lleno: lo encontrarás en Equipo.')}</small>` : ''}`));
      box.append(c);
      if (r.captured && r.captured.uid) box.append(this.nickForm(r.captured.uid, msg.captured.dex));
    }
    if (r.badge) {
      const ln = Data.leadersOf(r.badge.region || 'kanto')[r.badge.index];
      box.append(el('div', 'badge-won', `${r.badge.kind === 'gym' ? `<span class="badge-shine">${badgeImg(r.badge.region || 'kanto', r.badge.index, true, 96, 'big')}</span>` : `<i class="badge got big" style="--tc:${TYPE_COLOR[ln.type]}"></i>`}<p>${t('¡Has vencido a <b>{who}</b>!', { who: ln.leader })}${r.badge.kind === 'gym' ? ' ' + t('{badge} conseguida.', { badge: ln.badge || ln.name }) : r.badge.kind === 'champion' ? ' ' + t('¡Eres el nuevo Campeón!') : ''}</p>`));
    }
    if (r.items) box.append(el('p', 'reward-items', t('Premio:') + ' ' + Object.entries(r.items).map(([k, n]) => `<span class="ri">${itemImg(k, 28)}${(SHOP.find(i => i.id === k) || { name: k }).name} ×${n}</span>`).join(' ')));
    if (r.coins) box.append(el('p', 'reward', `+${coins(r.coins)}`));
    if (r.gems) box.append(el('p', 'reward gems', `+${icon('gem', 18)} ${t('{n} gemas', { n: r.gems })}`));
    if (r.cap && r.xp && r.xp.some(x => x.capped)) box.append(el('p', 'small', t('Tope de nivel {n}: vence al siguiente gimnasio para que sigan subiendo.', { n: r.cap })));
    if (r.xp && r.xp.length) {
      const up = r.xp.filter(x => x.level > x.fromLevel || x.evolved);
      if (up.length) setTimeout(() => this.app.sfx.levelUp(up.some(x => x.evolved)), 600);
      const list = el('div', 'xp-list');
      for (const x of r.xp) {
        const row = el('div', 'xp-row');
        const pm = this.profile && this.profile.mons.find(m => m.uid === x.uid);
        // Quien evoluciona posa y quien sube de nivel salta; los demás, cara de victoria o de derrota
        const shiny = !!(pm && pm.shiny), dex = x.evolved || x.dex;
        row.append(x.evolved ? animatedPortrait(dex, 48, 'Pose', shiny) : x.level > x.fromLevel ? animatedPortrait(dex, 48, 'Hop', shiny)
          : face(dex, 48, draw ? 'Normal' : won ? 'Joyous' : 'Sad', shiny) || portrait(dex, 48, { shiny }));
        const lvl = x.level > x.fromLevel ? `${lv(x.fromLevel)} → <span class="lvup">${lv(x.level)} ${t('¡sube de nivel!')}</span>` : lv(x.level);
        const learned = (x.learned || []).map(k => MOVES[k].name);
        row.append(el('div', '', `<b>${pm && pm.nick ? escapeHtml(pm.nick) : SPECIES[x.from].name}</b> ${x.capped && !x.xp ? `<span class="cap">${t('en el tope de nivel')}</span>` : `+${x.xp} EXP`} · ${lvl}${x.evolved ? `<br><span class="evo">${t('¡Ha evolucionado a {m}!', { m: SPECIES[x.evolved].name })}</span>` : ''}${learned.length ? `<br><span class="lvup">${t('Nuevo movimiento: {list}', { list: learned.join(', ') })}</span> <small>${t('(elígelo en Equipo)')}</small>` : ''}${x.ev && Object.keys(x.ev).length ? ` <small class="evgain">EV ${Object.entries(x.ev).map(([k, v]) => `+${v} ${Data.VIT_STATS[k]}`).join(', ')}</small>` : ''}`));
        list.append(row);
      }
      box.append(list);
    }
    if (r.mastery && r.mastery.length) {
      const n = Data.MASTERY.length;
      const up = el('div', 'mastery-up', r.mastery.map(u => `<div>${portrait(u.dex, 40).outerHTML}<span>${t('Maestría de la línea de <b>{m}</b>', { m: SPECIES[u.dex].name })} <i class="mstars">${'★'.repeat(u.tier)}${'☆'.repeat(n - u.tier)}</i><small>${masteryPrize(Data.MASTERY_TIERS[u.tier - 1], u.dex, t)}</small></span></div>`).join(''));
      up.querySelectorAll('canvas').forEach((c, i) => c.replaceWith(portrait(r.mastery[i].dex, 40)));
      const go = el('button', 'claim-btn', t('Recoger en Logros'));
      go.onclick = () => this.openCollection('mastery');
      up.append(go);
      box.append(up);
    }
    if (r.tower) this.towerResults(box, r);
    this.resultsMissions(box, r.missions);
    if (r.elo !== undefined) box.append(el('p', 'reward', `ELO ${r.elo >= 0 ? '+' : ''}${r.elo} → <b>${r.total}</b>`));
    if (r.promoted) box.append(el('div', 'promoted', `${frameBadge(Data.RANKED_REWARDS[r.promoted].frame, 40)}<p>${t('¡Has subido a <b>{league}</b>! Reclama tu premio en Clasificatoria.', { league: t(r.promoted) })}</p>`));
    if (r.firstWin) box.append(el('p', 'small', t('Incluye {n} extra por la primera victoria del día.', { n: coins(Data.RANKED_PAY.firstWin) })));
    if (!won && !draw && battle && battle.mode === 'wild') box.append(el('p', 'small', t('Tus Pokémon se recuperan después de cada combate. ¡Inténtalo otra vez!')));
    const acts = el('div', 'acts');
    const back = el('button', 'primary', t('Continuar'));
    const lm = this.lastMode;
    back.onclick = () => this.show(lm && lm.kind === 'story' ? 'story' : lm === 'ranked' ? 'online' : lm && lm.kind === 'practice' ? 'practice' : lm && lm.kind === 'tower' ? 'tower' : 'menu');
    acts.append(back);
    if (lm && (lm.kind === 'practice' || (lm.kind === 'story' && lm.a === 'route'))) {
      const again = el('button', '', lm.kind === 'practice' ? t('Otra vez') : t('Seguir explorando'));
      again.onclick = () => lm.kind === 'practice' ? this.net.send({ t: 'practice', dexes: lm.dexes, skill: lm.skill }) : this.startStory(lm.a, lm.id);
      acts.append(again);
    }
    if (lm && lm.kind === 'tower' && r.tower && !r.tower.ended) {
      const next = el('button', '', t('Combate {n}', { n: r.tower.streak + 1 }));
      next.onclick = () => this.towerBattle();
      acts.append(next);
    }
    if (lm === 'ranked' || lm === 'casual') {
      const again = el('button', '', t('Buscar otra'));
      again.onclick = () => this.net.send({ t: 'queue', mode: lm });
      acts.append(again);
    }
    box.append(acts);
    this.root.append(box);
  }
}

Object.assign(UI.prototype, towerViews, accountViews, pokedexViews, bagViews, achievementViews, missionViews, legalBarViews, collectionViews, dailyViews, tutorialViews, treasureViews, monSheetViews);
