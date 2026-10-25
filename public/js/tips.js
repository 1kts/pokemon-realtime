// Tooltips con el estilo del juego en vez de los blancos del navegador: al pasar el ratón (o enfocar con el
// teclado) un elemento con title, su texto se pasa a data-tip (así el navegador no saca el suyo) y sale una
// tarjeta .ui-tip encima o debajo, sin salirse de la pantalla. Vale para todo lo que se pinte después.
const GAP = 8, MARGIN = 8;
let tip = null, target = null;

function show(node) {
  if (node.hasAttribute('title')) {
    node.dataset.tip = node.getAttribute('title');
    node.removeAttribute('title');
    // Sin texto propio (iconos), el título sigue sirviendo de nombre para lectores de pantalla
    if (!node.textContent.trim() && !node.hasAttribute('aria-label')) node.setAttribute('aria-label', node.dataset.tip);
  }
  const text = node.dataset.tip;
  if (!text) return;
  if (!tip) { tip = document.createElement('div'); tip.className = 'ui-tip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
  target = node;
  tip.textContent = text;
  tip.classList.add('on');
  const r = node.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const below = r.top - h - GAP < MARGIN;
  tip.classList.toggle('below', below);
  tip.style.left = Math.max(MARGIN, Math.min(innerWidth - w - MARGIN, r.left + r.width / 2 - w / 2)) + 'px';
  tip.style.top = (below ? r.bottom + GAP : r.top - h - GAP) + 'px';
}

function hide() {
  target = null;
  if (tip) tip.classList.remove('on');
}

const findTip = e => e.target instanceof Element && e.target.closest('[title], [data-tip]');
document.addEventListener('pointerover', e => { const n = findTip(e); if (n && n !== target) show(n); else if (!n) hide(); });
document.addEventListener('focusin', e => { const n = findTip(e); if (n) show(n); });
document.addEventListener('focusout', hide);
document.addEventListener('pointerdown', hide);
addEventListener('scroll', hide, true);
addEventListener('blur', hide);
