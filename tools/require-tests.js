// ¿Trae tests lo que se va a subir? Lo usan el hook de pre-push (.githooks/pre-push) y el CI.
//   node tools/require-tests.js <commit base> <commit nuevo> [rama destino]
// Reglas, sobre los commits entre base y nuevo:
//   - Una novedad para el jugador (un punto 'nuevo' añadido en public/changelog.js) necesita un test
//     e2e nuevo o cambiado en tests/e2e/ (el juego de verdad en un navegador: tools/e2e.js).
//   - Cualquier cambio de código del juego (server/, public/js/, public/*.js) necesita algún test
//     nuevo o cambiado (tests/e2e/ o tools/*-test.js).
// Para lo que de verdad no se puede probar, una línea en el mensaje de algún commit:
//   Sin-e2e: <motivo>      Sin-tests: <motivo>
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

const problems = [];
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
    '  «Sin-e2e: motivo» o «Sin-tests: motivo».');
  process.exit(1);
}
const notes = [why('Sin-e2e') && `Sin-e2e: ${why('Sin-e2e')}`, why('Sin-tests') && `Sin-tests: ${why('Sin-tests')}`].filter(Boolean);
console.log(`Tests: ${added.length} novedad(es), ${e2e.length} test(s) e2e y ${anyTest.length} archivo(s) de tests en la subida.${notes.length ? ' Excepciones: ' + notes.join(' · ') : ''}`);
