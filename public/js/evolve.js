// La evolución, en su propia ventana: el Pokémon brilla y da paso al nuevo. Los que evolucionan a la vez van en cola, y se
// salta con un toque. Viene de los resultados de un combate (con lo que ha aprendido) o de un cambio en el perfil (Caramelo
// Raro y piedras)
import { t } from './i18n.js';
import { portrait, animatedPortrait } from './sprites.js';
import { escapeHtml } from './battle.js';

const queue = [];
const shown = new Map();   // uid -> especie ya enseñada: un mismo cambio llega por los resultados y por el perfil
let open = false;

function next(ui) {
  const e = queue.shift();
  document.querySelector('.evo-scene')?.remove();
  open = !!e;
  if (!e) return;
  const back = document.createElement('div');
  back.className = 'evo-scene';
  const box = document.createElement('div');
  box.className = 'evo-box';
  const stage = document.createElement('div');
  stage.className = 'evo-stage';
  const before = portrait(e.from, 120, { shiny: e.shiny }), after = animatedPortrait(e.to, 120, 'Pose', e.shiny);
  before.classList.add('evo-from');
  after.classList.add('evo-to');
  stage.append(before, after);
  const name = e.nick ? escapeHtml(e.nick) : Data.SPECIES[e.from].name;
  const text = document.createElement('p');
  text.innerHTML = `<b>${name}</b><span>${t('¡Ha evolucionado a {m}!', { m: Data.SPECIES[e.to].name })}</span>`
    + (e.learned.length ? `<small>${t('Nuevo movimiento: {list}', { list: e.learned.map(k => Data.MOVES[k].name).join(', ') })}</small>` : '');
  const acts = document.createElement('div');
  acts.className = 'acts';
  if (e.learned.length) {
    const edit = document.createElement('button');
    edit.textContent = t('Editar movimientos');
    edit.onclick = () => { ui.monSheet(e.uid, 'moves'); next(ui); };
    acts.append(edit);
  }
  const go = document.createElement('button');
  go.className = 'primary';
  go.textContent = t('Continuar');
  go.onclick = () => next(ui);
  acts.append(go);
  box.append(stage, text, acts);
  back.append(box);
  // (un toque en cualquier sitio salta la animación)
  back.onclick = ev => { if (!ev.target.closest('button')) back.classList.add('done'); };
  document.body.append(back);
  if (e.sound) ui.app.sfx.levelUp(true);
}

export function playEvolutions(ui, list) {
  const fresh = list.filter(e => shown.get(e.uid) !== e.to);
  for (const e of fresh) shown.set(e.uid, e.to);
  queue.push(...fresh);
  if (!open && queue.length) next(ui);
}

// Lo que evoluciona fuera de un combate: el perfil trae a un Pokémon con otra especie
export function noteEvolutions(ui, before, after) {
  if (ui.app.battle) return;   // (lo enseñan los resultados, con lo que ha aprendido)
  const list = [];
  for (const m of after.mons) {
    const old = before.mons.find(x => x.uid === m.uid);
    if (old && old.dex !== m.dex) list.push({ uid: m.uid, from: old.dex, to: m.dex, nick: m.nick, shiny: !!m.shiny, sound: true,
      learned: (m.moves || []).filter(k => !(old.moves || []).includes(k)) });
  }
  if (list.length) playEvolutions(ui, list);
}
