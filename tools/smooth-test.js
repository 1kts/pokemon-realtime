// Fluidez con mala red: una trayectoria del rival, snapshots cada 33 ms que llegan con 150 ms ±100 y ráfagas de 500 ms
// cada 5 s, y se pinta a 60 FPS. Compara con lo de antes (margen fijo de 100 ms, sin seguir la trayectoria, sin suavizar).
const assert = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const { SnapClock, posAt, Follow, pacer, MAX_DELAY } = await import('../public/js/smooth.js');
  const SPEED = 200;
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const snaps = [];
  for (let st = 0, x = 400, y = 300, a = 0; st < 60000; st += 33.3) {
    if (Math.floor(st / 800) !== Math.floor((st - 33.3) / 800)) a = rnd() * Math.PI * 2;
    x += Math.cos(a) * SPEED * 0.0333; y += Math.sin(a) * SPEED * 0.0333;
    const late = (st % 5000 < 500 ? 5000 - (5000 - (500 - st % 5000)) : 0) + 150 + (rnd() * 2 - 1) * 100;
    snaps.push({ st, ps: [{ x, y }], at: st + late });
  }
  let last = 0; for (const s of snaps) last = s.at = Math.max(last, s.at);
  const run = model => {
    const clock = new SnapClock(), follow = new Follow(), seen = [];
    let n = 0, prev = null, stall = 0, jumps = 0, stalls = 0, maxStep = 0, oldOff = null;
    for (let now = 1000; now < 59000; now += 1000 / 60) {
      while (n < snaps.length && snaps[n].at <= now) {
        const s = snaps[n++]; seen.push(s); clock.arrive(s.st, s.at);
        oldOff = oldOff === null ? s.st - s.at : Math.max(s.st - s.at, oldOff - 0.5);
      }
      if (seen.length > 40) seen.shift();
      if (!seen.length) continue;
      clock.tick(1000 / 60);
      let p;
      if (model === 'antes') {
        const t = now + oldOff - 100; let k = seen.length - 1;
        while (k > 0 && seen[k - 1].st > t) k--;
        const b = seen[k], a = seen[Math.max(0, k - 1)];
        if (a === b || t >= b.st) p = b.ps[0];
        else { const f = Math.max(0, (t - a.st) / (b.st - a.st)); p = { x: a.ps[0].x + (b.ps[0].x - a.ps[0].x) * f, y: a.ps[0].y + (b.ps[0].y - a.ps[0].y) * f }; }
      } else p = follow.to(posAt(seen, 0, clock.renderTime(now)), 1000 / 60, SPEED);
      if (prev) {
        const d = Math.hypot(p.x - prev.x, p.y - prev.y);
        maxStep = Math.max(maxStep, d);
        if (d > SPEED / 60 * 1.6 + 6) jumps++;
        if (d < 0.01) stall += 1000 / 60; else { if (stall > 150) stalls++; stall = 0; }
      }
      prev = p;
    }
    return { jumps, stalls, maxStep: +maxStep.toFixed(1), delay: Math.round(clock.delay) };
  };
  const a = run('antes'), d = run('ahora');
  console.log('  antes', JSON.stringify(a)); console.log('  ahora', JSON.stringify(d));
  assert(d.jumps <= a.jumps / 3, `con mala red, el rival da al menos 3 veces menos saltos (${a.jumps} → ${d.jumps})`);
  assert(d.stalls < a.stalls, `y se para menos veces (${a.stalls} → ${d.stalls})`);
  assert(d.maxStep < a.maxStep / 2, `y el mayor salto es menos de la mitad (${a.maxStep} → ${d.maxStep} px)`);
  assert(d.delay <= MAX_DELAY, `el margen no pasa de ${MAX_DELAY} ms (${d.delay})`);
  const frames = (hz, fps, ms) => { const go = pacer(); let n = 0; for (let t = 1000; t < 1000 + ms; t += 1000 / hz) if (go(t, fps)) n++; return n / ms * 1000; };
  for (const [hz, fps, lo, hi] of [[60, 60, 59.5, 60.5], [60.2, 60, 59.9, 60.6], [59.9, 60, 59.5, 60.3], [120, 60, 59.5, 60.5], [160, 60, 58.5, 61.5], [144, 60, 58.5, 61.5], [75, 60, 58.5, 61.5], [165, 60, 58.5, 61.5], [60, 30, 29, 31], [144, 30, 29, 31], [165, 30, 29, 31], [75, 30, 29, 31], [160, 30, 29, 31]]) {
    const n = frames(hz, fps, 20000);
    assert(n >= lo && n <= hi, `a ${hz} Hz con tope de ${fps} salen ${n.toFixed(1)} FPS`);
  }
})();
