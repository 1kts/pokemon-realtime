// Controles táctiles del combate (móvil y tablet), al estilo de los juegos de arena de móvil:
// - joystick a la izquierda: aparece donde pones el dedo y mueve al Pokémon;
// - cada movimiento es un botón: tocarlo lo lanza al rival (apuntado automático); arrastrarlo apunta en
//   esa dirección y se lanza al soltar (volver al centro lo cancela);
// - Protección, las caras del equipo para cambiar y las Poké Balls se tocan.
// Con ratón y teclado no se monta nada. Se fuerza con localStorage arena.touch = '1' (tests) o '0'.

import { t } from './i18n.js';

const DEAD = 0.25;          // zona muerta del joystick (fracción del radio)
const STICK_R = 56;         // radio del joystick, px de pantalla
const AIM_MIN = 18;         // px de arrastre para pasar de «tocar» a «apuntar»
const AIM_PAD = 70;         // px de arrastre para apuntar a todo el alcance del movimiento (menos, más cerca)
const AIM_RANGE = 320;      // alcance si el movimiento no dice el suyo, unidades de juego
const ASSIST = 0.2;         // rad: si se apunta casi hacia el rival, va justo a él

export function touchMode() {
  try {
    const f = localStorage.getItem('arena.touch');
    if (f === '1') return true;
    if (f === '0') return false;
  } catch {}
  return matchMedia('(pointer: coarse)').matches;
}

// En un móvil o una tablet, desde que se abre la página: el juego va en horizontal (en vertical, un aviso tapa
// todo hasta girarlo) y a pantalla completa (se pide al primer toque, que es cuando el navegador lo deja; si
// luego sales de ella no se vuelve a forzar: queda el botón de pantalla completa de la portada)
export function initTouchDevice() {
  if (!touchMode()) return;
  document.body.classList.add('touch');
  // iPhone/iPad: una web no puede forzar el horizontal (ni instalada como app), y con el bloqueo de rotación
  // puesto el móvil no gira: el aviso explica cómo quitarlo. Instalarla (Añadir a pantalla de inicio) la abre
  // a pantalla completa, sin las barras de Safari. En Android, Chrome deja instalarla con su propio aviso
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = () => !!navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  let prompt = null;   // el aviso de instalar de Chrome (Android), que se guarda para lanzarlo con nuestro botón
  const canInstall = () => !installed() && (ios || !!prompt);
  const install = () => {
    if (prompt) { const p = prompt; prompt = null; p.prompt(); p.userChoice.finally(refresh); return; }
    installGuide();
  };
  const gate = el('div', 'rotate-gate', '<b>⟳</b><span></span><p></p><button class="primary rg-install" hidden></button>');
  gate.querySelector('button').onclick = install;
  // Aviso en el menú (en horizontal): instalar como app, con una ✕ para no volver a verlo. Abajo, solo en el
  // menú sin ventanas abiertas (el menú le deja hueco: body.has-tip) y 12 s a la vista cada vez que se abre el juego
  let seen = false, shown = true, visible = 0;
  const tick = setInterval(() => {
    const on = tip.isConnected && !!document.querySelector('#screen > .menu') && !document.querySelector('body > .modal, .mon-sheet-back');
    tip.hidden = !on;
    document.body.classList.toggle('has-tip', on);
    if (on && ++visible >= 24) { shown = false; clearInterval(tick); document.body.classList.remove('has-tip'); refresh(); }
  }, 500);
  try { seen = !!localStorage.getItem('arena.iosTip'); } catch {}
  const tip = el('div', 'ios-tip', `<span></span><button class="primary it-go"></button><button class="it-x" aria-label="${t('Cerrar')}">✕</button>`);
  tip.querySelector('.it-go').onclick = install;
  tip.querySelector('.it-x').onclick = () => { seen = true; document.body.classList.remove('has-tip'); refresh(); try { localStorage.setItem('arena.iosTip', '1'); } catch {} };
  const refresh = () => {
    gate.querySelector('span').textContent = t('Gira el móvil para jugar en horizontal');
    gate.querySelector('p').textContent = ios ? t('¿No gira? Abre el Centro de control (desliza desde la esquina de arriba a la derecha) y quita el bloqueo de rotación, el candado.')
      : t('¿No gira? Activa la rotación automática en los ajustes rápidos del móvil.');
    const go = gate.querySelector('button');
    go.hidden = !canInstall();
    go.textContent = t('Instalar como app');
    tip.querySelector('span').textContent = t('Instala PokéArenas como app: se abre a pantalla completa, sin las barras del navegador.');
    tip.querySelector('.it-go').textContent = t('Instalar');
    if (canInstall() && !seen && shown) { if (!tip.isConnected) { tip.hidden = true; document.body.append(tip); } } else { tip.remove(); document.body.classList.remove('has-tip'); }
  };
  addEventListener('resize', refresh);
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; refresh(); });
  addEventListener('appinstalled', () => { prompt = null; refresh(); });
  document.body.append(gate);
  refresh();
  let left = false;
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) left = true; });
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  addEventListener('pointerdown', e => {
    if (e.target instanceof Element && e.target.closest('.fs-btn')) return;   // ese botón ya la pone o la quita
    if (left || standalone || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
      .catch(() => {});
  }, { capture: true });
}

// Cómo instalarla en el iPhone (Safari no tiene botón de instalar): por encima de todo, también del aviso de girar
const SHARE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ADD_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function installGuide() {
  if (document.querySelector('.install-guide')) return;
  const box = el('div', 'install-guide', `<div class="ig-box"><h3>${t('Instalar PokéArenas')}</h3><ol>
    <li>${SHARE_SVG}<span>${t('Toca <b>Compartir</b> en la barra de Safari (en iOS 26, dentro del menú <b>···</b>).')}</span></li>
    <li>${ADD_SVG}<span>${t('Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.')}</span></li>
    <li><b class="ig-n">3</b><span>${t('Abre PokéArenas desde su icono: a pantalla completa y sin barras.')}</span></li></ol>
    <p>${t('Si el móvil no gira a horizontal, quita el bloqueo de rotación en el Centro de control.')}</p>
    <button class="primary">${t('Entendido')}</button></div>`);
  box.querySelector('button').onclick = () => box.remove();
  box.onclick = e => { if (e.target === box) box.remove(); };
  document.body.append(box);
}

// Nombre de un movimiento para un botón pequeño: cada palabra en su línea (como mucho dos), recortada a 8 letras
const shortName = s => s.trim().split(/\s+/).slice(0, 2).map(w => w.length > 8 ? w.slice(0, 7) + '.' : w).join('<br>');

const capture = (node, id) => { try { node.setPointerCapture(id); } catch {} };   // el dedo sigue siendo de ese botón aunque se salga
const el = (tag, cls, html = '') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; };

export class TouchControls {
  constructor(battle) {
    this.b = battle;
    this.move = { mx: 0, my: 0 };
    this.aiming = null;        // { slot, dx, dy } mientras se arrastra un movimiento
    this.root = battle.app.root;
    this.root.classList.add('touch');
    document.body.classList.add('touch-battle');
    this.buildStick();
    // Mientras se arrastra un movimiento: un aro donde empezó el dedo con la bola que lo sigue (el dedo tapa el
    // botón), en rojo si se ha vuelto al centro para cancelar
    this.pad = el('div', 'tc-aimpad', '<i></i>');
    this.root.append(this.pad);
    this.bindButtons();
    // Sin tecla Esc: un botón para rendirse (abre la misma ventana)
    const quit = this.quit = el('button', 'tc-quit', '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3v18M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>');
    // (al soltar el dedo, no al ponerlo: si se abría al ponerlo, el clic de soltarlo caía en el fondo de la ventana
    // recién abierta y la cerraba)
    quit.onpointerdown = e => e.preventDefault();
    quit.onclick = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    this.root.append(quit);
  }

  buildStick() {
    const zone = this.zone = el('div', 'tc-zone');
    const base = this.base = el('div', 'tc-base', '<div class="tc-knob"></div>');
    zone.append(base);
    this.root.append(zone);
    let id = null, ox = 0, oy = 0;
    const knob = base.firstChild;
    const place = (x, y) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };
    const reset = () => {
      id = null; this.move = { mx: 0, my: 0 };
      base.classList.remove('on'); knob.style.transform = '';
      place(zone.clientWidth * 0.32, zone.clientHeight * 0.62);
    };
    zone.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId; capture(zone, id);
      const r = zone.getBoundingClientRect();
      ox = e.clientX; oy = e.clientY;
      place(e.clientX - r.left, e.clientY - r.top);
      base.classList.add('on');
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.min(1, len / STICK_R);
      this.move = k < DEAD ? { mx: 0, my: 0 } : { mx: +(dx / STICK_R).toFixed(2), my: +(dy / STICK_R).toFixed(2) };
    });
    for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, e => { if (e.pointerId === id) reset(); });
    requestAnimationFrame(reset);
  }

  // Botones del HUD (movimientos, Protección, equipo, Balls); se vuelve a llamar si el HUD se rehace
  bindButtons() {
    const b = this.b;
    b.movesEl.querySelectorAll('.mv').forEach((btn, slot) => {
      if (btn.dataset.touch) return;
      btn.dataset.touch = '1';
      // En el botón redondo, el nombre en corto (una palabra por línea, las largas recortadas) en vez del icono
      const name = btn.querySelector('b');
      if (name) btn.append(el('span', 'tc-name', shortName(name.textContent)));
      if (btn.classList.contains('protect')) {
        btn.addEventListener('pointerdown', e => { e.preventDefault(); b.castQueue = 4; btn.classList.add('press'); });
        btn.addEventListener('pointerup', () => btn.classList.remove('press'));
        return;
      }
      let id = null, ox = 0, oy = 0;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (id !== null) return;
        id = e.pointerId; capture(btn, id);
        ox = e.clientX; oy = e.clientY;
        btn.classList.add('press');
      });
      btn.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - ox, dy = e.clientY - oy;
        if (Math.hypot(dx, dy) >= AIM_MIN) this.aiming = { slot, dx, dy };
        else if (this.aiming) this.aiming = { slot, dx: 0, dy: 0, cancel: true };
        if (this.aiming) this.showPad(ox, oy, dx, dy, this.aiming.cancel);
      });
      const end = e => {
        if (e.pointerId !== id) return;
        id = null; btn.classList.remove('press');
        this.pad.classList.remove('on');
        const a = this.aiming;
        this.aiming = null;
        if (a && a.cancel) return;            // arrastró y volvió al botón: no se lanza
        if (a) this.aimAt(a.dx, a.dy, slot); else this.autoAim();
        b.castQueue = slot;
      };
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', e => { if (e.pointerId === id) { id = null; this.aiming = null; btn.classList.remove('press'); this.pad.classList.remove('on'); } });
    });
    b.teamsEl[0].querySelectorAll('.tm').forEach(row => {
      if (row.dataset.touch) return;
      row.dataset.touch = '1';
      row.addEventListener('pointerdown', e => { e.preventDefault(); b.swapQueue = +row.dataset.slot; });
    });
    // Poké Balls: tocar una que no está elegida la elige; tocar la elegida (la grande, con «Lanzar») la lanza al rival
    if (b.ballEl) b.ballEl.onpointerdown = e => {
      const ball = e.target.closest('.ball');
      if (!ball || ball.classList.contains('none')) return;
      e.preventDefault();
      if (b.ballType !== ball.dataset.ball) { b.ballType = ball.dataset.ball; b.updateBallHud(); return; }
      this.autoAim();
      b.castQueue = 5;
      ball.classList.add('press'); setTimeout(() => ball.classList.remove('press'), 150);
    };
  }

  showPad(x, y, dx, dy, cancel) {
    const len = Math.hypot(dx, dy), k = len > AIM_PAD ? AIM_PAD / len : 1;
    this.pad.style.left = x + 'px'; this.pad.style.top = y + 'px';
    this.pad.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.pad.classList.add('on');
    this.pad.classList.toggle('cancel', !!cancel);
  }

  // Apuntar arrastrando (dx, dy px de pantalla desde el botón): en la dirección del arrastre tal como se ve (la
  // cámara va inclinada, así que se pasa por el suelo), tan lejos como se arrastre (AIM_PAD px = todo el alcance
  // del movimiento) y, si va casi hacia el rival, justo a él
  aimAt(dx, dy, slot) {
    const b = this.b, p = b.pred, len = Math.hypot(dx, dy);
    if (!p || !len) return;
    const s = b.toScreen(p.x, p.y), g = b.fromScreen(s.x + dx / len * 100, s.y + dy / len * 100);
    let ang = g ? Math.atan2(g.y - p.y, g.x - p.x) : Math.atan2(dy, dx);
    const m = slot >= 0 && slot < 4 ? b.moveOf(b.you, slot) : null;
    const reach = (m && (m.maxRange || m.range)) || AIM_RANGE;
    let dist = reach * Math.min(1, Math.max(0.25, len / AIM_PAD));
    const foe = b.renderPos && b.renderPos[b.foeIdx];
    if (foe && foe.st && foe.st.x !== undefined) {
      const fa = Math.atan2(foe.y - p.y, foe.x - p.x), fd = Math.hypot(foe.x - p.x, foe.y - p.y);
      if (Math.abs(Math.atan2(Math.sin(ang - fa), Math.cos(ang - fa))) < ASSIST && fd <= reach * 1.1) {
        ang = fa;
        if (m && m.maxRange) dist = Math.min(fd, m.maxRange);
      }
    }
    b.aim = { x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist };
  }

  // Al rival, si se le ve; si no, se queda donde estaba
  autoAim() {
    const b = this.b, foe = b.renderPos && b.renderPos[b.foeIdx];
    if (foe && foe.st && foe.st.x !== undefined) b.aim = { x: foe.x, y: foe.y };
  }

  // Cada fotograma (en vez del ratón): mientras se arrastra, hacia donde apunta el dedo; si no, al rival
  updateAim() {
    if (this.b.castQueue >= 0) return;   // un movimiento a punto de salir conserva su apuntado
    if (this.aiming && !this.aiming.cancel) this.aimAt(this.aiming.dx, this.aiming.dy, this.aiming.slot);
    else this.autoAim();
  }

  dispose() {
    document.body.classList.remove('touch-battle');
    this.zone.remove(); this.quit.remove(); this.pad.remove();
  }
}
