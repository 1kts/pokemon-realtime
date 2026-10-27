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
import { faceSrc } from './sprites.js';
import { applyCursor } from './cursor.js';
import { initTouchDevice } from './touch.js';
import { friendNotices } from './friends.js';
import './tips.js';
import { confirmBox } from './dialog.js';
import { Net, storage } from './net.js';
import { t, tServer, getLang } from './i18n.js';
import { Music, trackForBattle } from './music.js';
import { Sfx } from './sfx.js';

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
// (las partículas, iguales en todas las arenas de momento: sin su versión para suelo claro)
world.onTheme = bright => { particles.setBright(false); effects.setBright(bright); };
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world.scene, world.camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 1.1);  // umbral > 1: solo brillan los efectos, no los sprites
composer.addPass(bloom);
composer.addPass(new OutputPass());

const app = {
  world, particles, effects, canvas, net: new Net(), root: document.getElementById('hud'),
  battle: null, ui: null,
  // Música (music.js): cada pantalla pone su tema desde ui.show y cada combate el suyo
  music: new Music(),
  sfx: new Sfx(),   // efectos de sonido del combate (sfx.js)
  connect(name) { this.net.connect(name); },
  // Al cambiar de idioma: los textos fijos de index.html (las pantallas se vuelven a pintar solas)
  onLang() { document.getElementById('conn').lastChild.textContent = t('Reconectando con el servidor…'); },
};
app.onLang();
app.ui = new UI(app);
window.__app = app;   // para depurar y para las pruebas automáticas
app.camera = world.camera;
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

// Calidad automática: si va a menos de 40 FPS durante 3 s, se baja un escalón (resolución interna a 1×, quitar
// el resplandor, resolución a 0,75×). No vuelve a subir en la sesión, para que la imagen no vaya cambiando.
const gfx = { step: 0, frames: 0, time: 0, bloom: true };
const setPR = pr => { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); };
const DOWNGRADES = [
  () => renderer.getPixelRatio() > 1 && (setPR(1), true),
  () => { gfx.bloom = false; return true; },
  () => { setPR(0.75); return true; },
];
function checkFps(raw) {
  if (gfx.step >= DOWNGRADES.length || raw > 0.5) return;   // saltos largos: pestaña oculta o carga, no cuentan
  gfx.frames++; gfx.time += raw;
  if (gfx.time < 3) return;
  const fps = gfx.frames / gfx.time;
  gfx.frames = 0; gfx.time = 0;
  if (fps >= 40) return;
  while (gfx.step < DOWNGRADES.length && !DOWNGRADES[gfx.step++]());
  console.info(`[gfx] ${fps.toFixed(0)} FPS: calidad ${gfx.step}/${DOWNGRADES.length} (resolución ${renderer.getPixelRatio()}×, resplandor ${gfx.bloom ? 'sí' : 'no'})`);
  resize();
}

// ---------- Bucle ----------
let last = performance.now();
const basePos = new THREE.Vector3();
const calm = matchMedia('(prefers-reduced-motion: reduce)');
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
  last = now;
  checkFps(raw);
  world.placeCamera(innerWidth / innerHeight);
  if (app.battle) {
    app.battle.frame(now, dt);
    const sh = app.battle.camShake;
    if (sh) world.camera.position.add(new THREE.Vector3(sh.x, sh.y * 0.5, sh.y));
  } else {
    // En los menús la cámara se queda en un sitio y solo se mece un poco, muy despacio (dar vueltas a la
    // arena mareaba). Con «reducir movimiento» en el sistema, quieta del todo.
    const t = calm.matches ? 0 : now / 1000;
    const sway = Math.sin(t * 0.13) * 1.6, bob = Math.sin(t * 0.21) * 0.25;
    basePos.set(Shared.COLS / 2 + sway, 13 + bob, Shared.ROWS / 2 + 15 - Math.abs(sway) * 0.2);
    world.camera.position.copy(basePos);
    world.camera.lookAt(Shared.COLS / 2 + sway * 0.35, 0, Shared.ROWS / 2);
  }
  world.update(dt, particles);
  effects.update(dt);
  particles.update(dt);
  if (gfx.bloom) composer.render();
  else renderer.render(world.scene, world.camera);   // sin el composer: el tono y el color los pone el renderer
}
requestAnimationFrame(loop);

// ---------- Red ----------
const net = app.net;
const ui = app.ui;
const overlay = document.getElementById('conn');

net.on('connected', () => {
  overlay.hidden = true;
  // Para las estadísticas de uso del panel (solo contadores, sin decir quién): aparato, idioma y si va como app
  const touch = matchMedia('(pointer: coarse)').matches, small = Math.min(screen.width, screen.height) < 600;
  net.send({ t: 'ctx', device: touch ? (small ? 'movil' : 'tablet') : 'pc', lang: getLang(), app: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || !!navigator.standalone });
  ui.viewsSent = new Set();
  if (ui.view) ui.sendView(ui.view);
});
net.on('disconnected', () => {
  if (!ui.profile) return;
  overlay.hidden = false;
  if (app.battle) endBattle();
  ui.show('menu');
});
net.on('profile', m => ui.setProfile(m.p, m.board, m.rank));
net.on('pop', m => { ui.pop = m; ui.updatePop(); });
net.on('error', m => {
  ui.toast(tServer(m.msg), 'bad');
  if (ui.tzSpin) { ui.tzSpin = null; ui.show(ui.view); }   // tirada de Tesoros rechazada: la rueda vuelve
  // En la portada, si el servidor no crea el perfil (nombre no permitido, demasiados perfiles): se puede volver a intentar
  if (!ui.profile && net.joined) { net.joined = false; if (ui.view === 'title') ui.show('title'); }
});
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
friendNotices(net, ui);
net.on('bugok', () => { if (ui.onBugSent) { ui.onBugSent(); ui.onBugSent = null; } });
net.on('authok', m => { ui.authError(''); ui.closeLogin(); ui.toast(tServer(m.msg)); });
// Entrar con el correo: el código ya va de camino; y cuenta nueva sin partida de invitado: falta el nombre
net.on('mailsent', () => ui.onMailSentMsg());
net.on('authname', () => ui.onAuthName());
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
  app.music.play(trackForBattle(m, Data));
});
net.on('snap', m => { if (app.battle) app.battle.onSnap(m); });
net.on('over', m => {
  const b = app.battle;
  app.music.play('menu');   // al acabar el combate vuelve el tema del menú (sin fanfarria)
  if (app.tutorial) app.tutorial.finish(m.winner === m.you);
  // El ganador posa (o salta) mientras se ve el final
  if (b && m.winner >= 0 && b.actors && b.actors[m.winner]) b.actors[m.winner].play('Pose');
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

// Esc va hacia atrás: cierra la ventana de encima (como tocar fuera de ella), en combate abre la de rendirse y
// en las pantallas hace lo de su «Volver». Las que tienen su propio Esc (confirmaciones, ficha del Pokémon,
// desplegables, campos de texto) lo marcan con preventDefault y aquí ya no se hace nada más.
addEventListener('keydown', e => {
  if (e.code !== 'Escape' || e.defaultPrevented || document.querySelector('.ui-confirm')) return;
  if (e.target.closest && e.target.closest('input, textarea, select')) { e.target.blur(); return; }
  const pops = [...document.querySelectorAll('body > .modal, body > .loot-pop:not(.out)')];
  if (pops.length) { pops[pops.length - 1].click(); return; }
  if (app.battle) { if (!app.battle.over) forfeitBox(); return; }
  const back = document.querySelector('#screen .inner-bar .tb-btn.back');
  if (back) back.click();
});

// Ventana de rendirse, con el mismo aire que la pantalla de derrota: tu Pokémon preocupado frente al rival
function forfeitBox() {
  const b = app.battle;
  const pic = (i, emos) => {
    const m = b.monOf(i), src = emos.map(e => faceSrc(m.dex, e, !!m.shiny)).find(Boolean);
    return src ? `<img class="face" src="${src}" alt="" draggable="false">` : '';
  };
  const hero = `<div class="cf-hero"><span class="me">${pic(b.you, ['Worried', 'Sad', 'Normal'])}</span><b>VS</b><span class="foe">${pic(b.foeIdx, ['Determined', 'Happy', 'Normal'])}</span></div>`;
  confirmBox({ title: t('¿Rendirte?'), text: t('¿Rendirte y abandonar el combate?'), ok: t('Rendirse'), cancel: t('Seguir combatiendo'), danger: true, hero, cls: 'forfeit' })
    .then(yes => { if (yes && app.battle === b && !b.over) { b.over = true; net.send({ t: 'forfeit' }); } });
}

applyCursor();   // el color de cursor elegido en Ajustes
initTouchDevice();   // en móvil: horizontal y pantalla completa
ui.show('title');
