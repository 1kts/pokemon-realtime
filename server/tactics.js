// Jugadas de los líderes: una capa pequeña encima de la IA de utilidad (server/ai.js). Cada líder, Alto Mando y
// Campeón tiene 2 o 3 jugadas propias que encajan con su tipo y su arena (Brock se atrinchera tras las rocas,
// Blaine pelea desde la lava, Blanca va a las baldosas de curación…). Cada jugada tiene una condición; si se cumple,
// retoca la entrada que ya ha decidido la IA (adónde va y, a veces, qué ataque usa) y deja el resto igual: las
// esquivas, la Protección y los cambios siguen siendo de la IA de utilidad.
// Sin trampas: ven lo mismo que la IA (al rival con el retraso de reacción, st.view) y lo que el jugador también ve
// (avisos de la arena, terreno, baldosas). La primera vez que usa cada jugada se anuncia (evento 'tactic').
const D = require('../public/data.js');
const S = require('../public/shared.js');

const { T, F } = S;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const typesOf = mon => D.SPECIES[mon.dex].types;

// Terreno que a unos tipos no les afecta y al rival sí (lava a los de fuego, charcos tóxicos a los de veneno y acero,
// telarañas a los de bicho)
const SAFE = [[T.LAVA, ['fuego']], [T.POISON, ['veneno', 'acero']], [T.WEB, ['bicho']]];
const COVER = new Set(['rock', 'rockwall', 'pillar', 'mirror']);

// Jugadas de cada líder (por id del nodo), en orden de preferencia
const LEADER_PLAYS = {
  brock: ['trinchera', 'cerco'], misty: ['cerco', 'acoso'], surge: ['cerco', 'acoso'], erika: ['emboscada', 'acoso'],
  koga: ['refugio', 'emboscada'], sabrina: ['teletransporte', 'trinchera'], blaine: ['refugio', 'cerco'], giovanni: ['trinchera', 'acoso'],
  lorelei: ['mojado', 'cerco', 'viento'], bruno: ['trinchera', 'cerco', 'acoso'], agatha: ['teletransporte', 'refugio', 'emboscada'],
  lance: ['cerco', 'viento', 'trinchera'], azul: ['curacion', 'cerco', 'trinchera'],
  falkner: ['viento', 'cerco'], bugsy: ['refugio', 'emboscada'], whitney: ['curacion', 'acoso'], morty: ['emboscada', 'acoso'],
  chuck: ['trinchera', 'acoso'], jasmine: ['trinchera', 'acoso'], pryce: ['mojado', 'trinchera', 'acoso'], clair: ['cerco', 'viento'],
  will: ['teletransporte', 'trinchera'], kogaj: ['refugio', 'emboscada'], brunoj: ['trinchera', 'acoso'], karen: ['emboscada', 'cerco'],
  lancej: ['cerco', 'viento', 'acoso'],
};

// ---------- Ayudas ----------
function steer(inp, from, to, w = 1) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d < 6) { inp.mx *= 0.3; inp.my *= 0.3; return d; }
  inp.mx = clamp(inp.mx * 0.35 + dx / d * w, -1, 1);
  inp.my = clamp(inp.my * 0.35 + dy / d * w, -1, 1);
  return d;
}
// ¿Llega este movimiento al rival desde aquí?
function reaches(m, dist, fr) {
  if (m.kind === 'proj') return dist < m.range * 0.92;
  if (m.kind === 'beam') return dist < m.len * 0.92;
  if (m.kind === 'wave') return dist < m.range * 0.9;
  if (m.kind === 'melee') return dist < m.range + fr + 8;
  if (m.kind === 'cone') return dist < m.range + fr - 10;
  if (m.kind === 'dash') return dist < m.dist + 30 && dist > 60;
  if (m.kind === 'area') return m.at === 'self' ? dist < m.radius * 0.85 : dist < m.maxRange;
  return false;
}
// El mejor movimiento que se puede usar ya y que cumple ok(m); score(m) decide entre varios
function pick(c, ok, score = m => m.dmg * D.typeMult(m.type, typesOf(c.fmon))) {
  let best = -1, bs = -Infinity;
  c.mon.moves.forEach((k, i) => {
    const m = D.MOVES[k];
    if (!m || c.mon.cds[i] > 0 || c.side.energy < m.cost || m.selfKO || !m.dmg || !reaches(m, c.view.dist, c.fmon.r) || !ok(m)) return;
    const s = score(m);
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}
// Lanza el movimiento i al rival (con la misma anticipación que la IA de utilidad)
function cast(c, i) {
  if (i < 0 || c.inp.c === 4 || c.inp.sw >= 0 || !c.b.canAct(c.side)) return false;
  c.ai.aimMove(c.inp, c.side, c.view, c.view.dist, D.MOVES[c.mon.moves[i]], c.skill);
  c.inp.c = i;
  return true;
}
const nearest = (list, p) => list.reduce((best, q) => (!best || Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? q : best), null);

// ---------- Jugadas ----------
// Cada una: fits(b) = ¿tiene sentido en esta arena? · when(c) = ¿ahora? · act(c) = qué hace · max = cuánto dura como mucho (s)
const PLAYS = {
  // Ponerse detrás de una roca (o pilar, espejo, roca caída) respecto al rival cuando carga un ataque a distancia o
  // cuando hay que recargar energía con poca vida, y atacar desde ahí con lo que no necesita línea de tiro (áreas).
  // Poco rato: escondido todo el combate tampoco pega
  trinchera: {
    max: 3,
    fits: (b) => b.obstacles.some(o => COVER.has(o.kind)) || !!(b.arena.m.rockfall || b.arena.m.pillars),
    when: c => !c.view.hidden && c.view.dist > 130 && (c.foeAiming || (c.myHp < 0.5 && c.side.energy < 40)),
    act(c) {
      let best = null, bd = 320;
      for (const o of c.b.obstacles) {
        if (!COVER.has(o.kind)) continue;
        const ox = o.x - c.view.x, oy = o.y - c.view.y, od = Math.hypot(ox, oy) || 1;
        const p = { x: o.x + ox / od * (o.r + c.mon.r + 8), y: o.y + oy / od * (o.r + c.mon.r + 8) };
        if (p.x < 40 || p.y < 40 || p.x > S.ARENA.w - 40 || p.y > S.ARENA.h - 40) continue;
        const d = Math.hypot(p.x - c.side.x, p.y - c.side.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) return false;
      const d = steer(c.inp, c.side, best);
      if (d < 30) cast(c, pick(c, m => m.kind === 'area' && m.at !== 'self'));
      return true;
    },
  },
  // El rival está en una zona avisada de la arena (roca que cae, géiser, placa, erupción, rayo): ralentizarlo o
  // aturdirlo para que no salga a tiempo
  cerco: {
    fits: (b) => ['rockfall', 'geyser', 'shock', 'eruption', 'storm'].some(k => b.arena.m[k]),
    when: c => !c.view.hidden && c.b.arena.danger.some(d => d.t > 0.25 && Math.hypot(c.view.x - d.x, c.view.y - d.y) < d.r + 6),
    act: c => cast(c, pick(c, m => m.stun || m.slow, m => (m.stun ? 2 : 1) + m.dmg / 100)) || cast(c, pick(c, m => m.kind !== 'dash')),
  },
  // Pelear desde el terreno que a su tipo no le afecta y al rival sí (que tenga que entrar para pegarle), cuando el
  // rival se acerca o solo pega de cerca
  refugio: {
    fits: (b) => SAFE.some(([t]) => b.base.includes(t)),
    when: c => !c.view.hidden && c.safe && c.foeAvoids(c.safe) && (c.view.dist < 130 || !c.foeRanged),
    act(c) {
      if (c.b.terrain[S.cellIndex(c.side.x, c.side.y)] === c.safe) { c.inp.mx *= 0.5; c.inp.my *= 0.5; return true; }
      let best = null, bd = 300;
      c.b.terrain.forEach((t, i) => {
        if (t !== c.safe) return;
        const p = S.cellCenter(i), d = Math.hypot(p.x - c.side.x, p.y - c.side.y);
        if (d < bd && Math.hypot(p.x - c.view.x, p.y - c.view.y) > 90) { bd = d; best = p; }
      });
      if (!best) return false;
      steer(c.inp, c.side, best);
      return true;
    },
  },
  // Esconderse (hierba alta, niebla u oscuridad) mientras recarga energía, sin atacar para no descubrirse, y salir a
  // pegar cuando el rival se acerca
  emboscada: {
    max: 3,
    fits: (b) => b.base.includes(T.GRASS) || !!b.arena.m.fog || !!b.arena.dark || !!b.arena.m.regrow,
    when: c => c.view.dist > 90 && c.myHp > 0.3 && (c.side.energy < 35 || (c.side.hidden && c.view.dist < 190)),
    act(c) {
      if (c.side.hidden && c.view.dist < 190) return cast(c, pick(c, () => true, m => m.dmg * D.typeMult(m.type, typesOf(c.fmon)) * (m.kind === 'melee' || m.kind === 'cone' || m.kind === 'dash' ? 1.3 : 1)));
      let spot = null;
      if (c.b.arena.dark) {
        // A oscuras basta con alejarse más allá de lo que se ve
        if (c.view.dist > c.b.arena.dark + 30) spot = { x: c.side.x, y: c.side.y };
        else { const a = Math.atan2(c.side.y - c.view.y, c.side.x - c.view.x); spot = { x: clamp(c.view.x + Math.cos(a) * (c.b.arena.dark + 60), 60, S.ARENA.w - 60), y: clamp(c.view.y + Math.sin(a) * (c.b.arena.dark + 60), 60, S.ARENA.h - 60) }; }
      } else {
        const spots = [...c.b.arena.fog];
        c.b.terrain.forEach((t, i) => { if (t === T.GRASS) spots.push(S.cellCenter(i)); });
        spot = nearest(spots.filter(p => Math.hypot(p.x - c.view.x, p.y - c.view.y) > 140), c.side);
      }
      if (!spot) return false;
      steer(c.inp, c.side, spot);
      if (c.inp.c >= 0 && c.inp.c < 4 && D.MOVES[c.mon.moves[c.inp.c]].cost > 0) c.inp.c = -1;   // (la energía, para salir a pegar)
      return true;
    },
  },
  // Con poca vida, a las baldosas de curación mientras les quede carga (las flores de Erika curan muy despacio: no compensa)
  curacion: {
    fits: (b) => !!b.arena.pads,
    when: c => { const p = c.myHp < 0.55 && !c.b.sudden && c.healSpot(); return !!p && Math.hypot(p.x - c.side.x, p.y - c.side.y) < 300; },
    act(c) { steer(c.inp, c.side, c.healSpot()); return true; },
  },
  // El rival está mojado: hielo o electricidad, que le hacen más daño
  mojado: {
    fits: (b) => b.base.includes(T.WATER) || !!(b.arena.m.tide || b.arena.m.crack || b.arena.m.ice),
    when: c => !c.view.hidden && !!(c.view.flags & F.WET),
    act: c => cast(c, pick(c, m => m.type === 'hielo' || m.type === 'electrico')),
  },
  // El rival está tocado y yo no: a por él, con lo más fuerte y sin guardar energía
  acoso: {
    fits: () => true,
    when: c => !c.view.hidden && c.foeHp < 0.35 && c.myHp > c.foeHp + 0.15,
    act(c) {
      if (c.view.dist > 90) steer(c.inp, c.side, c.view, 0.9);
      cast(c, pick(c, () => true));
      return true;
    },
  },
  // Con poca vida y el rival encima: escapar por el teletransporte más cercano
  teletransporte: {
    fits: (b) => S.parseMap(b.mapName).pads.length > 0 && !!b.arena.m.warp,
    when: c => c.myHp < 0.3 && c.view.dist < 180 && c.b.arena.warpCd && c.b.arena.warpCd[c.side.idx] <= 0,
    act(c) {
      const ends = S.parseMap(c.b.mapName).pads.flatMap(([p, q]) => [{ ...p, to: q }, { ...q, to: p }])
        .filter(p => Math.hypot(p.to.x - c.view.x, p.to.y - c.view.y) > 220);
      const pad = nearest(ends, c.side);
      if (!pad) return false;
      steer(c.inp, c.side, pad);
      return true;
    },
  },
  // Sopla el viento y el rival no vuela (lo arrastra, va donde se le espera): a dispararle
  viento: {
    fits: (b) => !!b.arena.m.wind,
    when: c => !c.view.hidden && !!c.b.arena.windFor(c.f),
    act: c => cast(c, pick(c, m => m.kind === 'proj' || m.kind === 'beam' || m.kind === 'wave' || (m.kind === 'area' && m.at !== 'self'))),
  },
};

// Contexto de un tick para las jugadas (lo que ya ha visto y calculado la IA de utilidad)
function context(b, side, inp, ai) {
  const st = side.aiState, f = b.foe(side), mon = b.mon(side), fmon = b.mon(f);
  const myTypes = typesOf(mon), foeTypes = typesOf(fmon);
  const safeOf = types => (SAFE.find(([t, ok]) => ok.some(x => types.includes(x)) && b.base.includes(t)) || [])[0];
  const c = {
    b, side, st, inp, ai, f, mon, fmon, view: st.view, skill: st.skill,
    myHp: mon.hp / mon.maxHp, foeHp: fmon.hp / fmon.maxHp,
    // (el rival carga algo a distancia apuntado hacia mí, o ya viene un proyectil suyo hacia mí: lo mismo que ve un jugador)
    foeAiming: !!(f.wind && !f.hidden && ['proj', 'beam', 'wave'].includes(f.wind.m.kind) && Math.abs(Math.atan2(Math.sin(Math.atan2(side.y - f.y, side.x - f.x) - f.wind.a), Math.cos(Math.atan2(side.y - f.y, side.x - f.x) - f.wind.a))) < 0.5)
      || b.projectiles.some(p => p.owner === f && (p.vx * (side.x - p.x) + p.vy * (side.y - p.y)) > 0.9 * Math.hypot(p.vx, p.vy) * Math.hypot(side.x - p.x, side.y - p.y)),
    foeRanged: fmon.moves.some(k => ['proj', 'beam', 'wave'].includes(D.MOVES[k] && D.MOVES[k].kind)),
    safe: safeOf(myTypes) ?? null,
    foeAvoids: t => !SAFE.find(([x, ok]) => x === t && ok.some(y => foeTypes.includes(y))) && !(t === T.LAVA && foeTypes.includes('volador')),
    healSpot() {
      if (b.arena.pads) return nearest(b.arena.pads.filter(p => p.cd <= 0 && p.c > 0.3).map(p => ({ x: p.x, y: p.y })), side);
      return null;
    },
  };
  return c;
}

// Las jugadas que tiene un líder en esta arena (las que no encajan con ella no se usan)
function playsOf(b, id) { return (LEADER_PLAYS[id] || []).filter(k => PLAYS[k] && PLAYS[k].fits(b)); }

// Aplica la jugada que toque (la primera de su lista cuya condición se cumpla) y la anuncia la primera vez.
// Una jugada empezada dura al menos un momento, para que no tiemble entre ticks
function leaderPlay(b, side, inp, dt, ai) {
  const st = side.aiState;
  if (!st.view || b.state !== 'fight' || side.forced > 0 || inp.sw >= 0) return null;
  st.plays = st.plays || playsOf(b, side.leader);
  if (!st.plays.length) return null;
  const c = context(b, side, inp, ai);
  st.playHold = Math.max(0, (st.playHold || 0) - dt);
  // (las que tienen max no se alargan más: luego descansan otro tanto, para que el combate no se quede parado)
  st.rest = st.rest || {};
  const ready = k => !(st.rest[k] > b.t) && PLAYS[k].when(c);
  const play = st.playHold > 0 && st.play && ready(st.play) ? st.play : st.plays.find(ready);
  if (!play || !PLAYS[play].act(c)) { st.play = null; return null; }
  if (play !== st.play) { st.playHold = 0.6; st.playSince = b.t; }
  st.play = play;
  if (PLAYS[play].max && b.t - st.playSince > PLAYS[play].max) st.rest[play] = b.t + PLAYS[play].max;
  // (pasado el «¡A combatir!», que si no el aviso se pierde entre los de la cuenta atrás)
  st.announced = st.announced || new Set();
  if (!st.announced.has(play) && (b.fightT || 0) > 1.2) { st.announced.add(play); b.ev({ k: 'tactic', s: side.idx, id: play }); }
  return play;
}

module.exports = { PLAYS, LEADER_PLAYS, playsOf, leaderPlay };
