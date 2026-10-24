// IA de combate. Genera la misma entrada que un jugador (mover, apuntar, movimiento, cambio),
// así que no hace trampas: solo ve lo que vería una persona, con retraso de reacción.
// skill 0-1 controla reflejos, puntería con anticipación, esquivas, parry, combos y cambios.
const D = require('../public/data.js');
const S = require('../public/shared.js');

const { T, RADIUS } = S;
const rnd = () => Math.random();

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Tiempo hasta el impacto y distancia mínima de un proyectil a un punto (o null si no viene).
function threatOf(p, me) {
  const v2 = p.vx * p.vx + p.vy * p.vy;
  if (!v2) return null;
  const t = ((me.x - p.x) * p.vx + (me.y - p.y) * p.vy) / v2;
  if (t < 0 || t > 0.8) return null;
  const cx = p.x + p.vx * t, cy = p.y + p.vy * t;
  const miss = Math.hypot(me.x - cx, me.y - cy);
  if (miss > RADIUS + p.r + 6) return null;
  return { t, miss, vx: p.vx, vy: p.vy };
}

function aiInput(b, side, dt) {
  const st = side.aiState;
  const skill = side.ai;
  const inp = { s: 0, mx: 0, my: 0, a: side.a, tx: side.x, ty: side.y, c: -1, sw: -1 };
  if (b.state !== 'fight') return inp;
  const mon = b.mon(side);
  const f = b.foe(side);
  const fmon = b.mon(f);

  // Percepción con retraso: lo que el bot "ve" es la posición del rival hace unos ticks.
  st.hist = st.hist || [];
  if (!f.hidden) { st.hist.push({ x: f.x, y: f.y }); st.lastSeen = { x: f.x, y: f.y }; }
  if (st.hist.length > 20) st.hist.shift();
  const delay = Math.round((0.32 - 0.24 * skill) * S.TICK);
  const seen = st.hist.length ? st.hist[Math.max(0, st.hist.length - 1 - delay)] : (st.lastSeen || { x: S.ARENA.w / 2, y: S.ARENA.h / 2 });
  const prev = st.hist[Math.max(0, st.hist.length - 4 - delay)] || seen;
  const vel = { x: (seen.x - prev.x) / (3 * dt), y: (seen.y - prev.y) / (3 * dt) };
  const target = f.hidden ? (st.lastSeen || seen) : seen;
  const dx = target.x - side.x, dy = target.y - side.y;
  const dist = Math.hypot(dx, dy) || 1;
  const toFoe = Math.atan2(dy, dx);
  st.decided = st.decided || new Map();
  if (st.decided.size > 200) st.decided.clear();

  // Cambio forzado tras un debilitado: el que mejor aguante al rival.
  if (side.forced > 0) {
    if (side.swapTo < 0) inp.sw = bestSwap(side, fmon, -1);
    return inp;
  }

  const moves = D.SPECIES[mon.dex].moves.map(k => D.MOVES[k]);
  const meleeish = moves.filter(m => m.kind === 'melee' || m.kind === 'dash').length >= 2;
  const want = meleeish ? 55 : 240 + (1 - skill) * 40;

  // ---------- Movimiento ----------
  st.strafeT = (st.strafeT || 0) - dt;
  if (st.strafeT <= 0) { st.strafe = rnd() < 0.5 ? -1 : 1; st.strafeT = 0.6 + rnd() * 1.6; }
  let radial = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
  // Rival escondido: ir a buscarlo donde se le vio por última vez
  if (f.hidden) radial = dist > 50 ? 1 : 0;
  if (f.hidden && dist <= 50) st.lastSeen = { x: S.ARENA.w / 2 + (rnd() - 0.5) * 400, y: S.ARENA.h / 2 + (rnd() - 0.5) * 300 };
  let mx = (dx / dist) * radial + (-dy / dist) * st.strafe * 0.7;
  let my = (dy / dist) * radial + (dx / dist) * st.strafe * 0.7;
  // No acorralarse contra los bordes
  const edge = 70;
  if (side.x < edge) mx += (edge - side.x) / edge * 1.5;
  if (side.x > S.ARENA.w - edge) mx -= (side.x - (S.ARENA.w - edge)) / edge * 1.5;
  if (side.y < edge) my += (edge - side.y) / edge * 1.5;
  if (side.y > S.ARENA.h - edge) my -= (side.y - (S.ARENA.h - edge)) / edge * 1.5;

  // Esquivar proyectiles que vienen hacia mí
  let threat = null;
  for (const p of b.projectiles) {
    if (p.owner === side) continue;
    const th = threatOf(p, side);
    if (!th) continue;
    if (!threat || th.t < threat.t) threat = { ...th, id: p.id };
    const key = 'd' + p.id;
    if (!st.decided.has(key)) st.decided.set(key, rnd() < skill * 0.9);
    if (st.decided.get(key)) {
      const len = Math.hypot(th.vx, th.vy);
      const side1 = (side.x - p.x) * -th.vy + (side.y - p.y) * th.vx >= 0 ? 1 : -1;
      mx += (-th.vy / len) * side1 * 2; my += (th.vx / len) * side1 * 2;
    }
  }
  // Salir de las zonas marcadas por el rival
  for (const ar of b.areas) {
    if (ar.owner === side) continue;
    const d = Math.hypot(side.x - ar.x, side.y - ar.y);
    if (d < ar.m.radius + RADIUS + 10) {
      const key = 'a' + ar.x + ar.y;
      if (!st.decided.has(key)) st.decided.set(key, rnd() < skill);
      if (st.decided.get(key)) { mx += (side.x - ar.x) / (d || 1) * 2.5; my += (side.y - ar.y) / (d || 1) * 2.5; }
    }
  }
  // Ataque cargándose contra mí: apartarse de la línea
  if (f.wind && !f.hidden) {
    const m = f.wind.m;
    const key = 'w' + b.t.toFixed(1) + f.wind.c;
    if (m.kind === 'area' && m.at === 'cursor' && Math.hypot(side.x - f.wind.tx, side.y - f.wind.ty) < m.radius + RADIUS) {
      if (!st.decided.has(key)) st.decided.set(key, rnd() < skill);
      if (st.decided.get(key)) { const a = Math.atan2(side.y - f.wind.ty, side.x - f.wind.tx); mx += Math.cos(a) * 2.5; my += Math.sin(a) * 2.5; }
    } else if ((m.kind === 'beam' || m.kind === 'proj') && Math.abs(angleDiff(f.wind.a, Math.atan2(side.y - f.y, side.x - f.x))) < 0.35) {
      if (!st.decided.has(key)) st.decided.set(key, rnd() < skill * 0.8);
      if (st.decided.get(key)) { mx += -Math.sin(f.wind.a) * st.strafe * 2.5; my += Math.cos(f.wind.a) * st.strafe * 2.5; }
    }
  }
  // No quedarse en el fuego
  const here = b.terrain[S.cellIndex(side.x, side.y)];
  const ahead = b.terrain[S.cellIndex(side.x + mx * 30, side.y + my * 30)];
  if (ahead === T.FIRE && skill > 0.2) { const t = mx; mx = -my; my = t; }
  if (here === T.FIRE) { mx += (S.ARENA.w / 2 - side.x) / 300; my += (S.ARENA.h / 2 - side.y) / 300; }
  inp.mx = S.clamp(mx, -1, 1); inp.my = S.clamp(my, -1, 1);

  // ---------- Protección ----------
  if (side.pcd <= 0 && side.prot < 0) {
    if (threat && threat.t < 0.1) {
      const key = 'p' + threat.id;
      if (!st.decided.has(key)) st.decided.set(key, rnd() < Math.pow(skill, 1.4) * 0.85);
      if (st.decided.get(key)) { inp.c = 4; return aim(inp, side, toFoe, skill); }
    }
    if (f.wind && !f.hidden) {
      const m = f.wind.m, left = m.wind - f.wind.t;
      const aimed = Math.abs(angleDiff(f.wind.a, Math.atan2(side.y - f.y, side.x - f.x))) < 0.4;
      const inRange = m.kind === 'melee' ? dist < m.range + RADIUS + 20 : m.kind === 'beam' ? dist < m.len : m.kind === 'dash' ? dist < m.dist + 40 : false;
      if (aimed && inRange && left < 0.08 + (1 - skill) * 0.05) {
        const key = 'pw' + b.t.toFixed(1);
        if (!st.decided.has(key)) st.decided.set(key, rnd() < skill * 0.75);
        if (st.decided.get(key)) { inp.c = 4; return aim(inp, side, toFoe, skill); }
      }
    }
  }

  // ---------- Cambio voluntario ----------
  st.swapEval = (st.swapEval || 0) - dt;
  if (st.swapEval <= 0 && side.swapCd <= 0 && b.canAct(side) && skill > 0.35 && side.team.length > 1) {
    st.swapEval = 1.5;
    const threatNow = worstThreat(fmon, mon);
    const best = bestSwap(side, fmon, side.act);
    if (best >= 0) {
      const better = worstThreat(fmon, side.team[best]) < threatNow;
      const low = mon.hp < mon.maxHp * 0.2 && side.team[best].hp > side.team[best].maxHp * 0.5;
      if ((threatNow >= 1.5 && better && rnd() < skill * 0.6) || (low && rnd() < skill * 0.4)) { inp.sw = best; return inp; }
    }
  }

  // ---------- Ataque ----------
  if (!b.canAct(side) || f.hidden && !st.lastSeen) return aim(inp, side, toFoe, skill);
  if (rnd() > 0.2 + 0.65 * skill) return aim(inp, side, toFoe, skill);
  const foeFlags = b.flags(f);
  const disabled = foeFlags & (S.F.STUN | S.F.SLOW);
  let best = null, bestU = 0;
  moves.forEach((m, i) => {
    if (mon.cds[i] > 0 || side.energy < m.cost) return;
    let u = 0;
    const big = m.cost >= 40;
    if (m.kind === 'proj') u = dist < m.range * 0.95 ? (m.dmg + 2) * (m.count || 1) * 0.6 : 0;
    else if (m.kind === 'beam') u = dist < m.len * 0.95 ? m.dmg * (disabled ? 1.6 : 0.8) : 0;
    else if (m.kind === 'melee') u = dist < m.range + RADIUS + 8 ? m.dmg * 1.2 : 0;
    else if (m.kind === 'dash') u = dist < m.dist + 30 && dist > 60 ? m.dmg * (meleeish ? 1.2 : 0.6) : 0;
    else if (m.kind === 'area') {
      if (m.at === 'self') u = dist < m.radius * 0.85 ? m.dmg * 1.3 : 0;
      else u = dist < m.maxRange ? m.dmg * (disabled ? 1.7 : 0.7) : 0;
      if (m.selfKO) u = mon.hp < mon.maxHp * 0.3 && dist < m.radius * 0.7 ? 60 : 0;
    } else if (m.kind === 'heal') u = mon.hp < mon.maxHp * 0.5 ? 30 : 0;
    else if (m.kind === 'buff') u = side.haste <= 0 && side.power <= 0 && dist < 380 ? 12 : 0;
    else if (m.kind === 'smoke') u = mon.hp < mon.maxHp * 0.5 && rnd() < 0.3 ? 14 : 0;
    else if (m.kind === 'wall') u = f.wind && (f.wind.m.kind === 'beam' || f.wind.m.kind === 'proj') ? 25 : 0;
    else if (m.kind === 'blink') u = (threat && threat.t < 0.25) || (!meleeish && dist < 90) ? 22 : 0;
    // Combos: mojado + eléctrico/hielo; rival aturdido -> lo más fuerte
    if (u > 0 && (foeFlags & S.F.WET) && (m.type === 'electrico' || m.type === 'hielo')) u *= 1 + skill;
    if (u > 0 && (foeFlags & S.F.STUN) && big) u *= 1 + skill;
    // Ventaja de tipo
    if (u > 0 && m.dmg) u *= D.typeMult(m.type, D.SPECIES[fmon.dex].types);
    // Guardar energía: los buenos no gastan lo grande sin motivo
    if (big && !disabled && skill > 0.5 && rnd() < 0.5) u *= 0.4;
    u *= 0.7 + rnd() * (1.3 - skill * 0.6);
    if (u > bestU) { bestU = u; best = i; }
  });
  if (best === null) return aim(inp, side, toFoe, skill);
  const m = moves[best];
  // Apuntar con anticipación a donde estará el rival
  const lead = m.kind === 'proj' ? dist / m.speed : m.kind === 'area' ? m.delay + m.wind : m.wind;
  const px = target.x + vel.x * lead * skill, py = target.y + vel.y * lead * skill;
  const noise = (rnd() - 0.5) * (1 - skill) * 0.5;
  inp.a = Math.atan2(py - side.y, px - side.x) + noise;
  inp.tx = px + (rnd() - 0.5) * (1 - skill) * 80; inp.ty = py + (rnd() - 0.5) * (1 - skill) * 80;
  if (m.kind === 'blink') inp.a = toFoe + Math.PI + (rnd() - 0.5) * 1.5;
  inp.c = best;
  return inp;
}

function aim(inp, side, toFoe, skill) {
  inp.a = toFoe + (Math.random() - 0.5) * (1 - skill) * 0.3;
  return inp;
}

// Lo más eficaz que puede pegarme el rival (por sus tipos, con STAB).
function worstThreat(fmon, mon) {
  const myTypes = D.SPECIES[mon.dex].types;
  return Math.max(...D.SPECIES[fmon.dex].types.map(t => D.typeMult(t, myTypes)));
}

function bestSwap(side, fmon, except) {
  let best = -1, bestScore = -Infinity;
  side.team.forEach((m, i) => {
    if (i === except || m.fainted || i === side.act) return;
    const score = -worstThreat(fmon, m) * 2 + m.hp / m.maxHp;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

module.exports = { aiInput };
