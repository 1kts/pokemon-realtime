// Pruebas de mutación: ¿cazan los tests los fallos que notaría un jugador? Cada mutación de tests/mutaciones.js
// es un cambio pequeño del juego (un botón que no hace nada, cobrar mal, no restar PS…) con los tests que
// deberían cazarlo. Para cada una se hace una copia del proyecto (en una carpeta temporal: el tuyo no se toca),
// se aplica el cambio y se pasan solo esos tests: si alguno falla, está «cazada»; si todos pasan, «escapada»
// (los tests no miran lo que dicen mirar).
//   node tools/mutar.js                  todas, y guarda la nota en tests/mutaciones-nota.json
//   node tools/mutar.js id1 id2          solo esas (la nota no se toca)
//   node tools/mutar.js --comprobar      todas, y falla si cazan menos que la nota guardada (el CI, cada noche)
//   node tools/mutar.js --lista          sin pasar tests: que cada mutación se pueda aplicar, que sus tests
//                                        existan y que esté en la nota (rápido: va en npm test)
//   MUT_JOBS=n     cuántas a la vez (por defecto 2; cada e2e va con E2E_JOBS=1)
//   MUT_SHARD=i/n  solo el trozo i de n (el CI las reparte en varias máquinas); con --comprobar, compara solo ese trozo
//   MUT_SIN_LIMPIO=1   no pasa antes cada test sin mutar (por defecto sí: un test que ya falla sin mutar no caza nada)
// Antes de mutar, cada test se pasa una vez sobre la copia sin tocar: si ya falla ahí, sus mutaciones salen como
// «test roto» y no cuentan como cazadas (un test roto o inestable no caza nada, solo lo parece).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'tests', 'mutaciones.js');
const NOTE = path.join(ROOT, 'tests', 'mutaciones-nota.json');
// Lo que se copia de verdad (se puede cambiar sin tocar el original); lo demás (sprites, música…) se enlaza
const TEXT = /\.(js|mjs|cjs|css|html|json|md|webmanifest|txt|sh|yml)$|(^|\/)(\.githooks\/[^/]+|[^/.]+)$/;

// ---------- Copias del proyecto ----------
// Copia de lo que hay ahora en la carpeta (con lo que aún no está en un commit): el código, copiado; lo grande,
// con enlaces duros (o simbólicos si están en otro disco); node_modules, enlazado
function copyTree(dest, from = ROOT) {
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: from, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
  const dirs = new Set();
  for (const f of files) {
    const src = path.join(from, f), dst = path.join(dest, f);
    if (!fs.existsSync(src)) continue;   // borrado en la carpeta y aún en el índice
    const dir = path.dirname(dst);
    if (!dirs.has(dir)) { fs.mkdirSync(dir, { recursive: true }); dirs.add(dir); }
    if (TEXT.test(f) && fs.statSync(src).size < 4 << 20) { fs.copyFileSync(src, dst); continue; }
    try { fs.linkSync(src, dst); } catch { fs.symlinkSync(src, dst); }
  }
  linkModules(dest, from);
}
const linkModules = (dest, from = ROOT) => {
  const nm = path.join(from, 'node_modules');
  if (fs.existsSync(nm) && !fs.existsSync(path.join(dest, 'node_modules'))) fs.symlinkSync(nm, path.join(dest, 'node_modules'), 'dir');
};
const tmpDir = tag => fs.mkdtempSync(path.join(os.tmpdir(), `arena-${tag}-`));
const rm = d => { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {} };

// ---------- Catálogo ----------
function loadCatalog(file = CATALOG) {
  delete require.cache[require.resolve(file)];
  return require(file);
}
// Aplica una mutación en la copia: el texto a buscar tiene que estar una sola vez (si no, la mutación se ha
// quedado vieja con el código y hay que rehacerla)
function applyMutation(dir, m) {
  const f = path.join(dir, m.archivo);
  if (!fs.existsSync(f)) throw new Error(`${m.id}: no existe ${m.archivo}`);
  const src = fs.readFileSync(f, 'utf8');
  const n = src.split(m.buscar).length - 1;
  if (n !== 1) throw new Error(`${m.id}: en ${m.archivo} el texto a cambiar sale ${n} veces (tiene que salir 1): ${JSON.stringify(m.buscar.slice(0, 80))}`);
  fs.unlinkSync(f);   // (por si fuera un enlace: nunca se escribe en el original)
  fs.writeFileSync(f, src.replace(m.buscar, () => m.poner));
}

// ---------- Pasar tests ----------
// Un test es un e2e (tests/e2e/x.e2e.js) o un script de tools con sus argumentos ('tools/sim-test.js 20')
function runTest(dir, test, { timeout = 8 * 60e3 } = {}) {
  const [file, ...args] = test.split(/\s+/);
  const cmd = /\.e2e\.js$/.test(file) ? ['tools/e2e.js', file] : [file, ...args];
  return new Promise(resolve => {
    const env = { ...process.env, E2E_JOBS: '1', E2E_TIMES: '' };
    const p = spawn(process.execPath, ['--no-warnings', ...cmd], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '\n✗ más de 8 minutos: parado'; p.kill('SIGKILL'); }, timeout);
    p.on('close', code => {
      clearTimeout(timer);
      const why = out.split('\n').filter(l => /✗|Error|error:/.test(l)).slice(0, 3).map(l => l.trim()).join(' | ').slice(0, 300);
      resolve({ test, ok: code === 0, why });
    });
  });
}

async function pool(items, jobs, fn) {
  const queue = items.map((x, i) => [x, i]), out = new Array(items.length);
  const worker = async () => { while (queue.length) { const [x, i] = queue.shift(); out[i] = await fn(x); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, worker));
  return out;
}

// Una mutación: copia, cambio y sus tests (todos, aunque el primero ya la cace: así se sabe quién la caza)
async function mutate(m, broken) {
  const dir = tmpDir('mut');
  try {
    copyTree(dir);
    applyMutation(dir, m);
    const runs = [];
    for (const test of m.tests) runs.push(broken.has(test) ? { test, ok: true, broken: true } : await runTest(dir, test));
    const caught = runs.filter(r => !r.ok);
    const usable = runs.filter(r => !r.broken);
    const resultado = caught.length ? 'cazada' : usable.length ? 'escapada' : 'test roto';
    return { id: m.id, resultado, por: caught.map(r => r.test), motivo: caught.map(r => `${path.basename(r.test.split(' ')[0])}: ${r.why}`).join(' · ').slice(0, 400) };
  } catch (e) {
    return { id: m.id, resultado: 'rota', motivo: e.message };
  } finally { rm(dir); }
}

// Cada test, una vez, sin mutar: los que ya fallan así no cuentan
async function cleanRun(tests, jobs) {
  const dir = tmpDir('limpio');
  try {
    copyTree(dir);
    const res = await pool(tests, jobs, t => runTest(dir, t));
    return res.filter(r => !r.ok);
  } finally { rm(dir); }
}

function shardOf(list) {
  const s = String(process.env.MUT_SHARD || '').match(/^(\d+)\/(\d+)$/);
  return s ? list.filter((_, i) => i % +s[2] === +s[1] - 1) : list;
}

function readNote() { try { return JSON.parse(fs.readFileSync(NOTE, 'utf8')); } catch { return null; } }

// Sin pasar tests: el catálogo está bien hecho y la nota al día
function checkList() {
  const cat = loadCatalog(), note = readNote(), problems = [];
  const ids = new Set();
  const dir = tmpDir('lista');
  try {
    for (const m of cat) {
      if (!m.id || !/^[a-z0-9-]+$/.test(m.id)) problems.push(`id no válido: ${JSON.stringify(m.id)}`);
      if (ids.has(m.id)) problems.push(`id repetido: ${m.id}`);
      ids.add(m.id);
      if (!m.que || !m.archivo || typeof m.buscar !== 'string' || typeof m.poner !== 'string' || !Array.isArray(m.tests) || !m.tests.length) { problems.push(`${m.id}: le falta que, archivo, buscar, poner o tests`); continue; }
      if (m.buscar === m.poner) problems.push(`${m.id}: buscar y poner son iguales`);
      for (const t of m.tests) if (!fs.existsSync(path.join(ROOT, t.split(/\s+/)[0]))) problems.push(`${m.id}: no existe el test ${t}`);
      // (sobre una copia del archivo: que el texto esté una sola vez)
      const f = path.join(ROOT, m.archivo);
      if (!fs.existsSync(f)) { problems.push(`${m.id}: no existe ${m.archivo}`); continue; }
      const d = path.join(dir, m.id);
      fs.mkdirSync(path.join(d, path.dirname(m.archivo)), { recursive: true });
      fs.copyFileSync(f, path.join(d, m.archivo));
      try { applyMutation(d, m); } catch (e) { problems.push(e.message); }
    }
  } finally { rm(dir); }
  if (!note) problems.push('falta tests/mutaciones-nota.json: pásalas con node tools/mutar.js');
  else {
    const missing = cat.filter(m => !note.mutaciones || !note.mutaciones[m.id]).map(m => m.id);
    if (missing.length) problems.push(`sin pasar todavía (no están en la nota): ${missing.join(', ')}. Pásalas con node tools/mutar.js ${missing.join(' ')} --nota`);
  }
  if (problems.length) { console.log(`✗ Mutaciones (tests/mutaciones.js):\n  ${problems.join('\n  ')}`); process.exit(1); }
  console.log(`mutaciones: ${cat.length} en el catálogo; nota: ${note.cazadas} de ${note.total} cazadas`);
}

// La nota: cuántas cazan los tests (y cuáles se escapan), para que no baje
function summarize(results, prev) {
  const mutaciones = { ...(prev && prev.mutaciones) };
  for (const r of results) mutaciones[r.id] = { resultado: r.resultado, ...(r.por.length ? { por: r.por } : {}), ...(r.motivo ? { motivo: r.motivo } : {}) };
  // (solo las que siguen en el catálogo)
  const cat = loadCatalog().map(m => m.id);
  for (const k of Object.keys(mutaciones)) if (!cat.includes(k)) delete mutaciones[k];
  const vals = Object.values(mutaciones);
  return { fecha: new Date().toISOString().slice(0, 10), cazadas: vals.filter(v => v.resultado === 'cazada').length, total: cat.length,
    escapadas: Object.keys(mutaciones).filter(k => mutaciones[k].resultado !== 'cazada'), mutaciones };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--lista')) return checkList();
  const check = args.includes('--comprobar'), writeNote = args.includes('--nota') || (!check && !args.some(a => !a.startsWith('--')));
  const cat = loadCatalog();
  const wanted = args.filter(a => !a.startsWith('--'));
  for (const w of wanted) if (!cat.some(m => m.id === w)) { console.log(`✗ No hay ninguna mutación «${w}» en tests/mutaciones.js`); process.exit(2); }
  const list = shardOf(wanted.length ? cat.filter(m => wanted.includes(m.id)) : cat);
  const jobs = Math.max(1, +process.env.MUT_JOBS || 2);
  const t0 = Date.now();

  let broken = new Set();
  if (!process.env.MUT_SIN_LIMPIO) {
    const tests = [...new Set(list.flatMap(m => m.tests))];
    console.log(`Pasando antes los ${tests.length} tests sin mutar…`);
    const bad = await cleanRun(tests, jobs);
    for (const b of bad) console.log(`  ✗ ${b.test} ya falla sin mutar: ${b.why}`);
    broken = new Set(bad.map(b => b.test));
  }
  console.log(`${list.length} mutaciones, ${jobs} a la vez…`);
  const results = await pool(list, jobs, async m => {
    const r = await mutate(m, broken);
    const mark = { cazada: '✓', escapada: '✗', 'test roto': '?', rota: '!' }[r.resultado];
    console.log(`${mark} ${r.id} — ${r.resultado}${r.por.length ? ' por ' + r.por.map(p => path.basename(p.split(' ')[0])).join(', ') : ''}${r.resultado === 'escapada' ? `: ${m.que}` : r.resultado !== 'cazada' ? `: ${r.motivo}` : ''}`);
    return r;
  });
  const n = results.filter(r => r.resultado === 'cazada').length;
  console.log(`\nNota: ${n} de ${results.length} cazadas (${Math.round((Date.now() - t0) / 60e3)} min)`);
  const esc = results.filter(r => r.resultado !== 'cazada');
  if (esc.length) console.log(`Se escapan: ${esc.map(r => r.id).join(', ')}`);

  const prev = readNote();
  if (writeNote) {
    const note = summarize(results, wanted.length ? prev : null);
    fs.writeFileSync(NOTE, JSON.stringify(note, null, 1) + '\n');
    console.log(`Guardada en tests/mutaciones-nota.json: ${note.cazadas} de ${note.total}`);
  }
  if (check) {
    // Las que la nota da por cazadas tienen que seguir cazándose (las rotas o con el test roto, también cuentan como perdidas)
    const lost = results.filter(r => r.resultado !== 'cazada' && prev && prev.mutaciones && prev.mutaciones[r.id] && prev.mutaciones[r.id].resultado === 'cazada');
    const won = results.filter(r => r.resultado === 'cazada' && !(prev && prev.mutaciones && prev.mutaciones[r.id] && prev.mutaciones[r.id].resultado === 'cazada'));
    if (won.length) console.log(`Ahora se cazan también: ${won.map(r => r.id).join(', ')} (actualiza la nota: node tools/mutar.js ${won.map(r => r.id).join(' ')} --nota)`);
    if (lost.length) {
      console.log(`✗ La nota de mutaciones baja: la nota guardada las daba por cazadas y ya no: ${lost.map(r => `${r.id} (${r.resultado}${r.motivo ? ': ' + r.motivo : ''})`).join('; ')}`);
      process.exit(1);
    }
    console.log('✓ La nota de mutaciones no baja');
  }
  process.exit(0);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { copyTree, linkModules, applyMutation, runTest, loadCatalog, tmpDir, rm, pool };
