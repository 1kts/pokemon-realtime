// Escena 3D de la arena: luces, suelo, decorado, terreno dinámico (hierba alta, fuego, agua,
// vapor, quemado) y obstáculos. 1 unidad 3D = 40 px de juego (una celda).
import * as THREE from 'three';

const { CELL, COLS, ROWS, T } = Shared;
export const U = 1 / CELL;                  // px de juego -> unidades 3D
export const toWorld = (x, y, h = 0) => new THREE.Vector3(x * U, h, y * U);

// Generador pseudoaleatorio con semilla (el decorado sale igual en todos los clientes)
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}

// Césped pintado: base con manchas, briznas y alguna flor.
function grassTexture(seed) {
  return canvasTexture(1024, 640, (g, w, h) => {
    const r = rng(seed);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6aa847'); grad.addColorStop(1, '#5c9a3e');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '120,180,80' : '70,130,50'},${0.15 + r() * 0.2})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 12 + r() * 40, r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 6;
      g.strokeStyle = `rgba(${r() < 0.5 ? '150,205,95' : '60,115,40'},${0.35 + r() * 0.4})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h;
      g.fillStyle = ['#fff6e0', '#ffd84a', '#ff9ec0', '#c8a8ff'][(r() * 4) | 0];
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 2.2, y + Math.sin(k * 1.26) * 2.2, 1.7, 0, 7); g.fill(); }
      g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill();
    }
    // Líneas del campo
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 5;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 80, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 10, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  });
}

function dirtTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#4c7a35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '90,140,60' : '50,90,35'},0.5)`;
      g.fillRect(r() * w, r() * h, 2, 3 + r() * 3);
    }
  }, 8);
}

// Briznas de hierba alta (textura con transparencia para planos cruzados)
function bladeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const x = 8 + r() * (w - 16), top = 10 + r() * 50, bend = (r() - 0.5) * 30;
      const grad = g.createLinearGradient(0, h, 0, top);
      grad.addColorStop(0, '#2f6e23'); grad.addColorStop(1, r() < 0.3 ? '#b8e070' : '#7cc24a');
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(x - 4, h); g.quadraticCurveTo(x + bend * 0.5, (h + top) / 2, x + bend, top); g.quadraticCurveTo(x + bend * 0.4, (h + top) / 2, x + 4, h); g.fill();
    }
  });
}

export function softDisc(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(64, 64, (g, w) => {
    const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grad.addColorStop(0, inner); grad.addColorStop(1, outer);
    g.fillStyle = grad; g.fillRect(0, 0, w, w);
  });
}

export class World {
  constructor(renderer) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9cc8ec');
    this.scene.fog = new THREE.Fog('#9cc8ec', 28, 60);
    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 120);
    this.renderer = renderer;
    this.time = 0;
    this.bladeTex = bladeTexture();
    this.steamTex = softDisc('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');
    this.lights();
    this.ground();
    this.decor();
    this.cells = new Array(COLS * ROWS).fill(null);
    this.types = new Array(COLS * ROWS).fill(T.NONE);
    this.paintLayer();
    this.obstacles = new Map();
    this.rocks = [];
    this.fireLight = new THREE.PointLight('#ff8030', 0, 9, 1.6);
    this.fireLight.position.y = 1.2;
    this.scene.add(this.fireLight);
    this.placeCamera(16 / 9);
  }

  placeCamera(aspect) {
    // Cámara inclinada estilo Battlerite; más alta si la ventana es estrecha
    const cx = COLS / 2, cz = ROWS / 2;
    const fit = Math.max(1, 1.62 / aspect);
    this.camera.aspect = aspect;
    this.camera.position.set(cx, 17.5 * fit, cz + 11.5 * fit);
    this.camera.lookAt(cx, 0, cz + 0.6);
    this.camera.updateProjectionMatrix();
  }

  lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#d8ecff', '#4a6a30', 1.15));
    const sun = new THREE.DirectionalLight('#fff0d8', 2.3);
    sun.position.set(COLS / 2 - 7, 16, ROWS / 2 - 5);
    sun.target.position.set(COLS / 2, 0, ROWS / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 50 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);
    this.sun = sun;
  }

  ground() {
    const arena = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({ map: grassTexture(3), roughness: 0.95 }));
    arena.rotation.x = -Math.PI / 2;
    arena.position.set(COLS / 2, 0, ROWS / 2);
    arena.receiveShadow = true;
    this.scene.add(arena);
    this.arena = arena;
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1 }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(COLS / 2, -0.02, ROWS / 2);
    outside.receiveShadow = true;
    this.scene.add(outside);
    // Bordillo de piedra alrededor de la arena
    const stone = new THREE.MeshStandardMaterial({ color: '#b8b0a0', roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: '#8e8678', roughness: 0.9 });
    const r = rng(9);
    const curb = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32 + r() * 0.06, d), r() < 0.5 ? stone : dark);
      m.position.set(x, 0.16, z);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    };
    for (let x = -0.25; x < COLS + 0.5; x += 1) { curb(x + 0.5, -0.25, 0.96, 0.5); curb(x + 0.5, ROWS + 0.25, 0.96, 0.5); }
    for (let z = 0.25; z < ROWS; z += 1) { curb(-0.25, z + 0.5, 0.5, 0.96); curb(COLS + 0.25, z + 0.5, 0.5, 0.96); }
  }

  decor() {
    const r = rng(42);
    const trunk = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 1 });
    const leaves = ['#3f7f35', '#4a8f3a', '#356f2c', '#5a9a40'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
    const rockMat = new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.95, flatShading: true });
    const place = (x, z) => {
      if (x > -1.2 && x < COLS + 1.2 && z > -1.2 && z < ROWS + 1.2) return;
      const k = r();
      const g = new THREE.Group();
      if (k < 0.62) {          // árbol
        const h = 1.2 + r() * 1.2;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 6), trunk);
        t.position.y = h / 2; g.add(t);
        for (let i = 0; i < 3; i++) {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 - i * 0.18 + r() * 0.2, 0), leaves[(r() * 4) | 0]);
          f.position.set((r() - 0.5) * 0.4, h + i * 0.55, (r() - 0.5) * 0.4);
          g.add(f);
        }
      } else if (k < 0.85) {   // arbusto
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + r() * 0.25, 0), leaves[(r() * 4) | 0]);
          b.position.set((r() - 0.5) * 0.7, 0.25, (r() - 0.5) * 0.7);
          g.add(b);
        }
      } else {                 // roca
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + r() * 0.4, 0), rockMat);
        b.position.y = 0.2; b.rotation.set(r() * 3, r() * 3, r() * 3);
        g.add(b);
      }
      g.position.set(x, 0, z);
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(g);
    };
    for (let i = 0; i < 260; i++) place(-14 + r() * (COLS + 28), -12 + r() * (ROWS + 24));
  }

  // Agua, fuego y suelo quemado se pintan en una capa sobre el suelo (formas orgánicas que se
  // funden entre casillas); el fuego además brilla con su propio mapa emisivo.
  paintLayer() {
    const P = 32;
    this.paintPx = P;
    const mk = () => { const c = document.createElement('canvas'); c.width = COLS * P; c.height = ROWS * P; return c; };
    this.paintCanvas = mk(); this.fireCanvas = mk(); this.waterCanvas = mk();
    const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    this.paintTex = tex(this.paintCanvas); this.fireTex = tex(this.fireCanvas);
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshStandardMaterial({
      map: this.paintTex, emissiveMap: this.fireTex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6,
      transparent: true, roughness: 0.55, metalness: 0.02, depthWrite: false,
    }));
    this.overlay.rotation.x = -Math.PI / 2;
    this.overlay.position.set(COLS / 2, 0.02, ROWS / 2);
    this.overlay.receiveShadow = true;
    this.scene.add(this.overlay);
    this.paintDirty = true;
  }

  redrawPaint() {
    this.paintDirty = false;
    const P = this.paintPx;
    const g = this.paintCanvas.getContext('2d'), f = this.fireCanvas.getContext('2d'), w = this.waterCanvas.getContext('2d');
    for (const c of [g, f, w]) c.clearRect(0, 0, COLS * P, ROWS * P);
    const blob = (c, i, r, inner, outer) => {
      const x = (i % COLS) * P + P / 2, y = Math.floor(i / COLS) * P + P / 2;
      const grad = c.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, inner); grad.addColorStop(1, outer);
      c.fillStyle = grad;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    w.fillStyle = '#3a7fd6';
    for (let i = 0; i < this.types.length; i++) {
      const t = this.types[i];
      const x = (i % COLS) * P, y = Math.floor(i / COLS) * P;
      if (t === T.BURNT) blob(g, i, P * 0.85, 'rgba(38,30,20,0.85)', 'rgba(38,30,20,0)');
      else if (t === T.FIRE) {
        blob(g, i, P * 0.8, 'rgba(60,30,10,0.8)', 'rgba(60,30,10,0)');
        blob(f, i, P * 0.75, 'rgba(255,140,40,1)', 'rgba(255,60,0,0)');
      } else if (t === T.WATER) {
        w.fillRect(x + 3, y + 3, P - 6, P - 6);
        w.beginPath(); w.arc(x + P / 2, y + P / 2, P * 0.66, 0, Math.PI * 2); w.fill();
      }
    }
    // Agua: unión opaca de todas las casillas, luego un brillo interior, y se compone con transparencia
    w.globalCompositeOperation = 'source-atop';
    const shine = w.createLinearGradient(0, 0, 0, ROWS * P);
    shine.addColorStop(0, 'rgba(150,210,255,0.35)'); shine.addColorStop(1, 'rgba(20,60,140,0.25)');
    w.fillStyle = shine; w.fillRect(0, 0, COLS * P, ROWS * P);
    w.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.88;
    g.drawImage(this.waterCanvas, 0, 0);
    g.globalAlpha = 1;
    this.paintTex.needsUpdate = true;
    this.fireTex.needsUpdate = true;
  }

  // ---------- Mapa y terreno ----------
  loadMap(mapName, terrain) {
    for (const o of this.rocks) this.scene.remove(o);
    this.rocks = [];
    for (let i = 0; i < this.cells.length; i++) this.setCell(i, T.NONE);
    for (const [, o] of this.obstacles) this.scene.remove(o.mesh);
    this.obstacles.clear();
    const { rocks } = Shared.parseMap(mapName);
    this.mapRocks = rocks;
    const mat = new THREE.MeshStandardMaterial({ color: '#9a948a', roughness: 0.9, flatShading: true });
    const r = rng(mapName.length * 77);
    for (const rk of rocks) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rk.r * U * 1.15, 0), mat);
      m.position.copy(toWorld(rk.x, rk.y, rk.r * U * 0.7));
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.scale.y = 0.85;
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.rocks.push(m);
    }
    terrain.forEach((t, i) => this.setCell(i, t));
  }

  setCell(i, type) {
    if (this.types[i] === type && (this.cells[i] || ![T.GRASS, T.STEAM].includes(type))) return;
    const old = this.cells[i];
    if (old) { this.scene.remove(old); old.traverse(o => { if (o.geometry && o.userData.own) o.geometry.dispose(); }); }
    this.cells[i] = null;
    if (this.types[i] !== type && ([T.WATER, T.FIRE, T.BURNT].includes(type) || [T.WATER, T.FIRE, T.BURNT].includes(this.types[i]))) this.paintDirty = true;
    this.types[i] = type;
    const cx = (i % COLS) + 0.5, cz = Math.floor(i / COLS) + 0.5;
    let g = null;
    if (type === T.GRASS) {
      g = new THREE.Group();
      const mat = this.grassMat || (this.grassMat = new THREE.MeshLambertMaterial({ map: this.bladeTex, alphaTest: 0.4, side: THREE.DoubleSide }));
      const geo = this.grassGeo || (this.grassGeo = new THREE.PlaneGeometry(0.75, 0.75).translate(0, 0.37, 0));
      for (let k = 0; k < 4; k++) {
        const tuft = new THREE.Group();
        for (let j = 0; j < 2; j++) {
          const p = new THREE.Mesh(geo, mat);
          p.rotation.y = j * Math.PI / 2 + k;
          p.castShadow = true;
          tuft.add(p);
        }
        tuft.position.set(cx + ((k % 2) - 0.5) * 0.45, 0, cz + ((k >> 1) - 0.5) * 0.45);
        tuft.scale.setScalar(0.9 + ((i * 7 + k * 3) % 5) * 0.06);
        tuft.userData.phase = i * 0.7 + k;
        g.add(tuft);
      }
      g.userData.sway = true;
    } else if (type === T.STEAM) {
      g = new THREE.Group();
      const mat = this.steamMat || (this.steamMat = new THREE.SpriteMaterial({ map: this.steamTex, transparent: true, opacity: 0.75, depthWrite: false, color: '#f4f8ff' }));
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(mat);
        sp.scale.setScalar(1.5 + k * 0.3);
        sp.position.set(cx + (k - 1) * 0.3, 0.5 + k * 0.35, cz + ((k * 5) % 3 - 1) * 0.2);
        sp.userData.phase = i + k * 2;
        g.add(sp);
      }
      g.userData.steam = true;
    }
    if (g) { this.scene.add(g); this.cells[i] = g; }
  }


  // ---------- Obstáculos dinámicos (Barrera, Tumba Rocas) ----------
  syncObstacles(list) {
    const seen = new Set();
    for (const o of list) {
      seen.add(o.id);
      if (this.obstacles.has(o.id)) continue;
      let mesh;
      if (o.k === 'barrier') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.r * U, o.r * U, 1.1, 6, 1, true),
          new THREE.MeshBasicMaterial({ color: '#ff8cc8', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
        mesh.position.copy(toWorld(o.x, o.y, 0.55));
      } else {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * U * 1.1, 0), new THREE.MeshStandardMaterial({ color: '#a08868', roughness: 0.9, flatShading: true }));
        mesh.position.copy(toWorld(o.x, o.y, -0.6));
        mesh.userData.rise = true;
        mesh.castShadow = mesh.receiveShadow = true;
      }
      this.scene.add(mesh);
      this.obstacles.set(o.id, { mesh, data: o });
    }
    for (const [id, o] of this.obstacles) if (!seen.has(id)) { this.scene.remove(o.mesh); o.mesh.geometry.dispose(); this.obstacles.delete(id); }
  }

  // Obstáculos para la predicción de movimiento (rocas del mapa + dinámicos)
  collisionList() {
    return [...(this.mapRocks || []), ...[...this.obstacles.values()].map(o => o.data)];
  }

  update(dt, particles) {
    this.time += dt;
    const t = this.time;
    if (this.paintDirty) this.redrawPaint();
    let fx = 0, fz = 0, fires = 0;
    for (let i = 0; i < this.types.length; i++) {
      const c = this.cells[i];
      if (c && c.userData.sway) for (const tuft of c.children) tuft.rotation.z = Math.sin(t * 1.8 + tuft.userData.phase) * 0.06;
      else if (c && c.userData.steam) for (const s of c.children) {
        s.position.y = 0.5 + Math.sin(t * 0.8 + s.userData.phase) * 0.15 + s.userData.phase % 1;
        s.material.rotation = t * 0.1;
      } else if (this.types[i] === T.FIRE) {
        const x = (i % COLS) + 0.5, z = Math.floor(i / COLS) + 0.5;
        fires++; fx += x; fz += z;
        particles.trickle(16, dt, x, 0.1, z, { colors: ['#fff6a0', '#ffc040', '#ff7a20', '#ff4010'], layer: 'glow', dir: [0, 1, 0], spread: 0.25, speed: 1.6, life: 0.7, size: 0.55, jitter: 0.8 });
        particles.trickle(3, dt, x, 0.6, z, { colors: ['#555', '#666', '#777'], layer: 'soft', dir: [0, 1, 0], spread: 0.2, speed: 0.8, life: 1.6, size: 0.9, grow: 1.5, alpha: 0.35, jitter: 0.6 });
      }
    }
    this.overlay.material.emissiveIntensity = 1.3 + Math.sin(t * 13) * 0.3;
    this.fireLight.intensity = fires ? Math.min(6, 1.5 + fires * 0.4) * (0.85 + Math.sin(t * 17) * 0.15) : 0;
    if (fires) this.fireLight.position.set(fx / fires, 1.2, fz / fires);
    for (const [, o] of this.obstacles) if (o.mesh.userData.rise && o.mesh.position.y < o.data.r * U * 0.6) o.mesh.position.y += dt * 6;
  }
}
