// Avisos al móvil o al PC (Web Push): «Avísame» pide permiso, se suscribe con la clave del servidor (llega en
// 'welcome') y manda la suscripción. El service worker (/sw.js) los enseña aunque el juego esté cerrado. En el iPhone
// solo funcionan con el juego instalado en la pantalla de inicio. Los tipos se eligen en Ajustes (server/push.js).
import { t } from './i18n.js';
import { storage } from './net.js';

// Los avisos van por aparato: este navegador apunta su suscripción (el perfil dice si hay alguno en algún aparato)
const EP = 'arena.pushEp';
export const pushHere = () => !!storage.get(EP);

let vapid = null;
export const setVapid = k => { vapid = k; };

const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || !!navigator.standalone;
// ¿Se pueden activar aquí? (en el iPhone, solo instalado como app)
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushNeedsInstall = () => ios && !standalone() && !pushSupported();
export const pushBlocked = () => 'Notification' in window && Notification.permission === 'denied';

function swReady() {
  return navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);
}
// Al cargar: deja el service worker puesto si ya tenía los avisos (para que sigan llegando)
export function pushInit() {
  if (pushSupported() && Notification.permission === 'granted') swReady().catch(() => {});
}

// Activar en este aparato. Devuelve null si va bien o un texto con lo que ha pasado
export async function pushEnable(net) {
  if (pushNeedsInstall()) return t('En el iPhone, los avisos funcionan con el juego instalado en la pantalla de inicio.');
  if (!pushSupported()) return t('Este navegador no puede recibir avisos.');
  if (!vapid) return t('No se han podido activar los avisos. Prueba otra vez en un momento.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return t('Has bloqueado los avisos. Puedes permitirlos en los ajustes del navegador.');
  try {
    const reg = await swReady();
    const key = Uint8Array.from(atob(vapid.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    net.send({ t: 'push', a: 'sub', sub: sub.toJSON(), tz: -new Date().getTimezoneOffset() });
    storage.set(EP, sub.endpoint);
    return null;
  } catch {
    return t('No se han podido activar los avisos. Prueba otra vez en un momento.');
  }
}

// Quitarlos de este aparato (y en el servidor)
export async function pushDisable(net) {
  const ep = storage.get(EP);
  storage.del(EP);
  if (ep) net.send({ t: 'push', a: 'unsub', endpoint: ep });
  try {
    const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { if (sub.endpoint !== ep) net.send({ t: 'push', a: 'unsub', endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch {}
}

// Al tocar un aviso con el juego ya abierto, el service worker no recarga la página (cortaría un combate): avisa
// y el juego va a esa pantalla cuando puede
export function onPushOpen(go) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && typeof e.data.ir === 'string') go(e.data.ir); });
  navigator.serviceWorker.startMessages();
}
