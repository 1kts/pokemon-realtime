// Combate autoritativo: dos bandos con equipos de hasta 3 Pokémon, simulado a 30 Hz.
//
// Cada movimiento tiene preparación (wind, se ve venir), ejecución y recuperación (rec, vulnerable).
// Protección (Espacio) bloquea; si el golpe llega en sus primeros PROTECT.perfect segundos es un
// parry: el proyectil vuelve y el atacante cuerpo a cuerpo queda aturdido. La energía se gasta
// en los movimientos y se recarga sola y al golpear. El terreno (hierba, fuego, agua, vapor)
// cambia con los ataques y se combina: fuego + hierba = incendio, fuego + agua = vapor que
// oculta, rayo + agua = descarga en todo el charco.
const D = require('../public/data.js');
const S = require('../public/shared.js');
const { aiInput } = require('./ai.js');
const { Arena } = require('./arena.js');

const { T, F, CELL, COLS, ROWS } = S;
let nextId = 1;

const STAB = 1.15;
const BURN_DPS = 0.025, POISON_DPS = 0.022, SEED_DPS = 0.03, FIRE_DPS = 0.05;  // % de PS máx. por segundo
const FIRE_TTL = 4, WATER_TTL = 7, STEAM_TTL = 4, ICE_TTL = 8, POISON_TTL = 6, SPREAD_T = 0.6;
const FORCED_SWAP_T = 1.2, ENTRY_INVULN = 0.8;
const WILD_HP = 0.6, WILD_DMG = 0.85;
// Duración de la animación de captura (debe coincidir con la del cliente, effects.js)
const CATCH_IN = 1.0, CATCH_SHAKE = 0.75, CATCH_CLICK = 0.9, CATCH_BREAK = 0.5;
// A los SUDDEN s empieza la muerte súbita (más daño, sin curar); a los LIMIT s gana quien tenga más PS.
const SUDDEN = 120, LIMIT = 180, SUDDEN_MULT = 1.5;
// Proyectiles: margen de impacto (px) y radio mínimo del blanco, para que acertar a un Pokémon pequeño con un
// proyectil fino no sea cuestión de píxeles. Vale igual para el jugador y para la IA.
const PROJ_FORGIVE = 9, PROJ_MIN_TARGET = 18;

// moves: los que lleva (los elige el jugador); por defecto, los 4 de la especie.
// ev, iv, nat (naturaleza) · shiny · r: radio de colisión según el tamaño de la especie.
function makeMon(dex, level, extra = {}) {
  const st = S.monStats(dex, level, extra);
  const moves = (extra.moves && extra.moves.length ? extra.moves : D.SPECIES[dex].moves).filter(m => D.MOVES[m]).slice(0, 4);
  return { dex, level, hp: st.maxHp, maxHp: st.maxHp, atk: st.atk, def: st.def, spdMult: st.spdMult, r: S.hitboxOf(dex),
    shiny: !!extra.shiny, cds: [0, 0, 0, 0], fainted: false, ...extra, moves };
}

class Battle {
  // opts: { sides: [{ name, team: [{dex, level, uid?}], ws?, ai?: skill 0-1, wild?, balls? }],
  //         map, mode: 'wild'|'trainer'|'ranked'|'casual'|'practice', onEnd(result) }
  constructor(opts) {
    this.mode = opts.mode;
    this.tutorial = !!opts.tutorial;
    this.mapName = opts.map || 'pradera';
    this.onEnd = opts.onEnd || (() => {});
    const { terrain, rocks } = S.parseMap(this.mapName);
    this.terrain = terrain;
    // Lo que forma parte del mapa (agua, hielo, veneno, telarañas, lava) es permanente y vuelve
    // cuando se le pasa el efecto de un ataque; lo que crean los ataques dura un rato (WATER_TTL...)
    this.base = terrain.slice();
    this.ttl = terrain.map(t => S.PERMANENT.has(t) ? Infinity : 0);
    this.spread = new Array(terrain.length).fill(0);
    this.dirty = new Set();
    this.obstacles = rocks.map(r => ({ id: nextId++, ...r, hp: Infinity, ttl: Infinity, kind: 'rock' }));
    this.sides = opts.sides.map((s, i) => this.makeSide(s, i));
    this.arena = new Arena(this);   // mecánicas del entorno (solo en las arenas de gimnasio)
    this.t = 0;
    this.state = 'countdown';
    this.countdown = 3;
    this.projectiles = [];
    this.areas = [];
    // Datos de equilibrio de este combate (ver execute y server/balance.js): por lado, movimientos y Pokémon
    this.stats = { moves: [{}, {}], mons: [{}, {}] };
    for (const side of this.sides) this.statMon(side).out = 1;
    this.events = [];
    this.result = null;
    this.timer = setInterval(() => this.tick(), 1000 / S.TICK);
    for (const s of this.sides) this.send(s, this.startMsg(s));
  }

  makeSide(s, i) {
    return {
      idx: i, name: s.name, ws: s.ws || null, ai: s.ai ?? null, passive: !!s.passive, wild: !!s.wild, rare: !!s.rare, perfect: !!s.perfect, balls: s.balls || null,
      // Los salvajes aguantan menos y pegan algo menos: combates de ruta rápidos
      team: s.team.map(m => {
        const mon = makeMon(m.dex, m.level, { uid: m.uid, nick: m.nick || undefined, moves: m.moves, ev: m.ev, iv: m.iv, nat: m.nat, shiny: m.shiny, skin: m.skin || null, parts: m.parts || null });
        if (s.wild) mon.hp = mon.maxHp = Math.round(mon.maxHp * WILD_HP);
        if (s.hpMult) mon.hp = mon.maxHp = Math.round(mon.maxHp * s.hpMult);   // el muñeco del tutorial aguanta más
        return mon;
      }), act: 0, dmgMult: s.wild ? WILD_DMG : 1,
      x: i === 0 ? 140 : S.ARENA.w - 140, y: S.ARENA.h / 2, a: i === 0 ? 0 : Math.PI,
      energy: D.ENERGY.max * 0.5, pcd: 0, prot: -1, wind: null, rec: 0, dash: null, kb: null,
      stun: 0, slow: 0, burn: 0, poison: 0, wet: 0, seed: 0, seedBy: null, haste: 0, power: 0,
      swapCd: 0, swapping: 0, swapTo: -1, swapIn: 0, invuln: 0, forced: 0, sinceAct: 9, hidden: false,
      dot: 0, inputs: [], lastInput: { mx: 0, my: 0, a: 0, tx: 0, ty: 0 }, ack: 0, aiState: {}, connected: true,
    };
  }

  startMsg(side) {
    return {
      t: 'start', you: side.idx, mode: this.mode, map: this.mapName,
      sides: this.sides.map(s => ({ name: s.name, wild: s.wild, rare: s.rare, perfect: s.perfect, team: s.team.map(m => ({ dex: m.dex, nick: m.nick, level: m.level, maxHp: m.maxHp, moves: m.moves, shiny: m.shiny, skin: m.skin || null, parts: m.parts || null, spdMult: m.spdMult, r: m.r })) })),
      terrain: this.terrain, balls: side.balls,
    };
  }

  send(side, msg) {
    if (side.ws && side.ws.readyState === 1) side.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  foe(side) { return this.sides[1 - side.idx]; }
  mon(side) { return side.team[side.act]; }
  rad(side) { return this.mon(side).r; }   // radio de colisión del Pokémon activo
  ev(e) { this.events.push(e); }
  newId() { return nextId++; }

  // ---------- Bucle ----------
  tick() {
    const dt = S.DT;
    this.t += dt;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.state = 'fight';
    }
    for (const side of this.sides) {
      if (side.ai !== null) {
        const inp = aiInput(this, side, dt);
        if (side.passive) { inp.c = -1; inp.sw = -1; inp.mx = 0; inp.my = 0; }   // tutorial: muñeco quieto que no ataca
        side.inputs.push(inp);
      }
      let steps = side.inputs.length > 3 ? 2 : 1;   // si hay atraso, consumir dos para recuperar
      while (steps-- > 0) {
        const inp = side.inputs.shift();
        if (inp) { side.lastInput = inp; side.ack = inp.s || side.ack; }
        this.applyInput(side, inp || { ...side.lastInput, c: -1, sw: -1 }, dt);
      }
      if (side.inputs.length > 10) side.inputs.splice(0, side.inputs.length - 10);
    }
    if (this.state === 'fight') {
      for (const side of this.sides) this.updateSide(side, dt);
      this.arena.update(dt);
      this.updateProjectiles(dt);
      this.updateAreas(dt);
      this.updateTerrain(dt);
      this.updateObstacles(dt);
      this.checkFaints();
      this.fightT = (this.fightT || 0) + dt;
      if (this.fightT >= SUDDEN && !this.sudden) { this.sudden = true; this.ev({ k: 'sudden' }); }
      if (this.fightT >= LIMIT && this.state === 'fight') {
        const left = this.sides.map(s => s.team.reduce((a, m) => a + m.hp / m.maxHp, 0));
        this.finish(left[0] === left[1] ? -1 : left[0] > left[1] ? 0 : 1, { timeout: true });
      }
    } else if (this.state === 'capture') {
      this.updateCapture(dt);
    }
    this.broadcast();
  }

  canAct(side) {
    return this.state === 'fight' && side.stun <= 0 && !side.wind && side.rec <= 0 && !side.dash && !side.kb &&
      side.swapping <= 0 && side.forced <= 0 && !this.mon(side).fainted;
  }

  flags(side) {
    let f = 0;
    if (side.stun > 0) f |= F.STUN;
    if (side.slow > 0) f |= F.SLOW;
    if (side.burn > 0) f |= F.BURN;
    if (side.poison > 0) f |= F.POISON;
    if (side.wet > 0) f |= F.WET;
    if (side.seed > 0) f |= F.SEED;
    if (side.prot >= 0) f |= F.PROTECT;
    if (side.prot >= 0 && side.prot < D.PROTECT.perfect) f |= F.PERFECT;
    if (side.hidden) f |= F.HIDDEN;
    if (side.swapping > 0 || side.forced > 0) f |= F.SWAP;
    if (side.haste > 0) f |= F.HASTE;
    if (side.power > 0) f |= F.POWER;
    if (side.wind) f |= F.WIND;
    if (side.rec > 0) f |= F.REC;
    if (side.dash || side.kb) f |= F.DASH;
    if (side.invuln > 0) f |= F.INVULN;
    if (this.mon(side).fainted) f |= F.FAINTED;
    return f;
  }

  applyInput(side, inp, dt) {
    if (typeof inp.a === 'number' && isFinite(inp.a)) side.a = inp.a;
    if (this.state !== 'fight') return;
    const mon = this.mon(side);
    // Movimiento (el dash y el empuje se mueven en updateSide)
    if (!side.dash && !side.kb) {
      const speed = S.speedOf(mon.dex, this.flags(side), mon.spdMult);
      if (this.arena.active) S.arenaStep(side, inp.mx || 0, inp.my || 0, speed, dt, this.obstacles, mon.r, this.arena.env(side));
      else if (speed > 0) S.stepMove(side, inp.mx || 0, inp.my || 0, speed, dt, this.obstacles, mon.r);
    }
    // Cambio de Pokémon: voluntario (con recarga) o tras un debilitado (elige el jugador)
    if (inp.sw >= 0 && inp.sw < side.team.length && inp.sw !== side.act && !side.team[inp.sw].fainted) {
      if (side.forced > 0) { side.swapTo = inp.sw; side.forced = Math.min(side.forced, 0.25); }
      else if (side.swapCd <= 0 && side.swapping <= 0 && side.stun <= 0 && !side.dash && !side.kb && !side.wind) {
        side.swapping = D.SWAP.time; side.swapTo = inp.sw; side.swapCd = D.SWAP.cd;
        side.prot = -1;
      }
    }
    const c = inp.c;
    if (c === 4 && side.pcd <= 0 && side.stun <= 0 && !side.wind && !side.dash && side.swapping <= 0 && side.forced <= 0) {
      side.prot = 0; side.pcd = D.PROTECT.cd;
      this.ev({ k: 'protect', s: side.idx });
    } else if (c === 5 && this.canAct(side) && side.balls && this.foe(side).wild) {
      this.throwBall(side, inp);
    } else if (c >= 0 && c < mon.moves.length && this.canAct(side)) {
      const m = D.MOVES[mon.moves[c]];
      if (mon.cds[c] <= 0 && side.energy >= m.cost) {
        side.energy -= m.cost;
        mon.cds[c] = m.cd;
        let tx = +inp.tx || side.x, ty = +inp.ty || side.y;
        if (m.maxRange) {   // apuntado al cursor, limitado al alcance
          const d = Math.hypot(tx - side.x, ty - side.y);
          if (d > m.maxRange) { tx = side.x + (tx - side.x) / d * m.maxRange; ty = side.y + (ty - side.y) / d * m.maxRange; }
        }
        side.wind = { c, m, t: 0, a: side.a, tx, ty };
        side.prot = -1;
        side.sinceAct = 0;
        this.ev({ k: 'wind', s: side.idx, c, a: +side.a.toFixed(2), tx: Math.round(tx), ty: Math.round(ty), d: m.wind });
      }
    }
  }

  updateSide(side, dt) {
    const mon = this.mon(side);
    side.sinceAct += dt;
    for (const m of side.team) for (let i = 0; i < 4; i++) m.cds[i] = Math.max(0, m.cds[i] - dt);
    side.pcd = Math.max(0, side.pcd - dt);
    side.swapCd = Math.max(0, side.swapCd - dt);
    side.energy = Math.min(D.ENERGY.max, side.energy + D.ENERGY.regen * dt);
    for (const k of ['stun', 'slow', 'burn', 'poison', 'wet', 'seed', 'haste', 'power', 'invuln', 'swapIn', 'rec'])
      side[k] = Math.max(0, side[k] - dt);
    if (side.prot >= 0) { side.prot += dt; if (side.prot > D.PROTECT.dur) side.prot = -1; }

    // Preparación -> ejecución
    if (side.wind) {
      if (side.stun > 0) side.wind = null;   // aturdir cancela el ataque
      else if ((side.wind.t += dt) >= side.wind.m.wind) {
        const w = side.wind;
        side.wind = null;
        side.rec = w.m.rec;
        this.execute(side, w);
      }
    }
    // Embestida y empuje
    for (const key of ['dash', 'kb']) {
      const d = side[key];
      if (!d) continue;
      const before = { x: side.x, y: side.y };
      S.stepMove(side, d.vx, d.vy, d.speed, dt, key === 'dash' && d.m.invuln ? [] : this.obstacles, this.rad(side));
      if (key === 'dash') {
        const f = this.foe(side);
        if (!d.hit && !this.mon(f).fainted && Math.hypot(f.x - side.x, f.y - side.y) < this.rad(side) + this.rad(f) + 7) {
          d.hit = true;
          this.hit(side, f, d.m, side.x, side.y, { a: Math.atan2(d.vy, d.vx), cast: d.cast });
        }
      }
      if ((d.t -= dt) <= 0 || (Math.hypot(side.x - before.x, side.y - before.y) < 0.5 && key === 'kb')) {
        side[key] = null;
        // Ida y Vuelta: tras la ida, vuelve por el mismo camino (sin volver a golpear)
        if (key === 'dash' && d.m.back && !d.returning) { side.dash = { ...d, vx: -d.vx, vy: -d.vy, t: d.m.dur, hit: true, returning: true }; continue; }
        if (key === 'dash' && d.m.invuln) S.pushOut(side, this.rad(side), this.obstacles);
      }
    }
    // Cambio en curso
    if (side.swapping > 0 && (side.swapping -= dt) <= 0) this.doSwap(side, side.swapTo, false);
    if (side.forced > 0 && (side.forced -= dt) <= 0) {
      let to = side.swapTo;
      if (to < 0 || side.team[to].fainted) to = side.team.findIndex(m => !m.fainted);
      if (to >= 0) this.doSwap(side, to, true);
    }
    // Daño por estados y terreno, acumulado y aplicado cada segundo para que el número se lea
    if (!mon.fainted) {
      const cell = this.terrain[S.cellIndex(side.x, side.y)];
      const types = D.SPECIES[mon.dex].types;
      const grounded = side.invuln <= 0 && !(side.dash && side.dash.m.invuln);
      let rate = 0;
      if (side.burn > 0) rate += BURN_DPS;
      if (side.poison > 0) rate += POISON_DPS;
      if (side.seed > 0) rate += SEED_DPS;
      // Cada tipo aguanta el peligro de su propia arena (fuego la lava, veneno los charcos...)
      if ((cell === T.FIRE || (cell === T.LAVA && !types.includes('fuego'))) && grounded) { rate += FIRE_DPS; side.burn = Math.max(side.burn, 1.5); }
      if (cell === T.WATER) side.wet = Math.max(side.wet, 1.5);
      if (cell === T.POISON && grounded && !types.includes('veneno') && !types.includes('acero')) side.poison = Math.max(side.poison, 2);
      if (cell === T.WEB && grounded && !types.includes('bicho')) side.slow = Math.max(side.slow, 0.3);
      side.dot += rate * mon.maxHp * dt;
      if (side.dot >= 1 && (this.t % 1) < dt) {
        const n = Math.floor(side.dot);
        side.dot -= n;
        mon.hp = Math.max(0, mon.hp - n);
        this.ev({ k: 'dot', s: side.idx, n });
        if (side.seed > 0 && side.seedBy) {   // Drenadoras: lo que pierde el sembrado lo gana quien sembró
          const src = this.mon(side.seedBy);
          if (!src.fainted && !this.sudden) src.hp = Math.min(src.maxHp, src.hp + Math.round(SEED_DPS * mon.maxHp));
        }
      }
    }
    // Oculto en hierba alta o vapor, si no ataca y el rival no está pegado
    const cell = this.terrain[S.cellIndex(side.x, side.y)];
    const f = this.foe(side);
    const dist = Math.hypot(f.x - side.x, f.y - side.y);
    side.hidden = (cell === T.GRASS || cell === T.STEAM) && side.sinceAct > 0.8 && dist > (cell === T.STEAM ? 70 : 120);
    // Arena a oscuras: de lejos no se ve al rival salvo justo cuando ataca
    if (this.arena.dark && dist > this.arena.dark && side.sinceAct > 0.6) side.hidden = true;
  }

  doSwap(side, to, forced) {
    side.act = to;
    this.statMon(side).out = 1;
    side.swapping = 0; side.forced = 0; side.swapTo = -1;
    side.swapIn = forced ? 0 : D.SWAP.perfect;
    side.invuln = forced ? ENTRY_INVULN : 0;
    side.wind = null; side.rec = 0; side.prot = -1;
    side.slow = side.stun = side.burn = side.poison = side.seed = side.haste = side.power = 0;
    this.ev({ k: 'swap', s: side.idx, to });
  }

  // ---------- Ejecución de movimientos ----------
  // Cada uso de un movimiento es un «cast» para los datos de equilibrio (server/balance.js): se apunta si
  // acaba dando y cuánto daño hace; los proyectiles, áreas y embestidas lo llevan consigo hasta que dan
  execute(side, w) {
    this.curCast = this.castStat(side, this.mon(side).moves[w.c]);
    try { this.runMove(side, w); } finally { this.curCast = null; }
  }

  castStat(side, key) {
    if (!key) return null;
    const mv = this.statMove(side, key);
    mv.casts++;
    return { key, side: side.idx, landed: false };
  }
  statMove(side, key) {
    const all = this.stats.moves[side.idx];
    return all[key] || (all[key] = { casts: 0, landed: 0, dmg: 0, kos: 0 });
  }
  statMon(side, slot = side.act) {
    const all = this.stats.mons[side.idx];
    return all[slot] || (all[slot] = { dmg: 0, taken: 0, kos: 0, out: 0 });
  }

  runMove(side, w) {
    const m = w.m, a = w.a;
    const ax = Math.cos(a), ay = Math.sin(a);
    this.ev({ k: 'cast', s: side.idx, c: w.c, a: +a.toFixed(2), x: Math.round(side.x), y: Math.round(side.y) });
    if (m.kind === 'proj') {
      const n = m.count || 1;
      // Los que explotan (Llamarada, Bomba Lodo) estallan en el punto al que apuntas
      const reach = m.explode && m.maxRange ? Math.max(60, Math.min(m.maxRange, Math.hypot(w.tx - side.x, w.ty - side.y))) : m.range;
      for (let j = 0; j < n; j++) {
        const ang = a + (j - (n - 1) / 2) * (m.spread || 0);
        this.projectiles.push({ id: nextId++, owner: side, m, mk: this.mon(side).moves[w.c], cast: this.curCast,
          x: side.x + ax * this.rad(side), y: side.y + ay * this.rad(side), vx: Math.cos(ang) * m.speed, vy: Math.sin(ang) * m.speed, left: reach, r: m.radius });
      }
    } else if (m.kind === 'wave') {
      // Ola (Surf): un frente ancho que avanza, atraviesa las rocas y moja el suelo a su paso
      this.projectiles.push({ id: nextId++, owner: side, m, mk: this.mon(side).moves[w.c], cast: this.curCast, wide: m.width / 2,
        x: side.x + ax * this.rad(side), y: side.y + ay * this.rad(side), vx: ax * m.speed, vy: ay * m.speed, left: m.range, r: m.thick || 20 });
    } else if (m.kind === 'cone') {
      this.cone(side, m, a);
    } else if (m.kind === 'beam') {
      this.beam(side, m, a);
    } else if (m.kind === 'melee') {
      const f = this.foe(side);
      const dx = f.x - side.x, dy = f.y - side.y;
      let diff = Math.atan2(dy, dx) - a;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this.ev({ k: 'melee', s: side.idx, a: +a.toFixed(2), r: m.range, arc: m.arc, ty: m.type });
      // El arco cuenta el tamaño del rival: si su borde entra en el arco, le da (no solo si entra su centro)
      const dist = Math.hypot(dx, dy);
      if (dist < m.range + this.rad(f) && Math.abs(diff) < m.arc / 2 + Math.atan2(this.rad(f), Math.max(1, dist))) this.hit(side, f, m, f.x, f.y, { a });
    } else if (m.kind === 'dash') {
      side.dash = { m, vx: ax, vy: ay, speed: m.dist / m.dur, t: m.dur, hit: false, cast: this.curCast };
      if (m.invuln) side.invuln = m.dur;
      if (m.haste) side.haste = m.haste;
    } else if (m.kind === 'area') {
      const at = m.at === 'self' ? { x: side.x, y: side.y } : { x: w.tx, y: w.ty };
      // Varios impactos: meteoritos alrededor del objetivo (scatter) o en fila hacia él (line)
      const pts = !m.count ? [at] : m.pattern === 'line'
        ? Array.from({ length: m.count }, (_, k) => { const f = (k + 1) / m.count; return { x: side.x + (at.x - side.x) * f, y: side.y + (at.y - side.y) * f }; })
        : Array.from({ length: m.count }, (_, k) => { const an = Math.random() * Math.PI * 2, d = k === 0 ? 0 : 30 + Math.random() * (m.scatter || 70); return { x: at.x + Math.cos(an) * d, y: at.y + Math.sin(an) * d }; });
      pts.forEach((pt, k) => {
        const x = S.clamp(pt.x, 10, S.ARENA.w - 10), y = S.clamp(pt.y, 10, S.ARENA.h - 10), d = m.delay + k * (m.stagger || 0);
        this.areas.push({ owner: side, m, x, y, t: d, cast: this.curCast });
        this.ev({ k: 'warn', s: side.idx, x: Math.round(x), y: Math.round(y), r: m.radius, d, ty: m.type });
      });
    } else if (m.kind === 'blink') {
      const from = { x: side.x, y: side.y };
      side.x += ax * m.dist; side.y += ay * m.dist;
      S.pushOut(side, this.rad(side), this.obstacles);
      this.ev({ k: 'blink', s: side.idx, x: Math.round(from.x), y: Math.round(from.y) });
    } else if (m.kind === 'heal') {
      const mon = this.mon(side);
      const before = mon.hp;
      if (!this.sudden) mon.hp = Math.min(mon.maxHp, mon.hp + Math.round(mon.maxHp * m.heal));
      if (m.cure) side.burn = side.poison = side.seed = 0;
      // Curarse tiene precio: un rato aturdido y vendido
      if (m.selfStun) side.stun = Math.max(side.stun, m.selfStun);
      this.ev({ k: 'heal', s: side.idx, n: Math.round(mon.hp - before) });
    } else if (m.kind === 'buff') {
      if (m.haste) side.haste = m.haste;
      if (m.power) side.power = m.power;
      this.ev({ k: 'buff', s: side.idx, splash: m.splash ? 1 : 0 });
    } else if (m.kind === 'smoke') {
      const c0 = S.cellIndex(side.x, side.y), cx = c0 % COLS, cy = Math.floor(c0 / COLS);
      for (let y = cy - m.radius; y <= cy + m.radius; y++)
        for (let x = cx - m.radius; x <= cx + m.radius; x++)
          if (x >= 0 && y >= 0 && x < COLS && y < ROWS && Math.abs(x - cx) + Math.abs(y - cy) <= m.radius) this.setCell(y * COLS + x, T.STEAM, STEAM_TTL + 1);
      side.sinceAct = 9;   // la nube oculta al instante
    } else if (m.kind === 'wall') {
      const d = Math.min(m.maxRange, Math.max(60, Math.hypot(w.tx - side.x, w.ty - side.y)));
      const cx = side.x + ax * d, cy = side.y + ay * d;
      const px = -ay, py = ax, n = 4, step = m.wallLen / (n - 1);
      const group = nextId++;
      for (let i = 0; i < n; i++) {
        const o = { id: nextId++, group, kind: 'barrier', x: cx + px * (i * step - m.wallLen / 2), y: cy + py * (i * step - m.wallLen / 2), r: 16, hp: m.wallHp, ttl: m.wallDur };
        this.obstacles.push(o);
      }
    }
  }

  // Cono delante (Lanzallamas, Ventisca, Zumbido...): golpe instantáneo en un sector; deja terreno
  cone(side, m, a) {
    this.ev({ k: 'cone', s: side.idx, x: Math.round(side.x), y: Math.round(side.y), a: +a.toFixed(2), r: m.range, arc: m.arc, ty: m.type });
    const inCone = (x, y, extra = 0) => {
      const dx = x - side.x, dy = y - side.y, d = Math.hypot(dx, dy);
      let diff = Math.atan2(dy, dx) - a;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      return d < m.range + extra && (Math.abs(diff) < m.arc / 2 || d < extra);
    };
    if (m.terrain) for (let i = 0; i < this.terrain.length; i++) { const c = S.cellCenter(i); if (inCone(c.x, c.y) && Math.random() < 0.75) this.paint(i, m.terrain); }
    const f = this.foe(side);
    if (!this.mon(f).fainted && inCone(f.x, f.y, this.rad(f))) this.hit(side, f, m, f.x, f.y, { a });
  }

  beam(side, m, a) {
    const ax = Math.cos(a), ay = Math.sin(a);
    const x1 = side.x + ax * this.rad(side), y1 = side.y + ay * this.rad(side);
    // El rayo se corta en el primer obstáculo
    let len = m.len, blocker = null;
    for (const o of this.obstacles) {
      const t = (o.x - x1) * ax + (o.y - y1) * ay;
      if (t < 0 || t > len) continue;
      const px = x1 + ax * t, py = y1 + ay * t;
      if (Math.hypot(o.x - px, o.y - py) < o.r + m.width / 2 * 0.5) { len = t; blocker = o; }
    }
    if (blocker) this.damageObstacle(blocker, m.dmg);
    const x2 = x1 + ax * len, y2 = y1 + ay * len;
    this.ev({ k: 'beam', s: side.idx, x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), w: m.width, ty: m.type });
    // Terreno a lo largo del rayo
    for (let t = 0; t <= len; t += CELL / 2) {
      const i = S.cellIndex(x1 + ax * t, y1 + ay * t);
      if (m.terrain) this.paint(i, m.terrain);
      if (m.type === 'electrico' && this.terrain[i] === T.WATER) { this.electrify(i, side, m); break; }
      if (m.type === 'fuego' && this.terrain[i] === T.WATER) this.setCell(i, T.STEAM, STEAM_TTL);
    }
    const f = this.foe(side);
    const t = Math.max(0, Math.min(len, (f.x - x1) * ax + (f.y - y1) * ay));
    if (Math.hypot(f.x - (x1 + ax * t), f.y - (y1 + ay * t)) < m.width / 2 + this.rad(f)) this.hit(side, f, m, f.x, f.y, { a });
  }

  throwBall(side, inp) {
    // Sin elegir, la mejor que quede salvo la Master Ball: esa solo se lanza si la eliges
    const kind = inp.ball ? ((side.balls[inp.ball] || 0) > 0 ? inp.ball : null)
      : ['ultraball', 'superball', 'pokeball'].find(k => (side.balls[k] || 0) > 0);
    if (!kind) return;
    side.balls[kind]--;
    side.rec = 0.3;
    const a = side.a;
    this.projectiles.push({ id: nextId++, owner: side, ball: kind, m: { type: 'normal', speed: 520, range: 460, radius: 10, dmg: 0 }, mk: 'ball',
      x: side.x + Math.cos(a) * this.rad(side), y: side.y + Math.sin(a) * this.rad(side), vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, left: 460, r: 10 });
    this.ev({ k: 'throw', s: side.idx, ball: kind, left: side.balls[kind] });
  }

  // Daño del entorno (rocas, descargas, erupciones...): un % de los PS máximos. Protección lo
  // reduce como un golpe normal. extra: estados que deja (stun, slow, burn).
  hazard(side, frac, ty, extra = {}) {
    const mon = this.mon(side);
    if (mon.fainted || side.invuln > 0 || side.forced > 0 || this.state !== 'fight') return;
    const blocked = side.prot >= 0;
    let dmg = frac * mon.maxHp * (this.sudden ? SUDDEN_MULT : 1);
    if (blocked) dmg *= 1 - D.PROTECT.block;
    dmg = Math.max(1, Math.round(dmg));
    mon.hp = Math.max(0, mon.hp - dmg);
    this.ev({ k: 'hit', s: side.idx, x: Math.round(side.x), y: Math.round(side.y), n: dmg, e: 0, b: blocked ? 1 : 0, ty, big: 0, env: 1 });
    if (blocked) return;
    if (extra.stun) { side.stun = Math.max(side.stun, extra.stun); side.wind = null; }
    if (extra.slow) side.slow = Math.max(side.slow, extra.slow);
    if (extra.burn) side.burn = Math.max(side.burn, extra.burn);
  }

  // ---------- Golpes ----------
  // Aplica un movimiento de 'src' a 'dst'. Devuelve false si fue devuelto por un parry.
  hit(src, dst, m, x, y, o = {}) {
    if (this.mon(dst).fainted || dst.invuln > 0 || dst.forced > 0) return true;
    const cast = o.cast || (o.proj && o.proj.cast) || this.curCast || null;
    // Para saber con qué tipo de movimiento se le debilita (y, para los datos de equilibrio, con cuál y quién)
    dst.lastHit = { by: src.idx, type: m.type, key: cast && cast.key, slot: src.act };
    const am = this.mon(src), dm = this.mon(dst);
    // Protección
    if (dst.prot >= 0 && m.kind !== 'area' && !o.dot) {
      if (dst.prot < D.PROTECT.perfect && !m.noParry) {   // las olas no se devuelven: solo se bloquean
        dst.energy = Math.min(D.ENERGY.max, dst.energy + 20);
        dst.prot = -1;
        if (o.proj) {      // el proyectil vuelve a quien lo lanzó
          const p = o.proj;
          p.owner = dst;
          const ang = Math.atan2(src.y - p.y, src.x - p.x);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp; p.left = m.range || 500; p.reflected = true;
        } else {           // cuerpo a cuerpo o rayo: el atacante queda aturdido
          src.stun = Math.max(src.stun, 0.9);
          src.dash = null;
        }
        this.ev({ k: 'parry', s: dst.idx, x: Math.round(x), y: Math.round(y) });
        return false;
      }
    }
    let mult = D.typeMult(m.type, D.SPECIES[dm.dex].types);
    // Cambio perfecto: el que entra resiste el tipo -> no recibe daño y gana energía
    if (dst.swapIn > 0 && mult < 1) {
      dst.swapIn = 0;
      dst.energy = Math.min(D.ENERGY.max, dst.energy + 30);
      this.ev({ k: 'perfectswap', s: dst.idx, x: Math.round(x), y: Math.round(y) });
      return true;
    }
    if (m.dmg > 0) {
      let dmg = m.dmg * am.atk * mult;
      if (D.SPECIES[am.dex].types.includes(m.type)) dmg *= STAB;
      if (src.power > 0) dmg *= 1.25;
      dmg *= src.dmgMult;
      dmg /= dm.def;
      if (dst.wet > 0 && (m.type === 'electrico' || m.type === 'hielo')) dmg *= 1.3;
      if (this.sudden) dmg *= SUDDEN_MULT;
      const blocked = dst.prot >= 0 && m.kind !== 'area';
      if (blocked) dmg *= 1 - D.PROTECT.block;
      dmg = Math.max(1, Math.round(dmg));
      dm.hp = Math.max(0, dm.hp - dmg);
      this.statMon(src).dmg += dmg; this.statMon(dst).taken += dmg;
      if (cast) { const mv = this.statMove(src, cast.key); mv.dmg += dmg; if (!cast.landed) { cast.landed = true; mv.landed++; } }
      src.energy = Math.min(D.ENERGY.max, src.energy + D.ENERGY.onHit);
      this.ev({ k: 'hit', s: dst.idx, x: Math.round(x), y: Math.round(y), n: dmg, e: mult > 1 ? 1 : mult < 1 ? -1 : 0, b: blocked ? 1 : 0, ty: m.type, big: dmg >= dm.maxHp * 0.12 ? 1 : 0 });
      if (blocked) return true;
    }
    if (cast && !cast.landed) { cast.landed = true; this.statMove(src, cast.key).landed++; }   // los de estado, sin daño
    // Estados
    if (m.burn) dst.burn = Math.max(dst.burn, m.burn);
    if (m.poison) dst.poison = Math.max(dst.poison, m.poison);
    if (m.wet) dst.wet = Math.max(dst.wet, m.wet);
    if (m.slow) dst.slow = Math.max(dst.slow, m.slow);
    if (m.stun) { dst.stun = Math.max(dst.stun, m.stun); dst.wind = null; }
    if (m.drain) { dst.seed = Math.max(dst.seed, 4); dst.seedBy = src; }
    const ang = o.a ?? Math.atan2(dst.y - src.y, dst.x - src.x);
    if (m.knock) {
      const ka = m.kind === 'area' ? Math.atan2(dst.y - y, dst.x - x) : ang;
      dst.kb = { vx: Math.cos(ka), vy: Math.sin(ka), speed: m.knock / 0.18, t: 0.18 };
      dst.wind = null;
    }
    if (m.pull) {
      const pa = Math.atan2(src.y - dst.y, src.x - dst.x);
      const d = Math.min(m.pull, Math.hypot(src.x - dst.x, src.y - dst.y) - (this.rad(src) + this.rad(dst)) * 1.1);
      if (d > 0) dst.kb = { vx: Math.cos(pa), vy: Math.sin(pa), speed: d / 0.18, t: 0.18 };
    }
    return true;
  }

  // ---------- Proyectiles ----------
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      const steps = 2;   // dos subpasos para que los rápidos no atraviesen nada
      for (let k = 0; k < steps && p.left > 0; k++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        p.left -= Math.hypot(p.vx, p.vy) * dt / steps;
        if (p.wide) { this.updateWave(p); continue; }
        // Obstáculos
        const o = this.obstacles.find(o => Math.hypot(o.x - p.x, o.y - p.y) < o.r + p.r);
        if (o) { this.damageObstacle(o, p.m.dmg || 1); this.projectileEnd(p, true); break; }
        // Interacciones con el terreno al pasar
        const i = S.cellIndex(p.x, p.y);
        if (p.m.type === 'fuego' && this.terrain[i] === T.WATER && p.m.dmg >= 10) { this.setCell(i, T.STEAM, STEAM_TTL); }
        if (p.m.type === 'fuego' && this.terrain[i] === T.GRASS && p.m.terrain === 'fuego') this.paint(i, 'fuego');
        // Rival
        const f = this.foe(p.owner);
        if (Math.hypot(f.x - p.x, f.y - p.y) < Math.max(this.rad(f), PROJ_MIN_TARGET) + p.r + (p.ball ? 0 : PROJ_FORGIVE) && !this.mon(f).fainted && f.invuln <= 0 && f.forced <= 0) {
          if (p.ball) { this.ballHit(p, f); p.left = 0; break; }
          if (this.hit(p.owner, f, p.m, p.x, p.y, { proj: p, a: Math.atan2(p.vy, p.vx) })) { p.hitFoe = true; this.projectileEnd(p, true); }
          break;
        }
        if (p.x < -40 || p.y < -40 || p.x > S.ARENA.w + 40 || p.y > S.ARENA.h + 40) p.left = 0;
        else if (p.left <= 0) this.projectileEnd(p, false);
      }
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0);
  }

  // Frente de la ola: moja el suelo bajo todo su ancho y golpea una vez a quien pille
  updateWave(p) {
    const ux = p.vx / (Math.hypot(p.vx, p.vy) || 1), uy = p.vy / (Math.hypot(p.vx, p.vy) || 1);
    if (p.m.terrain) for (let o = -p.wide; o <= p.wide; o += CELL * 0.75) {
      const x = p.x - uy * o, y = p.y + ux * o;
      if (x >= 0 && y >= 0 && x < S.ARENA.w && y < S.ARENA.h && Math.random() < 0.5) this.paint(S.cellIndex(x, y), p.m.terrain);
    }
    const f = this.foe(p.owner);
    if (!p.hitFoe && !this.mon(f).fainted && f.invuln <= 0 && f.forced <= 0) {
      const dx = f.x - p.x, dy = f.y - p.y;
      if (Math.abs(dx * ux + dy * uy) < p.r + this.rad(f) && Math.abs(-dx * uy + dy * ux) < p.wide + this.rad(f)) {
        p.hitFoe = true;
        this.hit(p.owner, f, { ...p.m, noParry: true }, f.x, f.y, { a: Math.atan2(p.vy, p.vx), cast: p.cast });
      }
    }
    if (p.left <= 0 || p.x < -60 || p.y < -60 || p.x > S.ARENA.w + 60 || p.y > S.ARENA.h + 60) p.left = 0;
  }

  projectileEnd(p, impact) {
    p.left = 0;
    const i = S.cellIndex(p.x, p.y);
    if (p.m.terrain && !p.m.explode) this.paint(i, p.m.terrain);
    // Explosión al final (Llamarada, Bomba Lodo): daño en área si no le dio de lleno, y terreno alrededor
    if (p.m.explode) {
      const m = p.m, R = m.explode;
      this.ev({ k: 'boom', s: p.owner.idx, x: Math.round(p.x), y: Math.round(p.y), r: R, ty: m.type });
      const f = this.foe(p.owner);
      if (!p.hitFoe && Math.hypot(f.x - p.x, f.y - p.y) < R + this.rad(f)) this.hit(p.owner, f, { ...m, kind: 'area', dmg: Math.round(m.dmg * 0.6) }, f.x, f.y, { cast: p.cast });
      const c0 = i, cx = c0 % COLS, cy = Math.floor(c0 / COLS), rr = Math.ceil(R / CELL);
      for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const cc = S.cellCenter(y * COLS + x);
        if (Math.hypot(cc.x - p.x, cc.y - p.y) > R) continue;
        if (m.terrain) this.paint(y * COLS + x, m.terrain);
        if (m.puddle) this.paint(y * COLS + x, m.puddle);
      }
      return;
    }
    if (p.m.type === 'electrico' && this.terrain[i] === T.WATER) this.electrify(i, p.owner, p.m);
    if (!p.ball) this.ev({ k: 'pend', x: Math.round(p.x), y: Math.round(p.y), ty: p.m.type, imp: impact ? 1 : 0 });
  }

  // La Ball acierta: el combate se pausa mientras dura la animación (entrar en la Ball, caer,
  // hasta 3 sacudidas) y al final se decide. Cada sacudida pasa con p^(1/3).
  ballHit(p, f) {
    const mon = this.mon(f);
    const status = f.burn > 0 || f.poison > 0 || f.stun > 0 || f.slow > 0 || f.seed > 0;
    const chance = D.catchChance(mon.hp / mon.maxHp, p.ball, status, mon.dex);
    const per = Math.cbrt(chance);
    let shakes = 0;
    while (shakes < 3 && Math.random() < per) shakes++;
    const ok = shakes === 3;
    const dur = CATCH_IN + shakes * CATCH_SHAKE + (ok ? CATCH_CLICK : CATCH_BREAK);
    this.capturing = { thrower: p.owner, foe: f, ok, t: dur };
    this.state = 'capture';
    for (const x of this.projectiles) x.left = 0;   // la escena se congela durante la captura
    f.wind = null; f.dash = null; f.kb = null;
    this.ev({ k: 'capture', s: f.idx, x: Math.round(f.x), y: Math.round(f.y), ball: p.ball, shakes, ok: ok ? 1 : 0, chance: Math.round(chance * 100) });
  }

  updateCapture(dt) {
    const c = this.capturing;
    if ((c.t -= dt) > 0) return;
    this.capturing = null;
    const mon = this.mon(c.foe);
    if (c.ok) return this.finish(c.thrower.idx, { captured: { dex: mon.dex, level: mon.level, shiny: mon.shiny, iv: mon.iv } });
    this.state = 'fight';
    c.foe.invuln = 0.8;
    this.ev({ k: 'escape', s: c.foe.idx, x: Math.round(c.foe.x), y: Math.round(c.foe.y) });
  }

  // ---------- Áreas ----------
  updateAreas(dt) {
    for (const ar of this.areas) {
      if ((ar.t -= dt) > 0) continue;
      const m = ar.m, src = ar.owner, f = this.foe(src);
      this.ev({ k: 'boom', s: src.idx, x: Math.round(ar.x), y: Math.round(ar.y), r: m.radius, ty: m.type });
      if (Math.hypot(f.x - ar.x, f.y - ar.y) < m.radius + this.rad(f)) this.hit(src, f, m, f.x, f.y, { cast: ar.cast });
      // Terreno en el área
      const r = Math.ceil(m.radius / CELL);
      const c0 = S.cellIndex(ar.x, ar.y), cx = c0 % COLS, cy = Math.floor(c0 / COLS);
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const cc = S.cellCenter(y * COLS + x);
        if (Math.hypot(cc.x - ar.x, cc.y - ar.y) > m.radius) continue;
        const i = y * COLS + x;
        if (m.terrain) this.paint(i, m.terrain);
        if (m.type === 'fuego' && this.terrain[i] === T.WATER) this.setCell(i, T.STEAM, STEAM_TTL);
      }
      if (m.type === 'electrico') {
        const wi = this.findWaterNear(ar.x, ar.y, m.radius);
        if (wi >= 0) this.electrify(wi, src, m);
      }
      // Los obstáculos dentro del área reciben daño
      for (const o of this.obstacles) if (Math.hypot(o.x - ar.x, o.y - ar.y) < m.radius + o.r) this.damageObstacle(o, m.dmg);
      if (m.rockWall) {
        this.obstacles.push({ id: nextId++, kind: 'rockwall', x: ar.x, y: ar.y, r: 26, hp: 60, ttl: 6 });
        for (const s of this.sides) S.pushOut(s, this.rad(s), this.obstacles);
      }
      if (m.selfKO) { const mon = this.mon(src); mon.hp = 0; }
    }
    this.areas = this.areas.filter(a => a.t > 0);
  }

  // ---------- Terreno ----------
  setCell(i, type, ttl) {
    if (this.terrain[i] === type && this.ttl[i] >= ttl) return;
    this.terrain[i] = type;
    this.ttl[i] = ttl;
    this.spread[i] = 0;
    this.dirty.add(i);
  }

  // Pinta fuego o agua respetando las combinaciones.
  // fuego: el agua da vapor, el hielo se derrite, la lava no cambia. agua: apaga el fuego y enfría
  // la lava un momento. hielo: congela el agua. Al acabar el efecto, vuelve lo que hubiera en el mapa.
  paint(i, kind) {
    const cur = this.terrain[i];
    if (kind === 'fuego') {
      if (cur === T.WATER) this.setCell(i, T.STEAM, STEAM_TTL);
      else if (cur === T.ICE) this.setCell(i, T.WATER, WATER_TTL);
      else if (cur !== T.STEAM && cur !== T.LAVA) this.setCell(i, T.FIRE, FIRE_TTL);
    } else if (kind === 'agua') {
      if (cur === T.FIRE || cur === T.LAVA) this.setCell(i, T.STEAM, STEAM_TTL);
      else if (cur !== T.GRASS && cur !== T.ICE && cur !== T.WEB) this.setCell(i, T.WATER, WATER_TTL);
    } else if (kind === 'hielo') {
      if (cur === T.WATER) this.setCell(i, T.ICE, ICE_TTL);
    } else if (kind === 'veneno') {
      if (cur === T.NONE || cur === T.BURNT) this.setCell(i, T.POISON, POISON_TTL);
    }
  }

  findWaterNear(x, y, r) {
    for (let i = 0; i < this.terrain.length; i++) {
      if (this.terrain[i] !== T.WATER) continue;
      const c = S.cellCenter(i);
      if (Math.hypot(c.x - x, c.y - y) <= r + CELL / 2) return i;
    }
    return -1;
  }

  // Descarga eléctrica en todo el charco conectado: daña y aturde a quien esté dentro.
  electrify(start, src, m) {
    const seen = new Set([start]), queue = [start];
    while (queue.length) {
      const i = queue.pop();
      const x = i % COLS, y = Math.floor(i / COLS);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const n = ny * COLS + nx;
        if (!seen.has(n) && this.terrain[n] === T.WATER) { seen.add(n); queue.push(n); }
      }
    }
    this.ev({ k: 'zap', cells: [...seen] });
    const f = this.foe(src);
    if (seen.has(S.cellIndex(f.x, f.y))) {
      this.hit(src, f, { ...m, kind: 'area', dmg: Math.max(8, (m.dmg || 0) * 0.7), stun: 0.5, knock: 0 }, f.x, f.y);
    }
  }

  updateTerrain(dt) {
    for (let i = 0; i < this.terrain.length; i++) {
      const t = this.terrain[i];
      if (t === T.FIRE && (this.spread[i] += dt) >= SPREAD_T) {   // el fuego se propaga por la hierba alta y las telarañas
        this.spread[i] = -99;
        const x = i % COLS, y = Math.floor(i / COLS);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          const n = ny * COLS + nx;
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && (this.terrain[n] === T.GRASS || this.terrain[n] === T.WEB)) this.setCell(n, T.FIRE, FIRE_TTL);
        }
      }
      if (!(this.ttl[i] > 0) || this.ttl[i] === Infinity) continue;
      if ((this.ttl[i] -= dt) <= 0) {
        const base = this.base[i];
        const back = S.PERMANENT.has(base) && base !== t;
        this.terrain[i] = back ? base : t === T.FIRE ? T.BURNT : T.NONE;
        this.ttl[i] = back ? Infinity : 0;
        this.dirty.add(i);
      }
    }
  }

  damageObstacle(o, n) {
    if (o.hp === Infinity) return;
    if (o.group) {
      for (const g of this.obstacles) if (g.group === o.group) g.hp -= n;
    } else o.hp -= n;
  }

  updateObstacles(dt) {
    const before = this.obstacles.length;
    for (const o of this.obstacles) if (o.ttl !== Infinity) o.ttl -= dt;
    this.obstacles = this.obstacles.filter(o => o.hp > 0 && o.ttl > 0);
    if (this.obstacles.length !== before) this.ev({ k: 'obs' });
  }

  // ---------- Debilitados y final ----------
  checkFaints() {
    for (const side of this.sides) {
      const mon = this.mon(side);
      if (mon.fainted || mon.hp > 0) continue;
      mon.fainted = true;
      // Debilitado por un golpe del rival: cuenta para los logros de debilitar con movimientos de ese tipo
      if (side.lastHit && side.lastHit.by !== side.idx) {
        const lh = side.lastHit, by = this.sides[lh.by];
        (this.kos = this.kos || []).push({ by: lh.by, type: lh.type });
        this.statMon(by, lh.slot).kos++;
        if (lh.key) this.statMove(by, lh.key).kos++;
      }
      side.wind = null; side.dash = null; side.kb = null; side.prot = -1; side.swapping = 0;
      this.ev({ k: 'faint', s: side.idx, slot: side.act });
      if (side.team.some(m => !m.fainted)) { side.forced = FORCED_SWAP_T; side.swapTo = -1; }
    }
    if (this.state !== 'fight') return;
    const out = this.sides.map(s => s.team.every(m => m.fainted));
    if (out[0] || out[1]) this.finish(out[0] && out[1] ? -1 : out[0] ? 1 : 0, {});
  }

  finish(winner, extra) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.result = { winner, ...extra };
    this.broadcast();
    clearInterval(this.timer);
    // Lo que sobrevive y gana experiencia lo decide quien creó el combate (onEnd)
    const rewards = this.onEnd(this.result, this) || [];
    const sum = this.sides.map(s => this.sideSummary(s));
    for (const s of this.sides) this.send(s, { t: 'over', winner, you: s.idx, captured: extra.captured || null, reward: rewards[s.idx] || null, sum });
  }

  // Resumen de un lado para la pantalla de resultados: daño hecho y recibido, KOs, aciertos, su mejor
  // movimiento y cómo acabó cada Pokémon
  sideSummary(side) {
    const mons = Object.values(this.stats.mons[side.idx]), moves = Object.entries(this.stats.moves[side.idx]);
    const best = moves.reduce((b, [k, mv]) => (mv.dmg > (b ? b[1].dmg : 0) ? [k, mv] : b), null);
    const sum = f => mons.reduce((n, m) => n + m[f], 0), sumM = f => moves.reduce((n, [, mv]) => n + mv[f], 0);
    return { name: side.name, dmg: sum('dmg'), taken: sum('taken'), kos: sum('kos'), casts: sumM('casts'), landed: sumM('landed'),
      best: best ? { key: best[0], dmg: best[1].dmg } : null, team: side.team.map(m => ({ dex: m.dex, fainted: !!m.fainted, shiny: !!m.shiny })) };
  }

  // Un jugador se rinde o se desconecta: pierde. Si solo se rinde, sigue recibiendo el resultado.
  leave(side, disconnected = false) {
    if (disconnected) { side.connected = false; side.ws = null; }
    if (this.state !== 'over') this.finish(1 - side.idx, { forfeit: side.idx });
  }

  stop() { clearInterval(this.timer); this.state = 'over'; }

  // ---------- Red ----------
  sideSnap(s, viewer) {
    const mon = this.mon(s);
    const hide = s.hidden && viewer !== s.idx && this.state === 'fight';
    const o = {
      f: this.flags(s), act: s.act, hp: s.team.map(m => m.hp), a: +s.a.toFixed(2),
      e: Math.round(s.energy), w: s.wind ? { c: s.wind.c, p: +(s.wind.t / s.wind.m.wind).toFixed(2), a: +s.wind.a.toFixed(2), tx: Math.round(s.wind.tx), ty: Math.round(s.wind.ty) } : 0,
    };
    if (!hide) { o.x = +s.x.toFixed(1); o.y = +s.y.toFixed(1); }
    if (viewer === s.idx) {
      o.cds = mon.cds.map(c => +c.toFixed(2)); o.pcd = +s.pcd.toFixed(2); o.swcd = +s.swapCd.toFixed(2); o.ack = s.ack;
      o.allcds = s.team.map(m => m.cds.map(c => +c.toFixed(1)));
      if (this.arena.m.ice) o.v = [Math.round(s.vx || 0), Math.round(s.vy || 0)];   // inercia sobre hielo (predicción)
    }
    return o;
  }

  broadcast() {
    const terrainDiff = [...this.dirty].map(i => [i, this.terrain[i]]);
    this.dirty.clear();
    const common = {
      t: 'snap', st: Math.round(this.t * 1000), state: this.state, cd: Math.ceil(this.countdown),
      tl: Math.max(0, Math.ceil(LIMIT - (this.fightT || 0))), sd: this.sudden ? 1 : 0,
      pr: this.projectiles.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), r: p.r, o: p.owner.idx, mk: p.mk, ball: p.ball || undefined, w: p.wide || undefined, a: +Math.atan2(p.vy, p.vx).toFixed(2) })),
      ob: this.obstacles.filter(o => o.kind !== 'rock').map(o => ({ id: o.id, x: Math.round(o.x), y: Math.round(o.y), r: o.r, k: o.kind })),
      tr: terrainDiff, ev: this.events, ar: this.arena.snap(),
    };
    if (!common.ar) delete common.ar;
    if (!terrainDiff.length) delete common.tr;
    this.events = [];
    for (const s of this.sides) {
      if (!s.ws) continue;
      const msg = { ...common, ps: this.sides.map(x => this.sideSnap(x, s.idx)) };
      this.send(s, JSON.stringify(msg));
    }
  }
}

module.exports = { Battle, makeMon };
