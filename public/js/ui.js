// Pantallas fuera de combate: menú, historia (inicial, mapa, equipo, tienda),
// clasificatoria (cola, draft, ranking), práctica y resultados. Torre Batalla y Ladder en tower.js;
// la portada, el perfil, las recompensas y las novedades en account.js.
import { portrait, animatedPortrait } from './sprites.js';
import { escapeHtml, describeMove } from './battle.js';
import { REGION_ART, regionMapSVG } from './regionmap.js';
import { towerViews } from './tower.js';
import { accountViews } from './account.js';

const { SPECIES, MOVES, TYPE_LABEL, TYPE_COLOR, ROUTES, GYMS, SHOP, STARTERS, RANKED_POOL, xpToNext, LEAGUES } = Data;
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
export const typeChips = dex => SPECIES[dex].types.map(t => `<span class="type" style="--tc:${TYPE_COLOR[t]}">${TYPE_LABEL[t]}</span>`).join('');
export const coins = n => `<span class="coin">₽</span>${n.toLocaleString('es-ES')}`;
// Orden del recorrido por el mapa (rutas y gimnasios intercalados)
const DIFFICULTIES = [['Fácil', 0.1], ['Normal', 0.28], ['Difícil', 0.5], ['Maestro', 0.85]];

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screen');
    this.toastEl = document.getElementById('toasts');
    this.profile = null;
    this.board = [];
    this.view = 'title';
    this.lastMode = null;
  }

  get net() { return this.app.net; }

  setProfile(p, board, rank) {
    const first = !this.profile;
    this.profile = p;
    this.board = board || this.board;
    this.rank = rank;
    if (this.pendingFicha) {
      const mon = p.mons.find(m => m.uid === this.pendingFicha);
      this.pendingFicha = null;
      if (mon && !this.root.hidden) setTimeout(() => this.statsModal(mon), 0);
    }
    if (first) {
      this.show('menu');
      // Primera vez en esta versión: enseñar las novedades
      if (this.hasNews() && !p.inbox?.length) setTimeout(() => this.patchNotes(), 400);
    } else if (!this.root.hidden && ['menu', 'story', 'team', 'shop', 'online', 'tower', 'profile'].includes(this.view)) this.show(this.view, true);
    if (!this.root.hidden) this.showInbox();
  }

  toast(text, cls = '') {
    const t = el('div', 'toast ' + cls, escapeHtml(text));
    this.toastEl.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  show(view, keepScroll) {
    const scroll = keepScroll ? (this.root.querySelector('.scroll') || {}).scrollTop : 0;
    this.view = view;
    this.root.hidden = false;
    this.root.innerHTML = '';
    const fn = this['view_' + view];
    if (fn) fn.call(this);
    const sc = this.root.querySelector('.scroll');
    if (sc && scroll) sc.scrollTop = scroll;
  }

  // Abre Mis Pokémon o la Tienda recordando de dónde se viene para que "Volver" regrese allí
  openFrom(view) {
    if (!['team', 'shop'].includes(this.view)) this.returnTo = this.view;
    this.show(view);
  }

  hide() { this.root.hidden = true; this.root.innerHTML = ''; }

  topbar(title, back) {
    const p = this.profile;
    const bar = el('div', 'topbar');
    if (back) { const b = el('button', 'back', '← Volver'); b.onclick = () => this.show(back); bar.append(b); }
    bar.append(el('h2', '', title));
    // Accesos fijos a Mis Pokémon y Tienda desde cualquier pantalla fuera de combate
    const nav = el('div', 'tools nav');
    for (const [view, label] of [['team', 'Mis Pokémon'], ['shop', 'Tienda']]) {
      if (this.view === view || !p.mons.length) continue;
      const b = el('button', '', label);
      b.onclick = () => this.openFrom(view);
      nav.append(b);
    }
    if (this.view !== 'ladder') { const b = el('button', '', 'Ladder'); b.onclick = () => this.openLadder(); nav.append(b); }
    if (this.view === 'menu') nav.append(this.newsButton());
    bar.append(nav);
    const stats = el('div', 'stats', `<span class="pill">${coins(p.coins)}</span><span class="elo">${p.league} · ${p.elo}</span>`);
    if (this.view !== 'profile') stats.append(this.profileChip());
    bar.append(stats);
    return bar;
  }

  // ---------- Menú ----------
  view_menu() {
    const p = this.profile;
    const wrap = el('div', 'menu');
    wrap.append(this.topbar(`¡Hola, ${escapeHtml(p.name)}!`));
    const top = el('div', 'menu-top');
    const grid = el('div', 'menu-grid');
    const card = (title, desc, cls, art, onClick) => {
      const c = el('button', 'menu-card ' + cls, `<b>${title}</b><span>${desc}</span>`);
      const a = animatedPortrait(art, 120, 'Idle');
      a.classList.add('art');
      c.prepend(a);
      c.onclick = onClick;
      grid.append(c);
    };
    const leadUid = p.teams && (p.teams[this.region || 'kanto'] || [])[0];
    const lead = p.mons.find(m => m.uid === leadUid) || p.mons[0] || null;
    const regs = Data.REGION_IDS.map(r => `${Data.REGIONS[r].name} ${Data.progOf(p, r) >= 13 ? '♛' : Math.min(8, Data.progOf(p, r)) + '/8'}`).join(' · ');
    card('Historia', p.mons.length ? `${regs} · ${p.mons.length} Pokémon` : 'Elige tu primer Pokémon y viaja por Kanto y Johto', 'story', lead ? lead.dex : 25, () => this.show('story'));
    const ready = this.claimable().length;
    card('Clasificatoria', `${p.league} · ${p.elo} ELO · ${p.wins}V ${p.losses}D${ready ? ` · <em class="ready">¡${ready} premio${ready > 1 ? 's' : ''} por reclamar!</em>` : ''}`, 'ranked', 149, () => this.show('online'));
    card('Partida rápida', 'Online sin ELO: elige 3 y a combatir', 'casual', 6, () => { this.lastMode = 'casual'; this.net.send({ t: 'queue', mode: 'casual' }); });
    card('Práctica', 'Contra la IA, con la dificultad que quieras', 'practice', 68, () => this.show('practice'));
    const tw = p.tower;
    card('Torre Batalla', tw.team ? `Racha en curso: ${tw.streak} · bloque ${tw.block}` : `Combates seguidos a Nv.50 · récord ${tw.best}`, 'tower', 248, () => this.show('tower'));
    card('Ladder', 'Rankings de clasificatoria, Torre y Pokédex: busca a cualquier entrenador', 'ladder', 448, () => this.openLadder());
    top.append(grid, this.profilePanel(lead));
    wrap.append(top, this.howTo(), this.footer());
    this.root.append(wrap);
  }

  profilePanel(lead) {
    const p = this.profile;
    const total = Object.keys(SPECIES).length;
    const box = el('div', 'panel profile');
    const who = el('button', 'who');
    who.title = 'Ver perfil';
    who.onclick = () => this.show('profile');
    who.append(this.avatar(84, true), el('div', '', `<b>${escapeHtml(p.name)}</b>${p.title ? `<span class="title-chip">${escapeHtml(p.title)}</span> ` : ''}<span class="elo">${p.league} · ${p.elo}</span>`));
    box.append(who);
    if (!p.account) {
      const reg = el('button', 'guest-cta', '<b>Juegas como invitado</b><small>Crea una cuenta para no perder tu partida</small>');
      reg.onclick = () => this.show('profile');
      box.append(reg);
    }
    box.append(el('div', 'rows', `
      <div class="stat"><small>Dinero</small><b>${coins(p.coins)}</b></div>
      <div class="stat"><small>Medallas</small><b>${Data.REGION_IDS.map(r => Math.min(8, Data.progOf(p, r))).reduce((a, b) => a + b, 0)}/${8 * Data.REGION_IDS.length}</b></div>
      <div class="stat"><small>Pokémon</small><b>${p.mons.length}${p.mons.some(m => m.shiny) ? ` <i class="shiny-star">✦${p.mons.filter(m => m.shiny).length}</i>` : ''}</b></div>
      <div class="stat"><small>Clasificatoria</small><b>${p.wins}V ${p.losses}D</b></div>
      <div class="stat"><small>Torre: récord</small><b>${p.tower.best}${p.tower.team ? ` <small class="small">racha ${p.tower.streak}</small>` : ''}</b></div>`));
    box.append(el('div', 'stat', `<small>Pokédex</small><b>${p.caught.length} / ${total}</b><div class="dexbar"><div style="width:${p.caught.length / total * 100}%"></div></div>`));
    return box;
  }

  howTo() {
    const d = el('details', 'howto');
    d.innerHTML = `<summary>Cómo se juega</summary>
      <div class="cols">
      <div><h4>Controles</h4><ul>
        <li><kbd>WASD</kbd> moverte · <kbd>Ratón</kbd> apuntar</li>
        <li><kbd>Clic</kbd> <kbd>Clic dcho</kbd> <kbd>Q</kbd> <kbd>E</kbd> los 4 movimientos</li>
        <li><kbd>Espacio</kbd> Protección · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> cambiar de Pokémon</li>
        <li><kbd>F</kbd> lanzar Poké Ball · <kbd>R</kbd> cambiar de Ball (salvajes) · <kbd>Esc</kbd> rendirse</li></ul></div>
      <div><h4>Combate</h4><ul>
        <li>Cada ataque tiene <b>preparación</b> (se ve en el suelo: ¡esquívalo!) y <b>recuperación</b> (eres vulnerable).</li>
        <li><b>Protección</b> bloquea el 80 %. Si el golpe llega en sus primeros ${Math.round(Data.PROTECT.perfect * 1000)} ms haces <b>parry</b>: devuelves el proyectil o aturdes al atacante.</li>
        <li>Los ataques fuertes gastan <b>energía</b>; se recarga sola y al golpear.</li>
        <li><b>Cambio perfecto</b>: si el que entra recibe un ataque de un tipo que resiste, no le hace nada y ganas energía.</li></ul></div>
      <div><h4>Terreno</h4><ul>
        <li>En la <b>hierba alta</b> te escondes si no atacas. El <b>vapor</b> también oculta.</li>
        <li>El fuego <b>quema la hierba</b> y se propaga. Fuego + agua = <b>vapor</b>.</li>
        <li>Un ataque eléctrico en un charco <b>electrocuta</b> a quien esté en el agua. Mojado = más daño eléctrico y de hielo.</li>
        <li>A los 2 min, <b>muerte súbita</b>; a los 3 min gana quien tenga más PS.</li></ul></div>
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
    const bar = this.topbar(R.name, 'menu');
    wrap.append(bar, this.regionBar(region, rid => { this.region = rid; this.show('story'); }, true));
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
      const c = el('div', 'city', `<span>${name}</span>`);
      c.style.left = x + '%'; c.style.top = y + '%';
      stage.append(c);
    }
    const nodes = R.nodes;
    // Camino: une cada líder con el anterior pasando por sus rutas (en orden)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('paths');
    stage.append(svg);
    const info = el('div', 'node-info');
    nodes.forEach(n => {
      const isLeader = n.kind !== 'route';
      const unlocked = isLeader ? n.index <= prog : n.req <= prog;
      const done = isLeader && n.index < prog;
      const b = el('button', `node ${isLeader ? 'gym' : 'route'}${unlocked ? '' : ' locked'}${done ? ' done' : ''}${isLeader && n.index === prog ? ' next' : ''}`);
      b.style.left = n.x + '%'; b.style.top = n.y + '%';
      if (isLeader) b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = isLeader ? `${n.name} · ${n.leader}` : n.name;
      const city = isLeader && cityAt(n);
      b.innerHTML = `<span>${isLeader ? (n.kind === 'gym' ? n.index + 1 : n.kind === 'champion' ? '♛' : '★') : ''}</span><label>${isLeader ? n.leader : n.name}${city ? `<small>${city[0]}</small>` : ''}</label>`;
      if (!isLeader && unlocked && n.wild.length) b.prepend(portrait(n.wild[0][0], 30));
      b.onclick = () => { map.querySelectorAll('.node').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); this.nodeInfo(info, n, unlocked, done); };
      stage.append(b);
    });
    body.append(map, info);
    wrap.append(body);
    this.root.append(wrap);
    const next = map.querySelector('.node.next') || map.querySelector('.node.route:not(.locked)');
    if (next) next.click();
  }

  nodeInfo(box, n, unlocked, done) {
    box.innerHTML = '';
    const p = this.profile;
    const R = Data.REGIONS[n.region];
    if (n.kind !== 'route') {
      const title = n.kind === 'gym' ? n.name : n.kind === 'champion' ? `Campeón de ${R.name}` : `Alto Mando de ${R.name}`;
      box.append(el('h3', '', title), el('p', 'leader', `${n.kind === 'gym' ? 'Líder' : n.kind === 'champion' ? 'Campeón' : 'Miembro'}: <b>${n.leader}</b> · tipo <span class="type" style="--tc:${TYPE_COLOR[n.type]}">${TYPE_LABEL[n.type]}</span>`));
      const used = Data.leaderTeam(n, p.starter || (p.mons[0] && p.mons[0].dex));
      const team = el('div', 'mini-team');
      for (const [dex, lvl] of used) { const c = el('div', 'mini'); c.append(portrait(dex, 56)); c.append(el('small', '', `${SPECIES[dex].name}<br>Nv.${lvl}`)); team.append(c); }
      box.append(team);
      if (n.team.length > 3) box.append(el('p', 'small', `Equipo real completo: ${n.team.map(([d, l]) => `${d === 'rival' ? 'tu rival' : SPECIES[d].name} ${l}`).join(', ')}. En combate saca sus 3 más fuertes.`));
      box.append(el('p', 'small', `Dificultad de la IA: ${Math.round(n.ai * 100)} % · Premio ${coins(n.reward)}${n.badge ? ` y ${n.badge}` : ''} · la primera vez también Caramelo Raro y una vitamina`));
      if (!unlocked) box.append(el('p', 'warn', n.index >= 8 ? 'Consigue las 8 medallas de la región y vence a los anteriores.' : 'Vence antes al anterior.'));
      else {
        const go = el('button', 'primary', done ? 'Revancha' : '¡Desafiar!');
        go.onclick = () => this.startStory('gym', n.id);
        box.append(go);
      }
    } else {
      const w = Data.routeWild(n);
      box.append(el('h3', '', n.name), el('p', 'small', `${R.name} · Nv.${n.lvl[0]}-${n.lvl[1]} · encuentros reales del juego`));
      const list = el('div', 'mini-team');
      const total = w.list.reduce((a, x) => a + x.weight, 0) / (1 - w.rare.chance);
      for (const { dex, weight, min, max } of w.list) {
        const c = el('div', 'mini' + (p.caught.includes(dex) ? ' caught' : ''));
        c.append(portrait(dex, 56));
        c.append(el('small', '', `${SPECIES[dex].name}<br>${Math.max(1, Math.round(weight / total * 100))} % · Nv.${min === max ? min : min + '-' + max}`));
        c.title = `${SPECIES[dex].name} · ${SPECIES[dex].types.map(t => TYPE_LABEL[t]).join('/')} · Gen ${SPECIES[dex].gen}`;
        list.append(c);
      }
      // El misterioso del día: silueta hasta que lo atrapas
      const known = p.caught.includes(w.rare.dex);
      const rare = el('div', 'mini rare' + (known ? ' caught' : ''));
      rare.append(portrait(w.rare.dex, 56, { silhouette: !known }));
      rare.append(el('small', '', `${known ? SPECIES[w.rare.dex].name : '???'}<br>${+(w.rare.chance * 100).toFixed(1)} % · Nv.${n.lvl[1] + 3}`));
      rare.title = 'Pokémon misterioso del día: aparece muy de vez en cuando y cuesta mucho atraparlo';
      list.append(rare);
      box.append(list);
      const balls = (p.items.pokeball || 0) + (p.items.superball || 0) + (p.items.ultraball || 0);
      box.append(el('p', 'small', `Debilítalo para ganar experiencia, o bájale los PS y lánzale una Poké Ball (<kbd>F</kbd>). Tienes ${balls} Balls. Shiny: 1 de ${Math.round(1 / Data.SHINY_RATE)}.`));
      if (!unlocked) box.append(el('p', 'warn', `Necesitas ${n.req} medallas de ${R.name}.`));
      else {
        const go = el('button', 'primary', 'Explorar');
        go.onclick = () => this.startStory('route', n.id);
        box.append(go);
      }
    }
    box.append(el('h4', '', 'Tu equipo'));
    const team = el('div', 'mini-team');
    for (const uid of (p.teams && p.teams[n.region]) || []) { const m = p.mons.find(x => x.uid === uid); if (!m) continue; const c = el('div', 'mini'); c.append(portrait(m.dex, 48, { shiny: !!m.shiny })); c.append(el('small', '', `${SPECIES[m.dex].name}${m.shiny ? ' ✦' : ''}<br>Nv.${m.level}`)); team.append(c); }
    box.append(team);
  }

  startStory(a, id) {
    this.lastMode = { kind: 'story', a, id };
    this.net.send({ t: 'story', a, id });
  }

  view_starter(region = 'kanto') {
    const R = Data.REGIONS[region];
    const wrap = el('div', 'starter');
    const bar = this.topbar(`Tu inicial de ${R.name}`, 'menu');
    wrap.append(bar, this.regionBar(region, rid => { this.region = rid; this.show('story'); }, true));
    wrap.append(el('p', 'intro', `Cada región es un viaje nuevo: tus Pokémon de otras regiones no vienen contigo. Elige a tu compañero para ${R.name}.`));
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
  regionBar(current, onPick, withBadges) {
    const p = this.profile;
    const bar = el('div', 'subbar');
    const tabs = el('div', 'region-tabs');
    for (const rid of Data.REGION_IDS) {
      const done = Math.min(8, Data.progOf(p, rid));
      const t = el('button', rid === current ? 'sel' : '', `<b>${Data.REGIONS[rid].name}</b><small>${Data.progOf(p, rid) >= Data.leadersOf(rid).length ? '♛ Campeón' : done + '/8 medallas'}</small>`);
      t.onclick = () => onPick(rid);
      tabs.append(t);
    }
    bar.append(tabs);
    if (withBadges) {
      const prog = Data.progOf(p, current);
      const leaders = Data.leadersOf(current);
      bar.append(el('div', 'badges', leaders.slice(0, 8).map((g, i) => `<i class="badge${i < prog ? ' got' : ''}" style="--tc:${TYPE_COLOR[g.type]}" title="${g.badge} · ${g.leader}"></i>`).join('')));
      const next = leaders[prog];
      bar.append(el('div', 'next-goal', next ? `Siguiente: <b>${next.leader}</b> · ${next.kind === 'gym' ? next.name : next.kind === 'champion' ? 'Campeón' : 'Alto Mando'} <span class="cap">tope Nv.${Data.levelCap(p, current)}</span>` : '♛ ¡Región completada!'));
    }
    return bar;
  }

  // ---------- Equipo ----------
  view_team() {
    const p = this.profile;
    const wrap = el('div', 'teamview');
    const region = this.teamRegion = this.teamRegion || this.region || 'kanto';
    const bar = this.topbar('Mis Pokémon', this.returnTo || 'menu');
    wrap.append(bar, this.regionBar(region, rid => { this.teamRegion = rid; this.show('team'); }, false));
    const cap = Data.levelCap(p, region);
    const next = Data.leadersOf(region)[Data.progOf(p, region)];
    const team = (p.teams && p.teams[region]) || [];
    const mine = p.mons.filter(m => (m.region || 'kanto') === region);
    wrap.append(el('p', 'intro', `Pokémon de ${Data.REGIONS[region].name}: solo combaten en su región. Mete o saca del equipo (máximo 3) y gestiona su ficha. <span class="cap">Tope de nivel en ${Data.REGIONS[region].name}: <b>${cap}</b>${next && cap < 100 ? ` · vence a ${next.leader} para subir más` : ''}</span>`));
    if (!mine.length) wrap.append(el('p', 'warn', `Aún no tienes Pokémon en ${Data.REGIONS[region].name}: elige tu inicial en Historia.`));
    const grid = el('div', 'mon-grid scroll');
    const sorted = [...mine].sort((a, b) => (team.includes(b.uid) - team.includes(a.uid)) || b.level - a.level);
    for (const m of sorted) {
      const inTeam = team.includes(m.uid);
      const card = el('div', 'mon-card' + (inTeam ? ' in' : '') + (m.shiny ? ' is-shiny' : ''));
      card.append(portrait(m.dex, 72, { shiny: !!m.shiny }));
      const need = xpToNext(m.level);
      const moves = (m.moves && m.moves.length ? m.moves : SPECIES[m.dex].moves).filter(k => MOVES[k]);
      const known = Data.learnedAt(m.dex, m.level).filter(k => !moves.includes(k));
      const upcoming = Data.learnset(m.dex).find(([l]) => l > m.level);
      card.append(el('div', 'mi', `<b>${SPECIES[m.dex].name}${m.shiny ? ' <i class="shiny-star">✦ shiny</i>' : ''}</b> <small>Nv.${m.level}${m.level >= cap ? ' · <span class="cap">tope</span>' : ''}</small><div class="types">${typeChips(m.dex)}</div><div class="xp"><div style="width:${m.level >= cap ? 100 : Math.min(100, m.xp / need * 100)}%"></div></div>
        <div class="movechips">${moves.map(k => `<span class="mchip" style="--tc:${TYPE_COLOR[MOVES[k].type]}">${MOVES[k].name}</span>`).join('')}</div>
        ${known.length ? `<small class="newmoves">${known.length} movimiento${known.length > 1 ? 's' : ''} más para elegir</small>` : ''}
        ${upcoming ? `<small class="moves">Aprende ${MOVES[upcoming[1]].name} al Nv.${upcoming[0]}</small>` : ''}`));
      const acts = el('div', 'acts');
      const toggle = el('button', inTeam ? 'on' : '', inTeam ? 'En el equipo' : 'Al equipo');
      toggle.onclick = () => {
        let next = team.filter(u => u !== m.uid);
        if (!inTeam) { if (team.length >= 3) return this.toast('El equipo ya tiene 3 Pokémon: saca uno antes', 'bad'); next = [...team, m.uid]; }
        if (!next.length) return this.toast('El equipo necesita al menos un Pokémon', 'bad');
        this.net.send({ t: 'story', a: 'team', uids: next, region });
      };
      acts.append(toggle);
      const ficha = el('button', '', 'Ficha');
      ficha.onclick = () => this.statsModal(m);
      acts.append(ficha);
      const mv = el('button', known.length ? 'evo' : '', 'Movimientos');
      mv.onclick = () => this.moveManager(m);
      acts.append(mv);
      if ((p.items.caramelo || 0) > 0) {
        const b = el('button', '', `Caramelo Raro (${p.items.caramelo})`);
        b.onclick = () => this.net.send({ t: 'story', a: 'use', item: 'caramelo', uid: m.uid });
        acts.append(b);
      }
      const evo = SPECIES[m.dex].evo;
      const stones = evo ? (Array.isArray(evo[0]) ? evo : [evo]).filter(e => typeof e[1] === 'string') : [];
      for (const [to, stone] of stones) {
        const item = SHOP.find(s => s.id === stone);
        const have = p.items[stone] || 0;
        const b = el('button', have ? 'evo' : 'evo dim', `${item.name} → ${SPECIES[to].name}`);
        b.disabled = !have;
        b.title = have ? '' : 'Cómprala en la tienda';
        b.onclick = () => this.net.send({ t: 'story', a: 'use', item: stone, uid: m.uid });
        acts.append(b);
      }
      if (evo && !stones.length && typeof evo[1] === 'number') acts.append(el('small', 'evohint', `Evoluciona a ${SPECIES[evo[0]].name} al Nv.${evo[1]}`));
      if (mine.length > 1) {
        const rel = el('button', 'danger', 'Liberar');
        rel.onclick = () => { if (confirm(`¿Liberar a ${SPECIES[m.dex].name} (Nv.${m.level})? No se puede deshacer.`)) this.net.send({ t: 'story', a: 'release', uid: m.uid }); };
        acts.append(rel);
      }
      card.append(acts);
      grid.append(card);
    }
    wrap.append(grid);
    this.root.append(wrap);
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
    head.append(animatedPortrait(mon.dex, 120, 'Idle', !!mon.shiny));
    const route = mon.met ? Data.NODES[mon.met] || null : null;
    const nat = Data.NATURES[mon.nat] || ['—', null, null];
    const natTxt = nat[1] ? `<b>${nat[0]}</b> (+${Data.STAT6[nat[1]]}, −${Data.STAT6[nat[2]]})` : `<b>${nat[0]}</b> (neutra)`;
    head.append(el('div', '', `<h3>${sp.name}${mon.shiny ? ' <i class="shiny-star">✦ shiny</i>' : ''} <small>Nv.${mon.level}</small></h3><div class="types">${typeChips(mon.dex)}</div>
      <p class="small">Nº ${mon.dex} · Gen ${sp.gen}${sp.leg ? ' · <b>legendario</b>' : ''} · Hitbox ${Shared.hitboxOf(mon.dex)} px${route ? ` · Capturado en ${route.name}` : ''}</p>
      <p class="small">Naturaleza: ${natTxt}</p>`));
    box.append(head);
    // Estadísticas de combate: valor actual, barra, IV, EV y vitaminas
    const rows = el('div', 'stat-rows');
    const total = Data.evTotal(ev);
    rows.append(el('div', 'small vit-total', `EV: <b>${total}/${Data.EV_TOTAL}</b> en total (máx. ${Data.EV_MAX} por stat; solo con vitaminas: +${Data.EV_VIT} cada una) · IV fijos de nacimiento (0-${Data.IV_MAX})`));
    const bars = [
      ['hp', 'PS', st.maxHp, 400, `${st.maxHp}`],
      ['atk', 'Ataque', st.atk, 2, `×${st.atk.toFixed(2)}`],
      ['def', 'Defensa', st.def, 1.7, `×${st.def.toFixed(2)}`],
      ['spe', 'Velocidad', sp.spd * st.spdMult, 340, `${Math.round(sp.spd * st.spdMult)} px/s`],
    ];
    const vitItems = SHOP.filter(i => i.vit);
    for (const [key, label, val, max, text] of bars) {
      const row = el('div', 'stat-row');
      const item = vitItems.find(i => i.vit === key);
      const have = p.items[item.id] || 0;
      const ivq = iv[key] >= 31 ? 'perfecto' : iv[key] >= 26 ? 'muy bueno' : iv[key] >= 16 ? 'bueno' : iv[key] >= 8 ? 'normal' : 'flojo';
      row.innerHTML = `<span class="sl">${label}</span><div class="sbar"><div style="width:${Math.min(100, val / max * 100)}%"></div></div><b>${text}</b>
        <span class="vdots" title="IV ${iv[key]}/31 (${ivq}) · EV ${ev[key]}/${Data.EV_MAX}">IV <b class="${iv[key] >= 31 ? 'iv-top' : ''}">${iv[key]}</b> · EV <b>${ev[key]}</b></span>`;
      const canUse = have && ev[key] < Data.EV_MAX && total < Data.EV_TOTAL;
      const use = el('button', canUse ? 'evo' : 'dim', `${item.name}${have ? ` (${have})` : ''}`);
      use.disabled = !canUse;
      use.title = have ? `+${Data.EV_VIT} EV de ${label}` : `Cómpralo en la tienda: ${item.name}`;
      use.onclick = () => { this.net.send({ t: 'story', a: 'use', item: item.id, uid: mon.uid }); back.remove(); this.pendingFicha = mon.uid; };
      row.append(use);
      rows.append(row);
    }
    box.append(rows);
    // Stats base reales de la especie
    const base = sp.base || [0, 0, 0, 0, 0, 0];
    const names = ['PS', 'Atq', 'Def', 'At.Esp', 'Df.Esp', 'Vel'];
    box.append(el('div', 'base-stats', `<small>Stats base de la especie (total ${sp.bst})</small><div class="bs">${base.map((v, i) => `<div><i style="height:${Math.min(100, v / 1.6)}%"></i><b>${v}</b><span>${names[i]}</span></div>`).join('')}</div>`));
    const moves = (mon.moves && mon.moves.length ? mon.moves : sp.moves).filter(k => MOVES[k]);
    box.append(el('div', 'movechips', moves.map(k => `<span class="mchip" style="--tc:${TYPE_COLOR[MOVES[k].type]}">${MOVES[k].name}</span>`).join('')));
    const evo = sp.evo;
    if (evo) {
      const list = Array.isArray(evo[0]) ? evo : [evo];
      box.append(el('p', 'small', 'Evoluciona a ' + list.map(([to, c]) => `${SPECIES[to].name} (${typeof c === 'number' ? 'Nv.' + c : 'Piedra ' + (SHOP.find(i => i.id === c) || { name: c }).name.replace('Piedra ', '')})`).join(', ')));
    }
    const acts = el('div', 'acts');
    const price = Data.sellPrice(mon);
    const sell = el('button', 'danger', `Vender por ${coins(price)}`);
    sell.disabled = p.mons.filter(x => (x.region || 'kanto') === (mon.region || 'kanto')).length <= 1;
    sell.onclick = () => { if (confirm(`¿Vender a ${sp.name}${mon.shiny ? ' shiny' : ''} (Nv.${mon.level}) por ${price} ₽? No se puede deshacer.`)) { this.net.send({ t: 'story', a: 'sell', uid: mon.uid }); back.remove(); } };
    const close = el('button', 'primary', 'Cerrar');
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
    box.append(el('h3', '', `Movimientos de ${SPECIES[mon.dex].name} <small>Nv.${mon.level}</small>`), el('p', 'small', 'Elige hasta 4. El orden es el de las teclas: Clic, Clic dcho, Q y E.'));
    const list = el('div', 'move-list');
    const render = () => {
      list.innerHTML = '';
      for (const k of options) {
        const m = MOVES[k];
        const i = chosen.indexOf(k);
        const row = el('button', 'move-row' + (i >= 0 ? ' sel' : ''));
        row.style.setProperty('--tc', TYPE_COLOR[m.type]);
        row.innerHTML = `<span class="slot">${i >= 0 ? ['Clic', 'Dcho', 'Q', 'E'][i] : ''}</span><b>${m.name}</b><span class="type" style="--tc:${TYPE_COLOR[m.type]}">${TYPE_LABEL[m.type]}</span><em>${levels.has(k) ? 'Nv.' + levels.get(k) : 'aprendido'}</em><small>${describeMove(m).split('\n').join(' · ')}</small>`;
        row.onclick = () => {
          if (i >= 0) { if (chosen.length > 1) chosen.splice(i, 1); }
          else if (chosen.length < 4) chosen.push(k);
          else this.toast('Ya lleva 4: quita uno antes', 'bad');
          render();
        };
        list.append(row);
      }
      const upcoming = Data.learnset(mon.dex).filter(([l]) => l > mon.level);
      if (upcoming.length) list.append(el('p', 'small', 'Próximamente: ' + upcoming.map(([l, k]) => `${MOVES[k].name} (Nv.${l})`).join(' · ')));
    };
    render();
    const acts = el('div', 'acts');
    const cancel = el('button', '', 'Cancelar');
    const save = el('button', 'primary', 'Guardar');
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
    const wrap = el('div', 'shop');
    wrap.append(this.topbar('Tienda', this.returnTo || 'menu'));
    const grid = el('div', 'shop-grid scroll');
    for (const item of SHOP) {
      const locked = (item.req || 0) > p.badges;
      const c = el('div', 'shop-item' + (locked ? ' locked' : ''));
      const icon = item.dex ? portrait(item.dex, 64) : el('i', 'item-icon ' + item.id);
      c.append(icon);
      c.append(el('div', 'si', `<b>${item.name}</b><small>${item.desc}</small><span class="price">${coins(item.price)}</span>${item.dex ? '' : `<small>Tienes: ${p.items[item.id] || 0}</small>`}`));
      const acts = el('div', 'acts');
      if (locked) acts.append(el('small', 'warn', `Requiere ${item.req} medallas`));
      else for (const qty of item.dex ? [1] : item.cap ? [1, 5, 10] : [1]) {
        const b = el('button', '', qty === 1 ? 'Comprar' : `×${qty}`);
        b.disabled = p.coins < item.price * qty;
        b.onclick = () => this.net.send({ t: 'story', a: 'buy', id: item.id, qty, region: this.region || 'kanto' });
        acts.append(b);
      }
      c.append(acts);
      grid.append(c);
    }
    wrap.append(grid);
    this.root.append(wrap);
  }

  // ---------- Online ----------
  view_online() {
    const p = this.profile;
    const wrap = el('div', 'online');
    wrap.append(this.topbar('Clasificatoria', 'menu'));
    const body = el('div', 'online-body');
    const me = el('div', 'panel');
    const next = LEAGUES.find(l => l[0] > p.elo);
    me.innerHTML = `<h3>${escapeHtml(p.name)}</h3><div class="league">${p.league}</div><div class="big-elo">${p.elo}</div>
      <p class="small">${p.wins} victorias · ${p.losses} derrotas${next ? ` · ${next[0] - p.elo} puntos para ${next[1]}` : ''}</p>
      <p class="small">Draft: cada jugador veta 1 Pokémon y elige 3. Todos a nivel ${Data.RANKED_LEVEL}.</p>`;
    const go = el('button', 'primary', 'Buscar partida clasificatoria');
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
    const mode = this.queueMode === 'ranked' ? 'clasificatoria' : 'partida rápida';
    box.innerHTML = `<div class="spinner"></div><h3>Buscando rival para ${mode}…</h3><p class="small qtime">0:00</p><p class="small">Para probar solo, abre otra pestaña y busca partida también.</p>`;
    const cancel = el('button', '', 'Cancelar');
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
    wrap.append(el('div', 'draft-head', `<h2>${ban ? 'Fase de veto' : 'Elige tu equipo'}</h2><p>contra <b>${escapeHtml(msg.foe)}</b>${msg.foeElo ? ` (${msg.foeElo})` : ''} · ${ban ? 'Veta 1 Pokémon: nadie podrá usarlo' : 'Elige 3 Pokémon'}</p><div class="dtimer"></div>`));
    const grid = el('div', 'pool scroll');
    const chosen = [];
    const confirm = el('button', 'primary', ban ? 'Vetar' : 'Confirmar equipo');
    confirm.disabled = true;
    for (const dex of msg.pool) {
      const banned = msg.bans.includes(dex);
      const c = el('button', 'pool-card' + (banned ? ' banned' : ''));
      c.append(portrait(dex, 64));
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
      confirm.textContent = 'Esperando al rival…';
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
    wrap.append(this.topbar('Práctica contra la IA', 'menu'));
    const chosen = [];
    let skill = 0.28;
    const grid = el('div', 'pool scroll');
    const start = el('button', 'primary', 'Empezar');
    start.disabled = true;
    for (const dex of RANKED_POOL) {
      const c = el('button', 'pool-card');
      c.append(portrait(dex, 64));
      c.append(el('b', '', SPECIES[dex].name), el('div', 'types', typeChips(dex)));
      c.title = SPECIES[dex].moves.map(k => MOVES[k].name).join(' · ');
      c.dataset.dex = dex;
      c.onclick = () => {
        const i = chosen.indexOf(dex);
        if (i >= 0) chosen.splice(i, 1); else { if (chosen.length >= 3) chosen.shift(); chosen.push(dex); }
        grid.querySelectorAll('.pool-card').forEach(x => x.classList.toggle('sel', chosen.includes(+x.dataset.dex)));
        start.disabled = !chosen.length;
        start.textContent = chosen.length ? `Empezar (${chosen.length} Pokémon)` : 'Empezar';
      };
      grid.append(c);
    }
    const diff = el('div', 'diff');
    diff.append(el('span', '', 'Dificultad:'));
    for (const [name, v] of DIFFICULTIES) {
      const b = el('button', v === skill ? 'sel' : '', name);
      b.onclick = () => { skill = v; diff.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); };
      diff.append(b);
    }
    start.onclick = () => {
      this.lastMode = { kind: 'practice', dexes: [...chosen], skill };
      this.net.send({ t: 'practice', dexes: chosen, skill });
    };
    wrap.append(el('p', 'intro', 'Elige hasta 3 Pokémon (nivel 50). El bot lleva el mismo número.'), grid, diff, start);
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
    const title = msg.captured ? '¡Capturado!' : draw ? 'Empate' : won ? '¡Victoria!' : 'Derrota';
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
      c.append(animatedPortrait(msg.captured.dex, 140, 'Idle', !!msg.captured.shiny));
      c.append(el('p', '', `¡Has atrapado a <b>${SPECIES[msg.captured.dex].name}</b>${msg.captured.shiny ? ' <i class="shiny-star">✦ ¡SHINY!</i>' : ''} (Nv.${msg.captured.level})!${r.captured && !r.captured.inTeam ? '<br><small>Tu equipo está lleno: lo encontrarás en Equipo.</small>' : ''}`));
      box.append(c);
    }
    if (r.badge) {
      const ln = Data.leadersOf(r.badge.region || 'kanto')[r.badge.index];
      box.append(el('div', 'badge-won', `<i class="badge got big" style="--tc:${TYPE_COLOR[ln.type]}"></i><p>¡Has vencido a <b>${r.badge.leader}</b>!${r.badge.kind === 'gym' ? ` ${r.badge.name} conseguida.` : r.badge.kind === 'champion' ? ' ¡Eres el nuevo Campeón!' : ''}</p>`));
    }
    if (r.items) box.append(el('p', 'reward-items', 'Premio: ' + Object.entries(r.items).map(([k, n]) => `${(SHOP.find(i => i.id === k) || { name: k }).name} ×${n}`).join(' · ')));
    if (r.coins) box.append(el('p', 'reward', `+${coins(r.coins)}`));
    if (r.cap && r.xp && r.xp.some(x => x.capped)) box.append(el('p', 'small', `Tope de nivel ${r.cap}: vence al siguiente gimnasio para que sigan subiendo.`));
    if (r.xp && r.xp.length) {
      const list = el('div', 'xp-list');
      for (const x of r.xp) {
        const row = el('div', 'xp-row');
        const pm = this.profile && this.profile.mons.find(m => m.uid === x.uid);
        row.append(portrait(x.dex, 48, { shiny: !!(pm && pm.shiny) }));
        const lvl = x.level > x.fromLevel ? `Nv.${x.fromLevel} → <span class="lvup">Nv.${x.level} ¡sube de nivel!</span>` : `Nv.${x.level}`;
        const learned = (x.learned || []).map(k => MOVES[k].name);
        row.append(el('div', '', `<b>${SPECIES[x.from].name}</b> ${x.capped && !x.xp ? '<span class="cap">en el tope de nivel</span>' : `+${x.xp} EXP`} · ${lvl}${x.evolved ? `<br><span class="evo">¡Ha evolucionado a ${SPECIES[x.evolved].name}!</span>` : ''}${learned.length ? `<br><span class="lvup">Nuevo movimiento: ${learned.join(', ')}</span> <small>(elígelo en Equipo)</small>` : ''}${x.ev && Object.keys(x.ev).length ? ` <small class="evgain">EV ${Object.entries(x.ev).map(([k, v]) => `+${v} ${Data.VIT_STATS[k]}`).join(', ')}</small>` : ''}`));
        list.append(row);
      }
      box.append(list);
    }
    if (r.tower) this.towerResults(box, r);
    if (r.elo !== undefined) box.append(el('p', 'reward', `ELO ${r.elo >= 0 ? '+' : ''}${r.elo} → <b>${r.total}</b>`));
    if (r.promoted) box.append(el('div', 'promoted', `<i class="sw frame-${Data.RANKED_REWARDS[r.promoted].frame}"></i><p>¡Has subido a <b>${r.promoted}</b>! Reclama tu premio en Clasificatoria.</p>`));
    if (r.firstWin) box.append(el('p', 'small', `Incluye ${coins(Data.RANKED_PAY.firstWin)} extra por la primera victoria del día.`));
    if (!won && !draw && battle && battle.mode === 'wild') box.append(el('p', 'small', 'Tus Pokémon se recuperan después de cada combate. ¡Inténtalo otra vez!'));
    const acts = el('div', 'acts');
    const back = el('button', 'primary', 'Continuar');
    const lm = this.lastMode;
    back.onclick = () => this.show(lm && lm.kind === 'story' ? 'story' : lm === 'ranked' ? 'online' : lm && lm.kind === 'practice' ? 'practice' : lm && lm.kind === 'tower' ? 'tower' : 'menu');
    acts.append(back);
    if (lm && (lm.kind === 'practice' || (lm.kind === 'story' && lm.a === 'route'))) {
      const again = el('button', '', lm.kind === 'practice' ? 'Otra vez' : 'Seguir explorando');
      again.onclick = () => lm.kind === 'practice' ? this.net.send({ t: 'practice', dexes: lm.dexes, skill: lm.skill }) : this.startStory(lm.a, lm.id);
      acts.append(again);
    }
    if (lm && lm.kind === 'tower' && r.tower && !r.tower.ended) {
      const next = el('button', '', `Combate ${r.tower.streak + 1}`);
      next.onclick = () => this.towerBattle();
      acts.append(next);
    }
    if (lm === 'ranked' || lm === 'casual') {
      const again = el('button', '', 'Buscar otra');
      again.onclick = () => this.net.send({ t: 'queue', mode: lm });
      acts.append(again);
    }
    box.append(acts);
    this.root.append(box);
  }
}

Object.assign(UI.prototype, towerViews, accountViews);
