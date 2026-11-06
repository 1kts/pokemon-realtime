// Combates en varios núcleos. El servidor (index.js) lleva las conexiones, las cuentas y la base de datos en el hilo
// principal; cada combate se simula 30 veces por segundo, y con mucha gente un solo núcleo no da abasto. Aquí se
// reparten los combates entre hilos de combates (server/battle-worker.js), uno por núcleo menos el principal:
//   1 núcleo  -> sin hilos: los combates corren en el principal, como siempre
//   3 núcleos -> 2 hilos de combates + el principal
// BATTLE_WORKERS=n lo fija a mano (0: todo en el principal, como en los tests de las arenas).
//
// Para index.js da igual dónde corra: create() devuelve un Battle (server/battle.js) o un RemoteBattle con lo mismo que
// se usa desde fuera: sides[i] (con ws, missed), state, mode, input(), hold(), resume(), devFoe(), leave(), stop(), y el
// onEnd(result, b) de siempre, donde b trae lo que piden los premios y el equilibrio (summary()).
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const { Battle } = require('./battle.js');

const cores = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const WANT = process.env.BATTLE_WORKERS !== undefined ? Math.max(0, process.env.BATTLE_WORKERS | 0) : Math.max(0, cores - 1);

let workers = null;          // [{ w, n }] (n: combates que lleva)
const remote = new Map();    // id -> RemoteBattle
let nextId = 1;

function pool() {
  if (workers) return workers;
  workers = [];
  for (let i = 0; i < WANT; i++) spawn(i);
  return workers;
}

function spawn(i) {
  const w = new Worker(path.join(__dirname, 'battle-worker.js'), { env: process.env });
  const slot = { w, n: 0 };
  workers[i] = slot;
  w.on('message', m => {
    if (m.t === 'batch') {   // (las instantáneas de una vuelta del hilo, todas juntas: [id, lado, texto, id, lado, texto…])
      const o = m.out;
      for (let k = 0; k < o.length; k += 3) { const b = remote.get(o[k]); if (b) b.out(o[k + 1], o[k + 2]); }
      return;
    }
    const b = remote.get(m.id); if (b) b.onMessage(m);
  });
  w.on('error', e => console.error('Hilo de combates', i, e));
  // Si un hilo se cae, sus combates acaban (cada jugador vuelve al menú) y se arranca otro en su sitio
  w.on('exit', code => {
    for (const b of remote.values()) if (b.slot === slot && b.state !== 'over') b.lost();
    if (workers && workers[i] === slot && code !== 0) spawn(i);
  });
  w.unref();
}

// Lado visto desde el principal: su conexión (para mandarle lo que llega del hilo) y el resultado si se cortó
class RemoteSide {
  constructor(idx, ws) { this.idx = idx; this.ws = ws; this.missed = null; this.inputs = []; this.lastInput = {}; }
}

class RemoteBattle {
  constructor(opts, slot) {
    this.id = nextId++;
    this.slot = slot;
    this.mode = opts.mode;
    this.tutorial = !!opts.tutorial;
    this.state = 'countdown';
    this.onEnd = opts.onEnd || (() => []);
    this.sides = opts.sides.map((s, i) => new RemoteSide(i, s.ws || null));
    remote.set(this.id, this);
    slot.n++;
    // (al hilo, solo datos: sin conexiones ni funciones)
    const sides = opts.sides.map(({ ws, ...s }) => ({ ...s, hasWs: !!ws }));
    const { onEnd, ...rest } = opts;
    this.post({ t: 'new', opts: { ...rest, sides } });
  }
  post(m) { this.slot.w.postMessage({ id: this.id, ...m }); }
  out(side, str) { const ws = this.sides[side].ws; if (ws && ws.readyState === 1) ws.send(str); }
  onMessage(m) {
    if (m.t === 'out') this.out(m.side, m.str);
    else if (m.t === 'state') this.state = m.state;
    else if (m.t === 'end') {
      this.state = 'over';
      let rewards = [];
      try { rewards = this.onEnd(m.result, { ...m.summary, id: this.id }) || []; } catch (e) { console.error('Al acabar un combate:', e); }
      this.post({ t: 'rewards', rewards });
    } else if (m.t === 'missed') this.sides[m.side].missed = m.msg;
    else if (m.t === 'gone') this.forget();
  }
  forget() { if (remote.delete(this.id)) this.slot.n--; }
  // Lo de fuera, al hilo
  input(i, inp) { this.post({ t: 'in', side: i, inp }); }
  hold(i) { this.sides[i].ws = null; this.post({ t: 'hold', side: i }); }
  resume(i, ws) { this.sides[i].ws = ws; this.post({ t: 'resume', side: i }); }
  devFoe(i, o) { this.post({ t: 'dev', side: i, o }); }
  leave(side, disconnected = false) { if (disconnected) side.ws = null; this.post({ t: 'leave', side: side.idx, disconnected }); }
  stop() { this.state = 'over'; this.post({ t: 'stop' }); this.forget(); }
  // El hilo se ha caído: se cierra como un empate sin premios
  lost() {
    this.state = 'over';
    for (const s of this.sides) if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify({ t: 'over', winner: -1, you: s.idx, captured: null, reward: null, sum: null }));
    try { this.onEnd({ winner: -1, lost: true }, { mode: this.mode, tutorial: this.tutorial, stats: { moves: [{}, {}], mons: [{}, {}] }, sides: [] }); } catch {}
    this.forget();
  }
}

function create(opts) {
  const ws = pool();
  if (!ws.length) return new Battle(opts);
  const slot = ws.reduce((a, b) => (b.n < a.n ? b : a));   // (al hilo con menos combates)
  return new RemoteBattle(opts, slot);
}

module.exports = { create, workerCount: () => pool().length, cores };
