// Propuestas de aspecto (docs/propuestas-ui.md), para elegir una antes de que entre en el juego: solo se ven si se
// piden. Con ?tema=a, b, c o d en la dirección (se recuerda en arena.tema; ?tema=no lo quita) se carga su hoja,
// public/themes/tema-X.css, después de las demás, y el <body> lleva la clase tema-X. Sin tema, el juego se ve como
// siempre: ni hoja ni clase
import { storage } from './net.js';

const TEMAS = ['a', 'b', 'c', 'd'];

export function temaActual() {
  const pedido = new URLSearchParams(location.search).get('tema');
  if (pedido !== null) {
    if (TEMAS.includes(pedido)) storage.set('arena.tema', pedido);
    else storage.del('arena.tema');
  }
  const t = storage.get('arena.tema');
  return TEMAS.includes(t) ? t : null;
}

const tema = temaActual();
if (tema) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/themes/tema-${tema}.css`;
  link.id = 'tema-css';
  document.head.append(link);
  document.body.classList.add('tema-' + tema);
}
