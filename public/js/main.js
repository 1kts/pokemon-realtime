// Arranque del cliente: renderer 3D con bloom, bucle principal, red y cambio entre menús y combate.
import './tema.js';   // (primero: las propuestas de aspecto, si se piden, antes de pintar nada)
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
import { friendNotices, clearChallenge } from './friends.js';
import './tips.js';
import { confirmBox, closeConfirm } from './dialog.js';
import { Net, storage } from './net.js';
import { t, tServer, getLang } from './i18n.js';
import { Music, trackForBattle } from './music.js';
import { showTrack } from './nowplaying.js';
import { netPanel, netStats } from './netstats.js';
import { pacer } from './smooth.js';
import { Sfx } from './sfx.js';
import { lowerQuality, density } from './gfx.js';

// Los trozos de chino, japonés y coreano de la letra (más de 200 reglas, 60 KB): aparte, sin bloquear el primer pintado,
// y en los demás idiomas cuando la página ya ha cargado (solo hacen falta para los nombres de esos idiomas en Ajustes)
const cjkFont = () => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/vendor/fonts/fonts-cjk.css' }));
if (['zh', 'ja', 'ko'].includes(getLang()) || document.readyState === 'complete') cjkFont(); else addEventListener('load', () => setTimeout(cjkFont, 300), { once: true });

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
app.music.onTrack = showTrack;
netPanel(app.net);
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
// El escalón se comparte (gfx.js): el mapa de Historia, con su propio renderer, lo sigue.
const gfx = { step: 0, frames: 0, time: 0, bloom: true };
const setPR = pr => { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); };
const DOWNGRADES = [
  () => renderer.getPixelRatio() > 1 && (setPR(1), true),
  () => { gfx.bloom = false; return true; },
  () => { setPR(0.75); return true; },
  () => { setPR(0.6); density.k = 0.5; return true; },   // (solo por debajo de 30 FPS: móviles muy flojos)
];
// El escalón al que llegó este dispositivo la otra vez: se empieza ya en él (arena.gfx; Ajustes lo puede quitar)
{
  const saved = Math.min(DOWNGRADES.length, Math.max(0, +storage.get('arena.gfx') || 0));
  while (gfx.step < saved) DOWNGRADES[gfx.step++]();
  if (saved) lowerQuality(gfx.step);
}
function checkFps(raw) {
  if (gfx.step >= DOWNGRADES.length || raw > 0.5) return;   // saltos largos: pestaña oculta o carga, no cuentan
  gfx.frames++; gfx.time += raw;
  if (gfx.time < 3) return;
  const fps = gfx.frames / gfx.time;
  gfx.frames = 0; gfx.time = 0;
  if (fps >= 40 || (gfx.step >= 3 && fps >= 30)) return;   // (el último escalón, solo si va a menos de 30)
  while (gfx.step < DOWNGRADES.length && !DOWNGRADES[gfx.step++]());
  lowerQuality(gfx.step);
  storage.set('arena.gfx', String(gfx.step));
  console.info(`[gfx] ${fps.toFixed(0)} FPS: calidad ${gfx.step}/${DOWNGRADES.length} (resolución ${renderer.getPixelRatio()}×, resplandor ${gfx.bloom ? 'sí' : 'no'})`);
  resize();
}

// ---------- Bucle ----------
let last = performance.now();
const basePos = new THREE.Vector3();
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const MENU_FPS = 30, BATTLE_FPS = 60;
const pace = pacer();
app.bloomFrames = 0;   // pasadas con resplandor (para las pruebas)
function loop(now) {
  requestAnimationFrame(loop);
  // Tope de FPS, por la velocidad de la pantalla (hay de 160 Hz y más): en los menús el fondo se mece despacio y casi
  // todo queda detrás de los paneles, así que 30 bastan; en combate, 60
  if (!pace(now, app.battle ? BATTLE_FPS : MENU_FPS)) return;
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
  last = now;
  if (app.battle) checkFps(raw);   // (la calidad automática solo mira los combates: en el menú el tope no es que vaya lento)
  world.placeCamera(innerWidth / innerHeight);
  if (app.battle) {
    app.battle.frame(now, dt, Math.min(0.25, raw));
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
  if (gfx.bloom && app.battle) { composer.render(); app.bloomFrames++; }
  else renderer.render(world.scene, world.camera);   // sin el composer: el tono y el color los pone el renderer
}
requestAnimationFrame(loop);

// ---------- Red ----------
const net = app.net;
const FIGHTING = 'arena.fighting';   // cuándo se cerró la página en mitad de un combate
const RESUME_MS = 9000;   // algo más de lo que el servidor guarda un combate tras un corte
let resumeTimer = null;
const ui = app.ui;
const overlay = document.getElementById('conn');

// Errores de JavaScript del navegador: al panel de admin (Actividad), sin datos de nadie, para ver qué falla de verdad
const reportError = (m, src, line) => { if (net.joined) net.send({ t: 'clienterr', m: String(m || '').slice(0, 200), s: String(src || '').split('/').pop(), l: line | 0 }); };
addEventListener('error', e => reportError(e.message, e.filename, e.lineno));
addEventListener('unhandledrejection', e => reportError(e.reason && (e.reason.message || e.reason), (e.reason && e.reason.stack || '').match(/\/js\/[\w.-]+/)?.[0], 0));

// El código de un enlace de reto (pokearenas.com/?reto=…): se guarda para la sesión y se quita de la barra de direcciones
const RETO = 'arena.reto';
{
  const code = new URLSearchParams(location.search).get('reto');
  if (code && /^[A-Za-z0-9]{4,12}$/.test(code)) { try { sessionStorage.setItem(RETO, code); } catch {} history.replaceState(null, '', location.pathname); }
}
const pendingReto = () => { try { return sessionStorage.getItem(RETO); } catch { return null; } };
const clearReto = () => { try { sessionStorage.removeItem(RETO); } catch {} };
net.on('connected', () => {
  overlay.hidden = true;
  if (netStats) netStats.reconnects += net.hurry ? 1 : 0;
  // Para las estadísticas de uso del panel (solo contadores, sin decir quién): aparato, idioma y si va como app
  const touch = matchMedia('(pointer: coarse)').matches, small = Math.min(screen.width, screen.height) < 600;
  net.send({ t: 'ctx', device: touch ? (small ? 'movil' : 'tablet') : 'pc', lang: getLang(), app: matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || !!navigator.standalone });
  ui.viewsSent = new Set();
  if (ui.view) ui.sendView(ui.view);
});
net.on('disconnected', () => {
  if (!ui.profile) return;
  overlay.hidden = false;
  if (!app.battle) return ui.show('menu');
  if (app.battle.ended) return;   // (ya ha acabado: los resultados salen enseguida)
  // En combate, el servidor lo guarda unos segundos: se intenta volver enseguida y, si no da tiempo, al menú
  net.hurry = true;
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { net.hurry = false; if (!app.battle) return; endBattle(); ui.show('menu'); }, RESUME_MS);
});
net.on('profile', m => {
  if (m.flags) ui.flags = m.flags; ui.setProfile(m.p, m.board, m.rank);
  // Un enlace de reto (?reto=…): en cuanto entra, al combate amistoso con quien lo mandó
  const code = pendingReto();
  if (code && !app.battle) { clearReto(); net.send({ t: 'invite', a: 'join', code }); }
});
net.on('invite', m => ui.onInvite(m));
// Un interruptor del panel de admin ha cambiado (server/flags.js): si cierra Lucky Spin y estás dentro, vuelves
net.on('flags', m => {
  ui.flags = m.flags;
  if (ui.root.hidden) return;   // (en combate no se repinta nada: se verá al volver)
  if (ui.view === 'treasure' && !ui.spinOpen()) { ui.toast(t('Lucky Spin está cerrado por ahora. ¡Vuelve pronto!'), 'bad'); ui.tzSpin = null; ui.show(ui.backView()); }
  else if ((ui.view === 'menu' || ui.view === 'treasure') && !ui.tzSpin) ui.show(ui.view, true);   // (no en mitad de una tirada)
});
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
// La partida sigue en otra pestaña o dispositivo: aquí no se reconecta, y se puede volver a por ella
net.on('replaced', () => {
  if (app.battle) endBattle();
  const box = document.createElement('div');
  box.className = 'nojs banned';
  const inner = document.createElement('div');
  const go = Object.assign(document.createElement('button'), { className: 'primary', textContent: t('Seguir aquí') });
  go.onclick = () => location.reload();
  inner.append(Object.assign(document.createElement('h2'), { textContent: t('Tu combate sigue en otra pestaña o dispositivo') }), go);
  box.append(inner);
  document.body.append(box);
});
net.on('welcome', m => { ui.versionCheck(m.version); clearChallenge(ui); });
net.on('autherr', m => { ui.authError(tServer(m.msg)); if (!ui.authMsg || !ui.authMsg.isConnected) ui.toast(tServer(m.msg), 'bad'); });
friendNotices(net, ui);
net.on('bugok', () => { if (ui.onBugSent) { ui.onBugSent(); ui.onBugSent = null; } });
net.on('authok', m => { ui.authError(''); ui.closeLogin(); ui.toast(tServer(m.msg)); });
// Entrar con el correo: el código ya va de camino; y cuenta nueva sin partida de invitado: falta el nombre
net.on('mailsent', () => ui.onMailSentMsg());
net.on('authname', () => ui.onAuthName());
net.on('queue', () => { ui.lastMode = 'ranked'; ui.show('queue'); });
net.on('unqueued', () => ui.show(ui.backView()));
net.on('cancelled', m => { ui.toast(tServer(m.reason), 'bad'); ui.show('menu'); });
net.on('ladder', m => ui.onLadder(m));
net.on('user', m => ui.onUser(m));
net.on('start', m => {
  // (lo que se juega, para el botón Jugar del menú; lo amistoso no cuenta)
  if (m.mode === 'friendly') ui.lastMode = 'friendly';
  if (m.resume && app.battle) { clearTimeout(resumeTimer); net.hurry = false; app.battle.resume(m); return; }
  if (app.battle) endBattle();
  ui.hide();
  closeConfirm();   // (sin esto, su Intro seguiría vivo: vendería o quitaría a ciegas en pleno combate)
  document.querySelectorAll('.modal').forEach(m => m.remove());
  document.body.classList.add('in-battle');
  app.battle = new BattleClient(app, m);
  app.music.play(trackForBattle(m, Data));
});
net.on('snap', m => { if (app.battle) app.battle.onSnap(m); });
net.on('over', m => {
  const b = app.battle;
  clearTimeout(resumeTimer);
  net.hurry = false;
  if (!b) return;   // (recargó y se lo perdió: lo ganado ya está en su perfil)
  b.ended = true;
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
// Las zonas con scroll (.scroll) se pueden enfocar y desplazar con el teclado: se les da tabindex al aparecer (solo
// se mira lo que se añade, no la página entera: en combate el HUD cambia sin parar)
new MutationObserver(ms => {
  for (const m of ms) for (const n of m.addedNodes) {
    if (!(n instanceof Element)) continue;
    for (const e of [n, ...n.querySelectorAll('.scroll')]) if (e.classList.contains('scroll') && !e.hasAttribute('tabindex')) e.tabIndex = 0;
  }
}).observe(document.body, { childList: true, subtree: true });
initTouchDevice();   // en móvil: horizontal y pantalla completa
ui.show('title');
// Recargar en combate: el servidor lo guarda unos segundos, que no se vayan en pulsar «Continuar»
addEventListener('pagehide', () => { if (app.battle && !app.battle.ended) storage.set(FIGHTING, String(Date.now())); });
{
  const left = Date.now() - (+storage.get(FIGHTING) || 0);
  storage.del(FIGHTING);
  if (Net.hasSession() && left < RESUME_MS) app.connect(Net.savedName());
}
// Enlace del correo para entrar (#entrar=correo~código, ver server/mail.js): abre «Entrar con email» con los dos ya
// escritos y falta un toque en «Entrar» (mailLogin). Se quita de la dirección (que no quede en el historial). También
// con el juego ya abierto en la pestaña (entonces solo cambia el #)
function mailLink() {
  const m = /^#entrar=(.+)~(\d{6})$/.exec(location.hash);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  let email = null;
  try { email = decodeURIComponent(m[1]); } catch { /* enlace roto: se ignora */ }
  if (email && !app.battle) ui.mailLogin({ email, code: m[2] });
}
mailLink();
addEventListener('hashchange', mailLink);
