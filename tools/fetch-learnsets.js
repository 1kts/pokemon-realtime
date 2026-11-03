// Descarga de PokeAPI (https://pokeapi.co, datos abiertos) lo que cada especie aprende por nivel en los juegos (y, aparte,
// por MT) y genera public/learn.js, con solo los movimientos que existen en PokéArenas (tools/learn-map.js).
//
//   node tools/fetch-learnsets.js
//
// De cada especie, las listas de Ultrasol/Ultraluna (Gen 1-7); las que no salen allí, de Espada/Escudo o Escarlata/Púrpura.
const fs = require('fs');
const path = require('path');
const MAP = require('./learn-map.js');
const DEX = require('../public/dex.js');
const GROUPS = ['ultra-sun-ultra-moon', 'sword-shield', 'scarlet-violet'];
const ids = Object.keys(DEX).map(Number);

async function one(id) {
  for (let t = 0; ; t++) {
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon/' + id);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const by = {}, tm = {};
      for (const m of (await res.json()).moves) for (const v of m.version_group_details) {
        if (v.move_learn_method.name === 'level-up') (by[v.version_group.name] = by[v.version_group.name] || []).push([v.level_learned_at, m.move.name]);
        if (v.move_learn_method.name === 'machine') (tm[v.version_group.name] = tm[v.version_group.name] || []).push(m.move.name);
      }
      const list = by[GROUPS.find(g => by[g])] || [];
      const seen = new Set(), out = [];
      // (el nivel 0 es «al evolucionar»)
      for (const [lvl, slug] of list.sort((a, b) => a[0] - b[0])) {
        const k = MAP[slug];
        if (k && !seen.has(k)) { seen.add(k); out.push([Math.max(1, lvl), k]); }
      }
      // Por MT: las del mismo juego que los de nivel, sin las que ya aprende subiendo
      const machines = [...new Set((tm[GROUPS.find(g => tm[g])] || []).map(slug => MAP[slug]).filter(k => k && !seen.has(k)))].sort();
      return { out, machines };
    } catch (e) { if (t === 3) throw e; await new Promise(r => setTimeout(r, 1000)); }
  }
}

(async () => {
  const out = {};
  let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => { while (i < ids.length) { const id = ids[i++]; out[id] = await one(id); } }));
  const body = ids.map(id => `  ${id}: ${JSON.stringify(out[id].out)},`).join('\n');
  const tms = ids.filter(id => out[id].machines.length).map(id => `  ${id}: ${JSON.stringify(out[id].machines)},`).join('\n');
  const text = `// Generado por tools/fetch-learnsets.js: no editar a mano. Datos de PokeAPI.\n(function (root) {\nconst LEARN = {\n${body}\n};\n// Por MT\nconst TM = {\n${tms}\n};\nObject.defineProperty(LEARN, 'TM', { value: TM });\nif (typeof module !== 'undefined' && module.exports) module.exports = LEARN; else root.LEARN = LEARN;\n})(typeof window !== 'undefined' ? window : globalThis);\n`;
  fs.writeFileSync(path.join(__dirname, '../public/learn.js'), text);
  console.log(`${ids.length} especies`);
})();
