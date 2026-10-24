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
    this.m = S.mechOf(this.name);
    this.marks = S.parseMap(this.name);
    this.base = battle.base;   // compartido con el combate (la marea lo cambia)
    this.danger = [];          // zonas avisadas (la IA las esquiva): { x, y, r, t }
    this.pending = [];         // golpes avisados que aún no han caído
    this.wind = null;          // { vx, vy } mientras sopla
    this.dark = this.m.dark || 0;
    const m = this.m;
    this.timers = {};
    for (const k of ['rockfall', 'tide', 'shock', 'toxic', 'eruption', 'quake', 'wind']) if (m[k]) this.timers[k] = (m[k].every || 8) * 0.6;
    if (m.shock) { this.shock = { g: 0, phase: 'idle', t: 0 }; this.panelGroup = this.marks.panels.map(i => (((i % COLS) >> 1) + ((Math.floor(i / COLS)) >> 1)) % 2); }
    if (m.tide) { this.tideUp = false; this.tideCells = this.ringCells(); }
    if (m.regrow) this.regrowT = new Float32Array(COLS * ROWS);
    if (m.heal) this.pads = this.marks.heal.map(p => ({ ...p, c: 1, cd: 0 }));
    if (m.beam) { this.beamA = 0; this.beamCd = [0, 0]; }
    if (m.warp) this.warpCd = [0, 0];
    this.quakes = [];
    // Muros invisibles: obstáculos que no se dibujan (el cliente los recibe para chocar con ellos)
    for (const g of this.marks.ghost) battle.obstacles.push({ id: battle.newId(), ...g, hp: Infinity, ttl: Infinity, kind: 'ghost' });
  }

  get active() { return !!this.def; }

  // Viento que afecta a un bando (los voladores no lo notan)
  windFor(side) {
    if (!this.wind) return null;
    if (typesOf(this.b.mon(side)).includes('volador')) return null;
    return [this.wind.vx, this.wind.vy];
  }

  env(side) { return { map: this.name, terrain: this.b.terrain, wind: this.windFor(side) }; }

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
    if (!this.def) return;
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
    if (!this.def) return undefined;
    const o = {};
    if (this.wind) o.wd = [Math.round(this.wind.vx), Math.round(this.wind.vy)];
    if (this.m.beam) o.ba = +this.beamA.toFixed(3);
    if (this.pads) o.hl = this.pads.map(p => (p.cd > 0 ? -1 : +p.c.toFixed(2)));
    return Object.keys(o).length ? o : undefined;
  }
}

module.exports = { Arena };
