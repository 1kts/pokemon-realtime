// El aspecto del juego: el tema D (docs/propuestas-ui.md, public/themes/tema-d.css), que index.html ya carga con la
// página (su hoja y la clase tema-d del <body>) para que no se vea un instante sin él. Las otras propuestas se pueden
// ver con ?tema=a, b o c en la dirección (se recuerda en arena.tema; ?tema=d vuelve al de siempre) y ?tema=no lo quita
// todo (el aspecto de antes): aquí se cambia la hoja y la clase
import { storage } from './net.js';

const TEMAS = ['a', 'b', 'c', 'd'];
const BASE = 'd';

export function temaActual() {
  const pedido = new URLSearchParams(location.search).get('tema');
  if (pedido !== null) {
    if (TEMAS.includes(pedido) || pedido === 'no') storage.set('arena.tema', pedido);
    else storage.del('arena.tema');
  }
  const t = storage.get('arena.tema');
  return t === 'no' ? null : TEMAS.includes(t) ? t : BASE;
}

const tema = temaActual();
if (tema !== BASE) {
  document.body.classList.remove('tema-' + BASE);
  const link = document.getElementById('tema-css');
  if (!tema) link.remove();
  else { link.href = `/themes/tema-${tema}.css`; document.body.classList.add('tema-' + tema); }
}
