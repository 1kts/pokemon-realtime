// Partículas en GPU: dos capas (aditiva para fuego/energía/chispas, normal para humo/agua/polvo/hojas).
// Todo se actualiza en CPU sobre buffers fijos; el shader solo dibuja puntos redondos suaves.
import * as THREE from 'three';

const MAX = 5000;

const VERT = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float scale;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  varying float vAlpha;
  varying vec3 vTint;
  uniform float hard;
  uniform float rim;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float a = mix(1.0 - d * d, 1.0 - smoothstep(0.75, 1.0, d), hard);
    vec3 col = vTint;
    // Suelo claro: núcleo sólido con borde oscuro para que se vea sobre blanco
    if (rim > 0.5) { a = 1.0 - smoothstep(0.82, 1.0, d); col = mix(vTint * 0.9, vTint * 0.28, smoothstep(0.55, 0.78, d)); }
    gl_FragColor = vec4(col, a * vAlpha);
  }`;

class Layer {
  constructor(scene, additive, hard) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.p = [];   // estado de cada partícula viva
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 300 }, hard: { value: hard ? 1 : 0 }, rim: { value: 0 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
    this.additive = additive;
    scene.add(this.points);
    this.geo = g;
  }

  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push(o);
  }

  update(dt) {
    const keep = [];
    for (const p of this.p) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= p.grav * dt;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor && p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      keep.push(p);
    }
    this.p = keep;
    const n = keep.length;
    for (let i = 0; i < n; i++) {
      const p = keep[i], f = p.t / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const c = f < 0.5 || !p.c2 ? p.c1 : p.c2;
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      this.size[i] = p.size * (p.grow ? 1 + f * p.grow : 1 - f * 0.6);
      this.alpha[i] = p.alpha * (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85);
    }
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'tint', 'size', 'alpha']) this.geo.attributes[name].needsUpdate = true;
  }

  clear() { this.p = []; }
}

const colorCache = new Map(), inkCache = new Map();
function col(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}
// Suelo claro: los colores muy claros bajan a un tono medio (mismo matiz) para verse sobre blanco
function ink(hex) {
  let c = inkCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    if (l > 0.42) c.multiplyScalar(0.42 / l);
    inkCache.set(hex, c);
  }
  return c;
}

export class Particles {
  constructor(scene) {
    this.glow = new Layer(scene, true, false);
    this.solid = new Layer(scene, false, true);
    this.soft = new Layer(scene, false, false);
  }

  // Suelos claros: la capa aditiva pasa a mezcla normal y las partículas llevan borde oscuro
  setBright(on) {
    this.bright = !!on;
    for (const l of [this.glow, this.solid]) l.mat.uniforms.rim.value = on ? 1 : 0;
    this.glow.mat.blending = on ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.glow.mat.needsUpdate = true;
  }

  setScale(px) { for (const l of [this.glow, this.solid, this.soft]) l.mat.uniforms.scale.value = px; }

  // Emite n partículas en (x, y, z) del mundo 3D.
  // o: { n, colors[], layer: 'glow'|'solid'|'soft', speed, up, spread (rad, 0 = todas hacia dir), dir: [x,y,z],
  //      life, size, grav, drag, jitter, grow, floor, alpha }
  emit(x, y, z, o) {
    const layer = this[o.layer || 'glow'];
    const n = o.n ?? 1;
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      if (o.dir) {
        const s = o.spread ?? 0.4;
        vx = o.dir[0] + (Math.random() - 0.5) * s * 2;
        vy = o.dir[1] + (Math.random() - 0.5) * s * 2;
        vz = o.dir[2] + (Math.random() - 0.5) * s * 2;
        const l = Math.hypot(vx, vy, vz) || 1;
        vx /= l; vy /= l; vz /= l;
      } else {
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        vx = Math.sin(ph) * Math.cos(th); vy = Math.abs(Math.cos(ph)) * (o.up ?? 1); vz = Math.sin(ph) * Math.sin(th);
      }
      const sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.6);
      const j = o.jitter || 0;
      const colors = o.colors && o.colors.length ? o.colors : ['#ffffff'];   // tipo sin paleta: blanco
      layer.add({
        x: x + (Math.random() - 0.5) * j, y: y + (Math.random() - 0.5) * j * 0.5, z: z + (Math.random() - 0.5) * j,
        vx: vx * sp, vy: vy * sp, vz: vz * sp, t: 0, life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.4),
        size: (o.size ?? 0.3) * (0.7 + Math.random() * 0.6), grav: o.grav ?? 0, drag: o.drag ?? 0.94,
        c1: (this.bright ? ink : col)(colors[(Math.random() * colors.length) | 0]), c2: o.fade ? (this.bright ? ink : col)(o.fade) : null,
        grow: o.grow || 0, floor: !!o.floor, alpha: o.alpha ?? 1,
      });
    }
  }

  // Emisión continua a 'rate' partículas por segundo, independiente de los FPS.
  trickle(rate, dt, x, y, z, o) {
    const exact = rate * dt;
    const n = Math.floor(exact) + (Math.random() < exact % 1 ? 1 : 0);
    if (n) this.emit(x, y, z, { ...o, n });
  }

  update(dt) { this.glow.update(dt); this.solid.update(dt); this.soft.update(dt); }
  clear() { this.glow.clear(); this.solid.clear(); this.soft.clear(); }
}

// Paletas por tipo: [colores brillantes, color secundario/humo]
export const PALETTE = {
  normal: ['#ffffff', '#f0ecd8', '#d8d0b0'], fuego: ['#fff6a0', '#ffd040', '#ff8a20', '#ff4a10'],
  agua: ['#ffffff', '#bfe0ff', '#6fb0ff', '#3a7ae0'], planta: ['#e8ffb0', '#9ae05a', '#4fb83a', '#2f8a2a'],
  electrico: ['#ffffff', '#fff8a0', '#ffe040', '#ffc010'], hielo: ['#ffffff', '#e0fbff', '#a8f0ff', '#70d8ff'],
  lucha: ['#fff0d0', '#ffa060', '#e05030'], veneno: ['#f0c0ff', '#c070e0', '#9040c0', '#60208a'],
  tierra: ['#f0dca0', '#d8b060', '#a07838', '#705028'], volador: ['#ffffff', '#e0e4ff', '#b8c0ff'],
  psiquico: ['#ffe0f0', '#ff90c0', '#ff5890', '#d03070'], bicho: ['#f0ffb0', '#c8e050', '#90b020'],
  roca: ['#e8dcc0', '#b8a070', '#8a7850', '#605038'], fantasma: ['#e0d0ff', '#a080f0', '#7058c0', '#402880'],
  dragon: ['#e0d0ff', '#a070ff', '#7038f8', '#4818c0'],
  acero: ['#ffffff', '#dfe6ee', '#aab6c4', '#7a8898'],
  siniestro: ['#a898b8', '#6a5a7a', '#3e324a', '#221a2a'],
  hada: ['#fff0f8', '#ffc0e0', '#ff90c8', '#e868a8'],
};
export const SMOKE = ['#6a6a6a', '#808080', '#959595'];
export const DUST = ['#c8b088', '#a89070', '#8a7458'];
