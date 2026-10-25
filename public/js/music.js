// Música del juego: chiptune al estilo de las consolas portátiles de los 90. Dos canales de onda
// cuadrada (melodía, y armonía o arpegios), una onda triangular para el bajo y ruido para la batería,
// todo generado con Web Audio: no hay archivos de audio. Las melodías son composiciones originales de
// PokéArenas; no se usa ninguna melodía de los juegos de Pokémon (tienen derechos de autor), solo su
// manera de sonar: vibrato en las notas largas, arpegios rápidos, bajo de octavas en los combates…
//
// Notación de las melodías: "nota:duración" en semicorcheas (un compás = 16), p. ej. 'E5:4 r:2'
// (r = silencio). El bajo, los arpegios y la batería salen de los acordes de cada compás.
import { storage } from './net.js';

const KEY = 'arena.music';
const DEFAULT_VOLUME = 0.45;

// ---------- Notas y acordes ----------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
function midi(n) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  if (!m) throw new Error('Nota no válida: ' + n);
  return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]);
}
const hz = m => 440 * 2 ** ((m - 69) / 12);
const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
function chord(name) {
  const m = /^([A-G])(#|b)?(m7|m|7|dim)?$/.exec(name);
  if (!m) throw new Error('Acorde no válido: ' + name);
  return { root: PC[m[1]] + acc(m[2]), iv: QUALITY[m[3] || ''] };
}
// 'E5:4 r:2 …' → [{ step, len, m }] (y comprueba que cada compás tiene sus 16 semicorcheas)
function parseBar(line, where) {
  const notes = [];
  let step = 0;
  for (const tok of line.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = +l || 1;
    if (n !== 'r') notes.push({ step, len, m: midi(n) });
    step += len;
  }
  if (step !== 16) throw new Error(`${where}: el compás suma ${step} semicorcheas, no 16`);
  return notes;
}

// ---------- Patrones generados a partir del acorde ----------
// Bajo (onda triangular, octava 2)
const BASS = {
  // Octavas en corcheas: el motor de los combates
  octave: c => [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => ({ step: s, len: 2, m: 36 + c.root + (i % 2 ? 12 : 0) })),
  // Saltarín: raíz y quinta
  bounce: c => [[0, 3, 0], [3, 1, 7], [4, 4, 12], [8, 3, 0], [11, 1, 7], [12, 4, 12]].map(([s, l, d]) => ({ step: s, len: l, m: 36 + c.root + d })),
  // Marcha: raíz y quinta en negras
  march: c => [[0, 4, 0], [4, 4, 7], [8, 4, 0], [12, 4, 7]].map(([s, l, d]) => ({ step: s, len: l, m: 36 + c.root + d })),
};
// Segunda cuadrada (bajito): arpegios y acordes a contratiempo
const HARMONY = {
  // Arpegio en semicorcheas, subiendo y bajando por el acorde (octava 4)
  arp: c => { const t = [...c.iv, 12, ...c.iv.slice(1).reverse()]; return Array.from({ length: 16 }, (_, s) => ({ step: s, len: 1, m: 60 + c.root + t[s % t.length] })); },
  // Arpegio en corcheas (más tranquilo)
  arp8: c => { const t = [0, ...c.iv.slice(1), 12]; return Array.from({ length: 8 }, (_, i) => ({ step: i * 2, len: 2, m: 60 + c.root + t[i % t.length] })); },
  // Acorde a contratiempo: tercera y quinta alternas
  stab: c => [2, 6, 10, 14].map((s, i) => ({ step: s, len: 2, m: 60 + c.root + c.iv[1 + (i % 2)] })),
};
// Batería: una línea de bombo/caja (k/s) y otra de platos (h cerrado, o abierto), 16 pasos por compás
const DRUMS = {
  march: ['k...s...k.k.s...', 'h.h.h.h.h.h.h.h.'],
  bounce: ['k.....k.s.......', '..h...h...h...h.'],
  battle: ['k...s..kk.k.s...', 'hhhhhhhhhhhhhhho'],
  leader: ['k..ks..kk..ks.ss', 'h.hhh.hhh.hhh.ho'],
  fill: ['k.k.s.s.ssssssss', '................'],
  none: ['................', '................'],
};

// ---------- Temas (composiciones originales) ----------
// bpm, compases de introducción (no se repiten), acordes por compás, melodía por compás y estilos.
const TRACKS = {
  // Menú: marcha luminosa (Do mayor)
  menu: {
    bpm: 112, intro: 0, bass: 'march', harmony: 'arp8', drums: ['march', 'march', 'march', 'march', 'march', 'march', 'march', 'fill'],
    chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
    lead: [
      'G4:2 C5:2 E5:4 G5:4 E5:2 C5:2',
      'D5:4 B4:2 G4:2 B4:2 D5:2 G5:4',
      'A5:6 G5:2 E5:4 C5:4',
      'B4:8 G4:4 B4:4',
      'A4:2 C5:2 F5:4 A5:4 G5:2 F5:2',
      'E5:4 G5:4 C6:6 B5:2',
      'A5:4 G5:2 F5:2 E5:2 D5:2 C5:4',
      'D5:6 E5:2 F5:2 E5:2 D5:4',
    ],
  },
  // Rutas del mapa: aventura saltarina (Re mayor)
  map: {
    bpm: 132, intro: 0, bass: 'bounce', harmony: 'stab', drums: ['bounce', 'bounce', 'bounce', 'bounce', 'bounce', 'bounce', 'bounce', 'fill'],
    chords: ['D', 'A', 'Bm7', 'G', 'D', 'A', 'G', 'A'],
    lead: [
      'F#5:2 A5:2 D6:4 A5:2 F#5:2 A5:4',
      'E5:2 C#5:2 A4:4 C#5:2 E5:2 A5:4',
      'D5:4 F#5:2 B5:2 A5:4 F#5:4',
      'G5:6 F#5:2 E5:4 D5:4',
      'F#5:2 E5:2 D5:2 F#5:2 A5:4 B5:2 A5:2',
      'C#6:4 B5:2 A5:2 E5:8',
      'D5:2 E5:2 G5:4 B5:4 A5:2 G5:2',
      'A5:8 r:4 C#5:2 E5:2',
    ],
  },
  // Combate: rápido, con bajo de octavas y arpegios (La menor)
  battle: {
    bpm: 168, intro: 2, bass: 'octave', harmony: 'arp', drums: ['fill', 'fill', 'battle', 'battle', 'battle', 'battle', 'battle', 'battle', 'battle', 'fill'],
    chords: ['Am', 'E', 'Am', 'Dm', 'F', 'G', 'Am', 'Am', 'F', 'E'],
    lead: [
      'A5:1 r:1 A5:1 r:1 G5:1 r:1 G5:1 r:1 F5:1 r:1 F5:1 r:1 E5:2 r:2',
      'E5:1 r:1 E5:1 r:1 F5:1 r:1 F5:1 r:1 G#5:4 B5:4',
      'A4:2 C5:2 E5:2 A5:6 G5:2 E5:2',
      'F5:2 E5:2 D5:2 C5:2 B4:2 C5:2 D5:4',
      'C5:4 F5:4 A5:4 G5:2 F5:2',
      'G5:6 F5:2 E5:2 D5:2 B4:4',
      'A5:2 B5:2 C6:4 B5:2 A5:2 E5:4',
      'F5:2 G5:2 A5:4 E5:4 C5:4',
      'D5:2 F5:2 A5:4 C6:4 A5:4',
      'G#5:6 E5:2 B4:4 G#4:4',
    ],
  },
  // Líder de gimnasio y Alto Mando: más dramático (Mi menor)
  leader: {
    bpm: 176, intro: 2, bass: 'octave', harmony: 'arp', drums: ['fill', 'fill', 'leader', 'leader', 'leader', 'leader', 'leader', 'leader', 'leader', 'fill'],
    chords: ['B7', 'B7', 'Em', 'C', 'D', 'B7', 'Em', 'C', 'Am', 'B7'],
    lead: [
      'B5:1 r:1 B5:1 r:1 B5:1 r:1 A5:2 G5:2 F#5:2 D#5:4',
      'B4:2 D#5:2 F#5:2 A5:2 B5:8',
      'E5:2 G5:2 B5:4 A5:2 G5:2 F#5:4',
      'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
      'F#5:4 A5:4 D6:4 C6:2 A5:2',
      'B5:6 A5:2 F#5:4 D#5:4',
      'E5:1 F#5:1 G5:2 B5:4 E6:4 D6:2 B5:2',
      'C6:4 B5:2 A5:2 G5:4 E5:4',
      'A5:2 C6:2 E6:4 D6:2 C6:2 B5:4',
      'D#6:4 C6:2 B5:2 A5:2 G5:2 F#5:4',
    ],
  },
  // Fanfarria de victoria (Do mayor; no se repite)
  victory: {
    bpm: 150, intro: 0, loop: false, bass: 'march', harmony: 'arp', drums: ['march', 'fill'],
    chords: ['C', 'C'],
    lead: ['C5:2 E5:2 G5:2 C6:6 B5:2 A5:2', 'G5:4 E5:2 G5:2 C6:8'],
  },
  // Derrota: corta y en menor (no se repite)
  defeat: {
    bpm: 96, intro: 0, loop: false, bass: 'march', harmony: 'arp8', drums: ['none'],
    chords: ['Am'],
    lead: ['E5:4 C5:4 A4:8'],
  },
};
// Variantes: el mismo tema en otra tonalidad o tempo (para que no suene todo igual)
const VARIANTS = {
  wild: { track: 'battle', transpose: 2 },
  champion: { track: 'leader', transpose: 1, bpm: 1.05 },
};

// Cada tema, compilado una vez: por cada semicorchea, las notas que empiezan en ella
const compiled = new Map();
function compile(name) {
  if (compiled.has(name)) return compiled.get(name);
  const v = VARIANTS[name] || { track: name };
  const tr = TRACKS[v.track];
  if (!tr) throw new Error('Tema desconocido: ' + name);
  const up = v.transpose || 0;
  const bars = tr.lead.length;
  if (tr.chords.length !== bars || (tr.drums && tr.drums.length !== bars)) throw new Error(`${name}: compases distintos en melodía, acordes y batería`);
  const steps = Array.from({ length: bars * 16 }, () => []);
  const add = (bar, ch, list) => { for (const n of list) steps[bar * 16 + n.step].push({ ch, len: n.len, m: n.m + up }); };
  tr.lead.forEach((line, b) => {
    const c = chord(tr.chords[b]);
    add(b, 'lead', parseBar(line, `${name}, compás ${b + 1}`));
    add(b, 'bass', BASS[tr.bass](c));
    add(b, 'harm', HARMONY[tr.harmony](c));
    const [ks, hats] = DRUMS[tr.drums[b]];
    for (let s = 0; s < 16; s++) {
      if (ks[s] !== '.') steps[b * 16 + s].push({ ch: 'drum', d: ks[s] });
      if (hats[s] !== '.') steps[b * 16 + s].push({ ch: 'drum', d: hats[s] });
    }
  });
  const out = { name, steps, stepSec: 60 / (tr.bpm * (v.bpm || 1)) / 4, loopFrom: (tr.intro || 0) * 16, loop: tr.loop !== false };
  compiled.set(name, out);
  return out;
}

// ---------- Motor ----------
export class Music {
  constructor() {
    const saved = parseFloat(storage.get(KEY));
    this.volume = Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : DEFAULT_VOLUME;
    this.ctx = null;
    this.want = null;       // el tema que toca ahora (aunque el audio aún no se haya desbloqueado)
    this.seq = null;        // { song, bus, step, time }
    this.notes = 0;         // notas programadas (para las pruebas)
    // Los navegadores no dejan sonar nada hasta que el jugador toca la página
    const unlock = () => { this.start(); };
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
    // Pestaña oculta: los temporizadores van a trompicones, así que se pausa y luego se retoma
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.volume > 0) this.ctx.resume().then(() => { if (this.seq) this.seq.time = this.ctx.currentTime + 0.05; });
    });
  }

  get current() { return this.want; }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      this.master.connect(comp).connect(this.ctx.destination);
      this.waves = { 0.125: this.pulse(0.125), 0.25: this.pulse(0.25), 0.5: this.pulse(0.5) };
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.tick(), 25);
    }
    if (this.volume > 0 && this.ctx.state !== 'running') this.ctx.resume();
    if (this.want && !this.seq) this.begin(this.want);
  }

  // Onda cuadrada con el ancho de pulso de las portátiles (12,5 %, 25 % o 50 %)
  pulse(duty) {
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k); }
    return this.ctx.createPeriodicWave(re, im);
  }

  // Cambia de tema con un fundido corto (si ya suena ese, no hace nada)
  play(name) {
    if (name === this.want) return;
    this.want = name;
    if (!this.ctx) return;
    this.fadeOut();
    if (name) this.begin(name);
  }
  stop() { this.play(null); }

  begin(name) {
    const song = compile(name);
    const bus = this.ctx.createGain();
    bus.connect(this.master);
    this.seq = { song, bus, step: 0, time: this.ctx.currentTime + 0.08 };
  }

  fadeOut() {
    if (!this.seq) return;
    const { bus } = this.seq, t = this.ctx.currentTime;
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.5);
    setTimeout(() => bus.disconnect(), 700);
    this.seq = null;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    storage.set(KEY, String(this.volume));
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    if (this.volume === 0) this.ctx.suspend();
    else this.start();
  }

  // Programa lo que toca en los próximos 150 ms
  tick() {
    const s = this.seq;
    if (!s || !this.running) return;
    const until = this.ctx.currentTime + 0.15;
    while (s.time < until) {
      if (s.step >= s.song.steps.length) {
        if (!s.song.loop) { this.seq = null; this.want = null; return; }   // fanfarria: termina y queda en silencio
        s.step = s.song.loopFrom;
      }
      for (const ev of s.song.steps[s.step]) this.note(ev, s.time, s.song.stepSec, s.bus);
      s.time += s.song.stepSec;
      s.step++;
    }
  }

  note(ev, t, stepSec, bus) {
    const ctx = this.ctx;
    this.notes++;
    if (ev.ch === 'drum') return this.drum(ev.d, t, bus);
    const dur = ev.len * stepSec;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    const vol = { lead: 0.2, harm: 0.07, bass: 0.34 }[ev.ch];
    if (ev.ch === 'bass') osc.type = 'triangle';
    else osc.setPeriodicWave(this.waves[ev.ch === 'lead' ? 0.25 : 0.125]);
    osc.frequency.value = hz(ev.m);
    const end = t + Math.max(0.03, dur * (ev.ch === 'harm' ? 0.8 : 0.92));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setTargetAtTime(vol * (ev.ch === 'lead' ? 0.75 : 0.6), t + 0.02, 0.12);
    g.gain.setTargetAtTime(0, end - 0.015, 0.008);
    // Vibrato en las notas largas de la melodía, que entra con un poco de retraso (muy de portátil)
    if (ev.ch === 'lead' && dur >= 0.3) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.6;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(0, t + 0.14);
      depth.gain.linearRampToValueAtTime(22, t + 0.3);
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t); lfo.stop(end + 0.05);
    }
    osc.connect(g).connect(bus);
    osc.start(t); osc.stop(end + 0.05);
  }

  drum(d, t, bus) {
    const ctx = this.ctx;
    if (d === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + 0.15);
      return;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    const [type, fq, vol, len] = d === 's' ? ['bandpass', 1900, 0.32, 0.13] : d === 'o' ? ['highpass', 6500, 0.09, 0.16] : ['highpass', 7500, 0.07, 0.035];
    f.type = type; f.frequency.value = fq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + len + 0.01);
  }
}

// Renderiza un tema a un AudioBuffer (sin tiempo real), con el mismo sonido que en el juego: para
// escucharlo antes de publicarlo (tools/music-preview.js). Dura `seconds` o lo que dure si no se repite.
export async function renderTrack(name, seconds = 20, sampleRate = 44100) {
  const song = compile(name);
  const total = song.loop ? seconds : song.steps.length * song.stepSec + 0.6;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);
  const m = Object.create(Music.prototype);
  Object.assign(m, { ctx, notes: 0, volume: 1 });
  m.master = ctx.createGain();
  m.master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  m.master.connect(comp).connect(ctx.destination);
  m.waves = { 0.125: m.pulse(0.125), 0.25: m.pulse(0.25), 0.5: m.pulse(0.5) };
  m.noise = ctx.createBuffer(1, sampleRate, sampleRate);
  m.noise.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
  let step = 0;
  for (let t = 0.05; t < total - 0.05; t += song.stepSec) {
    if (step >= song.steps.length) { if (!song.loop) break; step = song.loopFrom; }
    for (const ev of song.steps[step]) m.note(ev, t, song.stepSec, m.master);
    step++;
  }
  return ctx.startRendering();
}

// El tema de cada pantalla: como en los juegos, la música cambia al cambiar de sitio (menú principal o
// mapa de historia), no al abrir un menú. Las pantallas de paso (equipo, tienda, Pokédex, perfil…)
// siguen con lo que sonaba; si no sonaba nada (tras la fanfarria de un combate), el tema del menú.
const PLACES = { title: 'menu', menu: 'menu', story: 'map' };
export function trackForView(view, current) {
  if (view === 'results') return undefined;            // se deja sonar la fanfarria
  if (PLACES[view]) return PLACES[view];
  return current ? undefined : 'menu';
}
export function trackForBattle(start, Data) {
  if (start.mode === 'wild') return 'wild';
  const node = Object.values(Data.NODES || {}).find(n => n.kind !== 'route' && n.map === start.map);
  if (node) return node.kind === 'champion' ? 'champion' : 'leader';
  return 'battle';
}

export { TRACKS, VARIANTS, DEFAULT_VOLUME, compile };
