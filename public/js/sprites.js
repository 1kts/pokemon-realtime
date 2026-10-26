// Hojas de sprites de SpriteCollab: carga, elección de fotograma y retratos para la interfaz.
// Hojas en sprites/{dex}/{Anim}.png (shiny en sprites/{dex}/s/); columnas = fotogramas, filas = 8 direcciones.
const META = window.SPRITE_META;
const images = new Map();   // "dex/Anim" | "dex/s/Anim" -> HTMLImageElement

// ¿Hay versión shiny de esa animación?
export const hasShiny = (dex, anim) => !!(META[dex].sh && META[dex].sh.includes(anim));

export function sheet(dex, anim, shiny = false) {
  const s = shiny && hasShiny(dex, anim);
  const key = dex + (s ? '/s/' : '/') + anim;
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.src = `sprites/${dex}/${s ? 's/' : ''}${anim}.png`;
    images.set(key, img);
  }
  return img;
}

// Si a una especie le falta una animación se usa otra parecida (las extra de tools/import-collab.js no las
// tienen todas: posar o comer pasan a saltar, el ataque especial al normal…), y si no, Idle o Walk.
const ANIM_FALLBACK = { Pose: 'Hop', Eat: 'Hop', Twirl: 'Rotate', SpAttack: 'Attack', Swing: 'Attack', Double: 'Attack' };
export function animMeta(dex, anim) {
  const a = META[dex].a;
  for (let n = anim; n; n = ANIM_FALLBACK[n]) if (a[n]) return { name: n, m: a[n] };
  return a.Idle ? { name: 'Idle', m: a.Idle } : { name: 'Walk', m: a.Walk };
}

export const hovers = dex => !!META[dex].hv;
export const hasAnim = (dex, anim) => !!META[dex].a[anim];
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

// Precarga las hojas de una lista de { dex, shiny } (para que el combate no parpadee al empezar).
export function preload(list) {
  const anims = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint', 'SpAttack'];
  return Promise.all(list.flatMap(({ dex, shiny }) => anims.filter(a => META[dex].a[a]).map(a => {
    const img = sheet(dex, a, shiny);
    return img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; });
  })));
}

// Retrato: primer fotograma de Idle mirando abajo, escalado sin suavizar.
// opts: { shiny, silhouette (negro, para los misteriosos), className, anim (otra animación, p. ej. Sleep) }
export function portrait(dex, size = 64, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait' + (opts.className ? ' ' + opts.className : '') + (opts.shiny ? ' shiny' : '');
  const { name, m } = animMeta(dex, opts.anim || 'Idle');
  const img = sheet(dex, name, opts.shiny);
  const draw = () => {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, size, size);
    const scale = Math.floor(size / Math.max(m.w, m.h) * 1.6 * 10) / 10;
    const w = m.w * scale, h = m.h * scale;
    // Centrar sobre el ancla (los pies) un poco por debajo del centro
    g.drawImage(img, 0, 0, m.w, m.h, Math.round(size / 2 - m.ax * scale), Math.round(size * 0.78 - m.ay * scale), w, h);
    if (opts.silhouette) {
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#10141e';
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'source-over';
    }
  };
  if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
  return c;
}

// Icono de menú (los de las cajas de los juegos, PokeAPI, gen. 1-7, en public/icons): para listas.
// Los shiny y las especies sin icono usan el retrato. opts: { shiny, silhouette }
export const MENU_ICON_MAX = 809;
export function monIcon(dex, size = 40, opts = {}) {
  if (opts.shiny || dex > MENU_ICON_MAX) return portrait(dex, size, opts);
  const img = document.createElement('img');
  img.className = 'mon-icon' + (opts.silhouette ? ' silhouette' : '');
  img.src = `icons/${dex}.png`;
  img.width = size; img.height = Math.round(size * 0.75);
  img.alt = ''; img.draggable = false;
  img.onerror = () => img.replaceWith(portrait(dex, size, opts));
  return img;
}

// Sprite de entrenador (líderes, Alto Mando y Campeones; de Pokémon Showdown, en public/trainers por id)
// Colores de los dos tipos de la especie (--tc, --tc2) para teñir su tarjeta
export const typeTint = (node, dex) => {
  const [a, b] = Data.SPECIES[dex].types;
  node.style.setProperty('--tc', Data.TYPE_COLOR[a]);
  node.style.setProperty('--tc2', Data.TYPE_COLOR[b || a]);
  return node;
};
// (si faltara la imagen, una Poké Ball en su lugar)
export const trainerImg = (id, cls = '') => `<img class="trainer-img ${cls}" src="trainers/${id}.png" alt="" draggable="false" onerror="this.onerror=null;this.src='items/poke-ball.png'">`;
// El nodo del líder por su nombre (los combates solo traen el nombre)
export const leaderByName = name => Object.values(Data.NODES).find(n => n.kind !== 'route' && n.leader === name) || null;

// Cara del Pokémon con una emoción (retratos de SpriteCollab en public/portraits/emo, índice en
// window.PORTRAIT_EMO). Sin esa emoción, la cara normal; sin caras, null (el que llama usa portrait()).
const EMO = window.PORTRAIT_EMO || {};
export const hasFaces = dex => !!EMO[dex];
export const faceSrc = (dex, emo = 'Normal', shiny = false) => {
  const f = EMO[dex];
  if (!f) return null;
  const e = f.e.includes(emo) ? emo : 'Normal';
  return `portraits/emo/${dex}/${shiny && f.s && f.s.includes(e) ? 's/' : ''}${e}.png`;
};
export function face(dex, size = 40, emo = 'Normal', shiny = false) {
  const src = faceSrc(dex, emo, shiny);
  if (!src) return null;
  const img = document.createElement('img');
  img.className = 'face' + (shiny ? ' shiny' : '');
  img.src = src; img.width = img.height = size; img.alt = ''; img.draggable = false;
  img.dataset.emo = emo;
  return img;
}

// Retrato animado (para menús): devuelve el canvas; se anima mientras esté en el documento.
export function animatedPortrait(dex, size = 96, anim = 'Idle', shiny = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'portrait' + (shiny ? ' shiny' : '');
  c.dataset.anim = '1';
  const { name, m } = animMeta(dex, anim);
  const img = sheet(dex, name, shiny);
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
    if (c.fx) c.fx(g, now);   // skin Elemental (menufx.js)
  };
  requestAnimationFrame(loop);
  return c;
}
