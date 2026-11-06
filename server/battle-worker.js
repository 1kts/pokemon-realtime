// Hilo de combates (lo arranca server/battle-pool.js): simula aquí los combates que le tocan, con el mismo Battle de
// server/battle.js, y le pasa al hilo principal lo que hay que mandar a cada jugador. Las conexiones, las cuentas y los
// premios siguen en el principal: al acabar, el combate le pide los premios y espera su respuesta.
const { parentPort } = require('worker_threads');
const { Battle } = require('./battle.js');

const battles = new Map();   // id -> { b, pending }

// La «conexión» de un lado dentro del hilo: lo que el combate le manda va al principal, que lo pasa a la de verdad. Todo
// lo de una vuelta del bucle (los ticks de todos los combates que tocaban) va junto en un solo mensaje: con cientos de
// combates, el principal recibe uno por vuelta y no uno por cada instantánea
let outbox = [];
const flush = () => { const b = outbox; outbox = []; parentPort.postMessage({ t: 'batch', out: b }); };
const pipe = (id, side) => ({ readyState: 1, send: str => { if (!outbox.length) setImmediate(flush); outbox.push(id, side, str); } });

parentPort.on('message', m => {
  const e = battles.get(m.id);
  if (m.t === 'new') {
    const opts = m.opts;
    const sides = opts.sides.map(({ hasWs, ...s }, i) => ({ ...s, ws: hasWs ? pipe(m.id, i) : null }));
    const entry = { b: null, pending: null };
    let last = 'countdown';
    const b = new Battle({
      ...opts, sides,
      onEnd: result => {
        if (outbox.length) flush();   // (lo de antes del final, primero)
        parentPort.postMessage({ id: m.id, t: 'end', result, summary: b.summary() });
        return new Promise(res => { entry.pending = res; });
      },
    });
    b.onMissed = (side, msg) => { if (outbox.length) flush(); parentPort.postMessage({ id: m.id, t: 'missed', side, msg }); };
    // (el estado, al principal cuando cambia: lo mira para saber si sigue en marcha)
    const tick = b.tick.bind(b);
    b.tick = () => { tick(); if (b.state !== last) { last = b.state; parentPort.postMessage({ id: m.id, t: 'state', state: b.state }); } };
    entry.b = b;
    battles.set(m.id, entry);
    return;
  }
  if (!e) return;
  const b = e.b;
  if (m.t === 'in') b.input(m.side, m.inp);
  else if (m.t === 'hold') b.hold(m.side);
  else if (m.t === 'resume') b.resume(m.side, pipe(m.id, m.side));
  else if (m.t === 'dev') b.devFoe(m.side, m.o || {});
  else if (m.t === 'leave') b.leave(b.sides[m.side], m.disconnected);
  else if (m.t === 'stop') { b.stop(); battles.delete(m.id); }
  else if (m.t === 'rewards') {
    if (e.pending) e.pending(m.rewards);
    battles.delete(m.id);
    // (después del resultado, que sale en cuanto se cumple la promesa: si no, el principal lo tiraría)
    setImmediate(() => { if (outbox.length) flush(); parentPort.postMessage({ id: m.id, t: 'gone' }); });
  }
});
