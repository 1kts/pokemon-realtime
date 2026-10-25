// Arranque del cliente: renderer 3D con bloom, bucle principal, red y cambio entre menús y combate.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Particles } from './particles.js';
import { Effects } from './effects.js';
import { BattleClient } from './battle.js';
import { UI } from './ui.js';
import { applyCursor } from './cursor.js';
import { Net, storage } from './net.js';
import { t, tServer } from './i18n.js';

const canvas = document.getElementById('view');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) {
  document.body.insertAdjacentHTML('beforeend', `<div class="nojs">${t('Tu navegador o tu tarjeta gráfica no admiten WebGL, que PokéArenas necesita. Prueba con Chrome, Firefox o Edge actualizados y la aceleración por hardware activada.')}</div>`);
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const world = new World(renderer);
const particles = new Particles(world.scene);
const effects = new Effects(world, particles);
world.onTheme = bright => { particles.setBright(bright); effects.setBright(bright); };
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world.scene, world.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 1.1);  // umbral > 1: solo brillan los efectos, no los sprites
composer.addPass(bloom);
composer.addPass(new OutputPass());

const app = {
  world, particles, effects, canvas, net: new Net(), root: document.getElementById('hud'),
  battle: null, ui: null,
  connect(name) { this.net.connect(name); },
  // Al cambiar de idioma: los textos fijos de index.html (las pantallas se vuelven a pintar solas)
  onLang() { document.getElementById('conn').lastChild.textContent = t('Reconectando con el servidor…'); },
};
app.onLang();
app.ui = new UI(app);
window.__app = app;   // para depurar y para las pruebas automáticas
world.loadMap('pradera', Shared.parseMap('pradera').terrain);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  world.placeCamera(w / h);
  particles.setScale(h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2)));
}
addEventListener('resize', resize);
resize();

// ---------- Bucle ----------
let last = performance.now();
const basePos = new THREE.Vector3();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.placeCamera(innerWidth / innerHeight);
  if (app.battle) {
    app.battle.frame(now, dt);
    const sh = app.battle.camShake;
    if (sh) world.camera.position.add(new THREE.Vector3(sh.x, sh.y * 0.5, sh.y));
  } else {
    // En los menús la cámara gira despacio alrededor de la arena
    const t = now / 1000 * 0.06;
    basePos.set(Shared.COLS / 2 + Math.sin(t) * 9, 13, Shared.ROWS / 2 + Math.cos(t) * 15);
    world.camera.position.copy(basePos);
    world.camera.lookAt(Shared.COLS / 2, 0, Shared.ROWS / 2);
  }
  world.update(dt, particles);
  effects.update(dt);
  particles.update(dt);
  composer.render();
}
requestAnimationFrame(loop);

// ---------- Red ----------
const net = app.net;
const ui = app.ui;
const overlay = document.getElementById('conn');

net.on('connected', () => { overlay.hidden = true; });
net.on('disconnected', () => {
  if (!ui.profile) return;
  overlay.hidden = false;
  if (app.battle) endBattle();
  ui.show('menu');
});
net.on('profile', m => ui.setProfile(m.p, m.board, m.rank));
net.on('error', m => ui.toast(tServer(m.msg), 'bad'));
net.on('loot', m => ui.onLoot(m.r));
// Anuncio de un administrador a todos los conectados
net.on('announce', m => ui.toast(`${t('Aviso')}: ${tServer(m.msg)}`, 'announce', 12000));
// Cuenta suspendida: pantalla con el motivo y hasta cuándo (no se reconecta)
net.on('banned', m => {
  if (app.battle) endBattle();
  const box = document.createElement('div');
  box.className = 'nojs banned';
  const inner = document.createElement('div');
  const until = m.until ? new Date(m.until).toLocaleString() : null;
  for (const [tag, text] of [['h2', t('Tu cuenta está suspendida')], ['p', t('Motivo: {reason}', { reason: m.reason })],
    ['p', until ? t('Hasta: {date}', { date: until }) : t('La suspensión no tiene fecha de fin.')]]) {
    const e = document.createElement(tag);
    e.textContent = text;
    inner.append(e);
  }
  box.append(inner);
  document.body.append(box);
});
net.on('welcome', m => ui.versionCheck(m.version));
net.on('autherr', m => { ui.authError(tServer(m.msg)); if (!ui.authMsg || !ui.authMsg.isConnected) ui.toast(tServer(m.msg), 'bad'); });
net.on('authok', m => { ui.authError(''); ui.toast(tServer(m.msg)); });
net.on('queue', m => { ui.queueMode = m.mode; ui.lastMode = m.mode; ui.show('queue'); });
net.on('unqueued', () => ui.show(ui.queueMode === 'ranked' ? 'online' : 'menu'));
net.on('cancelled', m => { ui.toast(tServer(m.reason), 'bad'); ui.show('menu'); });
net.on('draft', m => ui.draft(m));
net.on('draftwait', () => {});
net.on('ladder', m => ui.onLadder(m));
net.on('user', m => ui.onUser(m));
net.on('start', m => {
  if (app.battle) endBattle();
  ui.hide();
  document.querySelectorAll('.modal').forEach(m => m.remove());
  document.body.classList.add('in-battle');
  app.battle = new BattleClient(app, m);
});
net.on('snap', m => { if (app.battle) app.battle.onSnap(m); });
net.on('over', m => {
  const b = app.battle;
  // Dejar ver el final un momento antes de los resultados
  setTimeout(() => {
    if (app.battle !== b) return;
    endBattle();
    ui.results(m, b);
  }, m.captured ? 1300 : 1000);
});

function endBattle() {
  if (!app.battle) return;
  app.battle.dispose();
  app.battle = null;
  document.body.classList.remove('in-battle');
  world.loadMap('pradera', Shared.parseMap('pradera').terrain);
}

addEventListener('keydown', e => {
  if (e.code === 'Escape' && app.battle && !app.battle.over) {
    if (confirm(t('¿Rendirte y abandonar el combate?'))) { app.battle.over = true; net.send({ t: 'forfeit' }); }
  }
});

applyCursor();   // el color de cursor elegido en Ajustes
ui.show('title');
