// Color del cursor elegido por el jugador (Ajustes): la flecha con Poké Ball del ratón y la retícula de
// apuntar en combate. Se guarda en este navegador. 'classic' es el de siempre (flecha blanca y Poké
// Ball roja); un color #rrggbb tiñe la flecha y la parte de arriba de la Poké Ball.
import { storage } from './net.js';

const KEY = 'arena.cursor';
export const CURSOR_COLORS = ['classic', '#ff5a5a', '#ff9a3d', '#ffd23f', '#5fe08a', '#4fd6ff', '#4f8cff', '#b07bff', '#ff8ad8', '#2a2a33'];
const valid = c => c === 'classic' || /^#[0-9a-f]{6}$/i.test(c);

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));
const dark = c => { const [r, g, b] = rgb(c); return 0.299 * r + 0.587 * g + 0.114 * b < 70; };

// Colores de flecha, Poké Ball y borde para un estado (normal, al pasar por encima de algo pulsable)
function parts(color, hover) {
  if (color === 'classic') return hover ? ['#fff4b0', '#ffcb05', '#1a1a1a'] : ['#ffffff', '#e83030', '#1a1a1a'];
  const line = dark(color) ? '#f4f4f4' : '#1a1a1a';
  return hover ? [mix(color, '#ffffff', 0.45), mix(color, '#ffffff', 0.25), line] : [color, color, line];
}

export function cursorSvg(color, hover = false) {
  const [arrow, ball, line] = parts(color, hover);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M2 2 L2 20 L7 15 L11 24 L15 22 L11 13 L18 13 Z" fill="${arrow}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="20" r="6.5" fill="#f4f4f4" stroke="${line}" stroke-width="1.6"/><path d="M13.5 20 A6.5 6.5 0 0 1 26.5 20 Z" fill="${ball}"/><rect x="13.5" y="19.2" width="13" height="1.6" fill="${line}"/><circle cx="20" cy="20" r="1.8" fill="#f4f4f4" stroke="${line}" stroke-width="1.2"/></svg>`;
}
const url = (color, hover) => `url("data:image/svg+xml,${encodeURIComponent(cursorSvg(color, hover))}") 2 2, auto`;

export const getCursor = () => { const c = storage.get(KEY); return c && valid(c) ? c : 'classic'; };
// Color de la retícula del combate (la clásica es blanca)
export const reticleColor = () => { const c = getCursor(); return c === 'classic' ? '#ffffff' : c; };

export function applyCursor(color = getCursor()) {
  const s = document.documentElement.style;
  s.setProperty('--cur', url(color, false));
  s.setProperty('--cur-hover', url(color, true));
}

export function setCursor(color) {
  if (!valid(color)) return;
  storage.set(KEY, color);
  applyCursor(color);
}
