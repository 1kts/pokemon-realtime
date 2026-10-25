// Colección: la maestría de cada línea evolutiva (sus premios se recogen a mano) y lo que da:
// ilustraciones para el avatar, brillos de burbuja y skins, con lo que falta para conseguir cada cosa.
// Los datos están en Data.MASTERY_TIERS; el servidor entrega los premios (server/rewards.js, claimMastery)
// y los equipa (setLook).
import { t } from './i18n.js';
import { portrait } from './sprites.js';
import { masteryPrize, SKIN_LABEL } from './frames.js';

const { SPECIES, TYPE_NAMES, TYPE_LABEL, MASTERY_TIERS, SKINS } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const TABS = [['mastery', 'Maestría'], ['art', 'Ilustraciones'], ['aura', 'Brillos'], ['skin', 'Skins']];
const winsFor = kind => (MASTERY_TIERS.find(x => x.kind === kind || x.skin === kind || x.aura === kind) || {}).wins;
const AURA_PRISMA = 'prisma';

// Líneas evolutivas que conoces: las de lo que has atrapado y las que ya tienen victorias
function lineRoots(p) {
  return [...new Set([...(p.caught || []), ...Object.keys(p.mastery || {}).map(Number)].filter(d => SPECIES[d]).map(Data.lineOf))];
}

export const collectionViews = {
  // Premios de maestría por recoger (para avisos en el menú)
  masteryReadyCount() {
    const p = this.profile;
    return lineRoots(p).reduce((n, r) => n + Data.masteryReady(p, r).length, 0);
  },

  // Pone la skin de su línea a un retrato (en los menús; en combate la pinta el shader de actors.js)
  skinned(node, dex) {
    const skin = Data.skinOf(this.profile, dex);
    if (skin) node.classList.add('skin-' + skin);
    return node;
  },

  openCollection(tab) {
    if (tab) this.collTab = tab;
    if (this.view !== 'collection') this.collBack = this.view;
    this.show('collection');
  },

  view_collection() {
    const tab = this.collTab = this.collTab || 'mastery';
    const wrap = el('div', 'collection');
    wrap.append(this.topbar(t('Colección'), this.collBack || 'menu'));
    const tabs = el('div', 'coll-tabs');
    const ready = this.masteryReadyCount();
    for (const [id, label] of TABS) {
      const b = el('button', 'coll-tab' + (id === tab ? ' sel' : ''), t(label) + (id === 'mastery' && ready ? `<i class="nbadge">${ready}</i>` : ''));
      b.onclick = () => { this.collTab = id; this.show('collection'); };
      tabs.append(b);
    }
    const body = el('div', 'coll-body scroll');
    wrap.append(tabs, body);
    this['coll_' + tab](body);
    this.root.append(wrap);
  },

  // Maestría: cada línea con sus 7 premios, la barra hasta el siguiente y el botón de recoger
  coll_mastery(body) {
    const p = this.profile;
    body.append(el('p', 'small coll-intro', t('Cada combate que ganas (historia, Torre, clasificatoria o partida rápida) suma una victoria a la línea evolutiva de cada Pokémon de tu equipo. Al llegar a cada meta, recoge su premio aquí.')));
    const ready = r => Data.masteryReady(p, r).length, wins = r => Data.masteryWins(p, r);
    const roots = lineRoots(p).sort((a, b) => (ready(b) - ready(a)) || (wins(b) - wins(a)) || a - b);
    if (!roots.length) body.append(el('p', 'small', t('Atrapa Pokémon y gana combates con ellos para empezar.')));
    const list = el('div', 'ml-list');
    for (const root of roots) {
      const w = wins(root), tier = Data.masteryTier(w), claimed = Data.masteryClaimed(p, root), can = Data.masteryReady(p, root);
      const row = el('div', 'ml-row' + (can.length ? ' ready' : ''));
      row.append(this.skinned(portrait(root, 56), root));
      const info = el('div', 'ml-info', `<b>${t('Línea de {m}', { m: SPECIES[root].name })}</b><small>${t('{n} victorias', { n: w })}</small>`);
      const pips = el('div', 'ml-pips');
      MASTERY_TIERS.forEach((x, i) => {
        const state = claimed.includes(i) ? 'got' : can.includes(i) ? 'ready' : 'locked';
        const pip = el('span', 'ml-pip ' + state + ' k-' + x.kind, `<i>${x.wins}</i>`);
        pip.title = `${x.wins} · ${masteryPrize(x, root, t)}${state === 'got' ? ' ✓' : ''}`;
        pips.append(pip);
      });
      info.append(pips);
      const next = MASTERY_TIERS[tier];
      if (next) info.append(el('div', 'ml-next', `<span class="mbar"><i style="width:${w / next.wins * 100}%"></i></span><small>${t('Siguiente: {prize} ({w}/{n})', { prize: masteryPrize(next, root, t), w, n: next.wins })}</small>`));
      else info.append(el('small', 'ml-next done', t('¡Maestría completa!')));
      row.append(info);
      if (can.length) {
        const b = el('button', 'primary claim-btn', t('¡Recoger!'));
        b.title = masteryPrize(MASTERY_TIERS[can[0]], root, t);
        b.onclick = () => { b.disabled = true; this.net.send({ t: 'masteryclaim', dex: root, i: can[0] }); };
        row.append(b);
      }
      list.append(row);
    }
    body.append(list);
  },

  // Ilustraciones oficiales: las de las líneas con su premio recogido se pueden poner de avatar
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
          const b = el('button', 'coll-item art' + (sel ? ' sel' : ''), `<img src="art/${dex}.png" alt="" loading="lazy" draggable="false"><small>${SPECIES[dex].name}</small>`);
          b.title = sel ? t('Tu avatar') : t('Usar de avatar');
          b.onclick = () => this.net.send({ t: 'look', avatar: dex, avatarShiny: false, avatarArt: true });
          grid.append(b);
        }
      } else {
        const w = Data.masteryWins(p, root);
        const it = el('div', 'coll-item locked', `<small>${SPECIES[root].name}</small><em>${w >= n ? t('¡Recógela en Maestría!') : `${w}/${n}`}</em>`);
        it.prepend(portrait(root, 64, { silhouette: true }));
        it.title = t('Gana {n} combates con la línea de {m}', { n, m: SPECIES[root].name });
        grid.append(it);
      }
    }
    body.append(grid);
  },

  // Brillos de burbuja: uno por tipo (con una línea de ese tipo) y el prismático
  coll_aura(body) {
    const p = this.profile;
    const auras = (p.cosmetics && p.cosmetics.auras) || [];
    const n = winsFor('aura'), np = winsFor(AURA_PRISMA);
    body.append(el('p', 'small coll-intro', t('Un halo animado alrededor de tu avatar. El de cada tipo se consigue con {n} victorias de una línea evolutiva de ese tipo; el prismático, con {m}.', { n, m: np })));
    const grid = el('div', 'coll-grid aura-grid');
    const best = type => {
      let top = null;
      for (const r of lineRoots(p)) if ((!type || SPECIES[r].types[0] === type) && (!top || Data.masteryWins(p, r) > Data.masteryWins(p, top))) top = r;
      return top;
    };
    const opt = (aura, label, need, type) => {
      const has = !aura || auras.includes(aura), sel = (p.aura || null) === aura;
      const b = el(has ? 'button' : 'div', 'coll-item aura' + (sel ? ' sel' : '') + (has ? '' : ' locked'));
      b.append(this.avatar(52, false, undefined, aura));
      b.append(el('small', '', label));
      if (!has) {
        const r = best(type);
        b.append(el('em', '', r ? `${SPECIES[r].name} ${Data.masteryWins(p, r)}/${need}` : t('Sin líneas de ese tipo')));
        b.title = type ? t('Gana {n} combates con una línea evolutiva de tipo {type}', { n: need, type: TYPE_LABEL[type] }) : t('Gana {n} combates con una línea evolutiva', { n: need });
      } else b.onclick = () => this.net.send({ t: 'look', aura });
      grid.append(b);
    };
    opt(null, t('Ninguno'));
    opt(AURA_PRISMA, t('Prismático'), np, null);
    for (const type of TYPE_NAMES) opt('tipo-' + type, TYPE_LABEL[type], n, type);
    body.append(grid);
  },

  // Skins: Oro, Holo y Galaxia sobre el sprite (en los menús y en combate), una por línea
  coll_skin(body) {
    const p = this.profile;
    body.append(el('p', 'small coll-intro', t('Efectos sobre el sprite del Pokémon que se ven en los menús y en combate, también para tus rivales. Cada línea evolutiva consigue las suyas; elige cuál lleva.')));
    for (const id of SKINS) {
      const need = winsFor(id);
      const sec = el('section', 'skin-sec');
      const lines = lineRoots(p).filter(r => Data.hasMastery(p, r, 'skin', id));
      sec.append(el('div', 'skin-head', `<h3>${t(SKIN_LABEL[id])}</h3><small>${t('Con {n} victorias de una línea evolutiva', { n: need })}</small>`));
      const grid = el('div', 'coll-grid');
      for (const r of lines) {
        const on = (p.skins || {})[r] === id;
        const b = el('button', 'coll-item skin' + (on ? ' sel' : ''), `<small>${SPECIES[r].name}</small><em>${on ? t('Puesta') : t('Ponérsela')}</em>`);
        const pic = portrait(r, 72);
        pic.classList.add('skin-' + id);
        b.prepend(pic);
        b.onclick = () => this.net.send({ t: 'look', skin: { dex: r, skin: on ? null : id } });
        grid.append(b);
      }
      if (!lines.length) {
        let top = null;
        for (const r of lineRoots(p)) if (!top || Data.masteryWins(p, r) > Data.masteryWins(p, top)) top = r;
        const demo = el('div', 'coll-item locked demo', `<small>${t('Aún no la tienes')}</small><em>${top ? t('Lo más cerca: {m} {w}/{n}', { m: SPECIES[top].name, w: Data.masteryWins(p, top), n: need }) : ''}</em>`);
        const pic = portrait(top || 25, 72);
        pic.classList.add('skin-' + id);
        demo.prepend(pic);
        grid.append(demo);
      }
      sec.append(grid);
      body.append(sec);
    }
  },
};
