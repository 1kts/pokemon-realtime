// Fluidez del combate con mala red: cuándo pintar a cada uno y cómo seguirlo sin tirones. Sin nada del navegador,
// para poder medirlo y probarlo con una red simulada (tools/smooth-test.js).
export const MIN_DELAY = 100, MAX_DELAY = 250, MAX_EXTRAP = 100;

// Reloj del servidor visto desde aquí, con un margen que crece con la irregularidad de la red: rápido si empeora
// (para que no se acaben los snapshots) y despacio si mejora (para que no se note)
export class SnapClock {
  constructor() { this.offset = null; this.jitter = 0; this.delay = MIN_DELAY; }
  arrive(st, now) {
    const off = st - now;
    this.offset = this.offset === null ? off : Math.max(off, this.offset - 0.5);
    this.jitter = Math.max(this.offset - off, this.jitter * 0.99);
  }
  tick(ms) {
    const want = Math.max(MIN_DELAY, Math.min(MAX_DELAY, 60 + this.jitter * 1.1));
    this.delay += (want - this.delay) * Math.min(1, ms / (want > this.delay ? 120 : 2000));
  }
  renderTime(now) { return now + this.offset - this.delay; }
}

// Dónde va el lado i en ese instante: entre dos snapshots, o sigue un poco su trayectoria si aún no ha llegado el siguiente
export function posAt(snaps, i, t) {
  let k = snaps.length - 1;
  while (k > 0 && snaps[k - 1].st > t) k--;
  const b = snaps[k].ps[i], a = snaps[Math.max(0, k - 1)].ps[i];
  if (b.x === undefined) return null;
  if (a.x === undefined || k === 0) return { x: b.x, y: b.y };
  const sa = snaps[k - 1].st, sb = snaps[k].st;
  if (t < sb) { const f = Math.max(0, (t - sa) / (sb - sa)); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
  const f = Math.min(t - sb, MAX_EXTRAP) / Math.max(1, sb - sa);
  return { x: b.x + (b.x - a.x) * f, y: b.y + (b.y - a.y) * f };
}

// Quita un error de posición poco a poco, igual a cualquier velocidad de fotogramas
export const fade = (v, ms) => v * Math.pow(0.85, ms / (1000 / 60));

// Sigue una posición que puede corregirse de golpe (al llegar un snapshot tras extrapolar): el salto se reparte
export class Follow {
  constructor() { this.last = null; this.err = { x: 0, y: 0 }; }
  to(p, ms, maxSpeed) {
    if (this.last) {
      const dx = p.x - this.last.x, dy = p.y - this.last.y, d = Math.hypot(dx, dy);
      if (d > 120) this.err = { x: 0, y: 0 };   // (un salto de verdad, como un teletransporte)
      else if (d > maxSpeed * ms / 1000 * 1.2 + 2) { this.err.x -= dx; this.err.y -= dy; }
    }
    this.last = { x: p.x, y: p.y };
    this.err.x = fade(this.err.x, ms); this.err.y = fade(this.err.y, ms);
    return { x: p.x + this.err.x, y: p.y + this.err.y };
  }
  reset() { this.last = null; this.err = { x: 0, y: 0 }; }
}

// Tope de FPS según la pantalla: true si toca pintar. Se cita el siguiente fotograma en una rejilla fija, que da la media
// del tope en cualquier pantalla más rápida; y la cita nunca queda a más de un periodo de ahora, para que una pantalla
// un pelo más rápida de lo nominal (60,2 Hz) no acumule adelanto y acabe saltándose un fotograma
const EARLY_MS = 1;   // (un fotograma puede llegar un pelo antes de su cita)
export function pacer() {
  let next = 0;
  return (now, fps) => {
    if (now < next - EARLY_MS) return false;
    const period = 1000 / fps;
    next = Math.min(Math.max(next, now - period) + period, now + period);
    return true;
  };
}
