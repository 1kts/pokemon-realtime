// Pokémon en la escena 3D: un plano con el sprite que siempre mira a la cámara (billboard),
// con sombra real (la silueta del sprite) y una sombra suave de contacto en el suelo.
import * as THREE from 'three';
import { animMeta, sheet, frameAt, dirRow, hovers } from './sprites.js';
import { U, toWorld, softDisc } from './world.js';

const ART = 2.3 * U;            // unidades 3D por píxel de arte
const textures = new Map();      // "dex/Anim" -> THREE.Texture base (las de cada actor son clones)

function baseTexture(dex, anim) {
  const key = dex + '/' + anim;
  let t = textures.get(key);
  if (!t) {
    const img = sheet(dex, anim);
    t = new THREE.Texture(img);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    const ready = () => { t.needsUpdate = true; };
    if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once: true });
    textures.set(key, t);
  }
  return t;
}

let blobTex = null;

export class Actor {
  constructor(scene, camera, dex) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.castShadow = true;
    this.mesh.renderOrder = 5;
    blobTex = blobTex || softDisc('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    this.group.add(this.mesh, this.blob);
    scene.add(this.group);
    this.texCache = new Map();
    this.anim = { name: 'Idle', t0: 0, once: false };
    this.flashUntil = 0;
    this.alpha = 1;
    this.scale = 1;
    this.ghosts = [];
    this.setDex(dex);
  }

  setDex(dex) {
    this.dex = dex;
    this.hover = hovers(dex);
    this.texCache.clear();
  }

  texFor(anim) {
    let t = this.texCache.get(anim);
    if (!t) {
      t = baseTexture(this.dex, anim).clone();
      t.needsUpdate = true;
      this.texCache.set(anim, t);
    }
    return t;
  }

  play(name, once = true) { this.anim = { name, t0: performance.now(), once }; }

  // Coloca el sprite: x,y en px de juego, a ángulo de mirada, moving para andar.
  update(now, x, y, a, moving) {
    const { anim } = this;
    let { name, m } = animMeta(this.dex, anim.name);
    if (anim.once && now - anim.t0 > m.d.reduce((s, v) => s + v, 0) * 1000 / 60) {
      if (anim.name === 'Faint') { /* se queda en el último fotograma */ }
      else this.anim = { name: moving ? 'Walk' : 'Idle', t0: now, once: false };
    } else if (!anim.once) {
      const want = moving ? 'Walk' : 'Idle';
      if (anim.name !== want) this.anim = { name: want, t0: now, once: false };
    }
    ({ name, m } = animMeta(this.dex, this.anim.name));
    const tex = this.texFor(name);
    const img = tex.image;
    if (!img || !img.naturalWidth) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const f = frameAt(m, now - this.anim.t0, this.anim.once);
    const row = dirRow(a);
    tex.repeat.set(m.w / img.naturalWidth, m.h / img.naturalHeight);
    tex.offset.set(f * m.w / img.naturalWidth, 1 - (row + 1) * m.h / img.naturalHeight);
    this.mat.map = tex;
    // Tamaño y ancla (los pies del sprite caen en la posición del Pokémon)
    const s = ART * this.scale;
    this.mesh.scale.set(m.w * s, m.h * s, 1);
    this.mesh.quaternion.copy(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const lift = this.hover ? 0.25 + Math.sin(now / 300) * 0.06 : 0;
    this.mesh.position.copy(right.multiplyScalar((m.w / 2 - m.ax) * s)).add(up.multiplyScalar((m.ay - m.h / 2) * s));
    this.mesh.position.y += lift + 0.02;
    this.group.position.copy(toWorld(x, y));
    this.blob.scale.setScalar((this.hover ? 0.8 : 1) * this.scale);
    // Destello blanco al recibir un golpe; transparencia si está oculto
    const flash = now < this.flashUntil;
    this.mat.color.setScalar(flash ? 6 : 1);
    this.mat.opacity = this.alpha;
    this.mat.alphaTest = this.alpha < 1 ? 0.1 : 0.5;
    this.blob.material.opacity = this.alpha;
    this.mesh.castShadow = this.alpha > 0.6;
    this.updateGhosts(now);
  }

  flash(ms = 90) { this.flashUntil = performance.now() + ms; }

  // Copias que se desvanecen detrás del Pokémon (embestidas, teletransporte)
  ghost(tint = '#ffffff') {
    if (!this.mat.map || !this.mesh.visible) return;
    const tex = this.mat.map.clone();
    tex.needsUpdate = true;
    const g = new THREE.Mesh(this.mesh.geometry, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false, color: tint, toneMapped: false }));
    g.position.copy(this.mesh.position).add(this.group.position);
    g.quaternion.copy(this.mesh.quaternion);
    g.scale.copy(this.mesh.scale);
    g.userData.t0 = performance.now();
    this.scene.add(g);
    this.ghosts.push(g);
  }

  updateGhosts(now) {
    this.ghosts = this.ghosts.filter(g => {
      const f = (now - g.userData.t0) / 300;
      if (f >= 1) { this.scene.remove(g); g.material.map.dispose(); g.material.dispose(); return false; }
      g.material.opacity = 0.45 * (1 - f);
      return true;
    });
  }

  worldTop() { return this.group.position.clone().add(new THREE.Vector3(0, 1.9 * this.scale + (this.hover ? 0.3 : 0), 0)); }

  dispose() {
    this.scene.remove(this.group);
    for (const g of this.ghosts) this.scene.remove(g);
    for (const t of this.texCache.values()) t.dispose();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
