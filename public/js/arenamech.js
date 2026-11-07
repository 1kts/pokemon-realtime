// Lo que se ve de las mecánicas nuevas de las arenas (server/arena.js): cintas transportadoras, bancos de niebla,
// espejos, flores y el pozo de gravedad. Todo mate y sólido, como el decorado (ver .claude/skills/arenas-3d): lo que
// brilla son los ataques. Devuelve funciones de animación (dt, t) que World llama en cada fotograma.
import * as THREE from 'three';

const { CELL, COLS, ARENA } = Shared;
const U = 1 / CELL;

// Textura de una cinta: goma oscura con flechas amarillas apagadas (se desplaza con offset)
function beltTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2c2e33'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#3a3d44'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 3, 64);
  g.fillStyle = '#c9a43a';
  for (const x0 of [16, 80]) { g.beginPath(); g.moveTo(x0, 14); g.lineTo(x0 + 22, 32); g.lineTo(x0, 50); g.lineTo(x0 + 10, 50); g.lineTo(x0 + 32, 32); g.lineTo(x0 + 10, 14); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Nube blanda para la niebla (degradado radial)
let puffTex = null;
function puff() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

// Arenas movedizas: arena más oscura que el suelo, con un remolino de surcos (todo mate)
let sandTex = null;
function sandTexture() {
  if (sandTex) return sandTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, '#8a6a3c'); gr.addColorStop(0.7, '#a8844c'); gr.addColorStop(1, 'rgba(176,140,84,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80,58,30,0.55)'; g.lineWidth = 3;
  for (let k = 0; k < 3; k++) {   // tres surcos en espiral hacia el centro
    g.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.08) { const r = 54 - a * 4.6, x = 64 + Math.cos(a + k * 2.09) * r, y = 64 + Math.sin(a + k * 2.09) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  sandTex = new THREE.CanvasTexture(c); sandTex.colorSpace = THREE.SRGBColorSpace;
  return sandTex;
}

// Parachoques (obstáculo 'bumper'): seta de pinball mate, roja y blanca, con su base oscura
export function bumperMesh(r) {
  const R = r * U, g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.15, 0.12, 20), mat('#3a3d46')); base.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.22, 20), mat('#e8e4da')); ring.position.y = 0.23;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R, 0.16, 20), mat('#b8423a')); cap.position.y = 0.42;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.35, R * 0.35, 0.05, 16), mat('#e8e4da')); top.position.y = 0.52;
  for (const m of [base, ring, cap, top]) { m.castShadow = true; g.add(m); }
  return g;
}

// Imán (obstáculo 'magnet'): herradura mate, roja con las puntas grises, tumbada mirando al campo
export function magnetMesh(r) {
  const R = r * U * 1.3, g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#a83a32', roughness: 0.7 }), grey = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.5, metalness: 0.4 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.32, 8, 16, Math.PI), red);
  arc.rotation.x = -Math.PI / 2; arc.position.y = R * 0.4;
  g.add(arc);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.32, R * 0.32, R * 0.9, 10), red);
    leg.rotation.x = Math.PI / 2; leg.position.set(sx * R, R * 0.4, R * 0.45);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.33, R * 0.33, R * 0.35, 10), grey);
    tip.rotation.x = Math.PI / 2; tip.position.set(sx * R, R * 0.4, R * 1.05);
    g.add(leg, tip);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// Vagoneta: caja de madera oscura con ruedas y un poco de piedra encima
const cartMats = {};
function cartMesh() {
  const g = new THREE.Group(), mat = c => cartMats[c] || (cartMats[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.85), mat('#5a4030')); box.position.y = 0.45;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 0.9), mat('#3a3a40')); rim.position.y = 0.74;
  const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 0.9, flatShading: true })); ore.position.y = 0.82;
  g.add(box, rim, ore);
  for (const x of [-0.42, 0.42]) for (const z of [-0.42, 0.42]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10), mat('#2a2a2e'));
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.16, z); g.add(w);
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// live: lo que llega en cada instantánea (vagonetas y esporas) y el aviso de las vías (World.railWarn)
export function buildMechProps(group, mech, marks, live = {}) {
  const anim = [];
  // Vías de las vagonetas: dos raíles con traviesas; al avisar, la vía se ilumina un poco (amarillo apagado)
  if (mech.carts) {
    const rails = [];
    for (const y of Shared.cartRails(mech.carts)) {
      const railMat = new THREE.MeshStandardMaterial({ color: '#6a6c72', roughness: 0.6, metalness: 0.3, emissive: '#ffb020', emissiveIntensity: 0 });
      const z = y * U;
      for (const dz of [-0.28, 0.28]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(COLS, 0.05, 0.07), railMat); r.position.set(COLS / 2, 0.04, z + dz); group.add(r);
      }
      const tie = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.04, 0.85), new THREE.MeshStandardMaterial({ color: '#5a4434', roughness: 1 }), COLS * 2);
      const mm = new THREE.Matrix4();
      for (let k = 0; k < COLS * 2; k++) { mm.makeTranslation(0.25 + k * 0.5, 0.02, z); tie.setMatrixAt(k, mm); }
      group.add(tie);
      const cart = cartMesh(); cart.visible = false; cart.position.set(0, 0, z); group.add(cart);
      rails.push({ y, mat: railMat, cart, warn: 0, x: null });
    }
    live.railWarn = (y, d) => { const r = rails.find(q => Math.abs(q.y - y) < 20); if (r) r.warn = d; };
    anim.push((dt, t) => {
      const ct = (live.ar && live.ar.ct) || [];
      for (const r of rails) {
        r.warn = Math.max(0, r.warn - dt);
        r.mat.emissiveIntensity = r.warn > 0 ? 0.35 + 0.25 * Math.sin(t * 14) : 0;
        const c = ct.find(q => Math.abs(q[1] - r.y) < 20);
        r.cart.visible = !!c;
        if (c) { const tx = c[0] * U; r.x = r.x === null ? tx : r.x + (tx - r.x) * Math.min(1, dt * 18); r.cart.position.x = r.x; }
        else r.x = null;
      }
    });
  }
  // Esporas: nubes blandas, amarillo verdoso apagado, que siguen a donde dice el servidor
  if (mech.spores) {
    const clouds = Array.from({ length: mech.spores.n || 3 }, () => {
      const zg = new THREE.Group(), R = (mech.spores.r || 70) * U;
      const mat = new THREE.SpriteMaterial({ map: puff(), color: '#c8d090', transparent: true, opacity: 0.38, depthWrite: false });
      for (let k = 0; k < 7; k++) {
        const s = new THREE.Sprite(mat); const a = k * 0.9;
        s.position.set(Math.cos(a) * R * 0.5, 0.35 + (k % 3) * 0.18, Math.sin(a) * R * 0.5); s.scale.setScalar(R * 1.1);
        zg.add(s);
      }
      zg.visible = false; group.add(zg);
      return zg;
    });
    anim.push((dt, t) => {
      const sp = live.ar && live.ar.sp;
      clouds.forEach((g, k) => {
        if (!sp || !sp[k]) return;
        const tx = sp[k][0] * U, tz = sp[k][1] * U;
        if (!g.visible) { g.position.set(tx, 0, tz); g.visible = true; }
        g.position.x += (tx - g.position.x) * Math.min(1, dt * 6); g.position.z += (tz - g.position.z) * Math.min(1, dt * 6);
        g.rotation.y = t * 0.15 + k;
      });
    });
  }
  // Arenas movedizas: charcas de arena con el remolino girando muy despacio
  const sandMat = mech.quicksand && new THREE.MeshStandardMaterial({ map: sandTexture(), transparent: true, roughness: 1, depthWrite: false });
  if (mech.quicksand) for (const z of Shared.sandZones(mech.quicksand)) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r * U * 1.08, 28), sandMat);
    disc.rotation.x = -Math.PI / 2; disc.position.set(z.x * U, 0.03, z.y * U);
    disc.receiveShadow = true;
    group.add(disc);
    anim.push(dt => { disc.rotation.z += dt * 0.25; });
  }
  // Cintas transportadoras: una franja por banda, con sus rodillos a los lados, que corre en su sentido
  if (mech.belts) for (const [y0, y1, dir] of mech.belts.rows) {
    const tex = beltTexture(), w = (COLS - 4) * CELL * U, h = (y1 - y0 + 1) * CELL * U;
    tex.repeat.set(w / 1.6, 1);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 0.92), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(COLS / 2, 0.035, (y0 + y1 + 1) / 2);
    belt.receiveShadow = true;
    group.add(belt);
    const roller = new THREE.MeshStandardMaterial({ color: '#5a5e66', metalness: 0.4, roughness: 0.5 });
    for (const x of [2 - 0.15, COLS - 2 + 0.15]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h, 10), roller);
      r.rotation.x = Math.PI / 2; r.position.set(x, 0.12, (y0 + y1 + 1) / 2);
      group.add(r);
    }
    const speed = mech.belts.speed * U / 1.6 * dir;
    anim.push(dt => { tex.offset.x -= speed * dt; });
  }
  // Niebla: nubes blandas y grises que se mecen despacio en cada banco
  if (mech.fog) for (const z of Shared.fogZones(mech.fog)) {
    const zg = new THREE.Group();
    zg.position.set(z.x * U, 0, z.y * U);
    const R = z.r * U, mat = new THREE.SpriteMaterial({ map: puff(), color: '#cfd4dc', transparent: true, opacity: 0.32, depthWrite: false });
    const puffs = [];
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Sprite(mat), a = k / 9 * Math.PI * 2, d = R * (k % 3 === 0 ? 0.15 : 0.55);
      s.position.set(Math.cos(a) * d, 0.2 + (k % 3) * 0.15, Math.sin(a) * d);
      s.scale.setScalar(R * (1.1 + (k % 3) * 0.25));
      s.userData = { a, d, h: s.position.y };
      zg.add(s); puffs.push(s);
    }
    group.add(zg);
    anim.push((dt, t) => { for (const s of puffs) { const a = s.userData.a + t * 0.12; s.position.x = Math.cos(a) * s.userData.d; s.position.z = Math.sin(a) * s.userData.d; s.position.y = s.userData.h + Math.sin(t * 0.6 + s.userData.a) * 0.06; } });
  }
  // Espejos: cristal plateado con marco
  if (mech.mirrors) {
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f2', metalness: 0.85, roughness: 0.08, transparent: true, opacity: 0.7 });
    const frame = new THREE.MeshStandardMaterial({ color: '#6a5a8a', roughness: 0.6 });
    for (const [x1, y1, x2, y2] of Shared.mirrorSegs(mech.mirrors)) {
      const len = Math.hypot(x2 - x1, y2 - y1) * U, a = Math.atan2(y2 - y1, x2 - x1);
      const g = new THREE.Group();
      g.position.set((x1 + x2) / 2 * U, 0, (y1 + y2) / 2 * U); g.rotation.y = -a;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.06), glass); pane.position.y = 0.65; g.add(pane);
      for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.14), frame); post.position.set(sx * len / 2, 0.65, 0); post.castShadow = true; g.add(post); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(len + 0.12, 0.1, 0.14), frame); top.position.y = 1.25; g.add(top);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.1, 0.3), frame); foot.position.y = 0.05; g.add(foot);
      group.add(g);
    }
  }
  // Flores: matas bajas, rosas (curan) o moradas (adormecen), que se mecen
  if (mech.flowers && marks.flowers.length) {
    const stem = new THREE.MeshStandardMaterial({ color: '#4a7a3a', roughness: 0.9 });
    const petals = { heal: new THREE.MeshStandardMaterial({ color: '#e890b8', roughness: 0.8 }), sleep: new THREE.MeshStandardMaterial({ color: '#9a78c8', roughness: 0.8 }) };
    const bloomGeo = new THREE.IcosahedronGeometry(0.11, 0), stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.3, 4);
    const sway = [];
    for (const f of marks.flowers) {
      const cx = f.x * U, cz = f.y * U;
      const bed = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), new THREE.MeshStandardMaterial({ color: '#3e5e30', roughness: 1 }));
      bed.rotation.x = -Math.PI / 2; bed.position.set(cx, 0.02, cz); group.add(bed);
      for (let k = 0; k < 7; k++) {
        const a = k * 2.4 + f.i, d = 0.12 + (k % 3) * 0.12;
        const g = new THREE.Group(); g.position.set(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d);
        const st = new THREE.Mesh(stemGeo, stem); st.position.y = 0.15; g.add(st);
        const bl = new THREE.Mesh(bloomGeo, petals[f.k]); bl.position.y = 0.32; bl.scale.set(1, 0.6, 1); g.add(bl);
        group.add(g); sway.push([g, a]);
      }
    }
    anim.push((dt, t) => { for (const [g, a] of sway) g.rotation.z = Math.sin(t * 1.4 + a) * 0.12; });
  }
  // Pozo de gravedad: una runa de piedra oscura en el centro (lo que se mueve sale al latir, en effects.js)
  if (mech.gravity) {
    const rune = new THREE.Mesh(new THREE.RingGeometry(mech.gravity.r * U * 0.6, mech.gravity.r * U, 40), new THREE.MeshStandardMaterial({ color: '#2a2436', roughness: 0.9 }));
    rune.rotation.x = -Math.PI / 2; rune.position.set(ARENA.w / 2 * U, 0.025, ARENA.h / 2 * U); group.add(rune);
    const core = new THREE.Mesh(new THREE.CircleGeometry(mech.gravity.r * U * 0.6, 40), new THREE.MeshStandardMaterial({ color: '#15121c', roughness: 1 }));
    core.rotation.x = -Math.PI / 2; core.position.set(ARENA.w / 2 * U, 0.024, ARENA.h / 2 * U); group.add(core);
  }
  return anim;
}

// Pilar de piedra (obstáculo 'pillar'): columna hexagonal con capitel, que sube del suelo
export function pillarMesh(r, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * U * 0.85, r * U, 1.5, 6), m); shaft.position.y = 0.75; g.add(shaft);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * U * 1.05, r * U * 0.9, 0.18, 6), m); cap.position.y = 1.55; g.add(cap);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}
