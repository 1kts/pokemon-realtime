// Panel de administración. Habla con el servidor por el mismo WebSocket que el juego, con mensajes
// admin.* (ver server/admin.js). Todo lo que viene de los jugadores se pinta como texto, nunca como
// HTML, para que un nombre con código no se ejecute aquí.
const $ = s => document.querySelector(s);
// h('td', { class: 'x', onclick }, 'texto', otroNodo…): crea un elemento; los textos van con textContent
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const fmtDate = t => t ? new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' }) : '—';
const fmtBytes = n => n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3 | 0) + ' KB';
const fmtDur = ms => { const m = ms / 60000 | 0; return m < 60 ? `${m} min` : m < 1440 ? `${m / 60 | 0} h ${m % 60} min` : `${m / 1440 | 0} d ${(m % 1440) / 60 | 0} h`; };
function toast(text, bad) {
  const t = $('#toast');
  t.textContent = text; t.className = bad ? 'bad' : ''; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
}

// ---------- Conexión ----------
let ws, logged = false, rid = 0;
const waiting = new Map();   // rid -> resolve
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { $('#conn').hidden = true; showLogin(); };
  ws.onclose = () => { logged = false; $('#conn').hidden = false; setTimeout(connect, 2000); };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.rid && waiting.has(m.rid)) { waiting.get(m.rid)(m); waiting.delete(m.rid); return; }
    if (m.t === 'admin.ok') return onLogin(m);
    if (m.t === 'admin.err') { $('#login-err').textContent = m.msg; return; }
    if (m.t === 'admin.out') { logged = false; showLogin(m.msg); }
  };
}
// Petición con respuesta
function ask(t, data = {}) {
  return new Promise(resolve => {
    const id = ++rid;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ t, rid: id, ...data }));
  });
}

// ---------- Acceso ----------
function showLogin(msg) {
  for (const s of document.querySelectorAll('.tab')) s.hidden = true;
  $('#top').hidden = true;
  $('#login').hidden = false;
  $('#login-err').textContent = msg && msg !== 'Inicia sesión otra vez' ? msg : '';
  $('#login [name=code]').value = '';
}
$('#login').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#login-err').textContent = '';
  ws.send(JSON.stringify({ t: 'admin.login', user: f.get('user'), pass: f.get('pass'), code: f.get('code') }));
});
function onLogin(m) {
  logged = true;
  $('#login').hidden = true;
  $('#login [name=pass]').value = '';
  $('#top').hidden = false;
  $('#who').textContent = `${m.name} · v${m.version}`;
  show(current);
}
$('#logout').addEventListener('click', () => ws.send(JSON.stringify({ t: 'admin.logout' })));

// ---------- Pestañas ----------
let current = 'resumen';
function show(tab) {
  current = tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('sel', b.dataset.tab === tab);
  for (const s of document.querySelectorAll('.tab')) s.hidden = s.id !== tab;
  if (tab === 'resumen') overview();
  if (tab === 'auditoria' && !$('#audit tbody').children.length) loadAudit();
  if (tab === 'servidor') overview(true);
}
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => show(b.dataset.tab));
// El resumen se actualiza solo cada 5 s mientras se mira
setInterval(() => { if (logged && current === 'resumen' && !document.hidden) overview(); }, 5000);

// ---------- Resumen ----------
const stat = (label, value, warn) => h('div', { class: 'stat' + (warn ? ' warn' : '') }, h('b', {}, value), h('span', {}, label));
async function overview(onlyServer) {
  const o = await ask('admin.overview');
  if (o.t !== 'admin.overview') return;
  $('#maint-state').textContent = o.maintenance ? 'ACTIVADO' : 'desactivado';
  if (onlyServer) return;
  const s = o.store, sv = o.server;
  const modes = Object.entries(o.byMode).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'ninguno';
  const box = $('#resumen');
  box.replaceChildren(
    h('div', { class: 'stats' },
      stat('jugadores conectados', o.online), stat(`combates (${modes})`, o.battles),
      stat('en cola (clasif. / rápida)', `${o.queues.ranked || 0} / ${o.queues.casual || 0}`), stat('drafts', o.drafts),
      stat('perfiles · cuentas', `${s.profiles} · ${s.accounts}`), stat('perfiles nuevos hoy', s.newToday),
      stat('suspendidos', s.banned, s.banned > 0), stat('mantenimiento', o.maintenance ? 'SÍ' : 'no', o.maintenance),
      stat('versión · en marcha', `v${o.version} · ${fmtDur(o.uptime)}`), stat('memoria del juego', fmtBytes(sv.rss)),
      stat(`carga (${sv.cpus} CPU)`, sv.load.map(x => x.toFixed(2)).join(' ')), stat('RAM libre del servidor', `${fmtBytes(sv.freemem)} / ${fmtBytes(sv.totalmem)}`),
      stat('base de datos', fmtBytes(s.dbBytes)), stat('admins conectados', o.admins)),
    h('div', { class: 'cols' },
      h('div', { class: 'card scroll' }, h('h2', {}, 'Conectados ahora'),
        o.onlineList.length ? table(['Jugador', 'Haciendo', 'IP'], o.onlineList.map(p => h('tr', { class: 'click', onclick: () => openPlayer(p.id) },
          h('td', {}, p.name), h('td', {}, p.doing), h('td', {}, p.ip)))) : h('p', { class: 'small' }, 'Nadie conectado.')),
      h('div', { class: 'card scroll' }, h('h2', {}, 'Eventos de las últimas 24 h'),
        table(['Tipo', 'Cuántos'], o.events24h.map(e => h('tr', { class: 'click', onclick: () => auditBy({ type: e.type }) },
          h('td', {}, typeTag(e.type)), h('td', {}, e.n))))),
      h('div', { class: 'card scroll' }, h('h2', {}, 'Últimas acciones de admin'),
        o.recentAdmin.length ? table(['Fecha', 'Acción', 'Quién', 'A quién'], o.recentAdmin.map(r => h('tr', {},
          h('td', {}, fmtDate(r.at)), h('td', {}, typeTag(r.type)), h('td', {}, r.actorName || r.actor || '—'), h('td', {}, r.targetName || r.target || '—'))))
          : h('p', { class: 'small' }, 'Ninguna todavía.'))));
}
const table = (heads, rows) => h('table', {}, h('thead', {}, h('tr', {}, heads.map(x => h('th', {}, x)))), h('tbody', {}, rows));
function typeTag(type) {
  const g = type.split('.')[0];
  const cls = g === 'admin' ? 'admin' : g === 'limite' ? 'limite' : /fallo|bloqueada|suspendida/.test(type) ? 'fallo' : '';
  return h('span', { class: 'tag ' + cls }, type);
}

// ---------- Jugadores ----------
$('#search').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await ask('admin.search', { q: new FormData(e.target).get('q') });
  $('#results').replaceChildren(r.rows.length ? table(['Nombre', 'Usuario', 'ELO', 'Alta', ''], r.rows.map(p => h('tr', { class: 'click', onclick: () => openPlayer(p.id) },
    h('td', {}, p.name), h('td', {}, p.user || 'invitado'), h('td', {}, p.ranked ? p.elo : '—'), h('td', {}, fmtDate(p.created)),
    h('td', {}, p.online && h('span', { class: 'tag on' }, 'en línea'), p.banned && h('span', { class: 'tag ban' }, 'suspendido')))))
    : h('p', { class: 'small' }, 'Nadie con ese nombre, usuario o id.'));
});

async function openPlayer(id) {
  if (current !== 'jugadores') show('jugadores');
  const { player } = await ask('admin.player', { id });
  const box = $('#player');
  if (!player) return box.replaceChildren(h('p', { class: 'err' }, 'No existe.'));
  const p = player.profile;
  const tw = p.tower || {};
  const act = (a, extra = {}) => async () => {
    const r = await ask('admin.action', { a, id: p.id, ...extra });
    if (r.err) return toast(r.err, true);
    toast(r.ok);
    await openPlayer(p.id);
    if (r.secret) box.prepend(h('div', { class: 'card' }, h('p', {}, r.ok + ' (cópiala ahora: no se vuelve a mostrar):'), h('p', { class: 'secret' }, r.secret)));
  };
  const reason = h('input', { placeholder: 'Motivo', maxlength: 200 });
  const hours = h('select', {}, [[1, '1 hora'], [24, '1 día'], [168, '7 días'], [720, '30 días'], [0, 'Para siempre']].map(([v, l]) => h('option', { value: v }, l)));
  hours.value = '24';
  const newName = h('input', { placeholder: 'Nombre nuevo', maxlength: 16, value: p.name });
  box.replaceChildren(
    h('h1', {}, p.name, ' ', p.online && h('span', { class: 'tag on' }, 'en línea'), ' ', p.banned && h('span', { class: 'tag ban' }, 'suspendido'), ' ', player.admin && h('span', { class: 'tag admin' }, 'admin')),
    h('dl', { class: 'kv' },
      ...[['Id', p.id], ['Usuario', p.account ? p.account.user : 'invitado (sin cuenta)'], ['Alta', fmtDate(p.created)], ['Cuenta desde', p.account && fmtDate(p.account.since)],
        ['Clasificatoria', `${p.elo} ELO · ${p.wins || 0} V / ${p.losses || 0} D · ${p.ranked || 0} combates`], ['Dinero', `₽ ${(p.coins || 0).toLocaleString('es-ES')}`],
        ['Pokémon', `${(p.mons || []).length} · Pokédex ${(p.caught || []).length} · shinies ${(p.shinies || []).length}`],
        ['Torre', `mejor racha ${tw.best || 0}${tw.team ? ` · en curso ${tw.streak || 0}` : ''}`],
        ['Suspensión', p.ban ? `${p.ban.reason} · ${p.ban.until ? 'hasta ' + fmtDate(p.ban.until) : 'para siempre'} · desde ${fmtDate(p.ban.at)}${p.banned ? '' : ' (ya terminó)'}` : 'no'],
      ].filter(([, v]) => v).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('h3', {}, 'Moderación'),
    h('div', { class: 'actions' },
      h('label', {}, 'Motivo', reason), h('label', {}, 'Duración', hours),
      h('button', { class: 'danger', onclick: () => confirm(`¿Suspender a ${p.name}?`) && act('ban', { reason: reason.value, hours: +hours.value })() }, 'Suspender'),
      p.ban && h('button', { onclick: act('unban') }, 'Levantar suspensión'),
      h('button', { onclick: () => act('kick', { reason: reason.value })() }, 'Desconectar')),
    h('div', { class: 'actions' },
      h('label', {}, 'Nombre de entrenador', newName), h('button', { onclick: () => act('rename', { name: newName.value })() }, 'Renombrar'),
      p.account && h('button', { onclick: () => confirm(`¿Poner una contraseña nueva a ${p.account.user}? La actual dejará de valer.`) && act('resetpass')() }, 'Resetear contraseña')),
    player.connections.length ? h('div', {}, h('h3', {}, 'Conexiones abiertas'), table(['IP', 'Haciendo'], player.connections.map(x => h('tr', {}, h('td', {}, x.ip), h('td', {}, x.doing))))) : null,
    h('h3', {}, 'IPs usadas'),
    player.ips.length ? table(['IP', 'Eventos', 'Última vez'], player.ips.map(x => h('tr', { class: 'click', onclick: () => auditBy({ ip: x.ip }) }, h('td', {}, x.ip), h('td', {}, x.n), h('td', {}, fmtDate(x.last)))))
      : h('p', { class: 'small' }, 'Sin registros.'),
    player.alts.length ? h('div', {}, h('h3', {}, 'Otros perfiles desde las mismas IPs'), table(['Jugador', 'IP'], player.alts.map(a => h('tr', { class: 'click', onclick: () => openPlayer(a.id) }, h('td', {}, a.name || a.id), h('td', {}, a.ip))))) : null,
    h('h3', {}, 'Historial ', h('span', { class: 'link', onclick: () => auditBy({ who: p.id }) }, '(ver en auditoría)')),
    table(['Fecha', 'Tipo', 'IP', 'Datos'], player.events.map(r => h('tr', {}, h('td', {}, fmtDate(r.at)), h('td', {}, typeTag(r.type)), h('td', {}, r.ip || ''), h('td', { class: 'data' }, describe(r))))));
}
// Datos de un evento en una línea, con los nombres en vez de los ids
function describe(r) {
  const parts = [];
  if (r.actorName && r.target) parts.push(`${r.actorName} → ${r.targetName || r.target}`);
  if (r.data) parts.push(Object.entries(r.data).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '));
  return parts.join(' · ');
}

// ---------- Auditoría ----------
let auditRows = [], auditFilter = {};
function readFilters() {
  const f = new FormData($('#filters'));
  const ts = v => v ? new Date(v).getTime() : undefined;
  return { type: f.get('type') || undefined, who: f.get('who') || undefined, ip: f.get('ip') || undefined, from: ts(f.get('from')), to: ts(f.get('to')) };
}
async function loadAudit(more) {
  if (!more) { auditFilter = readFilters(); auditRows = []; }
  const before = more && auditRows.length ? auditRows[auditRows.length - 1].id : undefined;
  const r = await ask('admin.audit', { ...auditFilter, before, limit: 200 });
  auditRows.push(...r.rows);
  const body = $('#audit tbody');
  if (!more) body.replaceChildren();
  body.append(...r.rows.map(x => h('tr', {},
    h('td', {}, fmtDate(x.at)), h('td', {}, typeTag(x.type)),
    h('td', {}, x.actor ? h('span', { class: x.actor === 'consola' ? '' : 'link', onclick: x.actor === 'consola' ? null : () => openPlayer(x.actor) }, x.actorName || x.actor) : '—'),
    h('td', {}, x.target ? h('span', { class: 'link', onclick: () => openPlayer(x.target) }, x.targetName || x.target) : '—'),
    h('td', {}, x.ip ? h('span', { class: 'link', onclick: () => auditBy({ ip: x.ip }) }, x.ip) : ''),
    h('td', { class: 'data' }, x.data ? Object.entries(x.data).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : ''))));
  if (!auditRows.length) body.append(h('tr', {}, h('td', { colspan: 6, class: 'small' }, 'Nada con esos filtros.')));
  $('#more').hidden = !r.more;
}
function auditBy(f) {
  const form = $('#filters');
  form.reset();
  for (const [k, v] of Object.entries(f)) form.elements[k].value = v;
  show('auditoria');
  loadAudit();
}
$('#filters').addEventListener('submit', e => { e.preventDefault(); loadAudit(); });
$('#clear').addEventListener('click', () => { $('#filters').reset(); loadAudit(); });
$('#more').addEventListener('click', () => loadAudit(true));
$('#csv').addEventListener('click', () => {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['fecha', 'tipo', 'actor', 'actor_nombre', 'objetivo', 'objetivo_nombre', 'ip', 'datos'].join(',')]
    .concat(auditRows.map(r => [new Date(r.at).toISOString(), r.type, r.actor, r.actorName, r.target, r.targetName, r.ip, r.data ? JSON.stringify(r.data) : ''].map(q).join(',')));
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })), download: `auditoria-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------- Servidor ----------
$('#announce').addEventListener('submit', async e => {
  e.preventDefault();
  const r = await ask('admin.broadcast', { msg: new FormData(e.target).get('msg') });
  if (r.err) return toast(r.err, true);
  toast(r.ok);
  e.target.reset();
});
for (const [id, on] of [['#maint-on', true], ['#maint-off', false]]) $(id).addEventListener('click', async () => {
  if (on && !confirm('¿Activar el mantenimiento? Nadie podrá empezar combates nuevos.')) return;
  const r = await ask('admin.maintenance', { on });
  toast(r.ok);
  overview(true);
});

connect();
