// Historia como un camino (vista «Camino»): el viaje de la región en una sola línea, de izquierda a derecha. El eje
// son los gimnasios en orden (luego la Liga); de cada tramo cuelgan las rutas que abre la medalla de antes, que son
// opcionales (para capturar). Lo hecho, en color y con el eje continuo; lo que toca, grande y dorado (lo único que
// late, con el único botón de jugar); lo que falta, apagado, con el eje discontinuo y diciendo qué lo abre. Las rutas
// dicen cuántos de sus Pokémon has capturado. Tocar un sitio abre su ficha al lado, como en el mapa. Pensado para que
// lo entienda quien no ha jugado nunca a Pokémon: palabras sencillas y una leyenda
import { monIcon, trainerImg } from './sprites.js';
import { badgeImg, item as itemImg } from './pixicons.js';
import { t } from './i18n.js';
import { REGION_ART } from './regionmap.js';

const { TYPE_COLOR } = Data;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const LEAGUE_IMG = '<img class="league-ico" src="tiles/league.png" alt="" draggable="false">';

export const storyPathViews = {
  storyPath(region, nodes, prog, nextLeader, info) {
    const p = this.profile;
    const leaders = nodes.filter(n => n.kind !== 'route');
    const cleared = prog >= leaders.length;
    const run = p.leagueRun && p.leagueRun.region === region ? p.leagueRun.step : 0;
    const wrap = el('div', 'story-path scroll');
    const track = el('div', 'sp-track');
    wrap.append(track);
    const legend = el('div', 'sp-legend', `<span><i class="sp-k done"></i>${t('Medalla ganada')}</span><span><i class="sp-k now"></i>${t('Tu siguiente reto')}</span>`
      + `<span>${itemImg('pokeball', 14)}${t('Rutas: Pokémon capturados')}</span><span><i class="sp-k locked"></i>${t('Aún bloqueado')}</span>`);
    const all = [];
    const pick = (b, n, unlocked, done) => {
      all.forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      this.nodeInfo(info, n, unlocked, done);
    };
    // Una ruta: su Pokémon, el anillo de lo capturado y la estrella si es nueva
    const route = n => {
      const unlocked = n.req <= prog, isNew = unlocked && n.req === prog;
      const dexes = [...new Set(n.wild.map(([d]) => d))], got = dexes.filter(d => p.caught.includes(d)).length;
      const b = el('button', 'sp-node sp-route' + (unlocked ? '' : ' locked') + (isNew ? ' new' : '') + (unlocked && got === dexes.length ? ' full' : ''));
      b.style.setProperty('--prog', dexes.length ? got / dexes.length : 0);
      b.title = unlocked ? `${n.name} · ${t('{a}/{b} capturados', { a: got, b: dexes.length })}` : n.name;
      const dot = el('span', 'sp-dot');
      if (unlocked && n.wild.length) dot.append(monIcon(n.wild[0][0], 32));
      b.append(dot, el('span', 'sp-name', n.name));
      // (lo que has capturado de los que salen en ella: con todos, en verde y con ✓)
      if (unlocked) b.append(el('span', 'sp-count' + (got === dexes.length ? ' full' : ''), `${itemImg('pokeball', 14)}${got === dexes.length ? '✓ ' : ''}${got}/${dexes.length}`));
      if (isNew) b.append(el('em', 'sp-new', t('Nueva')));
      b.onclick = () => pick(b, n, unlocked, false);
      all.push(b);
      return b;
    };
    // Un líder del eje: su medalla (o su cara en el Alto Mando), su número y su nombre
    const leader = n => {
      const unlocked = n.index <= prog, done = n.index < prog, now = n === nextLeader;
      const b = el('button', 'sp-node sp-gym' + (done ? ' done' : '') + (now ? ' now' : '') + (unlocked ? '' : ' locked'));
      b.style.setProperty('--tc', TYPE_COLOR[n.type]);
      b.title = `${n.name} · ${n.leader}`;
      const face = n.kind === 'gym' ? badgeImg(region, n.index, done, 34, 'sp-badge') : trainerImg(n.id, 'sp-face');
      b.append(el('span', 'sp-dot', face), el('span', 'sp-name', `<b>${n.leader}</b>${now ? `<small>${n.name}</small>` : ''}`));
      if (n.kind === 'gym') b.append(el('em', 'sp-ord', String(n.index + 1)));
      b.onclick = () => pick(b, n, unlocked, done);
      all.push(b);
      if (!now) return b;
      // El único botón de jugar del camino: el del siguiente reto
      const box = el('div', 'sp-nowbox');
      const go = el('button', 'primary sp-go', t('Desafiar'));
      go.onclick = e => { e.stopPropagation(); this.startStory('gym', n.id); };
      box.append(b, go);
      return box;
    };
    // Cada tramo: arriba, las rutas que se abren con las medallas que llevas hasta él; abajo, en el eje, su líder
    const chapter = (routes, head, state, opener) => {
      const ch = el('div', 'sp-ch ' + state);
      const top = el('div', 'sp-routes');
      if (state === 'locked' && opener) top.append(el('p', 'sp-lock', t('Se abre al vencer a {who}', { who: opener })));
      routes.forEach(n => top.append(route(n)));
      const spine = el('div', 'sp-spine');
      spine.append(head);
      ch.append(top, spine);
      track.append(ch);
      return ch;
    };
    const start = el('div', 'sp-start', `<b>${t(this.regionStart(region))}</b>`);
    track.append(start);
    for (const L of leaders) {
      const routes = nodes.filter(x => x.kind === 'route' && x.req === L.index);
      if (L.index >= Data.LEAGUE_FROM) {
        if (L.index > Data.LEAGUE_FROM) continue;
        // La Liga, un solo sitio que abre su pantalla (5 combates seguidos)
        const open = prog >= Data.LEAGUE_FROM;
        const b = el('button', 'sp-node sp-gym sp-league' + (cleared ? ' done' : '') + (open && !cleared ? ' now' : '') + (open ? '' : ' locked'));
        b.append(el('span', 'sp-dot', LEAGUE_IMG), el('span', 'sp-name', `<b>${t('Liga Pokémon')}</b>${open && !cleared ? `<small>${t('Combate {n} de {m}', { n: run + 1, m: leaders.length - Data.LEAGUE_FROM })}</small>` : ''}`));
        b.onclick = () => { this.leagueRegion = region; this.show('league'); };
        all.push(b);
        chapter(routes, b, cleared ? 'done' : open ? 'now' : 'locked', leaders[Data.LEAGUE_FROM - 1] && leaders[Data.LEAGUE_FROM - 1].leader);
        continue;
      }
      chapter(routes, leader(L), L.index < prog ? 'done' : L === nextLeader ? 'now' : 'locked', L.index > 0 && leaders[L.index - 1].leader);
    }
    // Rutas que se abren después del Campeón
    const after = nodes.filter(x => x.kind === 'route' && x.req > leaders.length - 1);
    if (after.length) chapter(after, el('span', 'sp-end', cleared ? '♛' : ''), cleared ? 'done' : 'locked');
    // Al abrir: elegido y a la vista lo que toca (el siguiente líder o, si no, la primera ruta nueva)
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
