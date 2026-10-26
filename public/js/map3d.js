// Mapa de Historia en 3D (Kanto y Johto): una maqueta low-poly de la región con relieve, playa, bosques, montes,
// las losas rojas de las ciudades, los gimnasios, la Liga y el agua animada, con three.js y modelos de Kenney (CC0,
// public/models/kenney). Sale de los mismos datos que el SVG (REGION_ART y los nodos de la región, en %): la cámara
// ortográfica mira inclinada y el llano cae justo en el rectángulo 16:10 de .map-stage, así que los nodos,
// etiquetas y líneas HTML siguen encima en su sitio sin proyectar nada. Un solo renderer para todo, escenas en
// caché por región (precargadas al arrancar) y se pinta solo cuando hace falta (el agua, a 8 FPS; quieta con
// «reducir movimiento»). Sin WebGL, o si falla, se ve el mapa SVG de regionmap.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { REGION_ART, regionMapSVG } from './regionmap.js';

// Lienzo como el del SVG: U = x % · 1,6 (0-160) y V = y % (0-100). En el mundo, X = U, Z = V / sen(inclinación)
// e Y la altura: con la cámara inclinada, el llano (Y = LAND) se ve exactamente como el lienzo plano
const TILT = 58 * Math.PI / 180, SIN = Math.sin(TILT);
const LAND = 1.2;
const W = (u, v, y = LAND) => new THREE.Vector3(u, y, v / SIN);
// Zona que se calcula (con margen: Isla Canela se sale un poco por abajo) y su resolución (celdas por unidad)
const U0 = -8, V0 = -8, UW = 176, VH = 116, RES = 2, GW = UW * RES, GH = VH * RES;
const TEX_PX = 7;   // píxeles de la textura del suelo por unidad
const FPS = 8;      // el agua se mueve a pocos FPS: basta para que se note y apenas gasta
const KENNEY = 'models/kenney/';
// Gimnasio (building-j de City Kit Industrial: nave ancha y baja de tejado curvo): tamaño, giro para que la
// puerta mire a la cámara y dónde va el emblema (delante en Z, altura)
// Rascacielos de la Liga: escala y altura del modelo (building-skyscraper-c mide 4,08 de alto)
const LEAGUE = { scale: 4.8, height: 4.08 };
const GYM_SCALE = [7.5, 4.6, 3.8], GYM_ROT = 0, GYM_SIGN = [3.6, 3.4];   // (ensanchado y más bajo: nave de tejado curvo)

// Paleta del fondo: verdes, tierra, playa y mar algo apagados (a medio camino entre vivos y grisáceos), para que
// resalten encima las losas rojas de las ciudades, los nodos, las etiquetas, los gimnasios y la Liga
const C = {
  snow: [248, 250, 252],
  sea: '#477ebd', grass: [137, 190, 110], grass2: [122, 178, 99], forest: [89, 147, 88], beach: [244, 235, 201],
  rock: [187, 159, 120], peak: [230, 219, 197], plaza: [236, 226, 195], roadEdge: '#8a623e', road: '#f2daa2',
};
// Lo propio de cada región: en Johto, nieve en las cumbres altas (el Monte Plateado y los montes del norte)
// (y las rocas de los montes, con la cumbre nevada en vez de con hierba)
// (league: cuánto se aparta el rascacielos de la Liga del sitio que le toca, [hacia la derecha, hacia abajo])
const REGION_STYLE = { kanto: { league: [-4, -4] }, johto: { snow: true } };
// Colores de los materiales sin textura de Nature Kit (los suyos tiran a turquesa), por su nombre
const MAT_COLOR = { leafsGreen: '#67ab62', leafsDark: '#488b5b', woodBark: '#946b51', woodBarkDark: '#805c48', dirt: '#ac8d6b', grass: '#7ab76e', stone: '#cfcfc7', _defaultMat: '#ffffff' };
// Marcas de ciudad del Town Map (las del SVG): losa roja con borde claro y una franja de brillo
const TOWN = { red: '#e23c48', rim: '#fff4dc', shine: '#ff8f96' };   // (rojo vivo: es lo que tiene que llamar la atención)

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
// Ruido suave (-1 a 1) para que el llano no sea una mesa
function noise(u, v, k = 7) {
  const x = u / k, y = v / k, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}
const segDist = (u, v, [x0, y0], [x1, y1]) => {
  const ax = x0 * 1.6, bx = x1 * 1.6, dx = bx - ax, dy = y1 - y0, l = dx * dx + dy * dy;
  const k = l ? Math.max(0, Math.min(1, ((u - ax) * dx + (v - y0) * dy) / l)) : 0;
  return Math.hypot(u - ax - k * dx, v - y0 - k * dy);
};
const lineDist = (u, v, lines) => { let m = Infinity; for (const l of lines) for (let i = 1; i < l.length; i++) m = Math.min(m, segDist(u, v, l[i - 1], l[i])); return m; };

// Distancia (en celdas) de cada celda a la más cercana con mask === want: chaflán 1-√2 en dos pasadas
function distField(mask, want) {
  const d = new Float32Array(GW * GH), D = Math.SQRT2;
  for (let i = 0; i < d.length; i++) d[i] = mask[i] === want ? 0 : 1e6;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y) { d[i] = Math.min(d[i], d[i - GW] + 1); if (x) d[i] = Math.min(d[i], d[i - GW - 1] + D); if (x < GW - 1) d[i] = Math.min(d[i], d[i - GW + 1] + D); }
  }
  for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) {
    const i = y * GW + x;
    if (x < GW - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < GH - 1) { d[i] = Math.min(d[i], d[i + GW] + 1); if (x < GW - 1) d[i] = Math.min(d[i], d[i + GW + 1] + D); if (x) d[i] = Math.min(d[i], d[i + GW - 1] + D); }
  }
  return d;
}
// Valor de una rejilla en (u, v), interpolado
function sample(g, u, v) {
  const x = Math.max(0, Math.min(GW - 1.001, (u - U0) * RES)), y = Math.max(0, Math.min(GH - 1.001, (v - V0) * RES));
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, k = j * GW + i;
  return (g[k] * (1 - fx) + g[k + 1] * fx) * (1 - fy) + (g[k + GW] * (1 - fx) + g[k + GW + 1] * fx) * fy;
}

// ---------- El terreno: tierra, distancias a la costa, alturas y la textura del suelo ----------
// Rasteriza en una rejilla de celdas lo que dibuje draw (con las coordenadas en %) y la devuelve: 1 si está pintada
function raster(draw) {
  const cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.setTransform(RES * 1.6, 0, 0, RES, -U0 * RES, -V0 * RES);   // de % a celdas
  g.fillStyle = g.strokeStyle = '#fff';
  draw(g);
  const px = g.getImageData(0, 0, GW, GH).data, mask = new Uint8Array(GW * GH);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;
  return mask;
}
const oval = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };

function terrain(region) {
  const a = REGION_ART[region], R = Data.REGIONS[region];
  // Tierra (la isla y los islotes) menos los lagos
  const mask = raster(g => {
    g.fill(new Path2D(a.shape));
    for (const [x, y, rx, ry] of a.islands) oval(g, x, y, rx, ry * 2.24);
    g.fillStyle = '#000';
    for (const [x, y, rx, ry] of a.lakes) oval(g, x, y, rx, ry * 2.24);
  });
  const dIn = distField(mask, 0), dOut = distField(mask, 1);
  // Distancia con signo a la costa, en unidades: positiva tierra adentro
  const sd = new Float32Array(GW * GH);
  for (let i = 0; i < sd.length; i++) sd[i] = (mask[i] ? dIn[i] - 0.5 : 0.5 - dOut[i]) / RES;
  // Lo que se allana: caminos, ciudades y nodos (para que caigan en su sitio y no en una ladera). Su distancia,
  // con otra pasada del mismo cálculo
  const flat = distField(raster(g => {
    g.lineWidth = 0.4; g.beginPath();
    for (const l of a.roads) l.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
    for (const [, x, y, s] of a.cities) oval(g, x, y, (1.5 + s * 0.3) / 1.6, 1.5 + s * 0.3);
    for (const n of R.nodes) oval(g, n.x, n.y, 1.2, 1.9);
  }), 1);
  const height = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const u = U0 + x / RES, v = V0 + y / RES, i = y * GW + x, s = sd[i];
    if (s < 0) { height[i] = Math.max(-3, 0.1 + s * 0.6); continue; }   // fondo del mar y de los lagos
    let h = 0.1 + (LAND - 0.1) * smooth(0.4, 4.5, s) + noise(u, v) * 0.45 * smooth(3, 9, s);
    let peak = 0;
    for (const [mx, my, k] of a.mountains) {
      const r = Math.hypot((u - mx * 1.6) / (9 * k), (v - my - 1) / (6 * k));
      if (r < 1) peak = Math.max(peak, 14 * k * Math.pow(1 - r, 1.25) * (0.85 + 0.3 * hash(Math.round(u * 2), Math.round(v * 2))));
    }
    h += peak * smooth(0.5, 3, s);
    if (s > 1.5) h = LAND + (h - LAND) * smooth(1.2, 2.8, flat[i] / RES);
    height[i] = h;
  }
  return { region, a, R, sd, height, H: (u, v) => sample(height, u, v), S: (u, v) => sample(sd, u, v) };
}

// Textura del suelo: playa, hierba con manchas, bosques, roca en los montes, plazas y caminos. El fondo es
// suave y se calcula a poca resolución (se estira con suavizado); plazas y caminos van encima, nítidos
function groundTexture(T) {
  const { a } = T, B = 3, bw = UW * B, bh = VH * B, snow = REGION_STYLE[T.region]?.snow;
  const base = document.createElement('canvas'); base.width = bw; base.height = bh;
  const bg = base.getContext('2d'), img = bg.createImageData(bw, bh), d = img.data;
  let c0, c1, c2;
  const mix = (q, t) => { c0 += (q[0] - c0) * t; c1 += (q[1] - c1) * t; c2 += (q[2] - c2) * t; };
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const u = U0 + (x + 0.5) / B, v = V0 + (y + 0.5) / B, s = T.S(u, v), ht = T.H(u, v);
    [c0, c1, c2] = C.grass;
    mix(C.grass2, smooth(-0.3, 0.6, noise(u, v, 5)));
    for (const [fx, fy, n] of a.forests) {
      const r = Math.hypot((u - fx * 1.6) / (n * 1.9 + 1), (v - fy - 1.5) / (n * 1.4 + 1));
      if (r < 1.2) mix(C.forest, smooth(1.2, 0.7, r));
    }
    if (ht > LAND + 0.9) mix(C.rock, smooth(LAND + 0.9, LAND + 2.4, ht));
    if (ht > LAND + 6) mix(C.peak, smooth(LAND + 6, LAND + 9, ht));
    if (snow && ht > LAND + 4) mix(C.snow, smooth(LAND + 4, LAND + 6.5, ht));
    mix(C.beach, smooth(1.9, 1.1, s));
    const k = (y * bw + x) * 4;
    d[k] = c0; d[k + 1] = c1; d[k + 2] = c2; d[k + 3] = 255;
  }
  bg.putImageData(img, 0, 0);
  const w = UW * TEX_PX, h = VH * TEX_PX;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(base, 0, 0, w, h);
  g.setTransform(TEX_PX * 1.6, 0, 0, TEX_PX, -U0 * TEX_PX, -V0 * TEX_PX);   // de % a píxeles
  // Plazas de las ciudades
  g.fillStyle = `rgb(${C.plaza})`;
  for (const [, x, y, size] of a.cities) { g.beginPath(); g.ellipse(x, y, 1.3 + size * 0.28, 2 + size * 0.45, 0, 0, Math.PI * 2); g.fill(); }
  // Caminos: borde oscuro y firme claro, con las esquinas redondas
  // (en unidades del lienzo y no en %, para que el trazo tenga el mismo ancho en horizontal y en vertical)
  g.setTransform(TEX_PX, 0, 0, TEX_PX, -U0 * TEX_PX, -V0 * TEX_PX);
  g.lineCap = g.lineJoin = 'round';
  const roads = () => { g.beginPath(); for (const l of a.roads) l.forEach(([x, y], i) => i ? g.lineTo(x * 1.6, y) : g.moveTo(x * 1.6, y)); };
  g.strokeStyle = 'rgba(40, 60, 20, .25)'; g.lineWidth = 3.9; roads(); g.stroke();   // sombra suave en la hierba
  g.strokeStyle = C.roadEdge; g.lineWidth = 3.1; roads(); g.stroke();
  g.strokeStyle = C.road; g.lineWidth = 2.2; roads(); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Malla del terreno: rejilla con los vértices un poco desplazados y caras planas (low-poly). Lo que queda
// del todo bajo el agua no se dibuja
function terrainMesh(T, tex) {
  const STEP = 1.4, nx = Math.ceil(UW / STEP), nz = Math.ceil(VH / STEP);
  const P = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const edge = i === 0 || j === 0 || i === nx || j === nz;
    const u = U0 + i * STEP + (edge ? 0 : (hash(i, j + 99) - 0.5) * STEP * 0.6), v = V0 + j * STEP + (edge ? 0 : (hash(i + 99, j) - 0.5) * STEP * 0.6);
    P.push([u, T.H(u, v), v]);
  }
  const pos = [], uv = [];
  const put = p => { pos.push(p[0], p[1], p[2] / SIN); uv.push((p[0] - U0) / UW, 1 - (p[2] - V0) / VH); };
  const tri = (p, q, r) => { if (p[1] < -0.3 && q[1] < -0.3 && r[1] < -0.3) return; put(p); put(q); put(r); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const p = P[j * (nx + 1) + i], q = P[j * (nx + 1) + i + 1], r = P[(j + 1) * (nx + 1) + i], s = P[(j + 1) * (nx + 1) + i + 1];
    if ((i + j) % 2) { tri(p, r, q); tri(q, r, s); } else { tri(p, r, s); tri(p, s, q); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, flatShading: true }));
  mesh.receiveShadow = mesh.castShadow = true;
  return mesh;
}

// Agua: un plano con su color según la distancia a la costa (clara junto a la orilla, más honda lejos), una
// franja de espuma que va y viene y algún brillo suelto. Los lagos salen solos: el terreno baja del nivel del mar
function water(T) {
  const data = new Uint8Array(GW * GH * 4);
  for (let i = 0; i < GW * GH; i++) { const v = Math.max(0, Math.min(255, -T.sd[i] * 16)); data[i * 4] = v; data[i * 4 + 3] = 255; }
  const dist = new THREE.DataTexture(data, GW, GH, THREE.RGBAFormat);
  dist.magFilter = dist.minFilter = THREE.LinearFilter;
  dist.flipY = false; dist.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDist: { value: dist }, uBox: { value: new THREE.Vector4(U0, V0, UW, VH) }, uSin: { value: SIN } },
    vertexShader: `varying vec2 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    // (colores en sRGB, tal cual: este material no pasa por la conversión de color)
    fragmentShader: `uniform float uTime, uSin; uniform sampler2D uDist; uniform vec4 uBox; varying vec2 vP;
      void main() {
        vec2 p = vec2(vP.x, vP.y * uSin), uv = (p - uBox.xy) / uBox.zw;
        float d = texture2D(uDist, vec2(uv.x, uv.y)).r * 255.0 / 16.0 + length(max(abs(uv - 0.5) - 0.5, 0.0) * uBox.zw);
        vec3 col = mix(vec3(0.48, 0.84, 0.85), vec3(0.34, 0.64, 0.85), smoothstep(0.5, 5.0, d));
        col = mix(col, vec3(0.27, 0.49, 0.75), smoothstep(5.0, 16.0, d));
        float foam = 1.0 - smoothstep(0.15, 0.9, d);
        float ring = smoothstep(0.55, 1.0, sin(d * 2.6 - uTime * 1.4)) * (1.0 - smoothstep(0.8, 3.6, d));
        col = mix(col, vec3(0.96, 0.99, 1.0), clamp(foam * 0.85 + ring * 0.45, 0.0, 1.0));
        float w = sin(p.x * 0.55 + p.y * 0.21 + uTime * 0.8) * sin(p.y * 0.83 - p.x * 0.17 - uTime * 0.6);
        col += smoothstep(0.86, 0.99, w) * 0.08 * smoothstep(2.0, 6.0, d);
        // Cuadrícula del Town Map, muy suave, en mar abierto
        vec2 gl = abs(fract(p / 10.0) - 0.5);
        col = mix(col, vec3(0.75, 0.88, 1.0), smoothstep(0.465, 0.5, max(gl.x, gl.y)) * 0.18 * smoothstep(3.0, 7.0, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), mat);
  mesh.position.set(80, 0, 60);
  return mesh;
}

// Rutas marinas: rayas claras sobre el agua
function seaRoutes(T) {
  const pos = [];
  for (const l of T.a.sea) for (let i = 1; i < l.length; i++) {
    const [x0, y0] = l[i - 1], [x1, y1] = l[i], ax = x0 * 1.6, bx = x1 * 1.6, len = Math.hypot(bx - ax, y1 - y0);
    const dx = (bx - ax) / len, dy = (y1 - y0) / len, nx = -dy * 0.45, ny = dx * 0.45;
    for (let s = 0.6; s < len - 0.6; s += 3) {
      const e = Math.min(len - 0.6, s + 1.6), p = [ax + dx * s, y0 + dy * s], q = [ax + dx * e, y0 + dy * e];
      const quad = [[p[0] + nx, p[1] + ny], [p[0] - nx, p[1] - ny], [q[0] - nx, q[1] - ny], [q[0] + nx, q[1] + ny]].map(([u, v]) => [u, 0.06, v / SIN]);
      for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...quad[k]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
}

// ---------- Modelos de Kenney ----------
const loader = new GLTFLoader();
const models = new Map();
// Las piezas de un modelo (geometría ya en su sitio y material) y su caja; se cargan una vez por sesión
function model(file) {
  if (!models.has(file)) models.set(file, loader.loadAsync(KENNEY + file).then(gl => {
    gl.scene.updateMatrixWorld(true);
    const parts = [];
    gl.scene.traverse(o => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (file === MODELS.gym) parts.push(...splitRoof(geometry, o.material));
      else parts.push({ geometry, material: o.material });
    });
    return { parts, box: new THREE.Box3().setFromObject(gl.scene) };
  }));
  return models.get(file);
}

// El gimnasio: las caras que miran hacia arriba (el tejado curvo) se separan del resto para pintarlas del
// color del tipo; las demás se quedan con la textura de Kenney
function splitRoof(geometry, material) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry, pos = g.attributes.position, n = pos.count / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), roof = [], rest = [];
  for (let t = 0; t < n; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    (b.sub(a).cross(c.sub(a)).normalize().y > 0.3 ? roof : rest).push(t);
  }
  const pick = tris => {
    const out = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const k = attr.itemSize, arr = new Float32Array(tris.length * 3 * k);
      tris.forEach((t, i) => { for (let j = 0; j < 3 * k; j++) arr[i * 3 * k + j] = attr.array[t * 3 * k + j]; });
      out.setAttribute(name, new THREE.BufferAttribute(arr, k));
    }
    return out;
  };
  return [{ geometry: pick(rest), material }, { geometry: pick(roof), material: null, roof: true }];
}

const MODELS = {
  trees: ['nature-kit/tree_default.glb', 'nature-kit/tree_oak.glb', 'nature-kit/tree_fat.glb'],
  pines: ['nature-kit/tree_pineRoundC.glb', 'nature-kit/tree_pineDefaultA.glb'],
  palm: 'nature-kit/tree_palmTall.glb',
  rocks: ['nature-kit/rock_tallA.glb', 'nature-kit/rock_tallB.glb'], boulder: 'nature-kit/rock_largeD.glb',
  gym: 'city-kit-industrial/building-j.glb',
  league: 'city-kit-commercial/building-skyscraper-c.glb',
};

// Dónde va cada modelo: listas de { file, m (Matrix4), color? } que luego se instancian juntas
function placements(T) {
  const { a, R, H, S } = T, r = rng(31337), out = [];
  const nodes = R.nodes.map(n => [n.x * 1.6, n.y]);
  const put = (file, u, v, scale, rotY = r() * Math.PI * 2, y = H(u, v), color) => {
    if (T.league && Math.hypot(u - T.league.u, v - T.league.v) < 10) return;   // la explanada de la Liga, despejada
    const m = new THREE.Matrix4().compose(W(u, v, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(scale, scale, scale));
    out.push({ file, m, color });
  };
  const pick = l => l[Math.floor(r() * l.length)];
  const roadD = (u, v) => lineDist(u, v, a.roads);
  const nodeD = (u, v) => Math.min(...nodes.map(([x, y]) => Math.hypot(u - x, v - y)));
  const cityD = (u, v) => Math.min(...a.cities.map(([, x, y, s]) => Math.hypot(u - x * 1.6, v - y) - s * 0.35));
  const inMount = (u, v) => a.mountains.some(([mx, my, k]) => Math.hypot((u - mx * 1.6) / (9 * k), (v - my - 1) / (6 * k)) < 0.85);
  // La Liga: un rascacielos alto del City Kit Commercial junto a la Meseta Añil. Va donde haya sitio junto a su nodo, sin taparlo; se guarda en T para no poner
  // árboles al lado
  const plateau = a.cities.find(([name]) => /Meseta|Liga/.test(name));
  if (plateau) {
    const x = plateau[1] * 1.6, best = { score: -Infinity };
    for (const [du, dv, bonus] of [[12, 9, 1], [12, 3, 0.5], [-12, 3, 0.4], [-12, -4, 0.2], [0, -8, 0]]) {
      const u = x + du, v = plateau[2] + dv;
      const score = Math.min(S(u, v) - 6, roadD(u, v) - 3, nodeD(u, v) - 7) + bonus;
      if (score > best.score) Object.assign(best, { score, u, v });
    }
    const nudge = REGION_STYLE[T.region]?.league;
    if (nudge) { best.u += nudge[0]; best.v += nudge[1]; }
    T.league = best;
    out.push({ stack: [MODELS.league], u: best.u, v: best.v, scale: LEAGUE.scale });
  }
  // Bosques: pinos y árboles apretados
  for (const [x, y, n] of a.forests) for (let i = 0; i < n * 9; i++) {
    const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * n * 1.05, u = x * 1.6 + Math.cos(ang) * d * 1.7, v = y + Math.sin(ang) * d * 1.2 + 1.5;
    if (S(u, v) < 1.4 || roadD(u, v) < 2 || nodeD(u, v) < 3 || cityD(u, v) < 3) continue;
    put(r() < 0.6 ? pick(MODELS.pines) : pick(MODELS.trees), u, v, 4.2 + r() * 1.6);
  }
  // Montes: agujas de roca en las cumbres y alguna peña en las faldas
  for (const [x, y, k] of a.mountains) {
    for (let i = 0; i < 5; i++) { const u = x * 1.6 + (r() - 0.5) * 8 * k, v = y + 1 + (r() - 0.5) * 3 * k; if (nodeD(u, v) > 3 && roadD(u, v) > 2) put(pick(MODELS.rocks), u, v, (3.6 + r() * 1.8) * k, undefined, H(u, v) - 0.4); }
    for (let i = 0; i < 2; i++) { const ang = r() * Math.PI * 2, u = x * 1.6 + Math.cos(ang) * 8 * k, v = y + 1 + Math.sin(ang) * 5 * k; if (S(u, v) > 1.5 && nodeD(u, v) > 3 && roadD(u, v) > 2) put(MODELS.boulder, u, v, 3 + r() * 1.5, undefined, H(u, v) - 0.2); }
  }
  // Gimnasios: apartados de su medalla (para que no los tape) hacia donde haya sitio: detrás si se puede, si
  // no a un lado; lejos de caminos, nodos, montes, costa y la Liga. Se guardan en T para el emblema (buildings)
  const gyms = R.nodes.filter(n => n.kind === 'gym' && n.index < Data.LEAGUE_FROM);
  T.gymSpots = gyms.map(n => {
    const x = n.x * 1.6, best = { score: -Infinity };
    for (const [du, dv, bonus] of [[0, -9, 1], [-9.5, -6.5, 0.5], [9.5, -6.5, 0.5], [-11.5, -1, 0], [11.5, -1, 0]]) {
      const u = x + du, v = n.y + dv;
      if (inMount(u, v)) continue;
      const score = Math.min(roadD(u, v) - 2, nodeD(u, v) - 5, S(u, v) - 4, T.league ? Math.hypot(u - T.league.u, v - T.league.v) - 8 : 9) + bonus;
      if (score > best.score) Object.assign(best, { score, u, v });
    }
    return { u: best.u, v: best.v, type: n.type };
  });
  for (const g of T.gymSpots) out.push({ gym: true, u: g.u, v: g.v, color: new THREE.Color(Data.TYPE_COLOR[g.type] || '#cccccc') });
  // Las ciudades son solo su losa roja, como en el Town Map: sin casas
  const houses = T.gymSpots.map(g => [g.u, g.v]);
  // Árboles sueltos por el campo y palmeras en la costa
  for (let i = 0, placed = 0; i < 1500 && placed < 90; i++) {
    const u = r() * 160, v = 2 + r() * 98, s = S(u, v);
    if (s < 1.2 || roadD(u, v) < 2.4 || nodeD(u, v) < 3.4 || cityD(u, v) < 4 || inMount(u, v) || houses.some(([hu, hv]) => Math.hypot(u - hu, v - hv) < 2.4)) continue;
    if (a.forests.some(([fx, fy, n]) => Math.hypot((u - fx * 1.6) / (n * 1.9 + 1), (v - fy) / (n * 1.4 + 1)) < 1)) continue;
    placed++;
    if (s < 3.2) { if (r() < 0.7) put(MODELS.palm, u, v, 3.6 + r() * 1.2); continue; }
    put(r() < 0.35 ? pick(MODELS.pines) : pick(MODELS.trees), u, v, 3.6 + r() * 1.4);
  }
  return out;
}

// Lo que no es de Kenney: las losas rojas de las ciudades (las marcas del Town Map), el emblema de los
// gimnasios
function buildings(T) {
  const { a } = T, group = new THREE.Group(), box = new THREE.BoxGeometry(1, 1, 1);
  const lambert = c => new THREE.MeshLambertMaterial({ color: c });
  const at = (mesh, u, v, y, sx, sy, sz) => { mesh.position.copy(W(u, v, y + sy / 2)); mesh.scale.set(sx, sy, sz / SIN); mesh.castShadow = mesh.receiveShadow = true; return mesh; };
  // Losas: borde claro, losa roja y su brillo, del tamaño de los cuadros del SVG. Instanciadas (todas iguales)
  const slabs = [[TOWN.rim, 1, 1, 0, 0.32], [TOWN.red, 0, 0, 0.32, 0.5], [TOWN.shine, -0.9, -1, 0.82, 0.06]];
  for (const [color, gw, gd, y0, hgt] of slabs) {
    const im = new THREE.InstancedMesh(box, lambert(color), a.cities.length), m = new THREE.Matrix4();
    a.cities.forEach(([, x, y, size], i) => {
      const w = 2.6 + size * 0.55, d = 1.9 + size * 0.32;
      // el brillo, una franja arriba (al fondo) de la losa, como en el SVG
      const dv = gd < 0 ? -d * 0.22 : 0, dd = gd < 0 ? d * 0.32 : d + gd;
      m.compose(W(x * 1.6, y + dv, LAND + y0 + hgt / 2), new THREE.Quaternion(), new THREE.Vector3(w + gw, hgt, dd / SIN));
      im.setMatrixAt(i, m);
    });
    im.castShadow = im.receiveShadow = true;
    group.add(im);
  }
  // Emblema de cada gimnasio: el icono de su tipo, grande, sobre la puerta y de cara a la cámara
  const icons = new THREE.TextureLoader();
  for (const g of T.gymSpots) {
    const tex = icons.load(`types/${g.type}.png`, () => render());
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.copy(W(g.u, g.v, LAND + GYM_SIGN[1])).add(new THREE.Vector3(0, 0, GYM_SIGN[0]));
    sign.rotation.x = -TILT;   // de cara a la cámara, para que no se vea aplastado
    group.add(sign);
  }
  return group;
}

// ---------- Escenas por región, en caché ----------
// Cada región se monta una vez (terreno, agua, losas, modelos) y se guarda: volver a Historia o cambiar de región
// no recalcula nada. Se precargan cuando el navegador está libre, poco después de arrancar
const scenes = new Map(), built = new Map();   // región → promesa de la escena / escena ya lista
const idle = () => new Promise(r => (window.requestIdleCallback || setTimeout)(() => r(), { timeout: 800 }));
const loadModels = () => Promise.all(Object.values(MODELS).flat().map(async f => [f, await model(f)]))
  .then(Object.fromEntries, e => { console.warn('map3d: no se cargan los modelos', e); return null; });

function sceneFor(region) {
  if (!scenes.has(region)) scenes.set(region, buildScene(region).then(e => { built.set(region, e); return e; }, e => { scenes.delete(region); throw e; }));
  return scenes.get(region);
}

async function buildScene(region) {
  const loading = loadModels();   // los modelos se piden ya, y mientras llegan se calcula el terreno
  await idle();
  const t0 = performance.now();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d6e2', 2));
  const sun = new THREE.DirectionalLight('#fff6e8', 1.8);
  sun.position.set(80 - 60, 120, 60 - 50);
  sun.target.position.set(80, 0, 60);
  sun.castShadow = true;
  const mobile = matchMedia('(pointer: coarse)').matches;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 400 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  const T = terrain(region), wat = water(T), list = placements(T);
  scene.add(terrainMesh(T, groundTexture(T)), wat, seaRoutes(T), buildings(T));
  const ms = Math.round(performance.now() - t0);
  const loaded = await loading;
  if (loaded) instance(scene, region, list, loaded);
  return { region, scene, water: wat, T, ms };
}

// Precarga de las dos regiones, de una en una y cuando no molesta (si no hay WebGL, ni se intenta)
if (typeof window !== 'undefined' && window.WebGLRenderingContext) {
  setTimeout(() => idle().then(() => sceneFor('kanto')).then(idle).then(() => sceneFor('johto')).catch(() => {}), 2500);
}

// ---------- El visor: un solo renderer, que se engancha al mapa que se esté viendo ----------
let V = null;
const GONE_MS = 90000;   // fuera de Historia más de esto, se libera el renderer (las escenas se quedan)
const WAIT_MS = 4000;    // si el 3D no está en este tiempo, se ve el SVG de respaldo hasta que llegue

// view_story la llama cada vez que pinta el mapa (aún sin meterlo en la página): engancha el lienzo y enseña la
// escena de la región; si ya está montada, sale al instante. Sin WebGL o si falla, el SVG de respaldo
let noGL = false;   // el renderer no se pudo crear: ya no se vuelve a intentar
export function mountMap3D(map, stage, region) {
  if (!V && !noGL) V = viewer();
  if (!V) noGL = true;
  if (!V || !REGION_ART[region]) return fallback(map, stage, region);
  Object.assign(V, { map, stage, region, goneAt: 0, shown: null });
  map.prepend(V.canvas);
  if (V.ro) V.ro.disconnect();
  V.ro = new ResizeObserver(() => { if (V && V.shown && layout()) render(); });   // (tras maquetar y antes de pintar)
  V.ro.observe(map);
  clearTimeout(V.waitTimer);
  if (built.has(region)) return show(built.get(region));
  map.classList.add('map3d-wait');   // fondo del color del mar y un indicador mientras se monta
  V.waitTimer = setTimeout(() => { if (V && V.map === map && !V.shown) fallback(map, stage, region); }, WAIT_MS);
  sceneFor(region).then(e => { if (V && V.map === map && V.region === region) show(e); }, err => {
    console.warn('map3d: no se puede montar el mapa', err);
    fallback(map, stage, region);
  });
}

// El SVG de siempre, por si el 3D no puede ser
function fallback(map, stage, region) {
  map.classList.remove('map3d-wait');
  if (!stage.querySelector('.mapart') && REGION_ART[region]) stage.insertAdjacentHTML('afterbegin', regionMapSVG(region));
}

function viewer() {
  const canvas = document.createElement('canvas');
  canvas.className = 'map3d-canvas';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch { return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(C.sea);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // la maqueta no se mueve: las sombras se calculan al cambiar de escena
  const camera = new THREE.OrthographicCamera(-80, 80, 50, -50, 1, 900);
  const target = W(80, 50);
  camera.position.copy(target).add(new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT)).multiplyScalar(400));
  camera.lookAt(target);
  const v = { canvas, renderer, camera, visible: true, calm: matchMedia('(prefers-reduced-motion: reduce)').matches, goneAt: 0 };
  v.io = new IntersectionObserver(([e]) => { v.visible = e.isIntersecting; });
  v.io.observe(canvas);
  v.timer = setTimeout(tick, 1000 / FPS);
  return v;
}

function show(entry) {
  clearTimeout(V.waitTimer);
  if (V.shown !== entry) V.renderer.shadowMap.needsUpdate = true;
  V.shown = entry;
  V.map.classList.remove('map3d-wait');
  V.map.classList.add('map3d-on');
  // (los nodos los pone view_story después de llamar a mountMap3D: se colocan en cuanto acaba, antes de pintar)
  queueMicrotask(() => { if (V && V.shown === entry) placeNodes(); });
  if (V.canvas.isConnected && layout()) render();
}

// Una InstancedMesh por pieza de modelo con todas sus copias; los materiales, compartidos por nombre
function instance(scene, region, list, loaded) {
  const snow = REGION_STYLE[region]?.snow, mats = new Map(), roofMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const mat = src => {
    const key = src && src.name + (src.map ? src.map.uuid : '');
    if (!src) return roofMat;   // el tejado del gimnasio: blanco, y el color del tipo va en cada copia
    if (!mats.has(key)) mats.set(key, src.map ? new THREE.MeshLambertMaterial({ map: src.map }) : new THREE.MeshLambertMaterial({ color: snow && src.name === 'grass' ? '#eef2f5' : MAT_COLOR[src.name] || src.color }));
    return mats.get(key);
  };
  const groups = new Map();   // archivo → [{ m, color }]
  const add = (file, m, color) => { if (!groups.has(file)) groups.set(file, []); groups.get(file).push({ m, color }); };
  for (const p of list) {
    if (p.gym) {
      // Gimnasio: centrado en su sitio (el modelo tiene el origen en una esquina) y con la puerta hacia la cámara
      const c = loaded[MODELS.gym].box.getCenter(new THREE.Vector3());
      const m = new THREE.Matrix4().compose(W(p.u, p.v, LAND), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), GYM_ROT), new THREE.Vector3(...GYM_SCALE));
      add(MODELS.gym, m.multiply(new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z)), p.color);
      continue;
    }
    if (!p.stack) { add(p.file, p.m, p.color); continue; }
    // Piezas apiladas (cada una encima de la anterior), posadas en el llano
    let y = LAND;
    for (const f of p.stack) {
      add(f, new THREE.Matrix4().compose(W(p.u, p.v, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot || 0), new THREE.Vector3(p.scale, p.scale, p.scale)), p.color);
      const box = loaded[f].box;
      y += (box.max.y - box.min.y) * p.scale;
    }
  }
  for (const [file, items] of groups) {
    for (const part of loaded[file].parts) {
      const im = new THREE.InstancedMesh(part.geometry, mat(part.material), items.length);
      // (en el gimnasio, el color del tipo solo va en el tejado)
      const colored = items.some(x => x.color) && (file !== MODELS.gym || part.roof);
      items.forEach(({ m, color }, i) => { im.setMatrixAt(i, m); if (colored) im.setColorAt(i, color || new THREE.Color('#ffffff')); });
      im.castShadow = im.receiveShadow = true;
      scene.add(im);
    }
  }
}

// Los nodos HTML sobre la maqueta: los bloqueados que caen sobre una losa, apartados; y el de la Liga, encima de
// su rascacielos. Guardan su sitio original, así que repetirlo sobre el mismo mapa no los mueve más
function placeNodes() {
  const { stage, shown } = V, cities = REGION_ART[shown.region].cities;
  for (const b of stage.querySelectorAll('.node.locked:not(.league-hq)')) {
    const x = +(b.dataset.x0 ?? parseFloat(b.style.left)), y = +(b.dataset.y0 ?? parseFloat(b.style.top));
    b.dataset.x0 = x; b.dataset.y0 = y;
    // (a la esquina de arriba a la derecha de la losa: los caminos salen por los lados, no por las esquinas)
    const c = cities.find(([, cx, cy, size]) => Math.abs(cx - x) * 1.6 < (2.6 + size * 0.55) / 2 + 1 && Math.abs(cy - y) < (1.9 + size * 0.32) / 2 + 1);
    if (!c) continue;
    const [, cx, cy, size] = c;
    b.style.left = (cx + ((2.6 + size * 0.55) / 2 + 1.6) / 1.6) + '%';
    b.style.top = (cy - (1.9 + size * 0.32) / 2 - 1.8) + '%';
  }
  // La Liga: el nodo, transparente y del tamaño del rascacielos, queda encima de él; las líneas
  // al siguiente reto que iban a la Meseta van al edificio
  const hq = stage.querySelector('.node.league-hq'), L = shown.T.league;
  if (hq && L) {
    const x0 = +(hq.dataset.x0 ?? parseFloat(hq.style.left)), y0 = +(hq.dataset.y0 ?? parseFloat(hq.style.top));
    hq.dataset.x0 = x0; hq.dataset.y0 = y0;
    const h = (LEAGUE.height * LEAGUE.scale + 1) * Math.cos(TILT), x = L.u / 1.6, y = L.v - h / 2;
    hq.style.left = x + '%'; hq.style.top = y + '%';
    hq.style.setProperty('width', (1.36 * LEAGUE.scale + 1) / 1.6 + '%', 'important');
    hq.style.setProperty('height', h + 1 + '%', 'important');
    for (const l of stage.querySelectorAll('.paths .leg.goal')) {
      if (Math.abs(+l.getAttribute('x2') - x0) < 0.01 && Math.abs(+l.getAttribute('y2') - y0) < 0.01) { l.setAttribute('x2', x); l.setAttribute('y2', L.v - h * 0.3); }
    }
  }
}

// La cámara encaja el rectángulo del lienzo (160 x 100) en el de .map-stage; lo que sobra alrededor es mar
function layout() {
  const c = V.canvas, cr = c.getBoundingClientRect(), sr = V.stage.getBoundingClientRect();
  if (!cr.width || !sr.width || !c.clientWidth) return false;
  V.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  V.renderer.setSize(c.clientWidth, c.clientHeight, false);
  const kx = 160 / sr.width, ky = 100 / sr.height, cam = V.camera;
  cam.left = -80 - (sr.left - cr.left) * kx; cam.right = cam.left + cr.width * kx;
  cam.top = 50 + (sr.top - cr.top) * ky; cam.bottom = cam.top - cr.height * ky;
  cam.updateProjectionMatrix();
  return true;
}

function render() { if (V && V.shown) V.renderer.render(V.shown.scene, V.camera); }

// Cada 1/8 s el agua da un paso (si se ve). Fuera de Historia mucho rato, el renderer se libera
function tick() {
  if (!V) return;
  if (!V.canvas.isConnected) {
    if (!V.goneAt) V.goneAt = performance.now();
    else if (performance.now() - V.goneAt > GONE_MS) return release();
  } else if (V.shown && !V.calm && V.visible && !document.hidden) {
    V.shown.water.material.uniforms.uTime.value = performance.now() / 1000;
    render();
  }
  V.timer = setTimeout(tick, 1000 / FPS);
}

// Libera el renderer y su contexto WebGL. Las escenas siguen en memoria: el siguiente renderer las vuelve a subir
function release() {
  const v = V;
  V = null;
  clearTimeout(v.timer); clearTimeout(v.waitTimer);
  if (v.ro) v.ro.disconnect();
  v.io.disconnect();
  v.renderer.dispose();
  v.renderer.forceContextLoss();
  v.canvas.remove();
}
