// Entrenadores IA de Clasificatoria: 20 rivales con nombre, equipo con tema y ELO, que salen en la ladder con la
// etiqueta «IA» (nunca se hacen pasar por personas). Si en Clasificatoria o Partida rápida nadie aparece en unos
// segundos, te toca uno de ELO parecido; su IA es más lista cuanto más ELO tiene, y su ELO sube y baja de verdad.
// Son perfiles normales marcados con npc: true (sin cuenta, sin conexión, fuera de métricas y de los amigos).
const D = require('../public/data.js');
const store = require('./store.js');

const WAIT_MS = 20e3;   // espera en la cola antes de que te toque un entrenador IA

// [id, nombre, ELO inicial, equipo (del pool de Clasificatoria), sprite (public/trainers)]: líderes de gimnasio y
// campeones de Kanto y Johto, de menos a más ELO, cada uno con un equipo de su tipo
const NPCS = [
  ['ia-01', 'Antón', 960, [123, 3, 18], 'bugsy'],
  ['ia-02', 'Pegaso', 990, [18, 6, 130], 'falkner'],
  ['ia-03', 'Brock', 1020, [76, 112, 34], 'brock'],
  ['ia-04', 'Misty', 1050, [121, 9, 131], 'misty'],
  ['ia-05', 'Blanca', 1080, [143, 18, 26], 'whitney'],
  ['ia-06', 'Erika', 1110, [3, 94, 34], 'erika'],
  ['ia-07', 'Lt. Surge', 1150, [26, 135, 143], 'surge'],
  ['ia-08', 'Morti', 1190, [94, 65, 143], 'morty'],
  ['ia-09', 'Aníbal', 1230, [68, 76, 130], 'chuck'],
  ['ia-10', 'Koga', 1270, [94, 34, 3], 'koga'],
  ['ia-11', 'Yasmina', 1300, [112, 76, 131], 'jasmine'],
  ['ia-12', 'Sabrina', 1340, [65, 121, 94], 'sabrina'],
  ['ia-13', 'Fredo', 1380, [131, 9, 112], 'pryce'],
  ['ia-14', 'Blaine', 1420, [59, 38, 6], 'blaine'],
  ['ia-15', 'Débora', 1460, [149, 130, 6], 'clair'],
  ['ia-16', 'Giovanni', 1500, [34, 112, 76], 'giovanni'],
  ['ia-17', 'Karen', 1550, [94, 143, 59], 'karen'],
  ['ia-18', 'Lance', 1600, [149, 130, 6], 'lance'],
  ['ia-19', 'Azul', 1660, [65, 59, 130], 'azul'],
  ['ia-20', 'Rojo', 1740, [26, 143, 6], 'ia/rojo'],
];

// Crea (una vez) los perfiles de los entrenadores IA que falten
function ensure() {
  for (const [key, name, elo, team, sprite] of NPCS) {
    const pvpTeam = team.map(dex => ({ dex, moves: D.defaultMoves(dex, D.RANKED_LEVEL) }));
    const old = [...store.all()].find(p => p.npc === key);
    // Los que ya existían (antes eran clases de entrenador: Joven, Pescador…) pasan a ser el líder, con su ELO
    if (old) { if (old.name !== name || old.npcSprite !== sprite) { store.setName(old, name); Object.assign(old, { npcSprite: sprite, pvpTeam, avatar: team[0] }); store.persist(old); } continue; }
    const p = store.addNpc(name, {
      npc: key, npcSprite: sprite, elo, peakElo: elo, ranked: 20, wins: 10 + Math.round((elo - 900) / 40), losses: 10,
      pvpTeam, avatar: team[0],
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
