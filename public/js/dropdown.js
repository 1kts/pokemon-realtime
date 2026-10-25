// Desplegable con el estilo del juego, en lugar del <select> del sistema: botón con la opción elegida
// y un menú (en lista o en rejilla) que se cierra al elegir, al pulsar fuera, al desplazar la página o
// con Escape; las flechas mueven entre opciones. Abierto, el menú va en <body> junto al botón, para
// que ningún panel lo recorte ni lo tape. options: [{ value, label, icon? (HTML) }].
import { typeIcon } from './pixicons.js';
import { t } from './i18n.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export function dropdown({ options, value, onChange, cls = '', columns = 1, label = '' }) {
  const wrap = el('div', 'dd ' + cls);
  const btn = el('button', 'dd-btn');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  if (label) btn.setAttribute('aria-label', label);
  const menu = el('div', 'dd-menu ' + cls + (columns > 1 ? ' grid' : ''));
  menu.setAttribute('role', 'listbox');
  if (columns > 1) menu.style.setProperty('--cols', columns);
  menu.hidden = true;
  let current = value;
  const optHtml = o => `${o.icon || ''}<span>${o.label}</span>`;
  const paint = () => {
    const o = options.find(x => x.value === current) || options[0];
    btn.innerHTML = `${optHtml(o)}<i class="chev"></i>`;
    menu.querySelectorAll('.dd-item').forEach(b => { const on = b.dataset.v === String(current); b.classList.toggle('sel', on); b.setAttribute('aria-selected', on); });
  };
  for (const o of options) {
    const b = el('button', 'dd-item', optHtml(o));
    b.type = 'button';
    b.setAttribute('role', 'option');
    b.dataset.v = String(o.value);
    b.onclick = () => { close(); if (o.value !== current) { current = o.value; paint(); onChange(o.value); } };
    menu.append(b);
  }
  const outside = e => { if (!wrap.contains(e.target) && !menu.contains(e.target)) close(); };
  const away = e => { if (!menu.contains(e.target)) close(); };
  const keys = e => {
    const items = [...menu.querySelectorAll('.dd-item')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); btn.focus(); }
    else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      const cols = columns > 1 ? getComputedStyle(menu).gridTemplateColumns.split(' ').length : 1;   // en móvil la rejilla tiene menos
      const step = e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : e.key === 'ArrowRight' ? 1 : -1;
      items[Math.max(0, Math.min(items.length - 1, (i < 0 ? 0 : i + step)))].focus();
    }
  };
  // Debajo del botón (o encima si no cabe), sin salirse de la pantalla
  function place() {
    const r = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, innerWidth - m.width - 8));
    const top = r.bottom + 6 + m.height > innerHeight - 8 && r.top - 6 - m.height > 8 ? r.top - 6 - m.height : r.bottom + 6;
    Object.assign(menu.style, { left: left + 'px', top: top + 'px', minWidth: r.width + 'px' });
  }
  function open() {
    document.body.append(menu);
    menu.hidden = false;
    place();
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', away, true);
    addEventListener('resize', close);
    wrap.addEventListener('keydown', keys);
    menu.addEventListener('keydown', keys);
    (menu.querySelector('.dd-item.sel') || menu.querySelector('.dd-item')).focus();
  }
  function close() {
    menu.hidden = true;
    menu.remove();
    wrap.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('scroll', away, true);
    removeEventListener('resize', close);
    wrap.removeEventListener('keydown', keys);
    menu.removeEventListener('keydown', keys);
  }
  btn.onclick = () => (menu.hidden ? open() : close());
  wrap.append(btn);
  paint();
  return wrap;
}

// Selector de tipo (con su icono oficial) para los filtros de Mis Pokémon y la Pokédex
export function typeDropdown(types, value, onChange) {
  const all = `<span class="dd-all">${['fuego', 'agua', 'planta'].map(ty => typeIcon(ty, 14)).join('')}</span>`;
  return dropdown({ cls: 'dd-type', columns: 3, value, onChange, label: t('Todos los tipos'),
    options: [{ value: '', label: t('Todos los tipos'), icon: all }, ...types.map(ty => ({ value: ty, label: Data.TYPE_LABEL[ty], icon: typeIcon(ty, 20) }))] });
}
