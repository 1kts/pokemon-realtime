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

// Formas de los marcos de tipo (centradas en 0,0, unos 20 de alto)
const MOTIF = {
  fuego: 'M0,-10 C5,-4 7,0 5,5 C3,9 -3,9 -5,5 C-7,1 -3,-2 -2,-6 C-1,-3 1,-2 0,-10Z',
  agua: 'M0,-10 C4,-4 7,0 7,3 A7,7 0 0 1 -7,3 C-7,0 -4,-4 0,-10Z',
  planta: 'M0,-10 C7,-5 7,5 0,10 C-7,5 -7,-5 0,-10Z M0,-7 L0,8',
  bicho: 'M0,-10 C7,-5 7,5 0,10 C-7,5 -7,-5 0,-10Z M0,-7 L0,8',
  electrico: 'M2,-10 L-6,2 L-1,2 L-3,10 L6,-3 L1,-3Z',
  hielo: 'M0,-9 L0,9 M-8,-4.5 L8,4.5 M-8,4.5 L8,-4.5 M-2.5,-7 L0,-4.5 L2.5,-7 M-2.5,7 L0,4.5 L2.5,7',
  roca: 'M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4Z',
  tierra: 'M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4Z',
  acero: 'M0,-8 L7,-4 L7,4 L0,8 L-7,4 L-7,-4Z M0,-3 A3,3 0 1 0 0.01,-3Z',
  veneno: 'M0,-3 A6,6 0 1 1 -0.01,-3Z M-5,-7 A2.5,2.5 0 1 1 -5.01,-7Z',
  fantasma: 'M-6,8 L-6,-2 A6,6 0 0 1 6,-2 L6,8 L3,5 L0,8 L-3,5Z',
  hada: 'M0,8 C-10,0 -6,-9 0,-4 C6,-9 10,0 0,8Z',
  psiquico: 'M0,-9 C8,-9 9,3 2,4 C-3,5 -3,-1 1,-1',
  dragon: 'M0,-10 L4,-2 L10,0 L4,2 L0,10 L-4,2 L-10,0 L-4,-2Z',
};
const STROKED = { hielo: 1, psiquico: 1 };

function typeFrame(type, id) {
  const col = Data.TYPE_COLOR[type] || '#ccc';
  const path = MOTIF[type] || star4(0, 0, 9);
  const motifs = Array.from({ length: 8 }, (_, i) => {
    const [x, y] = polar(i * 45 + 22.5, R + 10);
    const style = STROKED[type] ? `fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"` : `fill="${col}" stroke="rgba(0,0,0,.45)" stroke-width="1"`;
    return `<path d="${path}" transform="translate(${x} ${y}) rotate(${i * 45 + 22.5}) scale(.95)" ${style}/>`;
  }).join('');
  const [mx, my] = [C, C + R + 1];
  return `<circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="${col}" stroke-width="10" opacity=".25">${blink(2.4, 0, .1)}</circle>
    ${ring(id, ['#fff', col, col, '#222'], 6, 5)}
    <g>${motifs}${spin(30)}</g>
    <circle cx="${mx}" cy="${my}" r="12.5" fill="#141a33" stroke="${col}" stroke-width="2.4"/>
    <image href="types/${type}.png" x="${mx - 9.5}" y="${my - 9.5}" width="19" height="19"/>`;
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
// Pone una skin a un retrato en los menús: clase CSS (oro, holo, galaxia) o, la elemental, el efecto
// pintado en el canvas del retrato (menufx.js); sin canvas (una ilustración), un brillo del color del tipo
export function applySkin(node, skin, dex) {
  if (!skin) return node;
  if (skin === 'elemental') {
    const type = Data.SPECIES[Data.lineOf(dex)].types[0];
    if (node instanceof HTMLCanvasElement || (node.querySelector && node.querySelector('canvas'))) elementalFx(node, type, Data.TYPE_COLOR[type]);
    else { node.classList.add('skin-elemental'); node.style.setProperty('--fx', Data.TYPE_COLOR[type]); }
    return node;
  }
  node.classList.add('skin-' + skin);
  return node;
}
export function masteryPrize(tier, dex, t) {
  const type = Data.TYPE_LABEL[Data.SPECIES[Data.lineOf(dex)].types[0]];
  return {
    star: t('estrella de bronce'), art: t('ilustración oficial como avatar'), aura: t('brillo de burbuja {type}', { type }),
    frame: t('marco animado de su tipo'), skin: t(SKIN_LABEL[tier.skin] || ''),
  }[tier.kind] + (tier.title ? ' · ' + t('título y brillo prismático') : '');
}
