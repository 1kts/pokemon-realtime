// Medidor de la conexión y la fluidez en combate: solo con ?net=1 en la dirección (sin eso, no existe y no gasta nada).
// Un panel pequeño para el propio jugador; no se envía nada a ningún sitio.
const on = typeof location !== 'undefined' && new URLSearchParams(location.search).has('net');

function make() {
  const s = {
    snaps: 0, late: 0, maxGap: 0, frames: 0, longFrames: 0, maxFrame: 0, reconnects: 0, delay: 0, jitter: 0, rtt: 0,
    jumps: 0, stalls: 0, maxStep: 0, foe: null, stallT: 0, lastSnap: 0, t0: performance.now(),
    // Llega un snapshot: hueco desde el anterior (el servidor manda cada 33 ms)
    snap(now) {
      if (s.lastSnap) { const gap = now - s.lastSnap; s.maxGap = Math.max(s.maxGap, gap); if (gap > 100) s.late++; }
      s.lastSnap = now; s.snaps++;
    },
    frame(ms) { s.frames++; s.maxFrame = Math.max(s.maxFrame, ms); if (ms > 50) s.longFrames++; },
    // Cómo se ha movido el rival en pantalla este fotograma: un salto o un parón es lo que se nota como tirón
    foeAt(x, y, ms, maxSpeed) {
      if (s.foe) {
        const step = Math.hypot(x - s.foe.x, y - s.foe.y);
        s.maxStep = Math.max(s.maxStep, step);
        if (step > maxSpeed * ms / 1000 * 1.6 + 6) s.jumps++;
        if (step < 0.01) { s.stallT += ms; } else { if (s.stallT > 150) s.stalls++; s.stallT = 0; }
      }
      s.foe = { x, y };
    },
    reset() { Object.assign(s, { snaps: 0, late: 0, maxGap: 0, frames: 0, longFrames: 0, maxFrame: 0, jumps: 0, stalls: 0, maxStep: 0, stallT: 0, t0: performance.now() }); },
  };
  return s;
}

export const netStats = on ? make() : null;

// El panel, repintado dos veces por segundo mientras dura el combate
export function netPanel(net) {
  if (!netStats) return;
  const box = document.createElement('div');
  box.className = 'net-panel';
  document.body.append(box);
  setInterval(() => {
    const s = netStats, secs = Math.max(1, (performance.now() - s.t0) / 1000);
    s.rtt = net.rtt;
    box.textContent = `RTT ${Math.round(net.rtt)} · ${Math.round(s.snaps / secs)} snap/s · tarde ${s.late} · hueco ${Math.round(s.maxGap)} ms · búfer ${Math.round(s.delay)} ms · `
      + `${Math.round(s.frames / secs)} FPS · lentos ${s.longFrames} · saltos ${s.jumps} · parones ${s.stalls} · reconex. ${s.reconnects}`;
  }, 500);
}
