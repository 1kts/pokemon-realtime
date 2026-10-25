// Nombres que escribe el jugador: el de entrenador (se ve en rankings, combates online y su perfil
// público) y los motes de sus Pokémon (salen en su perfil público). Se limpian y se rechazan los
// insultos, los términos de odio, lo sexual y los que se hacen pasar por el equipo del juego, en los
// idiomas del juego. Se comparan ya normalizados: sin mayúsculas, acentos ni signos, con los números
// de "l33t" pasados a letras y sin letras repetidas, así que «P.u.t.4», «PUUUTA» o «Pütá» también caen.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '€': 'e', '!': 'i', '¡': 'i', '|': 'i' };
// Letras cirílicas y griegas que parecen latinas (para colar «рuta» con una р rusa)
const LOOKALIKE = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', т: 't', н: 'h', і: 'i', ο: 'o', α: 'a', ρ: 'p', ν: 'v' };

// Minúsculas, sin acentos y cada carácter que no es letra hace de separador; con collapse, además sin
// letras repetidas («puuuta» → «puta»)
function normalize(s, collapse = false) {
  const n = String(s).normalize('NFKC').toLowerCase().replace(/ß/g, 'ss')
    .replace(/[0-9@$€!¡|]/g, c => LEET[c] || c)
    .replace(/./gu, c => LOOKALIKE[c] || c)
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}]+/gu, ' ')
    .trim();
  return collapse ? n.replace(/(\p{L})\1+/gu, '$1') : n;
}

// Se buscan dentro del nombre aunque vayan pegados a otras palabras: son largos o no forman parte de
// palabras normales (por eso «puta» no está aquí: saldría en «computadora»)
const ANYWHERE = [
  // español
  'hijoputa', 'hijodeputa', 'putamadre', 'mierda', 'gilipolla', 'maricon', 'cabron', 'follar', 'folladora', 'chupamela', 'chupapija',
  'pendejo', 'pelotudo', 'concha tu madre', 'conchetumare', 'retrasado', 'subnormal', 'mongolo', 'negrata', 'sudaca', 'violador', 'pedofilo',
  // inglés
  'fuck', 'motherf', 'nigger', 'nigga', 'faggot', 'retard', 'bitch', 'whore', 'asshole', 'bullshit', 'dickhead', 'cocksuck', 'pedophile',
  'paedo', 'hitler', 'kill yourself', 'killyourself',
  // francés
  'connard', 'connasse', 'salope', 'encule', 'putain', 'batard', 'nique ta', 'niquetamere', 'tamere',
  // alemán
  'scheise', 'arschloch', 'hurensohn', 'fotze', 'wichser', 'schlampe', 'missgeburt',
  // italiano
  'stronzo', 'vafancul', 'putana', 'coglion', 'frocio', 'porcodio',
  // portugués
  'caralho', 'buceta', 'filhodaputa',
  // japonés
  'まんこ', 'ちんこ', 'ちんぽ', '死ね', 'きちがい', 'キチガイ', 'ガイジ', 'レイプ',
  // coreano
  '씨발', '시발', '병신', '좆', '개새끼', '지랄', '썅',
  // chino
  '操你', '肏', '傻逼', '妈的', '他妈', '屄', '鸡巴', '婊子', '草泥马', '去死',
];
// Solo como palabra suelta (o el nombre entero sin separadores): dentro de otras son inocentes
const WORDS = [
  'puta', 'puto', 'putas', 'putos', 'polla', 'pollas', 'coño', 'zorra', 'zorras', 'culo', 'verga', 'pija', 'joder', 'jodete', 'marica',
  'idiota', 'imbecil', 'nazi', 'nazis', 'sexo', 'porno', 'semen', 'pene', 'vagina', 'tetas', 'mamada',
  'shit', 'cunt', 'dick', 'cock', 'pussy', 'slut', 'fag', 'ass', 'tits', 'boobs', 'penis', 'porn', 'sex', 'cum', 'rape', 'kys', 'kkk', 'nig', 'rapist',
  'pute', 'merde', 'chatte', 'fick', 'ficken', 'arsch', 'troia', 'merda', 'porra', 'viado', 'puttana', 'cazzo',
  'heil', 'sieg heil',
  // Hacerse pasar por el equipo del juego
  'admin', 'administrador', 'administrator', 'moderador', 'moderator', 'mod', 'staff', 'soporte', 'support', 'pokearenas', 'oficial', 'official', 'sistema', 'system',
];

// Cada lista, tal cual y sin letras repetidas
const lists = collapse => ({ any: ANYWHERE.map(w => normalize(w, collapse).replace(/ /g, '')), words: new Set(WORDS.map(w => normalize(w, collapse))) });
const PLAIN = lists(false), COLLAPSED = lists(true);

// Las palabras sueltas que hay en n: cada una, el nombre entero sin separadores («p.u.t.a») y cada dos
// seguidas («sieg heil»)
const wordsOf = n => { const w = n.split(' '); return [...w, w.join(''), ...w.slice(1).map((x, i) => w[i] + ' ' + x)]; };

// ¿Se puede usar este nombre? (ya limpio con clean)
function allowed(name) {
  const plain = normalize(name), collapsed = normalize(name, true);
  if (!plain) return true;
  const compact = plain.replace(/ /g, ''), compactC = collapsed.replace(/ /g, '');
  if (PLAIN.any.some(w => compact.includes(w)) || COLLAPSED.any.some(w => compactC.includes(w))) return false;
  // Sin letras repetidas solo cuenta si las había: así «Pola» no cae por «polla», pero «pollla» sí
  const a = wordsOf(plain), b = wordsOf(collapsed);
  return !a.some((w, i) => PLAIN.words.has(w) || (w !== b[i] && COLLAPSED.words.has(b[i])));
}

// Sin caracteres de control ni invisibles, espacios seguidos juntados y como mucho max caracteres
function clean(s, max) {
  return [...String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
}

const TRAINER_MAX = 16, NICK_MAX = require('../public/data.js').NICK_MAX;
const REFUSED = 'Ese nombre no está permitido: elige otro';

// Nombre de entrenador: { name } limpio, o { error } si no vale (vacío se deja pasar como '')
function trainerName(s) {
  const name = clean(s, TRAINER_MAX);
  return allowed(name) ? { name } : { error: REFUSED };
}

// Mote de un Pokémon: { nick } limpio ('' = sin mote, con el nombre de la especie) o { error }
function nickname(s) {
  const nick = clean(s, NICK_MAX);
  return allowed(nick) ? { nick } : { error: 'Ese mote no está permitido: elige otro' };
}

module.exports = { normalize, allowed, clean, trainerName, nickname, TRAINER_MAX, NICK_MAX };
