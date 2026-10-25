// Combate en el cliente: predicción del propio movimiento con reconciliación, interpolación del
// rival y proyectiles, entrada (teclado/ratón), eventos -> efectos/animaciones y la interfaz de combate.
import * as THREE from 'three';
import { Actor } from './actors.js';
import { toWorld } from './world.js';
import { portrait, preload, trainerImg, leaderByName } from './sprites.js';
import { PALETTE } from './particles.js';
import { t, tServer } from './i18n.js';
import { typeIcon } from './pixicons.js';
import { reticleColor } from './cursor.js';

const { TICK, DT, F } = Shared;
const { MOVES, SPECIES, TYPE_COLOR, PROTECT, SWAP, ENERGY, SHOP } = Data;
const INTERP_MS = 100;
const KEYS = ['Clic', 'Dcho', 'Q', 'E'];
const BALLS = ['pokeball', 'superball', 'ultraball'];

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const lerp = (a, b, f) => a + (b - a) * f;
function lerpAngle(a, b, f) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }

export class BattleClient {
  // app: { world, effects, particles, net, canvas, root (div del HUD), onOver(msg, battle) }
  constructor(app, start) {
    this.app = app;
    this.world = app.world;
    this.fx = app.effects;
    this.p = app.particles;
    this.you = start.you;
    this.foeIdx = 1 - start.you;
    this.mode = start.mode;
    this.mapName = start.map;
    this.arena = Data.ARENAS[start.map] || null;   // arena de gimnasio con mecánicas
    this.sides = start.sides;
    this.balls = start.balls ? { ...start.balls } : null;
    this.ballType = this.balls ? BALLS.find(b => this.balls[b] > 0) || 'pokeball' : null;
    this.act = [0, 0];
    this.snaps = []; this.latest = null; this.offset = null;
    this.seq = 0; this.pending = []; this.pred = null; this.prevPred = null; this.err = { x: 0, y: 0 };
    this.acc = 0; this.castQueue = -1; this.swapQueue = -1;
    this.keys = {}; this.mouse = { x: 0, y: 0 }; this.aim = { x: 480, y: 300 };
    this.ghostT = 0; this.over = false;
    this.lastPos = [{ x: 140, y: 300 }, { x: 820, y: 300 }];
    this.world.loadMap(start.map, start.terrain);
    this.fx.clear(); this.p.clear();
    this.actors = this.sides.map((s, i) => new Actor(this.world.scene, this.world.camera, s.team[0].dex, !!s.team[0].shiny, i === this.you));
    preload(this.sides.flatMap(s => s.team.map(m => ({ dex: m.dex, shiny: !!m.shiny }))));
    this.shinyT = [0, 0];
    for (const i of [0, 1]) if (this.sides[i].team[0].shiny) setTimeout(() => this.shinyAppear(i), 600);
    this.buildHud();
    this.bindInput();
    this.banner('3', 'big');
    const foe = this.sides[this.foeIdx];
    // Contra un líder: su presentación al empezar
    const leader = this.mode === 'trainer' && leaderByName(foe.name);
    if (leader) this.leaderIntro(leader);
    if (foe.rare) setTimeout(() => this.banner(t('¡Un {m} salvaje muy raro!', { m: foe.team[0] && Data.SPECIES[foe.team[0].dex].name }), 'rare'), 300);
    if (foe.perfect) setTimeout(() => this.banner(t('¡Y tiene IV perfectos!'), 'rare'), 1300);
  }

  leaderIntro(n) {
    const kind = n.kind === 'gym' ? t('Líder') : n.kind === 'champion' ? t('Campeón') : t('Alto Mando');
    const v = el('div', 'leader-intro', `<div class="li-band"></div>${trainerImg(n.id, 'li-sprite')}<div class="li-text"><small>${kind}</small><b>${n.leader}</b><span>${t('¡Te desafía!')}</span></div>`);
    v.style.setProperty('--tc', TYPE_COLOR[n.type]);
    document.body.append(v);
    setTimeout(() => v.classList.add('out'), 1900);
    setTimeout(() => v.remove(), 2400);
  }

  // Un shiny entra en combate: destellos y aviso
  shinyAppear(i) {
    const p = this.posOf(i), w = toWorld(p.x, p.y, 0.9);
    this.p.emit(w.x, w.y, w.z, { n: 60, colors: ['#ffffff', '#fff6a0', '#ffd040', '#a0f0ff'], speed: 2.5, life: 1.1, size: 0.22, jitter: 0.8 });
    this.fx.flashLight(w, '#fff6c0', 8, 500);
    this.shinyT[i] = performance.now();
    if (i !== this.you) this.banner(t('✨ ¡{m} shiny! ✨', { m: this.monName(i) }), 'rare');
  }

  // ---------- Red ----------
  onSnap(m) {
    const now = performance.now();
    const off = m.st - now;
    this.offset = this.offset === null ? off : Math.max(off, this.offset - 0.5);
    this.snaps.push(m);
    if (this.snaps.length > 40) this.snaps.shift();
    this.latest = m;
    if (m.tr) for (const [i, t] of m.tr) this.world.setCell(i, t);
    this.world.syncObstacles(m.ob || []);
    this.world.setArena(m.ar);
    for (const e of m.ev) this.onEvent(e);
    if (m.state === 'countdown') this.countdown(m.cd);
    else if (this.cdShown) { this.cdShown = null; this.banner(t('¡A combatir!'), 'big'); }
    this.timerEl.textContent = m.tl > 0 ? `${Math.floor(m.tl / 60)}:${String(m.tl % 60).padStart(2, '0')}` : '0:00';
    this.timerEl.classList.toggle('sudden', !!m.sd);

    // Reconciliación: partir del estado del servidor y repetir las entradas no confirmadas
    const me = m.ps[this.you];
    this.me = me;
    this.pending = this.pending.filter(i => i.s > me.ack);
    const old = this.pred;
    const p = { x: me.x, y: me.y, vx: me.v ? me.v[0] : 0, vy: me.v ? me.v[1] : 0 };
    if (m.state === 'fight') {
      const obstacles = this.world.collisionList();
      const speed = Shared.speedOf(this.dexOf(this.you), me.f, this.monOf(this.you).spdMult);
      const r = this.monOf(this.you).r || Shared.hitboxOf(this.dexOf(this.you));
      if (!(me.f & F.DASH)) for (const i of this.pending) this.step(p, i, speed, obstacles, r);
    }
    const jump = me.f & (F.DASH | F.SWAP) || !old;
    if (old && !jump) { this.err.x += old.x - p.x; this.err.y += old.y - p.y; }
    if (Math.hypot(this.err.x, this.err.y) > 120) this.err = { x: 0, y: 0 };
    this.pred = p;
    if (!this.prevPred || jump) this.prevPred = { ...p };
    this.updateHud();
  }

  // Un paso de movimiento propio, igual que en el servidor (en las arenas: corriente, viento, hielo)
  step(p, inp, speed, obstacles, r) {
    if (!this.arena) return Shared.stepMove(p, inp.mx, inp.my, speed, DT, obstacles, r);
    const wd = this.latest && this.latest.ar && this.latest.ar.wd;
    const wind = wd && !SPECIES[this.dexOf(this.you)].types.includes('volador') ? wd : null;
    Shared.arenaStep(p, inp.mx || 0, inp.my || 0, speed, DT, obstacles, r, { map: this.mapName, terrain: this.world.types, wind });
  }

  dexOf(i) { return this.sides[i].team[this.act[i]].dex; }
  monOf(i) { return this.sides[i].team[this.act[i]]; }
  movesOf(i) { const m = this.sides[i].team[this.act[i]]; return m.moves && m.moves.length ? m.moves : SPECIES[m.dex].moves; }
  moveOf(i, c) { return MOVES[this.movesOf(i)[c]]; }
  monName(i) { const m = this.monOf(i); return m.nick || SPECIES[m.dex].name; }
  posOf(i) { return i === this.you && this.renderPos ? this.renderPos[i] : this.lastPos[i]; }

  onEvent(e) {
    const s = e.s;
    const actor = s !== undefined ? this.actors[s] : null;
    const pos = s !== undefined ? this.posOf(s) : null;
    switch (e.k) {
      case 'wind': {
        const m = this.moveOf(s, e.c);
        if (!m) break;
        if (m.wind >= 0.2 && ['proj', 'beam', 'area', 'cone', 'wave'].includes(m.kind)) actor.play('Charge');
        if (m.wind >= 0.3) this.p.emit(toWorld(pos.x, pos.y).x, 0.2, toWorld(pos.x, pos.y).z, { n: 14, colors: PALETTE[m.type], up: 1, speed: 1.2, life: m.wind, size: 0.18, jitter: 0.8 });
        break;
      }
      case 'cast': {
        const m = this.moveOf(s, e.c);
        if (!m) break;
        actor.play(m.kind === 'melee' || m.kind === 'dash' ? 'Attack' : ['proj', 'beam', 'cone', 'wave'].includes(m.kind) ? 'Shoot' : 'Charge');
        const w = toWorld(e.x + Math.cos(e.a) * 26, e.y + Math.sin(e.a) * 26, 0.6);
        if (m.kind === 'proj' || m.kind === 'beam') this.p.emit(w.x, w.y, w.z, { n: m.cost ? 16 : 5, colors: PALETTE[m.type], dir: [Math.cos(e.a), 0.2, Math.sin(e.a)], spread: 0.5, speed: 3, life: 0.3, size: 0.2 });
        if (m.kind === 'heal') this.p.emit(w.x, 0.1, w.z, { n: 40, colors: ['#ffffff', '#b0ffd0', '#70f0ff'], dir: [0, 1, 0], spread: 0.4, speed: 2.5, life: 1, size: 0.18, jitter: 1 });
        if (m.kind === 'buff') this.p.emit(w.x, 0.1, w.z, { n: 30, colors: m.power ? ['#ff8060', '#ffd040'] : ['#ffffff', '#a0e0ff'], dir: [0, 1, 0], spread: 0.2, speed: 3, life: 0.8, size: 0.16, jitter: 1 });
        if (m.kind === 'smoke') { const c = toWorld(e.x, e.y); this.p.emit(c.x, 0.4, c.z, { n: 60, colors: ['#e0e4ea', '#c8ccd2'], layer: 'soft', speed: 3, life: 1.2, size: 1.2, grow: 1, alpha: 0.7 }); }
        break;
      }
      case 'beam': this.fx.beam(e); break;
      case 'cone': this.fx.cone(e); break;
      case 'melee': this.fx.melee(e, pos); break;
      case 'warn': this.fx.warn(e); break;
      case 'boom': this.fx.boom(e); break;
      case 'hit': {
        this.actors[s].flash(); this.actors[s].play('Hurt');
        this.fx.impact(e, e.big);
        const label = e.b ? t('Bloqueado') : e.e > 0 ? t('¡Muy eficaz!') : e.e < 0 ? t('Poco eficaz') : '';
        this.floatText(e.x, e.y, '-' + e.n, e.e > 0 ? 'eff' : e.e < 0 ? 'weak' : '', label, e.big);
        break;
      }
      case 'dot': this.floatText(pos.x, pos.y, '-' + e.n, 'dot'); break;
      case 'pend': if (!e.imp) { const w = toWorld(e.x, e.y, 0.5); this.p.emit(w.x, w.y, w.z, { n: 6, colors: PALETTE[e.ty], speed: 1.5, life: 0.3, size: 0.15 }); } break;
      case 'parry':
        this.fx.parry(e);
        this.banner(s === this.you ? t('¡Parry perfecto!') : t('¡Te han hecho parry!'), s === this.you ? 'good' : 'bad');
        break;
      case 'perfectswap':
        this.banner(s === this.you ? t('¡Cambio perfecto!') : t('¡Cambio perfecto rival!'), s === this.you ? 'good' : 'bad');
        this.p.emit(toWorld(e.x, e.y).x, 0.8, toWorld(e.x, e.y).z, { n: 40, colors: ['#ffffff', '#a0f0ff'], speed: 4, life: 0.5, size: 0.2 });
        break;
      case 'swap':
        this.fx.swapFlash(pos);
        this.act[s] = e.to;
        actor.setDex(this.dexOf(s), !!this.monOf(s).shiny);
        actor.play('Idle', false);
        if (this.monOf(s).shiny) setTimeout(() => this.shinyAppear(s), 350);
        this.buildTeams();
        if (s === this.you) this.buildMoves();
        break;
      case 'faint':
        actor.play('Faint');
        this.banner(t('¡{m} se ha debilitado!', { m: SPECIES[this.sides[s].team[e.slot].dex].name }), s === this.you ? 'bad' : 'good');
        if (s === this.you && this.sides[s].team.some((m, i) => i !== e.slot && (this.me ? this.me.hp[i] > 0 : true))) this.banner(t('Elige otro Pokémon: 1 · 2 · 3'), 'info');
        break;
      case 'heal': this.floatText(pos.x, pos.y, '+' + e.n, 'heal'); break;
      case 'buff': if (e.splash) this.floatText(pos.x, pos.y, t('¡Pero no pasó nada!'), 'info'); break;
      case 'blink': { const w = toWorld(e.x, e.y, 0.6); actor.ghost('#ff90d0'); this.p.emit(w.x, w.y, w.z, { n: 30, colors: PALETTE.psiquico, speed: 2, life: 0.5, size: 0.2 }); break; }
      case 'zap': this.fx.zap(e.cells); this.floatText(this.posOf(this.foeIdx).x, this.posOf(this.foeIdx).y - 30, t('¡Descarga en el agua!'), 'info'); break;
      case 'capture': {
        // El Pokémon entra en la Ball; las sacudidas se anuncian una a una
        const seq = this.fx.capture(e, step => {
          if (step === 'ok') { this.banner(t('¡{m} atrapado!', { m: this.monName(s) }), 'good big2'); }
          else if (step === 'fail') { this.banner(t('¡Oh, no! ¡Se ha escapado!'), 'bad'); }
          else this.floatText(e.x, e.y - 10, step + '…', 'shake');
        });
        this.catchSeq = { s, t0: performance.now(), ok: !!e.ok, shakes: e.shakes, IN: seq.IN, SHAKE: seq.SHAKE };
        this.banner(t('Probabilidad: {n} %', { n: e.chance }), 'info');
        break;
      }
      case 'escape': this.catchSeq = null; break;
      case 'throw': if (s === this.you && this.balls) { this.balls[e.ball] = e.left; this.updateBallHud(); } break;
      case 'sudden': this.banner(t('¡Muerte súbita! Daño ×1,5 y sin curaciones'), 'bad'); break;
      // Mecánicas de las arenas de gimnasio
      case 'arena': this.banner(tServer(e.msg), 'info'); break;
      case 'panel': this.world.panelFlash(e.g, e.ph, e.d); if (e.ph === 'zap') this.fx.panelZap(e.g); break;
      case 'quake': this.fx.quake(e); this.banner(t('¡Terremoto! Ponte detrás de una roca'), 'bad'); break;
      case 'covered': this.floatText(pos.x, pos.y, t('¡A cubierto!'), 'info'); break;
      case 'gust': {
        const arrow = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((Math.round(e.a / (Math.PI / 4)) % 8) + 8) % 8];
        this.banner(t('¡Ráfaga de viento! {arrow}', { arrow }), 'info');
        break;
      }
      case 'warp': {
        for (const [x, y] of [[e.x1, e.y1], [e.x2, e.y2]]) { const w = toWorld(x, y, 0.5); this.p.emit(w.x, w.y, w.z, { n: 30, colors: PALETTE.psiquico, speed: 2.4, life: 0.5, size: 0.2 }); }
        actor.ghost('#ff90d0');
        break;
      }
    }
  }

  // Efectos continuos de la arena: estelas de viento mientras sopla
  arenaFx(dt) {
    const wd = this.latest && this.latest.ar && this.latest.ar.wd;
    if (!wd) return;
    const len = Math.hypot(wd[0], wd[1]) || 1, dx = wd[0] / len, dz = wd[1] / len;
    for (let k = 0; k < 3; k++) {
      if (Math.random() > dt * 30) continue;
      const x = Math.random() * Shared.COLS, z = Math.random() * Shared.ROWS;
      this.p.emit(x, 0.3 + Math.random() * 1.2, z, { n: 2, colors: ['#ffffff', '#e0f0ff'], layer: 'soft', dir: [dx, 0, dz], spread: 0.05, speed: 9, life: 0.6, size: 0.25, alpha: 0.5 });
    }
  }

  countdown(n) {
    if (this.cdShown === n) return;
    this.cdShown = n;
    this.banner(String(n), 'big');
  }

  // ---------- Entrada ----------
  bindInput() {
    const KEYMAP = { Digit1: 'sw0', Digit2: 'sw1', Digit3: 'sw2', KeyQ: 2, KeyE: 3, Space: 4, KeyF: 5 };
    this.onKeyDown = e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      const k = KEYMAP[e.code];
      if (k === undefined) { if (e.code === 'KeyR' && this.balls) this.cycleBall(); return; }
      e.preventDefault();
      if (typeof k === 'string') this.swapQueue = +k[2];
      else this.castQueue = k;
    };
    this.onKeyUp = e => { this.keys[e.code] = false; };
    this.onMouseMove = e => { this.mouse = { x: e.clientX, y: e.clientY }; };
    this.onMouseDown = e => { if (e.target === this.app.canvas) this.castQueue = e.button === 2 ? 1 : 0; };
    this.onContext = e => { if (e.target === this.app.canvas) e.preventDefault(); };
    this.onBlur = () => { this.keys = {}; };
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('mousemove', this.onMouseMove);
    addEventListener('mousedown', this.onMouseDown);
    addEventListener('contextmenu', this.onContext);
    addEventListener('blur', this.onBlur);
    this.ray = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // Retícula: anillo con cuatro marcas que gira despacio y late, siempre bajo el ratón
    const ret = this.reticle = new THREE.Group();
    this.reticleColor = reticleColor();   // el color de cursor elegido en Ajustes
    this.reticleHit = this.reticleColor.toLowerCase() === '#ffd23f' ? '#ff5a5a' : '#ffd23a';   // apuntando al rival: que se note el cambio
    const mat = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 40), mat());
    ring.rotation.x = -Math.PI / 2;
    ret.add(ring);
    for (let k = 0; k < 4; k++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), mat());
      tick.rotation.x = -Math.PI / 2;
      tick.position.set(Math.cos(k * Math.PI / 2) * 0.47, 0, Math.sin(k * Math.PI / 2) * 0.47);
      tick.rotation.z = -k * Math.PI / 2;
      ret.add(tick);
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), mat());
    dot.rotation.x = -Math.PI / 2;
    ret.add(dot);
    ret.position.y = 0.06;
    ret.renderOrder = 3;
    this.world.scene.add(ret);
  }

  // Punto del suelo bajo el ratón, en px de juego
  updateAim() {
    const r = this.app.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((this.mouse.x - r.left) / r.width) * 2 - 1, -((this.mouse.y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.world.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.ground, hit)) this.aim = { x: hit.x * Shared.CELL, y: hit.z * Shared.CELL };
  }

  sampleInput() {
    const k = this.keys;
    const mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const my = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const from = this.pred || { x: 0, y: 0 };
    const a = +Math.atan2(this.aim.y - from.y, this.aim.x - from.x).toFixed(3);
    const c = this.castQueue, sw = this.swapQueue;
    this.castQueue = -1; this.swapQueue = -1;
    return { s: ++this.seq, mx, my, a, tx: Math.round(this.aim.x), ty: Math.round(this.aim.y), c, sw, ball: c === 5 ? this.ballType : undefined };
  }

  cycleBall() {
    const have = BALLS.filter(b => this.balls[b] > 0);
    if (!have.length) return;
    this.ballType = have[(have.indexOf(this.ballType) + 1) % have.length];
    this.updateBallHud();
  }

  // ---------- Bucle ----------
  frame(now, dt) {
    if (!this.latest) return;
    this.updateAim();
    this.acc += Math.min(250, dt * 1000);
    while (this.acc >= 1000 / TICK) {
      this.acc -= 1000 / TICK;
      if (!this.pred || !this.me) continue;
      const inp = this.sampleInput();
      this.app.net.send({ t: 'in', ...inp });
      const fighting = this.latest.state === 'fight';
      if (fighting) this.pending.push(inp);
      this.prevPred = { ...this.pred };
      const mine = this.monOf(this.you);
      const speed = Shared.speedOf(mine.dex, this.me.f, mine.spdMult);
      if (fighting && !(this.me.f & F.DASH)) {
        this.step(this.pred, inp, speed, this.world.collisionList(), mine.r || Shared.hitboxOf(mine.dex));
      }
      this.moving = (inp.mx || inp.my) && speed > 0;
    }
    this.err.x *= 0.85; this.err.y *= 0.85;
    this.render(now, dt);
    this.arenaFx(dt);
  }

  interpolated(renderT) {
    const s = this.snaps;
    let i = s.length - 1;
    while (i > 0 && s[i - 1].st > renderT) i--;
    const b = s[i], a = s[Math.max(0, i - 1)];
    if (a === b || renderT >= b.st) return { a: b, b, f: 1 };
    return { a, b, f: Math.max(0, Math.min(1, (renderT - a.st) / (b.st - a.st))) };
  }

  render(now, dt) {
    const ip = this.interpolated(now + this.offset - INTERP_MS);
    const alpha = this.acc / (1000 / TICK);
    const pos = [];
    for (let i = 0; i < 2; i++) {
      const sb = ip.b.ps[i], sa = ip.a.ps[i];
      let x, y, a, st, moving;
      if (i === this.you && this.pred) {
        st = this.me;
        x = lerp(this.prevPred.x, this.pred.x, alpha) + this.err.x;
        y = lerp(this.prevPred.y, this.pred.y, alpha) + this.err.y;
        a = Math.atan2(this.aim.y - y, this.aim.x - x);
        moving = this.moving;
      } else {
        st = sb;
        if (sb.x === undefined) { x = this.lastPos[i].x; y = this.lastPos[i].y; }
        else if (sa.x === undefined) { x = sb.x; y = sb.y; }
        else { x = lerp(sa.x, sb.x, ip.f); y = lerp(sa.y, sb.y, ip.f); }
        a = lerpAngle(sa.a, sb.a, ip.f);
        moving = Math.hypot(x - this.lastPos[i].x, y - this.lastPos[i].y) > 0.3;
      }
      pos.push({ x, y, a, st, moving });
      this.lastPos[i] = { x, y };
    }
    this.renderPos = pos;
    this.world.setFocus(pos[this.you].x, pos[this.you].y);
    // Retícula bajo el ratón: gira, late y se vuelve amarilla cuando apunta a la hitbox del rival
    const ret = this.reticle;
    const aimW = toWorld(this.aim.x, this.aim.y, 0.06);
    ret.position.lerp(aimW, 0.6);
    ret.rotation.y += dt * 0.8;
    const foe = pos[this.foeIdx];
    const onFoe = foe.st.x !== undefined && Math.hypot(this.aim.x - foe.x, this.aim.y - foe.y) < (this.monOf(this.foeIdx).r || 22);
    ret.scale.setScalar((onFoe ? 1.25 : 1) * (1 + Math.sin(now / 180) * 0.05));
    for (const c of ret.children) c.material.color.set(onFoe ? this.reticleHit : this.reticleColor);
    for (let i = 0; i < 2; i++) {
      const { x, y, a, st, moving } = pos[i];
      const actor = this.actors[i];
      const hiddenFoe = i !== this.you && st.x === undefined;
      const f = st.f;
      // Invisible si el rival está escondido o capturado; semitransparente si me escondo yo
      actor.alpha = hiddenFoe ? 0 : f & F.HIDDEN ? 0.45 : 1;
      const swapping = f & F.SWAP && !(f & F.FAINTED);
      actor.scale += ((swapping ? 0.05 : 1) - actor.scale) * Math.min(1, dt * 14);
      const cs = this.catchSeq;
      if (cs && cs.s === i) {   // dentro de la Ball: encogerse al entrar y reaparecer si se escapa
        const t = (now - cs.t0) / 1000, out = cs.IN + cs.shakes * cs.SHAKE;
        actor.scale = t < 0.35 ? Math.max(0.01, 1 - t / 0.35) : !cs.ok && t > out ? Math.min(1, (t - out) / 0.25) : 0.01;
        actor.flashUntil = t < 0.35 ? now + 50 : actor.flashUntil;
      }
      actor.update(now, x, y, a, moving);
      // Telegrafiado y Protección
      const m = st.w ? this.moveOf(i, st.w.c) || null : null;
      this.fx.telegraph(i, { x, y }, hiddenFoe ? null : st.w, m, i === this.you);
      this.fx.protectDome(i, { x, y }, !!(f & F.PROTECT) && !hiddenFoe, !!(f & F.PERFECT));
      if (!hiddenFoe) this.statusFx(i, x, y, f, dt);
      // Nameplate
      this.placeNameplate(i, actor, hiddenFoe || actor.scale < 0.2 || (f & F.FAINTED && actor.anim.name === 'Faint' && now - actor.anim.t0 > 1500));
    }
    // Estelas de las embestidas
    if ((this.ghostT += dt) > 0.04) {
      this.ghostT = 0;
      for (let i = 0; i < 2; i++) if (pos[i].st.f & F.DASH && this.actors[i].alpha > 0.5) this.actors[i].ghost(TYPE_COLOR[SPECIES[this.dexOf(i)].types[0]]);
    }
    // Proyectiles
    const prevPr = new Map(ip.a.pr.map(p => [p.id, p]));
    const prs = ip.b.pr.map(p => { const q = prevPr.get(p.id) || p; return { ...p, x: lerp(q.x, p.x, ip.f), y: lerp(q.y, p.y, ip.f) }; });
    this.fx.syncProjectiles(prs, pos, dt);
    // Temblor de cámara
    const sh = this.fx.shake;
    this.camShake = sh > 0.01 ? { x: (Math.random() - 0.5) * sh, y: (Math.random() - 0.5) * sh } : null;
  }

  // Partículas de estado alrededor del Pokémon
  statusFx(i, x, y, f, dt) {
    const w = toWorld(x, y);
    const p = this.p;
    if (this.monOf(i).shiny) p.trickle(5, dt, w.x, 0.9, w.z, { colors: ['#ffffff', '#fff6a0', '#ffd040'], speed: 0.3, life: 0.8, size: 0.14, jitter: 1.1 });
    if (f & F.BURN) p.trickle(14, dt, w.x, 0.5, w.z, { colors: PALETTE.fuego, dir: [0, 1, 0], spread: 0.3, speed: 1.2, life: 0.5, size: 0.22, jitter: 0.6 });
    if (f & F.POISON) p.trickle(6, dt, w.x, 0.6, w.z, { colors: PALETTE.veneno, layer: 'solid', dir: [0, 1, 0], spread: 0.3, speed: 0.6, life: 0.8, size: 0.12, jitter: 0.6 });
    if (f & F.WET) p.trickle(8, dt, w.x, 1.1, w.z, { colors: PALETTE.agua, layer: 'solid', dir: [0, -1, 0], spread: 0.2, speed: 0.5, life: 0.6, size: 0.07, grav: 4, jitter: 0.7 });
    if (f & F.SEED) p.trickle(8, dt, w.x, 0.3, w.z, { colors: PALETTE.planta, layer: 'solid', dir: [0, 1, 0], spread: 0.6, speed: 0.8, life: 0.7, size: 0.1, jitter: 0.7 });
    if (f & F.STUN) {
      const t = performance.now() / 200;
      for (let k = 0; k < 3; k++) p.emit(w.x + Math.cos(t + k * 2.1) * 0.35, 1.8, w.z + Math.sin(t + k * 2.1) * 0.35, { n: 1, colors: ['#fff6a0'], speed: 0, life: 0.06, size: 0.18 });
    }
    if (f & F.SLOW) p.trickle(5, dt, w.x, 0.1, w.z, { colors: ['#8a6a40', '#5a8a30'], layer: 'solid', speed: 0.3, life: 0.6, size: 0.1, jitter: 0.8 });
    if (f & F.HASTE) p.trickle(10, dt, w.x, 0.3, w.z, { colors: ['#ffffff', '#c0e8ff'], layer: 'soft', speed: 0.3, life: 0.4, size: 0.15, jitter: 0.8, alpha: 0.6 });
    if (f & F.POWER) p.trickle(10, dt, w.x, 0.2, w.z, { colors: ['#ff6040', '#ffb040'], dir: [0, 1, 0], spread: 0.2, speed: 1.5, life: 0.5, size: 0.14, jitter: 0.8 });
  }

  // ---------- Interfaz ----------
  buildHud() {
    const root = this.app.root;
    root.innerHTML = '';
    this.timerEl = el('div', 'timer', '3:00');
    this.teamsEl = [el('div', 'team mine'), el('div', 'team foe')];
    this.movesEl = el('div', 'moves');
    this.energyEl = el('div', 'energy', '<div class="fill"></div><span></span>');
    this.ballEl = this.balls ? el('div', 'balls') : null;
    this.bannerEl = el('div', 'banners');
    // Nombre y mecánica de la arena (la descripción se esconde a los pocos segundos)
    if (this.arena) {
      const tag = el('div', 'arena-tag', `<b>${escapeHtml(t(this.arena.name))}</b><span>${escapeHtml(t(this.arena.desc))}</span>`);
      tag.title = t(this.arena.desc);
      root.append(tag);
      setTimeout(() => tag.classList.add('mini'), 9000);
    }
    this.floatEl = el('div', 'floats');
    this.plates = [0, 1].map(i => el('div', 'plate ' + (i === this.you ? 'mine' : 'foe')));
    const bottom = el('div', 'bottom');
    bottom.append(this.energyEl, this.movesEl);
    root.append(this.floatEl, ...this.plates, this.timerEl, this.teamsEl[1], this.teamsEl[0], bottom, this.bannerEl);
    if (this.ballEl) root.append(this.ballEl);
    const help = el('div', 'help-hint', t('WASD mover · Ratón apuntar · Espacio Protección · 1-3 cambiar') + (this.balls ? ' · ' + t('F lanzar Ball · R cambiar Ball') : '') + ' · ' + t('Esc rendirse'));
    root.append(help);
    this.buildTeams();
    this.buildMoves();
    this.updateBallHud();
  }

  buildTeams() {
    for (const i of [this.you, this.foeIdx]) {
      const box = this.teamsEl[i === this.you ? 0 : 1];
      const ld = i !== this.you && this.mode === 'trainer' && leaderByName(this.sides[i].name);
      box.innerHTML = `<div class="tname">${ld ? trainerImg(ld.id, 'tname-face') : ''}${escapeHtml(tServer(this.sides[i].name))}</div>`;
      this.sides[i].team.forEach((m, slot) => {
        const row = el('div', 'tm' + (slot === this.act[i] ? ' active' : ''));
        row.append(portrait(m.dex, 40, { shiny: !!m.shiny }));
        row.append(el('div', 'tinfo', `<b>${monLabel(m)}${m.shiny ? ' <i class="shiny-star">✦</i>' : ''}</b> <small>${t('Nv.{n}', { n: m.level })}</small><div class="hp"><div></div></div>${i === this.you ? `<kbd>${slot + 1}</kbd>` : ''}`));
        row.dataset.slot = slot;
        box.append(row);
      });
    }
    this.updateHud();
  }

  buildMoves() {
    this.movesEl.innerHTML = '';
    this.movesOf(this.you).forEach((k, i) => {
      const m = MOVES[k];
      const b = el('div', 'mv', `<kbd>${t(KEYS[i])}</kbd>${typeIcon(m.type, 30, 'mv-ico')}<b>${m.name}</b><small>${m.cost ? m.cost + ' ⚡' : t('básico')}</small><div class="cd"></div><span class="cdt"></span>`);
      b.style.setProperty('--tc', TYPE_COLOR[m.type]);
      b.title = describeMove(m);
      this.movesEl.append(b);
    });
    const pr = el('div', 'mv protect', `<kbd>${t('Espacio')}</kbd><img class="type-ico mv-ico" src="types/proteccion.svg" width="30" height="30" alt="" draggable="false"><b>${t('Protección')}</b><small>${t('parry {n} ms', { n: Math.round(PROTECT.perfect * 1000) })}</small><div class="cd"></div><span class="cdt"></span>`);
    pr.style.setProperty('--tc', '#2fb488');
    pr.title = t('Bloquea el 80 % del daño. Si el golpe llega justo al activarla, lo devuelves (parry).');
    this.movesEl.append(pr);
  }

  updateBallHud() {
    if (!this.ballEl) return;
    this.ballEl.innerHTML = '<div class="bt">Poké Balls · <kbd>F</kbd> lanzar · <kbd>R</kbd> cambiar</div>' + BALLS.map(b => {
      const item = SHOP.find(s => s.id === b);
      return `<div class="ball${b === this.ballType ? ' sel' : ''}${this.balls[b] > 0 ? '' : ' none'}" data-ball="${b}"><i class="${b}"></i>${item.name} ×${this.balls[b] || 0}<small class="pct"></small></div>`;
    }).join('');
  }

  updateHud() {
    if (!this.latest) return;
    const ps = this.latest.ps;
    for (const i of [0, 1]) {
      const box = this.teamsEl[i === this.you ? 0 : 1];
      const st = ps[i];
      [...box.querySelectorAll('.tm')].forEach(row => {
        const slot = +row.dataset.slot;
        const max = this.sides[i].team[slot].maxHp;
        const hp = st.hp[slot];
        const fr = Math.max(0, hp / max);
        const bar = row.querySelector('.hp > div');
        bar.style.width = (fr * 100) + '%';
        bar.className = fr > 0.5 ? '' : fr > 0.2 ? 'mid' : 'low';
        row.classList.toggle('fainted', hp <= 0);
        row.classList.toggle('active', slot === st.act);
        if (i === this.you) row.classList.toggle('cool', st.swcd > 0 && slot !== st.act);
      });
    }
    const me = ps[this.you];
    if (!me || !me.cds) return;
    const mvEls = this.movesEl.children;
    const mine = this.movesOf(this.you);
    mine.forEach((k, i) => {
      const m = MOVES[k], e = mvEls[i];
      if (!e) return;
      const cd = me.cds[i];
      e.querySelector('.cd').style.setProperty('--p', cd > 0 ? cd / m.cd : 0);
      e.querySelector('.cdt').textContent = cd > 0.05 ? cd.toFixed(cd < 1 ? 1 : 0) : '';
      e.classList.toggle('noenergy', me.e < m.cost);
    });
    const pe = mvEls[mine.length];
    if (pe) {
      pe.querySelector('.cd').style.setProperty('--p', me.pcd > 0 ? me.pcd / PROTECT.cd : 0);
      pe.querySelector('.cdt').textContent = me.pcd > 0.05 ? me.pcd.toFixed(me.pcd < 1 ? 1 : 0) : '';
      pe.classList.toggle('on', !!(me.f & F.PROTECT));
    }
    this.energyEl.firstChild.style.width = (me.e / ENERGY.max * 100) + '%';
    // Probabilidad de captura de cada Ball con la vida y el estado actuales del salvaje
    if (this.ballEl) {
      const fs = ps[this.foeIdx], fm = this.sides[this.foeIdx].team[fs.act];
      const status = !!(fs.f & (F.BURN | F.POISON | F.STUN | F.SLOW | F.SEED));
      for (const row of this.ballEl.querySelectorAll('.ball')) row.querySelector('.pct').textContent = Math.round(Data.catchChance(Math.max(0, fs.hp[fs.act] / fm.maxHp), row.dataset.ball, status, fm.dex) * 100) + ' %';
    }
    this.energyEl.lastChild.textContent = `${me.e} ⚡`;
  }

  placeNameplate(i, actor, hide) {
    const plate = this.plates[i];
    if (hide) { plate.style.display = 'none'; return; }
    const v = actor.worldTop().project(this.world.camera);
    const r = this.app.canvas.getBoundingClientRect();
    plate.style.display = '';
    plate.style.transform = `translate(${(v.x + 1) / 2 * r.width}px, ${(1 - v.y) / 2 * r.height}px) translate(-50%, -100%)`;
    const st = this.latest.ps[i];
    const mon = this.sides[i].team[this.act[i]];
    const fr = Math.max(0, st.hp[this.act[i]] / mon.maxHp);
    const key = `${mon.dex}:${Math.round(fr * 200)}:${st.f}`;
    if (plate.dataset.key === key) return;
    plate.dataset.key = key;
    const icons = [];
    const f = st.f;
    if (f & F.BURN) icons.push(`<i class="st burn">${t('QUE')}</i>`);
    if (f & F.POISON) icons.push(`<i class="st poison">${t('ENV')}</i>`);
    if (f & F.WET) icons.push(`<i class="st wet">${t('MOJ')}</i>`);
    if (f & F.STUN) icons.push(`<i class="st stun">${t('ATU')}</i>`);
    if (f & F.SLOW) icons.push(`<i class="st slow">${t('LEN')}</i>`);
    if (f & F.SEED) icons.push(`<i class="st seed">${t('DRE')}</i>`);
    if (f & F.HASTE) icons.push(`<i class="st haste">${t('VEL')}</i>`);
    if (f & F.POWER) icons.push(`<i class="st power">${t('ATQ')}</i>`);
    if (f & F.HIDDEN) icons.push(`<i class="st hidden">${t('OCULTO')}</i>`);
    plate.innerHTML = `<div class="pn">${monLabel(mon)}${mon.shiny ? ' <i class="shiny-star">✦</i>' : ''} <small>${t('Nv.{n}', { n: mon.level })}</small></div><div class="hp"><div class="${fr > 0.5 ? '' : fr > 0.2 ? 'mid' : 'low'}" style="width:${fr * 100}%"></div></div><div class="sts">${icons.join('')}</div>`;
  }

  floatText(x, y, text, cls = '', sub = '', big = false) {
    const v = toWorld(x, y, 1.4).project(this.world.camera);
    const r = this.app.canvas.getBoundingClientRect();
    const d = el('div', 'float ' + cls + (big ? ' big' : ''), `${escapeHtml(text)}${sub ? `<small>${escapeHtml(sub)}</small>` : ''}`);
    d.style.left = ((v.x + 1) / 2 * r.width + (Math.random() - 0.5) * 30) + 'px';
    d.style.top = ((1 - v.y) / 2 * r.height) + 'px';
    this.floatEl.append(d);
    setTimeout(() => d.remove(), 1100);
  }

  banner(text, cls = '') {
    const b = el('div', 'banner ' + cls, escapeHtml(text));
    if (cls === 'big') this.bannerEl.querySelectorAll('.banner.big').forEach(x => x.remove());   // la cuenta atrás se sustituye
    this.bannerEl.append(b);
    while (this.bannerEl.children.length > 3) this.bannerEl.firstChild.remove();
    setTimeout(() => b.remove(), cls === 'big' ? 900 : 1800);
  }

  dispose() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('mousemove', this.onMouseMove);
    removeEventListener('mousedown', this.onMouseDown);
    removeEventListener('contextmenu', this.onContext);
    removeEventListener('blur', this.onBlur);
    for (const a of this.actors) a.dispose();
    this.world.scene.remove(this.reticle);
    for (const c of this.reticle.children) { c.geometry.dispose(); c.material.dispose(); }
    this.fx.clear();
    this.p.clear();
    this.app.root.innerHTML = '';
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Nombre de un Pokémon para meterlo en HTML: su mote (escapado, lo escribe el jugador) o el de la especie
export const monLabel = m => (m.nick ? escapeHtml(m.nick) : SPECIES[m.dex].name);

export function describeMove(m) {
  const kinds = { proj: m.explode ? 'Proyectil que estalla donde apuntas' : 'Proyectil', beam: 'Rayo', melee: 'Cuerpo a cuerpo', dash: 'Embestida',
    area: m.at === 'self' ? 'Área a tu alrededor' : m.pattern === 'line' ? 'Impactos en fila hacia el cursor' : m.count ? 'Impactos alrededor del cursor' : 'Área en el cursor',
    cone: 'Cono delante de ti', wave: 'Ola que avanza',
    blink: 'Teletransporte', heal: 'Curación', buff: 'Mejora', smoke: 'Nube que oculta', wall: 'Muro' };
  const parts = [`${t(kinds[m.kind])} · ${Data.TYPE_LABEL[m.type]}`];
  if (m.dmg) parts.push(`${t('Daño {n}', { n: m.dmg })}${m.count > 1 ? ' ×' + m.count : ''}`);
  parts.push(t('Energía {cost} · Recarga {cd} s · Preparación {wind} s', { cost: m.cost, cd: m.cd, wind: m.wind }));
  const fx = [];
  if (m.burn) fx.push(t('quema')); if (m.poison) fx.push(t('envenena')); if (m.wet) fx.push(t('moja')); if (m.slow) fx.push(t('ralentiza'));
  if (m.stun) fx.push(t('aturde {n} s', { n: m.stun })); if (m.knock) fx.push(t('empuja')); if (m.pull) fx.push(t('atrae')); if (m.drain) fx.push(t('drena PS'));
  if (m.terrain) fx.push(t('deja {terrain} en el suelo', { terrain: t(m.terrain) })); if (m.heal) fx.push(t('cura {n} %', { n: Math.round(m.heal * 100) }));
  if (m.selfStun) fx.push(t('te deja aturdido {s} s', { s: m.selfStun }));
  if (m.cure) fx.push(t('quita quemadura, veneno y drenadoras'));
  if (m.haste) fx.push(t('más velocidad')); if (m.power) fx.push(t('más daño')); if (m.invuln) fx.push(t('invulnerable bajo tierra'));
  if (m.puddle) fx.push(t('deja un charco tóxico')); if (m.back) fx.push(t('vuelve a su sitio'));
  if (m.selfKO) fx.push(t('¡te debilita!')); if (m.rockWall) fx.push(t('deja una roca')); if (m.splash) fx.push(t('no hace nada'));
  if (fx.length) parts.push(fx.join(', '));
  return parts.join('\n');
}
