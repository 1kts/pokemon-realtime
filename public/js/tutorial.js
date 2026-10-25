// Tutorial jugable (1 minuto): un combate contra un muñeco quieto que no ataca (el servidor lo
// monta con { t: 'practice', tutorial: true }) y una tarjeta arriba que va pidiendo cada control. Cada
// paso se cumple al hacerlo de verdad (lo ven onEvent, con lo que manda el servidor, y tick, con lo que
// hace el jugador). Al ganar, el premio (Data.TUTORIAL_REWARD, una vez) se recoge a mano.
import { t } from './i18n.js';
import { prizeHtml } from './missions.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const TEAM = [6, 9];   // Charizard y Blastoise: dos tipos distintos para aprender a cambiar

// Cada paso: texto (con sus teclas) y cuándo se cumple
const STEPS = [
  { text: () => t('Muévete con <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'), tick: (tu, b) => b.pred && Math.hypot(b.pred.x - tu.from.x, b.pred.y - tu.from.y) > 90 },
  { text: () => t('Apunta con el <kbd>Ratón</kbd> y ataca con <kbd>Clic</kbd>: acierta al muñeco'), ev: (e, b) => e.k === 'hit' && e.s !== b.you },
  { text: () => t('Prueba tus otros movimientos: <kbd>Clic dcho</kbd>, <kbd>Q</kbd> o <kbd>E</kbd>'), ev: (e, b) => e.k === 'cast' && e.s === b.you && e.c >= 1 && e.c <= 3 },
  { text: () => t('Protégete con <kbd>Espacio</kbd>: bloquea casi todo el daño'), ev: (e, b) => e.k === 'protect' && e.s === b.you },
  { text: () => t('Cambia de Pokémon con <kbd>2</kbd>'), ev: (e, b) => e.k === 'swap' && e.s === b.you },
  { text: () => t('¡Ya sabes lo básico! Derrota al muñeco'), ev: () => false },
];

export class Tutorial {
  constructor(ui) {
    this.ui = ui;
    this.step = 0;
    this.from = null;
    this.box = null;
  }
  // Empieza el combate del tutorial
  start() {
    this.ui.app.tutorial = this;
    this.ui.net.send({ t: 'practice', dexes: TEAM, tutorial: true });
  }
  // Lo llama el combate al empezar: la tarjeta de los pasos
  attach(battle) {
    this.from = battle.pred ? { ...battle.pred } : null;
    this.box = el('div', 'tutorial-card');
    document.body.append(this.box);
    this.render();
  }
  render() {
    if (!this.box) return;
    const s = STEPS[this.step];
    this.box.innerHTML = `<small>${t('Tutorial')} · ${this.step + 1}/${STEPS.length}</small><p>${s.text()}</p>
      <div class="tut-dots">${STEPS.map((_, i) => `<i class="${i < this.step ? 'ok' : i === this.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const skip = el('button', 'link', t('Saltar'));
    skip.onclick = () => { this.stop(); this.ui.net.send({ t: 'forfeit' }); };
    this.box.append(skip);
    this.box.classList.remove('pop');
    void this.box.offsetWidth;
    this.box.classList.add('pop');
  }
  next() {
    if (this.step >= STEPS.length - 1) return;
    this.step++;
    this.ui.app.sfx.reward();
    this.render();
  }
  onEvent(e, battle) { const s = STEPS[this.step]; if (s.ev && s.ev(e, battle)) this.next(); }
  tick(battle) {
    if (!this.from && battle.pred) this.from = { ...battle.pred };
    const s = STEPS[this.step];
    if (s.tick && this.from && s.tick(this, battle)) this.next();
  }
  stop() {
    if (this.box) this.box.remove();
    this.box = null;
    if (this.ui.app.tutorial === this) this.ui.app.tutorial = null;
  }
  // Fin del combate: si ha ganado, el premio para recoger (la primera vez) o un «¡bien hecho!»
  finish(won) {
    this.stop();
    if (!won) return;
    setTimeout(() => this.ui.tutorialDone(), 300);
  }
}

export const tutorialViews = {
  startTutorial() {
    if (this.app.battle) return;
    new Tutorial(this).start();
  },
  tutorialDone() {
    const p = this.profile;
    const back = el('div', 'modal');
    const box = el('div', 'panel modal-box tutorial-done');
    const close = () => back.remove();
    box.append(el('h3', '', t('¡Tutorial completado!')),
      el('p', '', t('Ya sabes moverte, atacar, protegerte y cambiar de Pokémon. Ahora prueba la Historia o una partida online.')));
    const acts = el('div', 'acts');
    if (!p.tutorial) {
      box.append(el('div', 'm-prize', prizeHtml(Data.TUTORIAL_REWARD)));
      const b = el('button', 'primary claim-btn', t('¡Recoger premio!'));
      b.onclick = () => { b.disabled = true; this.net.send({ t: 'tutorial' }); close(); };
      acts.append(b);
    } else {
      const ok = el('button', 'primary', t('¡A jugar!'));
      ok.onclick = close;
      acts.append(ok);
    }
    box.append(acts);
    back.append(box);
    document.body.append(back);
  },
};
