// Las bolitas de «tienes algo nuevo»: una sola cuenta para todas las pantallas. Sale de comparar lo que tiene el perfil
// con lo que ya se ha visto (en este navegador, por cuenta), así que un cosmético o un reto nuevo entra solo.
// La primera vez todo cuenta como visto: quien ya jugaba no se encuentra el juego lleno de avisos.
import { storage } from './net.js';
import { t } from './i18n.js';

const keyOf = p => 'arena.seenLoot.' + (p.id || p.name);

// Lo que tiene el jugador: las skins y las partículas son de una línea; el resto, de su avatar
function owned(p) {
  const c = p.cosmetics || {};
  const mastery = Object.entries(p.masteryClaimed || {}).flatMap(([root, list]) =>
    list.map(i => Data.MASTERY_TIERS[i]).filter(x => x && x.kind === 'skin').map(x => `${x.skin}:${root}`));
  return { skins: [...(c.skins || []), ...mastery], particles: (c.particles || []).map(String),
    frame: c.frames || [], aura: c.auras || [], effect: c.effects || [], avatar: c.avatars || [], title: c.titles || [] };
}

function seen(p) {
  let s = null;
  try { s = JSON.parse(storage.get(keyOf(p))); } catch { /* sin guardar o estropeado: se empieza de cero */ }
  if (s) return s;
  s = owned(p);
  storage.set(keyOf(p), JSON.stringify(s));
  return s;
}

const lineOfEntry = (kind, x) => +(kind === 'skins' ? x.split(':')[1] : x);
// Lo pendiente, calculado una vez por repintado (Mis Pokémon pregunta por cada tarjeta) y olvidado al acabar
let memo = null;
function pending(p) {
  if (memo && memo.p === p) return memo;
  const s = seen(p), o = owned(p), left = {};
  for (const kind of Object.keys(o)) { const old = new Set(s[kind] || []); left[kind] = o[kind].filter(x => !old.has(x)); }
  const lines = new Set(['skins', 'particles'].flatMap(k => left[k].map(x => lineOfEntry(k, x))));
  memo = { p, o, left, lines };
  setTimeout(() => { memo = null; });
  return memo;
}
const unseen = (p, kind) => pending(p).left[kind];

function markSeen(p, kind, list) {
  const s = seen(p);
  s[kind] = [...new Set([...(s[kind] || []), ...list])];
  storage.set(keyOf(p), JSON.stringify(s));
  memo = null;
}

// ¿Hay algo nuevo en esta pestaña del editor del avatar?, ¿y en alguna?
export const avatarTabNews = (p, tab) => unseen(p, tab).length > 0;
export const avatarNews = p => ['avatar', 'frame', 'aura', 'effect', 'title'].some(k => avatarTabNews(p, k));
export const seeAvatarTab = (p, tab) => markSeen(p, tab, pending(p).o[tab]);

// Un Pokémon: skin o partículas nuevas de su línea, para el Vestuario; retos por recoger, para Retos
export const lookNews = (p, dex) => pending(p).lines.has(Data.lineOf(dex));
export const retosNews = (p, dex) => Data.masteryReady(p, Data.lineOf(dex)).length > 0;
export const monNews = (p, dex) => lookNews(p, dex) || retosNews(p, dex);
export const monsNews = p => p.mons.some(m => monNews(p, m.dex));
export function seeLook(p, dex) {
  const line = Data.lineOf(dex);
  for (const k of ['skins', 'particles']) markSeen(p, k, unseen(p, k).filter(x => lineOfEntry(k, x) === line));
}

// La bolita: encendida, sin número
export function newsDot() {
  const d = document.createElement('i');
  d.className = 'ndot lit';
  d.setAttribute('role', 'img');
  d.setAttribute('aria-label', t('Novedad'));
  return d;
}
