// En Lucky Spin, el premio de efecto se enseña sobre el Pokémon de esa ruleta (en la de Cyndaquil, Cyndaquil con sus
// llamas), no sobre tu avatar: con tu Charmander parecía que la ruleta era de otro. Se mira en los píxeles del dibujo.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'ruletaefecto' });
  me.client.send({ t: 'dev', dex: 4, level: 8, region: 'kanto', gems: 50 });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.waitSee('Historia');
  await page.click('.hub-tz');
  await page.waitSee(/Efecto \p{L}+/u);
  for (const rueda of await page.eval(`[...document.querySelectorAll('.tz-tabs button, .tz-tab')].map(b => b.querySelector('b').textContent.trim())`)) {
    if (!/Ruleta de/.test(rueda)) continue;
    await page.tap(rueda);
    await page.waitSee(/Efecto \p{L}+/u);
    await new Promise(r => setTimeout(r, 800));   // (que se hayan pintado los sprites)
    // El dibujo del premio de efecto, comparado píxel a píxel con el retrato de cada candidato al mismo tamaño
    const r = await page.eval(`(async () => {
      const card = [...document.querySelectorAll('.tz-card')].find(c => /^Efecto /.test(c.querySelector('.tz-name')?.textContent || '')), cv = card && card.querySelector('canvas');
      if (!cv) return { error: 'sin dibujo' };
      const S = await import('/js/sprites.js'), D = window.Data, tab = ${JSON.stringify(rueda)}, line = Object.values(D.SPECIES).find(s => tab.endsWith(' ' + s.name)).dex;
      const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const diff = async dex => { const ref = S.portrait(dex, cv.width); for (let i = 0; i < 40 && !px(ref).some(v => v); i++) await new Promise(r => setTimeout(r, 50));
        const a = px(cv), b = px(ref); let d = 0; for (let i = 3; i < a.length; i += 4) d += (a[i] > 127) !== (b[i] > 127); return d; };
      return { line, suyo: await diff(line), avatar: await diff(4) }; })()`);
    ok(r.line !== 4 && r.suyo < r.avatar / 4, `${rueda}: el efecto se ve sobre su Pokémon y no sobre tu Charmander (${JSON.stringify(r)})`);
  }
};
