// Imágenes grandes de los Pokémon de PokeAPI/sprites: ilustración oficial (avatar de maestría), render
// 3D de Pokémon HOME y animación de Showdown (Pokédex y capturas). Se piden la primera vez y se guardan
// en disco (ART_DIR, por defecto junto a la base de datos), así el navegador solo carga imágenes de este
// servidor (la CSP no cambia). Solo especies del juego, normal o shiny.
const fs = require('fs');
const path = require('path');
const https = require('https');
const D = require('../public/data.js');

const DIR = process.env.ART_DIR || path.join(path.dirname(process.env.DB_FILE || path.join(__dirname, '..', 'data', 'arena.db')), 'art');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/';
// ruta pública → carpeta de PokeAPI, extensión y cabecera del archivo
const KINDS = {
  art: { dir: 'official-artwork/', ext: 'png', type: 'image/png', magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  home: { dir: 'home/', ext: 'png', type: 'image/png', magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  anim: { dir: 'showdown/', ext: 'gif', type: 'image/gif', magic: Buffer.from('GIF8') },
};
const MAX = 2 * 1024 * 1024;
const pending = new Map();   // una sola descarga por imagen aunque la pidan varios a la vez

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = []; let size = 0;
      res.on('data', c => { size += c.length; if (size > MAX) { req.destroy(); reject(new Error('demasiado grande')); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function get(kind, dex, shiny) {
  const k = KINDS[kind];
  const name = (kind === 'art' ? '' : kind + '-') + (shiny ? 'shiny-' : '') + dex + '.' + k.ext;
  const file = path.join(DIR, name);
  if (fs.existsSync(file)) return Promise.resolve(fs.readFileSync(file));
  if (!pending.has(name)) {
    pending.set(name, download(BASE + k.dir + (shiny ? 'shiny/' : '') + dex + '.' + k.ext).then(buf => {
      if (!buf.subarray(0, 4).equals(k.magic)) throw new Error('formato inesperado');
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(file + '.tmp', buf);
      fs.renameSync(file + '.tmp', file);
      return buf;
    }).finally(() => pending.delete(name)));
  }
  return pending.get(name);
}

// /art/25.png, /home/shiny/25.png, /anim/25.gif… Devuelve true si la ruta era suya.
function handle(url, res) {
  const m = /^\/(art|home|anim)\/(shiny\/)?(\d{1,4})\.(png|gif)$/.exec(url);
  if (!m || m[4] !== KINDS[m[1]].ext) return false;
  const dex = +m[3];
  if (!D.SPECIES[dex]) { res.writeHead(404); res.end(); return true; }
  get(m[1], dex, !!m[2]).then(buf => {
    res.writeHead(200, { 'Content-Type': KINDS[m[1]].type, 'Cache-Control': 'max-age=604800' });
    res.end(buf);
  }, () => { res.writeHead(404); res.end(); });
  return true;
}

module.exports = { handle };
