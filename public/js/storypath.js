// Historia como un camino (vista «Camino»): el viaje de la región por un camino de tierra, de izquierda a derecha.
// Cada sitio es una tarjeta con la foto de su arena, para que se entienda de un vistazo aunque no se haya jugado
// nunca a Pokémon: los gimnasios (con su líder de pie, su medalla colgando y «Gimnasio · combate») van en el
// camino, en orden y luego la Liga; las rutas que abre cada medalla salen del tramo de antes de cada gimnasio (con
// sus Pokémon: los capturados en color y los que no en silueta, y «Ruta · captura»). Lo recorrido es tierra clara;
// lo que falta, apagado. El siguiente reto es lo único grande y dorado, con el jugador al lado y el único botón de
// jugar. Lo bloqueado, en gris con candado y diciendo qué lo abre. Tocar un sitio abre su ficha al lado
import { monIcon, trainerImg } from './sprites.js';
import { badgeImg, item as itemImg } from './pixicons.js';
import { t } from './i18n.js';
import { REGION_ART } from './regionmap.js';

const { TYPE_COLOR } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const LOCK = '<svg class="sp-lock-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
// (las etiquetas de lo que se hace en cada sitio: dos espadas para combatir, una Poké Ball para capturar)
const SWORDS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l7.5 7.5M14 2L6.5 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 11.5l-3 3M8 11.5l3 3M4 9.5l2.5 2.5M12 9.5L9.5 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const BALL = () => itemImg('pokeball', 14, 'sp-ball');
// Las fotos de las arenas (de tools/arena-thumbs.e2e.js), pequeñas y solo cuando se ven
const pic = key => { const i = el('img', 'sp-pic'); i.src = `img/arenas/${key}.webp`; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.draggable = false; i.onerror = () => i.remove(); return i; };
// Cuántos Pokémon de cada ruta se enseñan en su tarjeta
const SHOWN = 4;

export const storyPathViews = {
  storyPath(region, nodes, prog, nextLeader, info) {
    const p = this.profile;
    const leaders = nodes.filter(n => n.kind !== 'route');
    const cleared = prog >= leaders.length;
    const run = p.leagueRun && p.leagueRun.region === region ? p.leagueRun.step : 0;
    const wrap = el('div', 'story-path scroll');
    const track = el('div', 'sp-track');
    wrap.append(track);
    // La leyenda, con lo que es cada cosa en pequeño: un gimnasio es para combatir y una ruta, para capturar
    const first = leaders[0], mini = (key, inner) => `<i class="sp-k"><img src="img/arenas/${key}.webp" alt="" loading="lazy">${inner}</i>`;
    const legend = el('div', 'sp-legend', `<span>${mini(first.map, trainerImg(first.id, 'sp-k-face'))}${t('Gimnasio: combate por su medalla')}</span>`
      + `<span>${mini('pradera', BALL())}${t('Ruta: captura Pokémon')}</span><span class="sp-k-lock"><i class="sp-k locked">${LOCK}</i>${t('Aún bloqueado')}</span>`);
    const all = [];
    const pick = (b, n, unlocked, done) => {
      all.forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      this.nodeInfo(info, n, unlocked, done);
    };
    const lockNote = who => who ? `<span class="sp-locknote">${LOCK}<small>${t('Se abre al vencer a {who}', { who })}</small></span>` : `<span class="sp-locknote">${LOCK}</span>`;
    // Una ruta: la foto de su terreno, sus Pokémon (en silueta los que no tienes), lo capturado y si es nueva
    const route = n => {
      const unlocked = n.req <= prog, isNew = unlocked && n.req === prog;
      const dexes = [...new Set(n.wild.map(([d]) => d))], got = dexes.filter(d => p.caught.includes(d)).length, full = got === dexes.length;
      const b = el('button', 'sp-node sp-route' + (unlocked ? '' : ' locked') + (isNew ? ' new' : '') + (unlocked && full ? ' full' : ''));
      b.title = n.name;
      b.setAttribute('aria-label', `${n.name} · ${t('Ruta · captura')} · ${unlocked ? t('{a}/{b} capturados', { a: got, b: dexes.length }) : t('Aún bloqueado')}${isNew ? ' · ' + t('Nueva') : ''}`);
      const card = el('span', 'sp-card');
      card.append(pic(n.map), el('span', 'sp-tag', `${BALL()}${t('Ruta · captura')}`));
      if (unlocked) {
        // (los que tienes primero, y el resto en silueta: «¿quién es ese Pokémon?»)
        const mons = el('span', 'sp-mons');
        for (const d of [...dexes.filter(d => p.caught.includes(d)), ...dexes.filter(d => !p.caught.includes(d))].slice(0, SHOWN)) {
          const known = p.caught.includes(d), ic = monIcon(d, 32, { silhouette: !known });
          ic.classList.add(known ? 'got' : 'unknown');
          mons.append(ic);
        }
        card.append(mons, el('span', 'sp-count' + (full ? ' full' : ''), `${BALL()}${full ? '✓ ' : ''}${got}/${dexes.length}`));
        if (isNew) card.append(el('em', 'sp-new', t('Nueva')));
      } else card.insertAdjacentHTML('beforeend', lockNote(n.req > 0 && leaders[n.req - 1] && leaders[n.req - 1].leader));
      b.append(card, el('span', 'sp-name', n.name));
      b.onclick = () => pick(b, n, unlocked, false);
      all.push(b);
      // (cuelga del camino por un caminito propio)
      const stand = el('div', 'sp-branch' + (unlocked ? ' open' : ''));
      stand.append(b);
      return stand;
    };
    // El jugador, de pie en el camino junto a lo que toca
    const you = () => { const y = el('div', 'sp-you'); y.append(el('span', 'sp-you-tag', t('Estás aquí')), this.avatar(40)); return y; };
    // El único botón de jugar del camino: el del siguiente reto
    const goBtn = id => { const go = el('button', 'primary sp-go', t('Desafiar')); go.onclick = e => { e.stopPropagation(); this.startStory('gym', id); }; return go; };
    // Un gimnasio: la foto de su arena, el líder de pie, el color de su tipo, su número y su medalla colgando
    const leader = n => {
      const unlocked = n.index <= prog, done = n.index < prog, now = n === nextLeader;
      const b = el('button', 'sp-node sp-gym' + (done ? ' done' : '') + (now ? ' now' : '') + (unlocked ? '' : ' locked'));
      b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = `${n.name} · ${n.leader}`;
      b.setAttribute('aria-label', `${n.index + 1}. ${n.name} · ${n.leader} · ${t('Gimnasio · combate')} · ${done ? t('Medalla ganada') : now ? t('Tu siguiente reto') : t('Aún bloqueado')}`);
      const card = el('span', 'sp-card');
      card.append(pic(n.map));
      card.insertAdjacentHTML('beforeend', `${trainerImg(n.id, 'sp-leader')}<em class="sp-ord">${n.index + 1}</em>`
        + `<span class="sp-medal">${badgeImg(region, n.index, done, 30, 'sp-badge')}</span><span class="sp-tag">${SWORDS}${t('Gimnasio · combate')}</span>`
        + (unlocked ? '' : lockNote(n.index > 0 && leaders[n.index - 1].leader)));
      b.append(card, el('span', 'sp-name', `<b>${n.leader}</b>${now ? `<small>${n.name}</small>` : ''}`));
      b.onclick = () => pick(b, n, unlocked, done);
      all.push(b);
      return now ? stop(b, n.id) : stop(b);
    };
    // Una parada en el camino: el sitio y, si es lo que toca, el jugador al lado y el botón de jugar debajo
    const stop = (b, goId) => {
      const s = el('div', 'sp-stop' + (goId ? ' now' : ''));
      if (goId) { s.append(you(), b, goBtn(goId)); b.classList.add('now'); } else s.append(b);
      return s;
    };
    // Cada tramo: el camino con las rutas que se abren en él y, al final, su gimnasio
    const chapter = (routes, head, state) => {
      const ch = el('div', 'sp-ch ' + state);
      if (routes.length) { const leg = el('div', 'sp-leg'); routes.forEach(n => leg.append(route(n))); ch.append(leg); }
      if (head) ch.append(head);
      track.append(ch);
      return ch;
    };
    // La salida: el pueblo, con su cartel
    track.append(el('div', 'sp-start', `<span class="sp-sign">${t(this.regionStart(region))}</span>`));
    for (const L of leaders) {
      const routes = nodes.filter(x => x.kind === 'route' && x.req === L.index);
      if (L.index >= Data.LEAGUE_FROM) {
        if (L.index > Data.LEAGUE_FROM) continue;
        // La Liga: un lugar grande al final (su estadio) que abre su pantalla (5 combates seguidos)
        const open = prog >= Data.LEAGUE_FROM, total = leaders.length - Data.LEAGUE_FROM;
        const b = el('button', 'sp-node sp-gym sp-league' + (cleared ? ' done' : '') + (open ? '' : ' locked'));
        b.setAttribute('aria-label', `${t('Liga Pokémon')} · ${t('Liga · combate')} · ${cleared ? t('¡Has completado {r}!', { r: Data.REGIONS[region].name }) : open ? t('Combate {n} de {m}', { n: run + 1, m: total }) : t('Aún bloqueado')}`);
        const card = el('span', 'sp-card');
        card.append(pic(L.map));
        card.insertAdjacentHTML('beforeend', `<img class="sp-stadium" src="tiles/league.png" alt="" draggable="false" loading="lazy"><span class="sp-tag">${SWORDS}${t('Liga · combate')}</span>`
          + (cleared ? '<em class="sp-crown">♛</em>' : '') + (open ? '' : lockNote(leaders[Data.LEAGUE_FROM - 1] && leaders[Data.LEAGUE_FROM - 1].leader)));
        b.append(card, el('span', 'sp-name', `<b>${t('Liga Pokémon')}</b>${open && !cleared ? `<small>${t('Combate {n} de {m}', { n: run + 1, m: total })}</small>` : ''}`));
        b.onclick = () => { this.leagueRegion = region; this.show('league'); };
        all.push(b);
        chapter(routes, open && !cleared ? stop(b, nextLeader.id) : stop(b), cleared ? 'done' : open ? 'now' : 'locked');
        continue;
      }
      chapter(routes, leader(L), L.index < prog ? 'done' : L === nextLeader ? 'now' : 'locked');
    }
    // Rutas que se abren después del Campeón, y la corona al final del camino (con el jugador, si ya ha llegado)
    const after = nodes.filter(x => x.kind === 'route' && x.req > leaders.length - 1);
    const end = el('div', 'sp-end', cleared ? '<em>♛</em>' : '');
    if (cleared) end.prepend(you());
    chapter(after, end, cleared ? 'done' : 'locked');
    // Al abrir: elegido y en el centro lo que toca (el siguiente líder o, si no, la primera ruta nueva)
    const cur = all.find(b => b.classList.contains('now')) || all.find(b => b.classList.contains('new')) || all.find(b => !b.classList.contains('locked'));
    requestAnimationFrame(() => {
      if (!cur) return;
      if (!cur.classList.contains('sp-league')) cur.click();
      const a = cur.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      wrap.scrollTo({ left: Math.max(0, wrap.scrollLeft + a.left - w.left - w.width / 2 + a.width / 2), behavior: 'instant' });
    });
    const box = el('div', 'sp-box');
    box.append(wrap, legend);
    return box;
  },

  // El sitio de salida de la región (el primer pueblo de su mapa)
  regionStart(region) {
    const art = REGION_ART[region];
    return art && art.cities[0] ? art.cities[0][0] : '';
  },
};
