// Service worker de PokéArenas: solo para los avisos (Web Push). No guarda nada en caché ni toca las peticiones del
// juego. Al llegar un aviso lo enseña; al tocarlo, abre el juego (o lo trae al frente) en la pantalla del aviso.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'PokéArenas', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'PokéArenas', {
    body: m.body || '', icon: '/app/icon-192.png', badge: '/app/icon-192.png', tag: m.tag || 'pokearenas',
    data: { url: typeof m.url === 'string' && m.url.startsWith('/') ? m.url : '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const path = e.notification.data && e.notification.data.url;
  const url = new URL(typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? path : '/', self.location.origin);
  e.waitUntil((async () => {
    // Con el juego ya abierto: al frente y que vaya a esa pantalla él mismo (sin recargar: no corta un combate)
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(w => new URL(w.url).origin === self.location.origin);
    if (open) { await open.focus(); open.postMessage({ ir: url.searchParams.get('ir') || '' }); return; }
    return self.clients.openWindow(url.href);
  })());
});
