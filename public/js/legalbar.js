// Barra legal al final de cada pantalla (como en los fan-games de Pokémon): qué es PokéArenas, a quién
// pertenecen las marcas, de dónde salen los sprites y los enlaces a créditos, aviso legal, retirada de
// contenido y contacto. Se ve en todas las pantallas menos en el combate. Va dentro de #screen, después de
// todo lo demás, así que nunca tapa nada: si la pantalla es más alta que la ventana, queda abajo del scroll.
import { t, getLang } from './i18n.js';

const CONTACT = 'contact@pokearenas.com';
const SPRITECOLLAB = 'https://github.com/PMDCollab/SpriteCollab';
const CC = 'https://creativecommons.org/licenses/by-nc/4.0/';
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const legalBarViews = {
  // Crea la barra una vez; cada pantalla vacía #screen, así que se vuelve a poner al refrescarla
  legalBar() {
    if (!this.legalEl) {
      this.legalEl = el('footer', 'legal-bar');
      this.legalEl.setAttribute('role', 'contentinfo');
    }
    if (!this.legalEl.isConnected) this.root.append(this.legalEl);
    return this.legalEl;
  },

  refreshLegalBar() {
    const bar = this.legalBar();
    const es = getLang() === 'es';
    const page = es ? '/legal' : '/legal/en';
    const takedown = page + (es ? '#retirada' : '#takedown');
    bar.innerHTML = '';
    const text = el('p', 'legal-text', t('PokéArenas es un <b>fan-game no oficial, gratuito y sin ánimo de lucro</b>: sin publicidad y donar no da ventajas. No está afiliado, patrocinado ni respaldado por Nintendo, The Pokémon Company, Creatures Inc. ni GAME FREAK inc. Pokémon y los nombres de los personajes son marcas de sus respectivos titulares. © 1995-{year} Nintendo / Creatures Inc. / GAME FREAK inc. Sprites de <a href="{sc}" target="_blank" rel="noopener noreferrer">PMD SpriteCollab</a> (<a href="{cc}" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a>).', { year: new Date().getFullYear(), sc: SPRITECOLLAB, cc: CC }));
    // En pantallas bajas (móvil en horizontal) el texto va en una línea: tocarlo lo despliega entero
    text.onclick = e => { if (!e.target.closest('a')) bar.classList.toggle('open'); };
    bar.append(text);
    const nav = el('nav', 'legal-nav');
    const credits = el('button', 'link', t('Créditos'));
    credits.onclick = () => this.legal();
    const news = el('button', 'link', `v${CHANGELOG[0].v}${this.hasNews() ? ' <i class="ndot news"></i>' : ''} · ${t('Novedades')}`);
    news.onclick = () => this.patchNotes();
    const link = (href, text) => Object.assign(el('a', '', text), { href, target: '_blank', rel: 'noopener noreferrer' });
    const mail = el('a', '', CONTACT);
    mail.href = 'mailto:' + CONTACT;
    const bug = el('button', 'link', t('Reportar un bug'));
    bug.onclick = () => this.bugReport();
    nav.append(bug, credits, link(page, t('Aviso legal y privacidad')), link(takedown, t('Retirada de contenido')), mail,
      el('span', '', t('Hecho por {who}', { who: '1kts' })), news);
    bar.append(nav);
  },
};
