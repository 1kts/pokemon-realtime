// Hojas de sprites de SpriteCollab: carga, elección de fotograma y retratos para la interfaz.
// Hojas en sprites/{dex}/{Anim}.png; columnas = fotogramas, filas = 8 direcciones.
const META = window.SPRITE_META;
const images = new Map();   // "dex/Anim" -> HTMLImageElement

export function sheet(dex, anim) {
  const key = dex + '/' + anim;
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.src = `sprites/${dex}/${anim}.png`;
    images.set(key, img);
  }
  return img;
}

// Si a una especie le falta una animación se usa otra parecida.
export function animMeta(dex, anim) {
  const a = META[dex].a;
  return a[anim] ? { name: anim, m: a[anim] } : a.Idle ? { name: 'Idle', m: a.Idle } : { name: 'Walk', m: a.Walk };
}

export const hovers = dex => !!META[dex].hv;
export const animLength = (dex, anim) => animMeta(dex, anim).m.d.reduce((s, v) => s + v, 0) * 1000 / 60;

// Fotograma para t ms de animación (en bucle o una sola vez).
export function frameAt(m, t, once) {
  const total = m.d.reduce((s, v) => s + v, 0);
  let tt = t * 60 / 1000;
  tt = once ? Math.min(tt, total - 0.01) : tt % total;
  let f = 0;
  while (f < m.d.length - 1 && tt >= m.d[f]) tt -= m.d[f++];
  return f;
}

// Fila según el ángulo en coordenadas de juego (0 = derecha, PI/2 = abajo).
export const dirRow = a => ((2 - Math.round(a / (Math.PI / 4))) % 8 + 8) % 8;

// Precarga las hojas de una lista de especies (para que el combate no parpadee al empezar).
export function preload(dexes) {
  const anims = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'];
  return Promise.all(dexes.flatMap(d => anims.filter(a => META[d].a[a]).map(a => {
    const img = sheet(d, a);
    return img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; });
  })));
}

// Retrato: primer fotograma de Idle mirando abajo, escalado sin suavizar.
export function portrait(dex, size = 64, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait' + (opts.className ? ' ' + opts.className : '');
  const draw = () => {
    const { m } = animMeta(dex, 'Idle');
    const img = sheet(dex, 'Idle');
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, size, size);
    const scale = Math.floor(size / Math.max(m.w, m.h) * 1.6 * 10) / 10;
    const w = m.w * scale, h = m.h * scale;
    // Centrar sobre el ancla (los pies) un poco por debajo del centro
    g.drawImage(img, 0, 0, m.w, m.h, Math.round(size / 2 - m.ax * scale), Math.round(size * 0.78 - m.ay * scale), w, h);
    if (opts.silhouette) {   // silueta negra para los Pokémon misteriosos
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#10141e';
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'source-over';
    }
  };
  const img = sheet(dex, 'Idle');
  if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
  return c;
}

// Retrato animado (para menús): devuelve el canvas; se anima mientras esté en el documento.
export function animatedPortrait(dex, size = 96, anim = 'Idle') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait';
  const { name, m } = animMeta(dex, anim);
  const img = sheet(dex, name);
  const scale = Math.floor(size / Math.max(m.w, m.h) * 1.5 * 10) / 10;
  const t0 = performance.now();
  const loop = now => {
    if (!c.isConnected && now - t0 > 1000) return;
    requestAnimationFrame(loop);
    if (!img.complete || !img.naturalWidth) return;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, size, size);
    const f = frameAt(m, now - t0, false);
    g.drawImage(img, f * m.w, 0, m.w, m.h, Math.round(size / 2 - m.ax * scale), Math.round(size * 0.8 - m.ay * scale), m.w * scale, m.h * scale);
  };
  requestAnimationFrame(loop);
  return c;
}
