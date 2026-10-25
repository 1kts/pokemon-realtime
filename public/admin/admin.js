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
let ws, logged = false, rid = 0, myId = null;
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
  myId = m.id;
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
  if (tab === 'jugadores' && !$('#results').children.length) loadPlayers();
  if (tab === 'servidor') overview(true);
  if (tab === 'metricas') loadMetrics();
  if (tab === 'balance') loadBalance();
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
// ---------- Métricas ----------
// Jugadores por día, nuevos, combates y cuántos vuelven (de los que se crearon ese día, cuántos entraron
// al día siguiente y a los 7 días). Los datos salen de los últimos 35 días que guarda cada perfil.
const pct = ([n, back]) => n ? `${Math.round(back / n * 100)} % (${back}/${n})` : '—';
const bar = (v, max) => h('div', { class: 'mbar' }, h('i', { style: `width:${max ? Math.round(v / max * 100) : 0}%` }), h('span', {}, String(v)));
async function loadMetrics() {
  const m = await ask('admin.metrics');
  if (!m.days) return;
  const s = m.summary;
  const max = k => Math.max(1, ...m.days.map(d => d[k]));
  const sum = k => m.days.reduce((a, d) => a + d[k], 0);
  const cohort = k => m.days.reduce((a, d) => [a[0] + d[k][0], a[1] + d[k][1]], [0, 0]);
  $('#metricas').replaceChildren(
    h('div', { class: 'stats' },
      stat('jugadores hoy', s.dau), stat('últimos 7 días', s.wau), stat('últimos 30 días', s.mau),
      stat('perfiles · con cuenta', `${s.total} · ${s.accounts}`),
      stat('vuelven al día siguiente (14 días)', pct(cohort('d1'))), stat('vuelven a la semana (14 días)', pct(cohort('d7'))),
      stat('combates (14 días)', sum('battles')), stat('combates por jugador y día', (sum('battles') / Math.max(1, sum('active'))).toFixed(1))),
    h('div', { class: 'card scroll' }, h('h2', {}, 'Últimos 14 días'),
      table(['Día', 'Jugadores', 'Nuevos', 'Combates', 'Vuelven al día siguiente', 'Vuelven a los 7 días'], m.days.map(d => h('tr', {},
        h('td', {}, d.day), h('td', {}, bar(d.active, max('active'))), h('td', {}, bar(d.fresh, max('fresh'))), h('td', {}, bar(d.battles, max('battles'))),
        h('td', {}, pct(d.d1)), h('td', {}, pct(d.d7)))))),
    h('p', { class: 'small' }, 'Un jugador cuenta como activo el día que entra al juego. «Vuelven» se mide sobre los perfiles creados ese día; los días cuya vuelta aún no ha llegado salen con —.'),
  );
}

// ---------- Balance ----------
// Datos de equilibrio (server/balance.js): por Pokémon, movimiento y líder, en los días y el modo elegidos.
// Con pocos datos (menos de MIN) no se marca nada, para no nerfear por casualidad. Las cabeceras ordenan.
const MIN = { mon: 30, move: 50, leader: 10 };
const pc = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
const per = (a, b) => b ? Math.round(a / b * 10) / 10 : null;
const balSort = {};
function sortable(id, cols, rows, def) {
  const st = balSort[id] || (balSort[id] = { k: def, dir: -1 });
  const box = h('div', { class: 'card scroll bal-t' });
  const val = r => r[st.k] ?? -Infinity;
  const draw = () => {
    const sorted = [...rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * st.dir);
    const th = cols.map(([k, label]) => h('th', { class: 'sort' + (st.k === k ? ' on' : ''), onclick: () => { st.dir = st.k === k ? -st.dir : -1; st.k = k; draw(); } }, label + (st.k === k ? (st.dir < 0 ? ' ▼' : ' ▲') : '')));
    box.replaceChildren(rows.length ? h('table', {}, h('thead', {}, h('tr', {}, th)), h('tbody', {}, sorted.map(r => h('tr', { class: r.few ? 'few' : '' }, cols.map(([k, , fmt]) => h('td', {}, fmt ? fmt(r[k], r) : r[k] ?? '—'))))))
      : h('p', { class: 'small' }, 'Sin datos todavía en estos días.'));
  };
  draw();
  return box;
}
const pctTxt = v => v === null ? '—' : v + ' %';
const note = v => v ? h('span', { class: 'tag ' + v[0] }, v[1]) : '';
async function loadBalance() {
  const f = new FormData($('#bal-f'));
  const b = await ask('admin.balance', { days: +f.get('days'), mode: f.get('mode') });
  const mons = b.mons.map(m => {
    const wr = pc(m.wins, m.games), few = m.games < MIN.mon;
    return { ...m, wr, few, pick: pc(m.picked, b.all.drafts * 2), ban: pc(m.banned, b.all.drafts * 2), dmgG: per(m.dmg, m.games), takenG: per(m.taken, m.games), kosG: per(m.kos, m.games), faintP: pc(m.fainted, m.games),
      note: few ? ['', 'pocos datos'] : wr >= 58 ? ['fallo', 'fuerte'] : wr <= 42 ? ['on', 'flojo'] : null };
  });
  const usable = b.moves.filter(m => m.casts >= MIN.move).map(m => m.dmg / m.casts).sort((x, y) => x - y);
  const median = usable.length ? usable[Math.floor(usable.length / 2)] : 0;
  const moves = b.moves.map(m => {
    const hit = pc(m.landed, m.casts), dpu = per(m.dmg, m.casts), few = m.casts < MIN.move;
    return { ...m, hit, dpu, few, note: few ? ['', 'pocos datos'] : hit < 30 ? ['admin', 'cuesta acertar'] : median && dpu > median * 2 ? ['fallo', 'mucho daño'] : null };
  });
  const leaders = b.leaders.map(l => {
    const wr = pc(l.wins, l.tries), few = l.tries < MIN.leader;
    return { ...l, wr, few, note: few ? ['', 'pocos datos'] : wr < 35 ? ['fallo', 'muro'] : wr > 90 ? ['on', 'muy fácil'] : null };
  });
  $('#bal').replaceChildren(
    h('div', { class: 'stats' }, stat('combates', b.all.battles), stat('drafts online', b.all.drafts), stat('desde', b.from)),
    h('h2', {}, 'Pokémon'),
    h('p', { class: 'small' }, `De los jugadores (la IA no cuenta). «Fuerte» o «flojo» a partir de ${MIN.mon} partidas: 58 % de victorias o más, o 42 % o menos. Elegido y vetado, en el draft online.`),
    sortable('mon', [['name', 'Pokémon'], ['games', 'Partidas'], ['wr', '% victoria', pctTxt], ['pick', '% elegido', pctTxt], ['ban', '% vetado', pctTxt], ['dmgG', 'Daño/partida'], ['takenG', 'Recibido/partida'], ['kosG', 'KOs/partida'], ['faintP', '% debilitado', pctTxt], ['note', '', note]], mons, 'games'),
    h('h2', {}, 'Movimientos'),
    h('p', { class: 'small' }, `Usos, en cuántos da (al menos un golpe) y daño medio por uso. A partir de ${MIN.move} usos se marca si acierta menos del 30 % o hace más del doble de daño por uso que la mediana.`),
    sortable('move', [['name', 'Movimiento'], ['type', 'Tipo'], ['casts', 'Usos'], ['hit', '% acierto', pctTxt], ['dpu', 'Daño/uso'], ['kos', 'KOs'], ['note', '', note]], moves, 'casts'),
    h('h2', {}, 'Líderes de la historia'),
    h('p', { class: 'small' }, `Intentos y victorias contra cada líder. A partir de ${MIN.leader} intentos: «muro» si se gana menos del 35 %, «muy fácil» si más del 90 %.`),
    sortable('leader', [['name', 'Líder'], ['region', 'Región'], ['index', 'Orden'], ['tries', 'Intentos'], ['wr', '% victoria', pctTxt], ['note', '', note]], leaders, 'index'),
  );
}
$('#bal-f').addEventListener('change', loadBalance);

const table = (heads, rows) => h('table', {}, h('thead', {}, h('tr', {}, heads.map(x => h('th', {}, x)))), h('tbody', {}, rows));
function typeTag(type) {
  const g = type.split('.')[0];
  const cls = g === 'admin' ? 'admin' : g === 'limite' ? 'limite' : /fallo|bloqueada|suspendida/.test(type) ? 'fallo' : '';
  return h('span', { class: 'tag ' + cls }, type);
}

// ---------- Jugadores ----------
// Sin texto sale la lista entera (cuentas primero, por última conexión); el desplegable filtra
// cuentas o invitados
async function loadPlayers() {
  const f = new FormData($('#search'));
  const r = await ask('admin.search', { q: f.get('q'), kind: f.get('kind') });
  const t = r.total;
  $('#results').replaceChildren(
    h('p', { class: 'small' }, `${r.rows.length} en la lista · ${t.profiles} perfiles en total: ${t.accounts} cuentas y ${t.profiles - t.accounts} invitados`),
    r.rows.length ? table(['Nombre', 'Usuario', 'ELO', 'Alta', 'Última vez', ''], r.rows.map(p => h('tr', { class: 'click', onclick: () => openPlayer(p.id) },
      h('td', {}, p.name), h('td', {}, p.user || 'invitado'), h('td', {}, p.ranked ? p.elo : '—'), h('td', {}, fmtDate(p.created)), h('td', {}, p.seen ? fmtDate(p.seen) : '—'),
      h('td', {}, p.online && h('span', { class: 'tag on' }, 'en línea'), p.banned && h('span', { class: 'tag ban' }, 'suspendido')))))
      : h('p', { class: 'small' }, 'Nadie con ese nombre, usuario o id.'));
}
$('#search').addEventListener('submit', e => { e.preventDefault(); loadPlayers(); });
$('#search [name=kind]').addEventListener('change', loadPlayers);

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
        ['Motes', (p.mons || []).filter(m => m.nick).map(m => `${m.nick} (nº ${m.dex})`).join(' · ')],
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
      (p.mons || []).some(m => m.nick) && h('button', { onclick: () => confirm(`¿Quitar todos los motes de los Pokémon de ${p.name}?`) && act('nicks')() }, 'Quitar motes'),
      p.id === myId && h('button', { onclick: () => confirm('¿Desbloquear todo en tu cuenta? (Pokédex completa, legendarios shiny perfectos, medallas, dinero, objetos y cosméticos). Tu cuenta dejará de salir en los rankings.') && act('unlockall')() }, 'Desbloquear todo (mi cuenta)'),
      h('button', { class: 'danger', onclick: () => {
        const name = prompt(`Borrar a ${p.name} del todo (perfil, partida, cuenta y su registro). No se puede deshacer.\n\nEscribe su nombre de entrenador para confirmar:`);
        if (name !== null) act('remove', { confirm: name })();
      } }, 'Borrar perfil'),
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
