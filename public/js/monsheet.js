// Ficha completa de un Pokémon (Mis Pokémon): al tocar una tarjeta se abre a pantalla completa con todo lo
// que se puede hacer con él. Izquierda: el Pokémon en grande, nombre y mote, nivel y experiencia, tipos,
// naturaleza, equipo y aspecto shiny. Derecha, por pestañas: estadísticas (IV, EV y vitaminas), movimientos
// (elegir 4 y su orden), objetos (Caramelo Raro y piedras evolutivas) y aspecto (skin de su línea).
// Se queda abierta al llegar el perfil nuevo (cada cambio vuelve del servidor) y con ← → pasa al siguiente.
import { confirmBox } from './dialog.js';
import { animatedPortrait, typeTint } from './sprites.js';
import { monLabel, describeMove } from './battle.js';
import { t } from './i18n.js';
import { item as itemImg, typeIcon } from './pixicons.js';
import { usable } from './bag.js';
import { SKIN_LABEL } from './frames.js';

const { SPECIES, MOVES, SHOP, TYPE_COLOR, TYPE_LABEL } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const lv = n => t('Nv.{n}', { n });
const TABS = [['stats', 'Estadísticas'], ['moves', 'Movimientos'], ['items', 'Objetos'], ['look', 'Aspecto']];
const KEYS = ['Clic', 'Dcho', 'Q', 'E'];

export const monSheetViews = {
  // Abre (o refresca) la ficha del Pokémon uid; list: los uid por los que se pasa con ← →
  monSheet(uid, tab, list) {
    this.sheet = { uid, tab: tab || (this.sheet && this.sheet.tab) || 'stats', list: list || (this.sheet && this.sheet.list) || [uid], moves: null };
    this.renderSheet();
  },

  closeSheet() {
    this.sheet = null;
    document.querySelectorAll('.mon-sheet-back').forEach(x => x.remove());
    document.removeEventListener('keydown', this.sheetKeys);
  },

  // Al llegar el perfil: si la ficha está abierta, se repinta con los datos nuevos
  refreshSheet() {
    if (!this.sheet) return;
    if (!this.profile.mons.some(m => m.uid === this.sheet.uid)) return this.closeSheet();
    this.sheet.moves = null;
    this.renderSheet();
  },

  renderSheet() {
    const p = this.profile, s = this.sheet;
    const mon = p.mons.find(m => m.uid === s.uid);
    if (!mon) return this.closeSheet();
    const sp = SPECIES[mon.dex];
    // Si ya está abierta, se repinta por dentro (sin cerrar ni volver a animar la ventana) y conserva el scroll
    const old = document.querySelector('.mon-sheet-back');
    const keepScroll = old && old.querySelector('.ms-body') ? old.querySelector('.ms-body').scrollTop : 0;
    const back = old || el('div', 'modal mon-sheet-back');
    back.onclick = e => { if (e.target === back) this.closeSheet(); };
    back.innerHTML = '';
    const box = typeTint(el('div', 'mon-sheet' + (mon.shiny ? ' is-shiny' : '') + (old ? '' : ' opening')), mon.dex);

    // ---------- Izquierda: el Pokémon ----------
    const side = el('div', 'ms-side');
    const stage = el('div', 'ms-stage');
    stage.append(this.skinned(animatedPortrait(mon.dex, 260, 'Idle', Data.looksShiny(mon)), mon.dex));
    side.append(stage);
    const team = (p.teams && p.teams[mon.region || 'kanto']) || [];
    const inTeam = team.includes(mon.uid);
    side.append(el('div', 'ms-name', `<h2>${monLabel(mon)}${mon.shiny ? ` <i class="shiny-star">✦</i>` : ''}</h2>
      <small>${mon.nick ? sp.name + ' · ' : ''}Nº ${mon.dex} · ${Data.REGIONS[mon.region || 'kanto'].name}</small>`));
    side.append(el('div', 'types', sp.types.map(ty => `<span class="type" style="--tc:${TYPE_COLOR[ty]}">${typeIcon(ty, 14)}${TYPE_LABEL[ty]}</span>`).join('')));
    const cap = Data.levelCap(p, mon.region || 'kanto'), need = Data.xpToNext(mon.level);
    side.append(el('div', 'ms-level', `<b>${lv(mon.level)}</b>${mon.level >= cap ? `<span class="cap">${t('tope')}</span>` : `<small>${mon.xp} / ${need} EXP</small>`}
      <div class="xp"><div style="width:${mon.level >= cap ? 100 : Math.min(100, mon.xp / need * 100)}%"></div></div>`));
    const nat = Data.NATURES[mon.nat] || ['—', null, null];
    const route = mon.met ? Data.NODES[mon.met] : null;
    side.append(el('div', 'ms-facts', `<span>${t('Naturaleza')}<b>${nat[0]}</b><small>${nat[1] ? `+${Data.STAT6[nat[1]]} −${Data.STAT6[nat[2]]}` : t('neutra')}</small></span>
      <span>${t('Origen')}<b>${route ? route.name : '—'}</b><small>${sp.leg ? t('legendario') : `Gen ${sp.gen}`}</small></span>`));
    const acts = el('div', 'ms-acts');
    const tg = el('button', inTeam ? 'on' : '', inTeam ? t('Quitar del equipo') : t('Al equipo'));
    tg.onclick = () => {
      let next = team.filter(u => u !== mon.uid);
      if (!inTeam) { if (team.length >= 3) return this.toast(t('El equipo ya tiene 3 Pokémon: saca uno antes'), 'bad'); next = [...team, mon.uid]; }
      if (!next.length) return this.toast(t('El equipo necesita al menos un Pokémon'), 'bad');
      this.net.send({ t: 'story', a: 'team', uids: next, region: mon.region || 'kanto' });
    };
    const nick = el('button', '', t('Mote'));
    nick.onclick = () => this.nickModal(mon);
    acts.append(tg, nick);
    side.append(acts);
    // Shiny: interruptor de dos opciones (Normal / Shiny) para elegir cómo se ve; sigue contando como shiny
    if (mon.shiny) {
      const seg = el('div', 'ms-seg');
      seg.title = t('Solo cambia cómo se ve (también en combate); sigue contando como shiny');
      for (const [plain, label] of [[true, t('Normal')], [false, `✦ ${t('Shiny')}`]]) {
        const b = el('button', !!mon.plain === plain ? 'sel' : '', label);
        b.onclick = () => { if (!!mon.plain !== plain) this.net.send({ t: 'story', a: 'appearance', uid: mon.uid, plain }); };
        seg.append(b);
      }
      side.append(seg);
    }

    // ---------- Derecha: pestañas ----------
    const main = el('div', 'ms-main');
    const head = el('div', 'ms-head');
    const tabs = el('div', 'ms-tabs');
    for (const [id, label] of TABS) {
      const b = el('button', 'ms-tab' + (s.tab === id ? ' sel' : ''), t(label));
      b.onclick = () => { s.tab = id; s.keepScroll = false; this.renderSheet(); s.keepScroll = true; };
      tabs.append(b);
    }
    const nav = el('div', 'ms-nav');
    const i = s.list.indexOf(mon.uid);
    const go = d => { const u = s.list[(i + d + s.list.length) % s.list.length]; if (u !== mon.uid) { s.uid = u; s.moves = null; s.keepScroll = false; this.renderSheet(); s.keepScroll = true; } };
    const prev = el('button', 'tb-btn', '‹'), next = el('button', 'tb-btn', '›'), close = el('button', 'tb-btn ms-close', '✕');
    prev.title = t('Anterior'); next.title = t('Siguiente'); close.title = t('Cerrar');
    prev.disabled = next.disabled = s.list.length < 2;
    prev.onclick = () => go(-1); next.onclick = () => go(1); close.onclick = () => this.closeSheet();
    nav.append(el('small', '', s.list.length > 1 ? `${i + 1} / ${s.list.length}` : ''), prev, next, close);
    head.append(tabs, nav);
    main.append(head);
    const body = el('div', 'ms-body scroll');
    this['sheet_' + s.tab](body, mon);
    main.append(body);

    // Pie: vender
    const foot = el('div', 'ms-foot');
    const mine = p.mons.filter(x => (x.region || 'kanto') === (mon.region || 'kanto'));
    const price = Data.sellPrice(mon);
    const sell = el('button', 'danger', t('Vender por {price}', { price: price.toLocaleString() + ' ₽' }));
    sell.disabled = mine.length <= 1;
    sell.onclick = () => { confirmBox({ title: t('Vender'), text: t('¿Vender a {m} ({lv}) por {price} ₽? No se puede deshacer.', { m: monLabel(mon), lv: lv(mon.level), price }), ok: t('Vender'), danger: true }).then(yes => { if (yes) { this.net.send({ t: 'story', a: 'sell', uid: mon.uid }); } }); };
    foot.append(sell);
    main.append(foot);

    box.append(side, main);
    back.append(box);
    if (!old) document.body.append(back);
    if (keepScroll && this.sheet.keepScroll !== false) body.scrollTop = keepScroll;
    if (!this.sheetKeys) this.sheetKeys = e => {
      if (!this.sheet || e.target.closest('input')) return;
      if (e.key === 'Escape') this.closeSheet();
      if (e.key === 'ArrowRight') back.isConnected && document.querySelector('.ms-nav .tb-btn:nth-of-type(2)').click();
      if (e.key === 'ArrowLeft') back.isConnected && document.querySelector('.ms-nav .tb-btn:nth-of-type(1)').click();
    };
    document.removeEventListener('keydown', this.sheetKeys);
    document.addEventListener('keydown', this.sheetKeys);
  },

  // Estadísticas: barra, IV, EV y la vitamina de cada una para usarla ahí mismo; y las base de la especie
  sheet_stats(body, mon) {
    const p = this.profile, sp = SPECIES[mon.dex];
    const ev = mon.ev || { hp: 0, atk: 0, def: 0, spe: 0 }, iv = mon.iv || { hp: 0, atk: 0, def: 0, spe: 0 };
    const st = Shared.monStats(mon.dex, mon.level, mon), total = Data.evTotal(ev);
    body.append(el('div', 'ms-evtotal', `<span>${t('EV repartidos')}</span><b>${total} / ${Data.EV_TOTAL}</b><div class="xp"><div style="width:${total / Data.EV_TOTAL * 100}%"></div></div>`));
    const rows = el('div', 'ms-stats');
    const bars = [['hp', t('PS'), st.maxHp, 400, `${st.maxHp}`], ['atk', t('Ataque'), st.atk, 2, `×${st.atk.toFixed(2)}`],
      ['def', t('Defensa'), st.def, 1.7, `×${st.def.toFixed(2)}`], ['spe', t('Velocidad'), sp.spd * st.spdMult, 340, `${Math.round(sp.spd * st.spdMult)}`]];
    for (const [key, label, val, max, text] of bars) {
      const item = SHOP.find(x => x.vit === key), have = p.items[item.id] || 0, u = usable(p, item, mon);
      const row = el('div', 'ms-stat');
      row.innerHTML = `<span class="sl">${label}</span><b class="sv">${text}</b><div class="sbar"><div style="width:${Math.min(100, val / max * 100)}%"></div></div>
        <span class="ms-ivev"><i>IV <b class="${iv[key] >= 31 ? 'iv-top' : ''}">${iv[key]}</b></i><i>EV <b>${ev[key]}</b></i></span>`;
      const b = el('button', 'ms-vit' + (u.ok && have ? ' ok' : ''), `${itemImg(item.id, 22)}<span>${item.name}<small>${have ? `×${have}` : t('no tienes')}</small></span>`);
      b.disabled = !have || !u.ok;
      b.title = u.ok ? u.why : u.why || t('Cómprala en la tienda');
      b.onclick = () => this.net.send({ t: 'story', a: 'use', item: item.id, uid: mon.uid });
      row.append(b);
      rows.append(row);
    }
    body.append(rows);
    const base = sp.base || [0, 0, 0, 0, 0, 0];
    const names = ['PS', 'Atq', 'Def', 'At.Esp', 'Df.Esp', 'Vel'].map(x => t(x));
    body.append(el('h4', '', t('Stats base de la especie (total {n})', { n: sp.bst })),
      el('div', 'base-stats', `<div class="bs">${base.map((v, k) => `<div><i style="height:${Math.min(100, v / 1.6)}%"></i><b>${v}</b><span>${names[k]}</span></div>`).join('')}</div>`));
  },

  // Movimientos: los 4 de las teclas arriba (en orden) y debajo todos los que sabe; tocar añade o quita
  sheet_moves(body, mon) {
    const s = this.sheet;
    const current = (mon.moves && mon.moves.length ? mon.moves : SPECIES[mon.dex].moves).filter(k => MOVES[k]);
    if (!s.moves) s.moves = [...current];
    const chosen = s.moves;
    const levels = new Map(Data.learnset(mon.dex).map(([l, k]) => [k, l]));
    const options = [...new Set([...Data.learnedAt(mon.dex, mon.level), ...current])];
    const slots = el('div', 'ms-slots');
    for (let k = 0; k < 4; k++) {
      const m = MOVES[chosen[k]];
      const c = el('div', 'ms-slot' + (m ? '' : ' empty'), m ? `<kbd>${t(KEYS[k])}</kbd>${typeIcon(m.type, 26)}<b>${m.name}</b><small>${m.cost ? m.cost + ' ⚡' : t('básico')}</small>` : `<kbd>${t(KEYS[k])}</kbd><small>${t('Vacío')}</small>`);
      if (m) c.style.setProperty('--tc', TYPE_COLOR[m.type]);
      slots.append(c);
    }
    body.append(slots);
    const changed = chosen.join() !== current.join();
    const bar = el('div', 'ms-movebar');
    bar.append(el('small', '', t('Toca un movimiento para ponerlo o quitarlo. El orden es el de las teclas.')));
    const reset = el('button', '', t('Deshacer'));
    reset.disabled = !changed;
    reset.onclick = () => { s.moves = null; this.renderSheet(); };
    const save = el('button', 'primary', t('Guardar'));
    save.disabled = !changed;
    save.onclick = () => this.net.send({ t: 'story', a: 'moves', uid: mon.uid, moves: chosen });
    bar.append(reset, save);
    body.append(bar);
    const list = el('div', 'move-list ms-movelist');
    for (const k of options) {
      const m = MOVES[k], idx = chosen.indexOf(k);
      const row = el('button', 'move-row' + (idx >= 0 ? ' sel' : ''));
      row.style.setProperty('--tc', TYPE_COLOR[m.type]);
      row.innerHTML = `<span class="slot">${typeIcon(m.type, 28)}<i>${idx >= 0 ? t(KEYS[idx]) : ''}</i></span><b>${m.name}</b><span class="type" style="--tc:${TYPE_COLOR[m.type]}">${TYPE_LABEL[m.type]}</span><em>${levels.has(k) ? lv(levels.get(k)) : t('aprendido')}</em><small>${describeMove(m).split('\n').join(' · ')}</small>`;
      row.onclick = () => {
        if (idx >= 0) { if (chosen.length > 1) chosen.splice(idx, 1); }
        else if (chosen.length < 4) chosen.push(k);
        else return this.toast(t('Ya lleva 4: quita uno antes'), 'bad');
        this.renderSheet();
      };
      list.append(row);
    }
    const upcoming = Data.learnset(mon.dex).filter(([l]) => l > mon.level);
    if (upcoming.length) list.append(el('p', 'small', t('Próximamente: {list}', { list: upcoming.map(([l, k]) => `${MOVES[k].name} (${lv(l)})`).join(' · ') })));
    body.append(list);
  },

  // Objetos: los que le sirven (Caramelo Raro, piedras, vitaminas) con cuántos tienes y qué hacen
  sheet_items(body, mon) {
    const p = this.profile;
    const items = SHOP.filter(i => i.id === 'caramelo' || i.stone || i.vit);
    const grid = el('div', 'ms-items');
    for (const item of items) {
      const u = usable(p, item, mon), have = p.items[item.id] || 0;
      if (item.stone && !u.ok) continue;   // solo las piedras que le hacen algo
      const b = el('button', 'ms-item' + (u.ok && have ? ' ok' : ''), `${itemImg(item.id, 40)}<span><b>${item.name}</b><small>${u.why || item.desc}</small></span><i>×${have}</i>`);
      b.disabled = !u.ok || !have;
      b.title = !have ? t('Cómprala en la tienda') : '';
      b.onclick = () => this.net.send({ t: 'story', a: 'use', item: item.id, uid: mon.uid });
      grid.append(b);
    }
    body.append(grid);
    const evo = SPECIES[mon.dex].evo;
    if (evo) {
      const list = Array.isArray(evo[0]) ? evo : [evo];
      body.append(el('p', 'small', t('Evoluciona a {list}', { list: list.map(([to, c]) => `${SPECIES[to].name} (${typeof c === 'number' ? lv(c) : (SHOP.find(i => i.id === c) || { name: c }).name})`).join(', ') })));
    }
  },

  // Aspecto: la skin y las partículas de su línea (las que tengas), para ponerlas aquí mismo
  sheet_look(body, mon) {
    const p = this.profile, line = Data.lineOf(mon.dex);
    const skinNow = Data.skinOf(p, mon.dex);
    body.append(el('h4', '', t('Skin de la línea de {m}', { m: SPECIES[line].name })));
    const skins = el('div', 'ms-chips');
    const none = el('button', 'ms-chip' + (!skinNow ? ' sel' : ''), t('Sin skin'));
    none.onclick = () => this.net.send({ t: 'look', skin: { dex: line, skin: null } });
    skins.append(none);
    for (const id of Data.SKINS) {
      const has = Data.hasSkin(p, mon.dex, id);
      const b = el('button', 'ms-chip' + (skinNow === id ? ' sel' : '') + (has ? '' : ' locked'), t(SKIN_LABEL[id]));
      b.disabled = !has;
      b.title = has ? '' : t('Aún no la tienes: maestría o Lucky Spin');
      b.onclick = () => this.net.send({ t: 'look', skin: { dex: line, skin: id } });
      skins.append(b);
    }
    body.append(skins);
    // Partículas de la línea: aparte de la skin, se encienden o se apagan
    const hasP = Data.hasParticles(p, mon.dex), onP = !!Data.particlesOf(p, mon.dex);
    body.append(el('h4', '', t('Partículas')));
    const parts = el('div', 'ms-chips');
    for (const on of [false, true]) {
      const b = el('button', 'ms-chip' + (onP === on ? ' sel' : '') + (on && !hasP ? ' locked' : ''), on ? t('Partículas de {type}', { type: Data.TYPE_LABEL[SPECIES[line].types[0]] }) : t('Sin partículas'));
      b.disabled = on && !hasP;
      if (on && !hasP) b.title = t('Aún no las tienes: salen en Lucky Spin');
      b.onclick = () => this.net.send({ t: 'look', particles: { dex: line, on } });
      parts.append(b);
    }
    body.append(parts);
    body.append(el('p', 'small', t('La skin y las partículas se ponen a toda la línea evolutiva y se ven en los menús y en combate.')));
  },
};
