// Reglas y datos compartidos entre servidor y cliente.
(function (root) {
  const TICK = 30;                 // ticks de simulación por segundo
  const DT = 1 / TICK;
  const ARENA = { w: 960, h: 600 };
  const RADIUS = 24;

  // Tabla de tipos: atacante -> defensor -> multiplicador
  const TYPES = {
    fuego:  { fuego: 1, agua: 0.67, planta: 1.5 },
    agua:   { fuego: 1.5, agua: 1, planta: 0.67 },
    planta: { fuego: 0.67, agua: 1.5, planta: 1 },
  };

  // Criaturas originales (no son Pokémon reales).
  const CREATURES = {
    brasilio: {
      name: 'Brasilio', type: 'fuego', hp: 100, speed: 210, color: '#ff7a3d',
      moves: [
        { name: 'Ascuas', kind: 'proj', cd: 0.45, dmg: 7, speed: 620, range: 520, radius: 7 },
        { name: 'Llamarada', kind: 'proj', cd: 4, dmg: 20, speed: 360, range: 600, radius: 18 },
        { name: 'Embestida', kind: 'dash', cd: 5, dmg: 14, dist: 260, dur: 0.22 },
        { name: 'Escudo ígneo', kind: 'shield', cd: 8, dur: 1.5 },
      ],
    },
    marejo: {
      name: 'Marejo', type: 'agua', hp: 110, speed: 195, color: '#3da5ff',
      moves: [
        { name: 'Burbuja', kind: 'proj', cd: 0.5, dmg: 6, speed: 520, range: 480, radius: 9 },
        { name: 'Hidrochorro', kind: 'proj', cd: 3.5, dmg: 16, speed: 900, range: 700, radius: 8 },
        { name: 'Maremoto', kind: 'area', cd: 6, dmg: 18, radius: 130, delay: 0.5 },
        { name: 'Manantial', kind: 'heal', cd: 10, amount: 22 },
      ],
    },
    hojarin: {
      name: 'Hojarín', type: 'planta', hp: 95, speed: 225, color: '#5cd65c',
      moves: [
        { name: 'Hoja afilada', kind: 'proj', cd: 0.6, dmg: 4, speed: 600, range: 420, radius: 6, count: 3, spread: 0.22 },
        { name: 'Latigazo', kind: 'proj', cd: 2.5, dmg: 15, speed: 800, range: 170, radius: 14 },
        { name: 'Raíces', kind: 'proj', cd: 6, dmg: 6, speed: 450, range: 560, radius: 11, slow: 2 },
        { name: 'Corteza', kind: 'shield', cd: 8, dur: 1.5 },
      ],
    },
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Movimiento determinista de un paso; lo usan el servidor y la predicción del cliente.
  function stepMove(p, mx, my, speed, dt) {
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    p.x = clamp(p.x + mx * speed * dt, RADIUS, ARENA.w - RADIUS);
    p.y = clamp(p.y + my * speed * dt, RADIUS, ARENA.h - RADIUS);
  }

  const api = { TICK, DT, ARENA, RADIUS, TYPES, CREATURES, clamp, stepMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);
