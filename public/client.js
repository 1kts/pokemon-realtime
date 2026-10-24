// Cliente: predicción del propio movimiento, interpolación del rival y render en canvas.
const { TICK, DT, ARENA, RADIUS, CREATURES } = Shared;
const INTERP_MS = 100;
const TYPE_COLORS = { fuego: '#ff8a3d', agua: '#4fb3ff', planta: '#6fdc5a' };

const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let chosen = 'brasilio';
let ws = null, game = null;

// ---------- Dibujo de criaturas (originales, hechas con formas) ----------
function drawCreature(c, key, x, y, a, s = 1, flags = {}) {
  const cr = CREATURES[key];
  const r = RADIUS * s;
  c.save();
  c.translate(x, y);
  if (flags.shield) {
    c.beginPath(); c.arc(0, 0, r + 9 * s, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.stroke();
  }
  // Rasgo característico
  if (key === 'brasilio') {
    c.fillStyle = '#ffd23d';
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.7); c.quadraticCurveTo(-r * 0.1, -r * 1.9, r * 0.1, -r * 0.9);
    c.quadraticCurveTo(r * 0.4, -r * 1.6, r * 0.55, -r * 0.6); c.fill();
  } else if (key === 'marejo') {
    c.fillStyle = '#1f6fb8';
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.8); c.lineTo(r * 0.1, -r * 1.6); c.lineTo(r * 0.5, -r * 0.7); c.fill();
  } else {
    c.fillStyle = '#2f9c3a';
    c.beginPath(); c.ellipse(r * 0.2, -r * 1.15, r * 0.25, r * 0.6, 0.6, 0, Math.PI * 2); c.fill();
  }
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = flags.slow ? '#8a7a5a' : cr.color; c.fill();
  c.beginPath(); c.ellipse(0, r * 0.35, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
  // Ojos que miran hacia donde apunta
  const ex = Math.cos(a) * r * 0.25, ey = Math.sin(a) * r * 0.25;
  for (const side of [-1, 1]) {
    const ox = side * r * 0.35 + ex, oy = -r * 0.15 + ey;
    c.beginPath(); c.arc(ox, oy, r * 0.22, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(ox + Math.cos(a) * r * 0.08, oy + Math.sin(a) * r * 0.08, r * 0.1, 0, Math.PI * 2);
    c.fillStyle = '#111'; c.fill();
  }
  c.restore();
}

// ---------- Menú ----------
function buildPicker() {
  const picker = $('picker');
  for (const [key, cr] of Object.entries(CREATURES)) {
    const card = document.createElement('div');
    card.className = 'card' + (key === chosen ? ' sel' : '');
    const pc = document.createElement('canvas');
    pc.width = 90; pc.height = 80;
    drawCreature(pc.getContext('2d'), key, 45, 48, Math.PI / 2, 1.2);
    card.append(pc);
    card.insertAdjacentHTML('beforeend', `<b>${cr.name} <small style="display:inline;color:${TYPE_COLORS[cr.type]}">${cr.type}</small></b>
      <small>PS ${cr.hp} · Vel ${cr.speed}</small><small>${cr.moves.map(m => m.name).join(' · ')}</small>`);
    card.onclick = () => { chosen = key; document.querySelectorAll('.card').forEach(x => x.classList.remove('sel')); card.classList.add('sel'); };
    picker.append(card);
  }
  $('name').value = localStorageGet('name') || '';
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

$('online').onclick = () => connect('pvp');
$('vsbot').onclick = () => connect('bot');

function connect(mode) {
  const name = $('name').value.trim() || 'Entrenador';
  localStorageSet('name', name);
  $('menu').hidden = true; $('game').hidden = false;
  showOverlay('Conectando…');
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'join', mode, name, creature: chosen }));
    pingTimer = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'ping', ts: performance.now() })), 1000);
  };
  ws.onmessage = e => onMessage(JSON.parse(e.data));
  ws.onclose = () => { clearInterval(pingTimer); showOverlay('Desconectado', true); };
}
let pingTimer = null, rtt = 0;

function showOverlay(text, withMenu = false, withRematch = false) {
  const o = $('overlay');
  o.hidden = false;
  o.innerHTML = `<div>${text}</div>`;
  if (withRematch) {
    const b = document.createElement('button'); b.textContent = 'Revancha';
    b.onclick = () => { ws.send(JSON.stringify({ t: 'rematch' })); b.disabled = true; b.textContent = 'Esperando…'; };
    o.append(b);
  }
  if (withMenu || withRematch) {
    const b = document.createElement('button'); b.textContent = 'Menú'; b.className = 'alt';
    b.onclick = () => location.reload();
    o.append(b);
  }
}
function hideOverlay() { $('overlay').hidden = true; }

// ---------- Red ----------
function onMessage(m) {
  if (m.t === 'wait') showOverlay('Buscando rival…<br><small style="font-size:14px">Abre otra pestaña y pulsa “Combate online”</small>', true);
  else if (m.t === 'start') startGame(m);
  else if (m.t === 'snap') onSnap(m);
  else if (m.t === 'over') {
    const txt = m.winner === game.you ? '¡Victoria!' : m.winner === 0 ? 'Empate' : 'Derrota';
    showOverlay(txt, false, true);
  } else if (m.t === 'rematch_req') $('overlay').firstChild.innerHTML += '<br><small style="font-size:14px">Tu rival quiere la revancha</small>';
  else if (m.t === 'opp_left') showOverlay('Tu rival se ha ido', true);
  else if (m.t === 'pong') rtt = rtt ? rtt * 0.8 + (performance.now() - m.ts) * 0.2 : performance.now() - m.ts;
}

function startGame(m) {
  game = {
    you: m.you, info: Object.fromEntries(m.players.map(p => [p.id, p])),
    snaps: [], seq: 0, pending: [], pred: null, prevPred: null, err: { x: 0, y: 0 },
    acc: 0, last: performance.now(), offset: null, effects: [], latest: null, castQueue: -1,
  };
  hideOverlay();
  buildHud();
}

function onSnap(m) {
  if (!game) return;
  const now = performance.now();
  const off = m.st - now;
  game.offset = game.offset === null ? off : Math.max(off, game.offset - 0.5);
  game.snaps.push(m);
  if (game.snaps.length > 30) game.snaps.shift();
  game.latest = m;
  for (const ev of m.ev) spawnEffect(ev);
  if (m.state === 'countdown') showCountdown(m.cd); else if (m.state === 'fight' && $('overlay').dataset.cd) { hideOverlay(); delete $('overlay').dataset.cd; }

  // Reconciliación: partir del estado del servidor y repetir las entradas aún no confirmadas.
  const me = m.ps.find(p => p.id === game.you);
  game.pending = game.pending.filter(i => i.s > me.ack);
  const old = game.pred;
  const p = { x: me.x, y: me.y };
  if (!me.da && m.state === 'fight') {
    const speed = CREATURES[game.info[game.you].creature].speed * (me.sl ? 0.45 : 1);
    for (const i of game.pending) Shared.stepMove(p, i.mx, i.my, speed, DT);
  }
  if (old && !me.da) { game.err.x += old.x - p.x; game.err.y += old.y - p.y; }
  game.pred = p;
  if (!game.prevPred || me.da) game.prevPred = { ...p };
  game.meState = me;
}

function showCountdown(n) {
  const o = $('overlay');
  o.dataset.cd = 1; o.hidden = false;
  o.innerHTML = `<div style="font-size:72px">${n > 0 ? n : '¡Ya!'}</div>`;
}

// ---------- Entrada ----------
const keys = {};
let mouse = { x: ARENA.w / 2, y: ARENA.h / 2 };
const KEYMAP = { Digit1: 0, Digit2: 1, Digit3: 2, KeyQ: 2, Digit4: 3, KeyE: 3 };
addEventListener('keydown', e => { keys[e.code] = true; if (game && e.code in KEYMAP) game.castQueue = KEYMAP[e.code]; });
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  mouse = { x: (e.clientX - r.left) * ARENA.w / r.width, y: (e.clientY - r.top) * ARENA.h / r.height };
});
cv.addEventListener('mousedown', e => { if (game) game.castQueue = e.button === 2 ? 1 : 0; });
cv.addEventListener('contextmenu', e => e.preventDefault());

function sampleInput() {
  const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  const from = game.pred || { x: 0, y: 0 };
  const a = +Math.atan2(mouse.y - from.y, mouse.x - from.x).toFixed(3);
  const c = game.castQueue; game.castQueue = -1;
  return { s: ++game.seq, mx, my, a, c };
}

// ---------- Efectos visuales ----------
function spawnEffect(ev) {
  const now = performance.now();
  if (ev.k === 'hit') {
    const label = ev.e > 0 ? '¡Muy eficaz!' : ev.e < 0 ? 'Poco eficaz' : '';
    game.effects.push({ k: 'txt', x: ev.x, y: ev.y, t0: now, life: 900, text: '-' + ev.n, sub: ev.sh ? 'Bloqueado' : label, color: ev.e > 0 ? '#ffdd33' : '#fff' });
  } else if (ev.k === 'heal') {
    game.effects.push({ k: 'txt', x: ev.x, y: ev.y - 20, t0: now, life: 900, text: '+' + ev.n, color: '#7dff9a' });
  } else if (ev.k === 'warn') {
    game.effects.push({ k: 'warn', x: ev.x, y: ev.y, r: ev.r, t0: now, life: ev.d * 1000, color: TYPE_COLORS[ev.type] });
  } else if (ev.k === 'boom') {
    game.effects.push({ k: 'boom', x: ev.x, y: ev.y, r: ev.r, t0: now, life: 350, color: TYPE_COLORS[ev.type] });
  }
}

// ---------- HUD ----------
function buildHud() {
  const cr = CREATURES[game.info[game.you].creature];
  const labels = ['Clic', 'Dcho', 'Q', 'E'];
  $('hud').innerHTML = cr.moves.map((m, i) => `<div class="mv" id="mv${i}"><span class="k">${labels[i]}</span>${m.name}<div class="cdbar"></div></div>`).join('');
}
function updateHud() {
  if (!game.meState) return;
  const cr = CREATURES[game.info[game.you].creature];
  game.meState.cds.forEach((cd, i) => {
    const el = $('mv' + i);
    el.classList.toggle('cool', cd > 0);
    el.querySelector('.cdbar').style.width = (100 * (1 - cd / cr.moves[i].cd)) + '%';
  });
  $('net').textContent = `ping ${Math.round(rtt)} ms`;
}

// ---------- Interpolación ----------
function interpolated(renderT) {
  const s = game.snaps;
  if (!s.length) return null;
  let i = s.length - 1;
  while (i > 0 && s[i - 1].st > renderT) i--;
  const b = s[i], a = s[Math.max(0, i - 1)];
  if (a === b || renderT >= b.st) return { a: b, b, f: 1 };
  const f = Math.max(0, Math.min(1, (renderT - a.st) / (b.st - a.st)));
  return { a, b, f };
}
const lerp = (a, b, f) => a + (b - a) * f;
function lerpAngle(a, b, f) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }

// ---------- Bucle principal ----------
function frame(now) {
  requestAnimationFrame(frame);
  if (!game) return;
  game.acc += Math.min(250, now - game.last);
  game.last = now;
  while (game.acc >= 1000 / TICK) {
    game.acc -= 1000 / TICK;
    if (!game.pred || !game.meState) continue;
    const inp = sampleInput();
    ws.readyState === 1 && ws.send(JSON.stringify({ t: 'in', ...inp }));
    const fighting = game.latest && game.latest.state === 'fight';
    if (fighting) game.pending.push(inp);
    game.prevPred = { ...game.pred };
    if (fighting && !game.meState.da) {
      const speed = CREATURES[game.info[game.you].creature].speed * (game.meState.sl ? 0.45 : 1);
      Shared.stepMove(game.pred, inp.mx, inp.my, speed, DT);
    }
  }
  game.err.x *= 0.85; game.err.y *= 0.85;
  render(now);
  updateHud();
}

function render(now) {
  ctx.clearRect(0, 0, ARENA.w, ARENA.h);
  // Suelo
  ctx.fillStyle = '#2b4a3a'; ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(ARENA.w / 2, ARENA.h / 2, 90, 0, Math.PI * 2); ctx.moveTo(ARENA.w / 2, 0); ctx.lineTo(ARENA.w / 2, ARENA.h); ctx.stroke();

  const ip = interpolated(now + game.offset - INTERP_MS);
  if (!ip) return;
  const alpha = game.acc / (1000 / TICK);

  // Efectos de área (avisos)
  for (const e of game.effects) {
    const t = (now - e.t0) / e.life;
    if (e.k === 'warn') {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = e.color + '33'; ctx.fill();
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * Math.min(1, t), 0, Math.PI * 2);
      ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.stroke();
    } else if (e.k === 'boom') {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.8 + t * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = e.color + Math.round((1 - t) * 160).toString(16).padStart(2, '0'); ctx.fill();
    }
  }

  // Proyectiles interpolados
  const prevPr = Object.fromEntries(ip.a.pr.map(p => [p.id, p]));
  for (const p of ip.b.pr) {
    const q = prevPr[p.id] || p;
    const x = lerp(q.x, p.x, ip.f), y = lerp(q.y, p.y, ip.f);
    ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = TYPE_COLORS[p.ty]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // Jugadores: el rival interpolado, el propio predicho
  for (const pb of ip.b.ps) {
    const info = game.info[pb.id];
    const pa = ip.a.ps.find(p => p.id === pb.id) || pb;
    let x, y, a, st;
    if (pb.id === game.you && game.pred) {
      st = game.meState;
      x = lerp(game.prevPred.x, game.pred.x, alpha) + game.err.x;
      y = lerp(game.prevPred.y, game.pred.y, alpha) + game.err.y;
      a = Math.atan2(mouse.y - y, mouse.x - x);
    } else {
      st = pb;
      x = lerp(pa.x, pb.x, ip.f); y = lerp(pa.y, pb.y, ip.f); a = lerpAngle(pa.a, pb.a, ip.f);
    }
    drawCreature(ctx, info.creature, x, y, a, 1, { shield: st.sh, slow: st.sl });
    // Barra de vida y nombre
    const cr = CREATURES[info.creature];
    const w = 60, frac = st.hp / cr.hp;
    ctx.fillStyle = '#000a'; ctx.fillRect(x - w / 2, y - 48, w, 7);
    ctx.fillStyle = frac > 0.5 ? '#5f5' : frac > 0.2 ? '#fc3' : '#f44';
    ctx.fillRect(x - w / 2, y - 48, w * frac, 7);
    ctx.fillStyle = pb.id === game.you ? '#ffcc33' : '#fff';
    ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`${info.name} · ${Math.ceil(st.hp)}`, x, y - 54);
  }

  // Textos flotantes
  game.effects = game.effects.filter(e => now - e.t0 < e.life);
  for (const e of game.effects) {
    if (e.k !== 'txt') continue;
    const t = (now - e.t0) / e.life;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = e.color; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(e.text, e.x, e.y - 30 - t * 30);
    if (e.sub) { ctx.font = '12px system-ui'; ctx.fillText(e.sub, e.x, e.y - 14 - t * 30); }
    ctx.globalAlpha = 1;
  }
}

buildPicker();
requestAnimationFrame(frame);
