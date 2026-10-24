// Pantallas fuera de combate: inicio, menú, historia (inicial, mapa, equipo, tienda),
// clasificatoria (cola, draft, ranking), práctica y resultados.
import { portrait, animatedPortrait } from './sprites.js';
import { escapeHtml, describeMove } from './battle.js';
import { Net } from './net.js';

const { SPECIES, MOVES, TYPE_LABEL, TYPE_COLOR, ROUTES, GYMS, SHOP, STARTERS, RANKED_POOL, xpToNext, LEAGUES } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const typeChips = dex => SPECIES[dex].types.map(t => `<span class="type" style="--tc:${TYPE_COLOR[t]}">${TYPE_LABEL[t]}</span>`).join('');
const coins = n => `<span class="coin">₽</span>${n.toLocaleString('es-ES')}`;
// Orden del recorrido por el mapa (rutas y gimnasios intercalados)
const PATH = ['ruta1', 'bosque', 'plateada', 'montemoon', 'celeste', 'ruta24', 'carmin', 'tunelroca', 'azulona', 'torre', 'fucsia', 'safari', 'azafran', 'islas', 'canela', 'verde', 'victoria', 'lorelei', 'bruno', 'agatha', 'lance', 'campeon'];
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

  setProfile(p, board) {
    const first = !this.profile;
    this.profile = p;
    this.board = board || this.board;
    if (first) this.show('menu');
    else if (['menu', 'story', 'team', 'shop', 'online'].includes(this.view)) this.show(this.view, true);
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

  hide() { this.root.hidden = true; this.root.innerHTML = ''; }

  topbar(title, back) {
    const p = this.profile;
    const bar = el('div', 'topbar');
    if (back) { const b = el('button', 'back', '← Volver'); b.onclick = () => this.show(back); bar.append(b); }
    bar.append(el('h2', '', title));
    bar.append(el('div', 'stats', `<span class="pill">${coins(p.coins)}</span><span class="badges">${GYMS.slice(0, 8).map((g, i) => `<i class="badge${i < p.badges ? ' got' : ''}" style="--tc:${TYPE_COLOR[g.type]}" title="${g.leader}"></i>`).join('')}</span><span class="elo">${p.league} · ${p.elo}</span>`));
    return bar;
  }

  // ---------- Inicio ----------
  view_title() {
    const box = el('div', 'panel title-panel');
    box.innerHTML = `<div class="emblem"></div><h1 class="logo">Arena<br><span>Pokémon</span></h1><p class="tag">Combates Pokémon en tiempo real · 966 Pokémon de 9 generaciones</p>`;
    const mons = el('div', 'title-mons');
    const pool = [...STARTERS].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const d of pool) mons.append(animatedPortrait(d, 96, 'Idle'));
    box.append(mons);
    const input = el('input');
    input.placeholder = 'Tu nombre de entrenador';
    input.maxLength = 16;
    input.value = Net.savedName();
    const go = el('button', 'primary', 'Jugar');
    const start = () => { const name = input.value.trim() || 'Entrenador'; go.disabled = true; go.textContent = 'Conectando…'; this.app.connect(name); };
    go.onclick = start;
    input.onkeydown = e => { if (e.key === 'Enter') start(); };
    box.append(input, go, el('p', 'small', 'Tu partida se guarda en este navegador.'));
    this.root.append(box);
    setTimeout(() => input.focus(), 50);
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
    const lead = p.mons.length ? p.mons.find(m => m.uid === p.team[0]) : null;
    card('Historia', p.mons.length ? `${p.badges >= 13 ? '¡Campeón de Kanto!' : p.badges >= 8 ? 'La Liga Pokémon te espera' : `Medallas: ${p.badges}/8`} · ${p.mons.length} Pokémon` : 'Elige tu primer Pokémon y conquista Kanto', 'story', lead ? lead.dex : 25, () => this.show('story'));
    card('Clasificatoria', `${p.league} · ${p.elo} ELO · ${p.wins}V ${p.losses}D`, 'ranked', 149, () => this.show('online'));
    card('Partida rápida', 'Online sin ELO: elige 3 y a combatir', 'casual', 6, () => { this.lastMode = 'casual'; this.net.send({ t: 'queue', mode: 'casual' }); });
    card('Práctica', 'Contra la IA, con la dificultad que quieras', 'practice', 68, () => this.show('practice'));
    top.append(grid, this.profilePanel(lead));
    wrap.append(top, this.howTo());
    this.root.append(wrap);
  }

  profilePanel(lead) {
    const p = this.profile;
    const total = Object.keys(SPECIES).length;
    const box = el('div', 'panel profile');
    const who = el('div', 'who');
    const ava = el('div', 'ava');
    if (lead) ava.append(animatedPortrait(lead.dex, 84, 'Idle'));
    who.append(ava, el('div', '', `<b>${escapeHtml(p.name)}</b><span class="elo">${p.league} · ${p.elo}</span>`));
    box.append(who);
    box.append(el('div', 'rows', `
      <div class="stat"><small>Dinero</small><b>${coins(p.coins)}</b></div>
      <div class="stat"><small>Medallas</small><b>${Math.min(8, p.badges)}/8</b></div>
      <div class="stat"><small>Pokémon</small><b>${p.mons.length}</b></div>
      <div class="stat"><small>Clasificatoria</small><b>${p.wins}V ${p.losses}D</b></div>`));
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
    if (!p.mons.length) return this.view_starter();
    const wrap = el('div', 'story');
    const bar = this.topbar('Kanto', 'menu');
    const tools = el('div', 'tools');
    const team = el('button', '', 'Equipo'); team.onclick = () => this.show('team');
    const shop = el('button', '', 'Tienda'); shop.onclick = () => this.show('shop');
    tools.append(team, shop);
    bar.append(tools);
    wrap.append(bar);
    const body = el('div', 'story-body');
    const map = el('div', 'map');
    map.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="land"><defs><radialGradient id="landGrad" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#8fd06a"/><stop offset=".7" stop-color="#5fa848"/><stop offset="1" stop-color="#4a8a3a"/></radialGradient></defs><path d="M4,20 Q2,6 20,4 L60,3 Q78,2 90,10 Q99,20 96,40 Q98,60 90,78 Q84,96 60,97 L30,98 Q8,98 4,80 Q0,60 6,46 Z" /></svg>`;
    const nodes = PATH.map(id => ROUTES.find(r => r.id === id) || GYMS.find(g => g.id === id));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('paths');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', nodes.map(n => `${n.x},${n.y}`).join(' '));
    svg.append(line);
    map.append(svg);
    const info = el('div', 'node-info');
    nodes.forEach(n => {
      const isGym = !!n.leader;
      const gi = isGym ? GYMS.indexOf(n) : -1;
      const unlocked = isGym ? gi <= p.badges : n.req <= p.badges;
      const done = isGym && gi < p.badges;
      const b = el('button', `node ${isGym ? 'gym' : 'route'}${unlocked ? '' : ' locked'}${done ? ' done' : ''}${isGym && gi === p.badges ? ' next' : ''}`);
      b.style.left = n.x + '%'; b.style.top = n.y + '%';
      if (isGym) b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = isGym ? `${n.name} · ${n.leader}` : n.name;
      b.innerHTML = `<span>${isGym ? (n.elite ? '★' : gi + 1) : ''}</span><label>${isGym ? n.leader : n.name}</label>`;
      if (!isGym && unlocked) b.prepend(portrait(Data.routeWild(n).list[0].dex, 34));
      b.onclick = () => { map.querySelectorAll('.node').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); this.nodeInfo(info, n, unlocked, done); };
      map.append(b);
    });
    body.append(map, info);
    wrap.append(body);
    this.root.append(wrap);
    // Seleccionar el siguiente objetivo
    const next = map.querySelector('.node.next') || map.querySelector('.node.route:not(.locked)');
    if (next) next.click();
  }

  nodeInfo(box, n, unlocked, done) {
    box.innerHTML = '';
    const p = this.profile;
    if (n.leader) {
      box.append(el('h3', '', `${n.name}`), el('p', 'leader', `Líder: <b>${n.leader}</b> · tipo <span class="type" style="--tc:${TYPE_COLOR[n.type]}">${TYPE_LABEL[n.type]}</span>`));
      const team = el('div', 'mini-team');
      for (const [dex, lvl] of n.team) { const c = el('div', 'mini'); c.append(portrait(dex, 56)); c.append(el('small', '', `${SPECIES[dex].name}<br>Nv.${lvl}`)); team.append(c); }
      box.append(team);
      box.append(el('p', 'small', `Dificultad de la IA: ${Math.round(n.ai * 100)} % · Premio ${coins(n.reward)}${n.elite ? '' : ' y medalla'}`));
      if (!unlocked) box.append(el('p', 'warn', GYMS.indexOf(n) >= 8 ? 'Consigue las 8 medallas y vence a los anteriores.' : 'Vence antes al gimnasio anterior.'));
      else {
        const go = el('button', 'primary', done ? 'Revancha' : '¡Desafiar!');
        go.onclick = () => this.startStory('gym', n.id);
        box.append(go);
      }
    } else {
      const w = Data.routeWild(n);
      box.append(el('h3', '', n.name), el('p', 'small', `Hoy pueden salir (cambian cada día) · Nv.${n.lvl[0]}-${n.lvl[1]} · ${n.types.map(t => TYPE_LABEL[t]).join(', ')}`));
      const list = el('div', 'mini-team');
      const total = w.list.reduce((a, x) => a + x.weight, 0) / (1 - w.rare.chance);
      for (const { dex, weight } of w.list) {
        const c = el('div', 'mini' + (p.caught.includes(dex) ? ' caught' : ''));
        c.append(portrait(dex, 56));
        c.append(el('small', '', `${SPECIES[dex].name}<br>${Math.round(weight / total * 100)} %`));
        c.title = `${SPECIES[dex].name} · ${SPECIES[dex].types.map(t => TYPE_LABEL[t]).join('/')} · Gen ${SPECIES[dex].gen}`;
        list.append(c);
      }
      // El misterioso: silueta hasta que lo atrapas
      const known = p.caught.includes(w.rare.dex);
      const rare = el('div', 'mini rare' + (known ? ' caught' : ''));
      rare.append(portrait(w.rare.dex, 56, { silhouette: !known }));
      rare.append(el('small', '', `${known ? SPECIES[w.rare.dex].name : '???'}<br>${+(w.rare.chance * 100).toFixed(1)} % · Nv.${n.lvl[1] + 3}`));
      rare.title = 'Pokémon misterioso: aparece muy de vez en cuando y cuesta mucho atraparlo';
      list.append(rare);
      box.append(list);
      const balls = (p.items.pokeball || 0) + (p.items.superball || 0) + (p.items.ultraball || 0);
      box.append(el('p', 'small', `Debilítalo para ganar experiencia, o bájale los PS y lánzale una Poké Ball (<kbd>F</kbd>) para capturarlo. Tienes ${balls} Balls.`));
      if (!unlocked) box.append(el('p', 'warn', `Necesitas ${n.req} medallas.`));
      else {
        const go = el('button', 'primary', 'Explorar');
        go.onclick = () => this.startStory('route', n.id);
        box.append(go);
      }
    }
    // Equipo actual
    box.append(el('h4', '', 'Tu equipo'));
    const team = el('div', 'mini-team');
    for (const uid of p.team) { const m = p.mons.find(x => x.uid === uid); if (!m) continue; const c = el('div', 'mini'); c.append(portrait(m.dex, 48)); c.append(el('small', '', `${SPECIES[m.dex].name}<br>Nv.${m.level}`)); team.append(c); }
    box.append(team);
  }

  startStory(a, id) {
    this.lastMode = { kind: 'story', a, id };
    this.net.send({ t: 'story', a, id });
  }

  view_starter() {
    const wrap = el('div', 'starter');
    wrap.append(this.topbar('Elige tu primer Pokémon', 'menu'));
    wrap.append(el('p', 'intro', 'Elige a tu compañero entre los iniciales de las 9 generaciones. Te acompañará por todo Kanto.'));
    const tabs = el('div', 'gen-tabs');
    const row = el('div', 'starter-row');
    const gens = [...new Set(STARTERS.map(d => SPECIES[d].gen))];
    const showGen = g => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.gen === g));
      row.innerHTML = '';
      for (const dex of STARTERS.filter(d => SPECIES[d].gen === g)) {
        const c = el('button', 'starter-card');
        c.style.setProperty('--tc', TYPE_COLOR[SPECIES[dex].types[0]]);
        c.append(animatedPortrait(dex, 150, 'Idle'));
        c.append(el('b', '', SPECIES[dex].name));
        c.append(el('div', 'types', typeChips(dex)));
        c.append(el('small', '', SPECIES[dex].moves.map(k => MOVES[k].name).join(' · ')));
        c.onclick = () => this.net.send({ t: 'story', a: 'starter', dex });
        row.append(c);
      }
    };
    for (const g of gens) {
      const b = el('button', '', `Gen ${g}`);
      b.dataset.gen = g;
      b.onclick = () => showGen(g);
      tabs.append(b);
    }
    wrap.append(tabs, row);
    this.root.append(wrap);
    showGen(gens[0]);
  }

  // ---------- Equipo ----------
  view_team() {
    const p = this.profile;
    const wrap = el('div', 'teamview');
    wrap.append(this.topbar('Equipo', 'story'));
    wrap.append(el('p', 'intro', 'Mete o saca Pokémon del equipo (máximo 3) con el botón de su ficha. Los objetos también se usan desde ahí.'));
    const grid = el('div', 'mon-grid scroll');
    const sorted = [...p.mons].sort((a, b) => (p.team.includes(b.uid) - p.team.includes(a.uid)) || b.level - a.level);
    for (const m of sorted) {
      const inTeam = p.team.includes(m.uid);
      const card = el('div', 'mon-card' + (inTeam ? ' in' : ''));
      card.append(portrait(m.dex, 72));
      const need = xpToNext(m.level);
      card.append(el('div', 'mi', `<b>${SPECIES[m.dex].name}</b> <small>Nv.${m.level}</small><div class="types">${typeChips(m.dex)}</div><div class="xp"><div style="width:${Math.min(100, m.xp / need * 100)}%"></div></div><small class="moves">${SPECIES[m.dex].moves.map(k => MOVES[k].name).join(' · ')}</small>`));
      const acts = el('div', 'acts');
      const toggle = el('button', inTeam ? 'on' : '', inTeam ? 'En el equipo' : 'Al equipo');
      toggle.onclick = () => {
        let team = p.team.filter(u => u !== m.uid);
        if (!inTeam) { if (p.team.length >= 3) return this.toast('El equipo ya tiene 3 Pokémon: saca uno antes', 'bad'); team = [...p.team, m.uid]; }
        if (!team.length) return this.toast('El equipo necesita al menos un Pokémon', 'bad');
        this.net.send({ t: 'story', a: 'team', uids: team });
      };
      acts.append(toggle);
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
      if (p.mons.length > 1) {
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

  // ---------- Tienda ----------
  view_shop() {
    const p = this.profile;
    const wrap = el('div', 'shop');
    wrap.append(this.topbar('Tienda', 'story'));
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
        b.onclick = () => this.net.send({ t: 'story', a: 'buy', id: item.id, qty });
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
    const board = el('div', 'panel board');
    board.innerHTML = `<h3>Mejores entrenadores</h3>` + (this.board.length ? `<ol>${this.board.map(b => `<li><b>${escapeHtml(b.name)}</b><span>${b.elo}</span><small>${b.wins}V ${b.losses}D</small></li>`).join('')}</ol>` : '<p class="small">Todavía nadie ha jugado una clasificatoria.</p>');
    body.append(me, board);
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
      c.append(animatedPortrait(msg.captured.dex, 140, 'Idle'));
      c.append(el('p', '', `¡Has atrapado a <b>${SPECIES[msg.captured.dex].name}</b> (Nv.${msg.captured.level})!${r.captured && !r.captured.inTeam ? '<br><small>Tu equipo está lleno: lo encontrarás en Equipo.</small>' : ''}`));
      box.append(c);
    }
    if (r.badge) box.append(el('div', 'badge-won', `<i class="badge got big" style="--tc:${TYPE_COLOR[GYMS[r.badge.index].type]}"></i><p>¡Has vencido a <b>${r.badge.leader}</b>!${r.badge.index < 8 ? ' Medalla conseguida.' : ''}</p>`));
    if (r.coins) box.append(el('p', 'reward', `+${coins(r.coins)}`));
    if (r.xp && r.xp.length) {
      const list = el('div', 'xp-list');
      for (const x of r.xp) {
        const row = el('div', 'xp-row');
        row.append(portrait(x.dex, 48));
        const lvl = x.level > x.fromLevel ? `Nv.${x.fromLevel} → <span class="lvup">Nv.${x.level} ¡sube de nivel!</span>` : `Nv.${x.level}`;
        row.append(el('div', '', `<b>${SPECIES[x.from].name}</b> +${x.xp} EXP · ${lvl}${x.evolved ? `<br><span class="evo">¡Ha evolucionado a ${SPECIES[x.evolved].name}!</span>` : ''}`));
        list.append(row);
      }
      box.append(list);
    }
    if (r.elo !== undefined) box.append(el('p', 'reward', `ELO ${r.elo >= 0 ? '+' : ''}${r.elo} → <b>${r.total}</b>`));
    if (!won && !draw && battle && battle.mode === 'wild') box.append(el('p', 'small', 'Tus Pokémon se recuperan después de cada combate. ¡Inténtalo otra vez!'));
    const acts = el('div', 'acts');
    const back = el('button', 'primary', 'Continuar');
    const lm = this.lastMode;
    back.onclick = () => this.show(lm && lm.kind === 'story' ? 'story' : lm === 'ranked' ? 'online' : lm && lm.kind === 'practice' ? 'practice' : 'menu');
    acts.append(back);
    if (lm && (lm.kind === 'practice' || (lm.kind === 'story' && lm.a === 'route'))) {
      const again = el('button', '', lm.kind === 'practice' ? 'Otra vez' : 'Seguir explorando');
      again.onclick = () => lm.kind === 'practice' ? this.net.send({ t: 'practice', dexes: lm.dexes, skill: lm.skill }) : this.startStory(lm.a, lm.id);
      acts.append(again);
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
