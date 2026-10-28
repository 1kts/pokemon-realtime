// Calidad gráfica automática, la misma para los dos renderers 3D: el del combate y los menús (main.js, que la
// baja si va a menos de 40 FPS) y el del mapa de Historia (map3d.js, que la sigue). No vuelve a subir en la sesión.
// Niveles: 0 completa; 1 resolución interna a 1×; 2 además sin resplandor (y en el mapa, sombras más sencillas);
// 3 además resolución a 0,75×.
const subs = new Set();
export const quality = { level: 0 };

// Sube el nivel (nunca lo baja) y avisa a quien lo siga
export function lowerQuality(level) {
  if (level <= quality.level) return;
  quality.level = level;
  for (const f of subs) f(level);
}
export const onQuality = f => subs.add(f);

// Resolución interna para un nivel
export const pixelRatioFor = level => level >= 3 ? 0.75 : Math.min(devicePixelRatio, level >= 1 ? 1 : 2);
