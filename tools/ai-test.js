// Pruebas de la IA de combate (server/ai.js): lo que enseña «Ver qué piensa la IA» en Práctica y a quién se le manda.
//   node tools/ai-test.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-ai-test-'));
process.env.DB_FILE = path.join(tmp, 'arena.db');
process.env.ARENA_NPCS = '0';
const WebSocket = require('ws');
const D = require('../public/data.js');
const S = require('../public/shared.js');
const { Battle } = require('../server/battle.js');

let fails = 0;
const check = async (name, fn) => {
  try { await fn(); console.log('✓', name); } catch (e) { fails++; console.log('✗', name, '\n ', e.message); }
};
// Nunca colgado: como mucho 2 minutos
setTimeout(() => { console.log('✗ ai-test: más de 2 minutos'); process.exit(1); }, 120e3).unref();

// Combate de prueba sin temporizador (lado 0, una persona; lado 1, la IA): avanza a mano con tick()
function battle(opts = {}) {
  const b = new Battle({ mode: 'practice', map: 'pradera', ...opts,
    sides: opts.sides || [{ name: 'A', team: [{ dex: 25, level: 50 }] }, { name: 'Bot', team: [{ dex: 68, level: 50 }], ai: 0.8 }], onEnd: () => {} });
  b.stop();
  b.state = 'fight';
  return b;
}
const run = (b, secs) => { for (let i = 0; i < Math.round(secs / S.DT); i++) { b.sides[0].inputs.push({ mx: 0, my: 0, c: -1, sw: -1 }); b.tick(); } };
const MODES = ['atacar', 'tantear', 'defender'];
const STYLES = ['luchador', 'francotirador', 'controlador', 'tanque'];

(async () => {
  await check('en Práctica con la opción, el jugador recibe el estado, la agresividad y la personalidad del bot', () => {
    const b = battle({ aiDebug: true });
    run(b, 1);
    const ai = b.sideSnap(b.sides[1], 0).ai;
    assert(ai && MODES.includes(ai.m) && STYLES.includes(ai.p) && ai.g >= 0 && ai.g <= 100 && Number.isInteger(ai.g), JSON.stringify(ai));
    assert.strictEqual(ai.p, 'luchador', 'Machamp es luchador');
    assert(!b.sideSnap(b.sides[0], 0).ai, 'de su propio Pokémon no se manda');
    assert(!b.sideSnap(b.sides[1], 1).ai, 'a la IA no se le manda nada');
  });
  await check('sin la opción, en Práctica no se manda', () => {
    const b = battle();
    run(b, 1);
    assert(!b.sideSnap(b.sides[1], 0).ai);
  });
  await check('nunca fuera de Práctica (clasificatoria, en línea, Torre, historia, salvajes) ni en el tutorial', () => {
    for (const mode of ['ranked', 'casual', 'tower', 'trainer', 'wild']) {
      const b = battle({ mode, aiDebug: true });
      run(b, 1);
      assert(!b.sideSnap(b.sides[1], 0).ai, mode);
    }
    const t = battle({ tutorial: true, aiDebug: true });
    run(t, 1);
    assert(!t.sideSnap(t.sides[1], 0).ai, 'tutorial');
  });
  await check('la agresividad baja cuando al bot le queda poca vida (y con ella, el estado)', () => {
    const b = battle({ aiDebug: true });
    run(b, 0.5);
    const full = b.sideSnap(b.sides[1], 0).ai.g;
    const mon = b.sides[1].team[0];
    mon.hp = mon.maxHp * 0.1;
    run(b, 1);
    const low = b.sideSnap(b.sides[1], 0).ai;
    assert(low.g < full - 30 && low.m === 'defender', `${full} → ${JSON.stringify(low)}`);
  });

  // Por WebSocket: la opción de la pantalla de Práctica llega al combate
  const { start } = require('../server/index.js');
  const server = await start(0);
  await check('por WebSocket: Práctica con aiDebug manda el estado del bot en los snapshots', async () => {
    const ws = new WebSocket(`ws://localhost:${server.address().port}`);
    const snap = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no llega ningún snapshot con el estado del bot')), 15000);
      ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.t === 'profile') ws.send(JSON.stringify({ t: 'practice', dexes: [D.RANKED_POOL[0]], skill: 0.5, aiDebug: true }));
        if (m.t === 'snap' && m.ps[1].ai) { clearTimeout(timer); resolve(m.ps[1].ai); }
      });
    });
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name: 'Curioso' })));
    const ai = await snap;
    ws.close();
    assert(MODES.includes(ai.m) && STYLES.includes(ai.p), JSON.stringify(ai));
  });

  console.log(fails ? `✗ ai-test: ${fails} fallo(s)` : '✓ ai-test: todo bien');
  process.exit(fails ? 1 : 0);
})();
