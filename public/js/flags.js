// Banderas de los idiomas en SVG (los emojis de bandera no se ven en Windows). 30×20, simplificadas.
const star = (cx, cy, r, rot = 0) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#FFDE00"/>`;
};
const bars = (h, ...cs) => cs.map((c, i) => h ? `<rect y="${(20 / cs.length) * i}" width="30" height="${20 / cs.length}" fill="${c}"/>` : `<rect x="${(30 / cs.length) * i}" width="${30 / cs.length}" height="20" fill="${c}"/>`).join('');
// Trigrama de la bandera de Corea: tres barras (partidas o no), giradas hacia el centro
const trigram = (x, y, rot, split) => `<g transform="translate(${x} ${y}) rotate(${rot})">${[0, 1, 2].map(i => split[i]
  ? `<rect x="-2.6" y="${i * 1.3 - 1.6}" width="2.2" height=".8"/><rect x=".4" y="${i * 1.3 - 1.6}" width="2.2" height=".8"/>`
  : `<rect x="-2.6" y="${i * 1.3 - 1.6}" width="5.2" height=".8"/>`).join('')}</g>`;

const FLAGS = {
  en: '<rect width="30" height="20" fill="#012169"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" stroke-width="1.5"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.8"/>',
  es: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  zh: '<rect width="30" height="20" fill="#DE2910"/>' + star(5, 5, 3) + star(10, 2, 1, 0.4) + star(12, 4, 1, 0.9) + star(12, 7, 1, 0) + star(10, 9, 1, 0.4),
  fr: bars(false, '#0055A4', '#FFFFFF', '#EF4135'),
  de: bars(true, '#000000', '#DD0000', '#FFCE00'),
  it: bars(false, '#009246', '#FFFFFF', '#CE2B37'),
  ja: '<rect width="30" height="20" fill="#FFFFFF"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>',
  ko: '<rect width="30" height="20" fill="#FFFFFF"/><circle cx="15" cy="10" r="4.6" fill="#0047A0"/><path d="M10.4 10a4.6 4.6 0 0 1 9.2 0 2.3 2.3 0 0 1-4.6 0 2.3 2.3 0 0 0-4.6 0" fill="#CD2E3A"/>'
    + '<g fill="#000">' + trigram(7.6, 5, -33.7, [0, 0, 0]) + trigram(22.4, 15, -33.7, [1, 1, 1]) + trigram(22.4, 5, 33.7, [1, 0, 1]) + trigram(7.6, 15, 33.7, [0, 1, 0]) + '</g>',
};

// <i class="flag"> con la bandera del idioma (o nada si no hay)
export function flag(lang) {
  const body = FLAGS[lang];
  return body ? `<i class="flag"><svg viewBox="0 0 30 20" aria-hidden="true">${body}</svg></i>` : '';
}
