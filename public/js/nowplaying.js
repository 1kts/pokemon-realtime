// Al empezar a sonar un tema, su título y su autor unos segundos, con enlace a su página: la música es suya y se dice
const SHOWN = 6000;
let hide = null;

export function showTrack(credit) {
  if (!credit) return;
  const [title, author, url] = credit;
  const box = document.querySelector('.now-playing') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'now-playing' }));
  box.textContent = `♪ ${title} · `;
  box.append(Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener noreferrer', textContent: author }));
  requestAnimationFrame(() => box.classList.add('on'));
  clearTimeout(hide);
  hide = setTimeout(() => box.classList.remove('on'), SHOWN);
}
