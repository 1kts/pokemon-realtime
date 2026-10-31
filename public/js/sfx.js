// Efectos de sonido del combate, suaves para no cansar: al lanzar un movimiento, un soplido corto (más
// largo en rayos y áreas) que el tipo solo aclara u oscurece un poco; al recibir un golpe, un golpe sordo,
// algo más marcado si es fuerte o muy eficaz. Lo del rival suena a la mitad. Todo se genera con Web Audio
// (ruido filtrado y ondas), sin archivos. Volumen aparte del de la música.
import { storage } from './net.js';

const KEY = 'arena.sfx';
export const DEFAULT_SFX = 0.25;

// Brillo de cada tipo: frecuencia central del soplido (Hz). Agua, hielo o eléctrico más claros; tierra,
// roca o siniestro más oscuros
const TYPE_HZ = {
  normal: 1400, fuego: 1100, agua: 1700, planta: 1500, electrico: 2200, hielo: 2400, lucha: 900, veneno: 1000,
  tierra: 700, volador: 1800, psiquico: 1900, bicho: 1600, roca: 750, fantasma: 1200, dragon: 850, siniestro: 800,
  acero: 2000, hada: 2300,
};
// Duración del soplido (s) y cuánto tarda en llegar a su volumen, por forma de movimiento
const SHAPE = {
  proj: [0.14, 0.01], beam: [0.38, 0.1], melee: [0.1, 0.005], dash: [0.22, 0.03],
  cone: [0.3, 0.06], wave: [0.32, 0.08], area: [0.3, 0.08],
};

export class Sfx {
  constructor() {
    const saved = parseFloat(storage.get(KEY));
    this.volume = Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : DEFAULT_SFX;
    this.ctx = null;
    this.played = {};   // efecto -> veces que ha sonado (para las pruebas)
    const unlock = () => this.start();
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
  }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.volume > 0 && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    storage.set(KEY, String(this.volume));
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    if (this.volume > 0) this.ctx.resume().catch(() => {});
  }

  // ---------- Piezas ----------
  // Envolvente: sube en a s hasta vol y se apaga hasta d
  env(g, t, vol, d, a = 0.005) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.003, a));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  }
  // Una nota que va de f0 a f1
  tone(type, f0, f1, d, vol, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    this.env(g, t, vol, d);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + d + 0.02);
  }
  // Ruido filtrado que barre de f0 a f1
  noise(f0, f1, d, vol, q = 1, a = 0.005, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf;
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
    this.env(g, t, vol, d, a);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
  }

  // Suena un efecto; mine: si es del jugador (lo del rival, a la mitad)
  play(name, fn, mine = true) {
    this.played[name] = (this.played[name] || 0) + 1;
    if (!this.running || !this.volume) return;
    this.out = this.ctx.createGain();
    this.out.gain.value = mine ? 1 : 0.5;
    this.out.connect(this.master);
    fn();
  }

  // ---------- Efectos ----------
  // Un movimiento lanzado (m: el movimiento de data.js)
  cast(m, mine) {
    this.play('cast', () => {
      if (m.kind === 'heal' || m.kind === 'buff') {   // curarse o mejorarse: dos notas suaves que suben
        this.tone('sine', 660, 660, 0.18, 0.08);
        this.tone('sine', 990, 990, 0.22, 0.07, 0.08);
        return;
      }
      const [d, a] = SHAPE[m.kind] || SHAPE.area;
      const hz = TYPE_HZ[m.type] || 1400;
      const v = m.cost ? 0.3 : 0.22;   // los fuertes, un poco más
      this.noise(hz * 1.3, hz * 0.6, d * (m.cost ? 1.2 : 1), v, 1.2, a);
    }, mine);
  }
  // Un golpe recibido: e.big (fuerte), e.e (>0 muy eficaz), e.b (bloqueado)
  hit(e) {
    this.play('hit', () => {
      if (e.b) { this.tone('triangle', 1200, 1000, 0.08, 0.06); return; }
      const v = e.big || e.e > 0 ? 1.3 : 1;
      this.tone('sine', 170, 60, 0.12, 0.28 * v);
      this.noise(1200, 400, 0.06, 0.12 * v, 1);
    });
  }
  boom(mine) {
    this.play('boom', () => { this.tone('sine', 110, 40, 0.35, 0.3); this.noise(500, 150, 0.3, 0.15, 0.8); }, mine);
  }
  parry() {
    this.play('parry', () => this.tone('triangle', 1600, 1600, 0.15, 0.08));
  }
  faint(mine) {
    this.play('faint', () => this.tone('sine', 440, 160, 0.5, 0.1), mine);
  }

  // ---------- Capturas ----------
  // Unas notas cortas seguidas (semitonos sobre f, cada `gap` s); melodías propias, no las de los juegos
  notes(f, steps, gap, d, vol, type = 'triangle') {
    steps.forEach((s, i) => { if (s !== null) this.tone(type, f * 2 ** (s / 12), f * 2 ** (s / 12), d, vol, i * gap); });
  }
  throwBall() { this.play('throw', () => this.noise(600, 2400, 0.22, 0.14, 1.5, 0.05)); }
  // El Pokémon entra en la Ball: barrido que sube y un chasquido al cerrarse
  ballIn() {
    this.play('ballin', () => { this.tone('sine', 300, 1200, 0.3, 0.08); this.noise(3000, 2000, 0.03, 0.12, 2, 0.003, 0.32); });
  }
  // Cada sacudida: un tic-tac sordo
  shake() {
    this.play('shake', () => { this.tone('sine', 260, 200, 0.06, 0.14); this.tone('sine', 230, 180, 0.06, 0.12, 0.12); });
  }
  // ¡Atrapado!: el clic de la Ball y una fanfarria corta que sube
  caught() {
    this.play('caught', () => {
      this.noise(4000, 3000, 0.03, 0.14, 2);
      this.notes(523, [0, 4, 7, 12, null, 7, 12], 0.09, 0.16, 0.07, 'square');
      this.notes(262, [0, null, 7, null, null, 4, 0], 0.09, 0.2, 0.06);
    });
  }
  // Se escapa: la Ball se abre de golpe
  breakFree() {
    this.play('escape', () => { this.noise(2500, 400, 0.18, 0.2, 1); this.tone('triangle', 700, 250, 0.25, 0.07); });
  }

  // ---------- Fuera del combate ----------
  // Sube de nivel (evolved: ha evolucionado, más largo)
  levelUp(evolved) {
    this.play('levelup', () => evolved
      ? this.notes(392, [0, 4, 7, 12, 16, 19, 24], 0.07, 0.2, 0.07)
      : this.notes(440, [0, 4, 7, 12], 0.07, 0.18, 0.07));
  }
  // Recoger un premio: destellos de monedas
  reward() {
    this.play('reward', () => { this.notes(1318, [0, 5, 12], 0.06, 0.14, 0.06); this.noise(8000, 9000, 0.25, 0.04, 3, 0.01, 0.1); });
  }
}
