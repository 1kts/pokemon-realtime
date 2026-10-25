// Marcos del avatar: una capa SVG animada encima del avatar (el aro de color lo pone el CSS con
// .frame-<id>). Lienzo de 150×150 con el avatar en el centro (radio 50): lo que pasa de 50 sobresale.
// Ligas de clasificatoria (bronce → maestro), los de logros y los de maestría de cada tipo (tipo-<tipo>).
import { elementalFx } from './menufx.js';

const C = 75, R = 50;
let uid = 0;
const spin = (dur, rev) => `<animateTransform attributeName="transform" type="rotate" from="${rev ? 360 : 0} ${C} ${C}" to="${rev ? 0 : 360} ${C} ${C}" dur="${dur}s" repeatCount="indefinite"/>`;
const blink = (dur, delay = 0, lo = 0.15) => `<animate attributeName="opacity" values="${lo};1;${lo}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>`;
const polar = (deg, r) => [C + r * Math.cos((deg - 90) * Math.PI / 180), C + r * Math.sin((deg - 90) * Math.PI / 180)];
const star4 = (x, y, s) => `M${x},${y - s} L${x + s * .25},${y - s * .25} L${x + s},${y} L${x + s * .25},${y + s * .25} L${x},${y + s} L${x - s * .25},${y + s * .25} L${x - s},${y} L${x - s * .25},${y - s * .25}Z`;
const sparkles = (list, fill = '#fff') => list.map(([deg, r, s, d], i) => { const [x, y] = polar(deg, r); return `<path d="${star4(x, y, s)}" fill="${fill}" opacity=".2">${blink(1.6 + (i % 3) * .5, d ?? i * .37)}</path>`; }).join('');

// Aro con degradado metálico y un brillo que da vueltas
function ring(id, stops, w = 6, shine = 0) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="${R - 1}" fill="none" stroke="url(#${id})" stroke-width="${w}"/>
    <circle cx="${C}" cy="${C}" r="${R - 1 + w / 2 - .6}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1"/>
    ${shine ? `<g><circle cx="${C}" cy="${C}" r="${R - 1}" fill="none" stroke="#fff" stroke-width="${w - 1}" stroke-linecap="round" stroke-dasharray="14 400" opacity=".85"/>${spin(shine)}</g>` : ''}`;
}

// Rama de laurel por la parte de abajo (izquierda y derecha)
function laurel(color, dark) {
  let out = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const deg = 180 + side * (28 + i * 17);
      const [x, y] = polar(deg, R + 7);
      out += `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="7.5" fill="${i % 2 ? dark : color}" stroke="${dark}" stroke-width=".6" transform="rotate(${deg + side * 35} ${x} ${y})"/>`;
    }
  }
  return out;
}

// Corona arriba; gems: colores de las piedras
function crown(gold, dark, gems) {
  const y = C - R - 4;
  return `<g transform="translate(${C} ${y})"><path d="M-17,6 L-19,-12 L-9,-3 L0,-17 L9,-3 L19,-12 L17,6Z" fill="${gold}" stroke="${dark}" stroke-width="1.4" stroke-linejoin="round"/>
    <rect x="-17" y="4" width="34" height="5" rx="1.5" fill="${dark}"/>
    ${gems.map((g, i) => `<circle cx="${[-10, 0, 10][i]}" cy="6.5" r="2" fill="${g}"/>`).join('')}
    <circle cx="0" cy="-17" r="2.4" fill="${gems[1]}"/><circle cx="-19" cy="-12" r="1.8" fill="${gems[0]}"/><circle cx="19" cy="-12" r="1.8" fill="${gems[2]}"/></g>`;
}

// Gema facetada en una posición del aro
function gem(deg, fill, light, s = 7) {
  const [x, y] = polar(deg, R - 1);
  return `<g transform="translate(${x} ${y}) rotate(${deg})"><path d="M0,${-s} L${s * .8},0 L0,${s} L${-s * .8},0Z" fill="${fill}" stroke="#0a2a5a" stroke-width=".8"/>
    <path d="M0,${-s} L${s * .8},0 L0,0Z" fill="${light}" opacity=".85"/><path d="M0,${-s * .55} L${s * .25},${-s * .1} L0,0Z" fill="#fff"/></g>`;
}

// Puntos que orbitan alrededor
const orbit = (n, r, colors, dur, rev, size = 2.6) => `<g>${Array.from({ length: n }, (_, i) => { const [x, y] = polar(i * 360 / n, r); return `<circle cx="${x}" cy="${y}" r="${size}" fill="${colors[i % colors.length]}"><animate attributeName="r" values="${size * .6};${size};${size * .6}" dur="1.8s" begin="${i * .3}s" repeatCount="indefinite"/></circle>`; }).join('')}${spin(dur, rev)}</g>`;

// ---------- Marcos de tipo: cada tipo con su propio dibujo (olas, hojas y flores, rayos, escarcha…) ----------
// Todo va en el anillo de 50 a 74 alrededor del avatar. around() reparte una forma por el círculo,
// girada para mirar hacia fuera (0° = arriba). band() es el aro base con degradado del tipo.
const around = (n, r, fn, off = 0) => Array.from({ length: n }, (_, i) => { const d = off + i * 360 / n; const [x, y] = polar(d, r); return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${d.toFixed(1)})">${fn(i, d)}</g>`; }).join('');
const at = (deg, r, body, rot = deg) => { const [x, y] = polar(deg, r); return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot})">${body}</g>`; };
function band(id, stops, w = 8, r = R + 3) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="${w + 3}"/>
    <circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${w}"/>
    <circle cx="${C}" cy="${C}" r="${r - w / 2 + .6}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>`;
}
const glowRing = (col, r = R + 8, w = 12) => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" opacity=".22">${blink(2.6, 0, .08)}</circle>`;
const flicker = (dur, d = 0) => `<animateTransform attributeName="transform" additive="sum" type="scale" values="1 1;1.08 .9;.94 1.1;1 1" dur="${dur}s" begin="${d}s" repeatCount="indefinite"/>`;
const flower = (petal, core, s = 1) => `<g transform="scale(${s})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-4" rx="2.8" ry="4.2" fill="${petal}" stroke="rgba(0,0,0,.3)" stroke-width=".5" transform="rotate(${a})"/>`).join('')}<circle r="2.2" fill="${core}"/></g>`;
const leaf = (fill, dark, s = 1) => `<path d="M0,-9 C5,-5 5,4 0,9 C-5,4 -5,-5 0,-9Z" transform="scale(${s})" fill="${fill}" stroke="${dark}" stroke-width=".9"/><path d="M0,-7 L0,7" transform="scale(${s})" stroke="${dark}" stroke-width=".7" opacity=".7"/>`;
const bolt = (fill, s = 1) => `<path d="M1.5,-11 L-6,1 L-1,1 L-3,11 L6,-2 L1,-2Z" transform="scale(${s})" fill="${fill}" stroke="#8a6a00" stroke-width=".9" stroke-linejoin="round"/>`;
const shard = (fill, s = 1) => `<path d="M0,-13 L4,-3 L2.5,6 L-2.5,6 L-4,-3Z" transform="scale(${s})" fill="${fill}" stroke="#3a8fb0" stroke-width=".8"/><path d="M0,-13 L1.5,-3 L0,6Z" transform="scale(${s})" fill="#fff" opacity=".7"/>`;
const rock = (fill, dark, s = 1) => `<path d="M-7,3 L-5,-5 L1,-8 L7,-3 L6,5 L-1,7Z" transform="scale(${s})" fill="${fill}" stroke="${dark}" stroke-width="1"/><path d="M-5,-5 L1,-8 L1,-2Z" transform="scale(${s})" fill="#fff" opacity=".25"/>`;
const flame = (a, b, s = 1, d = 0) => `<g transform="scale(${s})"><path d="M0,-13 C6,-6 8,0 5,5 C3,9 -3,9 -5,5 C-8,0 -3,-4 -2,-8 C-1,-5 1,-4 0,-13Z" fill="${a}" stroke="#a02a00" stroke-width=".8">${flicker(.9 + d * .2, d * .15)}</path><path d="M0,-5 C3,-1 3,3 1,5 C0,6 -2,5 -2,3 C-2,1 0,0 0,-5Z" fill="${b}"/></g>`;
const feather = (fill, dark, s = 1) => `<path d="M0,-12 C5,-6 5,6 0,12 C-3,6 -3,-6 0,-12Z" transform="scale(${s})" fill="${fill}" stroke="${dark}" stroke-width=".8"/><path d="M0,-11 L0,11" transform="scale(${s})" stroke="${dark}" stroke-width=".6"/>`;
const heart = fill => `<path d="M0,5 C-9,-1 -5,-8 0,-3 C5,-8 9,-1 0,5Z" fill="${fill}" stroke="#a03070" stroke-width=".8"/>`;

const TYPE_FRAME = {
  agua: id => `${glowRing('#4a90ff')}${band(id, ['#bfe6ff', '#4a90ff', '#1a4aa0'])}
    ${around(10, R + 11, () => `<path transform="scale(1.35)" d="M-7,3 C-7,-6 6,-9 7,-1 C5,-5 0,-5 -1,0 C-2,4 2,5 4,3 C2,7 -7,7 -7,3Z" fill="#7ac0ff" stroke="#1a4aa0" stroke-width=".9"/><circle cx="-2" cy="-3" r="1.2" fill="#fff"/>`)}
    ${around(5, R + 18, (i) => `<circle r="${2 + (i % 2)}" fill="none" stroke="#d6efff" stroke-width="1"><animate attributeName="opacity" values=".2;1;.2" dur="2.4s" begin="${i * .5}s" repeatCount="indefinite"/></circle>`, 18)}
    ${at(180, R + 10, `<path d="M0,-11 C5,-4 7,0 7,3 A7,7 0 0 1 -7,3 C-7,0 -5,-4 0,-11Z" fill="#4a90ff" stroke="#0a2a6a" stroke-width="1.2"/><circle cx="-2" cy="1" r="2" fill="#fff" opacity=".8"/>`, 0)}`,
  planta: id => `${glowRing('#5cd04a')}${band(id, ['#c8f5a0', '#5cd04a', '#2a7a1a'])}
    ${around(14, R + 9, (i) => leaf(i % 2 ? '#7ad84a' : '#4fb02a', '#1f5a10', .95), 0)}
    ${[30, 150, 210, 330, 90, 270].map((d, i) => at(d, R + 15, flower(i % 2 ? '#ffd6ec' : '#fff4fa', '#ffcb05', .9), 0)).join('')}`,
  electrico: id => `${glowRing('#ffd23a')}${band(id, ['#fff7b0', '#ffd23a', '#a07800'])}
    <polygon points="${Array.from({ length: 36 }, (_, i) => polar(i * 10, R + (i % 2 ? 14 : 9)).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#fff6a0" stroke-width="1.6" stroke-linejoin="round" opacity=".9">${blink(.6, 0, .4)}</polygon>
    ${around(6, R + 14, (i) => bolt(i % 2 ? '#fff176' : '#ffd23a', 1.05), 30)}
    ${around(6, R + 21, (i) => `<path d="${star4(0, 0, 3)}" fill="#fff">${blink(.9, i * .15)}</path>`)}`,
  hielo: id => `${glowRing('#90e8ff')}${band(id, ['#ffffff', '#b8f0ff', '#4aa8d0'])}
    ${around(12, R + 11, (i) => shard(i % 2 ? '#d8f7ff' : '#a8ecff', i % 2 ? .8 : 1.1))}
    ${at(0, R + 18, `<g stroke="#fff" stroke-width="1.6" stroke-linecap="round">${[0, 60, 120].map(a => `<path d="M0,-8 L0,8 M-2.5,-6 L0,-4 L2.5,-6 M-2.5,6 L0,4 L2.5,6" transform="rotate(${a})"/>`).join('')}</g>`, 0)}
    ${around(8, R + 20, (i) => `<circle r="1.2" fill="#fff">${blink(1.8, i * .25)}</circle>`, 22)}`,
  fuego: id => `${glowRing('#ff7a30', R + 9, 14)}${band(id, ['#ffd08a', '#ff7a30', '#a02a00'])}
    ${around(12, R + 10, (i) => flame(i % 2 ? '#ff9a3a' : '#ff5a1a', '#ffe680', i % 2 ? .85 : 1.1, i))}`,
  lucha: id => `${glowRing('#e05030')}
    <circle cx="${C}" cy="${C}" r="${R + 4}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="12"/>
    <circle cx="${C}" cy="${C}" r="${R + 4}" fill="none" stroke="#f4f0e6" stroke-width="9"/>
    <circle cx="${C}" cy="${C}" r="${R + 4}" fill="none" stroke="#e05030" stroke-width="9" stroke-dasharray="7 7" transform="rotate(10 ${C} ${C})"/>
    ${at(180, R + 7, `<rect x="-14" y="-5" width="28" height="10" rx="2" fill="#1e1e24" stroke="#000" stroke-width="1"/><rect x="-4" y="-7" width="8" height="14" rx="2" fill="#2e2e36" stroke="#000"/><path d="M-3,6 L-8,16 M3,6 L8,16" stroke="#1e1e24" stroke-width="4" stroke-linecap="round"/>`, 0)}`,
  veneno: id => `${glowRing('#b050d0')}${band(id, ['#e6a8ff', '#b050d0', '#5a1a7a'])}
    ${around(9, R + 9, (i) => `<circle cx="0" cy="${i % 2 ? -2 : 0}" r="${i % 3 ? 6 : 8}" fill="${i % 2 ? '#c870ff' : '#9a3ac0'}" stroke="#4a0a6a" stroke-width=".9"/><circle cx="-1.5" cy="-1.5" r="1.4" fill="#fff" opacity=".7"/>`)}
    ${[160, 180, 200].map((d, i) => at(d, R + 10, `<path d="M0,0 C3,6 2,12 0,14 C-2,12 -3,6 0,0Z" fill="#b050d0" stroke="#4a0a6a" stroke-width=".8"><animateTransform attributeName="transform" type="translate" values="0 0;0 4;0 0" dur="${2 + i * .4}s" repeatCount="indefinite"/></path>`, 0)).join('')}`,
  tierra: id => `${glowRing('#d8b060')}${band(id, ['#f0d8a0', '#c89040', '#6a4a1a'])}
    ${around(10, R + 10, (i) => rock(i % 2 ? '#c8a060' : '#a8783a', '#4a3010', i % 2 ? .85 : 1.1))}`,
  roca: id => `${glowRing('#b8a058')}${band(id, ['#e0d4a8', '#a89060', '#4a3a20'], 9)}
    ${around(8, R + 11, (i) => rock(i % 2 ? '#9a8a70' : '#7a6a54', '#2e2418', i % 2 ? 1.1 : 1.4), 22)}`,
  volador: id => `${glowRing('#a8a8ff')}${band(id, ['#ffffff', '#c8d0ff', '#6a70d0'])}
    ${[[255, -1], [105, 1]].map(([d, side]) => [0, 1, 2, 3].map(k => at(d + side * k * 15, R + 14 + k, feather(k % 2 ? '#f0f4ff' : '#d6dcff', '#5a60b0', 1.5 - k * .12), d + side * (k * 13 + 70))).join('')).join('')}
    ${at(0, R + 13, `<path d="M-12,3 A5,5 0 0 1 -6,-4 A7,7 0 0 1 6,-5 A5,5 0 0 1 12,3Z" fill="#fff" stroke="#8a90d0" stroke-width="1"/>`, 0)}`,
  psiquico: id => `${glowRing('#ff5890')}${band(id, ['#ffd0e0', '#ff5890', '#a0204a'])}
    <g><circle cx="${C}" cy="${C}" r="${R + 11}" fill="none" stroke="#ff9ec0" stroke-width="1.4" stroke-dasharray="3 6"/>${spin(14)}</g>
    <g><circle cx="${C}" cy="${C}" r="${R + 17}" fill="none" stroke="#ffd0e0" stroke-width="1" stroke-dasharray="12 10" opacity=".7"/>${spin(20, true)}</g>
    ${around(4, R + 4, () => `<path d="M0,-6 L4,0 L0,6 L-4,0Z" fill="#ff5890" stroke="#fff" stroke-width="1"/>`, 45)}
    ${at(0, R + 8, `<path d="M-12,0 C-6,-8 6,-8 12,0 C6,8 -6,8 -12,0Z" fill="#fff" stroke="#a0204a" stroke-width="1.2"/><circle r="4.5" fill="#ff5890"/><circle r="2" fill="#2a0a1a"/>`, 0)}`,
  bicho: id => `${glowRing('#a8c830')}${band(id, ['#e6f5a0', '#a8c830', '#4a6a10'])}
    ${[[250, -1], [110, 1]].map(([d, side]) => at(d, R + 12, `<ellipse cx="0" cy="-8" rx="10" ry="17" fill="#c8f0ff" fill-opacity=".75" stroke="#4a7a30" stroke-width="1"/><ellipse cx="${side * 2}" cy="11" rx="7" ry="11" fill="#a8e0ff" fill-opacity=".7" stroke="#4a7a30" stroke-width="1"/>`, d + side * 90)).join('')}
    ${[-14, 14].map(o => at(o, R + 6, `<path d="M0,0 C0,-8 3,-12 4,-14" fill="none" stroke="#2a3a10" stroke-width="1.6" stroke-linecap="round"/><circle cx="4" cy="-14" r="2.4" fill="#a8c830" stroke="#2a3a10"/>`, o)).join('')}
    ${around(6, R + 4, () => `<circle r="2.2" fill="#d8f060" stroke="#4a6a10" stroke-width=".7"/>`, 30)}`,
  fantasma: id => `${glowRing('#7058c0', R + 9, 16)}${band(id, ['#c8b8ff', '#7058c0', '#2a1a5a'])}
    <g>${around(9, R + 10, (i) => `<path d="M0,-12 C5,-6 6,2 3,7 C1,4 -1,8 -3,6 C-6,2 -5,-6 0,-12Z" fill="${i % 2 ? '#a088ff' : '#7a5ae0'}" opacity=".9"/><circle cx="-1.5" cy="-2" r="1.2" fill="#fff"/><circle cx="1.8" cy="-2" r="1.2" fill="#fff"/>`)}${spin(40)}</g>`,
  dragon: id => `${glowRing('#7038f8', R + 9, 14)}${band(id, ['#c8b0ff', '#7038f8', '#2a1070'])}
    ${around(16, R + 7, (i) => `<path d="M-4,-4 L4,-4 L0,5Z" fill="${i % 2 ? '#8a5aff' : '#5a2ad0'}" stroke="#1a0a4a" stroke-width=".7"/>`)}
    ${[-24, 24].map(o => at(o, R + 8, `<path d="M0,4 C-2,-6 ${o > 0 ? 6 : -6},-14 ${o > 0 ? 10 : -10},-18 C${o > 0 ? 4 : -4},-10 3,-2 4,4Z" fill="#e0d4ff" stroke="#2a1070" stroke-width="1"/>`, o)).join('')}
    ${at(0, R + 6, `<path d="M0,-8 L6,0 L0,8 L-6,0Z" fill="#ff5ad1" stroke="#fff" stroke-width="1.2"/><path d="M0,-8 L3,0 L0,0Z" fill="#fff" opacity=".6"/>`, 0)}`,
  acero: id => `${glowRing('#b8b8d0')}
    <g>${around(16, R + 9, () => `<rect x="-3.5" y="-5" width="7" height="9" rx="1.2" fill="#c8ccdc" stroke="#4a4e60" stroke-width="1"/>`)}${spin(30)}</g>
    ${band(id, ['#ffffff', '#b8b8d0', '#5a5e70'], 10)}
    ${around(8, R + 3, () => `<circle r="2" fill="#8a8ea0" stroke="#2e3040" stroke-width=".8"/><circle cx="-.6" cy="-.6" r=".7" fill="#fff"/>`, 22.5)}`,
  siniestro: id => `${glowRing('#3a2a50', R + 9, 16)}${band(id, ['#8a7a9a', '#3a2a40', '#100818'])}
    ${around(14, R + 9, (i) => `<path d="M-3,3 L0,${i % 2 ? -9 : -13} L3,3Z" fill="#2a1a34" stroke="#8a6aa8" stroke-width=".8"/>`)}
    ${at(0, R + 16, `<path transform="scale(1.4)" d="M4,-11 A11,11 0 1 0 4,11 A8,8 0 1 1 4,-11Z" fill="#ffe680" stroke="#8a6a00" stroke-width="1"/>`, -20)}
    ${around(5, R + 20, (i) => `<path d="${star4(0, 0, 2.6)}" fill="#e6d8ff">${blink(2, i * .4)}</path>`, 60)}`,
  hada: id => `${glowRing('#ff9ee0')}${band(id, ['#ffe6f6', '#ff9ee0', '#c05aa0'])}
    ${around(8, R + 11, (i) => i % 2 ? heart('#ff7ac8') : `<path d="${star4(0, 0, 5)}" fill="#fff4fa" stroke="#c05aa0" stroke-width=".7">${blink(1.6, i * .2, .5)}</path>`)}
    ${at(180, R + 8, `<path d="M0,0 C-8,-8 -16,-2 -12,4 C-9,7 -4,3 0,0 C4,3 9,7 12,4 C16,-2 8,-8 0,0Z" fill="#ff7ac8" stroke="#a03070" stroke-width="1"/><circle r="3" fill="#ffd6ee" stroke="#a03070"/>`, 0)}`,
  normal: id => `${glowRing('#c8c0a0')}${band(id, ['#fffaf0', '#d8d0b0', '#7a7258'])}
    ${laurel('#e6dfc4', '#8a8268')}
    ${around(4, R + 3, () => `<path d="${star4(0, 0, 5)}" fill="#fffaf0" stroke="#8a8268" stroke-width=".8"/>`, 0)}`,
};

function typeFrame(type, id) {
  if (TYPE_FRAME[type]) return TYPE_FRAME[type](id);
  const col = Data.TYPE_COLOR[type] || '#ccc';
  return `${glowRing(col)}${ring(id, ['#fff', col, col, '#222'], 6, 5)}`;
}

const FX = {
  bronce: id => `${ring(id, ['#f3c08a', '#c27c46', '#7a4420', '#c27c46'], 6)}
    ${[45, 135, 225, 315].map(d => { const [x, y] = polar(d, R - 1); return `<circle cx="${x}" cy="${y}" r="2.6" fill="#f3c08a" stroke="#5a2e10" stroke-width=".8"/>`; }).join('')}`,
  plata: id => `${ring(id, ['#ffffff', '#cfd8e3', '#8794a6', '#e8eef5'], 6, 4)}
    ${sparkles([[40, R + 9, 5], [140, R + 8, 4], [290, R + 9, 4.5]])}`,
  oro: id => `<circle cx="${C}" cy="${C}" r="${R + 4}" fill="none" stroke="#ffcb05" stroke-width="8" opacity=".25">${blink(2.2, 0, .1)}</circle>
    ${laurel('#ffd84a', '#a8740a')}${ring(id, ['#fff3a0', '#ffcb05', '#b8860b', '#ffe066'], 7, 3.5)}
    <path d="${star4(C, C - R - 3, 8)}" fill="#fff3a0" stroke="#a8740a" stroke-width=".8"/>
    ${sparkles([[60, R + 10, 4], [300, R + 10, 4]])}`,
  platino: id => `${ring(id, ['#e9fffb', '#7fe6d4', '#3a9c8c', '#c8fff4'], 6, 4)}
    <g><circle cx="${C}" cy="${C}" r="${R + 8}" fill="none" stroke="#7fe6d4" stroke-width="1.4" stroke-dasharray="2 7" opacity=".9"/>${spin(16)}</g>
    <g><circle cx="${C}" cy="${C}" r="${R + 13}" fill="none" stroke="#c8fff4" stroke-width="1" stroke-dasharray="10 14" opacity=".6"/>${spin(22, true)}</g>
    ${orbit(3, R + 8, ['#ffffff', '#c8fff4', '#7fe6d4'], 7)}`,
  diamante: id => `<circle cx="${C}" cy="${C}" r="${R + 5}" fill="none" stroke="#7ab8ff" stroke-width="10" opacity=".3">${blink(2, 0, .1)}</circle>
    ${ring(id, ['#e6f3ff', '#7ab8ff', '#2a5cb8', '#bfe0ff'], 7, 3)}
    <g><circle cx="${C}" cy="${C}" r="${R + 9}" fill="none" stroke="#bfe0ff" stroke-width="1.2" stroke-dasharray="4 4 1 4" opacity=".8"/>${spin(20, true)}</g>
    ${[0, 90, 180, 270].map(d => gem(d, '#4a9cff', '#d6ecff', d % 180 ? 6 : 8)).join('')}
    ${sparkles([[45, R + 12, 5], [135, R + 11, 4], [225, R + 12, 4.5], [315, R + 11, 5]], '#e6f3ff')}`,
  maestro: id => `<circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="#c878ff" stroke-width="12" opacity=".3">${blink(2.6, 0, .12)}</circle>
    <g>${ring(id, ['#ffcb05', '#ff5ad1', '#7a5cff', '#46d0ff', '#4fd06a', '#ffcb05'], 7, 3)}${spin(6)}</g>
    ${orbit(6, R + 9, ['#ffcb05', '#ff5ad1', '#7a5cff', '#46d0ff', '#4fd06a', '#ff9a1a'], 8)}
    ${orbit(4, R + 15, ['#ffffff'], 13, true, 1.6)}
    ${crown('#ffcb05', '#8a5a00', ['#ff5ad1', '#46d0ff', '#4fd06a'])}
    ${sparkles([[100, R + 12, 5], [260, R + 12, 5], [180, R + 10, 4]])}`,
  campeon: id => `${laurel('#ffd84a', '#a8740a')}${ring(id, ['#fff3a0', '#ffcb05', '#ff9a1a', '#ffcb05'], 7, 3)}${crown('#ffcb05', '#8a5a00', ['#e8403a', '#3b78d8', '#e8403a'])}`,
  shiny: id => `${ring(id, ['#fff3a0', '#a0e6ff', '#ffb0e8', '#fff3a0'], 5, 3)}
    ${sparkles([[20, R + 9, 6], [70, R + 12, 4], [115, R + 8, 5], [165, R + 12, 3.5], [210, R + 9, 6], [255, R + 12, 4], [300, R + 8, 5], [340, R + 12, 3.5]], '#fffbe0')}`,
  pokedex: id => `${ring(id, ['#ff8a8a', '#e8403a', '#9a1a1a', '#ff5a5a'], 6, 5)}
    ${[0, 120, 240].map(d => { const [x, y] = polar(d, R + 8); return `<circle cx="${x}" cy="${y}" r="3.5" fill="#7ad0ff" stroke="#fff" stroke-width="1">${blink(1.4, d / 200)}</circle>`; }).join('')}`,
  torre: id => `${ring(id, ['#e6d0ff', '#b47cff', '#5a2aa8', '#d0b0ff'], 6, 4)}${orbit(5, R + 9, ['#b47cff', '#e6d0ff'], 10)}`,
};

// SVG del marco (o '' si no tiene capa)
export function frameFx(frame) {
  if (!frame) return '';
  const id = 'fr' + (++uid);
  const body = frame.startsWith('tipo-') ? typeFrame(frame.slice(5), id) : FX[frame] ? FX[frame](id) : '';
  return body ? `<svg class="ava-fx" viewBox="0 0 150 150" aria-hidden="true">${body}</svg>` : '';
}

// Vista previa de un marco sin Pokémon (premios de liga, misiones, logros): el aro y su capa animada
export function frameBadge(frame, size) {
  const ring = frameRing(frame);
  return `<span class="ava fr-badge frame-${frame || 'none'}" style="--s:${size}px${ring ? `;--ring:${ring}` : ''}">${frameFx(frame)}</span>`;
}

// Brillo de burbuja: un halo animado detrás del avatar, del color de un tipo (tipo-<tipo>) o prismático
export function auraHtml(aura) {
  if (!aura) return '';
  const col = aura.startsWith('tipo-') ? Data.TYPE_COLOR[aura.slice(5)] : null;
  return `<i class="ava-aura aura-${col ? 'tipo' : aura}"${col ? ` style="--aura:${col}"` : ''}></i>`;
}

// Color del aro para los marcos de tipo (el CSS solo conoce los fijos)
export const frameRing = frame => frame && frame.startsWith('tipo-') ? Data.TYPE_COLOR[frame.slice(5)] : null;

// Maestría de la línea evolutiva: estrellas, barra hasta el siguiente premio y victorias
export function masteryHtml(p, dex, t) {
  const wins = Data.masteryWins(p, dex), tier = Data.masteryTier(wins);
  const next = Data.MASTERY[tier], n = Data.MASTERY.length;
  const title = next ? t('Maestría: {w}/{n} victorias con su línea evolutiva. Siguiente premio: {prize}', { w: wins, n: next, prize: masteryPrize(Data.MASTERY_TIERS[tier], dex, t) }) : t('Maestría completa: {w} victorias con su línea evolutiva', { w: wins });
  const ready = Data.masteryReady(p, dex).length;
  return `<div class="mastery${ready ? ' ready' : ''}" title="${title}"><i class="mstars">${'★'.repeat(tier)}${'☆'.repeat(n - tier)}</i>${next ? `<span class="mbar"><i style="width:${wins / next * 100}%"></i></span><span>${wins}/${next}</span>` : `<span>${wins} ${t('victorias')}</span>`}</div>`;
}

// Nombre del premio de un nivel de maestría para la línea de dex
export const SKIN_LABEL = { oro: 'Skin Edición Oro', holo: 'Skin Holo', galaxia: 'Skin Galaxia', elemental: 'Skin Elemental' };
// Nombre de un glow del avatar (la luz de alrededor): de tipo o especial
const AURA_LABEL = { dorado: 'Dorado', sombra: 'Sombra', estelar: 'Estelar', prisma: 'Prismático' };
const AURA_COLOR = { dorado: '#ffcb05', sombra: '#7a3cff', estelar: '#bfe6ff' };
export const auraDot = g => `<i class="glow-dot${g === 'prisma' ? ' glow-prisma' : ''}" style="--gc:${g.startsWith('tipo-') ? Data.TYPE_COLOR[g.slice(5)] : AURA_COLOR[g] || '#fff'}"></i>`;
export const auraName = (g, t) => t('Glow {type}', { type: g.startsWith('tipo-') ? Data.TYPE_LABEL[g.slice(5)] : t(AURA_LABEL[g]) });

// Pone una skin a un retrato en los menús: clase CSS (oro, holo, galaxia) o, la elemental, el efecto
// pintado en el canvas del retrato (menufx.js); sin canvas (una ilustración), un brillo del color del tipo
// parts: con las partículas de la línea (otro premio, van con cualquier skin; solo en canvas)
export function applySkin(node, skin, dex, parts = false) {
  const type = Data.SPECIES[Data.lineOf(dex)].types[0];
  const canvas = node instanceof HTMLCanvasElement || (node.querySelector && node.querySelector('canvas'));
  if (skin === 'elemental') {
    if (canvas) elementalFx(node, type, Data.TYPE_COLOR[type], { particles: !!parts });
    else { node.classList.add('skin-elemental'); node.style.setProperty('--fx', Data.TYPE_COLOR[type]); }
    return node;
  }
  if (parts && canvas) elementalFx(node, type, Data.TYPE_COLOR[type], { recolor: false });
  if (skin) node.classList.add('skin-' + skin);
  return node;
}
export function masteryPrize(tier, dex, t) {
  const type = Data.TYPE_LABEL[Data.SPECIES[Data.lineOf(dex)].types[0]];
  return {
    star: t('estrella de bronce'), art: t('ilustración oficial como avatar'), portrait: t('retrato como avatar'), aura: t('Glow {type}', { type }),
    frame: t('marco animado de su tipo'), skin: t(SKIN_LABEL[tier.skin] || ''), title: t('título «Maestro de {m}»', { m: Data.SPECIES[Data.lineOf(dex)].name }),
  }[tier.kind] + (tier.aura ? ' · ' + auraName(tier.aura, t) : '');
}
