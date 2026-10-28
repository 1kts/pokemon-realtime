// Skins de maestría sobre el sprite: oro, holo, galaxia y elemental. Un solo shader para el combate (el sprite
// de cada Actor, actors.js) y para los menús (los retratos, que menufx.js pinta con su propio renderer).
// Se calculan sobre el color del sprite antes del tinte del material (el destello al recibir un golpe).
// Elemental: el sprite se recolorea con una paleta de 4 colores del tipo de la línea (fuego: brasas),
// con parpadeo y vetas que suben, y un contorno de 1 px que brilla. Las partículas de pixel art (brasas,
// chispas, burbujas, hojas…; ver skinfx.js) son otro premio y van con cualquier skin. Todo a la resolución del
// pixel art y en píxeles del fotograma (q, con y hacia arriba), mirando solo dentro del fotograma actual (uFrame).
// Fuera del fotograma no hay sprite: en los menús el plano lleva un margen para las llamas y el contorno.
import * as THREE from 'three';
import { elementalPalette, ELEM_FAMILY } from './skinfx.js';

export const SKIN_ID = { oro: 1, holo: 2, galaxia: 3, elemental: 4 };
const SKIN_PARS = `uniform float uSkin;
uniform float uFam;
uniform float uTime;
uniform vec3 uPal0;
uniform vec3 uPal1;
uniform vec3 uPal2;
uniform vec3 uPal3;
uniform vec2 uTexel;
uniform vec4 uFrame;
// Hash sin sin(): el de fract(sin(x) * 43758.5) pierde precisión en las GPU de móvil y el dibujo salía distinto
float skinHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float skinNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skinHash(i), skinHash(i + vec2(1.0, 0.0)), f.x), mix(skinHash(i + vec2(0.0, 1.0)), skinHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float skinFbm(vec2 p) { return (0.5 * skinNoise(p) + 0.25 * skinNoise(p * 2.0) + 0.125 * skinNoise(p * 4.0)) / 0.875; }
`;
const SKIN_GLSL = `
  // Píxel de arte (cell), su centro (uv0), el píxel dentro del fotograma (q, y hacia arriba) y el tamaño del fotograma (fsz)
  vec2 cell = floor(vMapUv / uTexel);
  vec2 uv0 = (cell + 0.5) * uTexel;
  vec2 lo = uFrame.xy, hi = uFrame.xy + uFrame.zw;
  vec2 fsz = floor(uFrame.zw / uTexel + 0.5);
  vec2 q = cell - floor(uFrame.xy / uTexel + 0.5);
  bool inFrame = q.x >= 0.0 && q.y >= 0.0 && q.x < fsz.x && q.y < fsz.y;
  if (!inFrame) diffuseColor.a = 0.0;
  if (uSkin > 3.5) {
    // Elemental: paleta del tipo según la luz, con un dibujo propio de su familia (uFam, ver ELEM_FAMILY):
    // 0 llamas (vetas que suben y lenguas de fuego sobre la silueta), 1 agua (cáusticas que se mueven),
    // 2 chispa (grietas de luz que restallan a ratos), 3 naturaleza (venas con un pulso que sube),
    // 4 espíritu (jirones oscuros y humo que sale de la silueta)
    vec4 t0 = inFrame ? texture2D(map, uv0) : vec4(0.0);
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
          if (below < 0.5 && p.y > lo.y && p.y < hi.y && p.x > lo.x && p.x < hi.x && texture2D(map, p).a > 0.5) below = float(k);
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
    // parpadean y alguna grande en cruz
    vec3 base = diffuseColor.rgb / max(diffuse, vec3(0.001));
    float l = dot(base, vec3(0.299, 0.587, 0.114));
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
    vec3 c;
    if (uSkin < 1.5) {
      // Oro, con su reflejo: una franja blanca algo inclinada que sube por el sprite cada 2,5 s
      float g = smoothstep(0.05, 0.9, l);
      c = mix(vec3(0.16, 0.07, 0.0), vec3(0.95, 0.6, 0.05), smoothstep(0.0, 0.55, g));
      c = mix(c, vec3(1.0, 0.93, 0.55), smoothstep(0.55, 1.0, g));
      float band = pow(max(0.0, sin((q.y + q.x * 0.5) / (fsz.y * 1.5) * 6.2832 - uTime * 2.5)), 10.0);
      c = mix(c, vec3(1.0, 0.98, 0.88), band * 0.85);
    } else {
      // Holo: arcoíris según la luz que cruza el sprite en diagonal (una vuelta cada 50 píxeles de arte)
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + l * 1.2 + (q.x + q.y) * 0.02 + uTime * 0.35));
      c = base * 0.45 + rainbow * 0.7;
    }
    diffuseColor.rgb = c * diffuse;
  }`;

// Los uniforms de la skin de un material (cada sprite, los suyos)
export function skinUniforms() {
  return { uSkin: { value: 0 }, uFam: { value: 0 }, uTime: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) }, uFrame: { value: new THREE.Vector4(0, 0, 1, 1) },
    uPal0: { value: new THREE.Color() }, uPal1: { value: new THREE.Color() }, uPal2: { value: new THREE.Color() }, uPal3: { value: new THREE.Color() } };
}

// Mete el shader de las skins en un MeshBasicMaterial con mapa (el sprite), con esos uniforms
export function skinMaterial(mat, u) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    // (solo con textura: si se pinta antes de que llegue el sprite, el shader sin mapa no compilaría)
    sh.fragmentShader = SKIN_PARS + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n' + SKIN_GLSL + '\n#endif\n');
  };
  return mat;
}

// Pone la skin (o ninguna); type: el tipo de la línea, para la paleta y el dibujo de la Elemental
export function setSkin(u, skin, type) {
  u.uSkin.value = SKIN_ID[skin] || 0;
  if (skin === 'elemental') {
    elementalPalette(type, Data.TYPE_COLOR[type]).forEach((c, i) => u['uPal' + i].value.set(c));
    u.uFam.value = ELEM_FAMILY[type] ?? 2;
  }
}

// El fotograma de la hoja que se ve (lo que muestra la textura con su offset y repeat) y el reloj
// (el reloj da la vuelta cada 10 min: sin acotar, tras un rato largo el shader pierde precisión y la skin se
// queda a bloques o congelada, sobre todo en las GPU de móvil)
export const skinClock = now => (now / 1000) % 600;
export function setFrame(u, tex, now) {
  const img = tex.image;
  u.uTime.value = skinClock(now);
  u.uTexel.value.set(1 / img.naturalWidth, 1 / img.naturalHeight);
  u.uFrame.value.set(tex.offset.x, tex.offset.y, tex.repeat.x, tex.repeat.y);
}
