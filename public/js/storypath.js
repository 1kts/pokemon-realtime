// Historia como un camino (vista «Camino»): el viaje de la región por un camino de tierra, de izquierda a derecha.
// Cada sitio es una tarjeta con la foto de su arena, para que se entienda de un vistazo aunque no se haya jugado
// nunca a Pokémon: los gimnasios (con su líder de pie y su medalla colgando) van en el
// camino, en orden y luego la Liga; las rutas que abre cada medalla salen del tramo de antes de cada gimnasio (con
// lo capturado y su primer nombre; el resto, en su ficha). Lo recorrido es tierra clara;
// lo que falta, apagado. El siguiente reto es lo único grande y dorado, con el jugador al lado y el único botón de
// jugar. Lo bloqueado, en gris con candado y diciendo qué lo abre. Tocar un sitio abre su ficha al lado
import { trainerImg } from './sprites.js';
import { badgeImg, item as itemImg } from './pixicons.js';
import { t } from './i18n.js';
import { REGION_ART } from './regionmap.js';

const { TYPE_COLOR } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const LOCK = '<svg class="sp-lock-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const BALL = () => itemImg('pokeball', 14, 'sp-ball');
// Las fotos de las arenas (de tools/arena-thumbs.e2e.js), pequeñas y solo cuando se ven
const pic = key => { const i = el('img', 'sp-pic'); i.src = `img/arenas/${key}.webp`; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.draggable = false; i.onerror = () => i.remove(); return i; };

export const storyPathViews = {
  // Con el ratón, el Camino se arrastra de lado, como con el dedo; al soltar tras arrastrar, el clic no elige la tarjeta
  dragToScroll(wrap) {
    wrap.ondragstart = e => e.preventDefault();
    wrap.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.clientY > wrap.getBoundingClientRect().top + wrap.clientHeight) return;   // (la barra de abajo va a su aire)
      const x0 = e.clientX, left0 = wrap.scrollLeft;
      let moved = false;
      const move = ev => {
        if (!moved && Math.abs(ev.clientX - x0) < 6) return;
        moved = true;
        wrap.classList.add('dragging');
        wrap.scrollLeft = left0 - (ev.clientX - x0);
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        wrap.classList.remove('dragging');
        if (!moved) return;
        const eat = ev => { ev.preventDefault(); ev.stopPropagation(); };
        addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', eat, { capture: true }));   // (si soltó fuera no hay clic que comerse)
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    });
  },

  storyPath(region, nodes, prog, nextLeader, info) {
    const p = this.profile, caught = new Set(p.caught);
    const leaders = nodes.filter(n => n.kind !== 'route');
    const cleared = prog >= leaders.length;
    const run = p.leagueRun && p.leagueRun.region === region ? p.leagueRun.step : 0;
    const wrap = el('div', 'story-path scroll');
    this.dragToScroll(wrap);
    const track = el('div', 'sp-track');
    wrap.append(track);
    // La leyenda, con lo que es cada cosa en pequeño: un gimnasio es para combatir y una ruta, para capturar
    const first = leaders[0], legend = el('div', 'sp-legend');
    const mini = (key, inner, text) => { const k = el('i', 'sp-k', inner); k.prepend(pic(key)); const s = el('span'); s.append(k, text); legend.append(s); };
    mini(first.map, trainerImg(first.id, 'sp-k-face'), t('Gimnasio: combate por su medalla'));
    mini('pradera', BALL(), t('Ruta: captura Pokémon'));
    legend.append(el('span', 'sp-k-lock', `<i class="sp-k locked">${LOCK}</i>${t('Aún bloqueado')}`));
    const all = [];
    const pick = (b, n, unlocked, done) => {
      all.forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      this.nodeInfo(info, n, unlocked, done);
    };
    const lockNote = who => who ? `<span class="sp-locknote">${LOCK}<small>${t('Se abre al vencer a {who}', { who })}</small></span>` : `<span class="sp-locknote">${LOCK}</span>`;
    // Una ruta: la foto de su terreno, lo capturado y si es nueva; sus Pokémon y sus otros nombres, en la ficha
    const route = n => {
      const unlocked = n.req <= prog, isNew = unlocked && n.req === prog;
      const dexes = [...new Set(n.wild.map(([d]) => d))], got = dexes.filter(d => caught.has(d)).length, full = got === dexes.length;
      const b = el('button', 'sp-node sp-route' + (unlocked ? '' : ' locked') + (isNew ? ' new' : '') + (unlocked && full ? ' full' : ''));
      b.title = n.name;
      b.setAttribute('aria-label', `${n.name} · ${t('Ruta · captura')} · ${unlocked ? t('{a}/{b} capturados', { a: got, b: dexes.length }) : t('Aún bloqueado')}${isNew ? ' · ' + t('Nueva') : ''}`);
      const card = el('span', 'sp-card');
      card.append(pic(n.map));
      if (unlocked) {
        card.append(el('span', 'sp-count' + (full ? ' full' : ''), `${BALL()}${full ? '✓ ' : ''}${got}/${dexes.length}`));
        if (isNew) card.append(el('em', 'sp-new', t('Nueva')));
      } else card.insertAdjacentHTML('beforeend', lockNote(n.req > 0 && leaders[n.req - 1] && leaders[n.req - 1].leader));
      b.append(card, el('span', 'sp-name', n.name.split(' · ')[0]));
      b.onclick = () => pick(b, n, unlocked, false);
      all.push(b);
      // (cuelga del camino por un caminito propio)
      const stand = el('div', 'sp-branch' + (unlocked ? ' open' : ''));
      stand.append(b);
      return stand;
    };
    // El jugador, de pie en el camino al principio del tramo en el que está (antes de sus rutas: si estuviera junto al
    // gimnasio parecería que las rutas ya las ha hecho)
    const you = () => { const y = el('div', 'sp-you'); y.append(el('span', 'sp-you-tag', t('Estás aquí')), this.avatar(40)); return y; };
    // El único botón de jugar del camino: el del siguiente reto
    const goBtn = play => { const go = el('button', 'primary sp-go', t('Desafiar')); go.onclick = e => { e.stopPropagation(); play(); }; return go; };
    // Un gimnasio: la foto de su arena, el líder de pie, el color de su tipo, su número y su medalla colgando
    const leader = n => {
      const unlocked = n.index <= prog, done = n.index < prog, now = n === nextLeader;
      const b = el('button', 'sp-node sp-gym' + (done ? ' done' : '') + (unlocked ? '' : ' locked'));
      b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = `${n.name} · ${n.leader}`;
      b.setAttribute('aria-label', `${n.index + 1}. ${n.name} · ${n.leader} · ${t('Gimnasio · combate')} · ${done ? t('Medalla ganada') : now ? t('Tu siguiente reto') : t('Aún bloqueado')}`);
      const card = el('span', 'sp-card');
      card.append(pic(n.map));
      card.insertAdjacentHTML('beforeend', `${trainerImg(n.id, 'sp-leader')}<em class="sp-ord">${n.index + 1}</em>`
        + `<span class="sp-medal">${badgeImg(region, n.index, done, 30, 'sp-badge')}</span>`
        + (unlocked ? '' : lockNote(n.index > 0 && leaders[n.index - 1].leader)));
      b.append(card, el('span', 'sp-name', `<b>${n.leader}</b>`));
      b.onclick = () => pick(b, n, unlocked, done);
      all.push(b);
      return stop(b, now && (() => this.startStory('gym', n.id)));
    };
    // Una parada en el camino: el sitio y, si es lo que toca (play: cómo se juega), el botón de jugar debajo
    const stop = (b, play) => {
      const s = el('div', 'sp-stop' + (play ? ' now' : ''));
      if (play) { b.classList.add('now'); s.append(b, goBtn(play)); } else s.append(b);
      return s;
    };
    // Cada tramo: el camino con las rutas que se abren en él y, al final, su gimnasio
    const chapter = (routes, head, state) => {
      const ch = el('div', 'sp-ch ' + state);
      if (state === 'now') ch.append(you());
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
        card.insertAdjacentHTML('beforeend', `<img class="sp-stadium" src="tiles/league.png" alt="" draggable="false" loading="lazy">`
          + (cleared ? '<em class="sp-crown">♛</em>' : '') + (open ? '' : lockNote(leaders[Data.LEAGUE_FROM - 1] && leaders[Data.LEAGUE_FROM - 1].leader)));
        b.append(card, el('span', 'sp-name', `<b>${t('Liga Pokémon')}</b>${open && !cleared ? `<small>${t('Combate {n} de {m}', { n: run + 1, m: total })}</small>` : ''}`));
        // (su «Desafiar» también abre su pantalla, que explica los 5 combates seguidos antes de empezar)
        const league = () => { this.leagueRegion = region; this.show('league'); };
        b.onclick = league;
        all.push(b);
        chapter(routes, stop(b, open && !cleared && league), cleared ? 'done' : open ? 'now' : 'locked');
        continue;
      }
      chapter(routes, leader(L), L.index < prog ? 'done' : L === nextLeader ? 'now' : 'locked');
    }
    // Rutas que se abren después del Campeón, y la corona al final del camino (con el jugador, si ya ha llegado)
    const after = nodes.filter(x => x.kind === 'route' && x.req > leaders.length - 1);
    const end = el('div', 'sp-end', cleared ? '<em>♛</em>' : '');
    if (cleared) end.prepend(you());
    chapter(after, end, cleared ? 'done' : 'locked');
    // Al abrir: elegida y en el centro la primera ruta de tu tramo con Pokémon por capturar (lo primero que se puede
    // hacer); si ya las tienes todas, el siguiente líder
    const cur = all.find(b => b.classList.contains('new') && !b.classList.contains('full')) || all.find(b => b.classList.contains('now')) || all.find(b => !b.classList.contains('locked'));
    requestAnimationFrame(() => {
      if (!cur) return;
      if (!cur.classList.contains('sp-league')) cur.click();
      const a = cur.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      // (en el móvil, pegada a la izquierda: así cabe lo que viene después y «Desafiar» no se queda cortado)
      const at = matchMedia('(max-height: 500px), (max-width: 760px)').matches ? 70 : w.width / 2 - a.width / 2;
      wrap.scrollTo({ left: Math.max(0, wrap.scrollLeft + a.left - w.left - at), behavior: 'instant' });
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
