// Vigila que los e2e usen el juego como un jugador: pulsar con page.click (un clic de ratón de verdad, que
// falla si el botón está tapado) y navegar con los botones, no con atajos que se saltan lo que se prueba.
//   node tools/e2e-lint.js
// Atajos que cuenta: `.click()` dentro de page.eval (llega aunque algo tape el botón), `ui.show('…')` (llega a
// una pantalla sin pasar por sus botones) y `dispatchEvent(new KeyboardEvent` (teclas inventadas). Un atajo
// justificado lleva en su línea (o en la de antes) un comentario `// atajo: motivo`. Los que había antes de
// esta regla se cuentan en BASE: el total sin justificar no puede crecer (y conviene que baje).
const fs = require('fs');
const path = require('path');

const BASE = 119;   // atajos sin justificar al empezar (2026-10-28); bájalo cuando quites alguno
const dir = path.join(__dirname, '..', 'tests', 'e2e');
const PATTERNS = [[/\.click\(\);?\s*true/, '.click() dentro de eval'], [/ui\.show\('/, "ui.show('…')"], [/dispatchEvent\(new KeyboardEvent/, 'tecla inventada']];

let total = 0;
const byFile = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.e2e.js'))) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  let n = 0;
  lines.forEach((l, i) => {
    if (!PATTERNS.some(([re]) => re.test(l))) return;
    if (/\/\/ atajo:/.test(l) || /\/\/ atajo:/.test(lines[i - 1] || '')) return;
    n += PATTERNS.filter(([re]) => re.test(l)).length;
  });
  if (n) byFile.push([n, f]);
  total += n;
}
if (total > BASE) {
  console.log(`✗ Los e2e tienen ${total} atajos sin justificar (como mucho ${BASE}):`);
  for (const [n, f] of byFile.sort((a, b) => b[0] - a[0]).slice(0, 8)) console.log(`  ${n}  ${f}`);
  console.log('  Pulsa con page.click (o realClick) y navega con los botones; si de verdad hace falta un atajo, ponle «// atajo: motivo».');
  process.exit(1);
}
console.log(`e2e: ${total} atajos sin justificar (tope ${BASE}${total < BASE ? `: puedes bajar BASE a ${total}` : ''})`);
