// En Historia, Kanto y Johto se cambian desde dos botones grandes pegados al título (casi de su alto), y al lado salen
// las regiones que llegarán, apagadas y con «Próximamente»: una a una si caben y, si no, juntas en un botón. Nada de la
// cabecera se monta sobre otra cosa, y en el móvil siguen Kanto y Johto a mano.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'regiones' });
  for (const [dex, region] of [[4, 'kanto'], [155, 'johto']]) { me.client.send({ t: 'dev', dex, level: 20, region }); await me.client.wait(m => m.t === 'profile'); }
  const caja = `(q, txt) => { const e = [...document.querySelectorAll(q)].find(x => !txt || x.textContent.includes(txt)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }`;
  for (const [W, H, touch] of [[1920, 1000, false], [1280, 800, false], [844, 390, true]]) {
    const en = `${W}×${H}`;
    await page.resize(W, H);
    if (touch) await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.mode('Historia');
    if (W === 1920) await page.tap('¡A jugar!');   // (la primera vez se abre sola la guía de Historia)
    await page.waitSee('Kanto', { in: '.inner-bar' });
    const m = await page.eval(`(() => { const c = ${caja}; const bar = document.querySelector('.inner-bar'), cosas = [...bar.querySelectorAll('button, .badges-mini')].filter(e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden');
      const choques = []; for (let i = 0; i < cosas.length; i++) for (let j = i + 1; j < cosas.length; j++) { const a = cosas[i].getBoundingClientRect(), b = cosas[j].getBoundingClientRect();
        if (!cosas[i].contains(cosas[j]) && !cosas[j].contains(cosas[i]) && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) choques.push(cosas[i].textContent.trim().slice(0, 12) + ' / ' + cosas[j].textContent.trim().slice(0, 12)); }
      return { titulo: c('.feature-sign'), kanto: c('.inner-bar button', 'Kanto'), johto: c('.inner-bar button', 'Johto'), choques }; })()`);
    ok(m.kanto && m.johto && m.kanto.x - m.titulo.r < 30 && m.johto.x > m.kanto.x, `${en}: Kanto y Johto, justo a la derecha del título (${m.kanto && Math.round(m.kanto.x - m.titulo.r)} px)`);
    if (!touch) ok(m.kanto.h >= m.titulo.h * 0.8 && m.kanto.w >= 100, `${en}: y grandes, casi del alto del título (${Math.round(m.kanto.h)} de ${Math.round(m.titulo.h)} px)`);
    ok(!m.choques.length, `${en}: nada de la cabecera se monta sobre otra cosa (${m.choques.join(', ')})`);
    if (W === 1920) ok(await page.see('Hoenn', { in: '.inner-bar' }) && await page.see('Paldea', { in: '.inner-bar' }), `${en}: las regiones que llegarán, una a una (Hoenn… Paldea)`);
    if (W === 1280) ok(await page.see('Próximamente', { in: '.inner-bar' }), `${en}: si no caben, juntas en un botón «Próximamente»`);
    if (!touch) {
      await page.tap(W === 1920 ? 'Hoenn' : 'Próximamente', { in: '.inner-bar' });
      await page.waitSee(/todavía no está disponible/);
      ok(true, `${en}: tocar una que aún no está dice que llegará pronto`);
    }
    await page.tap('Johto', { in: '.inner-bar' });
    await page.waitSee(/Ruta 29/, { in: '.story-path' });
    ok(true, `${en}: el botón Johto lleva al camino de Johto`);
  }
};
