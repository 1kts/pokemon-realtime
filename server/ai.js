// IA de combate basada en utilidad y estados. Genera la misma entrada que un jugador (mover,
// apuntar, movimiento, cambio), así que no hace trampas: ve al rival con retraso de reacción.
//
// Cada tick calcula una AGRESIVIDAD (0-1) a partir de la vida de ambos, Pokémon que quedan,
// ventaja de tipo, energía y la personalidad de su Pokémon, y con ella elige un estado:
//   ATACAR   (agresividad alta): se acerca a su distancia ideal y usa lo más fuerte.
//   TANTEAR  (media): mantiene la distancia, pica con básicos y castiga los errores del rival.
//   DEFENDER (baja): se aleja, se esconde, se cura, se protege más y cambia de Pokémon.
// La personalidad sale de los movimientos: luchador (cuerpo a cuerpo), francotirador (a distancia),
// controlador (áreas y aturdimientos) o tanque (mucha vida o curaciones).
// La habilidad (skill 0-1) solo controla la ejecución: reflejos, puntería, esquivas, parry,
// lectura de oportunidades, disciplina con la energía y cuántas dudas/errores comete.
// Los salvajes son más simples: deambulan, atacan a ratos, apenas esquivan y nunca usan Protección.
const D = require('../public/data.js');
const S = require('../public/shared.js');

const { T, F } = S;
const rnd = () => Math.random();
const clamp01 = v => Math.max(0, Math.min(1, v));

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Personalidad de una especie según sus movimientos y estadísticas
const personalities = new Map();
function personality(dex) {
  let p = personalities.get(dex);
  if (p) return p;
  const sp = D.SPECIES[dex];
  const moves = sp.moves.map(k => D.MOVES[k]);
  const melee = moves.filter(m => m.kind === 'melee' || m.kind === 'dash' || m.kind === 'cone').length;
  const control = moves.filter(m => m.kind === 'area' || m.stun || m.slow || m.kind === 'wall').length;
  const heals = moves.some(m => m.kind === 'heal');
  if (melee >= 2) p = { style: 'luchador', range: 55, aggro: 0.65 };
  else if (sp.hp >= 135 || heals) p = { style: 'tanque', range: 170, aggro: 0.5 };
  else if (control >= 2) p = { style: 'controlador', range: 230, aggro: 0.45 };
  else p = { style: 'francotirador', range: 260, aggro: 0.4 };
  personalities.set(dex, p);
  return p;
}

// Tiempo hasta el impacto de un proyectil contra un punto (o null si no viene hacia él)
function threatOf(p, me, r) {
  const v2 = p.vx * p.vx + p.vy * p.vy;
  if (!v2) return null;
  const t = ((me.x - p.x) * p.vx + (me.y - p.y) * p.vy) / v2;
  if (t < 0 || t > 0.8) return null;
  const miss = Math.hypot(me.x - (p.x + p.vx * t), me.y - (p.y + p.vy * t));
  if (miss > r + (p.wide || p.r) + 6) return null;   // las olas son anchas
  return { t, vx: p.vx, vy: p.vy, id: p.id };
}

// Lo más eficaz que el rival puede pegarme por tipos (con STAB)
function worstThreat(fmon, mon) {
  const myTypes = D.SPECIES[mon.dex].types;
  return Math.max(...D.SPECIES[fmon.dex].types.map(t => D.typeMult(t, myTypes)));
}
function myBestEdge(mon, fmon) {
  const foeTypes = D.SPECIES[fmon.dex].types;
  return Math.max(...(mon.moves || D.SPECIES[mon.dex].moves).map(k => D.MOVES[k]).filter(m => m.dmg).map(m => D.typeMult(m.type, foeTypes)), 1);
}

function bestSwap(side, fmon, except) {
  let best = -1, bestScore = -Infinity;
  side.team.forEach((m, i) => {
    if (i === except || m.fainted || i === side.act) return;
    const score = -worstThreat(fmon, m) * 1.5 + myBestEdge(m, fmon) + (m.hp / m.maxHp) * 1.5;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// Decide una vez por amenaza (si esquiva, si para…) para no temblar entre ticks
function decide(st, key, prob) {
  if (!st.decided.has(key)) st.decided.set(key, rnd() < prob);
  return st.decided.get(key);
}

function aiInput(b, side, dt) {
  const st = side.aiState;
  const skill = side.ai;
  const inp = { s: 0, mx: 0, my: 0, a: side.a, tx: side.x, ty: side.y, c: -1, sw: -1 };
  if (b.state !== 'fight') return inp;
  const mon = b.mon(side);
  const f = b.foe(side);
  const fmon = b.mon(f);
  const r = mon.r, fr = fmon.r;   // radios de colisión (los pequeños son difíciles de acertar)
  st.decided = st.decided || new Map();
  if (st.decided.size > 300) st.decided.clear();

  // ---------- Percepción con retraso de reacción ----------
  st.hist = st.hist || [];
  if (!f.hidden) { st.hist.push({ x: f.x, y: f.y, flags: b.flags(f) }); st.lastSeen = { x: f.x, y: f.y }; }
  if (st.hist.length > 30) st.hist.shift();
  const delay = Math.round((0.42 - 0.3 * skill) * S.TICK);
  const seen = st.hist.length ? st.hist[Math.max(0, st.hist.length - 1 - delay)] : null;
  const target = f.hidden || !seen ? (st.lastSeen || { x: S.ARENA.w / 2, y: S.ARENA.h / 2 }) : seen;
  const prev = st.hist[Math.max(0, st.hist.length - 5 - delay)] || target;
  const vel = { x: (target.x - prev.x) / (4 * dt), y: (target.y - prev.y) / (4 * dt) };
  const dx = target.x - side.x, dy = target.y - side.y;
  const dist = Math.hypot(dx, dy) || 1;
  const toFoe = Math.atan2(dy, dx);
  const foeFlags = seen && !f.hidden ? seen.flags : 0;

  // Cambio forzado tras un debilitado: el que mejor aguante al rival
  if (side.forced > 0) { if (side.swapTo < 0) inp.sw = bestSwap(side, fmon, -1); return inp; }

  // ---------- Agresividad y estado ----------
  const pers = personality(mon.dex);
  const myHp = mon.hp / mon.maxHp, foeHp = fmon.hp / fmon.maxHp;
  const myAlive = side.team.filter(m => !m.fainted).length, foeAlive = f.team.filter(m => !m.fainted).length;
  let aggro = pers.aggro
    + (myHp - foeHp) * 0.6                       // voy ganando -> aprieto; voy perdiendo -> cuidado
    + (myAlive - foeAlive) * 0.08
    + (myBestEdge(mon, fmon) - worstThreat(fmon, mon)) * 0.15
    + (side.energy / 100 - 0.5) * 0.25;
  if (foeHp < 0.25) aggro += 0.25;               // rematar
  if (myHp < 0.3) aggro -= 0.3;                  // poca vida -> defensivo
  if (foeFlags & (F.STUN | F.REC)) aggro += 0.2 * skill;   // el rival está vendido
  aggro = clamp01(aggro);
  // Histéresis: no cambia de estado por pequeñas variaciones
  const prevMode = st.mode || 'tantear';
  let mode = aggro > 0.62 ? 'atacar' : aggro < 0.33 ? 'defender' : 'tantear';
  if (prevMode === 'atacar' && aggro > 0.55) mode = 'atacar';
  if (prevMode === 'defender' && aggro < 0.4) mode = 'defender';
  st.mode = mode;

  // ---------- Movimiento ----------
  const moves = mon.moves.map(k => D.MOVES[k]);
  const want = mode === 'atacar' ? pers.range : mode === 'tantear' ? pers.range + 50 : Math.max(330, pers.range + 120);
  st.strafeT = (st.strafeT || 0) - dt;
  if (st.strafeT <= 0) { st.strafe = rnd() < 0.5 ? -1 : 1; st.strafeT = 0.7 + rnd() * 1.5; }
  let radial = Math.max(-1, Math.min(1, (dist - want) / 70));
  if (f.hidden) {   // buscarlo donde se le vio; si no está, patrullar
    radial = dist > 50 ? 1 : 0;
    if (dist <= 50) st.lastSeen = { x: S.ARENA.w / 2 + (rnd() - 0.5) * 400, y: S.ARENA.h / 2 + (rnd() - 0.5) * 300 };
  }
  const strafeAmt = mode === 'defender' ? 0.9 : 0.6;
  let mx = (dx / dist) * radial + (-dy / dist) * st.strafe * strafeAmt;
  let my = (dy / dist) * radial + (dx / dist) * st.strafe * strafeAmt;
  // Salvaje: buena parte del tiempo va a su aire, a un punto al azar
  if (side.wild) {
    st.wanderT = (st.wanderT || 0) - dt;
    if (st.wanderT <= 0) {
      st.wanderT = 1 + rnd() * 2;
      st.wander = rnd() < 0.55 ? { x: 120 + rnd() * (S.ARENA.w - 240), y: 100 + rnd() * (S.ARENA.h - 200) } : null;
    }
    if (st.wander) {
      const wx = st.wander.x - side.x, wy = st.wander.y - side.y, wd = Math.hypot(wx, wy) || 1;
      mx = wd > 20 ? wx / wd * 0.7 : 0; my = wd > 20 ? wy / wd * 0.7 : 0;
    }
  }

  // Defendiendo: buscar hierba alta cercana (lejos del rival) para esconderse
  if (mode === 'defender' && skill > 0.3) {
    st.coverT = (st.coverT || 0) - dt;
    if (st.coverT <= 0) {
      st.coverT = 2;
      let best = null, bd = 260;
      b.terrain.forEach((t, i) => {
        if (t !== T.GRASS) return;
        const c = S.cellCenter(i);
        const d = Math.hypot(c.x - side.x, c.y - side.y);
        if (d < bd && Math.hypot(c.x - target.x, c.y - target.y) > 180) { bd = d; best = c; }
      });
      st.cover = best;
    }
    if (st.cover) { const cd = Math.hypot(st.cover.x - side.x, st.cover.y - side.y) || 1; mx += (st.cover.x - side.x) / cd * 0.8; my += (st.cover.y - side.y) / cd * 0.8; }
  }

  // Esquivar proyectiles que vienen hacia mí
  let threat = null;
  const dodgeP = (0.08 + 0.72 * skill) * (side.wild ? 0.4 : 1);
  for (const p of b.projectiles) {
    if (p.owner === side) continue;
    const th = threatOf(p, side, r);
    if (!th) continue;
    if (!threat || th.t < threat.t) threat = th;
    if (decide(st, 'd' + p.id, dodgeP)) {
      const len = Math.hypot(th.vx, th.vy);
      const s1 = (side.x - p.x) * -th.vy + (side.y - p.y) * th.vx >= 0 ? 1 : -1;
      mx += (-th.vy / len) * s1 * 2; my += (th.vx / len) * s1 * 2;
    }
  }
  // Salir de las zonas marcadas
  for (const ar of b.areas) {
    if (ar.owner === side) continue;
    const d = Math.hypot(side.x - ar.x, side.y - ar.y);
    if (d < ar.m.radius + r + 10 && decide(st, 'a' + ar.x + ':' + ar.y, dodgeP)) {
      mx += (side.x - ar.x) / (d || 1) * 2.5; my += (side.y - ar.y) / (d || 1) * 2.5;
    }
  }
  // Ataque cargándose contra mí: apartarse de la línea o del círculo
  if (f.wind && !f.hidden) {
    const m = f.wind.m;
    const key = 'w' + Math.floor(b.t * 2) + ':' + f.wind.c;
    if (m.kind === 'area' && m.at === 'cursor' && Math.hypot(side.x - f.wind.tx, side.y - f.wind.ty) < m.radius + r) {
      if (decide(st, key, dodgeP)) { const a = Math.atan2(side.y - f.wind.ty, side.x - f.wind.tx); mx += Math.cos(a) * 2.5; my += Math.sin(a) * 2.5; }
    } else if (m.kind === 'cone' && dist < m.range + r + 30) {
      // Cono: salir hacia atrás, fuera de su alcance
      if (decide(st, key, dodgeP)) { const a = Math.atan2(side.y - f.y, side.x - f.x); mx += Math.cos(a) * 2.5; my += Math.sin(a) * 2.5; }
    } else if ((m.kind === 'beam' || m.kind === 'proj' || m.kind === 'dash' || m.kind === 'wave') && Math.abs(angleDiff(f.wind.a, Math.atan2(side.y - f.y, side.x - f.x))) < (m.kind === 'wave' ? 0.7 : 0.35)) {
      if (decide(st, key, dodgeP * 0.85)) { mx += -Math.sin(f.wind.a) * st.strafe * 2.5; my += Math.cos(f.wind.a) * st.strafe * 2.5; }
    }
  }
  // Terremoto de la arena en camino: ponerse detrás de la roca más cercana (vista desde el epicentro)
  const quake = b.arena && b.arena.quakes && b.arena.quakes.find(q => !q.hit.has(side.idx) && q.t * ((b.arena.m.quake || {}).speed || 0) < Math.hypot(side.x - q.x, side.y - q.y));
  if (quake && skill > 0.35 && !D.SPECIES[b.mon(side).dex].types.includes('volador') && decide(st, 'q' + Math.round(quake.x), dodgeP)) {
    let best = null, bd = 280;
    for (const o of b.obstacles) {
      if (o.kind === 'ghost') continue;
      const ox = o.x - quake.x, oy = o.y - quake.y, od = Math.hypot(ox, oy) || 1;
      const cx = o.x + ox / od * (o.r + r + 6), cy = o.y + oy / od * (o.r + r + 6);
      const d = Math.hypot(cx - side.x, cy - side.y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    if (best && bd > 4) { mx += (best.x - side.x) / bd * 2.5; my += (best.y - side.y) / bd * 2.5; }
  }
  // Peligros de la arena avisados (rocas, erupciones, placas): salir de la zona
  for (const d of (b.arena && b.arena.danger) || []) {
    const dd = Math.hypot(side.x - d.x, side.y - d.y);
    if (dd < d.r + r + 8 && decide(st, 'z' + Math.round(d.x) + ':' + Math.round(d.y), dodgeP)) {
      mx += (side.x - d.x) / (dd || 1) * 2.5; my += (side.y - d.y) / (dd || 1) * 2.5;
    }
  }
  // Fuego, lava, veneno, bordes y atascos (su propio tipo no lo nota)
  const types = D.SPECIES[b.mon(side).dex].types;
  const bad = t => t === T.FIRE || (t === T.LAVA && !types.includes('fuego')) || (t === T.POISON && skill > 0.3 && !types.includes('veneno') && !types.includes('acero'));
  const ahead = b.terrain[S.cellIndex(side.x + mx * 30, side.y + my * 30)];
  if (bad(ahead) && skill > 0.15) { const t = mx; mx = -my; my = t; }
  if (bad(b.terrain[S.cellIndex(side.x, side.y)])) { mx += (S.ARENA.w / 2 - side.x) / 250; my += (S.ARENA.h / 2 - side.y) / 250; }
  const edge = 70;
  if (side.x < edge) mx += (edge - side.x) / edge * 1.5;
  if (side.x > S.ARENA.w - edge) mx -= (side.x - (S.ARENA.w - edge)) / edge * 1.5;
  if (side.y < edge) my += (edge - side.y) / edge * 1.5;
  if (side.y > S.ARENA.h - edge) my -= (side.y - (S.ARENA.h - edge)) / edge * 1.5;
  const wantsMove = Math.abs(mx) + Math.abs(my) > 0.5;
  st.stuck = st.last && wantsMove && Math.hypot(side.x - st.last.x, side.y - st.last.y) < 0.3 ? (st.stuck || 0) + dt : 0;
  st.last = { x: side.x, y: side.y };
  if (st.stuck > 0.4) { st.strafe *= -1; st.strafeT = 1; st.stuck = 0; const t = mx; mx = -my * 1.5; my = t * 1.5; }
  inp.mx = Math.max(-1, Math.min(1, mx)); inp.my = Math.max(-1, Math.min(1, my));

  // ---------- Protección / parry ----------
  if (side.pcd <= 0 && side.prot < 0 && !side.wild) {
    const guard = mode === 'defender' ? 0.15 : 0;
    if (threat && threat.t < 0.1 && decide(st, 'p' + threat.id, Math.pow(skill, 1.5) * 0.55 + guard)) { inp.c = 4; return aim(inp, toFoe, skill); }
    if (f.wind && !f.hidden) {
      const m = f.wind.m, left = m.wind - f.wind.t;
      const aimed = Math.abs(angleDiff(f.wind.a, Math.atan2(side.y - f.y, side.x - f.x))) < 0.4;
      const inRange = m.kind === 'melee' || m.kind === 'cone' ? dist < m.range + r + 20 : m.kind === 'beam' ? dist < m.len : m.kind === 'dash' ? dist < m.dist + 40 : false;
      if (aimed && inRange && left < 0.06 + (1 - skill) * 0.06 && decide(st, 'pw' + Math.floor(b.t * 2), skill * 0.45 + guard)) { inp.c = 4; return aim(inp, toFoe, skill); }
    }
  }

  // ---------- Cambio de Pokémon ----------
  st.swapEval = (st.swapEval || 0) - dt;
  if (st.swapEval <= 0 && side.swapCd <= 0 && b.canAct(side) && side.team.length > 1 && skill > 0.25) {
    st.swapEval = 2;
    const best = bestSwap(side, fmon, side.act);
    if (best >= 0) {
      const other = side.team[best];
      const badMatch = worstThreat(fmon, mon) >= 1.5 && worstThreat(fmon, other) < worstThreat(fmon, mon);
      const saveMe = mode === 'defender' && myHp < 0.3 && other.hp / other.maxHp > 0.5;
      if ((badMatch && rnd() < skill * 0.5) || (saveMe && rnd() < skill * 0.45)) { inp.sw = best; return inp; }
    }
  }

  // ---------- Ataque ----------
  // Dudas: las IA torpes a veces se quedan pensando
  st.pause = Math.max(0, (st.pause || 0) - dt);
  if (st.pause <= 0 && rnd() < (1 - skill) * 0.012) st.pause = 0.3 + rnd() * 0.7;
  if (st.pause > 0 || !b.canAct(side) || (f.hidden && !st.lastSeen)) return aim(inp, toFoe, skill);
  // Cadencia: una IA torpe ataca a ratos; una experta, en cuanto tiene sentido
  let cadence = 0.05 + 0.4 * Math.pow(skill, 1.2) + (mode === 'atacar' ? 0.1 : mode === 'defender' ? -0.03 : 0);
  if (side.wild) cadence *= st.wander ? 0.25 : 0.6;   // los salvajes atacan poco, y menos mientras deambulan
  if (rnd() > cadence) return aim(inp, toFoe, skill);

  const opening = (foeFlags & (F.STUN | F.REC | F.WIND)) && rnd() < 0.3 + 0.7 * skill;   // ¿lo ve vendido?
  const reserve = skill > 0.45 ? 25 : 0;    // las buenas guardan energía para escapar
  let best = null, bestU = 0;
  moves.forEach((m, i) => {
    if (mon.cds[i] > 0 || side.energy < m.cost) return;
    if (m.cost > 0 && side.energy - m.cost < reserve && !opening && foeHp > 0.25) return;
    let u = 0;
    const big = m.cost >= 40;
    if (m.kind === 'proj') u = dist < m.range * 0.92 ? (m.dmg + 2) * (m.count || 1) * 0.6 + (m.stun ? 8 : 0) : 0;
    else if (m.kind === 'beam') u = dist < m.len * 0.92 ? m.dmg * (opening ? 1.7 : 0.75) : 0;
    else if (m.kind === 'melee') u = dist < m.range + fr + 8 ? m.dmg * 1.2 : 0;
    else if (m.kind === 'cone') u = dist < m.range + fr - 10 ? m.dmg * 1.25 : 0;
    else if (m.kind === 'wave') u = dist < m.range * 0.9 ? m.dmg * (opening ? 1.5 : 0.9) : 0;
    else if (m.kind === 'dash') u = dist < m.dist + 30 && dist > 60 ? m.dmg * (mode === 'atacar' ? 1.3 : mode === 'defender' ? 0.2 : 0.7) : 0;
    else if (m.kind === 'area') {
      if (m.at === 'self') u = dist < m.radius * 0.85 ? m.dmg * 1.3 : 0;
      else u = dist < m.maxRange ? m.dmg * (opening ? 1.8 : 0.65) : 0;
      if (m.selfKO) u = myHp < 0.25 && dist < m.radius * 0.7 && myAlive > 1 ? 60 : 0;
    } else if (m.kind === 'heal') u = myHp < (mode === 'defender' ? 0.6 : 0.4) && !b.sudden ? 35 : 0;
    else if (m.kind === 'buff') u = side.haste <= 0 && side.power <= 0 && mode !== 'defender' && dist > 150 ? 12 : 0;
    else if (m.kind === 'smoke') u = mode === 'defender' && rnd() < 0.4 ? 20 : 0;
    else if (m.kind === 'wall') u = f.wind && (f.wind.m.kind === 'beam' || f.wind.m.kind === 'proj') ? 25 : mode === 'defender' ? 8 : 0;
    else if (m.kind === 'blink') u = (threat && threat.t < 0.25) || (mode === 'defender' && dist < 140) ? 24 : 0;
    // Estilo según el estado
    if (u > 0 && mode === 'defender' && (m.kind === 'melee' || m.kind === 'dash' || m.kind === 'cone') && foeHp > 0.2) u *= 0.3;
    if (u > 0 && mode === 'atacar' && big) u *= 1.3;
    if (u > 0 && foeHp < 0.2 && m.dmg) u *= 1.4;
    // Combos: mojado + eléctrico/hielo
    if (u > 0 && (foeFlags & F.WET) && (m.type === 'electrico' || m.type === 'hielo')) u *= 1 + skill;
    if (u > 0 && m.dmg) u *= D.typeMult(m.type, D.SPECIES[fmon.dex].types);
    u *= 0.75 + rnd() * (1.2 - skill * 0.5);   // ruido: las torpes eligen peor
    if (u > bestU) { bestU = u; best = i; }
  });
  if (best === null) return aim(inp, toFoe, skill);
  const m = moves[best];
  // Apuntar con anticipación (más precisa cuanto más hábil)
  const lead = m.kind === 'proj' || m.kind === 'wave' ? dist / m.speed : m.kind === 'area' ? m.delay + m.wind : m.wind;
  const px = target.x + vel.x * lead * skill, py = target.y + vel.y * lead * skill;
  inp.a = Math.atan2(py - side.y, px - side.x) + (rnd() - 0.5) * (1 - skill) * 0.6;
  inp.tx = px + (rnd() - 0.5) * (1 - skill) * 100; inp.ty = py + (rnd() - 0.5) * (1 - skill) * 100;
  if (m.kind === 'blink') inp.a = toFoe + Math.PI + (rnd() - 0.5) * 1.5;
  inp.c = best;
  return inp;
}

function aim(inp, toFoe, skill) {
  inp.a = toFoe + (Math.random() - 0.5) * (1 - skill) * 0.4;
  return inp;
}

module.exports = { aiInput, personality };
