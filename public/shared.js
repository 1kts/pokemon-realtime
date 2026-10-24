// Reglas compartidas entre servidor y cliente: medidas de la arena, rejilla de terreno,
// movimiento con colisiones y estadísticas según el nivel. Los datos están en data.js.
(function (root) {
  const Data = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.Data;

  const TICK = 30;                 // ticks de simulación por segundo
  const DT = 1 / TICK;
  const ARENA = { w: 960, h: 600 };
  const RADIUS = 22;               // radio de colisión de un Pokémon
  const CELL = 40;                 // celdas de terreno de 40x40
  const COLS = ARENA.w / CELL, ROWS = ARENA.h / CELL;
  const ROCK_R = 24;

  // Terreno: 0 nada · 1 hierba alta · 2 fuego · 3 agua · 4 vapor · 5 quemado
  const T = { NONE: 0, GRASS: 1, FIRE: 2, WATER: 3, STEAM: 4, BURNT: 5 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  const cellIndex = (x, y) => clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);
  const cellCenter = i => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });

  // Mapa de texto -> terreno inicial y rocas fijas.
  function parseMap(name) {
    const rows = Data.MAPS[name] || Data.MAPS.pradera;
    const terrain = new Array(COLS * ROWS).fill(T.NONE);
    const rocks = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const i = y * COLS + x;
      if (ch === '#') terrain[i] = T.GRASS;
      else if (ch === '~') terrain[i] = T.WATER;
      else if (ch === 'o') rocks.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2, r: ROCK_R });
    }));
    return { terrain, rocks };
  }

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
  function stepMove(p, mx, my, speed, dt, obstacles) {
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    pushOut(p, RADIUS, obstacles || []);
  }

  // Velocidad efectiva según estados. f = banderas del jugador (ver server/battle.js, flags()).
  const F = { STUN: 1, SLOW: 2, BURN: 4, POISON: 8, WET: 16, PROTECT: 32, PERFECT: 64, HIDDEN: 128,
    SWAP: 256, HASTE: 512, POWER: 1024, WIND: 2048, REC: 4096, DASH: 8192, INVULN: 16384, SEED: 32768, FAINTED: 65536 };
  function speedOf(dex, f) {
    if (f & (F.STUN | F.SWAP | F.DASH | F.FAINTED)) return 0;
    let s = Data.SPECIES[dex].spd;
    if (f & F.SLOW) s *= 0.55;
    if (f & F.HASTE) s *= 1.3;
    if (f & (F.WIND | F.REC)) s *= 0.45;
    return s;
  }

  function monStats(dex, level) {
    const sp = Data.SPECIES[dex];
    const k = Data.levelMult(level);
    return { maxHp: Math.round(sp.hp * k * 2), atk: sp.atk * k };
  }

  const api = { TICK, DT, ARENA, RADIUS, CELL, COLS, ROWS, ROCK_R, T, F, clamp, cellIndex, cellCenter,
    parseMap, pushOut, stepMove, speedOf, monStats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
