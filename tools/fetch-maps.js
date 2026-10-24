// Descarga el mapa del Pokégear de Oro HeartGold/Plata SoulSilver (proyecto de decompilación
// pret/pokeheartgold en GitHub), lo monta a partir de sus tiles y guarda un recorte por región en
// public/maps/{kanto,johto}.png, ampliado sin suavizar para que se vea pixel art nítido.
// Es arte de Nintendo/Game Freak: public/maps/ está en .gitignore y NO se sube al repo; cada copia
// del juego lo genera en local. Sin estas imágenes el juego usa el mapa de tiles CC0.
//
//   node tools/fetch-maps.js
//
// Sin dependencias: decodifica y codifica PNG con zlib de Node.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'maps');
const SRC = 'https://raw.githubusercontent.com/pret/pokeheartgold/master/files/application/pokegear/map/pgmap_gra';
// Recorte de cada región dentro del mapa completo (píxeles nativos). Debe coincidir con
// REAL_MAPS en public/js/regionmap.js, que coloca ciudades y nodos sobre estas imágenes.
const CROPS = { johto: [0, 8, 236, 152], kanto: [190, 24, 186, 124] };
const SCALE = 6;

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

// --- PNG mínimo: decodifica imágenes indexadas (1/2/4/8 bits) a una matriz de índices ---
function decodeIndexed(buf) {
  let pos = 8, ihdr, plte = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const { w, h, depth, color } = ihdr;
  if (color !== 3 && color !== 0) throw new Error('PNG no indexado: tipo ' + color);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = Math.ceil(w * depth / 8), bpp = Math.max(1, depth / 8);
  const lines = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = lines.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  const idx = new Uint8Array(w * h), per = 8 / depth, mask = (1 << depth) - 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const byte = lines[y * stride + Math.floor(x / per)];
    idx[y * w + x] = depth === 8 ? byte : (byte >> ((per - 1 - (x % per)) * depth)) & mask;
  }
  const pal = [];
  if (plte) for (let i = 0; i < plte.length; i += 3) pal.push([plte[i], plte[i + 1], plte[i + 2]]);
  return { w, h, idx, pal };
}

function encodeRGBA(w, h, rgba) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Mapa completo (Johto + Kanto): tiles de 8 bits con su paleta y pantalla NSCR de 64x64 entradas
async function fullMap() {
  const [tilesPng, nscr] = await Promise.all([get(`${SRC}/pgmap_gra_00000010.png`), get(`${SRC}/pgmap_gra_00000011.NSCR`)]);
  const tiles = decodeIndexed(tilesPng);
  const scr = nscr.subarray(0x24);   // cabecera RCSN (16) + bloque NRCS (20)
  const W = 512, H = 512, rgba = Buffer.alloc(W * H * 4), tpr = tiles.w / 8;
  for (let ty = 0; ty < 64; ty++) for (let tx = 0; tx < 64; tx++) {
    const e = scr.readUInt16LE((ty * 64 + tx) * 2);
    const t = e & 0x3ff, hf = e & 0x400, vf = e & 0x800;
    const sx = (t % tpr) * 8, sy = Math.floor(t / tpr) * 8;
    if (sy >= tiles.h) continue;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const col = tiles.pal[tiles.idx[(sy + (vf ? 7 - y : y)) * tiles.w + sx + (hf ? 7 - x : x)]];
      if (!col) continue;
      const o = ((ty * 8 + y) * W + tx * 8 + x) * 4;
      rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
    }
  }
  return { W, rgba };
}

// Recorta y amplía (vecino más próximo)
function cropScale({ W, rgba }, [x0, y0, cw, ch], k) {
  const out = Buffer.alloc(cw * k * ch * k * 4);
  for (let y = 0; y < ch * k; y++) for (let x = 0; x < cw * k; x++) {
    const s = ((y0 + Math.floor(y / k)) * W + x0 + Math.floor(x / k)) * 4;
    rgba.copy(out, (y * cw * k + x) * 4, s, s + 4);
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const full = await fullMap();
  for (const [name, crop] of Object.entries(CROPS)) {
    fs.writeFileSync(path.join(OUT, name + '.png'), encodeRGBA(crop[2] * SCALE, crop[3] * SCALE, cropScale(full, crop, SCALE)));
    console.log(`public/maps/${name}.png ${crop[2] * SCALE}x${crop[3] * SCALE}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
