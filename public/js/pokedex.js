// Pokédex: todas las especies del juego frente a las que has capturado. Filtros por nombre o número,
// generación, tipo y estado; ficha de cada una con sus stats, evolución y rutas donde aparece
// (marcando las que salen hoy). Los retratos se dibujan solo al entrar en pantalla.
import { portrait, monIcon } from './sprites.js';
import { t } from './i18n.js';
import { masteryHtml } from './frames.js';
import { typeIcon } from './pixicons.js';
import { typeDropdown } from './dropdown.js';
import { evoChips, evosOf } from './evos.js';

const { SPECIES, TYPE_LABEL, TYPE_COLOR, TYPE_NAMES } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const num = d => '#' + String(d).padStart(4, '0');
// evo: [a, condición] o [[a, condición], ...]; condición = nivel o id de piedra u objeto (los de intercambio no
// se desvelan: como en los juegos, hay que descubrirlo)

// Rutas donde puede aparecer cada especie (de los encuentros reales, sus especiales y, en Johto, los
// perros legendarios que vagan por todas)
let whereCache = null;
function whereOf(dex) {
  if (!whereCache) {
    whereCache = new Map();
    const add = (d, n) => { const l = whereCache.get(d) || whereCache.set(d, []).get(d); if (!l.includes(n)) l.push(n); };
    for (const n of Object.values(Data.NODES)) {
      if (n.kind !== 'route') continue;
      const w = Data.routeWild(n);
      for (const [d] of n.wild) add(d, n);
      for (const x of w.specials) add(x.dex, n);
      for (const d of w.roam) add(d, n);
    }
  }
  return whereCache.get(dex) || [];
}
// En esa ruta sale ahora (en la tanda de estas 6 horas) o es uno de sus especiales
const nowOn = (dex, n) => { const w = Data.routeWild(n); return w.list.some(x => x.dex === dex) || w.specials.some(x => x.dex === dex); };
const specialOn = (dex, n) => !n.wild.some(([d]) => d === dex);

export const pokedexViews = {
  view_dex() {
    const p = this.profile;
    // Solo las generaciones con región abierta (Data.DEX_GENS)
    const caught = new Set((p.caught || []).filter(Data.inDex)), shinies = new Set((p.shinies || []).filter(Data.inDex));
    const all = Object.values(SPECIES).filter(s => s.gen <= Data.DEX_GENS).sort((a, b) => a.dex - b.dex);
    const f = this.dexFilter = this.dexFilter || { q: '', gen: 0, type: '', status: 'all' };
    const wrap = el('div', 'dexview');
    wrap.append(this.topbar(t('Pokédex'), this.returnTo || 'menu'));

    const head = el('div', 'dex-head panel');
    head.append(el('div', 'dex-count', `<b>${caught.size}</b> / ${all.length} <small>${t('capturados')}</small>${shinies.size ? ` · <i class="shiny-star">✦${shinies.size}</i>` : ''}<div class="dexbar"><div style="width:${caught.size / all.length * 100}%"></div></div>`));
    const search = el('input');
    search.type = 'search'; search.placeholder = t('Buscar por nombre o número'); search.value = f.q;
    const gens = el('div', 'chips');
    for (let g = 0; g <= Data.DEX_GENS; g++) {
      const total = g ? all.filter(s => s.gen === g).length : all.length;
      const have = g ? all.filter(s => s.gen === g && caught.has(s.dex)).length : caught.size;
      const b = el('button', 'chip' + (f.gen === g ? ' sel' : ''), g ? `${t('Gen {n}', { n: g })} <small>${have}/${total}</small>` : t('Todas'));
      b.onclick = () => { f.gen = g; this.show('dex'); };
      gens.append(b);
    }
    const type = typeDropdown(TYPE_NAMES, f.type, v => { f.type = v; render(); });
    const status = el('div', 'seg');
    for (const [k, label] of [['all', t('Todos')], ['caught', t('Capturados')], ['missing', t('Por capturar')]]) {
      const b = el('button', f.status === k ? 'sel' : '', label);
      b.onclick = () => { f.status = k; status.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); render(); };
      status.append(b);
    }
    const row = el('div', 'dex-filters');
    row.append(search, type, status);
    head.append(row, gens);

    const grid = el('div', 'dex-grid scroll');
    const info = el('p', 'small dex-empty');
    // Retratos perezosos: se dibujan cuando la tarjeta entra en pantalla
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const card = e.target, d = +card.dataset.dex;
        card.querySelector('.pic').append(monIcon(d, 64, { silhouette: !caught.has(d) && f.status !== 'missing' && !card.dataset.reveal }));
        io.unobserve(card);
      }
    }, { root: grid, rootMargin: '200px' });

    const render = () => {
      grid.innerHTML = '';
      const q = f.q.trim().toLowerCase();
      const list = all.filter(s => (!f.gen || s.gen === f.gen) && (!f.type || s.types.includes(f.type))
        && (f.status === 'all' || (f.status === 'caught') === caught.has(s.dex))
        && (!q || s.name.toLowerCase().includes(q) || String(s.dex) === q.replace('#', '').replace(/^0+/, '')));
      info.textContent = list.length ? '' : t('No hay ningún Pokémon con esos filtros.');
      for (const s of list) {
        const got = caught.has(s.dex);
        const card = el('button', 'dex-card' + (got ? ' got' : ''));
        card.dataset.dex = s.dex;
        if (q) card.dataset.reveal = '1';   // si lo buscas por nombre, se ve aunque no lo tengas
        card.innerHTML = `<span class="no">${num(s.dex)}</span><span class="pic"></span><b>${s.name}</b>
          <span class="tys">${s.types.map(ty => `<span title="${TYPE_LABEL[ty]}">${typeIcon(ty, 16)}</span>`).join('')}</span>
          ${got ? `<em class="ok">${shinies.has(s.dex) ? '✦' : '✓'}</em>` : ''}`;
        card.onclick = () => this.dexModal(s.dex);
        grid.append(card);
        io.observe(card);
      }
    };
    let timer = null;
    search.oninput = () => { f.q = search.value; clearTimeout(timer); timer = setTimeout(render, 150); };
    wrap.append(head, info, grid);
    this.root.append(wrap);
    render();
  },

  // Visor de la ficha: sprite del juego, render 3D de HOME, ilustración oficial y animación de Showdown
  // (las tres últimas las sirve el servidor desde PokeAPI). Con el shiny capturado, botón para verlo.
  dexViewer(dex, shinyOwned) {
    const box = el('div', 'dex-viewer');
    const stage = el('div', 'dv-stage');
    const tabs = el('div', 'dv-tabs');
    const st = this.dexView = this.dexView || { mode: 'sprite', shiny: false };
    const MODES = [['sprite', t('Sprite')], ['home', '3D'], ['art', t('Arte')], ['anim', t('Animación')]];
    const draw = () => {
      const shiny = shinyOwned && st.shiny;
      stage.innerHTML = '';
      stage.className = 'dv-stage ' + st.mode;
      if (st.mode === 'sprite') stage.append(portrait(dex, 120, { shiny }));
      else {
        const img = el('img');
        img.alt = ''; img.draggable = false;
        img.src = st.mode === 'anim' ? `anim/${shiny ? 'shiny/' : ''}${dex}.gif` : `${st.mode}/${shiny ? 'shiny/' : ''}${dex}.png`;
        img.onerror = () => img.replaceWith(portrait(dex, 120, { shiny }));
        stage.append(img);
      }
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.m === st.mode || (b.dataset.m === 'shiny' && shiny)));
    };
    for (const [m, label] of MODES) {
      const b = el('button', '', label);
      b.dataset.m = m;
      b.onclick = () => { st.mode = m; draw(); };
      tabs.append(b);
    }
    if (shinyOwned) {
      const b = el('button', 'dv-shiny', '✦');
      b.dataset.m = 'shiny'; b.title = t('Ver shiny');
      b.onclick = () => { st.shiny = !st.shiny; draw(); };
      tabs.append(b);
    }
    box.append(stage, tabs);
    draw();
    return box;
  },

  dexModal(dex) {
    const p = this.profile, s = SPECIES[dex];
    const got = (p.caught || []).includes(dex), shiny = (p.shinies || []).includes(dex);
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box dex-sheet');
    const close = () => back.remove();
    back.onclick = e => { if (e.target === back) close(); };
    const top = el('div', 'dex-sheet-top');
    top.append(this.dexViewer(dex, shiny));
    top.append(el('div', '', `<small>${num(dex)} · ${t('Gen {n}', { n: s.gen })}${s.leg ? ' · ' + t('Legendario') : ''}</small><h3>${s.name}</h3>
      <div>${s.types.map(ty => `<span class="type" style="--tc:${TYPE_COLOR[ty]}">${typeIcon(ty, 14)}${TYPE_LABEL[ty]}</span>`).join('')}</div>
      <p class="${got ? 'ok' : 'small'}">${got ? (shiny ? t('✦ Capturado, también shiny') : t('✓ Capturado')) : t('Todavía no lo has capturado')}</p>`));
    box.append(top);
    if (got) box.append(el('div', 'dex-mastery', masteryHtml(p, dex, t)));
    if (s.base) {
      const names = ['PS', 'Atq', 'Def', 'At.Esp', 'Df.Esp', 'Vel'].map(x => t(x));
      box.append(el('div', 'base-stats', `<small>${t('Stats base de la especie (total {n})', { n: s.bst })}</small><div class="bs">${s.base.map((v, i) => `<div><i style="height:${Math.min(100, v / 1.6)}%"></i><b>${v}</b><span>${names[i]}</span></div>`).join('')}</div>`));
    }
    const evos = evoChips(dex, { caught: p.caught });
    if (evos) box.append(evos);
    const pre = Object.values(SPECIES).find(o => evosOf(o).some(([to]) => to === dex));
    if (pre) box.append(el('p', 'small', t('Evoluciona de {name}', { name: pre.name })));
    // Dónde aparece
    const where = whereOf(dex);
    const w = el('div', 'dex-where');
    w.append(el('h4', '', t('Dónde encontrarlo')));
    if (where.length) {
      w.append(el('ul', '', where.map(n => `<li>${n.name} <small>${Data.REGIONS[n.region].name} · ${t('Nv.{n}', { n: n.lvl[0] + '-' + n.lvl[1] })}</small>${specialOn(dex, n) ? ` <small>${t('especial')}</small>` : ''}${nowOn(dex, n) ? ` <em class="today">${t('¡ahora!')}</em>` : ''}</li>`).join('')));
      w.append(el('p', 'small', t('Cada ruta saca 4 especies al día de su lista; las rutas cambian cada día.')));
    } else w.append(el('p', 'small', t('No aparece en las rutas de Kanto ni Johto: puede salir como Pokémon misterioso, en la tienda o en futuras regiones.')));
    box.append(w);
    const acts = el('div', 'acts');
    const ok = el('button', 'primary', t('Cerrar'));
    ok.onclick = close;
    acts.append(ok);
    box.append(acts);
    back.append(box);
    document.body.append(back);
  },
};
