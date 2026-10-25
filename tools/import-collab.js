// Trae de SpriteCollab, para un rango de la Pokédex, lo que import-sprites.js e import-portraits.js no
// traen: animaciones extra (EXTRA, normal y shiny) y los retratos con emoción (EMOTIONS, normal y shiny).
//   node tools/import-collab.js 1 251            Gen 1 y 2 (descarga lo que falte)
//   node tools/import-collab.js 1 251 --force    lo vuelve a descargar todo
// Animaciones: public/sprites/{dex}/{Anim}.png (y s/ las shiny); su geometría se añade a
// public/sprites/meta.js: fotograma y duraciones de AnimData.xml, ancla (los pies) = centro de la sombra
// del primer fotograma en {Anim}-Shadow.png, r: 1 si la hoja tiene una sola dirección.
// Emociones: public/portraits/emo/{dex}/{Emoción}.png (y s/), con su índice en public/portraits/emo.js.
// Créditos: tabla por artista en CREDITS.md entre las marcas de START/END. Licencia CC BY-NC 4.0.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const EXTRA = ['Sleep', 'Hop', 'Swing', 'Rotate', 'Double', 'Eat', 'Pose', 'SpAttack', 'Twirl'];
const EMOTIONS = ['Normal', 'Happy', 'Joyous', 'Inspired', 'Determined', 'Angry', 'Shouting', 'Surprised', 'Pain',
  'Stunned', 'Dizzy', 'Worried', 'Sigh', 'Sad', 'Teary-Eyed', 'Crying'];
const START = '<!-- collab:inicio (lo rellena tools/import-collab.js) -->', END = '<!-- collab:fin -->';
const [from, to] = process.argv.slice(2, 4).map(Number);
const force = process.argv.includes('--force');
if (!from || !to) { console.log('Uso: node tools/import-collab.js <desde> <hasta> [--force]'); process.exit(2); }

async function get(url, type = 'buffer') {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return type === 'json' ? r.json() : type === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === 3) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

// PNG RGBA de 8 bits sin entrelazar (lo que usa SpriteCollab) → { w, h, px }
function decodePng(buf) {
  let p = 8, w, h, depth, type;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (depth !== 8 || type !== 6) throw new Error(`PNG no soportado (profundidad ${depth}, tipo ${type})`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { w, h, px };
}

// Ancla: centro de los píxeles visibles de la sombra en el primer fotograma (fila 0, columna 0)
function anchor(shadow, fw, fh) {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (shadow.px[(y * shadow.w + x) * 4 + 3]) { sx += x; sy += y; n++; }
  return n ? { ax: Math.round(sx / n * 2) / 2, ay: Math.round(sy / n * 2) / 2 } : { ax: fw / 2 - 0.5, ay: fh / 2 + 3.5 };
}

// AnimData.xml → { nombre: { w, h, d } } (CopyOf apunta a otra animación con su misma hoja)
function parseAnimData(xml) {
  const out = {}, copies = {};
  for (const block of xml.split('<Anim>').slice(1)) {
    const tag = n => (block.match(new RegExp(`<${n}>([^<]*)</${n}>`)) || [])[1];
    const name = tag('Name');
    if (tag('CopyOf')) { copies[name] = tag('CopyOf'); continue; }
    out[name] = { w: +tag('FrameWidth'), h: +tag('FrameHeight'), d: [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m => +m[1]) };
  }
  for (const [name, src] of Object.entries(copies)) if (out[src]) out[name] = { ...out[src], copyOf: src };
  return out;
}

const save = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };

(async () => {
  const tracker = await get(RAW + 'tracker.json', 'json');
  const names = {};
  for (const line of (await get(RAW + 'credit_names.txt', 'text')).split('\n').slice(1)) {
    const [name, id, contact] = line.split('\t');
    if (id) names[id.trim()] = { name: (name || '').trim() || id.trim(), contact: (contact || '').trim() };
  }
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/sprites/meta.js'), 'utf8'), ctx);
  const META = ctx.window.SPRITE_META;
  const emoFile = path.join(ROOT, 'public/portraits/emo.js');
  const EMO = {};
  if (fs.existsSync(emoFile)) Object.assign(EMO, require(emoFile));
  const byArtist = new Map();
  const credit = (id, dex) => {
    if (!id) return;
    const a = names[id] || { name: id, contact: '' };
    if (!byArtist.has(a.name)) byArtist.set(a.name, { contact: a.contact, dex: new Set() });
    byArtist.get(a.name).dex.add(dex);
  };
  let anims = 0, faces = 0;
  // Cada especie por separado, 8 a la vez
  let done = 0;
  const one = async dex => {
    const key = String(dex).padStart(4, '0'), t = tracker[key];
    if (!t || !META[dex]) return;
    const shinyGroup = t.subgroups && t.subgroups['0000'] && t.subgroups['0000'].subgroups && t.subgroups['0000'].subgroups['0001'];
    // Animaciones extra
    const xml = await get(`${RAW}sprite/${key}/AnimData.xml`, 'text');
    const data = xml ? parseAnimData(xml) : {};
    const sxml = shinyGroup && await get(`${RAW}sprite/${key}/0000/0001/AnimData.xml`, 'text');
    const sdata = sxml ? parseAnimData(sxml) : {};
    const m = META[dex];
    for (const anim of EXTRA) {
      const a = data[anim];
      if (!a) continue;
      const fileName = a.copyOf || anim;
      const out = path.join(ROOT, 'public/sprites', String(dex), anim + '.png');
      if (force || !fs.existsSync(out) || !m.a[anim]) {
        const png = await get(`${RAW}sprite/${key}/${fileName}-Anim.png`);
        const shadow = await get(`${RAW}sprite/${key}/${fileName}-Shadow.png`);
        if (!png || !shadow) continue;
        const sheet = decodePng(png);
        save(out, png);
        m.a[anim] = { w: a.w, h: a.h, d: a.d, ...anchor(decodePng(shadow), a.w, a.h), ...(sheet.h <= a.h ? { r: 1 } : {}) };
        anims++;
      }
      // Shiny: misma geometría que la normal; si no coincide, el cliente usa la normal
      const sa = sdata[anim];
      if (sa && sa.w === a.w && sa.h === a.h) {
        const sout = path.join(ROOT, 'public/sprites', String(dex), 's', anim + '.png');
        if (force || !fs.existsSync(sout)) {
          const spng = await get(`${RAW}sprite/${key}/0000/0001/${sa.copyOf || anim}-Anim.png`);
          if (spng) save(sout, spng);
        }
        if (fs.existsSync(sout)) m.sh = [...new Set([...(m.sh || []), anim])];
      }
    }
    for (const id of [t.sprite_credit && t.sprite_credit.primary, ...((t.sprite_credit && t.sprite_credit.secondary) || [])]) credit(id, dex);
    // Retratos con emoción
    const have = EMOTIONS.filter(e => e in (t.portrait_files || {}));
    const shave = EMOTIONS.filter(e => shinyGroup && e in (shinyGroup.portrait_files || {}));
    for (const e of have) {
      const out = path.join(ROOT, 'public/portraits/emo', String(dex), e + '.png');
      if (force || !fs.existsSync(out)) { const png = await get(`${RAW}portrait/${key}/${e}.png`); if (png) { save(out, png); faces++; } }
    }
    for (const e of shave) {
      const out = path.join(ROOT, 'public/portraits/emo', String(dex), 's', e + '.png');
      if (force || !fs.existsSync(out)) { const png = await get(`${RAW}portrait/${key}/0000/0001/${e}.png`); if (png) { save(out, png); faces++; } }
    }
    if (have.length) EMO[dex] = { e: have, ...(shave.length ? { s: shave } : {}) };
    for (const id of [t.portrait_credit && t.portrait_credit.primary, ...((t.portrait_credit && t.portrait_credit.secondary) || [])]) credit(id, dex);
    process.stdout.write(`\r${++done}/${to - from + 1}`);
  };
  const queue = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await one(queue.shift()); }));
  // meta.js: mismas líneas que import-sprites.js, con las animaciones nuevas
  const metaFile = path.join(ROOT, 'public/sprites/meta.js');
  const head = fs.readFileSync(metaFile, 'utf8').split('window.SPRITE_META = {')[0]
    .replace('hv = flota en su sprite', 'r: 1 = la hoja tiene una sola dirección · hv = flota en su sprite');
  const lines = Object.keys(META).map(Number).sort((a, b) => a - b).map(d => `  ${d}: ${JSON.stringify(META[d])},`).join('\n');
  fs.writeFileSync(metaFile, `${head}window.SPRITE_META = {\n${lines}\n};\n`);
  fs.writeFileSync(emoFile, `// Generado por tools/import-collab.js: retratos con emoción de cada especie (e) y los que tienen versión\n` +
    `// shiny (s), en public/portraits/emo/{dex}/[s/]{Emoción}.png. No editar a mano.\n` +
    `(function (root) {\n  const PORTRAIT_EMO = ${JSON.stringify(EMO)};\n` +
    `  if (typeof module !== 'undefined' && module.exports) module.exports = PORTRAIT_EMO;\n  else root.PORTRAIT_EMO = PORTRAIT_EMO;\n})(this);\n`);
  // Créditos
  const rows = [...byArtist.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }))
    .map(([name, a]) => `| ${name.replace(/\|/g, '/')} | ${a.contact.replace(/\|/g, '/')} | ${[...a.dex].sort((x, y) => x - y).join(', ')} |`);
  const section = `${START}
## Animaciones extra y retratos con emoción

Las animaciones extra (dormir, saltar, comer, posar…) y los retratos con emoción de los Pokémon
${from}-${to} vienen de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab).
Licencia [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): uso **no comercial**
y con atribución a sus artistas.

| Artista | Contacto | Pokémon (nº de Pokédex) |
|---|---|---|
${rows.join('\n')}
${END}`;
  const credits = path.join(ROOT, 'CREDITS.md');
  let src = fs.readFileSync(credits, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i >= 0 && j > i) src = src.slice(0, i) + section + src.slice(j + END.length);
  else src = src.replace('\n## Marca', `\n${section}\n\n## Marca`);
  fs.writeFileSync(credits, src);
  console.log(`\n${anims} animaciones nuevas · ${faces} retratos · ${byArtist.size} artistas`);
})().catch(e => { console.error(e); process.exit(1); });
