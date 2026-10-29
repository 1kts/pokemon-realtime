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
// Math.random con semilla, distinta para cada prueba (como tools/ai-tune.js): los combates de cada prueba salen
// siempre iguales y npm test no falla unas veces sí y otras no (bloquearía el despliegue sin avisar)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedOf = name => [...name].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
const realRandom = Math.random;
const check = async (name, fn) => {
  Math.random = rng(seedOf(name + (process.env.AI_TEST_SEED || '')));   // (AI_TEST_SEED=x: otras semillas, para ver el margen)
  try { await fn(); console.log('✓', name); } catch (e) { fails++; console.log('✗', name, '\n ', e.message); } finally { Math.random = realRandom; }
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

  // Parámetros ajustados con tools/ai-tune.js: las IA torpes deciden como siempre, las hábiles con los ajustados
  await check('parámetros: Fácil y Normal deciden como antes, Maestro con los ajustados y en medio una mezcla', () => {
    const AI = require('../server/ai.js');
    assert.deepStrictEqual(AI.paramsFor(0.1), { ...AI.BASE_PARAMS }, 'Fácil');
    assert.deepStrictEqual(AI.paramsFor(0.28), { ...AI.BASE_PARAMS }, 'Normal');
    assert.strictEqual(AI.paramsFor(0.85).swapType, AI.TUNED_PARAMS.swapType);
    assert.strictEqual(AI.paramsFor(1).range.luchador, AI.TUNED_PARAMS.range.luchador);
    const mid = AI.paramsFor(0.6).swapType, [a, b] = [AI.BASE_PARAMS.swapType, AI.TUNED_PARAMS.swapType].sort();
    assert(mid > a && mid < b, `mezcla ${mid}`);
    // (ningún parámetro toca la ejecución: la habilidad sigue mandando en reflejos y puntería)
    for (const k of Object.keys(AI.TUNED_PARAMS)) assert(k in AI.BASE_PARAMS, k);
    assert.strictEqual(AI.TUNED_PARAMS.adapt, true, 'la dificultad adaptativa sigue en el juego');
  });
  await check('un combate entero con los parámetros del juego acaba sin errores', () => {
    const b = battle({ mode: 'practice', map: 'g-roca', sides: [{ name: 'A', team: [{ dex: 6, level: 50 }], ai: 0.9 }, { name: 'B', team: [{ dex: 9, level: 50 }], ai: 0.9 }] });
    let ended = null; b.onEnd = r => { ended = r; };
    for (let i = 0; i < S.TICK * 300 && !ended; i++) b.tick();
    assert(ended, 'el combate acaba');
  });

  // ---------- Jugadas de los líderes (server/tactics.js) ----------
  const tactics = require('../server/tactics.js');
  const { T } = S;
  // Líder (lado 1, con su id) contra un Pokémon que no hace nada (lado 0)
  const duelLeader = (map, leader, mine, theirs, extra = {}) => battle({ mode: 'trainer', map, sides: [{ name: 'A', team: [mine] }, { name: 'Líder', team: [theirs], ai: 0.6, leader, ...extra }] });
  const events = b => { const seen = []; const ev = b.ev.bind(b); b.ev = e => { if (e.k === 'tactic') seen.push(e.id); ev(e); }; return seen; };
  const lineBlocked = (b, a, c) => b.obstacles.some(o => {
    if (o.kind === 'ghost') return false;
    const dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.y - a.y) * dy) / l2));
    return Math.hypot(a.x + dx * k - o.x, a.y + dy * k - o.y) < o.r + 4;
  });

  await check('cada líder, Alto Mando y Campeón tiene 2 o 3 jugadas, y todas encajan con su arena', () => {
    for (const n of D.REGION_IDS.flatMap(r => D.leadersOf(r))) {
      const list = tactics.LEADER_PLAYS[n.id];
      assert(list && list.length >= 2 && list.length <= 3, n.id);
      const b = battle({ mode: 'trainer', map: n.map });
      assert.deepStrictEqual(tactics.playsOf(b, n.id), list, `${n.id}: ${list.filter(k => !tactics.playsOf(b, n.id).includes(k))} no encaja en ${n.map}`);
    }
  });
  // El rival (lado 0) lanza Ascuas hacia el líder una y otra vez
  const fire = (b, secs) => { for (let i = 0; i < Math.round(secs / S.DT); i++) { const [a, l] = b.sides; b.sides[0].inputs.push({ mx: 0, my: 0, c: i % 20 ? -1 : 0, sw: -1, a: Math.atan2(l.y - a.y, l.x - a.x), tx: l.x, ty: l.y }); b.tick(); } };
  const coverWhileFiring = (leader) => {
    const b = battle({ mode: 'trainer', map: 'g-roca', sides: [{ name: 'A', team: [{ dex: 4, level: 14 }] }, { name: 'L', team: [{ dex: 95, level: 14 }], ai: 0.6, leader }] });
    const seen = events(b);
    fire(b, 1.5);
    let covered = 0;
    for (let i = 0; i < 30; i++) { fire(b, 0.1); if (lineBlocked(b, b.sides[0], b.sides[1])) covered++; }
    return { covered, seen };
  };
  await check('Brock se atrinchera: si le cargas ataques a distancia, se pone con una roca en medio (y lo anuncia una vez)', () => {
    let total = 0, seen = [];
    for (let n = 0; n < 4; n++) { const r = coverWhileFiring('brock'); total += r.covered; seen = r.seen; }
    assert(total / 4 >= 8, `a cubierto de media ${total / 4}/30`);
    assert.deepStrictEqual(seen.filter(x => x === 'trinchera'), ['trinchera']);
  });
  await check('sin ser líder, la misma IA no hace jugadas', () => {
    for (let n = 0; n < 3; n++) assert.deepStrictEqual(coverWhileFiring(null).seen, []);
  });
  await check('Lt. Surge cierra el cerco: si el rival está en una placa a punto de saltar, le lanza algo que aturde', () => {
    // (en cada tick: si empieza a cargar un ataque mientras hace el cerco, ¿es uno que aturde?)
    const trial = () => {
      const b = duelLeader('g-electrico', 'surge', { dex: 7, level: 21 }, { dex: 100, level: 21 });
      run(b, 1);
      b.sides[1].energy = 100;
      for (let i = 0; i < 150; i++) {
        b.arena.danger = [{ x: b.sides[0].x, y: b.sides[0].y, r: 30, t: 0.8 }];
        const was = b.sides[1].wind;
        run(b, S.DT);
        const w = b.sides[1].wind;
        if (w && w !== was && b.sides[1].aiState.play === 'cerco') return !!w.m.stun;
      }
      return false;
    };
    let ok = 0;
    for (let n = 0; n < 6; n++) if (trial()) ok++;
    assert(ok >= 5, `aturde en ${ok}/6`);
  });
  await check('Blaine pelea desde la lava (a su Growlithe no le hace nada; a un Squirtle, sí): más rato en ella que sin la jugada', () => {
    const lava = leader => {
      let on = 0;
      for (let n = 0; n < 4; n++) {
        const b = duelLeader('g-fuego', leader, { dex: 7, level: 40 }, { dex: 58, level: 42 });
        for (let i = 0; i < 60; i++) { run(b, 0.1); if (b.terrain[S.cellIndex(b.sides[1].x, b.sides[1].y)] === T.LAVA) on++; }
      }
      return on / 4;
    };
    const withPlay = lava('blaine'), without = lava(null);
    assert(withPlay >= 10 && withPlay > without * 1.5, `en la lava ${withPlay}/60 con la jugada y ${without}/60 sin ella`);
  });
  await check('Blanca, con poca vida, va a una baldosa de curación y se cura', () => {
    const b = duelLeader('g-normal', 'whitney', { dex: 1, level: 19 }, { dex: 241, level: 19 });
    run(b, 0.5);
    const mon = b.sides[1].team[0];
    mon.hp = Math.round(mon.maxHp * 0.4);
    const start = mon.hp;
    let onPad = false;
    for (let i = 0; i < 80 && !onPad; i++) { run(b, 0.1); onPad = b.arena.pads.some(p => p.i === S.cellIndex(b.sides[1].x, b.sides[1].y)); }
    run(b, 1.5);
    assert(onPad && mon.hp > start, `baldosa ${onPad}, PS ${start} → ${mon.hp}`);
  });

  await check('líderes: habilidad calibrada para todos, dentro de lo razonable, y el Campeón por encima de los primeros gimnasios', () => {
    for (const r of D.REGION_IDS) {
      const ls = D.leadersOf(r);
      for (const n of ls) assert(n.ai >= 0.2 && n.ai <= 0.9, `${n.id}: ${n.ai}`);
      assert(ls[ls.length - 1].ai > ls[0].ai + 0.2, `${r}: Campeón ${ls[ls.length - 1].ai} y primer gimnasio ${ls[0].ai}`);
    }
  });
  // Lo que una jugada no puede pisar: la jugada se aplica a mano (leaderPlay) sobre la entrada que dejaría la IA
  const AI = require('../server/ai.js');
  const helpers = { aimMove: AI.aimMove, lineBlocked: AI.lineBlocked, angleDiff: AI.angleDiff };
  // Blanca con poca vida (quiere ir a la baldosa) y el rival lejos y tocado (acoso posible)
  const whitney = () => {
    const b = duelLeader('g-normal', 'whitney', { dex: 1, level: 19 }, { dex: 241, level: 19, moves: ['placaje', 'golpeCuerpo', 'ataqueRapido', 'descanso'] });
    run(b, 0.5);
    const side = b.sides[1], mon = side.team[0];
    mon.hp = Math.round(mon.maxHp * 0.4);
    run(b, 0.1);
    return { b, side, st: side.aiState };
  };
  await check('una jugada no pisa a la IA cuando esquiva o escapa: su movimiento manda', () => {
    const { b, side, st } = whitney();
    const inp = { mx: 0.3, my: -0.7, c: -1, sw: -1, a: 0, tx: 0, ty: 0 };
    st.evade = true; st.mayAttack = false; st.playHold = 0; st.play = null;
    assert.strictEqual(tactics.leaderPlay(b, side, inp, S.DT, helpers), 'curacion');
    assert.deepStrictEqual([inp.mx, inp.my], [0.3, -0.7], 'esquivando, la jugada no toca el movimiento');
    st.evade = false;
    tactics.leaderPlay(b, side, inp, S.DT, helpers);
    assert(inp.mx !== 0.3 || inp.my !== -0.7, 'sin esquivar, sí lo lleva hacia la baldosa');
  });
  await check('una jugada solo ataca cuando a la IA le tocaba (dudas y cadencia de su habilidad) y no cambia una huida', () => {
    const { b, side, st } = whitney();
    side.team[0].hp = side.team[0].maxHp;   // (sana: le toca el acoso)
    b.sides[0].team[0].hp = Math.round(b.sides[0].team[0].maxHp * 0.2);
    side.energy = 100; side.team[0].cds = [0, 0, 0, 0]; side.wind = null; side.rec = 0; side.stun = 0;   // (libre para actuar)
    const fresh = () => ({ mx: 0, my: 0, c: -1, sw: -1, a: 0, tx: 0, ty: 0 });
    st.evade = false; st.view.dist = 120;
    let inp = fresh(); st.mayAttack = false; st.play = null; st.playHold = 0;
    assert.strictEqual(tactics.leaderPlay(b, side, inp, S.DT, helpers), 'acoso');
    assert.strictEqual(inp.c, -1, 'sin tocarle atacar, no ataca');
    inp = fresh(); st.mayAttack = true;
    tactics.leaderPlay(b, side, inp, S.DT, helpers);
    assert(inp.c >= 0 && inp.c < 4, 'tocándole, ataca con lo más fuerte');
    const rest = side.team[0].moves.indexOf('descanso');
    assert(rest >= 0, 'Miltank lleva Descanso');
    inp = fresh(); inp.c = rest;
    tactics.leaderPlay(b, side, inp, S.DT, helpers);
    assert.strictEqual(inp.c, rest, 'si la IA ha elegido curarse, la jugada no lo cambia por un ataque');
  });
  await check('una jugada que no avanza hacia su sitio (esquivando todo el rato, una roca en medio) descansa', () => {
    const { b, side, st } = whitney();
    const inp = () => ({ mx: 0, my: 0, c: -1, sw: -1, a: 0, tx: 0, ty: 0 });
    st.play = null; st.playHold = 0;
    let first = null;
    for (let i = 0; i < Math.round(2 / S.DT); i++) {
      b.t += S.DT; st.evade = true;   // (sin moverse: el combate no avanza, solo el reloj)
      const play = tactics.leaderPlay(b, side, inp(), S.DT, helpers);
      if (i === 0) first = play;
    }
    assert.strictEqual(first, 'curacion');
    assert(st.rest.curacion > b.t, 'tras 1,5 s sin acercarse, la curación descansa');
    assert.notStrictEqual(tactics.leaderPlay(b, side, inp(), S.DT, helpers), 'curacion');
  });
  await check('cerca de la pared, el empujón suave del borde no cuenta como esquiva (las jugadas pueden llegar ahí)', () => {
    const b = battle();
    run(b, 0.5);
    b.sides[1].x = 40; b.sides[1].y = 300;
    run(b, S.DT);
    assert.strictEqual(b.sides[1].aiState.evade, false);
  });
  await check('Ver qué piensa la IA: con dos de la misma especie, tras el debilitado no se manda nada hasta que el nuevo decide', () => {
    const b = battle({ aiDebug: true, sides: [{ name: 'A', team: [{ dex: 25, level: 50 }] }, { name: 'Bot', team: [{ dex: 68, level: 50 }, { dex: 68, level: 50 }], ai: 0.8 }] });
    run(b, 1);
    b.sides[1].team[0].hp = 0;
    let forcedSent = 0, after = 0;
    for (let i = 0; i < 120; i++) { run(b, S.DT); const ai = b.sideSnap(b.sides[1], 0).ai; if (ai && b.sides[1].forced > 0) forcedSent++; if (ai && b.sides[1].act === 1) after++; }
    assert.strictEqual(forcedSent, 0, 'mientras elige al siguiente, nada');
    assert(after > 0 && b.sides[1].act === 1, 'y luego lo del segundo Machamp');
  });
  await check('Ver qué piensa la IA: tras un debilitado no enseña lo del Pokémon de antes', () => {
    const b = battle({ aiDebug: true, sides: [{ name: 'A', team: [{ dex: 25, level: 50 }] }, { name: 'Bot', team: [{ dex: 68, level: 50 }, { dex: 9, level: 50 }], ai: 0.8 }] });
    run(b, 1);
    assert.strictEqual(b.sideSnap(b.sides[1], 0).ai.p, 'luchador');
    const mon = b.sides[1].team[0];
    mon.hp = 0;
    let saw = [];
    for (let i = 0; i < 120; i++) { run(b, S.DT); const ai = b.sideSnap(b.sides[1], 0).ai; if (ai) saw.push(b.mon(b.sides[1]).dex + ':' + ai.p); }
    assert(b.mon(b.sides[1]).dex === 9, 'ha salido Blastoise');
    assert(!saw.some(x => x === '9:luchador'), `nunca Blastoise con la personalidad de Machamp (${[...new Set(saw)]})`);
    assert(saw.some(x => x.startsWith('9:')), 'y luego enseña la suya');
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
