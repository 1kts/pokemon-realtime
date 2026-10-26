// Efectos de los ataques en 3D: partículas en la GPU con wawa-vfx (MIT, public/vendor/wawa-vfx) y texturas del
// Particle Pack de Kenney (CC0, public/vfx). Cada tipo tiene un núcleo (llama, esfera de agua, roca o cristal 3D,
// remolino psíquico, bola sombra…) y una estela de partículas que lo sigue; al golpear, un estallido.
// Es la alternativa al pixel art (pixvfx.js): se elige con localStorage arena.vfx = '3d'.
import * as THREE from 'three';
import { VFXParticles, VFXEmitter, RenderMode } from 'wawa-vfx';

const loader = new THREE.TextureLoader();
const texCache = new Map();
const tex = name => {
  if (!texCache.has(name)) { const t = loader.load(`vfx/${name}.png`); t.colorSpace = THREE.SRGBColorSpace; texCache.set(name, t); }
  return texCache.get(name);
};
const now = () => performance.now() / 1000;

// Sistemas de partículas (uno por textura o forma): [nombre, textura o geometría, modo, mezcla, gravedad]
const ADD = THREE.AdditiveBlending, NORMAL = THREE.NormalBlending;
const SYSTEMS = {
  flame: ['flame_01', RenderMode.Billboard, ADD, [0, 1.5, 0]],
  smoke: ['smoke_01', RenderMode.Billboard, NORMAL, [0, 0.6, 0]],
  spark: ['spark_04', RenderMode.StretchBillboard, ADD, [0, 0, 0]],
  star: ['star_06', RenderMode.Billboard, ADD, [0, 0, 0]],
  magic: ['magic_05', RenderMode.Billboard, ADD, [0, 0.3, 0]],
  drop: ['circle_05', RenderMode.Billboard, NORMAL, [0, -6, 0]],
  dirt: ['dirt_02', RenderMode.Billboard, NORMAL, [0, -3, 0]],
  trace: ['trace_01', RenderMode.StretchBillboard, ADD, [0, 0, 0]],
  light: ['light_01', RenderMode.Billboard, ADD, [0, 0, 0]],
  rock: [() => new THREE.DodecahedronGeometry(0.5, 0), RenderMode.Mesh, NORMAL, [0, -8, 0]],
  leaf: [() => new THREE.CircleGeometry(0.5, 6).scale(1.8, 0.7, 1), RenderMode.Mesh, NORMAL, [0, -1, 0]],
  shard: [() => new THREE.OctahedronGeometry(0.5, 0).scale(0.6, 1.4, 0.6), RenderMode.Mesh, ADD, [0, -4, 0]],
};

// Cómo es cada tipo: núcleo (sprite de textura o malla 3D) y estelas [sistema, partículas/s, colores, tamaño, velocidad, vida]
const C = (a, b) => [a, b || a];
const LOOK = {
  fuego: { core: ['sprite', 'flame_03', '#ff8a2a', 1.4], trails: [['flame', 70, C('#ffcf5a', '#ff3a10'), [0.25, 0.5], [0.3, 0.8], [0.25, 0.5]], ['smoke', 12, C('#5a4a40', '#2a2420'), [0.3, 0.6], [0.2, 0.5], [0.6, 1]]] },
  agua: { core: ['mesh', 'sphere', '#4aa8ff', 0.5], trails: [['drop', 50, C('#bfe8ff', '#3a8aff'), [0.06, 0.14], [0.5, 1.5], [0.3, 0.6]]] },
  planta: { core: ['mesh', 'leaf', '#5fd04a', 0.5], trails: [['leaf', 14, C('#7ae05a', '#2f9a32'), [0.12, 0.22], [0.3, 1], [0.5, 0.9]]] },
  electrico: { core: ['sprite', 'light_01', '#fff36a', 0.9], trails: [['spark', 80, C('#ffffff', '#ffd21a'), [0.06, 0.12], [2, 4], [0.1, 0.25]]] },
  psiquico: { core: ['sprite', 'twirl_01', '#ff70c8', 1, 8], trails: [['magic', 40, C('#ffb0e0', '#b0246e'), [0.2, 0.4], [0.2, 0.6], [0.3, 0.6]]] },
  hielo: { core: ['mesh', 'shard', '#bff3ff', 0.4], trails: [['star', 30, C('#ffffff', '#62d2ea'), [0.12, 0.25], [0.2, 0.6], [0.3, 0.6]]] },
  lucha: { core: ['sprite', 'light_01', '#ff8a5a', 0.8], trails: [['spark', 40, C('#ffe2cc', '#e04a2e'), [0.06, 0.1], [1.5, 3], [0.1, 0.25]]] },
  veneno: { core: ['mesh', 'sphere', '#a043d0', 0.3], trails: [['smoke', 25, C('#c070f0', '#4a1a60'), [0.25, 0.45], [0.2, 0.5], [0.4, 0.8]], ['drop', 15, C('#d995f2'), [0.06, 0.1], [0.3, 0.8], [0.3, 0.5]]] },
  tierra: { core: ['mesh', 'rock', '#aa7c3c', 0.34], trails: [['dirt', 30, C('#c8a060', '#6e4c1e'), [0.15, 0.3], [0.3, 0.8], [0.3, 0.6]]] },
  roca: { core: ['mesh', 'rock', '#9a8466', 0.4], trails: [['dirt', 30, C('#c6b08a', '#5a4a34'), [0.15, 0.3], [0.3, 0.8], [0.3, 0.6]], ['rock', 6, C('#8e7a5a'), [0.06, 0.12], [1, 2], [0.4, 0.7]]] },
  volador: { core: ['sprite', 'twirl_02', '#e8f0ff', 0.9, 14], trails: [['trace', 40, C('#ffffff', '#93b2ff'), [0.08, 0.15], [1, 2.5], [0.15, 0.3]]] },
  bicho: { core: ['sprite', 'light_01', '#b8e83a', 0.7], trails: [['spark', 40, C('#f4ffd2', '#90b82a'), [0.05, 0.1], [1, 2], [0.15, 0.3]]] },
  fantasma: { core: ['mesh', 'sphere', '#2a1a4a', 0.34, 'twirl_01', '#9e8aea'], trails: [['smoke', 30, C('#7a5ad0', '#160e2c'), [0.3, 0.5], [0.2, 0.5], [0.4, 0.8]]] },
  dragon: { core: ['sprite', 'flame_03', '#7a5cff', 1.1], trails: [['flame', 60, C('#c0b0ff', '#3a1ea0'), [0.25, 0.45], [0.3, 0.8], [0.25, 0.45]]] },
  siniestro: { core: ['sprite', 'twirl_02', '#7c6a74', 0.9, -10], trails: [['smoke', 30, C('#463840', '#0e0a0c'), [0.3, 0.5], [0.2, 0.5], [0.4, 0.8]]] },
  acero: { core: ['mesh', 'shard', '#cad6e2', 0.4], trails: [['spark', 40, C('#ffffff', '#8c9caf'), [0.05, 0.1], [1.5, 3], [0.1, 0.2]]] },
  hada: { core: ['sprite', 'star_06', '#ff8acb', 0.9, 4], trails: [['magic', 35, C('#ffd0ee', '#ff8acb'), [0.15, 0.3], [0.2, 0.6], [0.3, 0.6]], ['star', 15, C('#ffffff'), [0.08, 0.15], [0.3, 0.8], [0.3, 0.5]]] },
  normal: { core: ['sprite', 'light_01', '#ffffff', 0.7], trails: [['star', 25, C('#ffffff', '#c4bcb0'), [0.1, 0.2], [0.2, 0.6], [0.2, 0.4]]] },
};

export class Vfx3D {
  constructor(scene) {
    this.scene = scene;
    this.systems = {};
    for (const [name, [src, mode, blending, gravity]] of Object.entries(SYSTEMS)) {
      const mesh = mode === RenderMode.Mesh;
      const ps = new VFXParticles('vfx-' + name, {
        nbParticles: 1500, renderMode: mode, intensity: blending === ADD ? 3 : 1.2, gravity, blendingMode: blending,
        fadeAlpha: [0.1, 0.8], fadeSize: [0.1, 0.9], easeFunction: 'easeOutCubic', stretchScale: 3, side: THREE.DoubleSide,
        // Las texturas de Kenney son muy suaves: más opacas para que se vean sobre cualquier suelo
        shadingHooks: { fragmentBeforeOutput: 'alpha = min(1.0, alpha * 1.9);' },
      }, undefined, mesh ? undefined : tex(src), mesh ? src() : undefined);
      const m = ps.getMesh();
      m.frustumCulled = false; m.renderOrder = 4;
      scene.add(m);
      this.systems[name] = ps;
    }
    this.emitters = new Set();
    this.lifeK = 1;   // (las pruebas lo suben: con pocos fotogramas las partículas morirían antes de verse)
  }

  // Estela que sigue a algo: devuelve { at(pos), stop() }
  trail(kind, rate, colors, size, speed, life) {
    const e = new VFXEmitter('vfx-' + kind, {
      loop: true, duration: 1, nbParticles: rate, spawnMode: 'time', particlesLifetime: life.map(x => x * this.lifeK), size, speed,
      startPositionMin: [-0.06, -0.06, -0.06], startPositionMax: [0.06, 0.06, 0.06],
      directionMin: [-1, -0.3, -1], directionMax: [1, 1, 1],
      startRotationMin: [0, 0, 0], startRotationMax: [Math.PI * 2, Math.PI * 2, Math.PI * 2], rotationSpeedMin: [-4, -4, -4], rotationSpeedMax: [4, 4, 4],
      colorStart: [colors[0]], colorEnd: [colors[1]],
    });
    this.scene.add(e);
    this.emitters.add(e);
    return { at: p => e.position.copy(p), stop: () => { e.stopEmitting(); setTimeout(() => { this.scene.remove(e); this.emitters.delete(e); }, 50); } };
  }

  // Estallido una vez (al golpear)
  burst(kind, pos, n, colors, size, speed, life) {
    const e = new VFXEmitter('vfx-' + kind, {
      loop: false, duration: 0.1, nbParticles: n, spawnMode: 'burst', particlesLifetime: life.map(x => x * this.lifeK), size, speed,
      directionMin: [-1, -0.2, -1], directionMax: [1, 1, 1], startRotationMin: [0, 0, 0], startRotationMax: [6, 6, 6],
      rotationSpeedMin: [-6, -6, -6], rotationSpeedMax: [6, 6, 6], colorStart: [colors[0]], colorEnd: [colors[1]],
    });
    this.scene.add(e);
    e.currentTime = now();   // (sin update: en ráfaga soltaría todo antes de colocarlo)
    e.emitAtPos(pos, true);
    setTimeout(() => this.scene.remove(e), 100);
  }

  // (con el tiempo real: el dt del bucle viene limitado y, con pocos fotogramas, las estelas casi no salían)
  update() {
    const t = now(), dt = Math.min(0.25, t - (this.lastT || t));
    this.lastT = t;
    for (const e of this.emitters) e.update(t, dt);
    for (const ps of Object.values(this.systems)) ps.update(t);
  }

  // Proyectil de un tipo: { obj, h, update(pr, pos, dt), dispose() } (como los de effects.js)
  projectile(ty, r) {
    const look = LOOK[ty] || LOOK.normal, [kind, what, color, size, spin, extraTex, extraColor] = look.core;
    const g = new THREE.Group();
    const s = Math.max(0.8, r * 4) * size * 1.7;   // (las texturas tienen mucho margen transparente)
    let core, spinner = null;
    if (kind === 'sprite') {
      // Núcleo con cuerpo: la forma, sólida y del color del tipo (tapa el suelo), y encima el brillo sumando luz
      core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(what), color, blending: NORMAL, transparent: true, depthWrite: false, toneMapped: false }));
      core.scale.setScalar(s * 0.85);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(what), color: '#ffffff', blending: this.bright ? NORMAL : ADD, transparent: true, depthWrite: false, toneMapped: false, opacity: this.bright ? 0.5 : 0.9 }));
      glow.scale.setScalar(s * 0.6);
      // (la textura es suave: dos capas del núcleo para que sea casi opaco)
      const core2 = new THREE.Sprite(core.material);
      core2.scale.setScalar(s * 0.7); core2.renderOrder = 5;
      g.add(core2, glow);
      glow.renderOrder = 6;
      spinner = [core.material, glow.material];
    } else {
      const geo = what === 'sphere' ? new THREE.SphereGeometry(0.5, 20, 14) : SYSTEMS[what][0]();
      core = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: what === 'sphere' ? 0.15 : 0.7, metalness: what === 'shard' ? 0.4 : 0.05,
        emissive: color, emissiveIntensity: what === 'rock' ? 0 : 0.35, flatShading: what !== 'sphere', transparent: what === 'shard', opacity: 0.9 }));
      core.scale.setScalar(s * 0.9);
      core.castShadow = true;
    }
    core.renderOrder = 5;
    g.add(core);
    // Halo suave de su color detrás (sobre suelo claro, sin sumar luz: no se vería), y a veces un remolino encima
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('light_01'), color: extraColor || color, blending: this.bright ? NORMAL : ADD, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false }));
    halo.scale.setScalar(s * 1.5); halo.renderOrder = 4;
    g.add(halo);
    // Sombra en el suelo, para ubicar el ataque de un vistazo
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(s * 0.35, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.5;
    g.add(shadow);
    let twirl = null;
    if (extraTex) { twirl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(extraTex), color: extraColor, blending: ADD, transparent: true, depthWrite: false, toneMapped: false })); twirl.scale.setScalar(s * 1.4); g.add(twirl); }
    const trails = look.trails.map(([k, rate, colors, sz, sp, life]) => this.trail(k, rate, colors, sz.map(x => x * 2), sp, life));
    return {
      obj: g, h: 0.55,
      update: (pr, pos, dt) => {
        for (const tr of trails) tr.at(pos);
        if (spin && spinner) for (const mt of spinner) mt.rotation += dt * spin;
        if (twirl) twirl.material.rotation -= dt * 6;
        if (kind === 'mesh') { core.rotation.x += dt * 6; core.rotation.y += dt * 4; }
        halo.material.opacity = 0.45 + Math.sin(performance.now() / 60) * 0.12;
      },
      dispose: () => { for (const tr of trails) tr.stop(); core.material.dispose(); halo.material.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); if (spinner) spinner.forEach(mt => mt.dispose()); if (twirl) twirl.material.dispose(); },
    };
  }

  // Al golpear: estallido de la estela principal de su tipo y destello
  impact(ty, pos, big) {
    const look = LOOK[ty] || LOOK.normal, [k, , colors, sz, sp, life] = look.trails[0];
    this.burst(k, pos, big ? 40 : 20, colors, [sz[0] * 1.3, sz[1] * 1.6], [sp[0] * 3 + 1, sp[1] * 3 + 2], life);
    this.burst('light', pos, 1, [look.core[2], look.core[2]], [big ? 1.6 : 1.1, big ? 1.8 : 1.3], [0, 0], [0.15, 0.2]);
  }
}

// Estilo elegido (arena.vfx = '3d' o 'pixel'); sin elegir, pixel, salvo en localhost (para probar el 3D en local; los
// tests usan 127.0.0.1 y siguen en pixel)
export const vfxStyle = () => {
  let v = null;
  try { v = localStorage.getItem('arena.vfx'); } catch {}
  if (v === '3d' || v === 'pixel') return v;
  // 3D para todos; en las pruebas (127.0.0.1) el pixel, que es lo que comprueban sus tests
  return location.hostname === '127.0.0.1' ? 'pixel' : '3d';
};
