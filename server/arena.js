// Mecánicas del entorno de las arenas de gimnasio (public/data.js, ARENAS). Las simula el servidor;
// el cliente solo las dibuja con los eventos y el campo 'ar' de cada snapshot.
//
//   rockfall  caen rocas cerca de cada Pokémon (aviso, golpe y roca temporal que hace de cobertura)
//   tide      la marea sube y baja: los charcos crecen una casilla alrededor
//   shock     placas eléctricas que se encienden por turnos (dos grupos en damero)
//   regrow    la hierba alta y las telarañas vuelven a crecer tras quemarse
//   toxic     los charcos tóxicos se extienden un rato; pisarlos envenena
//   warp      teletransportes por parejas
//   eruption  la lava entra en erupción (aviso y explosión que deja fuego)
//   quake     terremoto: una onda que se expande desde un epicentro
//   wind      ráfagas que empujan en una dirección (no a los voladores)
//   heal      baldosas que curan mientras les quede carga
//   dark      oscuridad: el rival no se ve de lejos
//   flow      corriente en el agua (se aplica en Shared.arenaStep)
//   beam      haz giratorio desde el centro (faro, aliento de dragón, haz psíquico)
//   geyser    géiseres: aviso y chorro que hace daño y lanza hacia fuera
//   crack     el hielo se agrieta si te quedas encima y se rompe en agua un rato
//   belts     cintas transportadoras (se aplican en Shared.arenaStep)
//   pillars   pilares de piedra que suben y bajan por turnos (la cobertura cambia de sitio)
//   gravity   a ratos, un pozo en el centro atrae a todos y curva los proyectiles; en el centro hace daño
//   mirrors   espejos que hacen rebotar los proyectiles
//   storm     tormenta: rayos con aviso; si caen junto al agua, electrifican a quien esté en ella
//   fog       bancos de niebla: quien está dentro no se ve de lejos
//   flowers   flores que curan poco a poco (F) o adormecen, que ralentiza (f)
//   fissure   el suelo se agrieta cerca de cada Pokémon (aviso) y la grieta es lava un rato
//   quicksand charcas de arenas movedizas: frenan, y quien se queda quieto dentro se hunde (daño); no a voladores ni tierra
//   bumpers   parachoques: rebotan a quien los toca y hacen rebotar los proyectiles
//   hands     manos fantasma: con aviso bajo cada Pokémon salen del suelo y atrapan (daño y aturden); no a los fantasma
//   magnets   imanes: curvan los proyectiles que pasan cerca
//   carts     vagonetas: con aviso en la vía, una cruza la arena y arrastra a quien pilla
//   spores    nubes de esporas a la deriva: dentro adormecen (frenan); no a bicho, planta ni voladores
// Geiseres, tormenta, gravedad, niebla y pilares también pueden ir de modificador en Práctica (Data.MODIFIERS)
const D = require('../public/data.js');
const S = require('../public/shared.js');

const { T, CELL, COLS, ROWS } = S;
const CX = S.ARENA.w / 2, CY = S.ARENA.h / 2;
const typesOf = mon => D.SPECIES[mon.dex].types;

class Arena {
  constructor(battle) {
    this.b = battle;
    this.name = battle.mapName;
    this.def = D.ARENAS[this.name] || null;
    this.m = S.mechFor(this.name, battle.mod);
    this.marks = S.parseMap(this.name);
    this.base = battle.base;   // compartido con el combate (la marea lo cambia)
    this.danger = [];          // zonas avisadas (la IA las esquiva): { x, y, r, t }
    this.pending = [];         // golpes avisados que aún no han caído
    this.wind = null;          // { vx, vy } mientras sopla
    this.dark = this.m.dark || 0;
    const m = this.m;
    this.timers = {};
    for (const k of ['rockfall', 'tide', 'shock', 'toxic', 'eruption', 'quake', 'wind', 'geyser', 'storm', 'gravity', 'pillars', 'fissure', 'hands', 'carts']) if (m[k]) this.timers[k] = (m[k].every || 8) * 0.6;
    if (m.shock) { this.shock = { g: 0, phase: 'idle', t: 0 }; this.panelGroup = this.marks.panels.map(i => (((i % COLS) >> 1) + ((Math.floor(i / COLS)) >> 1)) % 2); }
    if (m.tide) { this.tideUp = false; this.tideCells = this.ringCells(); }
    if (m.regrow) this.regrowT = new Float32Array(COLS * ROWS);
    if (m.heal) this.pads = this.marks.heal.map(p => ({ ...p, c: 1, cd: 0 }));
    // (el haz empieza en vertical: en horizontal pasaría justo por donde salen los Pokémon al empezar)
    if (m.beam) { this.beamA = Math.PI / 2; this.beamCd = [0, 0]; }
    if (m.warp) this.warpCd = [0, 0];
    this.quakes = [];
    this.fog = m.fog ? S.fogZones(m.fog) : [];
    this.mirrors = m.mirrors ? S.mirrorSegs(m.mirrors) : null;
    this.flowers = m.flowers ? new Map(this.marks.flowers.map(f => [f.i, f.k])) : null;
    this.pull = 0;
    // Espejos: también cortan el paso (círculos pequeños a lo largo del cristal, que los proyectiles ignoran)
    if (this.mirrors) for (const [x1, y1, x2, y2] of this.mirrors) {
      const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 16));
      for (let k = 0; k <= n; k++) battle.obstacles.push({ id: battle.newId(), kind: 'mirror', x: x1 + (x2 - x1) * k / n, y: y1 + (y2 - y1) * k / n, r: 9, hp: Infinity, ttl: Infinity });
    }
    // Pilares: empieza arriba el grupo 0
    if (m.pillars) { this.pillars = S.pillarSpots(m.pillars); this.pillarUp = 0; this.raisePillars(0); }
    // Arenas movedizas y parachoques: sitios fijos (Shared, los mismos que dibuja el cliente)
    this.sand = m.quicksand ? S.sandZones(m.quicksand) : null;
    this.bumpers = m.bumpers ? S.bumperSpots(m.bumpers) : null;
    this.magnets = m.magnets ? S.magnetSpots(m.magnets) : null;
    if (this.magnets) for (const q of this.magnets) battle.obstacles.push({ id: battle.newId(), kind: 'magnet', x: q.x, y: q.y, r: q.r, hp: Infinity, ttl: Infinity });
    this.carts = [];     // vagonetas en marcha: { y, dir, x, warn, hit }
    this.sporeT = Math.random() * 100;   // (las nubes empiezan en un punto distinto cada combate)
    if (this.bumpers) for (const p of this.bumpers) battle.obstacles.push({ id: battle.newId(), kind: 'bumper', x: p.x, y: p.y, r: p.r, hp: Infinity, ttl: Infinity });
    // Muros invisibles: obstáculos que no se dibujan (el cliente los recibe para chocar con ellos)
    for (const g of this.marks.ghost) battle.obstacles.push({ id: battle.newId(), ...g, hp: Infinity, ttl: Infinity, kind: 'ghost' });
  }

  get active() { return !!this.def || !!this.b.mod; }

  inFog(side) { return this.fog.some(z => Math.hypot(side.x - z.x, side.y - z.y) < z.r); }

  // Sube los pilares del grupo g (y quita los del otro), sacando de dentro a quien estuviera encima
  raisePillars(g) {
    const b = this.b;
    b.obstacles = b.obstacles.filter(o => o.kind !== 'pillar');
    for (const p of this.pillars) if (p.g === g) b.obstacles.push({ id: b.newId(), kind: 'pillar', x: p.x, y: p.y, r: 26, hp: Infinity, ttl: Infinity });
    for (const s of b.sides) S.pushOut(s, b.rad(s), b.obstacles);
  }

  // Espejos: si el proyectil toca un cristal, rebota (refleja la velocidad sobre la normal del espejo)
  bounce(p) {
    // Parachoques: el proyectil rebota en el círculo (refleja la velocidad sobre la normal del choque)
    if (this.bumpers) for (const q of this.bumpers) {
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      if (d >= q.r + p.r || d < 0.001) continue;
      const nx = dx / d, ny = dy / d, dot = p.vx * nx + p.vy * ny;
      if (dot >= 0) continue;
      p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny;
      p.x = q.x + nx * (q.r + p.r + 1); p.y = q.y + ny * (q.r + p.r + 1);
      this.b.ev({ k: 'bump', x: Math.round(q.x), y: Math.round(q.y) });
      return true;
    }
    if (!this.mirrors) return false;
    for (const [x1, y1, x2, y2] of this.mirrors) {
      const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey;
      const t = S.clamp(((p.x - x1) * ex + (p.y - y1) * ey) / L2, 0, 1);
      const qx = x1 + ex * t, qy = y1 + ey * t, dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
      if (d >= p.r + 4 || d < 0.001) continue;
      const nx = dx / d, ny = dy / d, dot = p.vx * nx + p.vy * ny;
      if (dot >= 0) continue;   // ya se aleja
      p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny;
      p.x = qx + nx * (p.r + 5); p.y = qy + ny * (p.r + 5);
      this.b.ev({ k: 'mirror', x: Math.round(qx), y: Math.round(qy) });
      return true;
    }
    return false;
  }

  // Gravedad: mientras late el pozo, los proyectiles se curvan hacia el centro (sin ganar velocidad)
  bend(p, dt) {
    // Imanes: cerca de uno, el proyectil se curva hacia él (sin ganar velocidad)
    if (this.magnets && !p.wide) for (const q of this.magnets) {
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > q.R) continue;
      const sp = Math.hypot(p.vx, p.vy), k = this.m.magnets.force * (1 - d / q.R);
      p.vx += dx / d * k * dt; p.vy += dy / d * k * dt;
      const f = sp / (Math.hypot(p.vx, p.vy) || 1); p.vx *= f; p.vy *= f;
    }
    if (!this.pull || p.wide) return;
    const sp = Math.hypot(p.vx, p.vy), dx = CX - p.x, dy = CY - p.y, d = Math.hypot(dx, dy) || 1;
    p.vx += dx / d * this.pull * 9 * dt; p.vy += dy / d * this.pull * 9 * dt;
    const k = sp / (Math.hypot(p.vx, p.vy) || 1);
    p.vx *= k; p.vy *= k;
  }

  // Viento que afecta a un bando (los voladores no lo notan)
  windFor(side) {
    if (!this.wind) return null;
    if (typesOf(this.b.mon(side)).includes('volador')) return null;
    return [this.wind.vx, this.wind.vy];
  }

  env(side) { return { map: this.name, mech: this.m, terrain: this.b.terrain, wind: this.windFor(side), pull: this.pull }; }

  // Casillas que la marea alta cubre: las vecinas del agua del mapa
  ringCells() {
    const out = [];
    for (let i = 0; i < this.base.length; i++) {
      if (this.base[i] !== T.NONE) continue;
      const x = i % COLS, y = Math.floor(i / COLS);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && this.base[ny * COLS + nx] === T.WATER; })) out.push(i);
    }
    return out;
  }

  tick(name, dt) {
    const m = this.m[name];
    if ((this.timers[name] -= dt) > 0) return false;
    this.timers[name] = m.every * (0.85 + Math.random() * 0.3);
    return true;
  }

  // Avisa de un golpe en (x, y) con radio r que cae dentro de 'warn' s
  warnAt(x, y, r, warn, ty, onHit) {
    this.b.ev({ k: 'warn', x: Math.round(x), y: Math.round(y), r, d: warn, ty });
    this.danger.push({ x, y, r, t: warn });
    this.pending.push({ x, y, r, t: warn, ty, onHit });
  }

  update(dt) {
    if (!this.active) return;
    const b = this.b, m = this.m;
    for (const d of this.danger) d.t -= dt;
    this.danger = this.danger.filter(d => d.t > 0);
    for (const p of this.pending) {
      if ((p.t -= dt) > 0) continue;
      b.ev({ k: 'boom', x: Math.round(p.x), y: Math.round(p.y), r: p.r, ty: p.ty });
      p.onHit(p);
    }
    this.pending = this.pending.filter(p => p.t > 0);

    // Rocas del techo: una cerca de cada Pokémon
    if (m.rockfall && this.tick('rockfall', dt)) {
      const o = m.rockfall;
      for (const s of b.sides) {
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 80;
        const x = S.clamp(s.x + Math.cos(a) * d, 40, S.ARENA.w - 40), y = S.clamp(s.y + Math.sin(a) * d, 40, S.ARENA.h - 40);
        // ty: tipo de lo que cae (rocas, carámbanos que ralentizan, emboscadas de las sombras...)
        const ty = o.ty || 'roca';
        this.warnAt(x, y, o.r, o.warn, ty, p => {
          for (const t of b.sides) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + b.rad(t)) b.hazard(t, o.dmg, ty, o.slow ? { slow: o.slow } : { stun: 0.35 });
          b.obstacles.push({ id: b.newId(), kind: 'rockwall', x: p.x, y: p.y, r: 24, hp: 60, ttl: o.ttl });
          for (const t of b.sides) S.pushOut(t, b.rad(t), b.obstacles);
        });
      }
    }
    // Marea
    if (m.tide && this.tick('tide', dt)) {
      this.tideUp = !this.tideUp;
      for (const i of this.tideCells) {
        const cur = b.terrain[i];
        if (this.tideUp && (cur === T.NONE || cur === T.BURNT)) { this.base[i] = T.WATER; b.setCell(i, T.WATER, Infinity); }
        else if (!this.tideUp) { this.base[i] = T.NONE; if (cur === T.WATER) b.setCell(i, T.NONE, 0); }
      }
      b.ev({ k: 'arena', msg: this.tideUp ? '¡Sube la marea!' : 'Baja la marea' });
    }
    // Placas eléctricas: aviso, descarga, y le toca al otro grupo
    if (m.shock) {
      const sh = this.shock, o = m.shock;
      sh.t -= dt;
      if (sh.phase === 'idle' && this.tick('shock', dt)) { sh.phase = 'warn'; sh.t = o.warn; b.ev({ k: 'panel', g: sh.g, ph: 'warn', d: o.warn }); }
      else if (sh.phase === 'warn' && sh.t <= 0) {
        sh.phase = 'idle';
        b.ev({ k: 'panel', g: sh.g, ph: 'zap' });
        const cells = new Set(this.marks.panels.filter((_, k) => this.panelGroup[k] === sh.g));
        for (const s of b.sides) {
          if (!cells.has(S.cellIndex(s.x, s.y)) || typesOf(b.mon(s)).includes('electrico')) continue;
          b.hazard(s, o.dmg, 'electrico', { stun: o.stun });
        }
        sh.g = 1 - sh.g;
      }
      if (sh.phase === 'warn') {
        // la IA ve las placas encendidas como zona peligrosa
        if (!sh.marked) { sh.marked = true; for (const [k, i] of this.marks.panels.entries()) if (this.panelGroup[k] === sh.g) { const c = S.cellCenter(i); this.danger.push({ x: c.x, y: c.y, r: CELL * 0.75, t: sh.t }); } }
      } else sh.marked = false;
    }
    // La hierba y las telarañas vuelven a crecer
    if (m.regrow) {
      for (let i = 0; i < this.base.length; i++) {
        const want = this.base[i];
        if (want !== T.GRASS && want !== T.WEB) continue;
        const cur = b.terrain[i];
        if (cur === want || cur === T.FIRE || cur === T.STEAM) { this.regrowT[i] = 0; continue; }
        if ((this.regrowT[i] += dt) >= m.regrow) { this.regrowT[i] = 0; b.setCell(i, want, want === T.WEB ? Infinity : 0); }
      }
    }
    // Los charcos tóxicos se extienden un rato
    if (m.toxic && this.tick('toxic', dt)) {
      const src = [];
      for (let i = 0; i < this.base.length; i++) if (b.terrain[i] === T.POISON) src.push(i);
      for (let n = 0; n < 2 && src.length; n++) {
        const i = src[Math.floor(Math.random() * src.length)], x = i % COLS, y = Math.floor(i / COLS);
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && b.terrain[ny * COLS + nx] === T.NONE);
        if (opts.length) { const [nx, ny] = opts[Math.floor(Math.random() * opts.length)]; b.setCell(ny * COLS + nx, T.POISON, m.toxic.ttl); }
      }
    }
    // Teletransportes
    if (m.warp) {
      for (const s of b.sides) {
        this.warpCd[s.idx] = Math.max(0, this.warpCd[s.idx] - dt);
        if (this.warpCd[s.idx] > 0 || s.dash || s.kb || b.mon(s).fainted) continue;
        for (const [p, q] of this.marks.pads) {
          const [from, to] = Math.hypot(s.x - p.x, s.y - p.y) < 16 ? [p, q] : Math.hypot(s.x - q.x, s.y - q.y) < 16 ? [q, p] : [null, null];
          if (!from) continue;
          s.x = to.x; s.y = to.y; s.vx = s.vy = 0;
          S.pushOut(s, b.rad(s), b.obstacles);
          this.warpCd[s.idx] = m.warp.cd;
          b.ev({ k: 'warp', s: s.idx, x1: Math.round(from.x), y1: Math.round(from.y), x2: Math.round(to.x), y2: Math.round(to.y) });
          break;
        }
      }
    }
    // Erupciones: un charco de lava en cada mitad
    if (m.eruption && this.tick('eruption', dt)) {
      const o = m.eruption;
      const lava = [];
      for (let i = 0; i < this.base.length; i++) if (this.base[i] === T.LAVA) lava.push(i);
      for (const half of [0, 1]) {
        const mine = lava.filter(i => (i % COLS < COLS / 2) === (half === 0));
        if (!mine.length) continue;
        const c = S.cellCenter(mine[Math.floor(Math.random() * mine.length)]);
        this.warnAt(c.x, c.y, o.r, o.warn, 'fuego', p => {
          for (const t of b.sides) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + b.rad(t)) b.hazard(t, o.dmg, 'fuego', { burn: 3 });
          const c0 = S.cellIndex(p.x, p.y), cx = c0 % COLS, cy = Math.floor(c0 / COLS);
          for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++)
            if (x >= 0 && y >= 0 && x < COLS && y < ROWS && Math.random() < 0.7) b.paint(y * COLS + x, 'fuego');
        });
      }
    }
    // Terremoto: aviso en el epicentro y una onda que se expande
    if (m.quake && this.tick('quake', dt)) {
      const o = m.quake;
      const x = 160 + Math.random() * (S.ARENA.w - 320), y = 120 + Math.random() * (S.ARENA.h - 240);
      this.quakes.push({ x, y, t: -o.warn, hit: new Set() });
      b.ev({ k: 'quake', x: Math.round(x), y: Math.round(y), d: o.warn, sp: o.speed });
    }
    for (const q of this.quakes) {
      q.t += dt;
      if (q.t < 0) continue;
      const R = q.t * m.quake.speed;
      for (const s of b.sides) {
        if (q.hit.has(s.idx) || typesOf(b.mon(s)).includes('volador')) continue;
        if (Math.abs(Math.hypot(s.x - q.x, s.y - q.y) - R) < 22 + b.rad(s)) {
          q.hit.add(s.idx);
          // Detrás de una roca (vista desde el epicentro) la onda no llega
          if (this.shielded(q, s)) b.ev({ k: 'covered', s: s.idx });
          else b.hazard(s, m.quake.dmg, 'tierra', { slow: m.quake.slow });
        }
      }
    }
    this.quakes = this.quakes.filter(q => q.t * m.quake.speed < 1200);
    // Viento: aviso con la dirección y luego empuja un rato
    if (m.wind) {
      const o = m.wind;
      if (this.gust) {
        if ((this.gust.t -= dt) <= 0) {
          if (this.gust.ph === 'warn') { this.gust.ph = 'blow'; this.gust.t = o.dur; this.wind = { vx: Math.cos(this.gust.a) * o.force, vy: Math.sin(this.gust.a) * o.force }; }
          else { this.gust = null; this.wind = null; }
        }
      } else if (this.tick('wind', dt)) {
        const a = Math.floor(Math.random() * 8) * Math.PI / 4;
        this.gust = { ph: 'warn', t: o.warn, a };
        b.ev({ k: 'gust', a: +a.toFixed(2), d: o.warn, dur: o.dur });
      }
    }
    // Baldosas de curación
    if (m.heal) {
      for (const p of this.pads) {
        if (p.cd > 0) { if ((p.cd -= dt) <= 0) { p.cd = 0; p.c = 1; } continue; }
        for (const s of b.sides) {
          const mon = b.mon(s);
          if (mon.fainted || b.sudden || S.cellIndex(s.x, s.y) !== p.i || mon.hp >= mon.maxHp) continue;
          s.healAcc = (s.healAcc || 0) + m.heal.rate * mon.maxHp * dt;
          p.c -= m.heal.drain * dt;
          if (s.healAcc >= 3) { const n = Math.floor(s.healAcc); s.healAcc -= n; mon.hp = Math.min(mon.maxHp, mon.hp + n); b.ev({ k: 'heal', s: s.idx, n }); }
        }
        if (p.c <= 0) { p.c = 0; p.cd = m.heal.cd; b.ev({ k: 'arena', msg: 'Una baldosa de curación se ha agotado' }); }
      }
    }
    // Haz del faro: dos rayos opuestos que giran desde el centro
    if (m.beam) {
      const o = m.beam;
      this.beamA = (this.beamA + o.speed * dt) % (Math.PI * 2);
      const ax = Math.cos(this.beamA), ay = Math.sin(this.beamA);
      // ty: tipo del haz (faro de acero que quema, aliento de dragón que ralentiza, psíquico que aturde)
      const ty = o.ty || 'acero';
      const extra = ty === 'psiquico' ? { stun: 0.4 } : ty === 'dragon' ? { slow: 1 } : { burn: 1.5 };
      for (const s of b.sides) {
        this.beamCd[s.idx] = Math.max(0, this.beamCd[s.idx] - dt);
        if (this.beamCd[s.idx] > 0 || typesOf(b.mon(s)).includes(ty)) continue;
        const dx = s.x - CX, dy = s.y - CY;
        const along = Math.abs(dx * ax + dy * ay), across = Math.abs(-dx * ay + dy * ax);
        if (along > 40 && along < o.len && across < o.width + b.rad(s)) { this.beamCd[s.idx] = 1.1; b.hazard(s, o.dmg, ty, extra); }
      }
    }
    // Géiseres: uno cerca de cada Pokémon; el chorro hace daño y lanza hacia fuera
    if (m.geyser && this.tick('geyser', dt)) {
      const o = m.geyser;
      for (const s of b.sides) {
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
        const x = S.clamp(s.x + Math.cos(a) * d, 40, S.ARENA.w - 40), y = S.clamp(s.y + Math.sin(a) * d, 40, S.ARENA.h - 40);
        this.warnAt(x, y, o.r, o.warn, 'agua', p => {
          b.ev({ k: 'geyser', x: Math.round(p.x), y: Math.round(p.y), r: p.r });
          for (const t of b.sides) {
            const dx = t.x - p.x, dy = t.y - p.y, dd = Math.hypot(dx, dy);
            if (dd >= p.r + b.rad(t)) continue;
            b.hazard(t, o.dmg, 'agua', {});
            if (t.prot < 0 && t.invuln <= 0) { const ka = dd > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2; t.kb = { vx: Math.cos(ka), vy: Math.sin(ka), speed: o.knock / 0.18, t: 0.18 }; t.wind = null; }
          }
        });
      }
    }
    // Tormenta: un rayo cerca de cada Pokémon; si cae junto al agua, electrifica a quien esté en ella
    if (m.storm && this.tick('storm', dt)) {
      const o = m.storm;
      for (const s of b.sides) {
        const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 100;
        const x = S.clamp(s.x + Math.cos(a) * d, 40, S.ARENA.w - 40), y = S.clamp(s.y + Math.sin(a) * d, 40, S.ARENA.h - 40);
        this.warnAt(x, y, o.r, o.warn, 'electrico', p => {
          for (const t of b.sides) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + b.rad(t) && !typesOf(b.mon(t)).includes('electrico')) b.hazard(t, o.dmg, 'electrico', { stun: o.stun });
          const c0 = S.cellIndex(p.x, p.y), cx = c0 % COLS, cy = Math.floor(c0 / COLS);
          let wet = false;
          for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS && b.terrain[yy * COLS + xx] === T.WATER) wet = true;
          if (!wet) return;
          b.ev({ k: 'zapwater', x: Math.round(p.x), y: Math.round(p.y) });
          for (const t of b.sides) if (b.terrain[S.cellIndex(t.x, t.y)] === T.WATER && !typesOf(b.mon(t)).includes('electrico')) b.hazard(t, o.dmg * 0.8, 'electrico', { stun: o.stun });
        });
      }
    }
    // Gravedad: aviso, y luego el pozo atrae un rato; en el centro hace daño
    if (m.gravity) {
      const o = m.gravity;
      if (this.grav) {
        if ((this.grav.t -= dt) <= 0) {
          if (this.grav.ph === 'warn') { this.grav = { ph: 'pull', t: o.dur, cd: [0, 0] }; this.pull = o.force; }
          else { this.grav = null; this.pull = 0; b.ev({ k: 'gravity', ph: 'end' }); }
        } else if (this.grav.ph === 'pull') {
          for (const s of b.sides) {
            this.grav.cd[s.idx] = Math.max(0, this.grav.cd[s.idx] - dt);
            if (this.grav.cd[s.idx] <= 0 && Math.hypot(s.x - CX, s.y - CY) < o.r + b.rad(s)) { this.grav.cd[s.idx] = 0.8; b.hazard(s, o.dmg, 'siniestro', {}); }
          }
        }
      } else if (this.tick('gravity', dt)) {
        this.grav = { ph: 'warn', t: o.warn };
        this.danger.push({ x: CX, y: CY, r: o.r * 2, t: o.warn + o.dur });
        b.ev({ k: 'gravity', ph: 'warn', d: o.warn, dur: o.dur });
      }
    }
    // Pilares: aviso donde van a subir y cambio de grupo
    if (m.pillars) {
      const o = m.pillars;
      if (this.pil) {
        if ((this.pil.t -= dt) <= 0) { this.pillarUp = this.pil.g; this.raisePillars(this.pil.g); b.ev({ k: 'pillar', ph: 'up', g: this.pil.g }); this.pil = null; }
      } else if (this.tick('pillars', dt)) {
        const g = 1 - this.pillarUp;
        this.pil = { g, t: o.warn };
        for (const p of this.pillars) if (p.g === g) { this.danger.push({ x: p.x, y: p.y, r: 34, t: o.warn }); b.ev({ k: 'warn', x: Math.round(p.x), y: Math.round(p.y), r: 30, d: o.warn, ty: 'roca' }); }
      }
    }
    // Hielo que se rompe: quedarse sobre la misma casilla helada la agrieta; al rato es agua
    if (m.crack) {
      for (const s of b.sides) {
        const i = S.cellIndex(s.x, s.y);
        if (b.terrain[i] !== T.ICE || b.mon(s).fainted) { s.crackI = -1; continue; }
        if (s.crackI !== i) { s.crackI = i; s.crackT = 0; }
        if ((s.crackT += dt) >= m.crack.hold) {
          s.crackT = 0;
          b.setCell(i, T.WATER, m.crack.ttl);
          b.ev({ k: 'crack', x: Math.round(S.cellCenter(i).x), y: Math.round(S.cellCenter(i).y) });
        }
      }
    }
    // Suelo que se agrieta: cerca de cada Pokémon, una grieta de 3 casillas se marca y es lava un rato
    if (m.fissure && this.tick('fissure', dt)) {
      const o = m.fissure;
      for (const s of b.sides) {
        if (b.mon(s).fainted) continue;
        const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 70;
        const x = S.clamp(s.x + Math.cos(a) * d, 60, S.ARENA.w - 60), y = S.clamp(s.y + Math.sin(a) * d, 60, S.ARENA.h - 60);
        const c0 = S.cellIndex(x, y), cx = c0 % COLS, cy = Math.floor(c0 / COLS), horiz = Math.random() < 0.5;
        const cells = [-1, 0, 1].map(k => horiz ? [cx + k, cy] : [cx, cy + k]).filter(([X, Y]) => X >= 1 && Y >= 1 && X < COLS - 1 && Y < ROWS - 1)
          .map(([X, Y]) => Y * COLS + X).filter(i => this.base[i] === T.NONE);
        if (!cells.length) continue;
        const c = S.cellCenter(c0);
        this.warnAt(c.x, c.y, o.r, o.warn, 'fuego', () => {
          // (solo donde el suelo sigue limpio: lo que haya pintado un ataque en el aviso se queda)
          for (const i of cells) if (b.terrain[i] === T.NONE || b.terrain[i] === T.BURNT) b.setCell(i, T.LAVA, o.ttl);
          // (y como la lava, a los de fuego no les hace nada)
          for (const t of b.sides) if (cells.includes(S.cellIndex(t.x, t.y)) && !typesOf(b.mon(t)).includes('fuego')) b.hazard(t, o.dmg, 'fuego', { burn: 2 });
        });
      }
    }
    // Arenas movedizas: frenan; quedarse casi quieto dentro hunde (daño y más lento). Ni a voladores ni a los de tierra
    if (this.sand) {
      const o = m.quicksand;
      for (const s of b.sides) {
        const mon = b.mon(s), tys = typesOf(mon);
        const grounded = s.invuln <= 0 && s.forced <= 0 && !(s.dash && s.dash.m.invuln);   // (por el aire o cambiando, no)
        const z = grounded && !mon.fainted && !tys.includes('volador') && !tys.includes('tierra') && this.sand.find(q => Math.hypot(s.x - q.x, s.y - q.y) < q.r);
        const moved = s.sandAt ? Math.hypot(s.x - s.sandAt[0], s.y - s.sandAt[1]) : 0;
        s.sandAt = [s.x, s.y];
        if (!z) { s.sinkT = 0; continue; }
        s.slow = Math.max(s.slow, 0.15);
        s.sinkT = moved < 60 * dt ? (s.sinkT || 0) + dt : Math.max(0, (s.sinkT || 0) - dt * 2);
        if (s.sinkT >= o.hold) {
          s.sinkT = 0;
          b.hazard(s, o.dmg, 'tierra', { slow: o.slow });
          b.ev({ k: 'sink', x: Math.round(s.x), y: Math.round(s.y), s: s.idx });
        }
      }
    }
    // Parachoques: quien choca sale rebotado (con un ratito entre rebote y rebote)
    if (this.bumpers) {
      const o = m.bumpers;
      for (const s of b.sides) {
        s.bumpCd = Math.max(0, (s.bumpCd || 0) - dt);
        if (s.bumpCd > 0 || b.mon(s).fainted || s.prot >= 0 || s.invuln > 0 || s.forced > 0 || s.dash) continue;
        for (const q of this.bumpers) {
          const dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy);
          if (d > q.r + b.rad(s) + 3) continue;
          const ka = d > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
          s.kb = { vx: Math.cos(ka), vy: Math.sin(ka), speed: o.knock / 0.2, t: 0.2 }; s.wind = null;
          s.bumpCd = 0.5;
          b.ev({ k: 'bump', x: Math.round(q.x), y: Math.round(q.y), s: s.idx });
          break;
        }
      }
    }
    // Manos fantasma: aviso bajo cada Pokémon; si no se aparta, lo atrapan (a los de tipo fantasma no)
    if (m.hands && this.tick('hands', dt)) {
      const o = m.hands;
      for (const s of b.sides) {
        if (b.mon(s).fainted || typesOf(b.mon(s)).includes('fantasma')) continue;
        this.warnAt(s.x, s.y, o.r, o.warn, 'fantasma', p => {
          b.ev({ k: 'grab', x: Math.round(p.x), y: Math.round(p.y) });
          for (const t of b.sides) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + b.rad(t) * 0.5 && !typesOf(b.mon(t)).includes('fantasma')) b.hazard(t, o.dmg, 'fantasma', { stun: o.stun });
        });
      }
    }
    // Vagonetas: aviso en una vía (la IA la ve como peligro) y luego cruza; a quien pilla, daño y lo arrastra
    if (m.carts && this.tick('carts', dt)) {
      const o = m.carts, rails = S.cartRails(o), y = rails[Math.floor(Math.random() * rails.length)], dir = Math.random() < 0.5 ? 1 : -1;
      const cart = { y, dir, x: dir > 0 ? -40 : S.ARENA.w + 40, warn: o.warn, hit: new Set() };
      this.carts.push(cart);
      b.ev({ k: 'rail', y: Math.round(y), d: o.warn, dir });
    }
    for (const c of this.carts) {
      if ((c.warn -= dt) > 0) continue;
      c.x += c.dir * m.carts.speed * dt;
      for (const s of b.sides) {
        if (c.hit.has(s.idx) || b.mon(s).fainted || s.invuln > 0 || s.forced > 0 || s.dash || b.state !== 'fight') continue;
        if (Math.abs(s.y - c.y) < 22 + b.rad(s) && Math.abs(s.x - c.x) < 30 + b.rad(s)) {
          c.hit.add(s.idx);
          b.hazard(s, m.carts.dmg, 'roca', { stun: 0.3 });
          const ka = Math.atan2((s.y > c.y ? 1 : -1) * 0.5, c.dir);
          if (s.prot < 0) { s.kb = { vx: Math.cos(ka), vy: Math.sin(ka), speed: m.carts.knock / 0.25, t: 0.25 }; s.wind = null; }
        }
      }
    }
    this.carts = this.carts.filter(c => c.x > -60 && c.x < S.ARENA.w + 60);
    // Esporas: nubes a la deriva; dentro, adormecen (frenan). Ni a bicho, planta ni voladores, ni por el aire
    if (m.spores) {
      this.sporeT += dt;
      this.spores = S.sporeClouds(m.spores, this.sporeT);
      for (const s of b.sides) {
        const tys = typesOf(b.mon(s));
        if (s.invuln > 0 || tys.includes('bicho') || tys.includes('planta') || tys.includes('volador')) continue;
        if (this.spores.some(c => Math.hypot(s.x - c.x, s.y - c.y) < c.r)) s.slow = Math.max(s.slow, m.spores.slow);
      }
    }
    // Flores: las rosas curan poco a poco; las moradas adormecen (ralentizan; a los de tipo planta no)
    if (this.flowers) {
      const o = m.flowers;
      for (const s of b.sides) {
        const mon = b.mon(s), k = this.flowers.get(S.cellIndex(s.x, s.y));
        if (!k || mon.fainted || b.terrain[S.cellIndex(s.x, s.y)] === T.FIRE) continue;
        if (k === 'sleep') { if (!typesOf(mon).includes('planta')) s.slow = Math.max(s.slow, o.sleep); continue; }
        if (b.sudden || mon.hp >= mon.maxHp) continue;
        s.healAcc = (s.healAcc || 0) + o.heal * mon.maxHp * dt;
        if (s.healAcc >= 3) { const n = Math.floor(s.healAcc); s.healAcc -= n; mon.hp = Math.min(mon.maxHp, mon.hp + n); b.ev({ k: 'heal', s: s.idx, n }); }
      }
    }
  }

  // ¿Hay un obstáculo sólido entre el epicentro y el Pokémon? (su centro, en la sombra de la roca)
  shielded(q, s) {
    const dx = s.x - q.x, dy = s.y - q.y, d = Math.hypot(dx, dy);
    if (d < 1) return false;
    const ux = dx / d, uy = dy / d;
    return this.b.obstacles.some(o => {
      if (o.kind === 'ghost') return false;
      const t = (o.x - q.x) * ux + (o.y - q.y) * uy;
      if (t <= 0 || t >= d) return false;
      return Math.abs(-(o.x - q.x) * uy + (o.y - q.y) * ux) < o.r + this.b.rad(s) * 0.25;
    });
  }

  // Lo que el cliente necesita cada snapshot (solo si cambia algo continuo)
  snap() {
    if (!this.active) return undefined;
    const o = {};
    if (this.wind) o.wd = [Math.round(this.wind.vx), Math.round(this.wind.vy)];
    if (this.m.beam) o.ba = +this.beamA.toFixed(3);
    if (this.pull) o.gv = this.pull;
    if (this.pads) o.hl = this.pads.map(p => (p.cd > 0 ? -1 : +p.c.toFixed(2)));
    if (this.carts.some(c => c.warn <= 0)) o.ct = this.carts.filter(c => c.warn <= 0).map(c => [Math.round(c.x), Math.round(c.y), c.dir]);
    if (this.spores) o.sp = this.spores.map(c => [Math.round(c.x), Math.round(c.y)]);
    return Object.keys(o).length ? o : undefined;
  }
}

module.exports = { Arena };
