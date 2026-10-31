// Torre Batalla (elegir equipo, progreso de la racha, siguiente rival en silueta) y Ladder
// (tablas de clasificatoria, Torre y Pokédex con buscador, y ficha pública de cada entrenador).
// Se añaden como métodos de UI (ver ui.js).
import { portrait, monIcon, animatedPortrait, typeTint, trainerImg } from './sprites.js';
import { escapeHtml, monLabel, tagName } from './battle.js';
import { el, typeChips, coins, lv, ICON } from './ui.js';
import { showcaseHtml } from './achievements.js';
import { t, tServer, locale } from './i18n.js';
import { prizeHtml } from './missions.js';
import { confirmBox } from './dialog.js';
import { icon, badgeImg } from './pixicons.js';

const { SPECIES, RANKED_POOL, REGIONS, LEAGUES } = Data;
const { level: LEVEL, block: BLOCK, brainEvery: BRAIN_EVERY } = Data.TOWER;
const BOARDS = [
  ['ranked', 'Clasificatoria', 'ELO'],
  ['tower', 'Torre Batalla', 'Mejor racha'],
  ['dex', 'Pokédex', 'Especies'],
];
const symbolName = s => t(s);
const leagueOf = elo => LEAGUES.filter(l => elo >= l[0]).pop()[1];
const pct = v => Math.round(v * 100) + ' %';

export const towerViews = {
  // ---------- Torre Batalla ----------
  view_tower() {
    const tw = this.profile.tower;
    const wrap = el('div', 'tower');
    const bar = this.topbar(t('Torre Batalla'), 'menu');
    // En el móvil, la racha, tu récord, la guía y los premios van en la cabecera (a la derecha le sobra sitio)
    bar.querySelector('.tb-ctx').append(this.towerChips(tw));
    wrap.append(bar);
    const body = el('div', 'tower-body');
    body.append(tw.team ? this.towerProgress(tw) : this.towerPicker(), this.towerSide(tw));
    wrap.append(body);
    this.root.append(wrap);
    this.net.send({ t: 'ladder', board: 'tower' });
  },

  // Lo de la Torre en pequeño para la cabecera en el móvil (tb-mobile: solo en pantallas bajas)
  towerChips(tw) {
    const box = el('div', 'tb-mobile tower-chips');
    if (tw.team) box.append(el('span', 'tw-chip streak', `<b>${tw.streak}</b><small>${t('Racha')}</small>`));
    box.append(el('span', 'tw-chip', `<b>${tw.best}</b><small>${t('Tu récord')}</small>`));
    const help = el('button', 'tb-btn icon', ICON.help);
    help.title = t('Cómo se juega');
    help.setAttribute('aria-label', help.title);
    help.onclick = () => this.towerGuide();
    const prizes = el('button', 'tb-btn icon', icon('trophy', 18));
    prizes.title = t('Premios');
    prizes.setAttribute('aria-label', prizes.title);
    prizes.onclick = () => this.towerRewards();
    box.append(help, prizes);
    return box;
  },

  // Sin racha en curso: elegir 3 (tuyos o de alquiler)
  towerPicker() {
    const p = this.profile;
    const box = el('div', 'panel tower-main');
    const intro = el('p', 'small tower-intro', t('3 Pokémon, <b>todos a Nv.{n}</b>. Los tuyos (de cualquier región, sin legendarios) llevan sus IV, EV, naturaleza, shiny y movimientos; los de alquiler, los de su especie sin extras. Durante la racha no se cambian los Pokémon, solo su orden.', { n: LEVEL }));
    box.append(el('h3', '', t('Elige tu equipo')), intro);
    const chosen = (this.towerPick || []).filter(e => e.uid ? p.mons.some(m => m.uid === e.uid) : RANKED_POOL.includes(e.dex));
    this.towerPick = chosen;
    const dexOf = e => e.uid ? p.mons.find(m => m.uid === e.uid).dex : e.dex;
    const same = (a, b) => a.uid ? a.uid === b.uid : !b.uid && a.dex === b.dex;
    const slots = el('div', 'tower-slots');
    const go = el('button', 'primary', t('Empezar desafío'));
    // En el móvil, los huecos van en una fila que se queda arriba al bajar por la lista, con su propio botón de
    // empezar (el de abajo quedaba lejísimos)
    const go2 = el('button', 'primary tslot-go', t('Empezar desafío'));
    const refresh = () => {
      slots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const e = chosen[i];
        const s = el('div', 'tslot' + (e ? ' full' : ''));
        if (e) {
          const m = e.uid && p.mons.find(x => x.uid === e.uid);
          s.append(portrait(dexOf(e), 56, { shiny: Data.looksShiny(m) }), el('small', '', `${m ? monLabel(m) : SPECIES[dexOf(e)].name}<br>${e.uid ? t('tuyo') : t('alquiler')}`));
          s.title = t('Quitar');
          s.onclick = () => { chosen.splice(i, 1); refresh(); };
        } else s.append(el('small', '', t('Hueco {n}', { n: i + 1 })));
        slots.append(s);
      }
      slots.append(go2);
      box.querySelectorAll('.pool-card').forEach(c => {
        const e = JSON.parse(c.dataset.e);
        c.classList.toggle('sel', chosen.some(x => same(x, e)));
      });
      go.disabled = go2.disabled = chosen.length !== 3;
    };
    const toggle = e => {
      const i = chosen.findIndex(x => same(x, e));
      if (i >= 0) chosen.splice(i, 1);
      else if (chosen.some(x => dexOf(x) === dexOf(e))) return this.toast(t('No se puede repetir especie'), 'bad');
      else if (chosen.length >= 3) return this.toast(t('Ya llevas 3: quita uno antes'), 'bad');
      else chosen.push(e);
      refresh();
    };
    const card = (e, sub, shiny) => {
      const dex = dexOf(e);
      const c = typeTint(el('button', 'pool-card'), dex);
      c.dataset.e = JSON.stringify(e);
      c.append(portrait(dex, 56, { shiny }), el('b', '', SPECIES[dex].name + (shiny ? ' ✦' : '')), el('div', 'types', typeChips(dex)), el('small', 'small', sub));
      c.title = t('Total de stats base {n}', { n: SPECIES[dex].bst });
      c.onclick = () => toggle(e);
      return c;
    };
    const own = p.mons.filter(m => !SPECIES[m.dex].leg).sort((a, b) => SPECIES[b.dex].bst - SPECIES[a.dex].bst || b.level - a.level);
    box.append(slots);
    const scroll = el('div', 'tower-pools scroll');
    scroll.append(el('h4', '', `${t('Tus Pokémon')} <small>(${own.length})</small>`));
    if (own.length) {
      const grid = el('div', 'pool');
      for (const m of own) grid.append(card({ uid: m.uid }, `${lv(m.level)} → ${LEVEL} · ${REGIONS[m.region || 'kanto'].name}`, !!m.shiny));
      scroll.append(grid);
    } else scroll.append(el('p', 'small', t('Aún no tienes Pokémon que puedan entrar: usa los de alquiler o captura en Historia.')));
    if (p.mons.some(m => SPECIES[m.dex].leg)) scroll.append(el('p', 'small', t('Tus legendarios y singulares no pueden entrar.')));
    scroll.append(el('h4', '', t('De alquiler')));
    const rent = el('div', 'pool');
    for (const dex of RANKED_POOL) rent.append(card({ dex }, `${lv(LEVEL)} · ${t('alquiler')}`, false));
    scroll.append(rent);
    box.append(scroll);
    go.onclick = go2.onclick = () => this.net.send({ t: 'tower', a: 'start', team: chosen });
    box.append(go);
    setTimeout(refresh, 0);
    return box;
  },

  // Racha en curso: progreso, siguiente rival en silueta, orden del equipo y retirarse
  towerProgress(tw) {
    const p = this.profile;
    const box = el('div', 'panel tower-main progress');
    const head = el('div', 'tower-head');
    head.append(el('div', 'streak', `<small>${t('Racha')}</small><b>${tw.streak}</b>`));
    // Un punto por combate del bloque; el del Cerebro, marcado
    const brainAt = tw.n + tw.toBrain;
    const dots = Array.from({ length: BLOCK }, (_, i) => {
      const n = tw.n - tw.inBlock + 1 + i;
      return `<i class="${i < tw.inBlock - 1 ? 'won' : i === tw.inBlock - 1 ? 'now' : ''}${n === brainAt ? ' brain' : ''}" title="${t('Combate {n}', { n })}${n === brainAt ? ': ' + t('Cerebro de la Frontera') : ''}"></i>`;
    }).join('');
    head.append(el('div', 'block', `<b>${t('Bloque {n}', { n: tw.block })}</b> · ${t('combate {n} de {total}', { n: tw.inBlock, total: BLOCK })}<div class="tdots">${dots}</div>
      <small>${tw.next && tw.next.brain ? t('¡Te espera el Cerebro de la Frontera!') : t('Cerebro de la Frontera dentro de {n} combates', { n: tw.toBrain + 1 })}</small>`));
    box.append(head);
    // Siguiente rival
    if (tw.next) {
      const foe = el('div', 'next-foe' + (tw.next.brain ? ' brain' : ''));
      foe.append(el('h4', '', `${t('Siguiente rival: <b>{name}</b>', { name: escapeHtml(tServer(tw.next.name)) })}${tw.next.brain ? ` <span class="brain-tag">${t('Cerebro de la Frontera')}</span>` : ''}`));
      const mons = el('div', 'mini-team');
      for (const dex of tw.next.team) { const c = el('div', 'mini'); c.append(portrait(dex, 64, { silhouette: true })); c.append(el('small', '', '???')); mons.append(c); }
      foe.append(mons, el('p', 'small', t('Habilidad de la IA: {ai} · todos a Nv.{n}', { ai: pct(tw.next.ai), n: LEVEL })));
      box.append(foe);
    }
    // Tu equipo: se puede reordenar (el primero sale al empezar)
    box.append(el('h4', '', `${t('Tu equipo')} <small class="small">· ${t('el primero sale al empezar')}</small>`));
    const team = el('div', 'tower-team');
    tw.team.forEach((e, i) => {
      const m = e.uid && p.mons.find(x => x.uid === e.uid);
      const dex = m ? m.dex : e.dex;
      const c = el('div', 'tcard');
      c.append(el('span', 'slot', String(i + 1)), portrait(dex, 64, { shiny: Data.looksShiny(m) }), el('div', '', `<b>${m ? monLabel(m) : SPECIES[dex].name}${m && m.shiny ? ' ✦' : ''}</b><div class="types">${typeChips(dex)}</div><small class="small">${m ? t('tuyo') : t('alquiler')} · ${lv(LEVEL)}</small>`));
      const move = (d) => {
        const order = [0, 1, 2];
        [order[i], order[i + d]] = [order[i + d], order[i]];
        this.net.send({ t: 'tower', a: 'order', order });
      };
      const acts = el('div', 'acts');
      const up = el('button', '', '↑'), down = el('button', '', '↓');
      up.disabled = i === 0; down.disabled = i === 2;
      up.title = t('Subir'); down.title = t('Bajar');
      up.onclick = () => move(-1); down.onclick = () => move(1);
      acts.append(up, down);
      c.append(acts);
      team.append(c);
    });
    box.append(team);
    const acts = el('div', 'acts tower-acts');
    const retire = el('button', 'danger', t('Retirarse'));
    retire.onclick = () => {
      const msg = !tw.streak ? t('¿Retirarte? Podrás elegir otro equipo.') : tw.streak >= tw.best ? t('¿Retirarte? Tu racha de {n} queda guardada como tu récord y podrás empezar otra con otro equipo.', { n: tw.streak }) : t('¿Retirarte? Tu racha de {n} queda guardada y podrás empezar otra con otro equipo.', { n: tw.streak });
      confirmBox({ title: t('Retirarse'), text: msg, ok: t('Retirarse'), danger: true }).then(yes => yes && this.net.send({ t: 'tower', a: 'retire' }));
    };
    const fight = el('button', 'primary', tw.streak ? t('Combate {n}', { n: tw.n }) : t('¡Primer combate!'));
    fight.onclick = () => this.towerBattle();
    acts.append(retire, fight);
    box.append(acts);
    return box;
  },

  towerBattle() {
    this.lastMode = { kind: 'tower' };
    this.net.send({ t: 'tower', a: 'battle' });
  },

  // Columna lateral: tu récord y la tabla de la Torre
  towerSide(tw) {
    const side = el('div', 'tower-side');
    const me = el('div', 'panel');
    me.append(el('h3', '', t('Tu récord')), el('div', 'big-elo', String(tw.best)), el('p', 'small', tw.runs === 1 ? t('Mejor racha · {w} victorias en 1 desafío', { w: tw.wins }) : t('Mejor racha · {w} victorias en {n} desafíos', { w: tw.wins, n: tw.runs })));
    if (tw.bestTeam && tw.bestTeam.length) { const row = el('div', 'mini-team'); for (const m of tw.bestTeam) row.append(portrait(m.dex, 44, { shiny: !!m.shiny })); me.append(row); }
    // Símbolos: el tooltip dice cómo se gana cada uno
    const howSym = s => s.includes('Oro') ? t('Vence al Cerebro de la Frontera en el combate {n} o más', { n: BRAIN_EVERY * 2 }) : t('Vence al Cerebro de la Frontera en el combate {n}', { n: BRAIN_EVERY });
    me.append(el('div', 'symbols', ['Símbolo Plata', 'Símbolo Oro'].map(s => `<span class="symbol ${s.includes('Oro') ? 'oro' : 'plata'}${tw.symbols.includes(s) ? ' got' : ''}" title="${symbolName(s)}${tw.symbols.includes(s) ? '' : ' ' + t('(aún no)')}\n${howSym(s)}"></span>`).join('') + `<small class="small">${t('Símbolos de la Frontera')}</small>`));
    const tools = el('div', 'tower-tools');
    const help = el('button', 'tb-btn help', `${ICON.help}<span>${t('Cómo se juega')}</span>`);
    help.onclick = () => this.towerGuide();
    const prizes = el('button', 'tb-btn', `${icon('trophy', 18)}<span>${t('Premios')}</span>`);
    prizes.onclick = () => this.towerRewards();
    tools.append(help, prizes);
    me.append(tools);
    const board = el('div', 'panel board tower-board');
    board.innerHTML = `<h3>${t('Ranking de la Torre')}</h3><p class="small">${t('Cargando…')}</p>`;
    const all = el('button', '', t('Ver la ladder completa'));
    all.onclick = () => { this.ladderBoard = 'tower'; this.openLadder(); };
    side.append(me, board, all);
    return side;
  },

  // Ventana de la Torre con título, secciones y botón de cerrar (guía y premios)
  towerModal(title, body, cls) {
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box ' + cls);
    const close = () => back.remove();
    back.onclick = e => { if (e.target === back) close(); };
    box.append(el('h3', '', title), body);
    const acts = el('div', 'acts');
    const ok = el('button', 'primary', t('Entendido'));
    ok.onclick = close;
    acts.append(ok);
    box.append(acts);
    back.append(box);
    document.body.append(back);
  },

  towerGuide() {
    const sec = (title, items) => `<section><h4>${title}</h4><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></section>`;
    this.towerModal(t('Cómo se juega a la Torre Batalla'), el('div', 'guide-body scroll', [
      sec(t('El desafío'), [
        t('Eliges 3 Pokémon y todos combaten a <b>Nv.{n}</b>: los tuyos (de cualquier región, sin legendarios) o de alquiler.', { n: LEVEL }),
        t('Son combates seguidos contra entrenadores de la IA. Antes de cada uno ves al siguiente rival en silueta.'),
        t('Entre combates puedes cambiar el orden del equipo, pero no los Pokémon.'),
      ]),
      sec(t('La racha'), [
        t('Cada {n} victorias subes de bloque: rivales más fuertes y una IA más lista.', { n: BLOCK }),
        t('Cada {n} combates te espera el <b>Cerebro de la Frontera</b>, con IV perfectos. Vencerlo da un Símbolo de la Frontera.', { n: BRAIN_EVERY }),
        t('Si pierdes, la racha se acaba. Si te retiras, la guardas como récord.'),
      ]),
      sec(t('Premios'), [
        t('Dinero en cada victoria, y Caramelos Raros, vitaminas y gemas al subir de bloque. Los tienes todos en «Premios».'),
        t('La Torre no da experiencia, así que no se salta el tope de nivel de la historia.'),
      ]),
    ].join('')), 'story-guide tower-guide');
  },

  towerRewards() {
    const T = Data.TOWER;
    const gems = n => `<span class="mp gems">${icon('gem', 16)}${n}</span>`;
    const coinsOnly = n => prizeHtml({ coins: n });
    const prize = ({ gems: g, ...items }) => prizeHtml({ gems: g, items });   // premios de Data.TOWER: objetos y gemas
    const row = (title, sub, prize) => `<div class="tr-row"><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="m-prize">${prize}</div></div>`;
    const symbol = s => `<span class="mp"><i class="symbol got ${s}"></i>${t(s === 'oro' ? 'Símbolo Oro' : 'Símbolo Plata')}</span>`;
    this.towerModal(t('Premios de la Torre Batalla'), el('div', 'tr-list scroll', [
      row(t('Cada victoria'), t('Y {n} más en cada bloque', { n: T.coins.perBlock }), coinsOnly(T.coins.base)),
      row(t('Cada {n} victorias', { n: BLOCK }), t('Al subir de bloque, con una vitamina al azar'), prizeHtml({ items: T.blockPrize }) + `<span class="mp">${t('Vitamina')}</span>` + gems(Data.GEMS.towerBlock)),
      row(t('Cerebro de la Frontera'), t('Cada {n} combates, además de lo de su victoria', { n: BRAIN_EVERY }), coinsOnly(T.coins.brain) + prize(T.brainAgain)),
      row(t('Primera vez en el combate {n}', { n: BRAIN_EVERY }), t('En vez del premio normal del Cerebro'), symbol('plata') + prize(T.symbolPrize)),
      row(t('Primera vez en el combate {n} o más', { n: BRAIN_EVERY * 2 }), t('En vez del premio normal del Cerebro'), symbol('oro') + prize(T.symbolPrize)),
    ].join('')), 'tower-rewards');
  },

  // ---------- Ladder ----------
  openLadder() {
    if (this.view !== 'ladder') this.ladderBack = this.view;
    this.show('ladder');
  },

  view_ladder() {
    const board = this.ladderBoard = this.ladderBoard || 'ranked';
    const wrap = el('div', 'ladder');
    wrap.append(this.topbar(t('Ladder'), this.ladderBack && this.ladderBack !== 'ladder' ? this.ladderBack : 'menu'));
    const bar = el('div', 'subbar ladder-bar');
    const tabs = el('div', 'region-tabs');
    for (const [id, name, what] of BOARDS) {
      const b = el('button', id === board ? 'sel' : '', `<b>${t(name)}</b><small>${t(what)}</small>`);
      b.onclick = () => { this.ladderBoard = id; this.ladderPage = 0; this.show('ladder'); };
      tabs.append(b);
    }
    const search = el('input');
    search.placeholder = t('Buscar entrenador…');
    search.maxLength = 16;
    search.value = this.ladderQ || '';
    let timer = null;
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { this.ladderQ = search.value; this.ladderPage = 0; this.requestLadder(); }, 250); };
    bar.append(tabs, search);
    wrap.append(bar);
    wrap.append(el('div', 'panel ladder-table', `<p class="small">${t('Cargando…')}</p>`));
    this.root.append(wrap);
    this.requestLadder();
  },

  requestLadder() {
    this.net.send({ t: 'ladder', board: this.ladderBoard || 'ranked', page: this.ladderPage || 0, q: this.ladderQ || '' });
  },

  // Respuesta del servidor: va a la ladder o a la tabla lateral de la Torre
  onLadder(msg) {
    if (this.view === 'tower' && msg.board === 'tower') return this.renderTowerBoard(msg);
    if (this.view === 'ladder' && msg.board === this.ladderBoard) this.renderLadder(msg);
  },

  renderTowerBoard(msg) {
    const box = this.root.querySelector('.tower-board');
    if (!box) return;
    box.innerHTML = `<h3>${t('Ranking de la Torre')}</h3>`;
    if (!msg.rows.length) return box.append(el('p', 'small', t('Todavía nadie ha ganado un combate en la Torre. ¡Sé el primero!')));
    box.append(this.podium(msg.rows, r => [r.best, `${t('Mejor racha')}${r.symbols.length ? ' ' + r.symbols.map(s => s.includes('Oro') ? '🥇' : '🥈').join('') : ''}`]));
    const ol = el('ol');
    ol.start = 4;
    for (const r of msg.rows.slice(3, 10)) {
      const li = el('li', 'clickable' + (r.id === this.profile.id ? ' me' : ''), `<b>${this.rowFace(r, 26)}${tagName(r.name, r.tag)}</b><span>${r.best}</span><small>${r.streak ? t('en racha: {n}', { n: r.streak }) : ''}${r.symbols.length ? ' ' + r.symbols.map(s => s.includes('Oro') ? '🥇' : '🥈').join('') : ''}</small>`);
      li.onclick = () => this.userModal(r.id);
      ol.append(li);
    }
    box.append(ol);
    if (msg.me && msg.me.rank > 10) box.append(el('p', 'small', t('Tú: puesto {n} de {total}', { n: msg.me.rank, total: msg.total })));
  },

  renderLadder(msg) {
    const box = this.root.querySelector('.ladder-table');
    if (!box) return;
    box.innerHTML = '';
    const me = this.profile.id;
    const cols = {
      ranked: [['Liga', r => t(leagueOf(r.elo))], ['ELO', r => `<b>${r.elo}</b>`], ['V / D', r => `${r.wins} / ${r.losses}`], ['% vict.', r => r.wins + r.losses ? pct(r.wins / (r.wins + r.losses)) : '—']],
      tower: [['Mejor racha', r => `<b>${r.best}</b>`], ['Racha actual', r => r.streak || '—'], ['Símbolos', r => r.symbols.map(s => `<span class="symbol mini ${s.includes('Oro') ? 'oro' : 'plata'} got" title="${symbolName(s)}"></span>`).join('') || '—'], ['Equipo del récord', r => r.team.map(m => `<span class="tdex" data-dex="${m.dex}" data-shiny="${m.shiny ? 1 : ''}"></span>`).join('')]],
      dex: [['Especies', r => `<b>${r.caught}</b>`], ['Shiny', r => r.shinies || '—'], ['Medallas', r => r.badges]],
    }[msg.board];
    const head = `<tr><th>#</th><th>${t('Entrenador')}</th>${cols.map(c => `<th>${t(c[0])}</th>`).join('')}</tr>`;
    const row = r => `<tr data-id="${r.id}" class="${r.id === me ? 'me' : ''}"><td class="rank r${r.rank}">${r.rank}</td><td class="who"><i class="dot${r.online ? ' on' : ''}" title="${r.online ? t('En línea') : t('Desconectado')}"></i>${this.rowFace(r)}${tagName(r.name, r.tag, r.npc)}${r.id === me ? ` <span class="you">${t('tú')}</span>` : ''}</td>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`;
    const info = el('div', 'ladder-info');
    info.innerHTML = `<span>${msg.total === 1 ? t('1 entrenador') : t('{n} entrenadores', { n: msg.total })}${msg.q ? ` · ${t('{n} con «{q}»', { n: msg.found, q: escapeHtml(msg.q) })}` : ''}</span>` + (msg.me ? `<span class="pill">${t('Tu puesto: <b>#{n}</b>', { n: msg.me.rank })}</span>` : `<span class="small">${this.profile.account ? t('Aún no apareces en esta tabla') : t('Los invitados no salen en los rankings: crea una cuenta en tu perfil y conservas tu partida.')}</span>`);
    box.append(info);
    if (!msg.rows.length) box.append(el('p', 'small', msg.q ? t('Nadie con ese nombre.') : t('Esta tabla todavía está vacía.')));
    else {
      // En la primera página (sin buscar), los 3 primeros en el podio y la tabla desde el 4.º
      const top = msg.page === 0 && !msg.q;
      if (top) box.append(this.podium(msg.rows, {
        ranked: r => [r.elo, `${t(leagueOf(r.elo))} · ${t('{w}V {l}D', { w: r.wins, l: r.losses })}`],
        tower: r => [r.best, t('Mejor racha')],
        dex: r => [r.caught, `${r.shinies ? `✦${r.shinies} · ` : ''}${t('{n} medallas', { n: r.badges })}`],
      }[msg.board]));
      const table = el('table', 'ladder-rows');
      table.innerHTML = `<thead>${head}</thead><tbody>${(top ? msg.rows.slice(3) : msg.rows).map(row).join('')}${msg.me && !msg.rows.some(r => r.id === me) && !msg.q ? `<tr class="gap"><td colspan="${cols.length + 2}">…</td></tr>${row(msg.me)}` : ''}</tbody>`;
      table.querySelectorAll('tr[data-id]').forEach(tr => { tr.onclick = () => this.userModal(tr.dataset.id); });
      table.querySelectorAll('.tdex').forEach(s => s.append(monIcon(+s.dataset.dex, 40, { shiny: !!s.dataset.shiny })));
      const scroll = el('div', 'scroll');
      scroll.append(table);
      box.append(scroll);
    }
    if (msg.pages > 1) {
      const pager = el('div', 'acts pager');
      const prev = el('button', '', t('← Anterior')), next = el('button', '', t('Siguiente →'));
      prev.disabled = msg.page <= 0; next.disabled = msg.page >= msg.pages - 1;
      prev.onclick = () => { this.ladderPage = msg.page - 1; this.requestLadder(); };
      next.onclick = () => { this.ladderPage = msg.page + 1; this.requestLadder(); };
      pager.append(prev, el('span', 'small', t('Página {n} de {total}', { n: msg.page + 1, total: msg.pages })), next);
      box.append(pager);
    }
  },

  // Ficha pública de un entrenador
  userModal(id) {
    this.pendingUser = id;
    this.net.send({ t: 'user', id });
  },

  onUser(msg) {
    const u = msg.u;
    if (!u || u.id !== this.pendingUser) return;
    this.pendingUser = null;
    document.querySelectorAll('.modal.user-modal').forEach(m => m.remove());
    const back = el('div', 'modal user-modal');
    const box = el('div', 'panel modal-box user-card');
    const head = el('div', 'ficha-head');
    // Su avatar con su marco, brillo y efecto (como lo ve él); los de la IA, su Pokémon
    // (los de la IA, el sprite de su clase de entrenador: Joven, Pescador, Montañero…)
    head.append(u.npc ? el('div', 'npc-face', trainerImg(u.npcKey)) : this.avatar(104, true, undefined, undefined, undefined, u));
    const since = u.created ? new Date(u.created).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    head.append(el('div', '', `<h3>${tagName(u.name, u.tag, u.npc)}${u.id === this.profile.id ? ` <span class="you">${t('tú')}</span>` : ''}</h3>
      <p class="small">${u.npc ? t('Entrenador de la IA: te toca en Clasificatoria si nadie aparece en unos segundos') : `<i class="dot${u.online ? ' on' : ''}"></i> ${u.online ? t('En línea') : t('Desconectado')}${since ? ` · ${t('entrenador desde el {date}', { date: since })}` : ''}`}</p>
      ${u.title ? `<span class="title-chip">${escapeHtml(t(u.title))}</span> ` : ''}<span class="elo">${t(leagueOf(u.elo))} · ${u.elo}</span>${u.peakElo > u.elo ? ` <span class="small">${t('máx. {n}', { n: u.peakElo })}</span>` : ''}${showcaseHtml(u.showcase, 40)}`));
    box.append(head);
    // Sus medallas, región a región (en color las conseguidas)
    if (!u.npc) {
      const badges = el('div', 'user-badges');
      for (const r of Data.REGION_IDS) {
        const got = Math.min(8, Data.progOf(u, r)), champ = Data.progOf(u, r) >= Data.leadersOf(r).length;
        const row = el('div', 'ub-row', `<b>${REGIONS[r].name}${champ ? ' <i class="crown">♛</i>' : ''}</b>`);
        for (let i = 0; i < 8; i++) row.insertAdjacentHTML('beforeend', badgeImg(r, i, i < got, 26, 'ub-badge' + (i < got ? ' got' : '')));
        badges.append(row);
      }
      box.append(badges);
    }
    const rank = r => r ? `#${r}` : '—';
    const games = u.wins + u.losses, wr = games ? Math.round(u.wins / games * 100) : null;
    // De la IA solo cuenta la Clasificatoria (no juegan la Torre ni la Historia)
    if (u.npc) box.append(el('div', 'rows user-stats', `
      <div class="stat"><small>${t('Clasificatoria')} ${rank(u.ranks.ranked)}</small><b>${t('{w}V {l}D', { w: u.wins, l: u.losses })}${wr !== null ? ` <small class="small">${wr}%</small>` : ''}</b></div>
      <div class="stat"><small>ELO</small><b>${u.elo}${u.peakElo > u.elo ? ` <small class="small">${t('máx. {n}', { n: u.peakElo })}</small>` : ''}</b></div>`));
    else box.append(el('div', 'rows user-stats', `
      <div class="stat"><small>${t('Clasificatoria')} ${rank(u.ranks.ranked)}</small><b>${t('{w}V {l}D', { w: u.wins, l: u.losses })}${wr !== null ? ` <small class="small">${wr}%</small>` : ''}</b></div>
      <div class="stat"><small>${t('Torre: mejor racha')} ${rank(u.ranks.tower)}</small><b>${u.tower.best}${u.tower.streak ? ` <small class="small">(${t('en racha: {n}', { n: u.tower.streak })})</small>` : ''}</b></div>
      <div class="stat"><small>Pokédex ${rank(u.ranks.dex)}</small><b>${u.caught}${u.shinies ? ` <i class="shiny-star">✦${u.shinies}</i>` : ''}</b></div>
      <div class="stat"><small>${t('Medallas')}</small><b>${u.badges}</b></div>
      <div class="stat"><small>${t('Logros')}</small><b>${u.achievements || 0}</b></div><div class="stat"><small>${t('Pokémon')}</small><b>${u.mons || 0}</b></div>`));

    if (u.team.length) {
      box.append(el('h4', '', u.npc ? t('Su equipo de Clasificatoria') : t('Sus Pokémon de equipo')));
      const row = el('div', 'mini-team');
      for (const m of u.team) { const c = el('div', 'mini'); c.append(portrait(m.dex, 52, { shiny: m.shiny })); c.append(el('small', '', `${monLabel(m)}${m.shiny ? ' ✦' : ''}<br>${lv(m.level)}`)); row.append(c); }
      box.append(row);
    }
    if (u.tower.team.length) {
      box.append(el('h4', '', `${t('Equipo de su récord en la Torre ({n})', { n: u.tower.best })}${u.tower.symbols.length ? ' · ' + u.tower.symbols.map(symbolName).join(', ') : ''}`));
      const row = el('div', 'mini-team');
      for (const m of u.tower.team) { const c = el('div', 'mini'); c.append(portrait(m.dex, 52, { shiny: !!m.shiny })); c.append(el('small', '', `${monLabel(m)}${m.rental ? '<br>' + t('alquiler') : ''}`)); row.append(c); }
      box.append(row);
    }
    const acts = el('div', 'acts');
    const fr = this.friendAction(u);   // Añadir amigo / Solicitud enviada / Amigos
    if (fr) acts.append(fr);
    const close = el('button', 'primary', t('Cerrar'));
    close.onclick = () => back.remove();
    acts.append(close);
    box.append(acts);
    back.append(box);
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.append(back);
  },

  // Bloque de la Torre en la pantalla de resultados
  towerResults(box, r) {
    const tw = r.tower;
    box.append(el('p', 'small', t('Torre Batalla · combate {n} (bloque {b}) contra {foe}', { n: tw.n, b: tw.block, foe: escapeHtml(tServer(tw.foe)) })));
    if (tw.ended) box.append(el('p', 'tower-res lose', t('Racha terminada en <b>{n}</b> · tu récord: {best}', { n: tw.streak, best: tw.best })));
    else {
      box.append(el('p', 'tower-res', `${t('Racha: <b>{n}</b>', { n: tw.streak })}${tw.record ? ` · <span class="lvup">${t('¡nuevo récord!')}</span>` : ''}`));
      if (tw.symbol) box.append(el('div', 'badge-won', `<span class="symbol big ${tw.symbol.includes('Oro') ? 'oro' : 'plata'} got"></span><p>${t('¡Has vencido al Cerebro de la Frontera! <b>{s}</b> conseguido.', { s: symbolName(tw.symbol) })}</p>`));
      if (tw.blockUp) box.append(el('p', 'small', t('¡Bloque completado! Ahora empieza el bloque {n}: rivales más fuertes y más listos.', { n: tw.blockUp })));
    }
  },
};
