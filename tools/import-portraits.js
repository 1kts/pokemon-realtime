// Descarga de SpriteCollab el retrato "Normal" (40×40, la cara de cerca) de cada especie de
// public/data.js a public/portraits/{nº de Pokédex}.png, y escribe en CREDITS.md la tabla de sus
// artistas (sección "Retratos", que tools/legal.js lleva a las páginas legales). Misma licencia que
// los sprites: CC BY-NC 4.0, con atribución.
//   node tools/import-portraits.js            descarga lo que falte y regenera los créditos
//   node tools/import-portraits.js --force    vuelve a descargarlo todo
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const Data = require(path.join(ROOT, 'public/data.js'));
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const OUT = path.join(ROOT, 'public/portraits');
const force = process.argv.includes('--force');
const START = '<!-- retratos:inicio (lo rellena tools/import-portraits.js) -->', END = '<!-- retratos:fin -->';

async function get(url, type = 'buffer') {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status);
      return type === 'json' ? r.json() : type === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === 3) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

(async () => {
  const tracker = await get(RAW + 'tracker.json', 'json');
  // credit_names.txt: Nombre \t Discord \t Contacto (una línea por artista)
  const names = {};
  for (const line of (await get(RAW + 'credit_names.txt', 'text')).split('\n').slice(1)) {
    const [name, id, contact] = line.split('\t');
    if (id) names[id.trim()] = { name: (name || '').trim() || id.trim(), contact: (contact || '').trim() };
  }
  fs.mkdirSync(OUT, { recursive: true });
  const byArtist = new Map();
  const dexes = Object.keys(Data.SPECIES).map(Number).sort((a, b) => a - b);
  let got = 0, missing = [];
  for (const dex of dexes) {
    const key = String(dex).padStart(4, '0'), t = tracker[key];
    // portrait_files: { Normal: <bloqueado>, ... }; basta con que exista la clave
    if (!t || !('Normal' in (t.portrait_files || {}))) { missing.push(dex); continue; }
    const file = path.join(OUT, dex + '.png');
    if (force || !fs.existsSync(file)) {
      const png = await get(`${RAW}portrait/${key}/Normal.png`);
      if (!png) { missing.push(dex); continue; }
      fs.writeFileSync(file, png);
    }
    got++;
    const id = t.portrait_credit && t.portrait_credit.primary;
    if (id) {
      const a = names[id] || { name: id, contact: '' };
      if (!byArtist.has(a.name)) byArtist.set(a.name, { contact: a.contact, dex: [] });
      byArtist.get(a.name).dex.push(dex);
    }
  }
  // Créditos: tabla por artista entre las marcas de CREDITS.md
  const rows = [...byArtist.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }))
    .map(([name, a]) => `| ${name.replace(/\|/g, '/')} | ${a.contact.replace(/\|/g, '/')} | ${a.dex.join(', ')} |`);
  const section = `${START}
## Retratos

Los retratos de la cara de cada Pokémon (\`public/portraits/{nº de Pokédex}.png\`, los avatares de
retrato de Tesoros) vienen de [SpriteCollab](https://github.com/PMDCollab/SpriteCollab).
Licencia [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): uso **no comercial**
y con atribución a sus artistas.

| Artista | Contacto | Retratos (nº de Pokédex) |
|---|---|---|
${rows.join('\n')}
${END}`;
  const credits = path.join(ROOT, 'CREDITS.md');
  let src = fs.readFileSync(credits, 'utf8');
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i >= 0 && j > i) src = src.slice(0, i) + section + src.slice(j + END.length);
  else src = src.replace('\n## Marca', `\n${section}\n\n## Marca`);
  fs.writeFileSync(credits, src);
  console.log(`${got} retratos · ${byArtist.size} artistas${missing.length ? ` · sin retrato: ${missing.join(', ')}` : ''}`);
})().catch(e => { console.error(e); process.exit(1); });
