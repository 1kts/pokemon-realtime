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
const AIM_RANGE = 320;      // a qué distancia se apunta al arrastrar, unidades de juego

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
  const gate = el('div', 'rotate-gate', '<b>⟳</b><span></span>');
  const text = () => { gate.querySelector('span').textContent = t('Gira el móvil para jugar en horizontal'); };
  text();
  addEventListener('resize', text);
  document.body.append(gate);
  // iPhone/iPad en Safari: no deja pantalla completa en una web; como app (Añadir a pantalla de inicio) sí. Se
  // explica una vez, con una ✕ para no volver a verlo
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let seen = false;
  try { seen = !!localStorage.getItem('arena.iosTip'); } catch {}
  if (ios && !navigator.standalone && !seen) {
    const tip = el('div', 'ios-tip', `<span>${t('Para jugar a pantalla completa, como una app: pulsa Compartir y luego «Añadir a pantalla de inicio».')}</span><button aria-label="${t('Cerrar')}">✕</button>`);
    tip.querySelector('button').onclick = () => { tip.remove(); try { localStorage.setItem('arena.iosTip', '1'); } catch {} };
    document.body.append(tip);
  }
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
    this.bindButtons();
    // Sin tecla Esc: un botón para rendirse (abre la misma ventana)
    const quit = this.quit = el('button', 'tc-quit', '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3v18M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>');
    quit.onpointerdown = e => { e.preventDefault(); dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); };
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
      });
      const end = e => {
        if (e.pointerId !== id) return;
        id = null; btn.classList.remove('press');
        const a = this.aiming;
        this.aiming = null;
        if (a && a.cancel) return;            // arrastró y volvió al botón: no se lanza
        if (a) this.aimAt(a.dx, a.dy); else this.autoAim();
        b.castQueue = slot;
      };
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', e => { if (e.pointerId === id) { id = null; this.aiming = null; btn.classList.remove('press'); } });
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

  // Apuntar en una dirección de la pantalla (la cámara mira de frente: derecha es +x y abajo es +y)
  aimAt(dx, dy) {
    const p = this.b.pred, len = Math.hypot(dx, dy) || 1;
    if (!p) return;
    this.b.aim = { x: p.x + dx / len * AIM_RANGE, y: p.y + dy / len * AIM_RANGE };
  }

  // Al rival, si se le ve; si no, se queda donde estaba
  autoAim() {
    const b = this.b, foe = b.renderPos && b.renderPos[b.foeIdx];
    if (foe && foe.st && foe.st.x !== undefined) b.aim = { x: foe.x, y: foe.y };
  }

  // Cada fotograma (en vez del ratón): mientras se arrastra, hacia donde apunta el dedo; si no, al rival
  updateAim() {
    if (this.b.castQueue >= 0) return;   // un movimiento a punto de salir conserva su apuntado
    if (this.aiming && !this.aiming.cancel) this.aimAt(this.aiming.dx, this.aiming.dy);
    else this.autoAim();
  }

  dispose() {
    document.body.classList.remove('touch-battle');
    this.zone.remove(); this.quit.remove();
  }
}
