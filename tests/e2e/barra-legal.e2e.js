// Barra legal: al final de cada pantalla (menos el combate), centrada y pegada al borde de abajo al bajar del
// todo, con el aviso de fan-game, las marcas, la atribución de los sprites y los enlaces; se ajusta al ancho de
// la ventana y va detrás del contenido, así que no tapa nada
module.exports = async ({ page, player, ok }) => {
  // (baja #screen del todo; el centro se mide sobre su ancho útil, sin la barra de scroll)
  const geo = () => page.eval(`(() => {
    const sc = document.getElementById('screen'); sc.scrollTop = sc.scrollHeight;
    const b = document.querySelector('.legal-bar'), r = b.getBoundingClientRect();
    const covers = [...sc.children].some(c => c !== b && (q => q.height && q.bottom > r.top + 1 && q.top < r.bottom - 1)(c.getBoundingClientRect()));
    return { bottom: Math.round(innerHeight - r.bottom), centre: Math.round(r.left + r.width / 2 - sc.clientWidth / 2), width: Math.round(r.width), vw: innerWidth,
      inScreen: b.parentElement === sc && getComputedStyle(b).position !== 'fixed', covers, shown: getComputedStyle(b).display !== 'none' };
  })()`);

  // Portada
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
  await page.reload();
  await page.waitFor(`document.querySelector('.title-panel') && document.querySelector('.legal-bar')`);
  const text = await page.eval(`document.querySelector('.legal-bar').textContent`);
  ok(/fan-game no oficial, gratuito y sin ánimo de lucro/.test(text) && /sin publicidad/.test(text), 'dice que es un fan-game no oficial, gratuito y sin ánimo de lucro, sin publicidad');
  ok(/Nintendo/.test(text) && /Creatures Inc/.test(text) && /GAME FREAK inc/.test(text) && /no está afiliado/i.test(text), 'avisa de que no está afiliado a Nintendo, Creatures ni GAME FREAK');
  ok(/© 1995-\d{4} Nintendo/.test(text) && /PMD SpriteCollab/.test(text) && /CC BY-NC 4\.0/.test(text), 'copyright y atribución de los sprites con su licencia');
  const hrefs = await page.eval(`[...document.querySelectorAll('.legal-bar a')].map(a => a.getAttribute('href')).join(' ')`);
  ok(/\/legal /.test(hrefs + ' ') && /\/legal#retirada/.test(hrefs) && /mailto:contact@pokearenas\.com/.test(hrefs), 'enlaza al aviso legal, a la retirada de contenido y al contacto');

  // Pegada abajo, centrada y ajustada al ancho, en tres tamaños de ventana
  for (const [w, h] of [[1280, 800], [820, 700], [380, 760]]) {
    await page.resize(w, h);
    const g = await geo();
    ok(g.bottom === 0 && Math.abs(g.centre) <= 1 && g.width <= g.vw, `${w}×${h}: pegada al borde de abajo, centrada y sin pasarse del ancho`);
    ok(g.inScreen && !g.covers, `${w}×${h}: va al final de la pantalla y no tapa nada`);
  }
  ok((await page.eval(`document.documentElement.scrollWidth <= innerWidth`)), 'en la ventana estrecha no aparece scroll horizontal');
  await page.resize();

  // Sigue en el menú, se esconde en combate y los enlaces funcionan
  const me = await player({ user: 'barralegal' });
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  await page.waitFor(`[...document.getElementById('screen').children].every(c => c.getAnimations().every(a => a.playState === 'finished'))`);   // tras su animación de entrada
  const g = await geo();
  ok(g.shown && g.bottom === 0 && !g.covers, 'también está en el menú del juego, al final y sin tapar nada');
  await page.eval(`document.body.classList.add('in-battle'); true`);
  await page.waitFor(`getComputedStyle(document.querySelector('.legal-bar')).display === 'none'`);
  ok(true, 'en combate se esconde');
  await page.eval(`document.body.classList.remove('in-battle'); true`);
  await page.waitFor(`getComputedStyle(document.querySelector('.legal-bar')).display !== 'none'`);
  await page.eval(`[...document.querySelectorAll('.legal-bar button.link')].find(b => /Créditos/.test(b.textContent)).click(); true`);
  await page.waitFor(`document.querySelector('.modal a[href^="/legal"]')`);
  ok(true, '«Créditos» abre los créditos, con el enlace al aviso legal completo');
};
