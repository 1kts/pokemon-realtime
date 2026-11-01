// Ventana de confirmación del juego (en vez de la del navegador): título, texto y dos botones. Devuelve una
// promesa con true (aceptar) o false (cancelar, Esc o tocar fuera). Enter acepta.
//   if (await confirmBox({ title, text, ok: 'Vender', danger: true })) …
// hero: HTML opcional encima del título (p. ej. las caras de los dos Pokémon al rendirse) y cls, una clase más
import { t } from './i18n.js';

let open = null;   // el cuadro abierto: { cls, done }

// Cierra el cuadro abierto como «no» (solo si es de la clase cls, si se indica), sin tocar sus botones
export function closeConfirm(cls = '') {
  if (open && (!cls || open.cls === cls)) open.done(false);
}

export function confirmBox({ title, text = '', ok, cancel, danger = false, hero = '', cls = '' } = {}) {
  closeConfirm();
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal ui-confirm';
    back.innerHTML = `<div class="panel modal-box ui-confirm-box${danger ? ' danger' : ''}${cls ? ' ' + cls : ''}" role="alertdialog" aria-modal="true">
      ${hero}<h3>${title || t('¿Seguro?')}</h3>${text ? `<p>${text}</p>` : ''}
      <div class="acts"><button class="cancel">${cancel || t('Cancelar')}</button><button class="primary${danger ? ' danger-primary' : ''} ok">${ok || t('Aceptar')}</button></div></div>`;
    const done = v => { document.removeEventListener('keydown', key, true); back.remove(); open = null; resolve(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
    };
    back.onclick = e => { if (e.target === back) done(false); };
    back.querySelector('.cancel').onclick = () => done(false);
    back.querySelector('.ok').onclick = () => done(true);
    open = { cls, done };
    document.addEventListener('keydown', key, true);
    document.body.append(back);
    back.querySelector('.ok').focus();
  });
}
