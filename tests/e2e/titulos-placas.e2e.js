// Logros → Títulos: cada título es una placa (rectangular, de esquinas casi rectas), no una pastilla redonda como los
// filtros de arriba con los que se confundía; lo que no tienes lleva su candado dibujado y dice de qué reto sale.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'titulera' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile');
  for (const [w, h, touch] of [[1280, 800, false], [844, 390, true]]) {
    await page.resize(w, h);
    if (touch) await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.tap(/Logros/);
    await page.waitSee('Retos');
    await page.tap('Títulos', { scroll: true });
    await page.waitSee(/Reto: /);
    // La forma: el filtro de arriba es una pastilla; cada título, una placa alta con las esquinas casi rectas
    const forma = await page.eval(`(() => { const f = [...document.querySelectorAll('.inner-bar button')].find(b => b.textContent.trim() === 'Títulos'), r = f.getBoundingClientRect();
      const fr = parseFloat(getComputedStyle(f).borderTopLeftRadius);
      const placas = [...document.querySelectorAll('.coll-body *')].filter(e => /^Reto: /.test((e.lastElementChild || {}).textContent || '') && e.getBoundingClientRect().width > 60);
      const p = placas[0], q = p.getBoundingClientRect();
      return { filtro: Math.min(fr, r.height / 2) / (r.height / 2), placa: parseFloat(getComputedStyle(p).borderTopLeftRadius) / (q.height / 2), alto: Math.round(q.height), n: placas.length,
        candado: !!p.querySelector('svg rect, svg path') && !/🔒/.test(p.textContent) }; })()`);
    ok(forma.n > 0 && forma.placa <= 0.3 && forma.filtro >= 0.6, `${w}×${h}: los títulos son placas de esquinas casi rectas y los filtros, pastillas: ya no se confunden (${JSON.stringify(forma)})`);
    ok(forma.candado, `${w}×${h}: los que no tienes llevan el candado dibujado, no un emoji que puede salir como un cuadro`);
  }
};
