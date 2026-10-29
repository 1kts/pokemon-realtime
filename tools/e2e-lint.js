// Vigila que los e2e usen el juego como un jugador y comprueben lo que ve (ver .claude/skills/tests/SKILL.md).
//   node tools/e2e-lint.js                 (en npm test; compara con lo que hay en develop)
//   node tools/e2e-lint.js --base <commit> (el hook de pre-push y el CI: con lo que había antes de la subida)
// Lo que cuenta, por archivo (tests/e2e/*.e2e.js):
//   atajos    `.click()` dentro de page.eval (llega aunque algo tape el botón), `ui.show('…')` (llega a una
//             pantalla sin pasar por sus botones) y `dispatchEvent(new KeyboardEvent` (teclas inventadas)
//   directos  otras llamadas al juego por dentro: `__app.net.send(…)` (mandar al servidor lo que haría un botón),
//             `__app.ui.algo(…)`, eventos de puntero o ratón inventados y `.click()` sueltos
//   appEnOk   un ok() cuya condición mira `__app` (el estado interno) en vez de lo que se ve
//   okVacio   ok(true, …) que no va justo después de esperar algo visible (await page.waitSee(…)): su mensaje
//             promete algo que nadie ha comprobado
// Un caso justificado lleva en su línea (o en la de antes) `// atajo: motivo` (un motivo de verdad, que se revisa).
// Reglas:
//   - un archivo nuevo no puede tener ninguno sin justificar; uno cambiado no puede tener más que antes
//   - el total sin justificar de cada cosa no puede crecer: el tope está en tests/e2e/lint-base.json, solo baja y
//     se ajusta solo cuando hay menos (súbelo con el archivo cambiado: el CI compara con el de antes)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'tests', 'e2e');
const BASE_FILE = path.join(DIR, 'lint-base.json');
const KINDS = { atajos: 'atajos', directos: 'llamadas directas al juego', appEnOk: 'ok() que miran __app', okVacio: 'ok(true) sin esperar algo visible' };
const SHORT = [/\.click\(\);?\s*true/, /ui\.show\('/, /dispatchEvent\(new KeyboardEvent/];
const DIRECT = [/__app\.net\.send\(/, /__app\.ui\.(?!show\()\w+\(/, /dispatchEvent\(new (Pointer|Mouse|Touch)Event/, /\.click\(\)(?!;?\s*true)/];
const justified = (lines, i) => [lines[i], lines[i - 1] || ''].some(l => /\/\/ atajo: .{6,}/.test(l));

// Las llamadas ok(…) de un archivo: dónde empiezan y su condición (el primer argumento), saltando cadenas y plantillas
function okCalls(src) {
  const out = [];
  const re = /(^|[^\w.$])ok\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0, comma = -1;
    const stack = [];   // dentro de qué estamos: ' " ` o { de ${}
    for (; i < src.length; i++) {
      const c = src[i], top = stack[stack.length - 1];
      if (top === "'" || top === '"') { if (c === '\\') i++; else if (c === top) stack.pop(); continue; }
      if (top === '`') { if (c === '\\') i++; else if (c === '`') stack.pop(); else if (c === '$' && src[i + 1] === '{') { stack.push('{'); i++; } continue; }
      if (c === "'" || c === '"' || c === '`') { stack.push(c); continue; }
      if (c === '{' && top === '{') { stack.push('{'); continue; }
      if (c === '}' && top === '{') { stack.pop(); continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') { if (!depth) break; depth--; }
      else if (c === ',' && !depth && comma < 0 && !stack.length) comma = i;
    }
    const start = m.index + m[0].length;
    out.push({ at: m.index + m[1].length, cond: src.slice(start, comma < 0 ? i : comma).trim() });
  }
  return out;
}

function count(src) {
  const lines = src.split('\n');
  const lineOf = pos => src.slice(0, pos).split('\n').length - 1;
  const n = { atajos: 0, directos: 0, appEnOk: 0, okVacio: 0 }, where = { atajos: [], directos: [], appEnOk: [], okVacio: [] };
  const add = (k, i) => { n[k]++; where[k].push(i + 1); };
  lines.forEach((l, i) => {
    if (/^\s*\/\//.test(l) || justified(lines, i)) return;
    for (const re of SHORT) if (re.test(l)) add('atajos', i);
    for (const re of DIRECT) if (re.test(l)) add('directos', i);
  });
  for (const c of okCalls(src)) {
    const i = lineOf(c.at);
    if (justified(lines, i)) continue;
    if (/__app/.test(c.cond)) add('appEnOk', i);
    if (c.cond === 'true') {
      // La sentencia de antes (sin líneas vacías ni comentarios) tiene que ser una espera de algo visible
      let j = i - 1;
      while (j >= 0 && (/^\s*$/.test(lines[j]) || /^\s*\/\//.test(lines[j]))) j--;
      while (j > 0 && !/^\s*(await|const|let|if|for|ok\()/.test(lines[j])) j--;
      const before = (lines[j] || '') + (lines[i].slice(0, lines[i].indexOf('ok(')));
      if (!/await page\.(waitSee|see)\(/.test(before)) add('okVacio', i);
    }
  }
  return { n, where };
}

const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
function baseCommit() {
  const i = process.argv.indexOf('--base');
  if (i > 0 && process.argv[i + 1] && !/^0+$/.test(process.argv[i + 1])) return git('rev-parse', '--verify', '-q', process.argv[i + 1] + '^{commit}');
  for (const ref of ['origin/develop', 'origin/main']) { const b = git('merge-base', 'HEAD', ref); if (b) return b; }
  return git('rev-parse', 'HEAD');
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.e2e.js')).sort();
const base = baseCommit();
const problems = [], total = { atajos: 0, directos: 0, appEnOk: 0, okVacio: 0 }, byFile = [];
for (const f of files) {
  const { n, where } = count(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const k of Object.keys(total)) total[k] += n[k];
  byFile.push([f, n]);
  if (!base) continue;
  const old = git('show', `${base}:tests/e2e/${f}`);
  const was = old === null ? null : count(old).n;
  for (const k of Object.keys(KINDS)) {
    if (was === null && n[k]) problems.push(`${f} es nuevo y tiene ${n[k]} ${KINDS[k]} (líneas ${where[k].slice(0, 8).join(', ')})`);
    else if (was && n[k] > was[k]) problems.push(`${f} pasa de ${was[k]} a ${n[k]} ${KINDS[k]} (líneas ${where[k].slice(0, 8).join(', ')})`);
  }
}

// Topes del total: solo bajan (y bajan solos)
let tope = {};
try { tope = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch {}
const oldTope = base && (() => { try { return JSON.parse(git('show', `${base}:tests/e2e/lint-base.json`)); } catch { return null; } })();
for (const k of Object.keys(KINDS)) {
  if (oldTope && oldTope[k] !== undefined && tope[k] > oldTope[k]) problems.push(`tests/e2e/lint-base.json sube el tope de ${KINDS[k]} (${oldTope[k]} → ${tope[k]}): los topes solo bajan`);
  if (tope[k] === undefined) tope[k] = total[k];
  if (total[k] > tope[k]) {
    const top = byFile.filter(([, n]) => n[k]).sort((a, b) => b[1][k] - a[1][k]).slice(0, 6).map(([f, n]) => `${n[k]} ${f}`).join(', ');
    problems.push(`hay ${total[k]} ${KINDS[k]} sin justificar (tope ${tope[k]}): ${top}`);
  }
}
const lowered = Object.keys(KINDS).filter(k => total[k] < tope[k]);
if (!problems.length && (lowered.length || !fs.existsSync(BASE_FILE))) {
  for (const k of lowered) tope[k] = total[k];
  fs.writeFileSync(BASE_FILE, JSON.stringify({ ...tope, nota: 'Topes de tools/e2e-lint.js: solo bajan (los ajusta el lint solo)' }, null, 1) + '\n');
  if (lowered.length) console.log(`e2e-lint: bajan los topes de ${lowered.map(k => KINDS[k]).join(', ')} (tests/e2e/lint-base.json: súbelo en el commit)`);
}
if (problems.length) {
  console.log(`✗ Tests e2e complacientes:\n  ${problems.join('\n  ')}\n` +
    '  Pulsa con page.tap o page.click, comprueba lo que se ve con page.see, page.title o page.read, y escribe\n' +
    '  ok(true, …) solo justo después de await page.waitSee(…). Si de verdad hace falta, «// atajo: motivo» (ver la skill tests).');
  process.exit(1);
}
console.log(`e2e: ${Object.keys(KINDS).map(k => `${total[k]} ${KINDS[k]}`).join(', ')} (sin justificar; los topes solo bajan)`);
