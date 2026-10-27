// Pokémon en la escena 3D: un plano con el sprite que siempre mira a la cámara (billboard),
// con sombra real (la silueta del sprite), una sombra suave de contacto y el anillo de su hitbox.
import * as THREE from 'three';
import { animMeta, sheet, frameAt, dirRow, hovers, hasShiny } from './sprites.js';
import { U, toWorld, softDisc } from './world.js';
import { emitFx, stepFx, elementalPalette, ELEM_FAMILY } from './skinfx.js';

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
// con parpadeo y vetas que suben, y un contorno de 1 px que brilla. Las partículas de pixel art (brasas,
// chispas, burbujas, hojas…; ver skinfx.js) son otro premio y van con cualquier skin. Todo a la resolución del pixel art,
// mirando solo dentro del fotograma actual (uFrame).
const SKIN_ID = { oro: 1, holo: 2, galaxia: 3, elemental: 4 };
const SKIN_PARS = `uniform float uSkin;
uniform float uFam;
uniform float uTime;
uniform vec3 uPal0;
uniform vec3 uPal1;
uniform vec3 uPal2;
uniform vec3 uPal3;
uniform vec2 uTexel;
uniform vec4 uFrame;
float skinHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float skinNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skinHash(i), skinHash(i + vec2(1.0, 0.0)), f.x), mix(skinHash(i + vec2(0.0, 1.0)), skinHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float skinFbm(vec2 p) { return (0.5 * skinNoise(p) + 0.25 * skinNoise(p * 2.0) + 0.125 * skinNoise(p * 4.0)) / 0.875; }
`;
const SKIN_GLSL = `
  if (uSkin > 3.5) {
    // Elemental: paleta del tipo según la luz, con un dibujo propio de su familia (uFam, ver ELEM_FAMILY):
    // 0 llamas (vetas que suben y lenguas de fuego sobre la silueta), 1 agua (cáusticas que se mueven),
    // 2 chispa (grietas de luz que restallan a ratos), 3 naturaleza (venas con un pulso que sube),
    // 4 espíritu (jirones oscuros y humo que sale de la silueta). Igual que menufx.js en los menús
    vec2 cell = floor(vMapUv / uTexel);
    vec2 uv0 = (cell + 0.5) * uTexel;
    vec4 t0 = texture2D(map, uv0);
    vec2 lo = uFrame.xy, hi = uFrame.xy + uFrame.zw;
    vec2 q = cell - floor(uFrame.xy / uTexel + 0.5);   // píxel dentro del fotograma (y hacia arriba)
    if (t0.a >= 0.5) {
      float l = clamp((dot(t0.rgb, vec3(0.299, 0.587, 0.114)) - 0.08) / 0.84, 0.0, 1.0);
      float x = l * 3.0;
      vec3 c = x < 1.0 ? mix(uPal0, uPal1, x) : x < 2.0 ? mix(uPal1, uPal2, x - 1.0) : mix(uPal2, uPal3, x - 2.0);
      c = mix(c, uPal3, 0.3 * l * (0.5 + 0.5 * sin(q.y * 0.45 + uTime * 9.0 + q.x * 0.21)));
      if (uFam < 0.5) {
        float v = skinNoise(vec2(q.x * 0.3, q.y * 0.25 - uTime * 6.0)) + 0.5 * skinNoise(vec2(q.x * 0.7 + 2.0, q.y * 0.5 - uTime * 10.0));
        if (v > 1.12) c = uPal3 * 1.15; else if (v > 0.92) c = mix(c, uPal2 * 1.2, 0.6);
      } else if (uFam < 1.5) {
        float n = skinNoise(vec2(q.x * 0.18 + uTime * 0.6, q.y * 0.18 + uTime * 0.4)) + skinNoise(vec2(q.x * 0.23 - uTime * 0.5 + 7.0, q.y * 0.21 + uTime * 0.3 + 7.0));
        float line = 1.0 - abs(n - 1.0) * 4.0;
        if (line > 0.6) c = mix(c, uPal3 * 1.15, 0.8); else if (line > 0.3) c = mix(c, uPal2 * 1.1, 0.4);
      } else if (uFam < 2.5) {
        float step6 = floor(uTime * 6.0);
        float r = 1.0 - abs(skinNoise(vec2(q.x * 0.22 + step6 * 3.7, q.y * 0.22)) * 2.0 - 1.0);
        if (skinHash(vec2(step6, 1.0)) > 0.45) {
          if (r > 0.93) c = mix(uPal3, vec3(1.0), 0.6) * 1.1; else if (r > 0.84) c = mix(c, uPal3 * 1.2, 0.7);
        }
        c = mix(c, uPal3, 0.15 * (0.5 + 0.5 * sin(uTime * 14.0 + q.x * 0.9)));
      } else if (uFam < 3.5) {
        float r = 1.0 - abs(skinNoise(q * 0.2) * 2.0 - 1.0);
        float pulse = 0.5 + 0.5 * sin(q.y * 0.35 - uTime * 3.0);
        if (r > 0.88) c = mix(c, uPal3 * 1.1, 0.35 + 0.65 * pulse); else if (r > 0.8) c = mix(c, uPal2, 0.3 * pulse);
      } else {
        float n = skinFbm(vec2(q.x * 0.1 + sin(uTime * 0.8) * 0.6, q.y * 0.1 - uTime * 0.4));
        c = mix(c, uPal0, smoothstep(0.55, 0.8, n) * 0.75);
        if (n < 0.28) c = mix(c, uPal3 * 1.2, 0.6);
      }
      diffuseColor.rgb = c * diffuse;
    } else {
      // Fuera de la silueta. Llamas y espíritu: lenguas que salen hacia arriba hasta 3 px; el resto, un
      // contorno de 1 px que parpadea
      float below = 0.0;
      if (uFam < 0.5 || uFam > 3.5) {
        for (int k = 1; k <= 3; k++) {
          vec2 p = uv0 - vec2(0.0, float(k) * uTexel.y);
          if (below < 0.5 && p.y > lo.y && p.x > lo.x && p.x < hi.x && texture2D(map, p).a > 0.5) below = float(k);
        }
      }
      if (below > 0.5) {
        float f = uFam < 0.5 ? skinNoise(vec2(q.x * 0.55, q.y * 0.35 - uTime * 9.0)) : skinNoise(vec2(q.x * 0.4 + uTime * 0.7, q.y * 0.25 - uTime * 3.0));
        if (f > 0.28 + 0.17 * below) {
          vec3 col = below < 1.5 ? uPal3 : below < 2.5 ? uPal2 * 1.2 : uPal1 * 1.3;
          if (uFam > 3.5) col = below < 1.5 ? uPal2 : uPal1;
          diffuseColor = vec4(col * diffuse, opacity * (uFam > 3.5 ? 0.75 : 1.0));
        }
      } else {
        float edge = 0.0;
        vec2 d[4]; d[0] = vec2(uTexel.x, 0.0); d[1] = vec2(-uTexel.x, 0.0); d[2] = vec2(0.0, uTexel.y); d[3] = vec2(0.0, -uTexel.y);
        for (int i = 0; i < 4; i++) {
          vec2 p = uv0 + d[i];
          if (p.x > lo.x && p.y > lo.y && p.x < hi.x && p.y < hi.y && texture2D(map, p).a > 0.5) edge = 1.0;
        }
        float v = skinNoise(vec2(q.x * 0.6, q.y * 0.4 - uTime * 7.0));
        if (edge > 0.5 && v > 0.45) diffuseColor = vec4((v > 0.75 ? uPal3 : uPal2) * diffuse, opacity);
      }
    }
  } else if (uSkin > 2.5) {
    // Galaxia: cielo de noche azul con nubes de nebulosa (magenta y cian) que se desplazan, estrellas que
    // parpadean y alguna grande en cruz. En píxeles del sprite (q), como menufx.js en los menús
    vec3 base = diffuseColor.rgb / max(diffuse, vec3(0.001));
    float l = dot(base, vec3(0.299, 0.587, 0.114));
    vec2 q = floor(vMapUv / uTexel) - floor(uFrame.xy / uTexel + 0.5);
    vec3 c = mix(vec3(0.02, 0.03, 0.12), vec3(0.18, 0.24, 0.52), l);
    float n1 = skinFbm(vec2(q.x * 0.08 + uTime * 0.15, q.y * 0.08 - uTime * 0.05));
    float n2 = skinFbm(vec2(q.x * 0.11 - uTime * 0.1 + 5.0, q.y * 0.09 + uTime * 0.07 + 3.0));
    c = mix(c, vec3(0.95, 0.25, 0.75) * (0.55 + 0.6 * l), smoothstep(0.5, 0.85, n1) * 0.75);
    c = mix(c, vec3(0.2, 0.85, 1.0) * (0.55 + 0.6 * l), smoothstep(0.55, 0.9, n2) * 0.6);
    float h = skinHash(q);
    if (h > 0.965) c = mix(c, vec3(1.0), 0.5 + 0.5 * sin(uTime * 4.0 + h * 40.0));
    vec2 blk = floor(q / 5.0), d = q - blk * 5.0 - 2.0;
    float hb = skinHash(blk + 31.7);
    if (hb > 0.82) {
      float k = max(0.0, sin(uTime * 2.0 + hb * 50.0)), m = abs(d.x) + abs(d.y);
      if (m < 0.5) c = mix(c, vec3(1.0), k); else if (m < 1.5) c = mix(c, vec3(0.85, 0.95, 1.0), k * 0.65);
    }
    diffuseColor.rgb = c * diffuse;
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
    } else {
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + l * 1.2 + (sp.x + sp.y) * 0.004 + uTime * 0.35));
      c = base * 0.45 + rainbow * 0.7;
    }
    diffuseColor.rgb = c * diffuse;
  }`;

export class Actor {
  // mine: anillo amarillo (propio) o rojo (rival)
  constructor(scene, camera, dex, shiny = false, mine = false, skin = null, parts = null) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false });
    this.skinU = { uSkin: { value: 0 }, uFam: { value: 0 }, uTime: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) }, uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
      uPal0: { value: new THREE.Color() }, uPal1: { value: new THREE.Color() }, uPal2: { value: new THREE.Color() }, uPal3: { value: new THREE.Color() } };
    this.mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.skinU);
      // (solo con textura: si se pinta antes de que llegue el sprite, el shader sin mapa no compilaría)
      sh.fragmentShader = SKIN_PARS + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n' + SKIN_GLSL + '\n#endif\n');
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
    this.setDex(dex, shiny, skin, parts);
  }

  // parts: el tipo de las partículas de la línea (aparte de la skin) o null
  setDex(dex, shiny = false, skin = null, parts = null) {
    this.dex = dex;
    this.shiny = shiny;
    this.skinU.uSkin.value = SKIN_ID[skin] || 0;
    // Elemental: paleta del tipo de la línea; partículas: las mismas formas y colores, con cualquier skin
    const type = Data.SPECIES[Data.lineOf(dex)].types[0];
    this.fxType = parts || null;
    if (parts) this.fxPal = elementalPalette(parts, Data.TYPE_COLOR[parts]);   // siempre los colores de su tipo
    if (skin === 'elemental') {
      elementalPalette(type, Data.TYPE_COLOR[type]).forEach((c, i) => this.skinU['uPal' + i].value.set(c));
      this.skinU.uFam.value = ELEM_FAMILY[type] ?? 2;
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
    const row = m.r === 1 ? 0 : dirRow(a);   // hojas de una sola dirección (r: 1)
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
    // Partículas de la línea (las de toda la escena se mueven una vez por fotograma)
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
