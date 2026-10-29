// ¿Trae tests lo que se va a subir? Lo usan el hook de pre-push (.githooks/pre-push) y el CI.
//   node tools/require-tests.js <commit base> <commit nuevo> [rama destino]
// Reglas, sobre los commits entre base y nuevo:
//   - Una novedad para el jugador (un punto 'nuevo' añadido en public/changelog.js) necesita un test
//     e2e nuevo o cambiado en tests/e2e/ (el juego de verdad en un navegador: tools/e2e.js).
//   - Cualquier cambio de código del juego (server/, public/js/, public/*.js) necesita algún test
//     nuevo o cambiado (tests/e2e/ o tools/*-test.js).
//   - Cada novedad necesita también una mutación nueva en tests/mutaciones.js (la forma más sencilla de
//     romperla, con el e2e que lo caza: ver tools/mutar.js).
//   - La nota de mutaciones (tests/mutaciones-nota.json) no baja: las que estaban cazadas lo siguen estando.
//     (Que la nota diga la verdad lo comprueba cada noche el CI pasándolas todas: job mutaciones.)
// Para lo que de verdad no se puede probar, una línea en el mensaje de algún commit:
//   Sin-e2e: <motivo>      Sin-tests: <motivo>      Sin-mutación: <motivo>
// A main no se le aplican: lo que llega a main ya pasó por aquí al subir a develop.
const { execFileSync } = require('child_process');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
let [base, head, ref = ''] = process.argv.slice(2);
if (!head) { console.log('Uso: node tools/require-tests.js <base> <nuevo> [rama]'); process.exit(2); }
if (ref.replace('refs/heads/', '') === 'main') { console.log('Subida a main: las reglas de tests ya se comprobaron en develop.'); process.exit(0); }
// Rama nueva (sin base en el remoto): se compara con lo que ya hay en develop
if (!base || /^0+$/.test(base)) {
  try { base = git('merge-base', head, 'origin/develop'); } catch { console.log('Sin base con la que comparar: no se comprueba.'); process.exit(0); }
}
if (base === head) process.exit(0);

const files = git('diff', '--name-only', `${base}..${head}`).split('\n').filter(Boolean);
const code = files.filter(f => /^(server\/[^/]+\.js|public\/js\/[^/]+\.js|public\/(data|shared|hitbox|regions)\.js)$/.test(f));
const e2e = files.filter(f => /^tests\/e2e\/.+\.e2e\.js$/.test(f));
const anyTest = [...e2e, ...files.filter(f => /^tools\/[^/]+-test\.js$/.test(f))];
const added = git('diff', `${base}..${head}`, '--', 'public/changelog.js').split('\n').filter(l => /^\+.*\[\s*'nuevo'\s*,/.test(l));
const msgs = git('log', '--format=%B', `${base}..${head}`);
const why = key => (msgs.match(new RegExp(`^${key}:\\s*(\\S.*)$`, 'mi')) || [])[1];

// Mutaciones nuevas en el catálogo (sus id) y la nota de antes y de ahora
const ids = src => new Set(src ? [...src.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map(m => m[1]) : []);
const at = (rev, f) => { try { return execFileSync('git', ['show', `${rev}:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const oldIds = ids(at(base, 'tests/mutaciones.js')), newMuts = [...ids(at(head, 'tests/mutaciones.js'))].filter(id => !oldIds.has(id));
const note = rev => { try { return JSON.parse(at(rev, 'tests/mutaciones-nota.json')); } catch { return null; } };
const noteBefore = note(base), noteNow = note(head);

const problems = [];
if (added.length && newMuts.length < added.length && !why('Sin-mutación')) {
  problems.push(`Esta subida trae ${added.length} novedad(es) y ${newMuts.length} mutación(es) nueva(s) en tests/mutaciones.js.\n` +
    `  Añade por cada novedad una mutación (la forma más sencilla de romperla, con el e2e que lo caza) y pásala:\n` +
    `  node tools/mutar.js <id> --nota (ver la skill tests).`);
}
if (noteBefore && noteBefore.mutaciones) {
  const lost = Object.entries(noteBefore.mutaciones).filter(([id, v]) => v.resultado === 'cazada' && noteNow && noteNow.mutaciones && noteNow.mutaciones[id] && noteNow.mutaciones[id].resultado !== 'cazada').map(([id]) => id);
  const gone = Object.entries(noteBefore.mutaciones).filter(([id, v]) => v.resultado === 'cazada' && !(noteNow && noteNow.mutaciones && noteNow.mutaciones[id])).map(([id]) => id);
  if (!noteNow) problems.push('Se ha borrado tests/mutaciones-nota.json: la nota de mutaciones no puede desaparecer.');
  else if (noteNow.cazadas < noteBefore.cazadas || lost.length || (gone.length && !why('Sin-mutación')))
    problems.push(`La nota de mutaciones baja (${noteBefore.cazadas} → ${noteNow.cazadas} cazadas${lost.length ? `; se escapan ahora: ${lost.join(', ')}` : ''}${gone.length ? `; quitadas del catálogo: ${gone.join(', ')}` : ''}).\n` +
      '  Una mutación cazada tiene que seguir cazándose: arregla el test que la cazaba (y si se quita una del catálogo,\n' +
      '  explica por qué con «Sin-mutación: motivo»).');
}
if (added.length && !e2e.length && !why('Sin-e2e')) {
  problems.push(`Esta subida trae ${added.length} novedad(es) para el jugador (puntos 'nuevo' en public/changelog.js) y ningún test e2e.\n` +
    `  Añade o amplía un test en tests/e2e/*.e2e.js que use la novedad como lo haría un jugador (ver tests/e2e/README.md).`);
}
if (code.length && !anyTest.length && !why('Sin-tests')) {
  problems.push(`Cambia código del juego (${code.slice(0, 4).join(', ')}${code.length > 4 ? '…' : ''}) y ningún test.\n` +
    '  Añade o cambia un test en tests/e2e/ o en tools/*-test.js que compruebe ese cambio.');
}
if (problems.length) {
  console.log(`✗ Faltan tests (${base.slice(0, 7)}..${head.slice(0, 7)}):\n\n  ${problems.join('\n\n  ')}\n\n` +
    '  Si de verdad no se puede probar, explica por qué en el mensaje de un commit con una línea\n' +
    '  «Sin-e2e: motivo», «Sin-tests: motivo» o «Sin-mutación: motivo».');
  process.exit(1);
}
const notes = ['Sin-e2e', 'Sin-tests', 'Sin-mutación'].filter(k => why(k)).map(k => `${k}: ${why(k)}`);
console.log(`Tests: ${added.length} novedad(es), ${e2e.length} test(s) e2e, ${anyTest.length} archivo(s) de tests y ${newMuts.length} mutación(es) nueva(s) en la subida` +
  `${noteNow ? `; nota de mutaciones ${noteNow.cazadas}/${noteNow.total}` : ''}.${notes.length ? ' Excepciones: ' + notes.join(' · ') : ''}`);
