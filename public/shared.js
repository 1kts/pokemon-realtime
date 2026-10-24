// Reglas compartidas entre servidor y cliente: medidas de la arena, rejilla de terreno,
// movimiento con colisiones y estadísticas según el nivel. Los datos están en data.js.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const Data = node ? require('./data.js') : root.Data;
  const HITBOX = node ? require('./hitbox.js') : root.HITBOX;

  const TICK = 30;                 // ticks de simulación por segundo
  const DT = 1 / TICK;
  const ARENA = { w: 960, h: 600 };
  const RADIUS = 22;               // radio de colisión por defecto (cada especie tiene el suyo)
  const CELL = 40;                 // celdas de terreno de 40x40
  const COLS = ARENA.w / CELL, ROWS = ARENA.h / CELL;
  const ROCK_R = 24;

  // Terreno: 0 nada · 1 hierba alta · 2 fuego · 3 agua · 4 vapor · 5 quemado
  // De las arenas: 6 hielo · 7 veneno · 8 telaraña · 9 lava
  const T = { NONE: 0, GRASS: 1, FIRE: 2, WATER: 3, STEAM: 4, BURNT: 5, ICE: 6, POISON: 7, WEB: 8, LAVA: 9 };
  // Tipos de terreno que forman parte del mapa y vuelven cuando se les pasa el efecto de un ataque
  const PERMANENT = new Set([T.WATER, T.ICE, T.POISON, T.WEB, T.LAVA]);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  const cellIndex = (x, y) => clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);
  const cellCenter = i => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });

  // Radio de colisión de una especie (según el tamaño de su sprite; ver tools/import-sprites.js)
  const hitboxOf = dex => (HITBOX && HITBOX[dex]) || RADIUS;

  const rowsOf = name => Data.MAPS[name] || (Data.ARENAS && Data.ARENAS[name] && Data.ARENAS[name].rows) || Data.MAPS.pradera;
  const CHAR_T = { '#': T.GRASS, '~': T.WATER, 'v': T.WATER, '^': T.WATER, i: T.ICE, p: T.POISON, w: T.WEB, L: T.LAVA };
  const FLOW_DIR = { v: [0, 1], '^': [0, -1] };

  // Mapa de texto -> terreno inicial, rocas fijas y marcas de las arenas:
  // ghost (muros invisibles), pads (teletransportes por parejas), heal (baldosas de curación),
  // panels (placas eléctricas) y flow (corriente por celda).
  const parsed = new Map();
  function parseMap(name) {
    if (!parsed.has(name)) {
      const terrain = new Array(COLS * ROWS).fill(T.NONE);
      const rocks = [], ghost = [], heal = [], panels = [], pairs = {}, flow = new Map();
      rowsOf(name).forEach((row, y) => [...row].forEach((ch, x) => {
        const i = y * COLS + x, cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        if (CHAR_T[ch] !== undefined) terrain[i] = CHAR_T[ch];
        if (FLOW_DIR[ch]) flow.set(i, FLOW_DIR[ch]);
        if (ch === 'o') rocks.push({ x: cx, y: cy, r: ROCK_R });
        else if (ch === 'x') ghost.push({ x: cx, y: cy, r: 20 });
        else if (ch === 'H') heal.push({ i, x: cx, y: cy });
        else if (ch === 'E') panels.push(i);
        else if (/[ABC]/i.test(ch)) (pairs[ch.toUpperCase()] = pairs[ch.toUpperCase()] || [])[ch === ch.toUpperCase() ? 0 : 1] = { x: cx, y: cy };
      }));
      const pads = Object.values(pairs).filter(p => p[0] && p[1]);
      parsed.set(name, { terrain, rocks, ghost, heal, panels, pads, flow });
    }
    const m = parsed.get(name);
    return { ...m, terrain: m.terrain.slice(), rocks: m.rocks.map(r => ({ ...r })) };
  }
  const mechOf = name => (Data.ARENAS && Data.ARENAS[name] && Data.ARENAS[name].mech) || {};

  // Empuja un círculo fuera de los obstáculos (también circulares).
  function pushOut(p, r, obstacles) {
    for (const o of obstacles) {
      const dx = p.x - o.x, dy = p.y - o.y;
      const d = Math.hypot(dx, dy), min = r + o.r;
      if (d < min) {
        if (d < 0.001) { p.x += min; continue; }
        p.x = o.x + dx / d * min;
        p.y = o.y + dy / d * min;
      }
    }
    p.x = clamp(p.x, r, ARENA.w - r);
    p.y = clamp(p.y, r, ARENA.h - r);
  }

  // Movimiento determinista de un paso; lo usan el servidor y la predicción del cliente.
  function stepMove(p, mx, my, speed, dt, obstacles, r = RADIUS) {
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    pushOut(p, r, obstacles || []);
  }

  // Movimiento en una arena: como stepMove, más la corriente del agua, el viento y la inercia
  // sobre hielo. p guarda vx, vy (velocidad actual, la usa el hielo). env = { map, terrain,
  // wind: [vx, vy] | null }. Lo usan el servidor y la predicción del cliente.
  function arenaStep(p, mx, my, speed, dt, obstacles, r = RADIUS, env = {}) {
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    let vx = mx * speed, vy = my * speed;
    const i = cellIndex(p.x, p.y);
    const cell = env.terrain ? env.terrain[i] : T.NONE;
    if (cell === T.ICE) {   // sobre hielo la velocidad cambia despacio: se resbala
      const k = Math.min(1, dt * 2.2);
      p.vx = (p.vx || 0) + (vx - (p.vx || 0)) * k;
      p.vy = (p.vy || 0) + (vy - (p.vy || 0)) * k;
      vx = p.vx; vy = p.vy;
    } else { p.vx = vx; p.vy = vy; }
    const mech = env.map ? mechOf(env.map) : {};
    if (mech.flow && cell === T.WATER) {
      const f = parseMap.flowOf(env.map).get(i);
      if (f) { vx += f[0] * mech.flow; vy += f[1] * mech.flow; }
    }
    if (env.wind) { vx += env.wind[0]; vy += env.wind[1]; }
    p.x += vx * dt;
    p.y += vy * dt;
    pushOut(p, r, obstacles || []);
  }

  // Velocidad efectiva según estados. f = banderas del jugador (ver server/battle.js, flags()).
  // mult = bonificación propia del Pokémon (vitaminas).
  const F = { STUN: 1, SLOW: 2, BURN: 4, POISON: 8, WET: 16, PROTECT: 32, PERFECT: 64, HIDDEN: 128,
    SWAP: 256, HASTE: 512, POWER: 1024, WIND: 2048, REC: 4096, DASH: 8192, INVULN: 16384, SEED: 32768, FAINTED: 65536 };
  function speedOf(dex, f, mult = 1) {
    if (f & (F.STUN | F.SWAP | F.DASH | F.FAINTED)) return 0;
    let s = Data.SPECIES[dex].spd * mult;
    if (f & F.SLOW) s *= 0.55;
    if (f & F.HASTE) s *= 1.3;
    if (f & (F.WIND | F.REC)) s *= 0.45;
    return s;
  }

  // Estadísticas de un Pokémon a un nivel con sus EV, IV y naturaleza: { maxHp, atk, def, spdMult }
  // m = { ev, iv, nat } (todo opcional)
  function monStats(dex, level, m = {}) {
    const sp = Data.SPECIES[dex];
    const k = Data.levelMult(level);
    const nat = Data.natureMult(dex, m.nat);
    const b = s => (1 + 0.25 * ((m.ev && m.ev[s]) || 0) / Data.EV_MAX) * (1 + 0.1 * ((m.iv && m.iv[s]) || 0) / Data.IV_MAX) * nat[s];
    return {
      maxHp: Math.round(sp.hp * k * 2 * b('hp')),
      atk: +(sp.atk * k * b('atk')).toFixed(3),
      def: +((sp.def || 1) * b('def')).toFixed(3),
      spdMult: +b('spe').toFixed(3),
    };
  }

  parseMap.flowOf = name => { parseMap(name); return parsed.get(name).flow; };
  const api = { TICK, DT, ARENA, RADIUS, CELL, COLS, ROWS, ROCK_R, T, F, PERMANENT, clamp, cellIndex, cellCenter, hitboxOf,
    parseMap, mechOf, pushOut, stepMove, arenaStep, speedOf, monStats };
  if (node) module.exports = api;
  else root.Shared = api;
})(this);
