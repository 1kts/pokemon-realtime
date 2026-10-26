// Colección: la maestría de cada línea evolutiva (sus premios se recogen a mano) y lo que da:
// ilustraciones para el avatar, glows del avatar y skins, con lo que falta para conseguir cada cosa.
// Los datos están en Data.MASTERY_TIERS; el servidor entrega los premios (server/rewards.js, claimMastery)
// y los equipa (setLook).
import { t } from './i18n.js';
import { portrait, typeTint } from './sprites.js';
import { masteryPrize, SKIN_LABEL, applySkin, auraName, frameBadge } from './frames.js';
import { achIcon, achName, achDesc, frameName } from './achievements.js';
import { effectName, avatarArt, avatarName } from './missions.js';
import { icon, typeIcon, item as itemImg } from './pixicons.js';

const { SPECIES, TYPE_NAMES, TYPE_LABEL, MASTERY_TIERS, SKINS } = Data;
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
// Logros: retos por línea evolutiva, retos generales (por categorías) y la colección de todo lo que se
// puede conseguir (con de dónde sale lo que falta), donde también se equipa
const TABS = [['mastery', 'Líneas'], ['retos', 'Retos'], ['skin', 'Skins'], ['frames', 'Marcos'], ['aura', 'Glows'], ['effects', 'Efectos'], ['art', 'Ilustraciones'], ['titles', 'Títulos']];
const winsFor = kind => (MASTERY_TIERS.find(x => x.kind === kind || x.skin === kind || x.aura === kind) || {}).wins;
const CAT_LABEL = { progreso: 'Progreso', combate: 'Combate', coleccion: 'Colección', torre: 'Torre', pvp: 'Online' };
// Qué pide cada reto de línea
const tierAsk = (x, m) => x.stat === 'catch' ? t('Atrapa {n} Pokémon de la línea de {m}', { n: x.goal, m })
  : x.stat === 'pvp' ? t('Gana {n} combates online con la línea de {m}', { n: x.goal, m })
  : x.stat === 'tower' ? t('Llega a una racha de {n} en la Torre con la línea de {m}', { n: x.goal, m }) : t('Gana {n} combates con la línea de {m}', { n: x.wins, m });

// Líneas evolutivas que conoces: las de lo que has atrapado, las que ya tienen victorias y las de retos en marcha
function lineRoots(p) {
  const won = ((p.cosmetics || {}).skins || []).map(s => +s.split(':')[1]);
  const stats = Object.values(p.lineStats || {}).flatMap(s => Object.keys(s).map(Number));   // retos en marcha (online, Torre, capturas)
  return [...new Set([...(p.caught || []), ...Object.keys(p.mastery || {}).map(Number), ...won, ...stats].filter(d => SPECIES[d]).map(Data.lineOf))];
}

export const collectionViews = {
  // Premios de maestría por recoger (para avisos en el menú)
  masteryReadyCount() {
    const p = this.profile;
    return lineRoots(p).reduce((n, r) => n + Data.masteryReady(p, r).length, 0);
  },

  // Pone la skin y las partículas de su línea a un retrato (en los menús; en combate la pinta el shader de actors.js)
  skinned(node, dex) {
    return applySkin(node, Data.skinOf(this.profile, dex), dex, Data.particlesOf(this.profile, dex));
  },

  openCollection(tab) {
    if (tab) this.collTab = tab;
    if (this.view !== 'collection') this.collBack = this.view;
    this.show('collection');
  },

  view_collection() {
    const tab = this.collTab = TABS.some(([id]) => id === this.collTab) ? this.collTab : 'mastery';
    const p = this.profile;
    const wrap = el('div', 'collection');
    const bar = this.topbar(t('Logros'), this.collBack || 'menu');
    wrap.append(bar);
    const tabs = el('div', 'coll-tabs');
    const ready = this.masteryReadyCount(), retos = (p.achClaim || []).length;
    // Recoger todo: los retos de línea y los logros de una vez
    if (ready + retos) {
      const all = el('button', 'primary claim-btn claim-all', `${t('Recoger todo')} <small>${ready + retos}</small>`);
      all.onclick = () => { all.disabled = true; this.net.send({ t: 'mission', a: 'claimAll', scope: 'logros' }); };
      (bar.querySelector('.tb-ctx') || bar).append(all);
    }
    TABS.forEach(([id, label], i) => {
      if (i === 2) tabs.append(el('span', 'coll-sep', `<small>${t('Colección')}</small>`));
      const n = id === 'mastery' ? ready : id === 'retos' ? retos : 0;
      const b = el('button', 'coll-tab' + (id === tab ? ' sel' : ''), t(label) + (n ? `<i class="nbadge">${n}</i>` : ''));
      b.onclick = () => { this.collTab = id; this.show('collection'); };
      tabs.append(b);
    });
    const body = el('div', 'coll-body scroll');
    wrap.append(tabs, body);
    // La colección solo enseña lo que tienes y cómo se consigue lo demás; se equipa en el Perfil
    // (las skins, en la ficha de cada Pokémon)
    if (TABS.findIndex(([id]) => id === tab) >= 2) {
      const go = el('button', 'coll-where', tab === 'skin' ? t('Las skins se ponen en la ficha de cada Pokémon (Mis Pokémon)') : t('Para ponértelo, ve a tu Perfil › Personalizar'));
      go.onclick = () => tab === 'skin' ? this.openFrom('team') : this.show('profile');
      body.append(go);
    }
    this['coll_' + tab](body);
    this.root.append(wrap);
  },

  // Líneas: una tarjeta por línea evolutiva con sus retos (victorias, online y Torre), su progreso y recoger
  coll_mastery(body) {
    const p = this.profile;
    body.append(el('p', 'small coll-intro', t('Cada combate que ganas suma una victoria a la línea evolutiva de cada Pokémon de tu equipo. Las skins Holo y Galaxia piden ganar online y llegar lejos en la Torre con esa línea.')));
    const ready = r => Data.masteryReady(p, r).length, done = r => Data.masteryClaimed(p, r).length;
    const roots = lineRoots(p).sort((a, b) => (ready(b) - ready(a)) || (done(b) - done(a)) || (Data.masteryWins(p, b) - Data.masteryWins(p, a)) || a - b);
    if (!roots.length) body.append(el('p', 'small', t('Atrapa Pokémon y gana combates con ellos para empezar.')));
    // Una fila por línea (retrato, victorias, un punto por reto y cuántos van); al tocarla se despliegan sus
    // retos. Las que tienen algo por recoger salen desplegadas
    const open = this.lgOpen || (this.lgOpen = new Set());
    const grid = el('div', 'lg-grid lg-list');
    for (const root of roots) {
      const claimed = Data.masteryClaimed(p, root), can = Data.masteryReady(p, root), name = SPECIES[root].name;
      const isOpen = open.has(root) || (can.length > 0 && !open.has(-root));
      const card = typeTint(el('div', 'lg-card' + (can.length ? ' ready' : '') + (isOpen ? ' open' : '')), root);
      const pips = MASTERY_TIERS.map((x, i) => `<i class="pip${claimed.includes(i) ? ' got' : can.includes(i) ? ' ready' : ''}" title="${escapeAttr(masteryPrize(x, root, t))}"></i>`).join('');
      const head = el('button', 'lg-head', `<b>${name}<small>${t('{n} victorias', { n: Data.masteryWins(p, root) })}</small></b><span class="lg-pips">${pips}</span><small class="lg-count">${t('{a}/{b} retos', { a: claimed.length, b: MASTERY_TIERS.length })}</small>${can.length ? `<em class="lg-ready">${t('¡{n} por recoger!', { n: can.length })}</em>` : ''}<i class="lg-chev">▾</i>`);
      head.prepend(this.skinned(portrait(root, 40), root));
      head.onclick = () => { const now = !card.classList.contains('open'); card.classList.toggle('open', now); open.delete(now ? -root : root); open.add(now ? root : -root); };
      card.append(head);
      card.append(this.lineTiers(root));
      grid.append(card);
    }
    body.append(grid);
  },

  // Los retos de una línea evolutiva (victorias, online y Torre) con su progreso y el botón de recoger; se
  // usan en Logros › Líneas y en la ficha de cada Pokémon
  lineTiers(root) {
    const p = this.profile, claimed = Data.masteryClaimed(p, root), can = Data.masteryReady(p, root), name = SPECIES[root].name;
    const tiers = el('div', 'lg-tiers');
    MASTERY_TIERS.forEach((x, i) => {
      const cur = Math.min(Data.tierGoal(x), Data.lineStat(p, root, x.stat)), got = claimed.includes(i), ok = can.includes(i);
      const row = el('div', 'lg-row k-' + x.kind + (got ? ' got' : ok ? ' ready' : ''));
      const ico = el('span', 'lg-ico');
      if (x.kind === 'skin') ico.append(applySkin(portrait(root, 34), x.skin, root));
      else ico.innerHTML = x.kind === 'perfect' ? itemImg('pokeball', 28) : x.kind === 'reward' ? itemImg('caramelo', 28) : x.kind === 'art' ? icon('user', 26) : x.kind === 'title' ? icon('crown', 26) : x.kind === 'portrait' ? avatarArt('pt:' + root, 34) : icon('star', 26);
      row.append(ico, el('div', 'lg-body', `<b>${masteryPrize(x, root, t)}</b><small>${tierAsk(x, name)}</small>${got ? '' : `<div class="m-bar"><i style="width:${cur / Data.tierGoal(x) * 100}%"></i><span>${cur} / ${Data.tierGoal(x)}</span></div>`}`));
      if (ok) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.onclick = () => { b.disabled = true; this.net.send({ t: 'masteryclaim', dex: root, i }); };
        row.append(b);
      } else if (got) row.append(el('em', 'm-ok', '✓'));
      tiers.append(row);
    });
    return tiers;
  },

  // Retos: todos los logros, por categorías, con su progreso, premio y recoger
  coll_retos(body) {
    const p = this.profile, got = p.achievements || {}, pending = p.achClaim || [];
    const cat = this.retoCat || 'all';
    const pills = el('div', 'gen-tabs coll-cats');
    for (const c of ['all', ...Data.ACH_CATS]) {
      const list = Data.ACHIEVEMENTS.filter(a => c === 'all' || a.cat === c);
      const b = el('button', c === cat ? 'sel' : '', `${c === 'all' ? t('Todos') : t(CAT_LABEL[c])} <small>${list.filter(a => got[a.id]).length}/${list.length}</small>`);
      b.onclick = () => { this.retoCat = c; this.show('collection', true); };
      pills.append(b);
    }
    body.append(pills);
    const grid = el('div', 'ach-grid retos-grid');
    const list = Data.ACHIEVEMENTS.filter(a => cat === 'all' || a.cat === cat)
      .sort((a, b) => pending.includes(b.id) - pending.includes(a.id) || (got[a.id] ? 1 : 0) - (got[b.id] ? 1 : 0) || Data.achievementProgress(p, b) / b.goal - Data.achievementProgress(p, a) / a.goal);
    for (const a of list) {
      const ok = !!got[a.id], cur = Data.achievementProgress(p, a), ready = pending.includes(a.id), rw = a.reward || {};
      const prize = [rw.frame && `${frameBadge(rw.frame, 18)}${frameName(rw.frame)}`, rw.title && `${t('Título')}: <b>${t(rw.title)}</b>`, rw.aura && auraName(rw.aura, t), rw.coins && `${icon('coin', 14)}${rw.coins.toLocaleString()}`].filter(Boolean).join(' · ');
      const card = el('div', 'ach-card' + (ok ? ' got' : '') + (ready ? ' ready' : ''));
      card.innerHTML = `${achIcon(a, 52, ok)}<div class="ach-body"><b>${achName(a)}</b><small>${achDesc(a)}</small>
        ${ok ? `<em class="ach-done">${t('Conseguido')}</em>` : `<div class="ach-bar"><i style="width:${cur / a.goal * 100}%"></i></div><small class="ach-num">${cur} / ${a.goal}</small>`}
        <small class="ach-prize">${prize}</small></div>`;
      if (ready) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.onclick = () => { b.disabled = true; this.net.send({ t: 'achclaim', id: a.id }); };
        card.querySelector('.ach-body').append(b);
      }
      grid.append(card);
    }
    body.append(grid);
  },

  // Marcos: todos (liga, logros y de tipo), los tuyos para ponértelos y de dónde sale cada uno que falta
  coll_frames(body) {
    const p = this.profile, own = (p.cosmetics && p.cosmetics.frames) || [];
    body.append(el('p', 'small coll-intro', t('El contorno decorado de tu avatar. Salen de la liga y de los retos; los de tipo, más adelante.')));
    const SRC = {};
    for (const a of Data.ACHIEVEMENTS) if (a.reward && a.reward.frame) SRC[a.reward.frame] = t('Reto: {name}', { name: achName(a) });
    for (const ty of TYPE_NAMES) SRC['tipo-' + ty] = t('Próximamente');
    // Los de antes que ya no se consiguen (p. ej. el de Campeón) solo salen si los tienes
    const all = [...new Set(['bronce', 'plata', 'oro', 'platino', 'diamante', 'maestro', ...Data.ACHIEVEMENTS.map(a => a.reward && a.reward.frame).filter(Boolean), ...TYPE_NAMES.map(ty => 'tipo-' + ty), ...own])];
    const grid = el('div', 'coll-grid frames-grid');
    for (const f of all) {
      const has = own.includes(f), sel = p.frame === f;
      const b = el('div', 'coll-item frame-item' + (sel ? ' sel' : '') + (has ? ' own' : ' locked'));
      b.append(this.avatar(70, false, f, null, null), el('small', '', frameName(f)), el('em', '', has ? (sel ? t('Puesto') : t('Lo tienes')) : SRC[f] || t('Liga {name}', { name: t(f[0].toUpperCase() + f.slice(1)) })));
      grid.append(b);
    }
    body.append(grid);
  },

  // Efectos: los de Lucky Spin (encima del avatar; se ponen en el Perfil)
  coll_effects(body) {
    const p = this.profile, own = (p.cosmetics && p.cosmetics.effects) || [];
    body.append(el('p', 'small coll-intro', t('Un efecto animado por encima de tu avatar, sea cual sea. Salen en Lucky Spin.')));
    const grid = el('div', 'coll-grid frames-grid');
    for (const fx of Data.EFFECTS) {
      const has = own.includes(fx), sel = p.effect === fx;
      const b = el('div', 'coll-item frame-item' + (sel ? ' sel' : '') + (has ? ' own' : ' locked'));
      b.append(this.avatar(70, false, null, null, fx), el('small', '', effectName(fx)), el('em', '', has ? (sel ? t('Puesto') : t('Lo tienes')) : t('En Lucky Spin')));
      grid.append(b);
    }
    body.append(grid);
  },

  // Títulos: los tuyos y los de los retos que faltan (se ponen en el Perfil)
  coll_titles(body) {
    const p = this.profile, own = (p.cosmetics && p.cosmetics.titles) || [];
    body.append(el('p', 'small coll-intro', t('El título sale bajo tu nombre. Se consiguen con retos, con la liga y con los retos de línea.')));
    const fromAch = Data.ACHIEVEMENTS.filter(a => a.reward && a.reward.title).map(a => [a.reward.title, achName(a)]);
    const all = [...new Set([...own, ...fromAch.map(x => x[0])])];
    const chips = el('div', 'ms-chips titles-chips');
    for (const ti of all) {
      const has = own.includes(ti), src = fromAch.find(x => x[0] === ti);
      const b = el('span', 'ms-chip' + (p.title === ti ? ' sel' : '') + (has ? ' own' : ' locked'), `${has ? '' : '🔒 '}${t(ti)}`);
      b.title = has ? '' : src ? t('Reto: {name}', { name: src[1] }) : '';
      chips.append(b);
    }
    body.append(chips);
  },

  // Ilustraciones oficiales: las de las líneas con su premio recogido (se ponen de avatar en el Perfil)
  coll_art(body) {
    const p = this.profile;
    const n = winsFor('art');
    body.append(el('p', 'small coll-intro', t('Gana {n} combates con una línea evolutiva y recoge su premio para usar la ilustración oficial de sus Pokémon como avatar.', { n })));
    const grid = el('div', 'coll-grid');
    const caught = new Set(p.caught || []);
    const roots = lineRoots(p).sort((a, b) => Data.hasMastery(p, b, 'art') - Data.hasMastery(p, a, 'art') || Data.masteryWins(p, b) - Data.masteryWins(p, a) || a - b);
    for (const root of roots) {
      if (Data.hasMastery(p, root, 'art')) {
        for (const dex of Data.lineMembers(root).filter(d => caught.has(d))) {
          const sel = p.avatar === dex && p.avatarArt && !p.avatarShiny;
          const b = el('div', 'coll-item art own' + (sel ? ' sel' : ''), `<img src="art/${dex}.png" alt="" loading="lazy" draggable="false"><small>${SPECIES[dex].name}</small>`);
          b.title = sel ? t('Tu avatar') : t('Lo tienes');
          grid.append(b);
        }
      } else {
        const w = Data.masteryWins(p, root);
        const it = el('div', 'coll-item locked', `<small>${SPECIES[root].name}</small><em>${w >= n ? t('¡Recógela en Líneas!') : `${w}/${n}`}</em>`);
        it.prepend(portrait(root, 64, { silhouette: true }));
        it.title = t('Gana {n} combates con la línea de {m}', { n, m: SPECIES[root].name });
        grid.append(it);
      }
    }
    body.append(grid);
  },

  // Glows: la luz de alrededor del avatar. Los de tipo salen del cofre semanal de misiones (uno que no tengas);
  // los especiales, de retos y de la Torre
  coll_aura(body) {
    const p = this.profile, own = (p.cosmetics && p.cosmetics.auras) || [];
    body.append(el('p', 'small coll-intro', t('Una luz alrededor de tu avatar. Los de tipo salen de los retos de Especialista (debilitar con movimientos de ese tipo) y del cofre semanal de misiones; los especiales, de otros retos.')));
    const SRC = { prisma: t('Reto de línea: racha de {n} en la Torre', { n: MASTERY_TIERS.find(x => x.aura === 'prisma').goal }) };
    for (const a of Data.ACHIEVEMENTS) if (a.reward && a.reward.aura) SRC[a.reward.aura] = SRC[a.reward.aura] ? SRC[a.reward.aura] + ' · ' + t('Reto: {name}', { name: achName(a) }) : t('Reto: {name}', { name: achName(a) });
    const grid = el('div', 'coll-grid aura-grid');
    for (const aura of Data.AURAS) {
      const has = own.includes(aura), sel = p.aura === aura;
      const b = el('div', 'coll-item aura' + (sel ? ' sel' : '') + (has ? ' own' : ' locked'));
      b.append(this.avatar(52, false, undefined, aura), el('small', '', auraName(aura, t)));
      if (has) b.append(el('em', '', sel ? t('Puesto') : t('Lo tienes')));
      else b.append(el('em', '', SRC[aura] || ''));
      grid.append(b);
    }
    body.append(grid);
  },

  // Skins: Oro, Holo y Galaxia sobre el sprite (en los menús y en combate), una por línea
  coll_skin(body) {
    const p = this.profile;
    body.append(el('p', 'small coll-intro', t('Efectos sobre el sprite del Pokémon que se ven en los menús y en combate, también para tus rivales. Cada línea evolutiva consigue las suyas; se ponen en la ficha del Pokémon.')));
    for (const id of SKINS) {
      const need = winsFor(id);
      const sec = el('section', 'skin-sec');
      const lines = lineRoots(p).filter(r => Data.hasSkin(p, r, id));
      sec.append(el('div', 'skin-head', `<h3>${t(SKIN_LABEL[id])}</h3><small>${need ? t('Con {n} victorias de una línea evolutiva', { n: need }) : t('En las ruletas de Lucky Spin, para una línea concreta')}</small>`));
      const grid = el('div', 'coll-grid');
      for (const r of lines) {
        const on = (p.skins || {})[r] === id;
        const b = el('div', 'coll-item skin own' + (on ? ' sel' : ''), `<small>${SPECIES[r].name}</small><em>${on ? t('Puesta') : t('La tienes')}</em>`);
        b.prepend(applySkin(portrait(r, 72), id, r));
        grid.append(b);
      }
      if (!lines.length) {
        let top = null;
        for (const r of lineRoots(p)) if (!top || Data.masteryWins(p, r) > Data.masteryWins(p, top)) top = r;
        const demo = el(need ? 'div' : 'button', 'coll-item locked demo', `<small>${t('Aún no la tienes')}</small><em>${!need ? t('Mira las ruletas de Lucky Spin') : top ? t('Lo más cerca: {m} {w}/{n}', { m: SPECIES[top].name, w: Data.masteryWins(p, top), n: need }) : ''}</em>`);
        if (!need) demo.onclick = () => this.openTreasure();
        demo.prepend(applySkin(portrait(top || 25, 72), id, top || 25));
        grid.append(demo);
      }
      sec.append(grid);
      body.append(sec);
    }
    // Partículas: van con cualquier skin; salen en Lucky Spin, una por línea
    const own = (p.cosmetics && p.cosmetics.particles) || [];
    const sec = el('section', 'skin-sec');
    sec.append(el('div', 'skin-head', `<h3>${t('Partículas')}</h3><small>${t('En las ruletas de Lucky Spin, para una línea concreta. Van con cualquier skin.')}</small>`));
    const grid = el('div', 'coll-grid');
    for (const r of own) {
      const on = !!Data.particlesOf(p, r);
      const b = el('div', 'coll-item skin own' + (on ? ' sel' : ''), `<small>${SPECIES[r].name}</small><em>${on ? t('Puestas') : t('Las tienes')}</em>`);
      b.prepend(applySkin(portrait(r, 72), null, r, true));
      grid.append(b);
    }
    if (!own.length) {
      const demo = el('button', 'coll-item locked demo', `<small>${t('Aún no tienes')}</small><em>${t('Mira las ruletas de Lucky Spin')}</em>`);
      demo.onclick = () => this.openTreasure();
      demo.prepend(applySkin(portrait(4, 72), null, 4, true));
      grid.append(demo);
    }
    sec.append(grid);
    body.append(sec);
  },
};
