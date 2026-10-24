// Torre Batalla (elegir equipo, progreso de la racha, siguiente rival en silueta) y Ladder
// (tablas de clasificatoria, Torre y Pokédex con buscador, y ficha pública de cada entrenador).
// Se añaden como métodos de UI (ver ui.js).
import { portrait, animatedPortrait } from './sprites.js';
import { escapeHtml } from './battle.js';
import { el, typeChips, coins } from './ui.js';

const { SPECIES, RANKED_POOL, REGIONS, LEAGUES } = Data;
const LEVEL = 50, BLOCK = 7;
const BOARDS = [
  ['ranked', 'Clasificatoria', 'ELO'],
  ['tower', 'Torre Batalla', 'Mejor racha'],
  ['dex', 'Pokédex', 'Especies'],
];
const leagueOf = elo => LEAGUES.filter(l => elo >= l[0]).pop()[1];
const pct = v => Math.round(v * 100) + ' %';

export const towerViews = {
  // ---------- Torre Batalla ----------
  view_tower() {
    const t = this.profile.tower;
    const wrap = el('div', 'tower');
    wrap.append(this.topbar('Torre Batalla', 'menu'));
    const body = el('div', 'tower-body');
    body.append(t.team ? this.towerProgress(t) : this.towerPicker(), this.towerSide(t));
    wrap.append(body);
    this.root.append(wrap);
    this.net.send({ t: 'ladder', board: 'tower' });
  },

  // Sin racha en curso: elegir 3 (tuyos o de alquiler)
  towerPicker() {
    const p = this.profile;
    const box = el('div', 'panel tower-main');
    box.append(el('h3', '', 'Elige tu equipo'),
      el('p', 'small', `3 Pokémon, <b>todos a Nv.${LEVEL}</b>. Los tuyos (de cualquier región, sin legendarios) llevan sus IV, EV, naturaleza, shiny y movimientos; los de alquiler, los de su especie sin extras. Durante la racha no se cambian los Pokémon, solo su orden.`));
    const chosen = (this.towerPick || []).filter(e => e.uid ? p.mons.some(m => m.uid === e.uid) : RANKED_POOL.includes(e.dex));
    this.towerPick = chosen;
    const dexOf = e => e.uid ? p.mons.find(m => m.uid === e.uid).dex : e.dex;
    const same = (a, b) => a.uid ? a.uid === b.uid : !b.uid && a.dex === b.dex;
    const slots = el('div', 'tower-slots');
    const go = el('button', 'primary', 'Empezar desafío');
    const refresh = () => {
      slots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const e = chosen[i];
        const s = el('div', 'tslot' + (e ? ' full' : ''));
        if (e) {
          const m = e.uid && p.mons.find(x => x.uid === e.uid);
          s.append(portrait(dexOf(e), 56, { shiny: !!(m && m.shiny) }), el('small', '', `${SPECIES[dexOf(e)].name}<br>${e.uid ? 'tuyo' : 'alquiler'}`));
          s.title = 'Quitar';
          s.onclick = () => { chosen.splice(i, 1); refresh(); };
        } else s.append(el('small', '', `Hueco ${i + 1}`));
        slots.append(s);
      }
      box.querySelectorAll('.pool-card').forEach(c => {
        const e = JSON.parse(c.dataset.e);
        c.classList.toggle('sel', chosen.some(x => same(x, e)));
      });
      go.disabled = chosen.length !== 3;
    };
    const toggle = e => {
      const i = chosen.findIndex(x => same(x, e));
      if (i >= 0) chosen.splice(i, 1);
      else if (chosen.some(x => dexOf(x) === dexOf(e))) return this.toast('No se puede repetir especie', 'bad');
      else if (chosen.length >= 3) return this.toast('Ya llevas 3: quita uno antes', 'bad');
      else chosen.push(e);
      refresh();
    };
    const card = (e, sub, shiny) => {
      const dex = dexOf(e);
      const c = el('button', 'pool-card');
      c.dataset.e = JSON.stringify(e);
      c.append(portrait(dex, 56, { shiny }), el('b', '', SPECIES[dex].name + (shiny ? ' ✦' : '')), el('div', 'types', typeChips(dex)), el('small', 'small', sub));
      c.title = `Total de stats base ${SPECIES[dex].bst}`;
      c.onclick = () => toggle(e);
      return c;
    };
    const own = p.mons.filter(m => !SPECIES[m.dex].leg).sort((a, b) => SPECIES[b.dex].bst - SPECIES[a.dex].bst || b.level - a.level);
    box.append(slots);
    const scroll = el('div', 'tower-pools scroll');
    scroll.append(el('h4', '', `Tus Pokémon <small>(${own.length})</small>`));
    if (own.length) {
      const grid = el('div', 'pool');
      for (const m of own) grid.append(card({ uid: m.uid }, `Nv.${m.level} → ${LEVEL} · ${REGIONS[m.region || 'kanto'].name}`, !!m.shiny));
      scroll.append(grid);
    } else scroll.append(el('p', 'small', 'Aún no tienes Pokémon que puedan entrar: usa los de alquiler o captura en Historia.'));
    if (p.mons.some(m => SPECIES[m.dex].leg)) scroll.append(el('p', 'small', 'Tus legendarios y singulares no pueden entrar.'));
    scroll.append(el('h4', '', 'De alquiler'));
    const rent = el('div', 'pool');
    for (const dex of RANKED_POOL) rent.append(card({ dex }, `Nv.${LEVEL} · alquiler`, false));
    scroll.append(rent);
    box.append(scroll);
    go.onclick = () => this.net.send({ t: 'tower', a: 'start', team: chosen });
    box.append(go);
    setTimeout(refresh, 0);
    return box;
  },

  // Racha en curso: progreso, siguiente rival en silueta, orden del equipo y retirarse
  towerProgress(t) {
    const p = this.profile;
    const box = el('div', 'panel tower-main progress');
    const head = el('div', 'tower-head');
    head.append(el('div', 'streak', `<small>Racha</small><b>${t.streak}</b>`));
    // Un punto por combate del bloque; el del Cerebro, marcado
    const brainAt = t.n + t.toBrain;
    const dots = Array.from({ length: BLOCK }, (_, i) => {
      const n = t.n - t.inBlock + 1 + i;
      return `<i class="${i < t.inBlock - 1 ? 'won' : i === t.inBlock - 1 ? 'now' : ''}${n === brainAt ? ' brain' : ''}" title="Combate ${n}${n === brainAt ? ': Cerebro de la Frontera' : ''}"></i>`;
    }).join('');
    head.append(el('div', 'block', `<b>Bloque ${t.block}</b> · combate ${t.inBlock} de ${BLOCK}<div class="tdots">${dots}</div>
      <small>${t.next && t.next.brain ? '¡Te espera el Cerebro de la Frontera!' : `Cerebro de la Frontera dentro de ${t.toBrain + 1} combates`}</small>`));
    box.append(head);
    // Siguiente rival
    if (t.next) {
      const foe = el('div', 'next-foe' + (t.next.brain ? ' brain' : ''));
      foe.append(el('h4', '', `Siguiente rival: <b>${escapeHtml(t.next.name)}</b>${t.next.brain ? ' <span class="brain-tag">Cerebro de la Frontera</span>' : ''}`));
      const mons = el('div', 'mini-team');
      for (const dex of t.next.team) { const c = el('div', 'mini'); c.append(portrait(dex, 64, { silhouette: true })); c.append(el('small', '', '???')); mons.append(c); }
      foe.append(mons, el('p', 'small', `Habilidad de la IA: ${pct(t.next.ai)} · todos a Nv.${LEVEL}`));
      box.append(foe);
    }
    // Tu equipo: se puede reordenar (el primero sale al empezar)
    box.append(el('h4', '', 'Tu equipo <small class="small">· el primero sale al empezar</small>'));
    const team = el('div', 'tower-team');
    t.team.forEach((e, i) => {
      const m = e.uid && p.mons.find(x => x.uid === e.uid);
      const dex = m ? m.dex : e.dex;
      const c = el('div', 'tcard');
      c.append(el('span', 'slot', String(i + 1)), portrait(dex, 64, { shiny: !!(m && m.shiny) }), el('div', '', `<b>${SPECIES[dex].name}${m && m.shiny ? ' ✦' : ''}</b><div class="types">${typeChips(dex)}</div><small class="small">${m ? 'tuyo' : 'alquiler'} · Nv.${LEVEL}</small>`));
      const move = (d) => {
        const order = [0, 1, 2];
        [order[i], order[i + d]] = [order[i + d], order[i]];
        this.net.send({ t: 'tower', a: 'order', order });
      };
      const acts = el('div', 'acts');
      const up = el('button', '', '↑'), down = el('button', '', '↓');
      up.disabled = i === 0; down.disabled = i === 2;
      up.title = 'Subir'; down.title = 'Bajar';
      up.onclick = () => move(-1); down.onclick = () => move(1);
      acts.append(up, down);
      c.append(acts);
      team.append(c);
    });
    box.append(team);
    const acts = el('div', 'acts tower-acts');
    const retire = el('button', 'danger', 'Retirarse');
    retire.onclick = () => {
      const msg = t.streak ? `¿Retirarte? Tu racha de ${t.streak} queda guardada${t.streak >= t.best ? ' como tu récord' : ''} y podrás empezar otra con otro equipo.` : '¿Retirarte? Podrás elegir otro equipo.';
      if (confirm(msg)) this.net.send({ t: 'tower', a: 'retire' });
    };
    const fight = el('button', 'primary', t.streak ? `Combate ${t.n}` : '¡Primer combate!');
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
  towerSide(t) {
    const side = el('div', 'tower-side');
    const me = el('div', 'panel');
    me.append(el('h3', '', 'Tu récord'), el('div', 'big-elo', String(t.best)), el('p', 'small', `Mejor racha · ${t.wins} victorias en ${t.runs} desafío${t.runs === 1 ? '' : 's'}`));
    if (t.bestTeam && t.bestTeam.length) { const row = el('div', 'mini-team'); for (const m of t.bestTeam) row.append(portrait(m.dex, 44, { shiny: !!m.shiny })); me.append(row); }
    me.append(el('div', 'symbols', ['Símbolo Plata', 'Símbolo Oro'].map(s => `<span class="symbol ${s.includes('Oro') ? 'oro' : 'plata'}${t.symbols.includes(s) ? ' got' : ''}" title="${s}${t.symbols.includes(s) ? '' : ' (aún no)'}"></span>`).join('') + '<small class="small">Símbolos de la Frontera</small>'));
    me.append(el('p', 'small', `Premios: dinero en cada victoria (más por bloque), Caramelo Raro y una vitamina cada ${BLOCK} victorias, y el símbolo la primera vez que vences al Cerebro.`));
    const board = el('div', 'panel board tower-board');
    board.innerHTML = '<h3>Ranking de la Torre</h3><p class="small">Cargando…</p>';
    const all = el('button', '', 'Ver la ladder completa');
    all.onclick = () => { this.ladderBoard = 'tower'; this.openLadder(); };
    side.append(me, board, all);
    return side;
  },

  // ---------- Ladder ----------
  openLadder() {
    if (this.view !== 'ladder') this.ladderBack = this.view;
    this.show('ladder');
  },

  view_ladder() {
    const board = this.ladderBoard = this.ladderBoard || 'ranked';
    const wrap = el('div', 'ladder');
    wrap.append(this.topbar('Ladder', this.ladderBack && this.ladderBack !== 'ladder' ? this.ladderBack : 'menu'));
    const bar = el('div', 'subbar ladder-bar');
    const tabs = el('div', 'region-tabs');
    for (const [id, name, what] of BOARDS) {
      const b = el('button', id === board ? 'sel' : '', `<b>${name}</b><small>${what}</small>`);
      b.onclick = () => { this.ladderBoard = id; this.ladderPage = 0; this.show('ladder'); };
      tabs.append(b);
    }
    const search = el('input');
    search.placeholder = 'Buscar entrenador…';
    search.maxLength = 16;
    search.value = this.ladderQ || '';
    let timer = null;
    search.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { this.ladderQ = search.value; this.ladderPage = 0; this.requestLadder(); }, 250); };
    bar.append(tabs, search);
    wrap.append(bar);
    wrap.append(el('div', 'panel ladder-table', '<p class="small">Cargando…</p>'));
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
    box.innerHTML = '<h3>Ranking de la Torre</h3>';
    if (!msg.rows.length) return box.append(el('p', 'small', 'Todavía nadie ha ganado un combate en la Torre. ¡Sé el primero!'));
    const ol = el('ol');
    for (const r of msg.rows.slice(0, 10)) {
      const li = el('li', 'clickable' + (r.id === this.profile.id ? ' me' : ''), `<b>${escapeHtml(r.name)}</b><span>${r.best}</span><small>${r.streak ? `en racha: ${r.streak}` : ''}${r.symbols.length ? ' ' + r.symbols.map(s => s.includes('Oro') ? '🥇' : '🥈').join('') : ''}</small>`);
      li.onclick = () => this.userModal(r.id);
      ol.append(li);
    }
    box.append(ol);
    if (msg.me && msg.me.rank > 10) box.append(el('p', 'small', `Tú: puesto ${msg.me.rank} de ${msg.total}`));
  },

  renderLadder(msg) {
    const box = this.root.querySelector('.ladder-table');
    if (!box) return;
    box.innerHTML = '';
    const me = this.profile.id;
    const cols = {
      ranked: [['Liga', r => leagueOf(r.elo)], ['ELO', r => `<b>${r.elo}</b>`], ['V / D', r => `${r.wins} / ${r.losses}`], ['% vict.', r => r.wins + r.losses ? pct(r.wins / (r.wins + r.losses)) : '—']],
      tower: [['Mejor racha', r => `<b>${r.best}</b>`], ['Racha actual', r => r.streak || '—'], ['Símbolos', r => r.symbols.map(s => `<span class="symbol mini ${s.includes('Oro') ? 'oro' : 'plata'} got" title="${s}"></span>`).join('') || '—'], ['Equipo del récord', r => r.team.map(m => `<span class="tdex" data-dex="${m.dex}" data-shiny="${m.shiny ? 1 : ''}"></span>`).join('')]],
      dex: [['Especies', r => `<b>${r.caught}</b>`], ['Shiny', r => r.shinies || '—'], ['Medallas', r => r.badges]],
    }[msg.board];
    const head = `<tr><th>#</th><th>Entrenador</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr>`;
    const row = r => `<tr data-id="${r.id}" class="${r.id === me ? 'me' : ''}"><td class="rank r${r.rank}">${r.rank}</td><td class="who"><i class="dot${r.online ? ' on' : ''}" title="${r.online ? 'En línea' : 'Desconectado'}"></i>${escapeHtml(r.name)}${r.id === me ? ' <span class="you">tú</span>' : ''}</td>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`;
    const info = el('div', 'ladder-info');
    info.innerHTML = `<span>${msg.total} entrenador${msg.total === 1 ? '' : 'es'}${msg.q ? ` · ${msg.found} con «${escapeHtml(msg.q)}»` : ''}</span>` + (msg.me ? `<span class="pill">Tu puesto: <b>#${msg.me.rank}</b></span>` : '<span class="small">Aún no apareces en esta tabla</span>');
    box.append(info);
    if (!msg.rows.length) box.append(el('p', 'small', msg.q ? 'Nadie con ese nombre.' : 'Esta tabla todavía está vacía.'));
    else {
      const table = el('table', 'ladder-rows');
      table.innerHTML = `<thead>${head}</thead><tbody>${msg.rows.map(row).join('')}${msg.me && !msg.rows.some(r => r.id === me) && !msg.q ? `<tr class="gap"><td colspan="${cols.length + 2}">…</td></tr>${row(msg.me)}` : ''}</tbody>`;
      table.querySelectorAll('tr[data-id]').forEach(tr => { tr.onclick = () => this.userModal(tr.dataset.id); });
      table.querySelectorAll('.tdex').forEach(s => s.append(portrait(+s.dataset.dex, 32, { shiny: !!s.dataset.shiny })));
      const scroll = el('div', 'scroll');
      scroll.append(table);
      box.append(scroll);
    }
    if (msg.pages > 1) {
      const pager = el('div', 'acts pager');
      const prev = el('button', '', '← Anterior'), next = el('button', '', 'Siguiente →');
      prev.disabled = msg.page <= 0; next.disabled = msg.page >= msg.pages - 1;
      prev.onclick = () => { this.ladderPage = msg.page - 1; this.requestLadder(); };
      next.onclick = () => { this.ladderPage = msg.page + 1; this.requestLadder(); };
      pager.append(prev, el('span', 'small', `Página ${msg.page + 1} de ${msg.pages}`), next);
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
    if (u.team[0]) head.append(animatedPortrait(u.team[0].dex, 110, 'Idle', !!u.team[0].shiny));
    const since = u.created ? new Date(u.created).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    head.append(el('div', '', `<h3>${escapeHtml(u.name)}${u.id === this.profile.id ? ' <span class="you">tú</span>' : ''}</h3>
      <p class="small"><i class="dot${u.online ? ' on' : ''}"></i> ${u.online ? 'En línea' : 'Desconectado'}${since ? ` · entrenador desde el ${since}` : ''}</p>
      <span class="elo">${leagueOf(u.elo)} · ${u.elo}</span>`));
    box.append(head);
    const rank = r => r ? `#${r}` : '—';
    const regs = Data.REGION_IDS.map(r => `${REGIONS[r].name} ${Data.progOf(u, r) >= Data.leadersOf(r).length ? '♛' : Math.min(8, Data.progOf(u, r)) + '/8'}`).join(' · ');
    box.append(el('div', 'rows user-stats', `
      <div class="stat"><small>Clasificatoria ${rank(u.ranks.ranked)}</small><b>${u.wins}V ${u.losses}D</b></div>
      <div class="stat"><small>Torre: mejor racha ${rank(u.ranks.tower)}</small><b>${u.tower.best}${u.tower.streak ? ` <small class="small">(en racha: ${u.tower.streak})</small>` : ''}</b></div>
      <div class="stat"><small>Pokédex ${rank(u.ranks.dex)}</small><b>${u.caught}${u.shinies ? ` <i class="shiny-star">✦${u.shinies}</i>` : ''}</b></div>
      <div class="stat"><small>Medallas</small><b>${u.badges}</b></div>`));
    box.append(el('p', 'small', regs));
    if (u.team.length) {
      box.append(el('h4', '', 'Sus Pokémon de equipo'));
      const row = el('div', 'mini-team');
      for (const m of u.team) { const c = el('div', 'mini'); c.append(portrait(m.dex, 52, { shiny: m.shiny })); c.append(el('small', '', `${SPECIES[m.dex].name}${m.shiny ? ' ✦' : ''}<br>Nv.${m.level}`)); row.append(c); }
      box.append(row);
    }
    if (u.tower.team.length) {
      box.append(el('h4', '', `Equipo de su récord en la Torre (${u.tower.best})${u.tower.symbols.length ? ' · ' + u.tower.symbols.join(', ') : ''}`));
      const row = el('div', 'mini-team');
      for (const m of u.tower.team) { const c = el('div', 'mini'); c.append(portrait(m.dex, 52, { shiny: !!m.shiny })); c.append(el('small', '', `${SPECIES[m.dex].name}${m.rental ? '<br>alquiler' : ''}`)); row.append(c); }
      box.append(row);
    }
    const acts = el('div', 'acts');
    const close = el('button', 'primary', 'Cerrar');
    close.onclick = () => back.remove();
    acts.append(close);
    box.append(acts);
    back.append(box);
    back.onclick = e => { if (e.target === back) back.remove(); };
    document.body.append(back);
  },

  // Bloque de la Torre en la pantalla de resultados
  towerResults(box, r) {
    const t = r.tower;
    box.append(el('p', 'small', `Torre Batalla · combate ${t.n} (bloque ${t.block}) contra ${escapeHtml(t.foe)}`));
    if (t.ended) box.append(el('p', 'tower-res lose', `Racha terminada en <b>${t.streak}</b> · tu récord: ${t.best}`));
    else {
      box.append(el('p', 'tower-res', `Racha: <b>${t.streak}</b>${t.record ? ' · <span class="lvup">¡nuevo récord!</span>' : ''}`));
      if (t.symbol) box.append(el('div', 'badge-won', `<span class="symbol big ${t.symbol.includes('Oro') ? 'oro' : 'plata'} got"></span><p>¡Has vencido al Cerebro de la Frontera! <b>${t.symbol}</b> conseguido.</p>`));
      if (t.blockUp) box.append(el('p', 'small', `¡Bloque completado! Ahora empieza el bloque ${t.blockUp}: rivales más fuertes y más listos.`));
    }
  },
};
