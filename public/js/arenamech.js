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

export function buildMechProps(group, mech, marks) {
  const anim = [];
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
