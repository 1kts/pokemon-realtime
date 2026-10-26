// Entrenadores IA de Clasificatoria: 20 rivales con nombre, equipo con tema y ELO, que salen en la ladder con la
// etiqueta «IA» (nunca se hacen pasar por personas). Si en Clasificatoria o Partida rápida nadie aparece en unos
// segundos, te toca uno de ELO parecido; su IA es más lista cuanto más ELO tiene, y su ELO sube y baja de verdad.
// Son perfiles normales marcados con npc: true (sin cuenta, sin conexión, fuera de métricas y de los amigos).
const D = require('../public/data.js');
const store = require('./store.js');

const WAIT_MS = 20e3;   // espera en la cola antes de que te toque un entrenador IA

// [id, nombre, ELO inicial, equipo (del pool de Clasificatoria)]
const NPCS = [
  ['ia-01', 'Joven Tomás', 960, [18, 26, 143]],
  ['ia-02', 'Chica Poké Ana', 990, [38, 135, 121]],
  ['ia-03', 'Pescador Ramón', 1020, [130, 9, 131]],
  ['ia-04', 'Caza bichos Leo', 1050, [123, 3, 18]],
  ['ia-05', 'Montañero Rubén', 1080, [76, 112, 68]],
  ['ia-06', 'Nadadora Irene', 1110, [121, 131, 9]],
  ['ia-07', 'Ornitólogo Gael', 1150, [18, 6, 149]],
  ['ia-08', 'Karateka Hugo', 1190, [68, 143, 76]],
  ['ia-09', 'Médium Celia', 1230, [94, 65, 121]],
  ['ia-10', 'Científico Iván', 1270, [26, 135, 65]],
  ['ia-11', 'Motorista Dani', 1300, [34, 94, 59]],
  ['ia-12', 'Domador Bruno', 1340, [59, 38, 6]],
  ['ia-13', 'Esquiadora Noa', 1380, [131, 121, 135]],
  ['ia-14', 'Recluta Rocket', 1420, [94, 34, 130]],
  ['ia-15', 'Ninja Kenji', 1460, [94, 123, 135]],
  ['ia-16', 'Dragona Vera', 1500, [149, 130, 6]],
  ['ia-17', 'Entrenadora Guay', 1550, [3, 6, 9]],
  ['ia-18', 'Experto Max', 1600, [149, 65, 112]],
  ['ia-19', 'Rival Azul', 1660, [65, 59, 130]],
  ['ia-20', 'Campeón Rojo', 1740, [26, 143, 6]],
];

// Crea (una vez) los perfiles de los entrenadores IA que falten
function ensure() {
  for (const [key, name, elo, team] of NPCS) {
    if ([...store.all()].some(p => p.npc === key)) continue;
    const p = store.addNpc(name, {
      npc: key, elo, peakElo: elo, ranked: 20, wins: 10 + Math.round((elo - 900) / 40), losses: 10,
      pvpTeam: team.map(dex => ({ dex, moves: D.defaultMoves(dex, D.RANKED_LEVEL) })), avatar: team[0],
    });
    store.persist(p);
  }
}

// IA más lista cuanto más ELO (de 0.3 en Bronce a 0.85 en Maestro)
const skillOf = elo => Math.max(0.3, Math.min(0.85, 0.3 + (elo - 950) / 800 * 0.55));

// El entrenador IA de ELO más parecido (al azar entre los 3 más cercanos, para no repetir siempre el mismo)
function pick(elo) {
  const all = [...store.all()].filter(p => p.npc).sort((a, b) => Math.abs(a.elo - elo) - Math.abs(b.elo - elo)).slice(0, 3);
  return all[Math.floor(Math.random() * all.length)] || null;
}

module.exports = { ensure, pick, skillOf, WAIT_MS, NPCS };
