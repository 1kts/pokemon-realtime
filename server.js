// Servidor autoritativo: simula el combate a 30 Hz y envía instantáneas a los clientes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let nextId = 1;
let waiting = null; // jugador esperando rival online

function send(p, msg) {
  if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

function makePlayer(name, creature, ws) {
  const key = S.CREATURES[creature] ? creature : 'brasilio';
  return { id: nextId++, name: String(name || 'Entrenador').slice(0, 16), creature: key, ws,
    inputs: [], lastInput: { mx: 0, my: 0, a: 0 }, ack: 0, rematch: false, match: null };
}

class Match {
  constructor(a, b) {
    this.players = [a, b];
    a.match = b.match = this;
    this.start();
    this.timer = setInterval(() => this.tick(), 1000 / S.TICK);
  }

  start() {
    this.t = 0;
    this.state = 'countdown';
    this.countdown = 3;
    this.projectiles = [];
    this.pendingAreas = [];
    this.events = [];
    this.winner = null;
    this.players.forEach((p, i) => {
      const c = S.CREATURES[p.creature];
      Object.assign(p, { x: i === 0 ? 150 : S.ARENA.w - 150, y: S.ARENA.h / 2, hp: c.hp, maxHp: c.hp,
        cds: [0, 0, 0, 0], shield: 0, slow: 0, dash: null, a: i === 0 ? 0 : Math.PI, rematch: false });
      p.inputs.length = 0;
    });
    const info = this.players.map(p => ({ id: p.id, name: p.name, creature: p.creature }));
    this.players.forEach(p => send(p, { t: 'start', you: p.id, players: info }));
  }

  foe(p) { return this.players[0] === p ? this.players[1] : this.players[0]; }

  tick() {
    const dt = S.DT;
    this.t += dt;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.state = 'fight';
    }

    for (const p of this.players) {
      if (p.bot) p.inputs.push(botInput(this, p));
      // Consumir una entrada por tick; si hay atraso, dos para recuperar.
      let steps = p.inputs.length > 3 ? 2 : 1;
      while (steps-- > 0) {
        const inp = p.inputs.shift();
        if (inp) { p.lastInput = inp; p.ack = inp.s || p.ack; }
        this.applyInput(p, inp || { ...p.lastInput, c: -1 }, dt);
      }
      if (p.inputs.length > 10) p.inputs.splice(0, p.inputs.length - 10);
      for (let i = 0; i < 4; i++) p.cds[i] = Math.max(0, p.cds[i] - dt);
      p.shield = Math.max(0, p.shield - dt);
      p.slow = Math.max(0, p.slow - dt);
    }

    this.updateProjectiles(dt);
    this.updateAreas(dt);
    this.checkEnd();
    this.broadcast();
  }

  applyInput(p, inp, dt) {
    if (typeof inp.a === 'number') p.a = inp.a;
    if (this.state !== 'fight') return;
    const c = S.CREATURES[p.creature];
    if (p.dash) {
      const d = p.dash;
      S.stepMove(p, d.vx, d.vy, d.speed, dt);
      const f = this.foe(p);
      if (!d.hit && Math.hypot(f.x - p.x, f.y - p.y) < S.RADIUS * 2.2) {
        d.hit = true;
        this.damage(p, f, d.dmg, p.x, p.y);
      }
      d.t -= dt;
      if (d.t <= 0) p.dash = null;
    } else {
      const speed = c.speed * (p.slow > 0 ? 0.45 : 1);
      S.stepMove(p, Number(inp.mx) || 0, Number(inp.my) || 0, speed, dt);
    }
    const ci = inp.c;
    if (ci >= 0 && ci < 4 && p.cds[ci] <= 0 && !p.dash) this.cast(p, ci);
  }

  cast(p, i) {
    const c = S.CREATURES[p.creature];
    const m = c.moves[i];
    p.cds[i] = m.cd;
    const ax = Math.cos(p.a), ay = Math.sin(p.a);
    this.events.push({ k: 'cast', id: p.id, m: i });
    if (m.kind === 'proj') {
      const n = m.count || 1;
      for (let j = 0; j < n; j++) {
        const ang = p.a + (j - (n - 1) / 2) * (m.spread || 0);
        this.projectiles.push({ id: nextId++, owner: p, type: c.type, x: p.x + ax * S.RADIUS, y: p.y + ay * S.RADIUS,
          vx: Math.cos(ang) * m.speed, vy: Math.sin(ang) * m.speed, left: m.range, r: m.radius, dmg: m.dmg, slow: m.slow || 0, mi: i });
      }
    } else if (m.kind === 'dash') {
      p.dash = { vx: ax, vy: ay, speed: m.dist / m.dur, t: m.dur, dmg: m.dmg, hit: false };
    } else if (m.kind === 'shield') {
      p.shield = m.dur;
    } else if (m.kind === 'heal') {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + m.amount);
      this.events.push({ k: 'heal', x: p.x, y: p.y, n: Math.round(p.hp - before) });
    } else if (m.kind === 'area') {
      this.pendingAreas.push({ owner: p, x: p.x, y: p.y, r: m.radius, dmg: m.dmg, t: m.delay, type: c.type });
      this.events.push({ k: 'warn', x: p.x, y: p.y, r: m.radius, d: m.delay, type: c.type });
    }
  }

  damage(src, dst, base, x, y) {
    const mult = S.TYPES[S.CREATURES[src.creature].type][S.CREATURES[dst.creature].type];
    const shielded = dst.shield > 0;
    const dmg = Math.max(1, Math.round(base * mult * (shielded ? 0.2 : 1)));
    dst.hp = Math.max(0, dst.hp - dmg);
    this.events.push({ k: 'hit', x, y, n: dmg, e: mult > 1 ? 1 : mult < 1 ? -1 : 0, sh: shielded ? 1 : 0 });
  }

  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.left -= Math.hypot(pr.vx, pr.vy) * dt;
      const f = this.foe(pr.owner);
      if (this.state === 'fight' && Math.hypot(f.x - pr.x, f.y - pr.y) < S.RADIUS + pr.r) {
        this.damage(pr.owner, f, pr.dmg, pr.x, pr.y);
        if (pr.slow) f.slow = Math.max(f.slow, pr.slow);
        pr.left = 0;
      }
      if (pr.x < -50 || pr.y < -50 || pr.x > S.ARENA.w + 50 || pr.y > S.ARENA.h + 50) pr.left = 0;
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0);
  }

  updateAreas(dt) {
    for (const a of this.pendingAreas) {
      a.t -= dt;
      if (a.t <= 0) {
        const f = this.foe(a.owner);
        this.events.push({ k: 'boom', x: a.x, y: a.y, r: a.r, type: a.type });
        if (this.state === 'fight' && Math.hypot(f.x - a.x, f.y - a.y) < a.r + S.RADIUS) this.damage(a.owner, f, a.dmg, f.x, f.y);
      }
    }
    this.pendingAreas = this.pendingAreas.filter(a => a.t > 0);
  }

  checkEnd() {
    if (this.state !== 'fight') return;
    const dead = this.players.filter(p => p.hp <= 0);
    if (!dead.length) return;
    this.state = 'over';
    this.winner = dead.length === 2 ? 0 : this.foe(dead[0]).id;
    this.players.forEach(p => send(p, { t: 'over', winner: this.winner }));
  }

  broadcast() {
    const msg = {
      t: 'snap', st: Math.round(this.t * 1000), state: this.state, cd: Math.ceil(this.countdown),
      ps: this.players.map(p => ({ id: p.id, x: +p.x.toFixed(1), y: +p.y.toFixed(1), hp: p.hp, a: +p.a.toFixed(2),
        sh: p.shield > 0 ? 1 : 0, sl: p.slow > 0 ? 1 : 0, da: p.dash ? 1 : 0, cds: p.cds.map(c => +c.toFixed(2)), ack: p.ack })),
      pr: this.projectiles.map(p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), r: p.r, ty: p.type })),
      ev: this.events,
    };
    this.events = [];
    const json = JSON.stringify(msg);
    this.players.forEach(p => { if (p.ws && p.ws.readyState === 1) p.ws.send(json); });
  }

  requestRematch(p) {
    if (this.state !== 'over') return;
    p.rematch = true;
    const f = this.foe(p);
    if (f.bot) f.rematch = true;
    if (this.players.every(x => x.rematch)) this.start();
    else send(f, { t: 'rematch_req' });
  }

  end(leaver) {
    clearInterval(this.timer);
    const f = this.foe(leaver);
    f.match = null;
    send(f, { t: 'opp_left' });
  }
}

// IA sencilla: mantiene distancia, rodea al rival, apunta y lanza ataques al azar.
function botInput(match, b) {
  const f = match.foe(b);
  const dx = f.x - b.x, dy = f.y - b.y;
  const dist = Math.hypot(dx, dy) || 1;
  const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.25;
  if (!b.ai) b.ai = { strafe: 1, flip: 0 };
  b.ai.flip -= S.DT;
  if (b.ai.flip <= 0) { b.ai.strafe *= -1; b.ai.flip = 0.8 + Math.random() * 1.5; }
  const want = 260;
  const radial = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
  let mx = (dx / dist) * radial + (-dy / dist) * b.ai.strafe * 0.8;
  let my = (dy / dist) * radial + (dx / dist) * b.ai.strafe * 0.8;
  // Esquivar proyectiles cercanos
  for (const pr of match.projectiles) {
    if (pr.owner === b) continue;
    if (Math.hypot(pr.x - b.x, pr.y - b.y) < 120) { mx += -pr.vy / 400; my += pr.vx / 400; }
  }
  let c = -1;
  if (match.state === 'fight' && Math.random() < 0.12) {
    const moves = S.CREATURES[b.creature].moves;
    const ready = [0, 1, 2, 3].filter(i => b.cds[i] <= 0 && (
      moves[i].kind === 'proj' ? dist < moves[i].range :
      moves[i].kind === 'dash' ? dist < 300 :
      moves[i].kind === 'area' ? dist < moves[i].radius :
      moves[i].kind === 'heal' ? b.hp < b.maxHp * 0.6 :
      moves[i].kind === 'shield' ? match.projectiles.some(p => p.owner !== b && Math.hypot(p.x - b.x, p.y - b.y) < 150) : false));
    if (ready.length) c = ready[Math.floor(Math.random() * ready.length)];
  }
  return { mx, my, a, c };
}

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  let me = null;
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !me) {
      me = makePlayer(msg.name, msg.creature, ws);
      if (msg.mode === 'bot') {
        const keys = Object.keys(S.CREATURES);
        const bot = makePlayer('Bot', keys[Math.floor(Math.random() * keys.length)], null);
        bot.bot = true;
        new Match(me, bot);
      } else if (waiting && waiting.ws.readyState === 1) {
        const other = waiting; waiting = null;
        new Match(other, me);
      } else {
        waiting = me;
        send(me, { t: 'wait' });
      }
    } else if (msg.t === 'in' && me && me.match) {
      me.inputs.push({ s: msg.s | 0, mx: S.clamp(+msg.mx || 0, -1, 1), my: S.clamp(+msg.my || 0, -1, 1), a: +msg.a || 0, c: Number.isInteger(msg.c) ? msg.c : -1 });
    } else if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', ts: msg.ts }));
    } else if (msg.t === 'rematch' && me && me.match) {
      me.match.requestRematch(me);
    }
  });
  ws.on('close', () => {
    if (!me) return;
    if (waiting === me) waiting = null;
    if (me.match) me.match.end(me);
  });
});

server.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
