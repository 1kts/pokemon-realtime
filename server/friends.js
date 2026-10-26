// Amigos: se añaden por nombre con su etiqueta (Ash#4821) o desde la ficha de un entrenador; el otro acepta o rechaza
// la solicitud. Hace falta cuenta (los invitados se borran solos a los 60 días). En cada perfil:
//   friends: [ids]  ·  friendIn: [{ id, at }] (solicitudes recibidas)  ·  friendOut: [ids] (enviadas)
const store = require('./store.js');
const D = require('../public/data.js');

const MAX = 100, MAX_IN = 30;

function ensure(p) {
  if (!Array.isArray(p.friends)) p.friends = [];
  if (!Array.isArray(p.friendIn)) p.friendIn = [];
  if (!Array.isArray(p.friendOut)) p.friendOut = [];
  return p;
}
const drop = (list, id) => list.filter(x => (x.id || x) !== id);

// A quién se refiere: «Nombre#1234» o un id
function find(q) {
  const s = String(q || '').trim().slice(0, 40);
  const m = s.match(/^(.+?)#(\d{4})$/);
  if (m) return store.byNameTag(m[1].trim(), m[2]);
  return store.byId(s);
}

// Una acción sobre los amigos. Devuelve { error } o { ok, touched: [perfiles cambiados] }
function action(p, msg) {
  ensure(p);
  if (!p.account) return { error: 'Crea una cuenta para tener amigos' };
  const a = String(msg.a || '');
  const o = a === 'add' ? find(msg.who) : store.byId(String(msg.id || ''));
  if (!o) return { error: a === 'add' ? 'No hay ningún entrenador con ese nombre y etiqueta' : 'Ese entrenador ya no existe' };
  ensure(o);
  if (o === p) return { error: 'No puedes añadirte a ti mismo' };
  if (o.npc) return { error: 'Es un entrenador de la IA' };
  if (a === 'add') {
    if (!o.account) return { error: 'Ese entrenador juega como invitado: necesita una cuenta para tener amigos' };
    if (p.friends.includes(o.id)) return { error: 'Ya sois amigos' };
    if (p.friends.length >= MAX) return { error: 'Ya tienes 100 amigos' };
    // Si él ya te lo había pedido, quedáis como amigos directamente
    if (p.friendIn.some(x => x.id === o.id)) return befriend(p, o);
    if (p.friendOut.includes(o.id)) return { error: 'Ya le has enviado una solicitud' };
    if (o.friendIn.length >= MAX_IN) return { error: 'Ese entrenador tiene demasiadas solicitudes pendientes' };
    p.friendOut.push(o.id);
    o.friendIn.push({ id: p.id, at: Date.now() });
    return { ok: 'Solicitud enviada', touched: [p, o], request: o };
  }
  if (a === 'accept') {
    if (!p.friendIn.some(x => x.id === o.id)) return { error: 'No hay ninguna solicitud de ese entrenador' };
    if (p.friends.length >= MAX || o.friends.length >= MAX) return { error: 'Uno de los dos ya tiene 100 amigos' };
    return befriend(p, o);
  }
  if (a === 'decline') { p.friendIn = drop(p.friendIn, o.id); o.friendOut = drop(o.friendOut, p.id); return { ok: 'Solicitud rechazada', touched: [p, o] }; }
  if (a === 'cancel') { p.friendOut = drop(p.friendOut, o.id); o.friendIn = drop(o.friendIn, p.id); return { ok: 'Solicitud cancelada', touched: [p, o] }; }
  if (a === 'remove') { p.friends = drop(p.friends, o.id); o.friends = drop(o.friends, p.id); return { ok: 'Amigo quitado', touched: [p, o] }; }
  return { error: 'Acción desconocida' };
}
function befriend(p, o) {
  p.friendIn = drop(p.friendIn, o.id); o.friendOut = drop(o.friendOut, p.id);
  o.friendIn = drop(o.friendIn, p.id); p.friendOut = drop(p.friendOut, o.id);
  if (!p.friends.includes(o.id)) p.friends.push(o.id);
  if (!o.friends.includes(p.id)) o.friends.push(p.id);
  return { ok: '¡Ahora sois amigos!', touched: [p, o] };
}

// La lista para el jugador: sus amigos (en línea primero, con lo que están haciendo), las solicitudes recibidas
// y las enviadas. doing(id): qué hace ese jugador si está conectado (o null)
function list(p, doing) {
  ensure(p);
  const card = id => {
    const o = store.byId(id);
    if (!o) return null;
    const team = Object.values(o.teams || {}).flat().map(u => (o.mons || []).find(m => m.uid === u)).filter(Boolean).sort((a, b) => b.level - a.level)[0];
    return { id: o.id, name: o.name, tag: o.tag, elo: o.elo, ranked: o.ranked || 0, title: o.title || null, dex: team ? team.dex : null, shiny: !!(team && team.shiny && !team.plain),
      doing: doing(o.id), seen: o.seen || null };
  };
  const friends = p.friends.map(card).filter(Boolean).sort((a, b) => (!!b.doing - !!a.doing) || (b.seen || 0) - (a.seen || 0));
  return { friends, in: p.friendIn.map(x => card(x.id)).filter(Boolean), out: p.friendOut.map(card).filter(Boolean) };
}

// Buscar entrenadores por nombre para añadirlos (solo los que tienen cuenta): primero los que empiezan así, y
// cada uno con su Pokémon, su ELO, si está en línea y cómo estáis (amigos, solicitud enviada o recibida)
function search(p, q, doing) {
  ensure(p);
  const s = String(q || '').replace(/#\d*$/, '').trim().toLowerCase().slice(0, 20);
  if (s.length < 2) return [];
  const hits = [];
  for (const o of store.all()) {
    if (o === p || !o.account || o.staff) continue;
    const n = o.name.toLowerCase(), at = n.indexOf(s);
    if (at < 0) continue;
    hits.push([at === 0 ? 0 : 1, o.seen || 0, o]);
    if (hits.length > 400) break;
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  return hits.slice(0, 8).map(([, , o]) => {
    const team = Object.values(o.teams || {}).flat().map(u => (o.mons || []).find(m => m.uid === u)).filter(Boolean).sort((a, b) => b.level - a.level)[0];
    // (y algo más para reconocerle: título, medallas, Pokédex y victorias en Clasificatoria)
    return { id: o.id, name: o.name, tag: o.tag, elo: o.elo, ranked: o.ranked || 0, dex: team ? team.dex : null, shiny: !!(team && team.shiny && !team.plain), doing: doing(o.id),
      title: o.title || null, badges: D.REGION_IDS.reduce((n, r) => n + Math.min(8, D.progOf(o, r)), 0), caught: D.dexCount(o), wins: o.wins || 0,
      rel: p.friends.includes(o.id) ? 'friend' : p.friendOut.includes(o.id) ? 'out' : p.friendIn.some(x => x.id === o.id) ? 'in' : null };
  });
}

// Si se borra un jugador, desaparece de las listas de los demás
store.onRemove(gone => {
  for (const o of store.all()) {
    if (!o.friends && !o.friendIn && !o.friendOut) continue;
    const before = JSON.stringify([o.friends, o.friendIn, o.friendOut]);
    ensure(o);
    o.friends = drop(o.friends, gone.id); o.friendIn = drop(o.friendIn, gone.id); o.friendOut = drop(o.friendOut, gone.id);
    if (JSON.stringify([o.friends, o.friendIn, o.friendOut]) !== before) store.persist(o);
  }
});

module.exports = { action, list, search, ensure, MAX };
