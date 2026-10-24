// Descarga a public/vendor/ lo que antes se cargaba de fuera (Three.js de jsDelivr y las fuentes de
// Google Fonts), para servirlo todo desde nuestro dominio: el navegador del jugador no se conecta a
// terceros (privacidad) y la CSP solo permite este servidor. Volver a ejecutarlo al cambiar de
// versión o de fuentes:
//   node tools/vendor.js
const fs = require('fs');
const path = require('path');

const THREE = '0.160.0';
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE}/`;
// Lo que importa el juego de three/addons (public/js); sus dependencias se siguen solas
const ADDONS = ['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js'];
const FONTS = 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800&family=Nunito:wght@500;600;700;800;900&display=swap';
const FONT_LICENSES = { Nunito: 'https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt',
  'M PLUS Rounded 1c': 'https://raw.githubusercontent.com/google/fonts/main/ofl/roundedmplus1c/OFL.txt' };
// Con un navegador moderno, Google Fonts sirve woff2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'public', 'vendor');

async function get(url, binary) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}
function write(rel, data) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, data);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  // ---------- Three.js ----------
  write('three/build/three.module.js', await get(CDN + 'build/three.module.js'));
  write('three/LICENSE', await get(CDN + 'LICENSE'));
  const seen = new Set(), queue = ADDONS.map(a => 'examples/jsm/' + a);
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const src = await get(CDN + rel);
    write('three/' + rel, src);
    // import … from './x.js' / '../shaders/y.js' (las de 'three' van por el importmap)
    for (const [, dep] of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), dep)));
  }
  console.log(`Three.js ${THREE}: three.module.js y ${seen.size} módulos de examples/jsm`);

  // ---------- Fuentes ----------
  let css = await get(FONTS);
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]))];
  let i = 0;
  for (const url of urls) {
    const name = `f${String(i++).padStart(3, '0')}${path.extname(new URL(url).pathname) || '.woff2'}`;
    write('fonts/' + name, await get(url, true));
    css = css.split(url).join(name);
  }
  write('fonts/fonts.css', `/* Nunito y M PLUS Rounded 1c (SIL Open Font License 1.1), descargadas de Google Fonts con tools/vendor.js */\n${css}`);
  for (const [fam, url] of Object.entries(FONT_LICENSES)) write(`fonts/OFL-${fam.replace(/\s+/g, '')}.txt`, await get(url));
  const size = urls.reduce((n, _, k) => n + fs.statSync(path.join(OUT, 'fonts', `f${String(k).padStart(3, '0')}.woff2`)).size, 0);
  console.log(`Fuentes: ${urls.length} archivos (${(size / 1e6).toFixed(1)} MB en total; el navegador solo baja los trozos que usa)`);
})().catch(e => { console.error(e.message); process.exit(1); });
