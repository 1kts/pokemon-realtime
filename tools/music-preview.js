// Escuchar la música antes de publicarla: renderiza cada tema con el mismo motor del juego (en Chromium,
// sin tiempo real) y lo guarda como WAV.
//   node tools/music-preview.js [carpeta] [segundos]      (por defecto ./music-preview y 24 s)
const fs = require('fs');
const path = require('path');
const { setup } = require('./e2e.js');

(async () => {
  const out = path.resolve(process.argv[2] || 'music-preview');
  const secs = +process.argv[3] || 24;
  fs.mkdirSync(out, { recursive: true });
  const ctx = await setup('music-preview');
  try {
    await ctx.page.goto('/');
    const names = await ctx.page.eval(`import('/js/music.js').then(m => [...Object.keys(m.TRACKS), ...Object.keys(m.VARIANTS)])`);
    for (const name of names) {
      // WAV de 16 bits estéreo, pasado a base64 para sacarlo de la página
      const b64 = await ctx.page.eval(`import('/js/music.js').then(async m => {
        const buf = await m.renderTrack(${JSON.stringify(name)}, ${secs});
        const ch = [buf.getChannelData(0), buf.getChannelData(1)], n = buf.length, rate = buf.sampleRate;
        const v = new DataView(new ArrayBuffer(44 + n * 4));
        const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
        v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
        str(36, 'data'); v.setUint32(40, n * 4, true);
        let peak = 0;
        for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const x = Math.max(-1, Math.min(1, ch[c][i])); peak = Math.max(peak, Math.abs(x)); v.setInt16(44 + i * 4 + c * 2, x * 32767, true); }
        const bytes = new Uint8Array(v.buffer); let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return JSON.stringify({ wav: btoa(s), secs: n / rate, peak });
      })`);
      const r = JSON.parse(b64);
      fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.from(r.wav, 'base64'));
      console.log(`${name.padEnd(9)} ${r.secs.toFixed(1)} s · pico ${(r.peak * 100).toFixed(0)} %${r.peak > 0.99 ? ' (satura)' : ''}`);
    }
    console.log(`\nWAV en ${out}`);
  } finally { await ctx.teardown(); }
})().catch(e => { console.error(e); process.exit(1); });
