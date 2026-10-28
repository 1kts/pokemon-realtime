// Partículas de una línea en combate (premio aparte de la skin, de Lucky Spin): formas de pixel art (llamas, chispas, burbujas, hojas,
// copos, destellos, humo) que salen del Pokémon según el tipo de su línea evolutiva. Un atlas de 8
// formas en escala de grises (el shader las tiñe) y dos capas: aditiva (fuego, chispas, destellos)
// y normal (burbujas, hojas, humo). Las emite Actor.update (actors.js) si la línea las lleva puestas.
import * as THREE from 'three';

const MAX = 1500;
const CELL = 16;
// Formas de 16×16: '.' vacío, y de 1 a 4 de más oscuro a más claro (el centro de la llama, blanco)
const SHAPES = {
  flame: [
    '................', '......1.........', '......1...1.....', '.....12...1.....', '.....12..12.....', '....122..121....',
    '....1221.1221...', '...12232112221..', '...12333212321..', '..1233333223321.', '..1233443333321.', '..1234444443321.',
    '...123444443321.', '....1234444321..', '.....12333321...', '.......1111.....'],
  spark: [
    '................', '................', '................', '................', '.......3........', '......343.......',
    '.....34443......', '......343.......', '.......3........', '................', '................', '................',
    '................', '................', '................', '................'],
  twinkle: [
    '................', '.......3........', '.......3........', '.......3........', '......343.......', '......343.......',
    '.3333344433333..', '......343.......', '......343.......', '.......3........', '.......3........', '.......3........',
    '................', '................', '................', '................'],
  bubble: [
    '................', '.....22222......', '....2.....2.....', '...2..44...2....', '...2..4....2....', '...2.......2....',
    '...2.......2....', '...2.......2....', '....2.....2.....', '.....22222......', '................', '................',
    '................', '................', '................', '................'],
  leaf: [
    '................', '...........11...', '.........1221...', '........12321...', '.......12331....', '......12331.....',
    '.....12331......', '....12331.......', '...12321........', '...1221.........', '..11............', '.1..............',
    '................', '................', '................', '................'],
  flake: [
    '................', '.......3........', '.....3.3.3......', '......333.......', '...3...3...3....', '....3.343.3.....',
    '.3333344433333..', '....3.343.3.....', '...3...3...3....', '......333.......', '.....3.3.3......', '.......3........',
    '................', '................', '................', '................'],
  puff: [
    '................', '................', '.....1111.......', '...11222211.....', '..1223333221....', '..1233333321....',
    '.122333333221...', '.123333333321...', '.122333333221...', '..1233333321....', '..1122222211....', '....111111......',
    '................', '................', '................', '................'],
  pebble: [
    '................', '................', '................', '................', '.....1111.......', '....122221......',
    '...12333321.....', '...12344321.....', '...12333321.....', '....122221......', '.....1111.......'],
  feather: [
    '..........1.....', '.........121....', '........1231....', '.......12331....', '......123321....', '.....1233321....',
    '....1233321.....', '....123321......', '...123321.......', '...12321........', '..1221..........', '..11............', '.1..............'],
  heart: [
    '................', '................', '...111...111....', '..12221.12221...', '.1233321233321..', '.1234433344321..',
    '.1233444443321..', '..12334443321...', '...123343321....', '....1233321.....', '.....12321......', '......121.......', '.......1........'],
  ring: [
    '.....3333.......', '...33....33.....', '..3........3....', '..3........3....', '.3..........3...', '.3..........3...',
    '.3..........3...', '..3........3....', '..3........3....', '...33....33.....', '.....3333.......'],
  diamond: [
    '.......3........', '......343.......', '.....34443......', '....3444443.....', '...344444443....', '....3444443.....',
    '.....34443......', '......343.......', '.......3........'],
  bolt: [
    '.........44.....', '........44......', '.......44.......', '......44........', '.....4444444....', '..........44....',
    '.........44.....', '........44......', '.......44.......', '......4.........', '.....4..........', '................',
    '................', '................', '................', '................'],
};
const NAMES = Object.keys(SHAPES);
export const SHAPE = Object.fromEntries(NAMES.map((n, i) => [n, i]));

function atlas() {
  const c = document.createElement('canvas');
  c.width = CELL * NAMES.length; c.height = CELL;
  const g = c.getContext('2d');
  const LUM = { 1: 110, 2: 170, 3: 225, 4: 255 };
  NAMES.forEach((n, i) => SHAPES[n].forEach((row, y) => [...row].forEach((ch, x) => {
    if (!LUM[ch]) return;
    g.fillStyle = `rgb(${LUM[ch]},${LUM[ch]},${LUM[ch]})`;
    g.fillRect(i * CELL + x, y, 1, 1);
  })));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

const VERT = `
  attribute float size;
  attribute float alpha;
  attribute float shape;
  attribute vec3 tint;
  varying float vAlpha;
  varying float vShape;
  varying vec3 vTint;
  uniform float scale;
  void main() {
    vAlpha = alpha; vShape = shape; vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  uniform sampler2D map;
  uniform float count;
  varying float vAlpha;
  varying float vShape;
  varying vec3 vTint;
  void main() {
    vec2 uv = vec2((vShape + gl_PointCoord.x) / count, 1.0 - gl_PointCoord.y);
    vec4 s = texture2D(map, uv);
    if (s.r < 0.1) discard;
    // Lo más claro de la forma va hacia el blanco (el corazón de la llama)
    vec3 col = mix(vTint * (0.6 + 0.5 * s.r), vec3(1.0, 0.97, 0.85), smoothstep(0.97, 1.0, s.r));
    gl_FragColor = vec4(col, vAlpha);
  }`;

class Layer {
  constructor(scene, tex, additive) {
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX); this.alpha = new Float32Array(MAX); this.shape = new Float32Array(MAX);
    this.p = [];
    const g = this.geo = new THREE.BufferGeometry();
    const attr = (name, arr, n) => g.setAttribute(name, new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    attr('position', this.pos, 3); attr('tint', this.col, 3); attr('size', this.size, 1); attr('alpha', this.alpha, 1); attr('shape', this.shape, 1);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, count: { value: NAMES.length }, scale: { value: 400 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 21;
    scene.add(this.points);
  }

  update(dt, scale) {
    this.mat.uniforms.scale.value = scale;
    let n = 0;
    this.p = this.p.filter(q => (q.t += dt) < q.life);
    for (const q of this.p) {
      const k = q.t / q.life;
      q.vy -= (q.gravity || 0) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.wobble) q.x += Math.sin((q.t + q.seed) * q.wobble) * dt * 0.6;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.col[n * 3] = q.c.r; this.col[n * 3 + 1] = q.c.g; this.col[n * 3 + 2] = q.c.b;
      this.size[n] = q.size + (q.endSize - q.size) * k;
      this.alpha[n] = Math.min(1, (1 - k) * 2.2) * (q.alpha ?? 1);
      this.shape[n] = q.shape;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of Object.values(this.geo.attributes)) a.needsUpdate = true;
  }
}

// Un sistema por escena (lo comparten todos los Pokémon de la arena)
const systems = new WeakMap();
export function skinFx(scene) {
  let s = systems.get(scene);
  if (!s) {
    const tex = atlas();
    s = { add: new Layer(scene, tex, true), norm: new Layer(scene, tex, false), last: performance.now() };
    systems.set(scene, s);
  }
  return s;
}

// Cada fotograma: mueve las partículas de la escena (una vez aunque haya varios Pokémon)
export function stepFx(scene, camera, now) {
  const s = skinFx(scene);
  const dt = Math.min(0.05, (now - s.last) / 1000);
  if (dt <= 0) return;
  s.last = now;
  const scale = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 45) / 2));
  s.add.update(dt, scale);
  s.norm.update(dt, scale);
}

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const C = hex => new THREE.Color(hex);

// Qué suelta cada tipo: [capa, forma, colores, por segundo, ajustes]. h es el alto del sprite en la escena.
function recipe(type, pal) {
  const [, mid, hi, top] = pal;   // (pal[0], el más oscuro, lo usa roca)
  switch (type) {
    case 'fuego': return [
      ['norm', 'flame', [hi, hi, top, '#ff4a12'], 34, h => ({ vy: rnd(0.9, 1.5) * h, vx: rnd(-0.08, 0.08) * h, life: rnd(0.35, 0.55), size: rnd(0.13, 0.22) * h, endSize: 0.04 * h, y0: rnd(0.35, 0.85), spread: 0.28 })],
      ['add', 'spark', [hi, top], 16, h => ({ vy: rnd(1.6, 2.6) * h, vx: rnd(-0.6, 0.6) * h, life: rnd(0.5, 0.9), size: 0.14 * h, endSize: 0, y0: rnd(0.3, 0.9) })],
    ];
    case 'agua': return [
      ['norm', 'bubble', ['#ffffff', top], 22, h => ({ vy: rnd(0.6, 1.1) * h, vx: rnd(-0.1, 0.1) * h, life: rnd(0.8, 1.3), size: rnd(0.24, 0.36) * h, endSize: 0.26 * h, y0: rnd(0.1, 0.7), wobble: 6 })],
      ['add', 'twinkle', ['#ffffff', hi], 8, h => ({ life: 0.45, size: 0.26 * h, endSize: 0, y0: rnd(0.2, 1) })],
    ];
    case 'electrico': return [
      ['norm', 'bolt', [top, hi, '#ffffff'], 14, h => ({ vx: rnd(-1.2, 1.2) * h, vy: rnd(-0.3, 1.2) * h, life: rnd(0.18, 0.32), size: rnd(0.3, 0.42) * h, endSize: 0.2 * h, y0: rnd(0.2, 0.9) })],
      ['add', 'spark', [top, hi, '#ffffff'], 26, h => ({ vx: rnd(-2.2, 2.2) * h, vy: rnd(-1, 2) * h, vz: rnd(-1, 1) * h, life: rnd(0.2, 0.4), size: 0.13 * h, endSize: 0, y0: rnd(0.2, 0.9) })],
    ];
    case 'planta': case 'bicho': return [
      ['norm', 'leaf', [mid, hi, top], 12, h => ({ vy: rnd(-0.4, -0.2) * h, vx: rnd(-0.4, 0.4) * h, life: rnd(1.1, 1.6), size: rnd(0.26, 0.34) * h, endSize: 0.2 * h, y0: rnd(0.8, 1.2), wobble: 4 })],
      ['add', 'twinkle', [top, '#ffffff'], 8, h => ({ vy: 0.3 * h, life: 0.8, size: 0.16 * h, endSize: 0, y0: rnd(0.2, 1) })],
    ];
    case 'hielo': return [
      ['add', 'flake', ['#ffffff', top], 10, h => ({ vy: rnd(-0.35, -0.15) * h, vx: rnd(-0.2, 0.2) * h, life: rnd(1, 1.5), size: rnd(0.18, 0.26) * h, endSize: 0.1 * h, y0: rnd(0.8, 1.2), wobble: 3 })],
      ['add', 'twinkle', ['#ffffff'], 6, h => ({ life: 0.5, size: 0.18 * h, endSize: 0, y0: rnd(0.2, 1) })],
    ];
    case 'fantasma': case 'siniestro': case 'veneno': return [
      ['norm', 'puff', [mid, hi], 12, h => ({ vy: rnd(0.4, 0.7) * h, vx: rnd(-0.15, 0.15) * h, life: rnd(1, 1.4), size: 0.26 * h, endSize: 0.5 * h, y0: rnd(0.1, 0.6), alpha: 0.7 })],
      ['add', 'spark', [top], 6, h => ({ vy: 0.8 * h, life: 0.6, size: 0.12 * h, endSize: 0, y0: rnd(0.3, 0.9) })],
    ];
    // (de aquí abajo, las de los tipos que antes usaban las genéricas: lucha, tierra, roca, volador,
    // psíquico, dragón, acero y hada. Normal sigue con las genéricas)
    case 'lucha': return [
      ['add', 'spark', [hi, top, '#ffffff'], 22, h => { const a = rnd(0, Math.PI * 2); return { vx: Math.cos(a) * 1.8 * h, vy: Math.sin(a) * 1.8 * h, life: rnd(0.2, 0.35), size: 0.14 * h, endSize: 0, y0: rnd(0.3, 0.8) }; }],
      ['add', 'twinkle', [top, '#ffffff'], 6, h => ({ life: 0.3, size: 0.28 * h, endSize: 0, y0: rnd(0.3, 0.9) })],
    ];
    case 'tierra': return [
      ['norm', 'pebble', [mid, hi], 10, h => ({ vy: rnd(0.8, 1.2) * h, vx: rnd(-0.3, 0.3) * h, gravity: 3.5 * h, life: rnd(0.6, 0.9), size: rnd(0.16, 0.22) * h, endSize: 0.12 * h, y0: rnd(0, 0.2) })],
      ['norm', 'puff', [hi, top], 6, h => ({ vy: rnd(0.15, 0.3) * h, vx: rnd(-0.3, 0.3) * h, life: rnd(0.8, 1.1), size: 0.2 * h, endSize: 0.45 * h, y0: rnd(0, 0.15), alpha: 0.5 })],
    ];
    case 'roca': return [
      ['norm', 'pebble', [pal[0], mid, hi], 10, h => ({ vy: rnd(0.3, 0.6) * h, vx: rnd(-0.4, 0.4) * h, gravity: 2.5 * h, life: rnd(0.7, 1), size: rnd(0.22, 0.3) * h, endSize: 0.18 * h, y0: rnd(0.4, 1) })],
      ['add', 'spark', [top], 6, h => ({ vy: rnd(0.5, 1) * h, vx: rnd(-0.5, 0.5) * h, life: 0.4, size: 0.1 * h, endSize: 0, y0: rnd(0.2, 0.8) })],
    ];
    case 'volador': return [
      ['norm', 'feather', ['#ffffff', top, hi], 8, h => ({ vy: rnd(-0.35, -0.15) * h, vx: rnd(-0.4, 0.4) * h, life: rnd(1.1, 1.6), size: rnd(0.26, 0.34) * h, endSize: 0.22 * h, y0: rnd(0.8, 1.2), wobble: 3 })],
      ['add', 'twinkle', ['#ffffff'], 5, h => ({ vx: rnd(0.4, 0.8) * h, life: 0.5, size: 0.14 * h, endSize: 0, y0: rnd(0.2, 1) })],
    ];
    case 'psiquico': return [
      ['add', 'ring', [hi, top], 6, h => ({ life: rnd(0.6, 0.9), size: 0.1 * h, endSize: 0.7 * h, y0: rnd(0.4, 0.8), spread: 0.1 })],
      ['add', 'twinkle', [top, '#ffffff'], 10, h => ({ vy: rnd(0.2, 0.5) * h, life: rnd(0.5, 0.8), size: 0.18 * h, endSize: 0, y0: rnd(0.2, 1) })],
    ];
    case 'dragon': return [
      ['add', 'diamond', [hi, top], 12, h => ({ vy: rnd(0.6, 1) * h, vx: rnd(-0.4, 0.4) * h, life: rnd(0.6, 0.9), size: rnd(0.14, 0.2) * h, endSize: 0.06 * h, y0: rnd(0.2, 0.8), wobble: 6 })],
      ['norm', 'flame', [mid, hi, top], 14, h => ({ vy: rnd(0.8, 1.3) * h, vx: rnd(-0.08, 0.08) * h, life: rnd(0.35, 0.5), size: rnd(0.12, 0.2) * h, endSize: 0.04 * h, y0: rnd(0.35, 0.85), spread: 0.28 })],
    ];
    case 'acero': return [
      ['add', 'diamond', ['#ffffff', top], 6, h => ({ life: rnd(0.3, 0.5), size: rnd(0.2, 0.3) * h, endSize: 0, y0: rnd(0.2, 1) })],
      ['add', 'spark', [hi, top], 10, h => ({ vy: rnd(0.3, 0.7) * h, vx: rnd(-0.3, 0.3) * h, life: rnd(0.4, 0.7), size: 0.1 * h, endSize: 0, y0: rnd(0.2, 0.9) })],
    ];
    case 'hada': return [
      ['norm', 'heart', [hi, top], 8, h => ({ vy: rnd(0.4, 0.7) * h, vx: rnd(-0.2, 0.2) * h, life: rnd(0.8, 1.2), size: rnd(0.18, 0.26) * h, endSize: 0.12 * h, y0: rnd(0.3, 0.9), wobble: 4 })],
      ['add', 'twinkle', [top, '#ffffff'], 10, h => ({ vy: rnd(0.2, 0.4) * h, life: rnd(0.5, 0.8), size: 0.18 * h, endSize: 0, y0: rnd(0.2, 1.05) })],
    ];
    default: return [
      ['add', 'twinkle', [top, '#ffffff', hi], 12, h => ({ vy: rnd(0.2, 0.5) * h, life: rnd(0.6, 0.9), size: rnd(0.16, 0.24) * h, endSize: 0, y0: rnd(0.15, 1.05) })],
      ['add', 'spark', [hi, top], 10, h => ({ vy: rnd(0.8, 1.4) * h, vx: rnd(-0.3, 0.3) * h, life: rnd(0.5, 0.8), size: 0.12 * h, endSize: 0, y0: rnd(0.2, 0.9) })],
    ];
  }
}

// Suelta las partículas de un Pokémon durante dt segundos. pos: sus pies; w y h: ancho y alto del sprite.
// Sutiles: pequeñas, lentas y saliendo de dentro del sprite, para que se queden por encima de él
// (las recetas dan el movimiento; aquí se encoge y se acerca al cuerpo).
const SUBTLE = { size: 0.45, speed: 0.4, life: 0.8 };
export function emitFx(scene, type, pal, pos, w, h, dt, vis = 1) {
  const s = skinFx(scene);
  for (const [layer, shape, colors, rate, make] of recipe(type, pal)) {
    let n = rate * 0.7 * dt * vis;
    while (n > 0) {
      if (Math.random() < n) {
        const o = make(h);
        o.size *= SUBTLE.size; o.endSize *= SUBTLE.size; o.life *= SUBTLE.life;
        for (const k of ['vx', 'vy', 'vz']) o[k] = (o[k] || 0) * SUBTLE.speed;
        o.y0 = Math.min(0.8, Math.max(0.15, o.y0 > 1 ? 0.8 : o.y0));
        o.spread = Math.min(o.spread ?? 0.3, 0.3);
        const L = s[layer];
        if (L.p.length < MAX) L.p.push({
          x: pos.x + rnd(-1, 1) * (o.spread ?? 0.4) * w, y: pos.y + o.y0 * h, z: pos.z + rnd(-0.6, 0.6) * (o.spread ?? 0.4) * w,
          vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, gravity: o.gravity, wobble: o.wobble, seed: Math.random() * 10,
          t: 0, life: o.life, size: o.size, endSize: o.endSize, alpha: o.alpha, shape: SHAPE[shape], c: C(pick(colors)),
        });
      }
      n -= 1;
    }
  }
}

// Dibujo de la skin Elemental según el tipo de la línea (shader de skinshader.js): 0 llamas, 1 agua,
// 2 chispa, 3 naturaleza, 4 espíritu
export const ELEM_FAMILY = { fuego: 0, dragon: 0, lucha: 0, agua: 1, hielo: 1, volador: 1, electrico: 2, psiquico: 2, acero: 2, hada: 2, normal: 2,
  planta: 3, bicho: 3, veneno: 3, tierra: 3, roca: 3, fantasma: 4, siniestro: 4 };

// Paleta de 4 colores (de oscuro a claro) para recolorear el sprite: el fuego tiene la suya; el resto
// sale del color del tipo
export function elementalPalette(type, hex) {
  if (type === 'fuego') return ['#2a0802', '#b8280a', '#ff7a14', '#ffd84a'];
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  const at = (s, l) => '#' + new THREE.Color().setHSL(hsl.h, s, l).getHexString();
  return [at(Math.min(1, hsl.s * 0.9), 0.12), at(hsl.s, 0.36), at(Math.min(1, hsl.s * 1.05), 0.58), at(Math.min(1, hsl.s * 0.8), 0.82)];
}
