// Música del juego. Los temas con grabación (FILES: public/music/*.mp3, compuestos por músicos que nos
// han dado permiso; créditos en /legal) suenan desde su archivo y, si falta o tarda en cargar, se usa la
// versión sintetizada de ese mismo tema (abajo), que sigue funcionando por sí sola. Los temas sin
// grabación suenan siempre sintetizados. Los bucles se hacen con un fundido cruzado de FADE segundos.
//
// Lo sintetizado: chiptune al estilo de las consolas portátiles de los 90. Dos canales de onda
// cuadrada (melodía, y armonía o arpegios), una onda triangular para el bajo y ruido para la batería,
// generado con Web Audio. Las melodías son composiciones originales de PokéArenas; no se usa ninguna melodía de los juegos de Pokémon (tienen derechos de autor), solo su
// manera de sonar: vibrato en las notas largas, arpegios rápidos, bajo de octavas en los combates…
//
// Notación de las melodías: "nota:duración" en semicorcheas (un compás = 16), p. ej. 'E5:4 r:2'
// (r = silencio). El bajo, los arpegios y la batería salen de los acordes de cada compás.
import { storage } from './net.js';

const KEY = 'arena.music';
const DEFAULT_VOLUME = 0.45;
const FADE = 3;                                  // s de fundido cruzado entre el final y el principio de un bucle
const FILE_WAIT = 2500;                          // ms que se espera a un archivo antes de usar lo sintetizado
// Cambio de tema: el que suena se apaga en FADE_OUT s, se deja un respiro de GAP s y el nuevo entra
// poco a poco en FADE_IN s (al cambiar de pantalla o entrar y salir de un combate no corta de golpe)
const FADE_OUT = 1.5, GAP = 0.8, FADE_IN = 2.5;
// Tema -> grabación. pueblo y lider: "A Pokémon Tale in Three Parts" de jannetty (partes 1 y 3);
// desierto: "Desert Battle" de rckbtm; salvaje: "The Wild Duel" de Navet56 (OPMon Lazuli, CC-BY 4.0);
// campeon: "Face The Champion!" de Spring Spring (CC-BY 3.0). Se suben con el volumen igualado (-16 LUFS).
const FILES = { menu: 'pueblo', battle: 'desierto', wild: 'salvaje', leader: 'lider', champion: 'campeon' };

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
  // Fuera de combate (menús, mapa, equipo…): marcha luminosa (Do mayor)
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
    this.notes = 0;         // notas sintetizadas programadas (para las pruebas)
    this.file = null;       // { name, bus, buf, loop, next, srcs }: la grabación que suena
    this.token = 0;         // cada cambio de tema invalida las cargas pendientes del anterior
    this.starts = 0;        // veces que se ha empezado un tema (para las pruebas)
    this.bytes = new Map(); // archivo -> promesa con sus bytes (o null si no está)
    this.buffers = new Map();
    // El del menú se pide ya (suena primero); el resto, cuando la página está tranquila
    this.preload('menu');
    setTimeout(() => Object.keys(FILES).forEach(n => this.preload(n)), 4000);
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
  get sounding() { return !!(this.seq || this.file); }
  get source() { return this.file ? 'archivo' : this.seq ? 'sintetizado' : null; }

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
    if (this.want && !this.seq && !this.file) this.launch(this.want);
  }

  // Onda cuadrada con el ancho de pulso de las portátiles (12,5 %, 25 % o 50 %)
  pulse(duty) {
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k); }
    return this.ctx.createPeriodicWave(re, im);
  }

  // Cambia de tema con un fundido (si ya suena ese, no hace nada)
  play(name) {
    if (name === this.want) return;
    this.want = name;
    if (!this.ctx) return;
    const was = this.fadeOut();
    if (name) this.launch(name, was ? (FADE_OUT + GAP) * 1000 : 0);
  }
  stop() { this.play(null); }

  // ---------- Grabaciones ----------
  preload(name) {
    const file = FILES[name];
    if (!file) return Promise.resolve(null);
    if (!this.bytes.has(file)) {
      this.bytes.set(file, fetch(`/music/${file}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
    return this.bytes.get(file);
  }
  async decode(name) {
    const file = FILES[name];
    if (this.buffers.has(file)) return this.buffers.get(file);
    const raw = await this.preload(name);
    if (!raw || !this.ctx) return null;
    try {
      const buf = await this.ctx.decodeAudioData(raw.slice(0));
      this.buffers.set(file, buf);
      return buf;
    } catch { this.bytes.set(file, Promise.resolve(null)); return null; }
  }
  // Empieza un tema: su grabación si está (o llega enseguida) y, si no, el sintetizado
  // (wait: ms que espera a que se apague el anterior; mientras, ya va cargando)
  async launch(name, wait = 0) {
    const token = ++this.token;
    this.starts++;
    let buf = FILES[name] ? this.buffers.get(FILES[name]) : null;
    const load = !buf && FILES[name] ? Promise.race([this.decode(name), new Promise(r => setTimeout(r, FILE_WAIT, null))]) : buf;
    [buf] = await Promise.all([load, new Promise(r => setTimeout(r, wait))]);
    if (token !== this.token || !this.ctx) return;   // mientras tanto se ha pedido otro tema
    if (buf) this.startFile(name, buf); else this.begin(name);
  }
  // Un bus que entra poco a poco
  fadeInBus() {
    const bus = this.ctx.createGain(), t = this.ctx.currentTime;
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + FADE_IN);
    bus.connect(this.master);
    return bus;
  }
  startFile(name, buf) {
    const bus = this.fadeInBus();
    this.file = { name, bus, buf, loop: true, next: this.ctx.currentTime + 0.05, srcs: [] };
    this.fileTick();
  }
  // Programa la siguiente pasada de la grabación cuando se acerca su momento
  fileTick() {
    const f = this.file;
    if (!f || !this.running) return;
    while (f.next < this.ctx.currentTime + 0.4) {
      const t = f.next, dur = f.buf.duration;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = f.buf;
      const fade = Math.min(FADE, dur / 3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + (f.srcs.length ? fade : 0.05));   // la entrada la hace el bus
      if (f.loop) { g.gain.setValueAtTime(1, t + dur - fade); g.gain.linearRampToValueAtTime(0, t + dur); }
      src.connect(g).connect(f.bus);
      src.start(t);
      f.srcs.push(src);
      src.onended = () => { f.srcs = f.srcs.filter(x => x !== src); if (!f.loop && this.file === f) { this.file = null; this.want = null; } };
      this.notes++;
      if (!f.loop) { f.next = Infinity; break; }
      f.next = t + dur - fade;
    }
  }

  begin(name) {
    const song = compile(name);
    const bus = this.fadeInBus();
    this.seq = { song, bus, step: 0, time: this.ctx.currentTime + 0.08 };
  }

  // Apaga lo que suena en FADE_OUT s; dice si sonaba algo
  fadeOut() {
    const was = !!(this.file || this.seq), t = this.ctx.currentTime;
    const off = bus => {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + FADE_OUT);
      setTimeout(() => bus.disconnect(), (FADE_OUT + 0.2) * 1000);
    };
    const f = this.file;
    if (f) {
      off(f.bus);
      for (const s of f.srcs) { try { s.stop(t + FADE_OUT + 0.1); } catch { /* ya había acabado */ } }
      this.file = null;
    }
    if (this.seq) { off(this.seq.bus); this.seq = null; }
    return was;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    storage.set(KEY, String(this.volume));
    if (!this.ctx) return;
    // A 0 solo se baja el volumen, sin suspender el audio: en Chrome, reanudarlo después a veces se queda
    // colgado y la música no volvía al subirla
    this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    if (this.volume > 0) this.start();
  }

  // Programa lo que toca en los próximos 150 ms
  tick() {
    this.fileTick();
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

// Fuera de combate suena siempre el mismo tema (portada, menú, mapa, equipo, tienda, resultados…), así que
// moverse por los menús no corta la música.
export function trackForView() {
  return 'menu';
}
export function trackForBattle(start, Data) {
  if (start.mode === 'wild') return 'wild';
  const node = Object.values(Data.NODES || {}).find(n => n.kind !== 'route' && n.map === start.map);
  if (node) return node.kind === 'champion' ? 'champion' : 'leader';
  return 'battle';
}

export { TRACKS, VARIANTS, DEFAULT_VOLUME, compile };
