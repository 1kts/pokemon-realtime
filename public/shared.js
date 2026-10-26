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

  // ---------- Mapas de las rutas ----------
  // Cada ruta tiene su propio mapa, generado a partir de su id (siempre el mismo) y del tipo de
  // lugar (pradera, bosque, cueva, lago). Se genera la mitad izquierda y se refleja: los dos
  // bandos lo tienen igual. La zona donde aparece cada Pokémon queda libre.
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const MIRROR = { v: '^', '^': 'v' };
  function routeRows(id) {
    const node = Data.NODES && Data.NODES[id];
    const kind = node && node.map ? node.map : 'pradera';
    let seed = hashStr('ruta:' + id) % 2147483646 + 1;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const half = COLS / 2;
    const g = Array.from({ length: ROWS }, () => new Array(COLS).fill('.'));
    const spawn = (x, y) => Math.abs(x - 3) <= 2 && Math.abs(y - 7) <= 2;
    const free = (x, y) => x >= 0 && y >= 0 && x < half && y < ROWS && !spawn(x, y) && g[y][x] === '.';
    // Mancha irregular de un terreno: elipse con el borde ruidoso
    const blob = (ch, cx, cy, rx, ry) => {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d < 1 - (r() - 0.5) * 0.5 && free(x, y)) g[y][x] = ch;
      }
    };
    const blobs = (ch, n, rmin, rmax, xmin = 0.5, xmax = half - 0.5) => {
      for (let k = 0; k < n; k++) blob(ch, xmin + r() * (xmax - xmin), 1 + r() * (ROWS - 2), rmin + r() * (rmax - rmin), rmin + r() * (rmax - rmin) * 0.8);
    };
    // Rocas sueltas, nunca pegadas a otra (no cierran pasillos)
    const rocks = n => {
      for (let k = 0, tries = 0; k < n && tries < 80; tries++) {
        const x = 1 + Math.floor(r() * (half - 1)), y = 1 + Math.floor(r() * (ROWS - 2));
        if (!free(x, y)) continue;
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy] && g[y + dy][x + dx] === 'o') near = true;
        if (near) continue;
        g[y][x] = 'o'; k++;
      }
    };
    const n = (a, b) => a + Math.floor(r() * (b - a + 1));
    if (kind === 'bosque') { blobs('#', n(5, 7), 1.2, 2.6); rocks(n(1, 3)); }
    else if (kind === 'cueva') { rocks(n(4, 7)); blobs('~', n(1, 2), 0.9, 1.8); if (r() < 0.4) blobs('#', 1, 0.8, 1.4); }
    else if (kind === 'lago') {
      if (r() < 0.5) blob('~', half, 3 + r() * 9, 2.5 + r() * 2.5, 1.8 + r() * 1.6);      // lago en el centro
      else { blob('~', 4 + r() * 7, 0, 3 + r() * 4, 2 + r()); blob('~', 4 + r() * 7, ROWS, 3 + r() * 4, 2 + r()); }   // orillas arriba y abajo
      blobs('#', n(2, 3), 1, 1.8); rocks(n(0, 2));
    } else {
      blobs('#', n(3, 5), 1, 2.2); rocks(n(1, 2));
      if (r() < 0.4) blob('~', half, 3 + r() * 9, 1.5 + r(), 1 + r());                     // charca en el centro
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < half; x++) g[y][COLS - 1 - x] = MIRROR[g[y][x]] || g[y][x];
    return g.map(row => row.join(''));
  }
  const routeCache = new Map();
  const rowsOf = name => {
    if (name.startsWith('r:')) {
      if (!routeCache.has(name)) routeCache.set(name, routeRows(name.slice(2)));
      return routeCache.get(name);
    }
    return Data.MAPS[name] || (Data.ARENAS && Data.ARENAS[name] && Data.ARENAS[name].rows) || Data.MAPS.pradera;
  };
  const CHAR_T = { '#': T.GRASS, '~': T.WATER, 'v': T.WATER, '^': T.WATER, i: T.ICE, p: T.POISON, w: T.WEB, L: T.LAVA };
  const FLOW_DIR = { v: [0, 1], '^': [0, -1] };

  // Mapa de texto -> terreno inicial, rocas fijas y marcas de las arenas:
  // ghost (muros invisibles), pads (teletransportes por parejas), heal (baldosas de curación),
  // panels (placas eléctricas) y flow (corriente por celda).
  const parsed = new Map();
  function parseMap(name) {
    if (!parsed.has(name)) {
      const terrain = new Array(COLS * ROWS).fill(T.NONE);
      const rocks = [], ghost = [], heal = [], panels = [], pairs = {}, flow = new Map(), flowers = [];
      rowsOf(name).forEach((row, y) => [...row].forEach((ch, x) => {
        const i = y * COLS + x, cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        if (CHAR_T[ch] !== undefined) terrain[i] = CHAR_T[ch];
        if (FLOW_DIR[ch]) flow.set(i, FLOW_DIR[ch]);
        if (ch === 'o') rocks.push({ x: cx, y: cy, r: ROCK_R });
        else if (ch === 'x') ghost.push({ x: cx, y: cy, r: 20 });
        else if (ch === 'H') heal.push({ i, x: cx, y: cy });
        else if (ch === 'E') panels.push(i);
        else if (ch === 'F' || ch === 'f') flowers.push({ i, x: cx, y: cy, k: ch === 'F' ? 'heal' : 'sleep' });   // flores: curan (F) o adormecen (f)
        else if (/[ABC]/i.test(ch)) (pairs[ch.toUpperCase()] = pairs[ch.toUpperCase()] || [])[ch === ch.toUpperCase() ? 0 : 1] = { x: cx, y: cy };
      }));
      const pads = Object.values(pairs).filter(p => p[0] && p[1]);
      parsed.set(name, { terrain, rocks, ghost, heal, panels, pads, flow, flowers });
    }
    const m = parsed.get(name);
    return { ...m, terrain: m.terrain.slice(), rocks: m.rocks.map(r => ({ ...r })) };
  }
  const mechOf = name => (Data.ARENAS && Data.ARENAS[name] && Data.ARENAS[name].mech) || {};
  // Mecánicas de un combate: las de su arena más un modificador (Práctica), si lo hay
  const mechFor = (name, mod) => {
    const m = mechOf(name);
    return mod && Data.MODIFIERS[mod] ? { ...m, [mod]: Data.MODIFIERS[mod] } : m;
  };
  // Sitios fijos de las mecánicas que no van marcadas en el mapa (los mismos en servidor y cliente), en simetría
  // de espejo para que ningún lado salga ganando
  const W = ARENA.w, H = ARENA.h;
  const fogZones = o => [[W * 0.3, H * 0.28], [W * 0.7, H * 0.72], [W * 0.3, H * 0.72], [W * 0.7, H * 0.28]].slice(0, o.n || 4).map(([x, y]) => ({ x, y, r: o.r || 90 }));
  const pillarSpots = o => [[W * 0.35, H * 0.3, 0], [W * 0.65, H * 0.7, 0], [W * 0.35, H * 0.7, 1], [W * 0.65, H * 0.3, 1], [W * 0.5, H * 0.5, 0], [W * 0.5, H * 0.18, 1], [W * 0.5, H * 0.82, 1]]
    .slice(0, o.n || 7).map(([x, y, g]) => ({ x, y, g }));
  // Espejos: segmentos [x1, y1, x2, y2] que hacen rebotar los proyectiles
  const mirrorSegs = o => o.list || [[W * 0.5 - 60, H * 0.22, W * 0.5 + 60, H * 0.22], [W * 0.5 - 60, H * 0.78, W * 0.5 + 60, H * 0.78],
    [W * 0.3, H * 0.4, W * 0.3, H * 0.6], [W * 0.7, H * 0.4, W * 0.7, H * 0.6]];

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
    const mech = env.mech || (env.map ? mechOf(env.map) : {});
    if (mech.flow && cell === T.WATER) {
      const f = parseMap.flowOf(env.map).get(i);
      if (f) { vx += f[0] * mech.flow; vy += f[1] * mech.flow; }
    }
    if (env.wind) { vx += env.wind[0]; vy += env.wind[1]; }
    // Cintas transportadoras: franjas de filas [y0, y1] (casillas) que arrastran hacia dir (+1 derecha, -1 izquierda)
    if (mech.belts) for (const [y0, y1, dir] of mech.belts.rows) {
      const cy = Math.floor(p.y / CELL), cx = Math.floor(p.x / CELL);
      if (cy >= y0 && cy <= y1 && cx >= 2 && cx < COLS - 2) vx += dir * mech.belts.speed;
    }
    // Gravedad: mientras late el pozo del centro, atrae (env.pull = fuerza)
    if (env.pull) { const dx = W / 2 - p.x, dy = H / 2 - p.y, d = Math.hypot(dx, dy) || 1; vx += dx / d * env.pull; vy += dy / d * env.pull; }
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
    parseMap, rowsOf, hashStr, mechOf, mechFor, fogZones, pillarSpots, mirrorSegs, pushOut, stepMove, arenaStep, speedOf, monStats };
  if (node) module.exports = api;
  else root.Shared = api;
})(this);
