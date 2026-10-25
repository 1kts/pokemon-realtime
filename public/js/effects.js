// Efectos visuales de los movimientos en 3D: telegrafiado en el suelo durante la preparación,
// proyectiles con forma propia, rayos, golpes en arco, explosiones por tipo, Protección, etc.
import * as THREE from 'three';
import { U, toWorld, softDisc } from './world.js';
import { PALETTE, SMOKE, DUST, vivid } from './particles.js';

// Suelo claro (lo decide World.applyTheme): sin brillo aditivo, que sobre blanco no se ve; los colores
// pasan a su versión intensa (vivid) en vez de apagarse
let BRIGHT = false;
const INK = '#1b2a52';   // color de los avisos propios sobre suelo claro

const { MOVES, TYPE_COLOR } = Data;
const glowTex = softDisc('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

function additive(color, opacity = 1) {
  if (BRIGHT) {
    const c = new THREE.Color(color);
    c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1));   // los «sobre-brillantes» (bright()) sin quemarse a blanco
    return new THREE.MeshBasicMaterial({ color: vivid('#' + c.getHexString()), transparent: true, opacity: Math.min(1, opacity * 1.15), depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  }
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
}
function glowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}
const bright = (hex, k = 1.8) => new THREE.Color(hex).multiplyScalar(k);

// Textura de Poké Ball
function ballTexture(top) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = top; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 16, 64, 16);
  g.fillStyle = '#222'; g.fillRect(0, 14, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const BALL_COLORS = { pokeball: '#e83030', superball: '#2f6fe0', ultraball: '#303030', masterball: '#7a3cc8' };

export class Effects {
  constructor(world, particles) {
    this.world = world;
    this.scene = world.scene;
    this.p = particles;
    this.proj = new Map();       // id -> objeto 3D del proyectil
    this.tele = [null, null];    // telegrafiado de cada bando
    this.temp = [];              // efectos con duración: { obj, t0, life, update(f) }
    this.protect = [null, null];
    this.shake = 0;
    // Luces de destello reutilizables: añadir/quitar luces obliga a recompilar shaders (tirones)
    this.lights = Array.from({ length: 4 }, () => {
      const l = new THREE.PointLight('#ffffff', 0, 8, 1.5);
      l.userData = { t0: 0, ms: 1, peak: 0 };
      this.scene.add(l);
      return l;
    });
  }

  setBright(on) { BRIGHT = !!on; }

  addTemp(obj, life, update) {
    this.scene.add(obj);
    this.temp.push({ obj, t0: performance.now(), life, update });
  }

  // ---------- Telegrafiado (preparación de un ataque) ----------
  // side: índice del bando · w: { c, p, a, tx, ty } de la instantánea · move: datos del movimiento
  telegraph(i, pos, w, move, mine) {
    let t = this.tele[i];
    const key = w ? `${w.c}:${move.name}:${w.a}:${w.tx}:${w.ty}` : null;
    if (!w || !move) { if (t) { this.scene.remove(t.obj); this.tele[i] = null; } return; }
    if (!t || t.key !== key) {
      if (t) this.scene.remove(t.obj);
      t = this.tele[i] = { key, obj: this.makeTelegraph(move, w, mine) };
      this.scene.add(t.obj);
    }
    const g = t.obj;
    if (g.userData.atCaster) g.position.copy(toWorld(pos.x, pos.y, 0.04));
    // Objetivo de un proyectil que explota y fila de impactos: relativos al lanzador (que se mueve)
    for (const key of ['target', 'line']) {
      const d = g.userData[key];
      if (!d) continue;
      let dx = d.tx - pos.x, dy = d.ty - pos.y;
      const len = Math.hypot(dx, dy) || 1, max = d.max || move.maxRange || len;
      if (len > max) { dx *= max / len; dy *= max / len; }
      if (key === 'target') d.obj.position.set(dx * U, 0, dy * U);
      else for (const c of d.g.children) c.position.set(dx * U * c.userData.f, 0, dy * U * c.userData.f);
    }
    if (g.userData.fill) g.userData.fill.scale.setScalar(Math.max(0.02, Math.min(1, w.p)));
    if (g.userData.bar) g.userData.bar.scale.x = Math.max(0.02, Math.min(1, w.p));
    g.userData.edge && (g.userData.edge.material.opacity = 0.5 + Math.sin(performance.now() / 60) * 0.25);
  }

  makeTelegraph(m, w, mine) {
    const col = mine ? (BRIGHT ? INK : '#ffffff') : TYPE_COLOR[m.type];
    const g = new THREE.Group();
    const base = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false });
    const strong = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false });
    const flat = mesh => { mesh.rotation.x = -Math.PI / 2; return mesh; };
    if (m.kind === 'area' && m.count && m.pattern === 'line') {
      // Impactos en fila hacia el cursor (Avalancha): un círculo por impacto
      const g2 = new THREE.Group();
      const r = m.radius * U;
      for (let k = 1; k <= m.count; k++) {
        const c = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 32), base));
        c.userData.f = k / m.count;
        g2.add(c);
      }
      g.add(g2);
      g.userData.line = { g: g2, tx: w.tx, ty: w.ty };
      g.userData.atCaster = true;
    } else if (m.kind === 'area') {
      const r = (m.radius + (m.count ? m.scatter || 70 : 0)) * U;   // con varios impactos, la zona donde pueden caer
      g.add(flat(new THREE.Mesh(new THREE.CircleGeometry(r, 48), base)));
      const fill = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 48), strong));
      g.add(fill); g.userData.fill = fill;
      const edge = flat(new THREE.Mesh(new THREE.RingGeometry(r * 0.96, r, 48), strong.clone()));
      g.add(edge); g.userData.edge = edge;
      if (m.at === 'self') g.userData.atCaster = true;
      else g.position.copy(toWorld(w.tx, w.ty, 0.04));
    } else if (m.kind === 'melee' || m.kind === 'cone') {
      const r = (m.range + (m.kind === 'melee' ? 22 : 0)) * U;
      const sector = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 24, -m.arc / 2, m.arc), base));
      sector.rotation.z = -w.a;
      g.add(sector);
      const fill = flat(new THREE.Mesh(new THREE.CircleGeometry(r, 24, -m.arc / 2, m.arc), strong));
      fill.rotation.z = -w.a;
      g.add(fill); g.userData.fill = fill;
      g.userData.atCaster = true;
    } else if (['proj', 'beam', 'dash', 'blink', 'wave'].includes(m.kind)) {
      const len = (m.kind === 'beam' ? m.len : m.kind === 'wave' ? m.range : m.kind === 'proj' ? Math.min(m.range, 340) : m.dist) * U;
      const wid = (m.kind === 'beam' ? m.width : m.kind === 'wave' ? m.width : m.kind === 'proj' ? m.radius * 2 + 6 : 40) * U;
      // Los que explotan marcan además dónde van a estallar
      if (m.explode) {
        const ring = flat(new THREE.Mesh(new THREE.RingGeometry(m.explode * U * 0.9, m.explode * U, 40), strong.clone()));
        const disc = flat(new THREE.Mesh(new THREE.CircleGeometry(m.explode * U, 40), base));
        const target = new THREE.Group();
        target.add(ring, disc);
        g.add(target);
        g.userData.target = { obj: target, tx: w.tx, ty: w.ty, max: m.maxRange };
        g.userData.edge = ring;
      }
      const geo = new THREE.PlaneGeometry(len, wid).translate(len / 2, 0, 0);
      const holder = new THREE.Group();
      holder.add(flat(new THREE.Mesh(geo, base)));
      const bar = flat(new THREE.Mesh(geo, strong));
      holder.add(bar);
      holder.rotation.y = -w.a;
      g.add(holder);
      g.userData.bar = bar;
      g.userData.atCaster = true;
      if (m.kind === 'proj' && (m.count || 1) > 1) {
        for (const s of [-1, 1]) {
          const side = new THREE.Group();
          side.add(flat(new THREE.Mesh(geo, base)));
          side.rotation.y = -(w.a + s * m.spread * ((m.count - 1) / 2));
          g.add(side);
        }
      }
    } else {
      const ring = flat(new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), strong));
      g.add(ring); g.userData.fill = ring; g.userData.atCaster = true;
    }
    g.renderOrder = 2;
    return g;
  }

  // ---------- Proyectiles ----------
  syncProjectiles(list, ownerPos, dt) {
    const seen = new Set();
    for (const pr of list) {
      seen.add(pr.id);
      let o = this.proj.get(pr.id);
      if (!o) { o = this.makeProjectile(pr); this.proj.set(pr.id, o); this.scene.add(o.obj); }
      const pos = toWorld(pr.x, pr.y, o.h);
      o.obj.position.copy(pos);
      o.update && o.update(pr, pos, dt, ownerPos[pr.o]);
    }
    for (const [id, o] of this.proj) if (!seen.has(id)) { this.scene.remove(o.obj); o.dispose && o.dispose(); this.proj.delete(id); }
  }

  makeProjectile(pr) {
    const p = this.p;
    if (pr.ball) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ map: ballTexture(BALL_COLORS[pr.ball]), roughness: 0.3 }));
      m.castShadow = true;
      return { obj: m, h: 0.6, update: (_, pos, dt) => { m.rotation.z -= dt * 14; p.trickle(30, dt, pos.x, pos.y, pos.z, { colors: ['#ffffff'], layer: 'glow', speed: 0.3, life: 0.25, size: 0.2 }); } };
    }
    const m = MOVES[pr.mk];
    const ty = m.type, pal = PALETTE[ty] || ['#ffffff'];
    if (pr.w) {
      // Ola: un rodillo de agua tumbado a lo largo del frente (se ve desde cualquier ángulo) con cresta de espuma
      const W = pr.w * 2 * U;
      const holder = new THREE.Group();
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, W, 16, 1), new THREE.MeshStandardMaterial({ color: '#3f8fe0', transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.15 }));
      roll.rotation.z = Math.PI / 2; roll.scale.set(1, 1, 0.75);
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, W * 0.96, 10, 1), new THREE.MeshStandardMaterial({ color: '#f2fbff', transparent: true, opacity: 0.9, roughness: 0.6 }));
      foam.rotation.z = Math.PI / 2; foam.position.set(0, 0.28, 0.12);
      holder.add(roll, foam);
      const wg = new THREE.Group();
      wg.add(holder);
      return {
        obj: wg, h: 0.4,
        update: (pr2, pos, dt) => {
          holder.rotation.y = -pr2.a - Math.PI / 2;   // el rodillo, perpendicular a la dirección en que avanza
          for (let k = 0; k < 3; k++) {
            const o = (Math.random() - 0.5) * W, ca = Math.cos(pr2.a), sa = Math.sin(pr2.a);
            p.emit(pos.x - sa * o, 0.8, pos.z + ca * o, { n: 1, colors: ['#ffffff', '#cfefff'], layer: 'solid', dir: [ca, 1, sa], spread: 0.4, speed: 2, life: 0.4, size: 0.1, grav: 9 });
          }
        },
      };
    }
    const r = pr.r * U;
    const g = new THREE.Group();
    const trail = (rate, o = {}) => (pr2, pos, dt) => p.trickle(rate, dt, pos.x, pos.y, pos.z, { colors: pal, layer: 'glow', speed: 0.6, life: 0.35, size: r * 2.2, jitter: r, ...o });
    // Formas especiales
    if (pr.mk === 'hojaAfilada') {
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.16, 6).scale(1.9, 0.75, 1), new THREE.MeshStandardMaterial({ color: '#6cc84a', side: THREE.DoubleSide, roughness: 0.6 }));
      g.add(leaf);
      return { obj: g, h: 0.55, update: (_, pos, dt) => { leaf.rotation.x += dt * 9; leaf.rotation.z += dt * 15; p.trickle(10, dt, pos.x, pos.y, pos.z, { colors: PALETTE.planta, layer: 'solid', speed: 0.3, life: 0.4, size: 0.08 }); } };
    }
    if (m.type === 'roca' || pr.mk === 'lanzarrocas') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 1.1, 0), new THREE.MeshStandardMaterial({ color: '#9a8466', flatShading: true }));
      rock.castShadow = true;
      g.add(rock);
      return { obj: g, h: 0.5, update: (_, pos, dt) => { rock.rotation.x += dt * 8; rock.rotation.y += dt * 5; p.trickle(15, dt, pos.x, pos.y, pos.z, { colors: DUST, layer: 'soft', speed: 0.3, life: 0.5, size: 0.3, alpha: 0.5 }); } };
    }
    if (m.fx === 'vine') {
      // Liana: cadena de esferas desde el lanzador hasta la punta
      const mat = new THREE.MeshStandardMaterial({ color: '#3f9a33', roughness: 0.7 });
      const beads = [];
      for (let k = 0; k < 12; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (k === 11 ? 0.08 : 0), 8, 6), mat); beads.push(b); this.scene.add(b); }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), mat);
      g.add(tip);
      return {
        obj: g, h: 0.55,
        update: (pr2, pos, dt, owner) => {
          if (!owner) return;
          const from = toWorld(owner.x, owner.y, 0.6);
          const now = performance.now();
          beads.forEach((b, k) => {
            const f = (k + 1) / beads.length;
            b.position.lerpVectors(from, pos, f);
            b.position.y += Math.sin(f * Math.PI) * 0.25 + Math.sin(now / 60 + k) * 0.05;
          });
          tip.rotation.z = -Math.PI / 2; tip.rotation.y = -pr2.a;
        },
        dispose: () => beads.forEach(b => this.scene.remove(b)),
      };
    }
    if (m.fx === 'seed') {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1.25, 1), new THREE.MeshStandardMaterial({ color: '#a07038', roughness: 0.6 }));
      const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), new THREE.MeshStandardMaterial({ color: '#5cc040' }));
      sprout.position.y = 0.18;
      g.add(seed, sprout);
      return { obj: g, h: 0.55, update: (_, pos, dt) => { g.rotation.y += dt * 4; p.trickle(12, dt, pos.x, pos.y, pos.z, { colors: PALETTE.planta, speed: 0.3, life: 0.4, size: 0.12 }); } };
    }
    if (m.fx === 'hypno') {
      const rings = [];
      for (let k = 0; k < 3; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + k * 0.08, 0.025, 6, 24), additive(bright('#ff70d0'), 0.8)); rings.push(ring); g.add(ring); }
      return { obj: g, h: 0.6, update: (_, pos, dt) => { const t = performance.now() / 200; rings.forEach((ring, k) => { ring.rotation.x = t + k; ring.rotation.y = t * 0.7 + k; }); } };
    }
    if (ty === 'volador') {
      const tw = new THREE.Mesh(new THREE.ConeGeometry(r * 1.4, r * 3.5, 12, 1, true), additive('#e8f0ff', 0.45));
      tw.rotation.x = Math.PI;
      g.add(tw);
      return { obj: g, h: 0.45, update: (_, pos, dt) => { tw.rotation.y += dt * 20; p.trickle(25, dt, pos.x, pos.y, pos.z, { colors: PALETTE.volador, layer: 'soft', speed: 1, life: 0.3, size: 0.12, alpha: 0.7 }); } };
    }
    // Genérico: núcleo brillante + halo + estela del tipo. El mismo diseño en todas las arenas (núcleo casi
    // blanco y halo del color del tipo); sobre suelo claro el halo, que no puede ser aditivo, usa el color
    // intenso del tipo con mezcla normal y se ve igual de saturado que el aditivo sobre hierba
    const core = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.07, r * 0.7), 12, 10), new THREE.MeshBasicMaterial({ color: bright(pal[1], 2.2), toneMapped: false }));
    const halo = glowSprite(BRIGHT ? vivid(TYPE_COLOR[ty]) : bright(TYPE_COLOR[ty], 1.6), r * 5 + 0.3);
    if (BRIGHT) { halo.material.blending = THREE.NormalBlending; halo.scale.multiplyScalar(1.4); }   // el aditivo se ve más ancho: se compensa
    if (BRIGHT) core.material.color.lerp(vivid(TYPE_COLOR[ty]), 0.4);   // un blanco puro se perdería sobre blanco
    g.add(core, halo);
    if (ty === 'fantasma' || ty === 'veneno') core.material.color = bright(pal[2], 1.2);
    const big = (m.dmg || 0) >= 15;
    const extra = {};
    if (ty === 'fuego') Object.assign(extra, { grav: -2, speed: 0.8, life: big ? 0.5 : 0.3, size: r * (big ? 3.2 : 2.4) });
    if (ty === 'agua') Object.assign(extra, { layer: 'solid', grav: 6, speed: 1, life: 0.4, size: 0.09 });
    if (ty === 'electrico') Object.assign(extra, { speed: 2.5, life: 0.15, size: 0.12 });
    if (ty === 'hielo') Object.assign(extra, { layer: 'solid', speed: 0.6, life: 0.5, size: 0.08 });
    const tr = trail(big ? 140 : 60, extra);
    return {
      obj: g, h: 0.55,
      update: (pr2, pos, dt) => {
        tr(pr2, pos, dt);
        halo.material.opacity = 0.8 + Math.sin(performance.now() / 40) * 0.2;
        if (ty === 'electrico' && Math.random() < 0.5) p.emit(pos.x, pos.y, pos.z, { n: 1, colors: ['#ffffff', '#fff060'], speed: 3, life: 0.1, size: 0.08 });
        if (big && ty === 'fuego') p.trickle(15, dt, pos.x, pos.y + 0.3, pos.z, { colors: SMOKE, layer: 'soft', dir: [0, 1, 0], speed: 0.6, life: 1, size: 0.5, grow: 1.5, alpha: 0.35 });
      },
    };
  }

  // ---------- Eventos ----------
  beam(e) {
    const a = toWorld(e.x1, e.y1, 0.6), b = toWorld(e.x2, e.y2, 0.6);
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const col = TYPE_COLOR[e.ty], pal = PALETTE[e.ty];
    const w = e.w * U;
    const g = new THREE.Group();
    if (e.ty === 'electrico') {
      // Rayo en zigzag: segmentos finos con desvíos aleatorios
      const pts = [a];
      for (let k = 1; k < 14; k++) pts.push(a.clone().lerp(b, k / 14).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4)));
      pts.push(b);
      for (let k = 0; k < pts.length - 1; k++) {
        const s = pts[k], t = pts[k + 1], l = s.distanceTo(t);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, l), additive(bright('#fff8a0', 3)));
        seg.position.copy(s).lerp(t, 0.5); seg.lookAt(t);
        g.add(seg);
      }
    } else {
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, len, 16, 1, true), additive(bright(col, 2), 0.7));
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.2, w * 0.2, len, 12, 1, true), additive(new THREE.Color('#ffffff').multiplyScalar(3)));
      for (const c of [outer, inner]) { c.position.copy(mid); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(c); }
    }
    this.addTemp(g, 320, f => { g.children.forEach(c => { c.material.opacity = 1 - f; }); });
    for (let k = 0; k < len; k += 0.35) {
      const pt = a.clone().addScaledVector(dir, k);
      this.p.emit(pt.x, pt.y, pt.z, { n: 2, colors: pal, layer: e.ty === 'agua' ? 'solid' : 'glow', speed: 1.5, life: 0.4, size: e.ty === 'agua' ? 0.1 : 0.25, grav: e.ty === 'agua' ? 6 : 0 });
    }
    this.flashLight(b, col, 4, 200);
    this.shake = Math.max(this.shake, e.w >= 28 ? 0.25 : 0.12);
  }

  melee(e, pos) {
    const m = new THREE.Mesh(new THREE.RingGeometry((e.r + 6) * U, (e.r + 22) * U, 24, 1, -e.arc / 2, e.arc), additive(bright(TYPE_COLOR[e.ty], 2), 0.8));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -e.a;
    m.position.copy(toWorld(pos.x, pos.y, 0.4));
    this.addTemp(m, 200, f => { m.material.opacity = 0.8 * (1 - f); m.scale.setScalar(1 + f * 0.3); });
  }

  // Zona marcada (Surf, Trueno, Terremoto…): crece un anillo hasta que estalla
  warn(e) {
    const r = e.r * U;
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: TYPE_COLOR[e.ty], transparent: true, opacity: 0.22, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.94, r, 48), new THREE.MeshBasicMaterial({ color: BRIGHT ? INK : '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    const grow = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 48), additive(bright(TYPE_COLOR[e.ty], 2), 0.9));
    for (const m of [disc, ring, grow]) { m.rotation.x = -Math.PI / 2; g.add(m); }
    g.position.copy(toWorld(e.x, e.y, 0.05));
    const pal = PALETTE[e.ty];
    this.addTemp(g, e.d * 1000, f => {
      grow.scale.setScalar(Math.max(0.02, f));
      disc.material.opacity = 0.15 + f * 0.25;
      if (e.ty === 'agua') this.p.emit(g.position.x + (Math.random() - 0.5) * r * 1.6, 0.1, g.position.z + (Math.random() - 0.5) * r * 1.6, { n: 1, colors: pal, layer: 'solid', dir: [0, 1, 0], spread: 0.3, speed: 2.5, life: 0.4, size: 0.1, grav: 9 });
      if (e.ty === 'electrico' && Math.random() < 0.3) this.p.emit(g.position.x, 3 + Math.random(), g.position.z, { n: 3, colors: ['#ffffff', '#fff070'], speed: 1, life: 0.15, size: 0.2 });
    });
  }

  boom(e) {
    const pos = toWorld(e.x, e.y, 0.1);
    const r = e.r * U, ty = e.ty, pal = PALETTE[ty];
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.6, r, 48), additive(bright(TYPE_COLOR[ty], 2), 0.9));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    this.addTemp(ring, 500, f => { ring.scale.setScalar(0.6 + f * 0.6); ring.material.opacity = 0.9 * (1 - f); });
    const n = Math.round(30 + r * 25);
    if (ty === 'agua') {
      for (let k = 0; k < 40; k++) {
        const a = k / 40 * Math.PI * 2;
        this.p.emit(pos.x + Math.cos(a) * r * 0.8, 0.2, pos.z + Math.sin(a) * r * 0.8, { n: 3, colors: pal, layer: 'solid', dir: [Math.cos(a), 1.4, Math.sin(a)], spread: 0.3, speed: 5, life: 0.8, size: 0.13, grav: 12, floor: true });
      }
      const wave = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.22, 8, 48), new THREE.MeshStandardMaterial({ color: '#4a90e8', transparent: true, opacity: 0.8, roughness: 0.1 }));
      wave.rotation.x = -Math.PI / 2; wave.position.copy(pos);
      this.addTemp(wave, 600, f => { wave.scale.setScalar(0.7 + f * 0.6); wave.position.y = 0.1 + Math.sin(f * Math.PI) * 0.4; wave.material.opacity = 0.8 * (1 - f); });
    } else if (ty === 'electrico') {
      // Rayo que cae del cielo
      const bolt = new THREE.Group();
      let prev = new THREE.Vector3(pos.x, 9, pos.z);
      for (let k = 1; k <= 10; k++) {
        const next = new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.8, 9 - k * 0.9, pos.z + (Math.random() - 0.5) * 0.8);
        if (k === 10) next.set(pos.x, 0, pos.z);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, prev.distanceTo(next)), additive(bright('#fff8b0', 3)));
        seg.position.copy(prev).lerp(next, 0.5); seg.lookAt(next);
        bolt.add(seg);
        prev = next;
      }
      this.addTemp(bolt, 260, f => bolt.children.forEach(s => { s.material.opacity = 1 - f; }));
      this.p.emit(pos.x, 0.3, pos.z, { n, colors: pal, speed: 6, life: 0.4, size: 0.2 });
      this.flashLight(pos, '#fff6a0', 14, 260);
    } else if (ty === 'tierra' || ty === 'roca') {
      this.p.emit(pos.x, 0.2, pos.z, { n: n * 1.5, colors: DUST, layer: 'soft', up: 0.5, speed: 4, life: 1.1, size: 0.6, grow: 1.2, alpha: 0.6, jitter: r });
      this.p.emit(pos.x, 0.2, pos.z, { n: 30, colors: ['#8a7458', '#6a5a44'], layer: 'solid', up: 2, speed: 6, life: 0.9, size: 0.14, grav: 14, floor: true, jitter: r * 0.6 });
      if (ty === 'roca') for (let k = 0; k < 5; k++) this.fallingRock(pos, r);
    } else if (ty === 'hielo') {
      this.p.emit(pos.x, 0.5, pos.z, { n: n * 1.5, colors: pal, layer: 'solid', speed: 4, life: 1, size: 0.1, jitter: r, grav: 2 });
      this.p.emit(pos.x, 0.5, pos.z, { n, colors: ['#ffffff'], layer: 'soft', speed: 2, life: 1.2, size: 0.8, grow: 1, alpha: 0.4, jitter: r });
    } else if (ty === 'volador') {
      for (let k = 0; k < 60; k++) {
        const a = k / 60 * Math.PI * 6, rr = (k / 60) * r;
        this.p.emit(pos.x + Math.cos(a) * rr, 0.2 + k * 0.03, pos.z + Math.sin(a) * rr, { n: 1, colors: pal, layer: 'soft', dir: [-Math.sin(a), 0.5, Math.cos(a)], spread: 0.1, speed: 4, life: 0.6, size: 0.25, alpha: 0.7 });
      }
    } else if (ty === 'normal' && r > 3) {
      // Autodestrucción
      this.p.emit(pos.x, 0.5, pos.z, { n: 160, colors: ['#ffffff', '#fff0b0', '#ffb040', '#ff6020'], speed: 9, life: 0.7, size: 0.5 });
      this.p.emit(pos.x, 0.5, pos.z, { n: 50, colors: SMOKE, layer: 'soft', speed: 3, life: 1.6, size: 1.2, grow: 1.5, alpha: 0.6, jitter: 1 });
      this.flashLight(pos, '#ffffff', 25, 300);
    } else {
      this.p.emit(pos.x, 0.4, pos.z, { n, colors: pal, speed: 5, life: 0.6, size: 0.35, jitter: r * 0.8, grav: ty === 'fuego' ? -3 : 0 });
      if (ty === 'fuego') this.p.emit(pos.x, 0.6, pos.z, { n: 40, colors: SMOKE, layer: 'soft', dir: [0, 1, 0], spread: 0.6, speed: 2, life: 1.4, size: 0.9, grow: 1.5, alpha: 0.4, jitter: r });
      this.flashLight(pos, TYPE_COLOR[ty], 8, 250);
    }
    this.shake = Math.max(this.shake, Math.min(0.5, 0.15 + r * 0.08));
  }

  // Terremoto: aviso en el epicentro y luego un anillo de polvo que se expande por la arena
  quake(e) {
    this.warn({ x: e.x, y: e.y, r: 70, d: e.d, ty: 'tierra' });
    this.quakeCover(e);
    setTimeout(() => {
      const pos = toWorld(e.x, e.y, 0.15);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 64), new THREE.MeshStandardMaterial({ color: '#a07a4a', roughness: 1, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos);
      const maxR = 1200 * U, life = 1200 / e.sp * 1000;
      this.addTemp(ring, life, f => {
        const R = Math.max(0.05, f * maxR);
        ring.scale.set(R, R, 1 + f * 2);
        ring.material.opacity = 0.9 * (1 - f);
        this.shake = Math.max(this.shake, 0.25 * (1 - f));
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.p.emit(pos.x + Math.cos(a) * R, 0.2, pos.z + Math.sin(a) * R, { n: 3, colors: DUST, layer: 'soft', up: 0.6, speed: 1.5, life: 0.8, size: 0.5, grow: 1, alpha: 0.5 });
        }
      });
    }, e.d * 1000);
  }

  // Cono (Lanzallamas, Ventisca, Zumbido...): abanico que se ilumina y un chorro de partículas
  cone(e) {
    const pos = toWorld(e.x, e.y, 0.05), r = e.r * U, ty = e.ty, pal = PALETTE[ty] || ['#ffffff'];
    const fan = new THREE.Mesh(new THREE.CircleGeometry(r, 32, -e.arc / 2, e.arc), additive(bright(TYPE_COLOR[ty], 1.6), 0.55));
    fan.rotation.x = -Math.PI / 2; fan.rotation.z = -e.a; fan.position.copy(pos);
    this.addTemp(fan, 320, f => { fan.material.opacity = 0.55 * (1 - f); fan.scale.setScalar(0.6 + f * 0.4); });
    const n = Math.round(40 + e.r * e.arc * 0.25);
    for (let k = 0; k < n; k++) {
      const a = e.a + (Math.random() - 0.5) * e.arc, sp = (e.r / 40) * (2.2 + Math.random() * 1.6);
      const o = { n: 1, colors: pal, dir: [Math.cos(a), 0.12, Math.sin(a)], spread: 0.08, speed: sp, life: 0.35 + Math.random() * 0.15, size: 0.22, drag: 0.9 };
      if (ty === 'fuego') Object.assign(o, { layer: 'glow', size: 0.45, grav: -2 });
      else if (ty === 'hielo') Object.assign(o, { layer: 'solid', size: 0.1 });
      else if (ty === 'tierra') Object.assign(o, { layer: 'solid', colors: DUST, size: 0.12, grav: 6 });
      else if (ty === 'bicho') Object.assign(o, { layer: 'soft', size: 0.35, alpha: 0.5 });
      this.p.emit(pos.x, 0.5, pos.z, o);
    }
    if (ty === 'fuego') this.flashLight(toWorld(e.x + Math.cos(e.a) * e.r * 0.5, e.y + Math.sin(e.a) * e.r * 0.5, 1), '#ff8a30', 8, 300);
    if (ty === 'bicho') {   // ondas de sonido
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32, 1, -e.arc / 2, e.arc), additive(bright(TYPE_COLOR[ty], 1.4), 0.6));
        ring.rotation.x = -Math.PI / 2; ring.rotation.z = -e.a; ring.position.copy(pos); ring.position.y = 0.5;
        this.addTemp(ring, 420, f => { const sc = Math.max(0.05, (f + k * 0.18) * r); ring.scale.setScalar(sc); ring.material.opacity = 0.6 * (1 - f); });
      }
    }
  }

  // Zonas a cubierto del terremoto: la sombra de cada roca vista desde el epicentro (mismo
  // criterio que el servidor, server/arena.js shielded). Duran el aviso y lo que tarda la onda.
  quakeCover(e) {
    const W = Shared.ARENA.w, H = Shared.ARENA.h;
    const toEdge = (x, y, dx, dy) => Math.min(dx > 0 ? (W - x) / dx : dx < 0 ? -x / dx : Infinity, dy > 0 ? (H - y) / dy : dy < 0 ? -y / dy : Infinity);
    const mat = new THREE.MeshBasicMaterial({ color: '#7cf0a0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const group = new THREE.Group();
    for (const o of this.world.collisionList()) {
      if (o.k === 'ghost') continue;
      const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy), R = o.r + 6;
      if (d < R + 10) continue;
      const th = Math.atan2(dy, dx), al = Math.asin(Math.min(0.95, R / d));
      const nx = -Math.sin(th), ny = Math.cos(th);
      const far = a => { const ux = Math.cos(a), uy = Math.sin(a), t = toEdge(e.x, e.y, ux, uy); return [e.x + ux * t, e.y + uy * t]; };
      const pts = [[o.x + nx * R, o.y + ny * R], far(th + al), far(th - al), [o.x - nx * R, o.y - ny * R]];
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * U, -y * U)));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.035;
      group.add(m);
    }
    if (!group.children.length) return;
    const life = (e.d + 1200 / e.sp) * 1000;
    this.addTemp(group, life, f => { mat.opacity = f < 0.08 ? f / 0.08 * 0.32 : f > 0.85 ? (1 - f) / 0.15 * 0.32 : 0.32 + Math.sin(f * 40) * 0.05; });
  }

  // Descarga de las placas eléctricas de un grupo
  panelZap(g) {
    const panels = Shared.parseMap(this.world.mapName).panels.filter(i => (((i % Shared.COLS) >> 1) + (Math.floor(i / Shared.COLS) >> 1)) % 2 === g);
    for (let k = 0; k < 14 && panels.length; k++) {
      const i = panels[Math.floor(Math.random() * panels.length)];
      this.p.emit((i % Shared.COLS) + 0.5, 0.1, Math.floor(i / Shared.COLS) + 0.5, { n: 6, colors: ['#ffffff', '#fff070', '#ffd23a'], dir: [0, 1, 0], spread: 0.8, speed: 3, life: 0.25, size: 0.16 });
    }
    this.flashLight(toWorld(480, 300, 1.5), '#fff6a0', 10, 220);
    this.shake = Math.max(this.shake, 0.12);
  }

  fallingRock(pos, r) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2, 0), new THREE.MeshStandardMaterial({ color: '#9a8466', flatShading: true }));
    const x = pos.x + (Math.random() - 0.5) * r * 1.4, z = pos.z + (Math.random() - 0.5) * r * 1.4;
    rock.castShadow = true;
    this.addTemp(rock, 700, f => {
      rock.position.set(x, Math.max(0.15, 6 * (1 - f * 2.2)), z);
      rock.rotation.x += 0.2;
      if (f > 0.7) rock.scale.setScalar(Math.max(0.01, (1 - f) / 0.3));
    });
  }

  flashLight(pos, color, intensity, ms) {
    const now = performance.now();
    const l = this.lights.reduce((best, x) => (x.intensity < best.intensity ? x : best), this.lights[0]);
    l.color.set(color);
    l.position.copy(pos).setY(1);
    Object.assign(l.userData, { t0: now, ms, peak: intensity });
    l.intensity = intensity;
  }

  // Impacto de un golpe: partículas del tipo del atacante
  impact(e, big) {
    const pos = toWorld(e.x, e.y, 0.6);
    const pal = PALETTE[e.ty] || PALETTE.normal;
    const n = big ? 34 : 16;
    if (e.ty === 'agua') this.p.emit(pos.x, pos.y, pos.z, { n, colors: pal, layer: 'solid', up: 1.5, speed: 4, life: 0.6, size: 0.1, grav: 12, floor: true });
    else if (e.ty === 'planta') this.p.emit(pos.x, pos.y, pos.z, { n, colors: pal, layer: 'solid', speed: 3, life: 0.8, size: 0.12, grav: 3 });
    else if (e.ty === 'roca' || e.ty === 'tierra') this.p.emit(pos.x, pos.y, pos.z, { n, colors: DUST, layer: 'soft', speed: 3, life: 0.7, size: 0.4, alpha: 0.7 });
    else this.p.emit(pos.x, pos.y, pos.z, { n, colors: pal, speed: big ? 5 : 3.5, life: 0.4, size: big ? 0.3 : 0.2, grav: e.ty === 'fuego' ? -3 : 0 });
    // Chispa blanca de impacto
    const star = glowSprite(new THREE.Color('#ffffff').multiplyScalar(2), big ? 1.6 : 1);
    star.position.copy(pos);
    this.addTemp(star, 120, f => { star.material.opacity = 1 - f; star.scale.setScalar((big ? 1.6 : 1) * (1 + f)); });
    if (big) this.shake = Math.max(this.shake, 0.2);
  }

  // Protección: cúpula hexagonal (verde) que destella dorada en la ventana de parry
  protectDome(i, pos, on, perfect) {
    let d = this.protect[i];
    if (!on) { if (d) { this.scene.remove(d); this.protect[i] = null; } return; }
    if (!d) {
      d = new THREE.Group();
      d.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), additive(new THREE.Color('#70ffb0').multiplyScalar(1.2), 0.18)));
      const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.86, 1), new THREE.MeshBasicMaterial({ color: '#c8ffe0', wireframe: true, transparent: true, opacity: 0.6, toneMapped: false }));
      d.add(wire);
      this.scene.add(d);
      this.protect[i] = d;
    }
    d.position.copy(toWorld(pos.x, pos.y, 0.7));
    d.rotation.y += 0.02;
    const gold = perfect ? 1 : 0;
    d.children[0].material.color.set(perfect ? '#fff0a0' : '#70ffb0').multiplyScalar(1.4);
    d.children[1].material.color.set(perfect ? '#fff6c0' : '#c8ffe0');
    d.scale.setScalar(1 + gold * 0.08 + Math.sin(performance.now() / 70) * 0.02);
  }

  parry(e) {
    const pos = toWorld(e.x, e.y, 0.7);
    this.p.emit(pos.x, pos.y, pos.z, { n: 50, colors: ['#ffffff', '#fff6b0', '#ffd040'], speed: 7, life: 0.4, size: 0.22 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.35, 32), additive(new THREE.Color('#fff2a0').multiplyScalar(3)));
    ring.position.copy(pos);
    ring.quaternion.copy(this.world.camera.quaternion);
    this.addTemp(ring, 300, f => { ring.scale.setScalar(1 + f * 6); ring.material.opacity = 1 - f; });
    this.flashLight(pos, '#fff0a0', 12, 250);
    this.shake = Math.max(this.shake, 0.3);
  }

  // Descarga eléctrica en un charco
  zap(cells) {
    for (const i of cells) {
      const c = Shared.cellCenter(i);
      const pos = toWorld(c.x, c.y, 0.1);
      this.p.emit(pos.x, 0.1, pos.z, { n: 6, colors: ['#ffffff', '#fff070', '#ffe030'], speed: 3, life: 0.25, size: 0.18, jitter: 0.8 });
    }
    if (cells.length) { const c = Shared.cellCenter(cells[0]); this.flashLight(toWorld(c.x, c.y), '#fff6a0', 10, 300); }
  }

  // Retirar / sacar un Pokémon: destello rojo y blanco de Poké Ball
  swapFlash(pos) {
    const p = toWorld(pos.x, pos.y, 0.6);
    this.p.emit(p.x, p.y, p.z, { n: 40, colors: ['#ffffff', '#ff6060', '#ff3030'], speed: 3, life: 0.5, size: 0.2 });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 3, 16, 1, true), additive(new THREE.Color('#ff5050').multiplyScalar(2), 0.5));
    beam.position.copy(p).setY(1.5);
    this.addTemp(beam, 350, f => { beam.material.opacity = 0.5 * (1 - f); beam.scale.x = beam.scale.z = 1 - f * 0.8; });
  }

  // Captura (tiempos iguales a los del servidor): la Ball se abre y absorbe al Pokémon, cae
  // botando, se agita hasta 3 veces y hace ¡clic! con estrellas, o se abre y el Pokémon escapa.
  capture(e, onStep) {
    const IN = 1.0, SHAKE = 0.75, CLICK = 0.9, BREAK = 0.5;
    const pos = toWorld(e.x, e.y, 0);
    const ball = new THREE.Group();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(BALL_COLORS[e.ball] || '#e83030'), roughness: 0.25, metalness: 0.1 }));
    sphere.castShadow = true;
    const button = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    button.position.z = 0.301;
    ball.add(sphere, button);
    ball.position.copy(pos);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.55, 1.2, 16, 1, true), additive(new THREE.Color('#ff4040').multiplyScalar(2.5), 0.7));
    beam.position.copy(pos).setY(0.75);
    this.scene.add(beam);
    const total = IN + e.shakes * SHAKE + (e.ok ? CLICK : BREAK);
    let step = -1;
    this.p.emit(pos.x, 0.9, pos.z, { n: 40, colors: ['#ffffff', '#ff9090', '#ff4040'], speed: 3, life: 0.5, size: 0.22 });
    this.addTemp(ball, total * 1000 + 600, f => {
      const t = f * (total + 0.6);
      // Absorber y caer botando
      if (t < 0.35) { ball.position.y = 0.95; beam.material.opacity = 0.7 * (1 - t / 0.35); }
      else {
        if (beam.parent) this.scene.remove(beam);
        const k = Math.min(1, (t - 0.35) / (IN - 0.35));
        ball.position.y = 0.3 + Math.abs(Math.cos(k * Math.PI * 2.5)) * 0.73 * (1 - k) * (1 - k);
      }
      ball.rotation.set(0, 0, 0);
      // Sacudidas
      const st = t - IN;
      const i = Math.floor(st / SHAKE);
      if (st >= 0 && i < e.shakes) {
        const u = (st - i * SHAKE) / SHAKE;
        ball.rotation.z = u < 0.6 ? Math.sin(u / 0.6 * Math.PI * 2) * 0.55 : 0;
        button.material.color.set(u < 0.6 ? '#ff6060' : '#ffffff');
        if (i > step) { step = i; onStep && onStep(i + 1); this.p.emit(pos.x, 0.25, pos.z, { n: 8, colors: DUST, layer: 'soft', speed: 1, life: 0.4, size: 0.2, alpha: 0.6 }); }
      }
      const done = IN + e.shakes * SHAKE;
      if (t >= done && step < 99) {
        step = 99;
        if (e.ok) {
          onStep && onStep('ok');
          button.material.color.set('#7dff9a');
          for (let k = 0; k < 3; k++) this.p.emit(pos.x, 0.5, pos.z, { n: 12, colors: ['#fff6a0', '#ffffff', '#ffd040'], dir: [Math.cos(k * 2.1), 1.4, Math.sin(k * 2.1)], spread: 0.25, speed: 3, life: 0.9, size: 0.26 });
          this.flashLight(pos, '#fff6a0', 6, 300);
        } else {
          onStep && onStep('fail');
          this.p.emit(pos.x, 0.4, pos.z, { n: 50, colors: ['#ffffff', '#ff8080'], speed: 4, life: 0.5, size: 0.24 });
          this.flashLight(pos, '#ffffff', 8, 250);
          ball.visible = false;
        }
      }
      if (e.ok && t > done) ball.scale.setScalar(1 + Math.max(0, 0.15 - (t - done) * 0.5));
    });
    return { total, IN, SHAKE };
  }

  update(dt) {
    const now = performance.now();
    this.temp = this.temp.filter(t => {
      const f = (now - t.t0) / t.life;
      if (f >= 1) {
        this.scene.remove(t.obj);
        t.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); });
        return false;
      }
      t.update && t.update(f);
      return true;
    });
    this.shake = Math.max(0, this.shake - dt * 1.2);
    for (const l of this.lights) {
      const f = (now - l.userData.t0) / l.userData.ms;
      l.intensity = f >= 1 ? 0 : l.userData.peak * (1 - f);
    }
  }

  clear() {
    for (const t of this.temp) this.scene.remove(t.obj);
    this.temp = [];
    for (const [, o] of this.proj) { this.scene.remove(o.obj); o.dispose && o.dispose(); }
    this.proj.clear();
    for (const i of [0, 1]) { this.telegraph(i, null, null); this.protectDome(i, null, false); }
    this.shake = 0;
  }
}
