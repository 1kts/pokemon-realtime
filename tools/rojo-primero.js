// Rojo primero: un test nuevo o cambiado tiene que fallar con el código de antes. Si también pasa ahí, no prueba
// nada de lo que trae la subida (o el fallo que dice cazar ya estaba cazado) y es complaciente.
//   node tools/rojo-primero.js <commit base> <commit nuevo> [rama destino]
// Para cada tests/e2e/*.e2e.js y tools/*-test.js nuevo o cambiado entre base y nuevo, monta en una carpeta temporal
// el código del commit base (public/, server/…) con los tests y las herramientas del nuevo (tests/ y tools/, para
// que el arnés sea el mismo) y pasa ese test: tiene que fallar. Lo pasa el CI en cada push (job rojo-primero).
// En el mensaje de un commit que toca el test:
//   Sin-rojo: <motivo>       no se comprueba (p. ej. un test que solo se ordena, o cambia de nombre)
//   Rojo-con: <id> [<id>…]   se comprueba contra el código de antes con esas mutaciones de tests/mutaciones.js puestas
//                            (para los tests que se endurecen sin que cambie el juego: tienen que cazarlas)
// A main no se le aplica (lo que llega ya pasó por aquí en develop). Un fallo de la propia herramienta (git, una
// carpeta) avisa y no para el CI: solo lo para un test que pasa con el código de antes.
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { linkModules, applyMutation, runTest, loadCatalog, tmpDir, rm } = require('./mutar.js');

const ROOT = path.join(__dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const ARGS = { 'tools/sim-test.js': '60' };   // (como en npm test)
const warn = msg => { console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : ''}rojo-primero: ${msg}`); process.exit(0); };

// La carpeta: el código de `base` y, encima, tests/ y tools/ de `head`
function buildTree(base, head) {
  const dir = tmpDir('rojo');
  execSync(`git archive ${base} | tar -x -C "${dir}"`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 30 });
  for (const d of ['tests', 'tools']) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
  execSync(`git archive ${head} tests tools | tar -x -C "${dir}"`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 30 });
  linkModules(dir);
  return dir;
}

async function main() {
  let [base, head, ref = ''] = process.argv.slice(2);
  if (!head) { console.log('Uso: node tools/rojo-primero.js <base> <nuevo> [rama]'); process.exit(2); }
  if (ref.replace('refs/heads/', '') === 'main') { console.log('Subida a main: rojo primero ya se comprobó en develop.'); return; }
  try {
    if (!base || /^0+$/.test(base)) base = git('merge-base', head, 'origin/develop');
    base = git('rev-parse', base + '^{commit}'); head = git('rev-parse', head + '^{commit}');
  } catch (e) { return warn(`sin base con la que comparar (${String(e.message).split('\n')[0]}): no se comprueba`); }
  if (base === head) return;
  const changed = git('diff', '--name-only', '--diff-filter=AM', `${base}..${head}`).split('\n')
    .filter(f => /^tests\/e2e\/[^/]+\.e2e\.js$|^tools\/[^/]+-test\.js$/.test(f));
  if (!changed.length) { console.log('Rojo primero: la subida no trae tests nuevos ni cambiados.'); return; }

  // Lo que dicen los commits que tocan cada test
  const plan = changed.map(f => {
    const msgs = git('log', '--format=%B%x00', `${base}..${head}`, '--', f);
    const skip = (msgs.match(/^Sin-rojo:\s*(\S.*)$/mi) || [])[1];
    const muts = [...msgs.matchAll(/^Rojo-con:\s*(.+)$/gmi)].flatMap(m => m[1].split(/[\s,]+/).filter(Boolean));
    return { f, skip, muts: [...new Set(muts)] };
  });
  for (const p of plan.filter(p => p.skip)) console.log(`- ${p.f}: no se comprueba (Sin-rojo: ${p.skip})`);
  const todo = plan.filter(p => !p.skip);
  if (!todo.length) return;

  const bad = [];
  for (const p of todo) {
    let dir;
    try {
      dir = buildTree(base, head);
      // (las mutaciones, del catálogo del commit nuevo)
      const catalog = p.muts.length ? loadCatalog(path.join(dir, 'tests', 'mutaciones.js')) : [];
      const muts = p.muts.map(id => catalog.find(m => m.id === id) || id);
      const unknown = muts.filter(m => typeof m === 'string');
      if (unknown.length) { bad.push(`${p.f}: «Rojo-con» nombra mutaciones que no existen: ${unknown.join(', ')}`); continue; }
      for (const m of muts) applyMutation(dir, m);
      const test = ARGS[p.f] ? `${p.f} ${ARGS[p.f]}` : p.f;
      const what = muts.length ? `el código de antes con ${muts.map(m => m.id).join(', ')}` : 'el código de antes';
      console.log(`Pasando ${p.f} con ${what}…`);
      const r = await runTest(dir, test);
      if (r.ok) bad.push(`${p.f} pasa también con ${what} (${base.slice(0, 7)}): no comprueba nada de lo que cambia`);
      else console.log(`✓ ${p.f}: falla con ${what}, como debe (${r.why.slice(0, 160)})`);
    } catch (e) {
      // (una mutación que ya no se aplica sobre el código de antes es culpa de quien la nombra: se dice)
      if (/el texto a cambiar sale/.test(e.message)) bad.push(`${p.f}: ${e.message}`);
      else warn(`no se pudo comprobar ${p.f} (${String(e.message).split('\n')[0]})`);
    } finally { if (dir) rm(dir); }
  }
  if (bad.length) {
    console.log(`✗ Rojo primero:\n  ${bad.join('\n  ')}\n\n` +
      '  Un test nuevo tiene que fallar sin el cambio que prueba. Si endurece un test sin cambiar el juego, di qué fallo\n' +
      '  caza con «Rojo-con: <id de tests/mutaciones.js>» en el mensaje del commit; si de verdad no aplica (solo se\n' +
      '  ordena o se renombra), «Sin-rojo: motivo».');
    process.exit(1);
  }
}

main().catch(e => warn(`error de la herramienta: ${e.message}`));
