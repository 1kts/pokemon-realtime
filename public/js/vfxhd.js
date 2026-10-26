// Ataques en 3D hechos a mano (como los anillos de Hipnosis): orbes con shader propio (ruido animado que deforma la
// esfera, color por capas y borde brillante), una estela de cinta que se estrecha y se desvanece, y piezas 3D por
// tipo (rayos que chisporrotean, hojas en remolino, cristales, piedras que orbitan, anillos, tornado, estrella…).
// Lo usa el estilo 3D (vfx3d.js); el pixel art sigue en pixvfx.js.
import * as THREE from 'three';

// ---------- Orbe con ruido (fuego, sombra, agua, veneno, energía…) ----------
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function orbMaterial({ a, b, c, disp = 0.15, speed = 1, scale = 2.5, rim = 2.5, additive = false, alpha = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) },
      uDisp: { value: disp }, uSpeed: { value: speed }, uScale: { value: scale }, uRim: { value: rim }, uAlpha: { value: alpha } },
    vertexShader: `${NOISE}
      uniform float uTime, uDisp, uSpeed, uScale; varying float vN; varying vec3 vNormal, vView;
      void main(){
        float n = snoise(normal * uScale + vec3(0.0, uTime * uSpeed, uTime * uSpeed * 0.6));
        vN = n;
        vec3 p = position + normal * n * uDisp;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uA, uB, uC; uniform float uRim, uAlpha; varying float vN; varying vec3 vNormal, vView;
      void main(){
        float t = clamp(vN * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uA, uB, smoothstep(0.15, 0.6, t));
        col = mix(col, uC, smoothstep(0.65, 0.95, t));
        float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), uRim);
        col += uC * fres * 1.2;
        gl_FragColor = vec4(col, uAlpha);
      }`,
    transparent: additive || alpha < 1, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive, toneMapped: false,
  });
}

// ---------- Estela de cinta: sigue al ataque, se estrecha y se desvanece ----------
class Ribbon {
  constructor(scene, color, width = 0.3, n = 22) {
    this.scene = scene; this.n = n; this.width = width; this.pts = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.alpha = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * (1.0 + vA), vA); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  push(p) {
    const last = this.pts[0];
    if (last && last.distanceToSquared(p) < 0.0004) return;
    this.pts.unshift(p.clone());
    if (this.pts.length > this.n) this.pts.pop();
    const m = this.pts.length, up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      const k = Math.min(i, m - 1), a = this.pts[k], b = this.pts[Math.min(k + 1, m - 1)] || a;
      side.subVectors(a, b); side.y = 0;
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize().cross(up);
      const f = 1 - i / (this.n - 1), w = this.width * f;
      this.pos.set([a.x + side.x * w, a.y, a.z + side.z * w], i * 6);
      this.pos.set([a.x - side.x * w, a.y, a.z - side.z * w], i * 6 + 3);
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = i < m ? f * f * 0.85 : 0;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ---------- Piezas ----------
const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const solidMat = (color, emissive = 0.25, rough = 0.5, metal = 0.1) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: rough, metalness: metal, flatShading: true });
function leafGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.25, 1, 0); s.quadraticCurveTo(0.5, -0.25, 0, 0);
  return new THREE.ShapeGeometry(s, 8).translate(-0.5, 0, 0);
}
function starGeo(pts = 5, ro = 1, ri = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i <= pts * 2; i++) { const r = i % 2 ? ri : ro, a = i / (pts * 2) * Math.PI * 2 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }).center();
}
// Rayo en zigzag entre dos puntos (se rehace cada pocos fotogramas)
function boltPoints(a, b, segs = 7, jitter = 0.18) {
  const out = [a.clone()];
  for (let i = 1; i < segs; i++) out.push(a.clone().lerp(b, i / segs).add(new THREE.Vector3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter)));
  out.push(b.clone());
  return out;
}

// Cómo es cada tipo: el orbe (colores de dentro a fuera y cuánto se deforma), la cinta y las piezas que lo acompañan
const ORB = {
  fuego: { a: '#7a1200', b: '#ff5a10', c: '#ffe27a', disp: 0.22, speed: 2.4, scale: 2.2, ribbon: '#ff6a1a', extra: 'flames' },
  agua: { a: '#0b3a8a', b: '#2f8aff', c: '#bff0ff', disp: 0.06, speed: 1.2, scale: 3, rim: 1.6, ribbon: '#5ab8ff', extra: 'droplets' },
  planta: { a: '#14400f', b: '#45b23c', c: '#d8ff9a', disp: 0.05, speed: 1, ribbon: '#7ae05a', extra: 'leaves', small: true },
  electrico: { a: '#7a5a00', b: '#ffd21a', c: '#ffffff', disp: 0.1, speed: 4, scale: 3.5, ribbon: '#fff36a', extra: 'bolts' },
  psiquico: { a: '#5e0a3a', b: '#ff4f9a', c: '#ffe0f3', disp: 0.08, speed: 1.5, ribbon: '#ff8ad0', extra: 'rings' },
  hielo: { a: '#134a60', b: '#62d2ea', c: '#ffffff', disp: 0.02, speed: 0.6, ribbon: '#bff3ff', extra: 'crystals', small: true },
  lucha: { a: '#561208', b: '#e04a2e', c: '#ffd0b0', disp: 0.12, speed: 2, ribbon: '#ff8a5a', extra: 'shock' },
  veneno: { a: '#2e0a3c', b: '#a043d0', c: '#f0c0ff', disp: 0.3, speed: 1.8, scale: 3.2, ribbon: '#c070f0', extra: 'bubbles' },
  tierra: { a: '#3a250c', b: '#aa7c3c', c: '#f6e6b8', disp: 0.08, speed: 0.8, ribbon: '#c8a060', extra: 'rocks', small: true },
  roca: { a: '#2e2418', b: '#8e7a5a', c: '#f0e4c6', disp: 0.08, speed: 0.8, ribbon: '#c6b08a', extra: 'rocks', small: true },
  volador: { a: '#283c66', b: '#93b2ff', c: '#ffffff', disp: 0.05, speed: 2, ribbon: '#d2e2ff', extra: 'tornado', small: true },
  bicho: { a: '#2e3a06', b: '#90b82a', c: '#f4ffd2', disp: 0.12, speed: 2, ribbon: '#b8e83a', extra: 'shock' },
  fantasma: { a: '#05020a', b: '#3a1a6a', c: '#b48aff', disp: 0.28, speed: 1.6, scale: 2.6, rim: 1.8, ribbon: '#7a5ad0', extra: 'wisps' },
  dragon: { a: '#160a50', b: '#5a3cff', c: '#d8d0ff', disp: 0.2, speed: 2.2, ribbon: '#8a6cff', extra: 'helix' },
  siniestro: { a: '#000000', b: '#2a2026', c: '#c49ab8', disp: 0.25, speed: 1.4, rim: 1.6, ribbon: '#6a4a5a', extra: 'wisps' },
  acero: { a: '#232d38', b: '#8c9caf', c: '#ffffff', disp: 0.03, speed: 1, ribbon: '#cad6e2', extra: 'crystals', small: true },
  hada: { a: '#6a2050', b: '#ff8acb', c: '#ffffff', disp: 0.06, speed: 1.4, ribbon: '#ffb0e0', extra: 'star', small: true },
  normal: { a: '#3e3834', b: '#c4bcb0', c: '#ffffff', disp: 0.08, speed: 1.5, ribbon: '#ffffff', extra: 'shock' },
};

// Proyectil: { obj, h, update(pr, pos, dt), dispose() }. R: radio en unidades 3D
export function hdProjectile(scene, ty, R) {
  const o = ORB[ty] || ORB.normal;
  const r = Math.max(0.2, R * 1.4);
  const g = new THREE.Group();
  const mat = orbMaterial(o);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (o.small ? 0.55 : 1), 4), mat);
  g.add(orb);
  // Halo de luz del color del tipo, detrás (una esfera aditiva algo mayor)
  const halo = new THREE.Mesh(new THREE.SphereGeometry(r * (o.small ? 0.9 : 1.35), 16, 12), glowMat(o.b, 0.22));
  g.add(halo);
  const ribbon = new Ribbon(scene, o.ribbon, r * 0.45, 16);
  const parts = [], mats = [mat, halo.material], geos = [orb.geometry, halo.geometry];
  const add = (mesh, data = {}) => { mesh.userData = data; g.add(mesh); parts.push(mesh); mats.push(mesh.material); geos.push(mesh.geometry); return mesh; };
  let bolts = null;
  switch (o.extra) {
    case 'flames': for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, r * 2.2, 10, 1, true), glowMat(i ? '#ff5a10' : '#ffd060', 0.55)), { flame: i }); break;
    case 'droplets': for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 10, 8), solidMat('#8ad0ff', 0.4, 0.1)), { orbit: i / 6, rad: r * 1.5, speed: 6 }); break;
    case 'leaves': { const lg = leafGeo(); for (let i = 0; i < 5; i++) add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: i % 2 ? '#5fd04a' : '#2f9a32', side: THREE.DoubleSide, roughness: 0.6, emissive: '#2f9a32', emissiveIntensity: 0.3 })), { orbit: i / 5, rad: r * 1.6, speed: 9, spin: true, scale: r * 1.6 }); break; }
    case 'bolts': bolts = []; for (let i = 0; i < 4; i++) { const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color('#fff8b0').multiplyScalar(2), transparent: true, toneMapped: false })); g.add(line); bolts.push(line); mats.push(line.material); } break;
    case 'rings': for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.TorusGeometry(r * (1.2 + i * 0.35), r * 0.07, 8, 40), glowMat('#ff70d0', 0.85)), { ring: i }); break;
    case 'crystals': { const cg = new THREE.OctahedronGeometry(r * 0.55, 0).scale(0.5, 1.5, 0.5); for (let i = 0; i < 5; i++) add(new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: ty === 'acero' ? '#d6e0ea' : '#d8f8ff', metalness: ty === 'acero' ? 0.9 : 0.2, roughness: 0.15, emissive: ty === 'acero' ? '#56667a' : '#62d2ea', emissiveIntensity: 0.5, transparent: true, opacity: 0.92, flatShading: true })), { orbit: i / 5, rad: r * 1.1, speed: 3, tilt: true }); break; }
    case 'bubbles': for (let i = 0; i < 5; i++) add(new THREE.Mesh(new THREE.SphereGeometry(r * (0.18 + (i % 3) * 0.08), 12, 10), orbMaterial({ a: '#5e1f7e', b: '#a043d0', c: '#f7e2ff', disp: 0.05, rim: 1.5 })), { orbit: i / 5, rad: r * 1.35, speed: 2.5, bob: true }); break;
    case 'rocks': { const rg = new THREE.DodecahedronGeometry(r * 0.32, 0); for (let i = 0; i < 5; i++) add(new THREE.Mesh(rg, solidMat(i % 2 ? '#8e7a5a' : '#6e5a42', 0.05, 0.9)), { orbit: i / 5, rad: r * 1.3, speed: 5, tumble: true }); orb.scale.setScalar(1.6); orb.material = solidMat('#9a8466', 0.1, 0.9); mats.push(orb.material); break; }
    case 'tornado': for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.TorusGeometry(r * (0.5 + i * 0.35), r * 0.05, 6, 32), glowMat('#e8f0ff', 0.7)), { tornado: i }); break;
    case 'wisps': for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 10), glowMat(ty === 'fantasma' ? '#b48aff' : '#c49ab8', 0.9)), { orbit: i / 3, rad: r * 1.45, speed: 4, bob: true }); break;
    case 'helix': for (let i = 0; i < 2; i++) add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 12, 10), glowMat(i ? '#8ac8ff' : '#c08aff', 1)), { helix: i }); break;
    case 'star': add(new THREE.Mesh(starGeo(), new THREE.MeshStandardMaterial({ color: '#ffd0ee', emissive: '#ff8acb', emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.3 })), { star: true, scale: r * 1.2 }); for (let i = 0; i < 4; i++) add(new THREE.Mesh(starGeo(4, 1, 0.3), glowMat('#ffffff', 0.9)), { orbit: i / 4, rad: r * 1.5, speed: 5, scale: r * 0.3 }); break;
    case 'shock': for (let i = 0; i < 2; i++) add(new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, r * 0.06, 6, 32), glowMat(o.ribbon, 0.8)), { shock: i }); break;
  }
  for (const p of parts) if (p.userData.scale) p.scale.setScalar(p.userData.scale);
  const t0 = performance.now() / 1000;
  let boltT = 0;
  const world = new THREE.Vector3();
  return {
    obj: g, h: 0.6,
    update: (pr, pos, dt) => {
      const t = performance.now() / 1000 - t0, ang = -(pr.a || 0);
      mat.uniforms.uTime.value = t;
      g.rotation.y = ang;   // la «cara» del ataque hacia donde va (las llamas y el tornado, detrás)
      orb.rotation.x += dt * 2; orb.rotation.z += dt * 1.3;
      halo.scale.setScalar(1 + Math.sin(t * 9) * 0.08);
      for (const p of parts) {
        const d = p.userData;
        if (d.orbit !== undefined) {
          const a = (d.orbit + t * d.speed / (Math.PI * 2)) * Math.PI * 2;
          p.position.set(Math.cos(a) * d.rad, (d.bob ? Math.sin(t * 6 + d.orbit * 9) * r * 0.4 : Math.sin(a * 2) * r * 0.3), Math.sin(a) * d.rad);
          if (d.spin) { p.rotation.set(t * 7 + d.orbit * 5, a, t * 3); }
          if (d.tilt) { p.rotation.set(0.6, a, 0.3); }
          if (d.tumble) { p.rotation.x += dt * 5; p.rotation.y += dt * 4; }
        }
        if (d.flame !== undefined) { p.rotation.z = Math.PI / 2; p.position.set(-r * (1.1 + d.flame * 0.2), 0, 0); p.scale.set(1 + Math.sin(t * 20 + d.flame) * 0.15, 1 + d.flame * 0.25, 1); }
        if (d.ring !== undefined) { p.rotation.x = t * 3 + d.ring; p.rotation.y = t * 2.1 + d.ring * 1.7; }
        if (d.tornado !== undefined) { p.rotation.x = Math.PI / 2; p.position.set(0, (d.tornado - 1.5) * r * 0.45, 0); p.rotation.z = t * 12 + d.tornado; p.scale.setScalar(1 + Math.sin(t * 8 + d.tornado) * 0.1); }
        if (d.helix !== undefined) { const a = t * 10 + d.helix * Math.PI; p.position.set(-r * 0.3, Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); }
        if (d.star) { p.rotation.y = t * 4; p.rotation.x = 0.4; }
        if (d.shock !== undefined) { const k = ((t * 1.8 + d.shock * 0.5) % 1); p.scale.setScalar(0.6 + k * 0.9); p.material.opacity = 0.9 * (1 - k); p.rotation.y = Math.PI / 2; }
      }
      if (bolts && (boltT -= dt) <= 0) {
        boltT = 0.05;
        for (const line of bolts) {
          const a = Math.random() * Math.PI * 2, e = Math.random() * 1.4 - 0.7;
          const end = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(r * (1.6 + Math.random()));
          line.geometry.dispose();
          line.geometry = new THREE.BufferGeometry().setFromPoints(boltPoints(new THREE.Vector3(), end, 6, r * 0.5));
        }
      }
      g.getWorldPosition(world);
      ribbon.push(world);
    },
    dispose: () => { ribbon.dispose(); for (const m of mats) m.dispose(); for (const gg of new Set(geos)) gg.dispose(); if (bolts) bolts.forEach(l => l.geometry.dispose()); },
  };
}

// Impacto: onda de choque en anillo que se expande, destello y un estallido de chispas del color del tipo
export function hdImpact(fx, ty, pos, big) {
  const o = ORB[ty] || ORB.normal;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), glowMat(o.ribbon, 0.95));
  ring.material.side = THREE.DoubleSide;
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos); ring.position.y = 0.15;
  fx.addTemp(ring, 380, f => { ring.scale.setScalar(1 + f * (big ? 5 : 3.2)); ring.material.opacity = 0.95 * (1 - f) * (1 - f); });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), orbMaterial({ ...o, additive: true, alpha: 1 }));
  ball.position.copy(pos);
  fx.addTemp(ball, 260, f => { ball.material.uniforms.uTime.value = f * 3; ball.scale.setScalar((big ? 1.6 : 1.1) * (0.6 + f * 1.2)); ball.material.uniforms.uAlpha.value = 1 - f; });
}

// ---------- Golpes, conos, explosiones y auras (estilo 3D) ----------
const typeColor = ty => (ORB[ty] || ORB.normal).ribbon;

// Cuerpo a cuerpo: una hoja de energía curva que barre el arco del golpe, con un filo blanco por dentro
export function hdSlash(fx, pos, a, r, arc, ty) {
  const g = new THREE.Group();
  g.position.copy(pos); g.rotation.y = -a;
  const mk = (r0, r1, color, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40, 1, -arc / 2, arc * 0.01), glowMat(color, op)); m.material.side = THREE.DoubleSide; m.rotation.x = -Math.PI / 2; g.add(m); return m; };
  const outer = mk(r * 0.55, r * 1.3, typeColor(ty), 0.8), inner = mk(r * 0.95, r * 1.08, '#ffffff', 0.95);
  fx.addTemp(g, 260, f => {
    const sweep = Math.min(1, f * 2.2), fade = f < 0.45 ? 1 : 1 - (f - 0.45) / 0.55;
    for (const m of [outer, inner]) {
      const p = m.geometry.parameters, len = arc * Math.max(0.01, sweep);
      m.geometry.dispose();
      m.geometry = new THREE.RingGeometry(p.innerRadius, p.outerRadius, 40, 1, -arc / 2 + (arc - len) * (f > 0.45 ? 1 : 0), len);
      m.material.opacity = (m === inner ? 0.95 : 0.85) * fade;
    }
    g.scale.setScalar(1 + f * 0.25);
  });
}

// Cono (Lanzallamas, Ventisca…): orbes deformados que salen en abanico, crecen y se apagan
export function hdBreath(fx, pos, a, r, arc, ty) {
  const o = ORB[ty] || ORB.normal;
  for (let k = 0; k < 14; k++) {
    const aa = a + (Math.random() - 0.5) * arc * 0.85, delay = k * 18, sz = r * (0.6 + Math.random() * 0.5);
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), orbMaterial({ ...o, alpha: 0.95, disp: Math.min(0.12, o.disp) }));
    m.position.copy(pos); m.position.y = 0.5;
    m.visible = false;
    setTimeout(() => {
      m.visible = true;
      fx.addTemp(m, 380, f => {
        const d = (0.15 + f * 0.85) * r;
        m.position.set(pos.x + Math.cos(aa) * d, 0.45 + f * 0.25, pos.z + Math.sin(aa) * d);
        m.scale.setScalar(sz * (0.05 + f * 0.12));
        m.material.uniforms.uTime.value = f * 4 + k;
        m.material.uniforms.uAlpha.value = 0.95 * (1 - f * f);
      });
    }, delay);
  }
}

// Explosión o ataque de zona: onda de choque del tamaño de la zona y bola de energía del tipo
export function hdBoom(fx, pos, r, ty) {
  const o = ORB[ty] || ORB.normal;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), glowMat(o.ribbon, 0.9));
  ring.material.side = THREE.DoubleSide; ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos); ring.position.y = 0.12;
  fx.addTemp(ring, 520, f => { ring.scale.setScalar(Math.max(0.05, r * (0.3 + f * 1.1))); ring.material.opacity = 0.9 * (1 - f); });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), orbMaterial({ ...o, alpha: 0.9, disp: Math.min(0.2, o.disp * 1.5) }));
  hdSpikes(fx, pos, r, ty);   // rocas o cristales, según el tipo
  hdAreaExtra(fx, pos, r, ty);   // y lo propio de cada tipo
  ball.position.copy(pos); ball.position.y = 0.4;
  fx.addTemp(ball, 420, f => { ball.material.uniforms.uTime.value = f * 3; ball.scale.setScalar(Math.max(0.1, r * 0.45 * (0.4 + f))); ball.material.uniforms.uAlpha.value = (1 - f) * 0.9; });
}

// Aura al curarse o mejorarse: una espiral de anillos que suben girando y una columna de luz
export function hdAura(fx, pos, color) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.4, 24, 1, true), glowMat(color, 0.35));
  col.material.side = THREE.DoubleSide;
  col.position.copy(pos); col.position.y = 1.2;
  fx.addTemp(col, 900, f => { col.material.opacity = 0.35 * Math.sin(f * Math.PI); col.scale.set(1 - f * 0.3, 0.5 + f * 0.7, 1 - f * 0.3); });
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 36), glowMat(color, 0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.visible = false;
    setTimeout(() => {
      ring.visible = true;
      fx.addTemp(ring, 750, f => { ring.position.y = 0.1 + f * 2.2; ring.scale.setScalar(1 - f * 0.55); ring.rotation.z = f * 6; ring.material.opacity = 0.9 * (1 - f); });
    }, k * 140);
  }
}

// Rayo (Hidrobomba, Rayo Hielo, Hiperrayo…): un núcleo de energía con textura que fluye, dos espirales que
// se enroscan alrededor, un orbe en la boca y una salpicadura donde pega. Se abre rápido y se estrecha al apagarse
export function hdBeam(fx, a, b, w, ty) {
  if (ty === 'electrico') return hdBolt(fx, a, b, w);
  const o = ORB[ty] || ORB.normal, len = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  const g = new THREE.Group();
  g.position.copy(a); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.32, len, 20, 24, true), orbMaterial({ ...o, alpha: 0.95, disp: 0.04, scale: 1.4, speed: 6 }));
  core.rotation.x = Math.PI / 2; core.position.z = len / 2;
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.6, w * 0.6, len, 16, 1, true), glowMat(o.ribbon, 0.18));
  glow.rotation.x = Math.PI / 2; glow.position.z = len / 2;
  g.add(core, glow);
  const spirals = [0, 1].map(k => {
    const pts = [];
    for (let i = 0; i <= 80; i++) { const z = i / 80 * len, an = z * 2.4 + k * Math.PI; pts.push(new THREE.Vector3(Math.cos(an) * w * 0.55, Math.sin(an) * w * 0.55, z)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, w * 0.06, 6), glowMat(k ? o.c : o.ribbon, 0.9));
    g.add(m); return m;
  });
  const mouth = new THREE.Mesh(new THREE.IcosahedronGeometry(w * 0.7, 3), orbMaterial({ ...o, alpha: 0.95 }));
  const end = new THREE.Mesh(new THREE.IcosahedronGeometry(w * 0.8, 3), orbMaterial({ ...o, alpha: 0.9, disp: 0.25 }));
  end.position.z = len;
  g.add(mouth, end);
  fx.addTemp(g, 380, f => {
    const open = Math.min(1, f * 6), close = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, s = Math.max(0.05, open * close);
    for (const m of [core, glow]) m.scale.set(s, 1, s);
    for (const [k, m] of spirals.entries()) { m.scale.set(s, s, 1); m.rotation.z = f * 14 * (k ? -1 : 1); m.material.opacity = 0.9 * close; }
    glow.material.opacity = 0.18 * close;
    for (const m of [core, mouth, end]) { m.material.uniforms.uTime.value = f * 3; m.material.uniforms.uAlpha.value = 0.95 * close; }
    mouth.scale.setScalar(0.6 + 0.5 * Math.sin(f * 40) * 0.2 + s * 0.4);
    end.scale.setScalar(s * (1 + f * 0.8));
  });
  hdImpact(fx, ty, b, w > 0.6);
}

// Terremoto: grietas que se abren desde el centro y picos de roca que salen del suelo al paso de la onda
export function hdQuake(fx, pos, maxR, life) {
  // Grietas: tiras en zigzag que se estrechan hacia la punta y se van abriendo desde el centro
  for (let k = 0; k < 9; k++) {
    const an = k / 9 * Math.PI * 2 + Math.random() * 0.4, L = 1.8 + Math.random() * 2.6, N = 10, pos3 = [];
    let x = 0, z = 0, dirA = an;
    for (let i = 0; i <= N; i++) {
      const w = 0.16 * (1 - i / N) + 0.02, nx = -Math.sin(dirA), nz = Math.cos(dirA);
      pos3.push(x + nx * w, 0, z + nz * w, x - nx * w, 0, z - nz * w);
      dirA = an + (Math.random() - 0.5) * 0.9; x += Math.cos(dirA) * L / N; z += Math.sin(dirA) * L / N;
    }
    const geo = new THREE.BufferGeometry(), idx = [];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3));
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    const c = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#24160a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    c.position.set(pos.x, 0.03, pos.z);
    fx.addTemp(c, life, f => {
      geo.setDrawRange(0, Math.ceil(Math.min(1, f * 5) * N) * 6);
      c.material.opacity = 0.9 * (f < 0.7 ? 1 : (1 - f) / 0.3);
    });
  }
  const rockMat = solidMat('#8a6a42', 0.08, 0.95, 0);
  let last = 0;
  fx.addTemp(new THREE.Group(), life, f => {
    if (f - last < 0.012) return;
    last = f;
    const R = f * maxR;
    for (let k = 0; k < 5; k++) {
      const an = Math.random() * Math.PI * 2, h = 0.7 + Math.random() * 0.8;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.25 + Math.random() * 0.2, h, 5), rockMat);
      sp.position.set(pos.x + Math.cos(an) * R, -h / 2, pos.z + Math.sin(an) * R);
      sp.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5);
      // (después del bucle de actualización, que si no se la come)
      queueMicrotask(() => fx.addTemp(sp, 700, g => { sp.position.y = h * (g < 0.25 ? g / 0.25 : 1 - (g - 0.25) / 0.75) * 0.9 - h / 2; }));
    }
  });
}

// Embestida (Nitrocarga, Acua Jet, Golpe Aéreo…): dos estelas del tipo que siguen al Pokémon mientras carga
// (una ancha a media altura y un filo blanco), y se recogen solas al pararse
export function hdDash(fx, obj, ty, dur) {
  const o = ORB[ty] || ORB.normal;
  const wide = new Ribbon(fx.scene, o.ribbon, 0.45, 18), edge = new Ribbon(fx.scene, '#ffffff', 0.12, 18);
  const p = new THREE.Vector3(), g = new THREE.Group();
  g.add(wide.mesh, edge.mesh);   // dentro del grupo, para que se recojan con él
  fx.addTemp(g, (dur + 0.35) * 1000, () => {
    p.copy(obj.position);
    wide.push(p.setY(0.55)); edge.push(p.setY(0.85));
  });
}

// Rayo eléctrico: un núcleo blanco muy fino, tres descargas en zigzag que se redibujan sin parar alrededor,
// el halo amarillo y chispas en la boca y donde pega
function hdBolt(fx, a, b, w) {
  const o = ORB.electrico, len = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  const g = new THREE.Group();
  g.position.copy(a); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.1, w * 0.1, len, 8, 1, true), glowMat('#ffffff', 1));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, len, 16, 1, true), glowMat('#ffd21a', 0.22));
  for (const m of [core, glow]) { m.rotation.x = Math.PI / 2; m.position.z = len / 2; g.add(m); }
  const bolts = [0, 1, 2].map(k => { const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(k ? '#fff36a' : '#ffffff').multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.add(l); return l; });
  const tubes = [];
  const redraw = () => {
    for (const t of tubes) { g.remove(t); t.geometry.dispose(); }
    tubes.length = 0;
    for (const [k, l] of bolts.entries()) {
      const pts = [];
      for (let i = 0; i <= 18; i++) { const z = i / 18 * len, j = i && i < 18 ? w * (0.25 + k * 0.12) : 0; pts.push(new THREE.Vector3((Math.random() - 0.5) * 2 * j, (Math.random() - 0.5) * 2 * j, z)); }
      l.geometry.dispose(); l.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      if (k === 0) { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 72, w * 0.05, 4), glowMat('#fff7b0', 0.95)); g.add(t); tubes.push(t); }
    }
  };
  const mouth = new THREE.Mesh(new THREE.IcosahedronGeometry(w * 0.6, 3), orbMaterial({ ...o, alpha: 0.95 }));
  const end = new THREE.Mesh(new THREE.IcosahedronGeometry(w * 0.7, 3), orbMaterial({ ...o, alpha: 0.9, disp: 0.2 }));
  end.position.z = len; g.add(mouth, end);
  let last = -1;
  fx.addTemp(g, 380, f => {
    const close = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, s = Math.max(0.05, Math.min(1, f * 6) * close);
    if (f - last > 0.1) { last = f; redraw(); }
    for (const l of bolts) l.material.opacity = close;
    for (const t of tubes) t.material.opacity = 0.95 * close;
    core.scale.set(s, 1, s); glow.scale.set(s, 1, s); glow.material.opacity = 0.22 * close;
    for (const m of [mouth, end]) { m.material.uniforms.uTime.value = f * 4; m.material.uniforms.uAlpha.value = 0.95 * close; }
    end.scale.setScalar(s * (1 + f * 0.6));
  });
  hdImpact(fx, 'electrico', b, w > 0.6);
}

// Picos que salen del suelo en corona (rocas en tierra y roca, cristales en hielo y acero) para las explosiones de zona
const SPIKES = { tierra: ['#8a6a42', 0.08, 0.95, 0], roca: ['#9a8a6a', 0.08, 0.95, 0], hielo: ['#bff3ff', 0.35, 0.15, 0.3], acero: ['#cad6e2', 0.2, 0.25, 0.8] };
export function hdSpikes(fx, pos, r, ty) {
  const s = SPIKES[ty];
  if (!s) return;
  const mat = solidMat(...s), n = Math.round(8 + r * 4);
  for (let k = 0; k < n; k++) {
    const an = k / n * Math.PI * 2 + Math.random() * 0.3, d = r * (0.35 + Math.random() * 0.6), h = 0.5 + Math.random() * 0.7 + r * 0.15;
    const sp = new THREE.Mesh(ty === 'hielo' || ty === 'acero' ? new THREE.OctahedronGeometry(0.22 + Math.random() * 0.12, 0) : new THREE.ConeGeometry(0.22 + Math.random() * 0.15, h, 5), mat);
    if (ty === 'hielo' || ty === 'acero') sp.scale.set(1, h * 2.2, 1);
    sp.position.set(pos.x + Math.cos(an) * d, -h / 2, pos.z + Math.sin(an) * d);
    sp.rotation.set(Math.cos(an) * 0.35, Math.random() * 3, -Math.sin(an) * 0.35);
    const delay = d / r * 0.25;
    fx.addTemp(sp, 800, f => { const g = Math.max(0, (f - delay) / (1 - delay)); sp.position.y = h * (g < 0.2 ? g / 0.2 : g < 0.7 ? 1 : 1 - (g - 0.7) / 0.3) * 0.9 - h / 2; });
  }
}

// Teletransporte: anillos que se cierran sobre el Pokémon de arriba abajo y un destello
export function hdBlink(fx, pos) {
  for (let k = 0; k < 3; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 40), glowMat(k === 1 ? '#ffffff' : '#ff8ad0', 0.95));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.3 + k * 0.5, pos.z);
    fx.addTemp(ring, 420, f => { ring.scale.setScalar(Math.max(0.05, 1 - f) * (1 + k * 0.15)); ring.position.y = 0.3 + k * 0.5 + f * (0.6 - k * 0.5); ring.material.opacity = 0.95 * (1 - f * f); });
  }
  const o = ORB.psiquico, flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 3), orbMaterial({ ...o, alpha: 0.9 }));
  flash.position.set(pos.x, 0.7, pos.z);
  fx.addTemp(flash, 380, f => { flash.scale.setScalar(f < 0.6 ? 0.3 + f * 1.5 : (1 - f) * 3); flash.material.uniforms.uTime.value = f * 3; flash.material.uniforms.uAlpha.value = 0.9 * (1 - f); });
}

// Trueno: un rayo grueso que cae del cielo con ramas, parpadea redibujándose 3 veces, y al tocar el suelo
// suelta descargas en zigzag por el suelo hasta el borde de la zona y una marca quemada
export function hdThunder(fx, pos, r) {
  const g = new THREE.Group();
  const draw = () => {
    for (const c of [...g.children]) { g.remove(c); c.geometry.dispose(); }
    const pts = [];
    for (let k = 0; k <= 12; k++) { const y = 10 - k * 10 / 12, j = k && k < 12 ? 0.55 : 0; pts.push(new THREE.Vector3(pos.x + (Math.random() - 0.5) * j * 2, y, pos.z + (Math.random() - 0.5) * j * 2)); }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.09, 5), glowMat('#ffffff', 1)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.28, 6), glowMat('#ffe04a', 0.45)));
    for (let b = 0; b < 3; b++) {   // ramas
      const from = pts[3 + b * 3], bp = [from];
      for (let k = 1; k <= 4; k++) bp.push(from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.6 * k / 2, -k * 0.55, (Math.random() - 0.5) * 1.6 * k / 2)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp, false, 'catmullrom', 0), 12, 0.04, 4), glowMat('#fff3a0', 0.9)));
    }
  };
  draw();
  let flick = 0;
  fx.addTemp(g, 420, f => {
    const k = Math.floor(f * 4);
    if (k !== flick && k < 3) { flick = k; draw(); }
    const on = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
    g.children.forEach((c, i) => { c.material.opacity = (i === 1 ? 0.45 : i === 0 ? 1 : 0.9) * on * (Math.random() < 0.15 ? 0.4 : 1); });
  });
  // Descargas por el suelo
  for (let k = 0; k < 6; k++) {
    const an = k / 6 * Math.PI * 2 + Math.random() * 0.5, pts = [];
    for (let i = 0; i <= 8; i++) { const d = i / 8 * r, w = i && i < 8 ? 0.25 : 0; pts.push(new THREE.Vector3(pos.x + Math.cos(an) * d + (Math.random() - 0.5) * w, 0.08, pos.z + Math.sin(an) * d + (Math.random() - 0.5) * w)); }
    const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 24, 0.035, 4), glowMat(k % 2 ? '#ffffff' : '#ffe04a', 0.95));
    arc.visible = false;
    setTimeout(() => { arc.visible = true; fx.addTemp(arc, 320, f => { arc.material.opacity = 0.95 * (1 - f) * (Math.random() < 0.2 ? 0.3 : 1); }); }, 60 + k * 15);
  }
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 32), new THREE.MeshBasicMaterial({ color: '#1a1408', transparent: true, opacity: 0.5, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(pos.x, 0.03, pos.z);
  fx.addTemp(scorch, 1400, f => { scorch.material.opacity = 0.5 * (1 - f); });
}

// Surf: el agua de la ola con textura que fluye hacia la cresta (ruido que sube), brillos de fresnel en el
// borde, vetas de espuma que se mueven y la espuma del labio más viva. Usa los colores por vértice de la ola
export function hdWaveMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `${NOISE}
      uniform float uTime; varying vec3 vCol, vNormal, vView, vPos; varying float vN;
      attribute vec3 color;
      void main(){
        vCol = color; vPos = position;
        vN = snoise(vec3(position.x * 1.6, position.y * 2.5 - uTime * 2.2, position.z * 1.6 + uTime * 0.6));
        vec3 p = position + normal * vN * 0.05;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vCol, vNormal, vView, vPos; varying float vN;
      void main(){
        float fres = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
        float streak = smoothstep(0.45, 0.85, vN);
        vec3 col = vCol * (0.8 + 0.25 * vN) + vec3(0.6, 0.85, 1.0) * fres * 0.35 + vec3(0.85, 0.95, 1.0) * streak * 0.18;
        float foam = smoothstep(0.92, 1.0, vCol.r);
        col = mix(col, vec3(1.0), foam * (0.6 + 0.4 * vN));
        gl_FragColor = vec4(col, 0.94);
      }`,
    transparent: true, side: THREE.DoubleSide, toneMapped: false,
  });
}

// Estela de espuma que deja la ola a ras de suelo
export function hdWake(scene, width) {
  return new Ribbon(scene, '#7ac8f0', width, 20);
}

// Lo propio de cada tipo en los ataques de zona (encima de la onda y la bola de hdBoom):
// dragón, un cometa que cae con estela · volador, un tornado de anillos que sube · psíquico, anillos que laten
// hacia arriba · hada, estrellas que salen disparadas · fantasma, fuegos fatuos que suben en espiral ·
// siniestro, zarcillos oscuros que se cierran · veneno, burbujas que suben y revientan
export function hdAreaExtra(fx, pos, r, ty) {
  const o = ORB[ty] || ORB.normal;
  if (ty === 'dragon') {
    const comet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 3), orbMaterial({ ...o, alpha: 0.95, disp: 0.25 }));
    const trail = new Ribbon(fx.scene, o.ribbon, 0.4, 16), g = new THREE.Group();
    g.add(comet, trail.mesh);
    const from = new THREE.Vector3(pos.x - 4, 9, pos.z - 2);
    fx.addTemp(g, 300, f => { comet.position.lerpVectors(from, pos, f * f); comet.material.uniforms.uTime.value = f * 4; trail.push(comet.position); });
  } else if (ty === 'volador') {
    for (let k = 0; k < 6; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (0.35 + k * 0.1), 0.05, 6, 40), glowMat('#e8f0ff', 0.8));
      ring.rotation.x = -Math.PI / 2;
      fx.addTemp(ring, 650, f => { ring.position.set(pos.x + Math.sin(f * 9 + k) * 0.2, 0.2 + k * 0.45 + f * 0.8, pos.z + Math.cos(f * 9 + k) * 0.2); ring.rotation.z = f * 12; ring.material.opacity = 0.8 * Math.sin(f * Math.PI); });
    }
  } else if (ty === 'psiquico') {
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, 0.06, 8, 48), glowMat(k === 1 ? '#ffffff' : '#ff70d0', 0.9));
      ring.rotation.x = -Math.PI / 2; ring.visible = false;
      setTimeout(() => { ring.visible = true; fx.addTemp(ring, 500, f => { ring.position.set(pos.x, 0.2 + f * 2.2, pos.z); ring.scale.setScalar(1 - f * 0.6); ring.material.opacity = 0.9 * (1 - f); }); }, k * 110);
    }
  } else if (ty === 'hada') {
    for (let k = 0; k < 10; k++) {
      const an = k / 10 * Math.PI * 2, st = new THREE.Mesh(starGeo(5, 1, 0.45), glowMat(k % 2 ? '#ffffff' : '#ffb0e0', 0.95));
      st.scale.setScalar(0.18);
      fx.addTemp(st, 600, f => { const d = r * (0.2 + f * 0.9); st.position.set(pos.x + Math.cos(an) * d, 0.4 + Math.sin(f * Math.PI) * 1.4, pos.z + Math.sin(an) * d); st.rotation.set(f * 6, f * 9, 0); st.lookAt(fx.scene.position.x, 20, fx.scene.position.z); st.material.opacity = 0.95 * (1 - f * f); });
    }
  } else if (ty === 'fantasma' || ty === 'siniestro') {
    for (let k = 0; k < 7; k++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glowMat(ty === 'fantasma' ? '#b48aff' : '#c49ab8', 0.9));
      const tr = new Ribbon(fx.scene, ty === 'fantasma' ? '#7a5ad0' : '#4a2a3a', 0.12, 12), g = new THREE.Group();
      g.add(w, tr.mesh);
      const a0 = k / 7 * Math.PI * 2, inward = ty === 'siniestro';
      fx.addTemp(g, 700, f => {
        const rad = r * (inward ? 1 - f * 0.9 : 0.3 + f * 0.5), an = a0 + f * 5;
        w.position.set(pos.x + Math.cos(an) * rad, 0.3 + (inward ? 0.4 : f * 2.2), pos.z + Math.sin(an) * rad);
        tr.push(w.position); w.material.opacity = 0.9 * (1 - f);
      });
    }
  } else if (ty === 'veneno') {
    for (let k = 0; k < 12; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), orbMaterial({ ...o, alpha: 0.85, disp: 0.1 }));
      const an = Math.random() * Math.PI * 2, d = Math.random() * r * 0.8, sz = 0.12 + Math.random() * 0.15, delay = Math.random() * 0.4;
      b.position.set(pos.x + Math.cos(an) * d, 0.1, pos.z + Math.sin(an) * d);
      fx.addTemp(b, 900, f => { const g2 = Math.max(0, (f - delay) / (1 - delay)); b.position.y = 0.1 + g2 * 1.4; b.scale.setScalar(g2 > 0.85 ? sz * (1 + (g2 - 0.85) * 8) : sz * Math.min(1, g2 * 4 + 0.01)); b.material.uniforms.uAlpha.value = g2 > 0.85 ? 0.85 * (1 - (g2 - 0.85) / 0.15) : 0.85; });
    }
  }
}

// ---------- Mecánicas de las arenas (estilo 3D) ----------
// Géiser: una columna de agua con textura que sube de golpe, se sostiene y cae, con un anillo de salpicadura
export function hdGeyser(fx, pos, r) {
  const o = ORB.agua;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.5, 1, 18, 8, true), orbMaterial({ ...o, alpha: 0.9, disp: 0.12, speed: 5 }));
  col.material.side = THREE.DoubleSide;
  col.position.copy(pos);
  fx.addTemp(col, 900, f => {
    const h = f < 0.18 ? f / 0.18 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, H = Math.max(0.02, h * 3.2);
    col.scale.set(1, H, 1); col.position.y = H / 2;
    col.material.uniforms.uTime.value = f * 6; col.material.uniforms.uAlpha.value = 0.9 * Math.min(1, h * 2);
  });
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.45, 3), orbMaterial({ ...o, alpha: 0.9, disp: 0.3 }));
  fx.addTemp(crown, 900, f => {
    const h = f < 0.18 ? f / 0.18 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
    crown.position.set(pos.x, Math.max(0.02, h * 3.2), pos.z); crown.scale.setScalar(0.4 + h * 0.8);
    crown.material.uniforms.uTime.value = f * 5; crown.material.uniforms.uAlpha.value = 0.9 * h;
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.06, 6, 40), glowMat('#bff0ff', 0.8));
  ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.08, pos.z);
  fx.addTemp(ring, 600, f => { ring.scale.setScalar(0.4 + f * 1.1); ring.material.opacity = 0.8 * (1 - f); });
}

// Pozo de gravedad: durante el aviso, anillos que se cierran despacio; al atraer, una espiral de anillos morados
// que gira y se hunde hacia el centro, y polvo que entra en espiral
export function hdGravity(fx, center, warn, dur) {
  const total = (warn + dur) * 1000;
  for (let k = 0; k < 5; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), glowMat(k % 2 ? '#c8a8ff' : '#6a40c8', 0.8));
    ring.rotation.x = -Math.PI / 2;
    fx.addTemp(ring, total, f => {
      const live = f * total / 1000 > warn, ph = ((f * total / 1000) * (live ? 0.9 : 0.35) + k / 5) % 1;
      ring.scale.setScalar(Math.max(0.05, (1 - ph) * (live ? 4.2 : 3)));
      ring.position.set(center.x, 0.06 + ph * 0.25, center.z);
      ring.material.opacity = (live ? 0.85 : 0.35) * Math.sin(ph * Math.PI) * (f > 0.95 ? (1 - f) / 0.05 : 1);
    });
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 3), orbMaterial({ ...ORB.siniestro, alpha: 0.9, disp: 0.25 }));
  core.position.set(center.x, 0.5, center.z);
  fx.addTemp(core, total, f => { const s = f * total / 1000 > warn ? 1 : 0.4; core.scale.setScalar(s * (0.8 + Math.sin(f * 40) * 0.08)); core.material.uniforms.uTime.value = f * 8; core.material.uniforms.uAlpha.value = 0.9 * (f > 0.95 ? (1 - f) / 0.05 : 1); });
}

// Hielo que se rompe: esquirlas de cristal que saltan y un anillo blanco
export function hdCrack(fx, pos) {
  const mat = new THREE.MeshStandardMaterial({ color: '#dff6ff', emissive: '#7ad0f0', emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.2, flatShading: true });
  for (let k = 0; k < 8; k++) {
    const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 + Math.random() * 0.08, 0), mat);
    const a = k / 8 * Math.PI * 2, v = 1.5 + Math.random();
    sh.scale.set(1, 1.8, 1);
    fx.addTemp(sh, 600, f => { sh.position.set(pos.x + Math.cos(a) * f * v, 0.1 + Math.sin(f * Math.PI) * 0.8, pos.z + Math.sin(a) * f * v); sh.rotation.set(f * 9, f * 7, 0); });
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 32), glowMat('#ffffff', 0.8));
  ring.material.side = THREE.DoubleSide; ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.06, pos.z);
  fx.addTemp(ring, 400, f => { ring.scale.setScalar(1 + f * 1.5); ring.material.opacity = 0.8 * (1 - f); });
}

// Agua electrificada: descargas cortas en zigzag sobre las casillas de agua (como mucho 30)
export function hdZapWater(fx, cells) {
  for (const c of cells.slice(0, 30)) {
    const pts = [];
    for (let i = 0; i <= 5; i++) pts.push(new THREE.Vector3(c.x - 0.4 + i * 0.16, 0.12 + Math.random() * 0.12, c.z + (Math.random() - 0.5) * 0.5));
    const bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 10, 0.03, 4), glowMat(Math.random() < 0.5 ? '#ffffff' : '#ffe04a', 0.95));
    bolt.rotation.y = Math.random() * Math.PI;
    bolt.position.set(0, 0, 0);
    fx.addTemp(bolt, 300 + Math.random() * 200, f => { bolt.material.opacity = 0.95 * (1 - f) * (Math.random() < 0.25 ? 0.3 : 1); });
  }
}

// Rebote en un espejo: un destello en forma de rombo
export function hdMirrorFlash(fx, pos) {
  const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), glowMat('#e8fbff', 0.95));
  d.position.set(pos.x, 0.65, pos.z);
  fx.addTemp(d, 260, f => { d.scale.set(1 + f * 1.5, 1 + f * 2.5, 0.2); d.material.opacity = 0.95 * (1 - f); });
}
