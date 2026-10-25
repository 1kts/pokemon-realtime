// Pokémon en la escena 3D: un plano con el sprite que siempre mira a la cámara (billboard),
// con sombra real (la silueta del sprite), una sombra suave de contacto y el anillo de su hitbox.
import * as THREE from 'three';
import { animMeta, sheet, frameAt, dirRow, hovers, hasShiny } from './sprites.js';
import { U, toWorld, softDisc } from './world.js';
import { emitFx, stepFx, elementalPalette } from './skinfx.js';

const ART = 2.3 * U;            // unidades 3D por píxel de arte
const textures = new Map();      // "dex/Anim[/s]" -> THREE.Texture base (las de cada actor son clones)

function baseTexture(dex, anim, shiny) {
  const key = dex + '/' + anim + (shiny ? '/s' : '');
  let t = textures.get(key);
  if (!t) {
    const img = sheet(dex, anim, shiny);
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

// Skins de maestría sobre el sprite (las mismas que en los menús): oro, holo, galaxia y elemental.
// Se calculan sobre el color del sprite antes del tinte del material (el destello al recibir un golpe).
// Elemental: el sprite se recolorea con una paleta de 4 colores del tipo de la línea (fuego: brasas),
// con parpadeo y vetas que suben, y un contorno de 1 px que brilla; encima, partículas pequeñas de pixel
// art (brasas, chispas, burbujas, hojas…; ver skinfx.js) que no se salen del sprite. Todo a la resolución del pixel art,
// mirando solo dentro del fotograma actual (uFrame).
const SKIN_ID = { oro: 1, holo: 2, galaxia: 3, elemental: 4 };
const GLOW_ID = { prisma: 2, sombra: 3, estelar: 4 };
const SKIN_PARS = `uniform float uSkin;
uniform float uTime;
uniform vec3 uPal0;
uniform vec3 uPal1;
uniform vec3 uPal2;
uniform vec3 uPal3;
uniform vec2 uTexel;
uniform vec4 uFrame;
uniform float uGlow;
uniform vec3 uGlowCol;
float skinHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float skinNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skinHash(i), skinHash(i + vec2(1.0, 0.0)), f.x), mix(skinHash(i + vec2(0.0, 1.0)), skinHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
const SKIN_GLSL = `
  if (uSkin > 3.5) {
    vec2 cell = floor(vMapUv / uTexel);
    vec2 uv0 = (cell + 0.5) * uTexel;
    vec4 t0 = texture2D(map, uv0);
    vec2 lo = uFrame.xy, hi = uFrame.xy + uFrame.zw;
    if (t0.a >= 0.5) {
      float l = clamp((dot(t0.rgb, vec3(0.299, 0.587, 0.114)) - 0.08) / 0.84, 0.0, 1.0);
      float x = l * 3.0;
      vec3 c = x < 1.0 ? mix(uPal0, uPal1, x) : x < 2.0 ? mix(uPal1, uPal2, x - 1.0) : mix(uPal2, uPal3, x - 2.0);
      c = mix(c, uPal3, 0.3 * l * (0.5 + 0.5 * sin(cell.y * 0.45 + uTime * 9.0 + cell.x * 0.21)));
      float v = skinNoise(vec2(cell.x * 0.3, cell.y * 0.25 - uTime * 6.0)) + 0.5 * skinNoise(vec2(cell.x * 0.7 + 2.0, cell.y * 0.5 - uTime * 10.0));
      if (v > 1.12) c = uPal3 * 1.15; else if (v > 0.92) c = mix(c, uPal2 * 1.2, 0.6);
      diffuseColor.rgb = c * diffuse;
    } else {
      // Contorno: píxel vacío pegado a la silueta, que parpadea (nada sobresale más de 1 px)
      float edge = 0.0;
      vec2 d[4]; d[0] = vec2(uTexel.x, 0.0); d[1] = vec2(-uTexel.x, 0.0); d[2] = vec2(0.0, uTexel.y); d[3] = vec2(0.0, -uTexel.y);
      for (int i = 0; i < 4; i++) {
        vec2 q = uv0 + d[i];
        if (q.x > lo.x && q.y > lo.y && q.x < hi.x && q.y < hi.y && texture2D(map, q).a > 0.5) edge = 1.0;
      }
      float v = skinNoise(vec2(cell.x * 0.6, cell.y * 0.4 - uTime * 7.0));
      if (edge > 0.5 && v > 0.45) diffuseColor = vec4((v > 0.75 ? uPal3 : uPal2) * diffuse, opacity);
    }
  } else if (uSkin > 0.5) {
    vec3 base = diffuseColor.rgb / max(diffuse, vec3(0.001));
    float l = dot(base, vec3(0.299, 0.587, 0.114));
    vec2 sp = gl_FragCoord.xy;
    vec3 c;
    if (uSkin < 1.5) {
      float g = smoothstep(0.05, 0.9, l);
      c = mix(vec3(0.16, 0.07, 0.0), vec3(0.95, 0.6, 0.05), smoothstep(0.0, 0.55, g));
      c = mix(c, vec3(1.0, 0.93, 0.55), smoothstep(0.55, 1.0, g));
      c += vec3(1.0, 0.9, 0.6) * pow(max(0.0, sin((sp.x + sp.y) * 0.035 - uTime * 2.6)), 18.0) * 0.6;
    } else if (uSkin < 2.5) {
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + l * 1.2 + (sp.x + sp.y) * 0.004 + uTime * 0.35));
      c = base * 0.45 + rainbow * 0.7;
    } else {
      c = mix(vec3(0.07, 0.03, 0.22), vec3(0.58, 0.38, 1.0), l);
      vec2 cell = floor(sp / 3.0);
      float star = step(0.975, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
      c += vec3(star * (0.55 + 0.45 * sin(uTime * 5.0 + cell.x * 1.7)));
    }
    diffuseColor.rgb = c * diffuse;
  }
  // Glow: anillo de 1-2 px alrededor de la silueta que respira; va con cualquier skin.
  // 1 color fijo · 2 prismático · 3 sombra · 4 estelar (con destellos)
  if (uGlow > 0.5 && diffuseColor.a < 0.5) {
    vec2 gc = floor(vMapUv / uTexel);
    vec2 g0 = (gc + 0.5) * uTexel;
    vec2 glo = uFrame.xy, ghi = uFrame.xy + uFrame.zw;
    float near = 0.0;
    for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
      float dd = abs(float(dx)) + abs(float(dy));
      if (dd < 0.5 || dd > 2.5) continue;
      vec2 q = g0 + vec2(float(dx), float(dy)) * uTexel;
      if (q.x > glo.x && q.y > glo.y && q.x < ghi.x && q.y < ghi.y && texture2D(map, q).a > 0.5) near = max(near, dd < 1.5 ? 1.0 : 0.7);
    }
    if (near > 0.0) {
      float breathe = 0.78 + 0.22 * sin(uTime * 3.0);
      vec3 gcol = uGlowCol;
      if (uGlow > 1.5 && uGlow < 2.5) gcol = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + uTime * 0.3 + gc.y * 0.03));
      if (uGlow > 3.5 && step(0.88, skinHash(floor(gc / 2.0) + floor(uTime * 5.0))) > 0.5) gcol = vec3(1.0);
      diffuseColor = vec4(gcol * (uGlow > 2.5 && uGlow < 3.5 ? 0.9 : 1.2) * diffuse, near * breathe);
    }
  }`;

export class Actor {
  // mine: anillo amarillo (propio) o rojo (rival)
  constructor(scene, camera, dex, shiny = false, mine = false, skin = null, glow = null) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    this.skinU = { uSkin: { value: 0 }, uTime: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) }, uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
      uGlow: { value: 0 }, uGlowCol: { value: new THREE.Color() },
      uPal0: { value: new THREE.Color() }, uPal1: { value: new THREE.Color() }, uPal2: { value: new THREE.Color() }, uPal3: { value: new THREE.Color() } };
    this.mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.skinU);
      sh.fragmentShader = SKIN_PARS + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + SKIN_GLSL);
    };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.castShadow = true;
    this.mesh.renderOrder = 5;
    blobTex = blobTex || softDisc('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    // Indicador de la hitbox: anillo del radio de colisión con una marca hacia donde mira
    const col = mine ? '#ffd23a' : '#ff6a5a';
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.035;
    this.ringGlow = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
    this.ringGlow.rotation.x = -Math.PI / 2;
    this.ringGlow.position.y = 0.034;
    this.arrow = new THREE.Mesh(new THREE.CircleGeometry(1.08, 3), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.arrow.rotation.x = -Math.PI / 2;
    this.arrow.position.y = 0.036;
    this.group.add(this.mesh, this.blob, this.ring, this.ringGlow, this.arrow);
    scene.add(this.group);
    this.texCache = new Map();
    this.anim = { name: 'Idle', t0: 0, once: false };
    this.flashUntil = 0;
    this.alpha = 1;
    this.scale = 1;
    this.ghosts = [];
    this.setDex(dex, shiny, skin, glow);
  }

  setDex(dex, shiny = false, skin = null, glow = null) {
    this.dex = dex;
    this.shiny = shiny;
    this.skinU.uSkin.value = SKIN_ID[skin] || 0;
    this.skinU.uGlow.value = !glow ? 0 : GLOW_ID[glow] || 1;
    if (glow) this.skinU.uGlowCol.value.set(Data.glowColor(glow) || '#ffffff');
    // Elemental: paleta y partículas del tipo de la línea
    this.fxType = skin === 'elemental' ? Data.SPECIES[Data.lineOf(dex)].types[0] : null;
    if (this.fxType) {
      this.fxPal = elementalPalette(this.fxType, Data.TYPE_COLOR[this.fxType]);
      this.fxPal.forEach((c, i) => this.skinU['uPal' + i].value.set(c));
    }
    this.hover = hovers(dex);
    this.r = (window.HITBOX && window.HITBOX[dex] || 22) * U;
    this.texCache.clear();
  }

  texFor(anim) {
    const shiny = this.shiny && hasShiny(this.dex, anim);
    const key = anim + (shiny ? '/s' : '');
    let t = this.texCache.get(key);
    if (!t) {
      t = baseTexture(this.dex, anim, shiny).clone();
      t.needsUpdate = true;
      this.texCache.set(key, t);
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
    this.group.position.copy(toWorld(x, y));
    // Anillo de la hitbox (se encoge con el Pokémon al entrar en una Ball o cambiar)
    const rs = this.r * this.scale;
    this.ring.scale.setScalar(rs); this.ringGlow.scale.setScalar(rs);
    this.arrow.scale.setScalar(rs * 0.22);
    this.arrow.position.set(Math.cos(a) * rs, 0.036, Math.sin(a) * rs);
    this.arrow.rotation.z = -a;
    const vis = this.alpha * (this.scale > 0.2 ? 1 : 0);
    this.ring.material.opacity = 0.55 * vis; this.ringGlow.material.opacity = 0.14 * vis; this.arrow.material.opacity = 0.8 * vis;
    if (!img || !img.naturalWidth) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const f = frameAt(m, now - this.anim.t0, this.anim.once);
    const row = dirRow(a);
    tex.repeat.set(m.w / img.naturalWidth, m.h / img.naturalHeight);
    tex.offset.set(f * m.w / img.naturalWidth, 1 - (row + 1) * m.h / img.naturalHeight);
    this.mat.map = tex;
    this.skinU.uTime.value = now / 1000;
    this.skinU.uTexel.value.set(1 / img.naturalWidth, 1 / img.naturalHeight);
    this.skinU.uFrame.value.set(tex.offset.x, tex.offset.y, tex.repeat.x, tex.repeat.y);
    // Tamaño y ancla (los pies del sprite caen en la posición del Pokémon)
    const s = ART * this.scale;
    this.mesh.scale.set(m.w * s, m.h * s, 1);
    this.mesh.quaternion.copy(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const lift = this.hover ? 0.25 + Math.sin(now / 300) * 0.06 : 0;
    this.mesh.position.copy(right.multiplyScalar((m.w / 2 - m.ax) * s)).add(up.multiplyScalar((m.ay - m.h / 2) * s));
    this.mesh.position.y += lift + 0.02;
    this.blob.scale.setScalar((this.hover ? 0.8 : 1) * this.scale * (this.r / (22 * U)));
    // Destello blanco al recibir un golpe; transparencia si está oculto
    const flash = now < this.flashUntil;
    this.mat.color.setScalar(flash ? 6 : 1);
    this.mat.opacity = this.alpha;
    this.mat.alphaTest = this.alpha < 1 ? 0.1 : 0.5;
    this.blob.material.opacity = this.alpha;
    // Partículas de la skin Elemental (las de toda la escena se mueven una vez por fotograma)
    stepFx(this.scene, this.camera, now);
    if (this.fxType && this.alpha > 0.5 && this.scale > 0.5) {
      const dt = this.fxLast ? Math.min(0.05, (now - this.fxLast) / 1000) : 0;
      emitFx(this.scene, this.fxType, this.fxPal, this.group.position, m.w * s, m.h * s, dt, this.alpha);
    }
    this.fxLast = now;
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
    for (const m of [this.ring, this.ringGlow, this.arrow, this.blob]) { m.geometry.dispose(); m.material.dispose(); }
  }
}
