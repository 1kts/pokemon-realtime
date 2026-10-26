// Decorado de las arenas, fuera del campo: cada tema con su entorno (pradera con valla y arboleda, bosque cerrado,
// cueva con paredes de roca, playa del lago, piscina con su andén, central eléctrica, jardín con seto, dojo, salón de
// columnas, coladas de basalto, ruinas, cañón, plataforma en el cielo, estadio, cementerio, santuario, acantilado,
// puerto y nieve). Va donde mira la cámara: una franja de unas pocas casillas alrededor de los muros (más allá no
// se ve). Todo mate y de colores apagados, para que los sprites y los ataques (aditivos y saturados) destaquen.
// Piezas: modelos de Kenney (Nature Kit y Graveyard Kit, CC0, public/models/kenney/{nature,graveyard}), recoloreados
// por tema y pintados con una InstancedMesh por material, y piezas hechas a mano que se funden en unas pocas mallas
// (el color va en los vértices). Lo único que se mueve, despacio: hojas, hierba y banderas con el viento (en el
// shader), las nubes, las cascadas, la niebla del cementerio y el agua lejana.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const { COLS, ROWS } = Shared;
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

// Reloj del viento (lo avanza World.update)
export const WIND = { value: 0 };

// ---------- Modelos de Kenney ----------
const NATURE = ['tree_default', 'tree_oak', 'tree_fat', 'tree_simple', 'tree_cone', 'tree_pineDefaultA', 'tree_pineRoundC', 'tree_pineTallA',
  'tree_palmTall', 'plant_bush', 'plant_bushLarge', 'plant_flatTall', 'grass', 'grass_large', 'flower_purpleA', 'flower_yellowA', 'flower_redA',
  'mushroom_tanGroup', 'log', 'log_large', 'stump_round', 'stump_old', 'cactus_tall', 'cactus_short', 'lily_large', 'lily_small', 'canoe',
  'statue_column', 'statue_columnDamaged', 'cliff_block_stone', 'cliff_large_stone', 'crops_bambooStageB', 'stone_smallA', 'stone_smallB',
  'stone_smallFlatA', 'stone_largeA', 'stone_largeB', 'stone_largeD', 'stone_tallA', 'stone_tallB', 'fence_simple', 'fence_planks'];
const GRAVEYARD = ['gravestone-round', 'gravestone-cross', 'gravestone-bevel', 'gravestone-broken', 'iron-fence', 'crypt', 'stone-wall'];
// Papel de cada material del kit (por su nombre): con él se recolorea según el tema
const roleOf = n => /^leafs/.test(n) ? 'leaf' : /^grass/.test(n) ? 'grass' : /^woodInner/.test(n) ? 'inner' : /^wood/.test(n) ? 'wood'
  : /^color/.test(n) ? 'accent' : /^stoneDark/.test(n) ? 'dark' : 'stone';
const ROLE = { leaf: '#4f7a3e', grass: '#5a7f42', wood: '#6a4a32', inner: '#b49572', accent: '#b9a07a', dark: '#6f6a64', stone: '#8a8580' };

let models = null, loading = null;
// Carga los modelos una vez: por cada uno, sus partes (geometría con la base en y = 0 y centrada) y su tamaño
export function preloadScenery() {
  if (models) return Promise.resolve(models);
  if (loading) return loading;
  const loader = new GLTFLoader();
  const list = [...NATURE.map(n => [n, 'nature/' + n]), ...GRAVEYARD.map(n => [n, 'graveyard/' + n])];
  loading = Promise.all(list.map(([n, path]) => loader.loadAsync('/models/kenney/' + path + '.glb').then(g => {
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3());
    const parts = [];
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = new THREE.BufferGeometry();
      const src = o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-c.x, -box.min.y, -c.z);
      for (const a of ['position', 'normal']) geo.setAttribute(a, src.attributes[a]);
      geo.setIndex(src.index);
      // los del Graveyard Kit son de un solo material (con textura): se pintan de un color liso, como el resto
      parts.push({ geo, role: GRAVEYARD.includes(n) ? 'stone' : roleOf(o.material.name || '') });
    });
    return [n, { parts, size: box.getSize(new THREE.Vector3()) }];
  }))).then(l => (models = Object.fromEntries(l))).catch(e => { console.warn('Modelos del decorado', e); loading = null; return null; });
  return loading;
}

// Viento en el shader: las hojas y la hierba se mecen según su altura y su sitio; las banderas, según lo lejos
// que estén de su mástil (uv). Muy lento: es fondo.
function windify(m, mode) {
  m.onBeforeCompile = s => {
    s.uniforms.uWind = WIND;
    s.vertexShader = 'uniform float uWind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wp = instanceMatrix[3].xz;
      #else
        vec2 wp = position.xz;
      #endif
      float ph = wp.x * 0.37 + wp.y * 0.23;
      ${mode === 'flag' ? `float wk = (1.0 - uv.y) * 0.12; transformed.z += sin(uWind * 1.1 + ph + uv.y * 2.0) * wk; transformed.x += sin(uWind * 0.7 + ph) * wk * 0.4;`
        : `float wk = clamp(position.y, 0.0, 2.0) * ${mode === 'grass' ? '0.09' : '0.03'};
      transformed.x += sin(uWind * 0.9 + ph) * wk; transformed.z += sin(uWind * 0.63 + ph * 1.3 + 1.7) * wk * 0.7;`}`);
  };
  m.customProgramCacheKey = () => 'viento-' + mode;
  return m;
}

// Solo la vegetación se mece (la «hierba» de lo alto de un bloque de roca, no)
const SWAY = new Set(['tree_default', 'tree_oak', 'tree_fat', 'tree_simple', 'tree_cone', 'tree_pineDefaultA', 'tree_pineRoundC', 'tree_pineTallA', 'tree_palmTall',
  'plant_bush', 'plant_bushLarge', 'plant_flatTall', 'grass', 'grass_large', 'flower_purpleA', 'flower_yellowA', 'flower_redA', 'crops_bambooStageB']);
const roleMats = new Map();
const roleMat = (role, sway) => {
  const key = role + sway;
  if (!roleMats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: role === 'stone' || role === 'dark' ? 0.95 : 0.9, flatShading: true });
    roleMats.set(key, sway && role === 'leaf' ? windify(m, 'tree') : sway && role === 'grass' ? windify(m, 'grass') : m);
  }
  return roleMats.get(key);
};
const FLAT = new Set(['grass', 'grass_large', 'flower_purpleA', 'flower_yellowA', 'flower_redA', 'plant_flatTall', 'lily_large', 'lily_small', 'stone_smallA', 'stone_smallB', 'stone_smallFlatA', 'mushroom_tanGroup']);

// Junta las piezas de Kenney de un decorado y al final las pinta instanciadas
class Placer {
  constructor(r) { this.r = r; this.items = new Map(); }
  // h: altura que tendrá (si no, escala s); w y d: ancho y fondo exactos (vallas, bloques); c: colores por papel
  put(name, x, y, z, { ry = 0, h = null, s = 1, w = null, d = null, c = {} } = {}) {
    if (!models) return;
    const m = models[name];
    const k = h ? h / m.size.y : s, j = 0.92 + this.r() * 0.16;
    const sx = w ? w / m.size.x / k : 1, sz = d ? d / m.size.z / k : (w ? 1 / k : 1);
    const colors = {};
    for (const role of Object.keys(ROLE)) colors[role] = new THREE.Color(c[role] || (role === 'dark' && c.stone ? shade(c.stone, 0.75) : ROLE[role])).multiplyScalar(j);
    const mat4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(k * sx, k, k * sz));
    if (!this.items.has(name)) this.items.set(name, []);
    this.items.get(name).push({ mat4, colors });
  }
  flush(group) {
    for (const [name, list] of this.items) for (const part of models[name].parts) {
      const im = new THREE.InstancedMesh(part.geo, roleMat(part.role, SWAY.has(name)), list.length);
      list.forEach((it, i) => { im.setMatrixAt(i, it.mat4); im.setColorAt(i, it.colors[part.role]); });
      im.castShadow = !FLAT.has(name); im.receiveShadow = true;
      im.userData.shared = true;   // la geometría es del modelo: no se libera al cambiar de arena
      im.computeBoundingSphere();
      group.add(im);
    }
  }
}

// ---------- Piezas hechas a mano: se funden en pocas mallas ----------
const matCache = new Map();
export const mat = (color, o = {}) => {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    const { wind, ...rest } = o;
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...rest });
    if (wind) m.userData.wind = wind;
    matCache.set(key, m);
  }
  return matCache.get(key);
};
// Luz apagada (farolillos, velas): se ve encendida pero no pasa del umbral del bloom, para no parecer un ataque
export const dimLamp = (color, k = 0.45) => mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.9 });

const mergedMats = new Map();
// Junta todas las mallas quietas del grupo en una por tipo de material, con el color de cada pieza en los vértices
function mergeStatic(src, dst, r) {
  const buckets = new Map();
  src.updateMatrixWorld(true);
  src.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material, bake = m.isMeshStandardMaterial && !m.map && !m.transparent && m.emissive.getHex() === 0;
    const key = (bake ? ['b', m.roughness, m.metalness, m.flatShading, m.side, m.userData.wind || ''].join(':') : m.uuid) + ':' + o.castShadow;
    if (!buckets.has(key)) buckets.set(key, { m, bake, cast: o.castShadow, geos: [] });
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    o.geometry.dispose();
    if (bake) {
      const c = m.color.clone().multiplyScalar(0.92 + r() * 0.16), n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(a, i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    buckets.get(key).geos.push(g);
  });
  for (const [key, b] of buckets) {
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ...(b.bake ? [['color', 3]] : [])]) {
      let n = 0;
      for (const g of b.geos) n += g.attributes[name] ? g.attributes[name].count : g.attributes.position.count;
      const arr = new Float32Array(n * size);
      let off = 0;
      for (const g of b.geos) { const at = g.attributes[name]; if (at) arr.set(at.array, off); off += (at ? at.count : g.attributes.position.count) * size; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    let material = b.m;
    if (b.bake) {
      const mk = key.slice(0, key.lastIndexOf(':'));
      if (!mergedMats.has(mk)) {
        const nm = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: b.m.roughness, metalness: b.m.metalness, flatShading: b.m.flatShading, side: b.m.side });
        mergedMats.set(mk, b.m.userData.wind ? windify(nm, b.m.userData.wind) : nm);
      }
      material = mergedMats.get(mk);
    }
    const mesh = new THREE.Mesh(out, material);
    mesh.castShadow = b.cast; mesh.receiveShadow = true;
    dst.add(mesh);
  }
}

// ---------- Texturas pequeñas ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let mistTex = null;
const mist = () => mistTex || (mistTex = canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
}));

// ---------- El decorado de un tema ----------
// Devuelve las funciones que lo animan (World.update las llama con dt)
export function buildScenery(group, name, th, { seed, flowTex, world }) {
  const r = rng(seed), P = new Placer(rng(seed + 7)), H = new THREE.Group(), anim = [];
  const pick = a => a[(r() * a.length) | 0], rand = (a, b) => a + r() * (b - a);
  const M = (geo, c, o = {}, cast = true) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c, o) : c); m.castShadow = cast; m.receiveShadow = true; return m; };
  const box = (w, h, d, c, o, cast) => M(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), c, o, cast);
  const cyl = (rt, rb, h, c, o, seg = 8, cast) => M(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), c, o, cast);
  const cone = (rad, h, c, o, seg = 6) => M(new THREE.ConeGeometry(rad, h, seg).translate(0, h / 2, 0), c, o);
  const blob = (rad, c, o = {}, cast = true) => M(new THREE.IcosahedronGeometry(rad, 0), c, { flatShading: true, roughness: 0.95, ...o }, cast);
  // pone una pieza hecha a mano en (x, y, z) girada ry
  const put = (o, x, z, ry = 0, y = 0) => { o.position.set(x, y + o.position.y, z); o.rotation.y += ry; H.add(o); return o; };
  const grp = (...k) => { const g = new THREE.Group(); k.forEach(x => g.add(x)); return g; };

  // Distancia de un punto al campo (0 en el borde) y n sitios al azar en la franja [d0, d1] alrededor. Con tall, nada
  // alto pegado al muro de abajo (taparía el campo a la cámara). La cámara solo ve una o dos casillas alrededor
  // (más a los lados en pantallas anchas): lo que cuenta va cerca de los muros.
  const edge = (x, z) => Math.max(-x, x - COLS, -z, z - ROWS);
  const band = (n, d0, d1, tall = true) => {
    const out = []; let t = 0;
    while (out.length < n && t++ < n * 20) {
      const x = -d1 + r() * (COLS + 2 * d1), z = -d1 + r() * (ROWS + 2 * d1), e = edge(x, z);
      if (e < d0 || e > d1) continue;
      if (tall && z > ROWS && e < 1.7) continue;
      out.push([x, z]);
    }
    return out;
  };
  // Recorre el contorno a distancia d cada step: f(x, z, ry, lado), con ry girado a lo largo del lado
  const around = (d, step, f, sides = 'nwes') => {
    if (sides.includes('n')) for (let x = -d + step / 2; x < COLS + d; x += step) f(x, -d, 0, 'n');
    if (sides.includes('s')) for (let x = -d + step / 2; x < COLS + d; x += step) f(x, ROWS + d, 0, 's');
    if (sides.includes('w')) for (let z = -d + step / 2; z < ROWS + d; z += step) f(-d, z, Math.PI / 2, 'w');
    if (sides.includes('e')) for (let z = -d + step / 2; z < ROWS + d; z += step) f(COLS + d, z, Math.PI / 2, 'e');
  };
  // Franjas planas alrededor del campo (andén, playa, tarima…): cuatro losas de [d0, d1]
  const apron = (d0, d1, c, y = 0.03, o = {}) => {
    const w = d1 - d0, W = COLS + 2 * d1;
    put(box(W, y, w, c, o, false), COLS / 2, -d0 - w / 2); put(box(W, y, w, c, o, false), COLS / 2, ROWS + d0 + w / 2);
    put(box(w, y, ROWS + 2 * d0, c, o, false), -d0 - w / 2, ROWS / 2); put(box(w, y, ROWS + 2 * d0, c, o, false), COLS + d0 + w / 2, ROWS / 2);
  };

  // ----- piezas comunes -----
  const LEAF = th.leaves ? th.leaves.map(c => shade(c, 0.85)) : ['#4f7a3e', '#5a8043', '#46703a', '#638447'];
  const trees = (n, d0, d1, o = {}) => {
    for (const [x, z] of band(n, d0, d1)) {
      const k = r(), leaf = pick(o.leaves || LEAF);
      if (o.pines && k < o.pines) P.put(pick(['tree_pineTallA', 'tree_pineDefaultA', 'tree_pineRoundC']), x, 0, z, { ry: r() * 6, h: rand(2.2, 3.8) * (o.scale || 1), c: { leaf: o.pineLeaf || shade(leaf, 0.8), wood: o.wood } });
      else P.put(pick(o.models || ['tree_default', 'tree_oak', 'tree_fat', 'tree_simple']), x, 0, z, { ry: r() * 6, h: rand(1.8, 3.2) * (o.scale || 1), c: { leaf, wood: o.wood } });
    }
  };
  const ground = (n, d0, d1, c, models = ['grass', 'grass_large']) => { for (const [x, z] of band(n, d0, d1, false)) P.put(pick(models), x, 0, z, { ry: r() * 6, h: rand(0.18, 0.32), c: { grass: c } }); };
  const flowers = (n, d0, d1, grass) => {
    const cols = ['#c9a8b4', '#cbbd82', '#a99cc0', '#d8d0c0'];
    for (const [x, z] of band(n, d0, d1, false)) P.put(pick(['flower_purpleA', 'flower_yellowA', 'flower_redA']), x, 0, z, { ry: r() * 6, h: rand(0.18, 0.28), c: { grass, accent: pick(cols) } });
  };
  const rocks = (n, d0, d1, c, tall = 0, sz = 1) => {
    for (const [x, z] of band(n, d0, d1)) {
      if (r() < tall) P.put(pick(['stone_tallA', 'stone_tallB']), x, 0, z, { ry: r() * 6, h: rand(0.8, 2.2) * sz, c: { stone: c } });
      else P.put(pick(['stone_largeA', 'stone_largeB', 'stone_largeD']), x, -0.02, z, { ry: r() * 6, s: rand(0.8, 1.8) * sz, c: { stone: c } });
    }
  };
  const pebbles = (n, d0, d1, c) => { for (const [x, z] of band(n, d0, d1, false)) P.put(pick(['stone_smallA', 'stone_smallB', 'stone_smallFlatA']), x, 0, z, { ry: r() * 6, s: rand(0.6, 1.3), c: { stone: c } }); };
  // Valla de madera del kit (tramos de 1 casilla), más baja abajo
  const fence = (d, h, c, model = 'fence_simple') => around(d, 1, (x, z, ry, side) => P.put(model, x, 0, z, { ry, w: 1, c: { wood: c, dark: shade(c, 0.7) }, h: side === 's' ? Math.min(h, 0.5) : h }));
  // Muro de piedra de bloques irregulares con volumen (abajo, bajito)
  const stoneWall = (d, h, c1, c2, sides = 'nwes') => around(d, 0.62, (x, z, ry, side) => {
    const hh = (side === 's' ? Math.min(h, 0.42) : h) * rand(0.85, 1.12), b = box(rand(0.5, 0.68), hh, rand(0.42, 0.55), r() < 0.5 ? c1 : c2, { flatShading: true, roughness: 0.95 });
    b.rotation.set((r() - 0.5) * 0.06, ry + (r() - 0.5) * 0.12, (r() - 0.5) * 0.06);
    put(b, x + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.06);
    if (r() < 0.5) { const cap = box(rand(0.3, 0.5), 0.12, 0.4, shade(c1, 1.08), { flatShading: true, roughness: 0.95 }); cap.rotation.y = ry + r(); put(cap, x, z, 0, hh); }
  }, sides);
  // Seto recortado con algún bulto
  const hedge = (d, h, c) => around(d, 0.9, (x, z, ry, side) => {
    const hh = (side === 's' ? Math.min(h, 0.45) : h) * rand(0.93, 1.05);
    const b = box(0.94, hh, 0.62, c, { flatShading: true, roughness: 0.95 }); b.rotation.y = ry; put(b, x, z);
    if (r() < 0.6) put(blob(rand(0.22, 0.32), shade(c, rand(0.9, 1.1)), { wind: 'tree' }), x + (r() - 0.5) * 0.5, z + (r() - 0.5) * 0.3, 0, hh * 0.9);
  });
  // Barandilla metálica (central, puerto)
  const railing = (d, h, post, rail, kick) => {
    around(d, 1.2, (x, z) => put(cyl(0.035, 0.035, h, post, { metalness: 0.4, roughness: 0.55 }, 6), x, z));
    for (const y of [h * 0.5, h]) apron(d - 0.02, d + 0.02, rail, 0.045, { metalness: 0.4, roughness: 0.5 }), H.children.slice(-4).forEach(m => { m.position.y = y - 0.045; m.castShadow = true; });
    if (kick) around(d, 0.6, (x, z, ry) => { const b = box(0.6, 0.12, 0.04, (Math.round(x * 1.7 + z * 1.7) & 1) ? kick : '#2c2e32', {}, false); b.rotation.y = ry; put(b, x, z); });
  };
  // Bandera o estandarte colgando de y (se mece con el viento)
  const banner = (w, h, c) => { const m = M(new THREE.PlaneGeometry(w, h, 1, 5).translate(0, -h / 2, 0), c, { side: THREE.DoubleSide, roughness: 0.95, wind: 'flag' }); return m; };
  // Niebla baja (fantasma, santuario): discos grandes y suaves que se desplazan muy despacio (mezcla normal)
  const fogBanks = (n, color, op) => {
    const m = new THREE.MeshBasicMaterial({ map: mist(), color, transparent: true, opacity: op, depthWrite: false });
    for (const [x, z] of band(n, 0.8, 8, false)) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); p.rotation.x = -Math.PI / 2; p.scale.setScalar(rand(3, 6)); p.position.set(x, rand(0.15, 0.5), z);
      group.add(p); const ph = r() * 6, x0 = x;
      anim.push(() => { p.position.x = x0 + Math.sin(world.time * 0.08 + ph) * 0.8; });
    }
  };

  const kind = th.decor;
  if (kind === 'trees') {   // pradera: valla de madera, hierba y flores, y arboleda
    fence(0.9, 0.6, '#8a6a48');
    ground(220, 0.5, 4, '#5f8a45', ['grass']); flowers(60, 0.6, 3.5, '#5f8a45');
    for (const [x, z] of band(70, 1.1, 3)) P.put(pick(['plant_bush', 'plant_bushLarge']), x, 0, z, { ry: r() * 6, h: rand(0.35, 0.6), c: { grass: pick(LEAF) } });
    trees(150, 1.4, 9);
    rocks(18, 1.2, 6, '#8f8a80');
    for (const [x, z] of band(10, 1.2, 4)) P.put(pick(['stump_round', 'stump_old', 'log']), x, 0, z, { ry: r() * 6, s: rand(1, 1.5) });
  } else if (kind === 'forest') {   // bosque: matorral de borde y bosque cerrado, helechos, troncos y setas
    for (let i = 0; i < 1; i++) around(0.85, 0.75, (x, z, ry, side) => P.put(pick(['plant_bushLarge', 'plant_bush']), x + (r() - 0.5) * 0.2, 0, z + (r() - 0.5) * 0.2, { ry: r() * 6, h: side === 's' ? rand(0.3, 0.42) : rand(0.45, 0.7), c: { grass: pick(LEAF) } }));
    ground(160, 0.5, 4, '#4f7a3c', ['grass', 'plant_flatTall']);
    trees(300, 1.2, 10, { pines: 0.45, scale: 1.15 });
    for (const [x, z] of band(16, 1.2, 4)) P.put(pick(['log', 'log_large', 'stump_old', 'stump_round']), x, 0, z, { ry: r() * 6, s: rand(1.2, 1.8) });
    const bugs = name === 'g-bicho';
    for (const [x, z] of band(bugs ? 40 : 30, 1.1, 4)) P.put('mushroom_tanGroup', x, 0, z, { ry: r() * 6, h: bugs && r() < 0.5 ? rand(0.8, 1.6) : rand(0.2, 0.35), c: { accent: pick(['#a8866a', '#9a6a58', '#b8a488']), stone: '#d8ccb4' } });
    rocks(14, 1.5, 9, '#7f7a6e');
  } else if (kind === 'rocks' || kind === 'quarry' || kind === 'canyon') {
    const rc = th.rock[1];
    if (kind === 'canyon') {   // cañón de arenisca: tapia de adobe, mesetas por capas, cactus y matas secas
      stoneWall(0.85, 0.7, '#a88a62', '#9a7c56');
      for (const [x, z] of band(26, 1.6, 9)) {
        let w = rand(1.6, 3), y = 0;
        for (let k = 0; k < 2 + (r() * 3 | 0); k++) { const hh = rand(0.6, 1.2); P.put('cliff_block_stone', x, y, z, { ry: r() * 0.4, w, d: w * rand(0.8, 1.2), h: hh, c: { stone: pick(['#b0845a', '#9c7048', '#c09468', '#a67a50']), grass: '#b8946a' } }); y += hh; w *= rand(0.6, 0.85); }
      }
      for (const [x, z] of band(36, 1.2, 6)) P.put(pick(['cactus_tall', 'cactus_short']), x, 0, z, { ry: r() * 6, h: rand(0.6, 1.4), c: { leaf: '#62784a' } });
      for (const [x, z] of band(50, 1.0, 6)) P.put('plant_bush', x, 0, z, { ry: r() * 6, h: rand(0.25, 0.45), c: { grass: pick(['#8a7a52', '#7a6c48']) } });
      rocks(30, 1.1, 7, '#a88a62', 0.3); pebbles(90, 0.6, 5, '#9a7c56');
    } else {   // cueva (y la de Bruno) o cantera (gimnasio de roca): paredes de roca alrededor
      stoneWall(0.85, 0.75, shade(rc, 0.9), shade(rc, 0.78));
      if (kind === 'quarry') {   // cantera: bancales escalonados, bloques cortados y una grúa de madera
        for (let k = 0; k < 3; k++) around(1.6 + k * 1.4, 1.5, (x, z, ry, side) => {
          if (side === 's') return;
          P.put('cliff_block_stone', x, 0, z, { ry, w: 1.5, d: 1.5, h: 0.9 * (k + 1) * rand(0.92, 1.08), c: { stone: [shade(rc, 0.95), shade(rc, 0.82), shade(rc, 1.05)][k], grass: shade(rc, 1.1) } });
        }, 'nwe');
        for (const [x, z] of band(10, 1.2, 2.6)) for (let i = 0; i < 6; i++) { const b = box(0.62, 0.42, 0.42, pick(['#a8987e', '#9a8a70']), { flatShading: true }); put(b, x + (i % 3) * 0.64 - 0.64, z + ((i / 3) | 0) * 0.44, (r() - 0.5) * 0.05); if (i < 3 && r() < 0.6) put(box(0.62, 0.42, 0.42, '#b0a086', { flatShading: true }), x + (i % 3) * 0.64 - 0.64, z, 0, 0.42); }
        for (const x of [-2.6, COLS + 2.6]) {   // grúa de madera (pluma y polea)
          const w = '#6e5236';
          put(cyl(0.09, 0.11, 4, w, {}, 6), x, -2.6);
          const boom = cyl(0.06, 0.07, 3.4, w, {}, 6); boom.rotation.z = (x < 0 ? -1 : 1) * 1.0; put(boom, x, -2.6, 0, 2.6);
          put(cyl(0.012, 0.012, 1.6, '#3a3430', {}, 4, false), x + (x < 0 ? 2.75 : -2.75), -2.6, 0, 2.2);
          put(box(0.4, 0.35, 0.4, '#8a7a62', { flatShading: true }), x + (x < 0 ? 2.75 : -2.75), -2.6, 0, 1.85);
        }
      } else {   // cueva: muro de rocas grandes, estalagmitas y charcos
        around(1.7, 1.1, (x, z, ry, side) => { if (side !== 's') P.put('cliff_large_stone', x + (r() - 0.5) * 0.4, 0, z + (r() - 0.5) * 0.4, { ry: ry + (r() - 0.5) * 0.4, w: 1.3, d: 0.7, h: rand(1.6, 3.2), c: { stone: shade(rc, rand(0.65, 0.85)) } }); }, 'nwe');
        rocks(50, 1.1, 7, shade(rc, 0.85), 0.55, 1.1);
        for (const [x, z] of band(10, 1.5, 6, false)) { const p = M(new THREE.CircleGeometry(rand(0.4, 0.9), 9), '#2e3236', { roughness: 0.35 }, false); p.rotation.x = -Math.PI / 2; put(p, x, z, 0, 0.012); }
      }
      pebbles(140, 0.6, 5, shade(rc, 0.9));
    }
  } else if (kind === 'reeds') {   // lago: playa de arena, juncos en la orilla, nenúfares, canoas y un embarcadero
    apron(0.5, 1.5, '#c9b486', 0.05);
    for (const [x, z] of band(50, 1.4, 2.6, false)) P.put('crops_bambooStageB', x, 0, z, { ry: r() * 6, h: rand(0.6, 1.0), c: { grass: pick(['#6f8a4a', '#7e9150', '#62804a']) } });
    for (const [x, z] of band(60, 2.2, 8, false)) P.put(pick(['lily_large', 'lily_small']), x, 0.0, z, { ry: r() * 6, s: rand(1.4, 2.4), c: { leaf: '#4f6e3c', dark: '#3f5a32', accent: '#c8a0aa' } });
    for (const [x, z] of [[-2.2, 6], [COLS + 2.4, 9]]) P.put('canoe', x, 0.02, z, { ry: r() * 6, s: 2.2, c: { wood: '#7a5a3c', leaf: '#9a6a48' } });
    // embarcadero de madera hacia el norte
    for (let z = -1.5; z > -8; z -= 0.42) put(box(1.4, 0.07, 0.38, pick(['#8a6a48', '#7c5e40']), {}, true), 7, z, 0, 0.18);
    for (let z = -1.7; z > -8; z -= 1.4) for (const dx of [-0.65, 0.65]) put(cyl(0.07, 0.07, 0.6, '#5e4630', {}, 6), 7 + dx, z, 0, -0.35);
    for (const [x, z] of band(16, 0.8, 1.4, false)) P.put(pick(['stone_smallA', 'stone_largeA']), x, 0.03, z, { ry: r() * 6, s: rand(0.6, 1), c: { stone: '#a49c8c' } });
    for (const [x, z] of [[-1.1, -1.1], [COLS + 1.1, -1.0], [-1.0, ROWS + 1.1], [COLS + 1.1, ROWS + 1.0]]) P.put('tree_palmTall', x, 0.04, z, { ry: r() * 6, h: rand(2.2, 2.8), c: { leaf: pick(LEAF), wood: '#8a6a4a' } });
    trees(40, 9, 13);
  } else if (kind === 'pool') {   // piscina: andén de baldosas, corcheras, poyetes de salida, escaleras y trampolín
    for (let k = 0; k < 1; k++) around(0.75 + k * 0.9, 0.9, (x, z, ry) => { const b = box(0.88, 0.06, 0.88, ((Math.round(x / 0.9) + Math.round(z / 0.9) + k) & 1) ? '#b9c4c8' : '#aab6bb', { roughness: 0.6 }, false); put(b, x, z); });
    // bordillo redondeado del vaso
    apron(1.2, 1.4, '#d6dcde', 0.1, { roughness: 0.6 });
    for (const off of [2.2, 3.4, 4.6]) {   // corcheras (flotadores azul marino y blancos, apagados)
      for (let x = -off; x < COLS + off; x += 0.22) { const f = M(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8).rotateZ(Math.PI / 2), (Math.round(x / 0.22) % 4 < 2) ? '#3e5872' : '#c8ced2', { roughness: 0.7 }, false); for (const z of off < 2.5 ? [-off, ROWS + off] : [ROWS + off]) put(f.clone(), x, z, 0, 0.03); }   // al norte, las gradas
    }
    for (let x = 2; x < COLS; x += 2.4) { put(box(0.5, 0.45, 0.45, '#d0d6d8', { roughness: 0.6 }), x, -0.95); put(box(0.5, 0.06, 0.5, '#3e5872', {}, false), x, -0.95, 0, 0.45); }
    for (const [x, z] of [[-1.35, 4], [-1.35, 11], [COLS + 1.35, 4], [COLS + 1.35, 11]]) for (const dz of [-0.25, 0.25]) { const p = cyl(0.03, 0.03, 0.9, '#a8b0b6', { metalness: 0.6, roughness: 0.4 }, 6); put(p, x, z + dz, 0, -0.2); }
    // trampolín al fondo: torre de hormigón con dos plataformas
    put(box(0.4, 3.2, 0.4, '#b4bcc0'), COLS + 3.2, -3.4); put(box(1.2, 0.12, 2.4, '#c8d0d4'), COLS + 3.2, -2.6, 0, 1.6); put(box(1.2, 0.12, 2.8, '#c8d0d4'), COLS + 3.2, -2.4, 0, 3.2);
    stands(H, '#3e5872', '#c8ced2', -2.9);
    for (const [x, z] of [[-3.4, -2.6], [COLS + 4.2, ROWS + 2.6], [-3.4, ROWS + 2.6]]) P.put('tree_palmTall', x, 0, z, { h: 2.4, ry: r() * 6, c: { leaf: '#557a48', wood: '#8a6a4a' } });
  } else if (kind === 'stands') {   // estadio: vallas publicitarias, gradas con público y torres de focos
    const [c1, c2] = (th.standColors || ['#b98a9c', '#e0d0d6']).map(c => shade(c, 0.82));
    around(0.75, 1.5, (x, z, ry) => { const b = box(1.46, 0.5, 0.08, (Math.round(x + z) & 1) ? c1 : '#d8d4d0', { roughness: 0.7 }); b.rotation.y = ry; put(b, x, z); });
    stands(H, c1, c2, -2.2, true);
    for (const [x, z] of [[-3.5, -3.5], [COLS + 3.5, -3.5], [-3.5, ROWS + 3.5], [COLS + 3.5, ROWS + 3.5]]) {
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) put(cyl(0.04, 0.06, 5.2, '#8a9096', { metalness: 0.5, roughness: 0.5 }, 5), x + dx, z + dz);
      put(box(1.2, 0.7, 0.3, '#4a4e54', { metalness: 0.3 }), x, z, 0, 5.2); put(box(1.0, 0.5, 0.05, '#c8c4b8', {}, false), x, z + (z < 0 ? 0.17 : -0.17), 0, 5.3);
    }
    for (let x = 1; x < COLS; x += 3) put(banner(0.7, 1.1, x % 2 ? c1 : shade(c2, 0.8)), x, -2.2 - 3 * 0.9 - 0.1, 0, 2.6);
  } else if (kind === 'machines') {   // central eléctrica: barandilla, tuberías, transformadores, bobinas y torres de alta tensión
    railing(0.85, 0.6, '#8a9096', '#9aa0a6', '#a8913a');
    for (const [rad, y] of [[0.22, 0.5], [0.14, 1.05]]) {
      const p = M(new THREE.CylinderGeometry(rad, rad, COLS + 8, 10).rotateZ(Math.PI / 2), '#6e7680', { metalness: 0.35, roughness: 0.55 }); put(p, COLS / 2, -1.9, 0, y);
      for (let x = -3; x < COLS + 4; x += 2.2) put(M(new THREE.CylinderGeometry(rad + 0.06, rad + 0.06, 0.1, 10).rotateZ(Math.PI / 2), '#5a626c', { metalness: 0.35 }), x, -1.9, 0, y);
    }
    for (let x = -3; x < COLS + 4; x += 3.3) put(box(0.12, 1.1, 0.5, '#4a5058'), x, -1.9);
    const trafo = (x, z) => {   // transformador: cuerpo con aletas de radiador y aisladores
      put(box(1.4, 0.12, 1.1, '#5a5e64'), x, z); put(box(1.1, 1.1, 0.8, '#6a737c', { metalness: 0.25, roughness: 0.6 }), x, z, 0, 0.12);
      for (let i = 0; i < 6; i++) put(box(0.04, 0.8, 0.3, '#5a626c', { metalness: 0.25 }), x - 0.45 + i * 0.18, z + 0.52, 0, 0.25);
      for (let i = -1; i <= 1; i++) for (let k = 0; k < 3; k++) put(cyl(0.07 - k * 0.01, 0.08 - k * 0.01, 0.12, '#b0a690', {}, 8), x + i * 0.32, z, 0, 1.22 + k * 0.12);
    };
    for (let z = 1; z < ROWS; z += 4.2) { trafo(-2.3, z); trafo(COLS + 2.3, z); }
    for (const [x, z] of band(10, 1.4, 3.5)) { const g = grp(M(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 14).rotateX(Math.PI / 2).translate(0, 0.45, -0.22), '#7a5e42'), M(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 14).rotateX(Math.PI / 2).translate(0, 0.45, 0.22), '#7a5e42'), M(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 12).rotateX(Math.PI / 2).translate(0, 0.45, 0), '#3a3c40')); put(g, x, z, r() * 6); }
    for (const [x, z] of [[-4.5, 2], [COLS + 4.5, 12], [COLS + 4.8, 3]]) { put(cyl(0.9, 0.9, 2.2, '#7f8a94', { metalness: 0.2, roughness: 0.6 }, 16), x, z); for (const y of [0.5, 1.4, 2.1]) put(cyl(0.93, 0.93, 0.08, '#5e6770', {}, 16), x, z, 0, y); }
    // torres de alta tensión al fondo con los cables colgando
    const towers = [-6, 6, 18, 30];
    for (const x of towers) {
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const l = cyl(0.03, 0.05, 5, '#5a6068', { metalness: 0.4 }, 4); l.rotation.set(-dz * 0.12, 0, dx * 0.12); put(l, x + dx, -5.5 + dz); }
      put(box(2.6, 0.08, 0.1, '#5a6068'), x, -5.5, 0, 4.6); put(box(1.8, 0.08, 0.1, '#5a6068'), x, -5.5, 0, 3.9);
    }
    for (let i = 0; i < towers.length - 1; i++) for (const [dx, y] of [[-1.2, 4.6], [1.2, 4.6], [0, 3.9]]) {
      const a = new THREE.Vector3(towers[i] + dx, y, -5.5), b = new THREE.Vector3(towers[i + 1] + dx, y, -5.5);
      const curve = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -1.1, 0)), b);
      H.add(M(new THREE.TubeGeometry(curve, 12, 0.015, 3), '#2a2c30', {}, false));
    }
  } else if (kind === 'flowers') {   // jardín (gimnasio planta): seto, parterres de flores, macetas y un invernadero
    hedge(0.9, 0.7, '#3f6a36');
    flowers(160, 1.4, 5, '#4f7a3e');
    for (const [x, z] of band(30, 1.5, 5)) P.put(pick(['plant_bush', 'plant_bushLarge']), x, 0, z, { ry: r() * 6, h: rand(0.35, 0.6), c: { grass: pick(LEAF) } });
    for (let z = 1.5; z < ROWS; z += 3) for (const x of [-1.9, COLS + 1.9]) { put(cyl(0.26, 0.2, 0.4, '#9a6450', { flatShading: true }, 9), x, z); put(blob(0.32, pick(LEAF), { wind: 'tree' }), x, z, 0, 0.62); }
    for (let x = -2; x <= COLS + 2; x += 1.6) {   // invernadero al norte: arcos de hierro claro sobre un murete de ladrillo
      for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6, b = box(0.05, 0.62, 0.05, '#c8ccc4', { metalness: 0.3 }); b.rotation.x = a - Math.PI / 2; b.position.set(0, 0.5 + Math.sin(a) * 1.6 - 0.3, -3.6 - Math.cos(a) * 1.6); put(b, x, 0); }
    }
    put(box(COLS + 4.2, 0.5, 0.18, '#94624e', { flatShading: true }), COLS / 2, -2.05); put(box(COLS + 4.2, 0.5, 0.18, '#94624e', { flatShading: true }), COLS / 2, -5.15);
    trees(80, 5, 12);
  } else if (kind === 'lanterns') {   // dojo ninja (veneno) o santuario (siniestro)
    const shrine = name === 'g-siniestro' || name === 'e-karen';
    if (shrine) {   // santuario: muro bajo de piedra, linternas de piedra, toriis y pinos oscuros
      stoneWall(0.85, 0.5, '#4a4650', '#3e3a44');
      apron(1.3, 2.4, '#5a5660', 0.03);
      const toro = (x, z) => { put(cyl(0.28, 0.32, 0.18, '#6a6670', {}, 6), x, z); put(cyl(0.09, 0.11, 0.55, '#6a6670', {}, 6), x, z, 0, 0.18); put(box(0.34, 0.26, 0.34, '#6a6670'), x, z, 0, 0.73); put(box(0.18, 0.12, 0.36, '#c8a878', {}, false).translateY(0), x, z, 0, 0.8); put(cone(0.36, 0.26, '#5a5660', { flatShading: true }, 4), x, z, Math.PI / 4, 0.99); };
      around(1.6, 3, (x, z, ry, side) => { if (side !== 's') toro(x, z); });
      const torii = (x, z, ry) => { const g = grp(); const red = '#6a2e28';
        for (const dx of [-0.9, 0.9]) { const p = cyl(0.09, 0.1, 2.2, red, {}, 8); p.position.x = dx; g.add(p); }
        const kasa = box(2.6, 0.14, 0.24, '#2e2626'); kasa.position.y = 2.2; g.add(kasa); const nuki = box(2.1, 0.1, 0.14, red); nuki.position.y = 1.75; g.add(nuki);
        put(g, x, z, ry); };
      torii(COLS / 2, -2.3, 0); torii(-2.5, ROWS / 2, Math.PI / 2); torii(COLS + 2.5, ROWS / 2, Math.PI / 2);
      trees(200, 2, 10, { pines: 1, pineLeaf: '#24342c', wood: '#3a2e26' });
      fogBanks(14, '#3a3a4e', 0.3);
    } else {   // dojo: tarima de madera, paredes de shoji con su alero, estandartes y farolillos de papel, y bambú
      apron(0.5, 1.7, '#6a5038', 0.08);
      for (let x = -1.7; x < COLS + 1.7; x += 0.4) put(box(0.02, 0.005, 1.2, '#4a3828', {}, false), x, -1.1, 0, 0.08);
      const shoji = (x, z, ry) => { const g = grp(); const w = '#3a2a1e';
        for (const dx of [-0.8, 0.8]) { const p = box(0.12, 2.1, 0.12, w); p.position.x = dx; g.add(p); }
        const paper = box(1.5, 1.6, 0.03, '#b9b096', {}, false); paper.position.y = 0.3; g.add(paper);
        for (let k = 1; k < 4; k++) { const v = box(0.03, 1.6, 0.05, w, {}, false); v.position.set(-0.75 + k * 0.375, 0.3, 0); g.add(v); }
        for (let k = 0; k < 5; k++) { const h = box(1.5, 0.03, 0.05, w, {}, false); h.position.y = 0.3 + k * 0.4; g.add(h); }
        put(g, x, z, ry); };
      around(2.0, 1.6, (x, z, ry, side) => { if (side !== 's') shoji(x, z, ry); });
      around(1.9, 1.2, (x, z) => put(cyl(0.04, 0.04, 0.42, '#3a2a1e', {}, 6), x, z), 's');
      apron(1.88, 1.92, '#3a2a1e', 0.05); H.children.slice(-4).forEach(m => { m.position.y = 0.4; });
      const eave = box(COLS + 5.2, 0.12, 1.2, '#2e2a2c', { flatShading: true }); eave.rotation.x = 0.35; put(eave, COLS / 2, -2.3, 0, 2.15);
      for (let x = 1.2; x < COLS; x += 3.2) put(banner(0.55, 1.1, '#4e3656'), x, -2.02, 0, 1.95);
      for (let x = 2.8; x < COLS; x += 3.2) { put(cyl(0.005, 0.005, 0.3, '#2a2420', {}, 3, false), x, -1.6, 0, 1.75); put(cyl(0.17, 0.17, 0.34, dimLamp('#b8865a', 0.35), {}, 10), x, -1.6, 0, 1.42); }
      for (const [x, z] of band(60, 2.2, 5)) P.put('crops_bambooStageB', x, 0, z, { ry: r() * 6, h: rand(1.6, 2.6), c: { grass: pick(['#5f7a48', '#6a8250', '#54703f']) } });
      trees(110, 4, 12, { pines: 0.6, leaves: ['#3a4a3a', '#2e3e30'], pineLeaf: '#2a3a2c' });
    }
  } else if (kind === 'crystals') {   // salón (psíquico): columnas, estanterías con libros, cortinas y alfombra
    apron(0.5, 1.8, '#3e3448', 0.02);
    around(1.25, 2.4, (x, z, ry, side) => { if (side !== 's') P.put('statue_column', x, 0, z, { h: 2.8, c: { stone: '#a49cb0', dark: '#8a8296' } }); });
    around(1.0, 0.5, (x, z) => { put(cyl(0.05, 0.06, 0.38, '#a49cb0', {}, 6), x, z); }, 's');
    apron(0.98, 1.02, '#8a8296', 0.06); H.children.slice(-4).forEach(m => { m.position.y = 0.38; });
    for (let x = -0.05; x < COLS; x += 2.4) {   // estanterías entre columnas, al norte
      const sx = x + 1.2;
      put(box(1.9, 2.2, 0.45, '#3e2e2a'), sx, -1.9);
      for (let k = 0; k < 4; k++) { put(box(1.8, 0.04, 0.42, '#2e2220', {}, false), sx, -1.85, 0, 0.3 + k * 0.5); for (let b = 0; b < 12; b++) put(box(0.12, rand(0.28, 0.4), 0.3, pick(['#5a3e4e', '#3e4e5e', '#6a5a3e', '#4a5e48', '#6e4a3a']), {}, false), sx - 0.8 + b * 0.145, -1.75, 0, 0.34 + k * 0.5); }
    }
    for (const x of [-1.9, COLS + 1.9]) for (let z = 1.2; z < ROWS; z += 2.4) put(banner(1.0, 2.4, '#4e3a5e'), x, z, Math.PI / 2, 2.5);
    for (const [x, z] of band(10, 2.6, 5)) { put(cyl(0.18, 0.25, 0.9, '#8a8296', {}, 8), x, z); put(cyl(0.22, 0.1, 0.35, '#6e6680', {}, 10), x, z, 0, 0.9); }
  } else if (kind === 'volcano') {
    const ruins = name === 'g-dragon' || name === 'e-lance' || name === 'e-lancej';
    const dark = ruins ? '#3a3640' : '#36302c';
    // columnas de basalto hexagonales alrededor (más bajas junto al muro de abajo)
    around(0.95, 0.42, (x, z, ry, side) => { put(cyl(0.22, 0.22, (side === 's' ? rand(0.25, 0.45) : rand(0.5, 1.2)), pick([dark, shade(dark, 1.15), shade(dark, 0.85)]), { flatShading: true }, 6), x + (r() - 0.5) * 0.15, z + (r() - 0.5) * 0.15, r()); });
    for (const [x, z] of band(ruins ? 60 : 160, 1.4, 7)) { const e = edge(x, z); put(cyl(rand(0.2, 0.32), rand(0.22, 0.34), rand(0.4, 1.2) + e * 0.35, pick([dark, shade(dark, 1.15), shade(dark, 0.8)]), { flatShading: true }, 6), x, z, r()); }
    rocks(40, 1.5, 10, shade(dark, 0.9), 0.5, 1.2);
    // coladas de lava enfriada: costra oscura con un rescoldo apagado (no brilla)
    for (const [x, z] of band(14, 1.5, 7, false)) { const p = M(new THREE.CircleGeometry(rand(0.4, 0.9), 7), mat('#3a1c14', { emissive: '#5a2010', emissiveIntensity: 0.45, roughness: 0.9 }), {}, false); p.rotation.x = -Math.PI / 2; p.scale.y = rand(0.5, 1); put(p, x, z, 0, 0.012); }
    pebbles(120, 0.6, 8, shade(dark, 1.1));
    if (ruins) {   // ruinas del dragón: columnas rotas, tambores caídos, escalinata y estandartes
      around(1.6, 2.6, (x, z, ry, side) => { if (side !== 's') P.put(r() < 0.5 ? 'statue_columnDamaged' : 'statue_column', x, 0, z, { ry: r() * 6, h: rand(1.4, 2.8), c: { stone: '#6a6270', dark: '#4e4856' } }); });
      for (const [x, z] of band(10, 2, 5)) { const d = M(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 10).rotateZ(Math.PI / 2), '#5e5866', { flatShading: true }); d.position.y = 0.3; put(d, x, z, r() * 6); }
      for (let k = 0; k < 4; k++) put(box(7 - k * 1.2, 0.25, 0.7, '#4e4856', { flatShading: true }), COLS / 2, -2.1 - k * 0.7, 0, k * 0.25);
      for (const x of [COLS / 2 - 4.5, COLS / 2 + 4.5]) { put(cyl(0.05, 0.05, 3.4, '#2e2a30', {}, 6), x, -2.4); put(box(0.9, 0.06, 0.06, '#2e2a30'), x, -2.4, 0, 3.3); put(banner(0.8, 1.7, '#4a2a34'), x, -2.4, 0, 3.27); }
    }
  } else if (kind === 'clouds') {   // plataforma en el cielo: nubes, pilares, barandilla de cuerda y banderines
    const cm = mat('#f2f4f8', { roughness: 1 });
    for (const [x, z] of band(70, 1, 14, false)) {
      const puffs = new THREE.Group(), g = new THREE.Group();   // cada nube, una sola malla
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + r() * 0.9, 1), cm); s.scale.y = 0.6; s.position.set((r() - 0.5) * 2.4, (r() - 0.5) * 0.3, (r() - 0.5) * 1.4); puffs.add(s); }
      mergeStatic(puffs, g, r);
      g.position.set(x, -2.5 - r() * 3, z); group.add(g);
      const ph = r() * 6, y0 = g.position.y;
      anim.push(() => { g.position.y = y0 - Math.sin(world.time * 0.3 + ph) * 0.3; });
    }
    for (const [x, z] of [[0, 0], [COLS, 0], [0, ROWS], [COLS, ROWS], [COLS / 2, 0], [COLS / 2, ROWS]]) put(cyl(0.35, 0.35, 8, '#6a4a2a', {}, 8), x, z, 0, -8);
    for (const [x0, z0, x1, z1] of [[0, 0, COLS, ROWS], [COLS, 0, 0, ROWS]]) { const len = Math.hypot(x1 - x0, z1 - z0), b = M(new THREE.CylinderGeometry(0.12, 0.12, len, 6).rotateZ(Math.PI / 2), '#5e4226'); b.rotation.y = -Math.atan2(z1 - z0, x1 - x0); put(b, (x0 + x1) / 2, (z0 + z1) / 2, 0, -1.2); }
    around(0.25, 2, (x, z) => put(cyl(0.04, 0.05, 0.55, '#6a4a2a', {}, 6), x, z, 0, 0.32));
    apron(0.23, 0.27, '#b8a888', 0.03); H.children.slice(-4).forEach(m => { m.position.y = 0.78; m.castShadow = true; });
    for (const [x, z] of [[-0.25, -0.25], [COLS + 0.25, -0.25], [COLS / 2, -0.25]]) { put(cyl(0.05, 0.05, 2.6, '#6a4a2a', {}, 6), x, z, 0, 0.3); const f = banner(0.9, 0.5, pick(['#b8a070', '#7a8aa8', '#a87a6a'])); f.rotation.z = Math.PI / 2; put(f, x + 0.02, z, 0, 2.8); }
    for (const [x, z] of [[-5, 4], [COLS + 6, 10], [6, -7], [COLS - 3, ROWS + 7]]) {   // islotes flotantes con árboles
      put(M(new THREE.ConeGeometry(1.4, 2.2, 7).rotateX(Math.PI).translate(0, -1.1, 0), '#7a6a58', { flatShading: true }), x, z, r(), -3.5);
      put(cyl(1.42, 1.42, 0.25, '#6a8a4a', { flatShading: true }, 7), x, z, 0, -3.5);
      P.put('tree_default', x + 0.3, -3.25, z, { h: 1.8, c: { leaf: pick(LEAF) } }); P.put('tree_fat', x - 0.5, -3.25, z + 0.3, { h: 1.4, c: { leaf: pick(LEAF) } });
    }
  } else if (kind === 'graves') {   // cementerio: verja de hierro, lápidas, criptas, árboles sin hojas y niebla baja
    around(0.95, 1, (x, z, ry, side) => P.put('iron-fence', x, 0, z, { ry, w: 1, d: 0.12, h: side === 's' ? 0.5 : 0.85, c: { stone: '#2e2c34' } }));
    for (const [x, z] of band(110, 1.3, 6)) P.put(pick(['gravestone-round', 'gravestone-cross', 'gravestone-bevel', 'gravestone-broken']), x, 0, z, { ry: (r() - 0.5) * 0.4 + (z < 0 || z > ROWS ? 0 : Math.PI / 2), h: rand(0.45, 0.8), c: { stone: pick(['#6a6478', '#5e5a6a', '#76707e']) } });
    for (const x of [COLS / 2 - 6, COLS / 2 + 6]) P.put('crypt', x, 0, -3, { ry: Math.PI, h: 2, c: { stone: '#5a5664' } });
    trees(70, 1.8, 10, { models: ['tree_cone', 'tree_simple'], leaves: ['#2a2834', '#24222e', '#302c36'], wood: '#2e2a2a' });
    for (const [x, z] of band(16, 1.6, 5)) { put(cyl(0.05, 0.05, 0.3, '#d8d0c0', {}, 6), x, z); put(M(new THREE.SphereGeometry(0.05, 6, 4), dimLamp('#c8a8e0', 0.5), {}, false), x, z, 0, 0.33); }
    fogBanks(18, '#3e3c52', 0.32);
  } else if (kind === 'cliffs') {   // cascadas: acantilado de roca por capas, pinos, postes de entrenamiento
    const rc = th.rock[1];
    stoneWall(0.85, 0.6, shade(rc, 0.95), shade(rc, 0.8), 'swe');
    for (let x = -6; x < COLS + 6; x += 1.5) P.put('cliff_block_stone', x, 0, -2.2 - r() * 0.5, { ry: (r() - 0.5) * 0.2, w: 1.6, d: 2.2, h: 3 + r() * 2.5, c: { stone: shade(rc, rand(0.8, 1.0)), grass: '#5a7a44' } });
    const fcols = [...new Set([...Shared.parseMap(name).flow.keys()].map(i => i % COLS))].sort((a, b) => a - b);
    const falls = fcols.filter((c, k) => k === 0 || fcols[k - 1] !== c - 1).map(c => c + (fcols.includes(c + 1) ? 0.5 : 0));
    for (const x of falls) {
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(2, 4.5), new THREE.MeshBasicMaterial({ map: flowTex, color: '#cfe4ee', transparent: true, opacity: 0.8, depthWrite: false }));
      fall.position.set(x + 0.5, 2.2, -1.1);
      group.add(fall);
      anim.push(dt => { fall.material.map.offset.y += dt * 1.6; });
    }
    for (const x of [-1.9, COLS + 1.9]) for (let z = 2; z < ROWS; z += 3.5) { put(cyl(0.12, 0.14, 1.3, '#7a5a3c', {}, 8), x, z); put(cyl(0.15, 0.15, 0.4, '#b8a47a', {}, 8), x, z, 0, 0.6); }
    trees(170, 1.6, 10, { pines: 0.6 });
    rocks(24, 1.2, 7, rc, 0.3); ground(120, 0.5, 4, '#5a7a44', ['grass']);
  } else if (kind === 'snow') {   // nieve (Hielo) o glaciar (Lorelei): muro de hielo, pinos escarchados, ventisqueros y rocas
    const glacier = name === 'e-lorelei';
    around(0.95, 0.9, (x, z, ry, side) => P.put('cliff_large_stone', x, 0, z, { ry: ry + (r() - 0.5) * 0.15, w: 0.95, d: 0.55, h: side === 's' ? rand(0.3, 0.42) : rand(0.6, glacier ? 1.6 : 1.1), c: { stone: pick(['#b8cad6', '#aec2d0', '#c4d4de']) } }));
    trees(glacier ? 70 : 190, 1.5, 10, { pines: 1, pineLeaf: '#7f9690', wood: '#5a4a3e' });
    for (const [x, z] of band(60, 1.2, 6, false)) { const b = blob(rand(0.5, 1.2), pick(['#dfe6ec', '#d4dde6']), {}, false); b.scale.y = 0.35; put(b, x, z); }
    rocks(glacier ? 60 : 30, 1.2, 8, '#a9c0d0', glacier ? 0.7 : 0.4, glacier ? 1.4 : 1);
  } else if (kind === 'harbor') {   // puerto: muelles de tablones, bolardos, contenedores, cajas y una grúa
    for (const z of [-0.6, ROWS + 0.6]) for (let x = -3; x < COLS + 3; x += 0.36) put(box(0.34, 0.12, z < 0 ? 4.2 : 2.6, pick(['#7a5a3c', '#6e5236', '#84644a']), {}, false), x, z < 0 ? -2.1 : ROWS + 1.3);
    for (let x = -3; x < COLS + 3; x += 2) for (const z of [-4.1, ROWS + 2.5]) put(cyl(0.12, 0.12, 0.9, '#4e3a28', {}, 6), x, z, 0, -0.75);
    for (let x = 1; x < COLS; x += 3) { put(cyl(0.14, 0.18, 0.4, '#3a3f46', { metalness: 0.4 }, 8), x, -3.8, 0, 0.12); put(cyl(0.2, 0.2, 0.06, '#3a3f46', { metalness: 0.4 }, 8), x, -3.8, 0, 0.52); }
    const container = (x, z, y, c, ry) => {   // contenedor con su chapa ondulada
      const g = grp(box(2.4, 1.1, 1.0, c, { flatShading: true, roughness: 0.8 }));
      for (let k = -5; k <= 5; k++) { const b = box(0.04, 1.0, 1.04, shade(c, 0.85), {}, false); b.position.set(k * 0.21, 0.05, 0); g.add(b); }
      put(g, x, z, ry, y);
    };
    const cc = ['#7a4a3a', '#3e4e60', '#5a6040', '#6a6e72'];
    for (let z = 0.5; z < ROWS; z += 2.6) { container(-2.6, z + 0.6, 0, pick(cc), Math.PI / 2); if (r() < 0.6) container(-2.6, z + 0.6, 1.1, pick(cc), Math.PI / 2); container(COLS + 2.6, z + 0.6, 0, pick(cc), Math.PI / 2); }
    for (const [x, z] of band(14, 1.2, 3.5)) put(box(0.55, 0.5, 0.55, pick(['#8a6a48', '#7a5c3e']), { flatShading: true }), x, z, r());
    // grúa pórtico al fondo
    for (const x of [-4.5, -1.5]) put(box(0.25, 5, 0.25, '#8a6a3a', { metalness: 0.3 }), x, -4.6);
    put(box(5.5, 0.4, 0.4, '#8a6a3a', { metalness: 0.3 }), -3, -4.6, 0, 5); put(box(0.9, 0.7, 0.7, '#5a5e64'), -2.5, -4.6, 0, 4.3);
  }

  mergeStatic(H, group, rng(seed + 3));
  P.flush(group);
  return anim;
}

// Gradas a los dos lados largos (piscina y estadio); con público, personitas de colores apagados en los asientos
function stands(H, c1, c2, z0, crowd = false) {
  const r = rng(91);
  const seat = [mat(c1), mat(c2)], step = mat('#b4b6bc', { flatShading: true });
  const people = ['#8a6a6a', '#6a7a8a', '#7a8a6a', '#9a8a6a', '#6a6a7a', '#8a7a8a'].map(c => mat(c));
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const z = side < 0 ? z0 - row * 0.9 : ROWS - z0 + row * 0.9, h = 0.45 + row * 0.45;
    const s = new THREE.Mesh(new THREE.BoxGeometry(COLS + 4, h, 0.9).translate(0, h / 2, 0), step);
    s.position.set(COLS / 2, 0, z); s.castShadow = s.receiveShadow = true; H.add(s);
    for (let x = -1; x < COLS + 1; x += 0.7) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), seat[(Math.floor(x * 1.4) + row) % 2]);
      k.position.set(x + 0.4, h + 0.12, z); H.add(k);
      if (crowd && r() < 0.45) {
        const p = people[(r() * people.length) | 0];
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.22), p); body.position.set(x + 0.4, h + 0.42, z + side * 0.05); H.add(body);
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat('#c8a888', { flatShading: true })); head.position.set(x + 0.4, h + 0.7, z + side * 0.05); H.add(head);
      }
    }
  }
}
