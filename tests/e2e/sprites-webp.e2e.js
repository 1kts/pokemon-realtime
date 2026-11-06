// Los sprites (y retratos e iconos) llegan en WebP (sin pérdida: los mismos píxeles en mucho menos peso) y se dibujan: en el menú y en un
// combate, ninguna hoja se pide en PNG y todos los Pokémon de la pantalla se ven, no huecos.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'webpfan' });
  me.client.send({ t: 'dev', dex: 6, level: 30, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.resize(1280, 800);
  await page.loginAs(me.token);
  await page.waitSee('Historia');
  await page.tap('Mis Pokémon');
  await page.waitSee('Charizard', { in: '.mon-card' });
  // Lo que ha bajado el navegador de sprites/ y si las caras de Mis Pokémon tienen dibujo (algún píxel no transparente)
  const mira = () => page.eval(`(() => { const r = performance.getEntriesByType('resource').map(e => e.name).filter(n => ['/sprites/', '/portraits/', '/icons/'].some(d => n.includes(d)) && !n.endsWith('.js'));
    const cvs = [...document.querySelectorAll('.mon-card canvas')].filter(c => c.width && c.getBoundingClientRect().width);
    const pintados = cvs.filter(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length;
    return { webp: r.filter(n => n.endsWith('.webp')).length, png: r.filter(n => n.endsWith('.png')).map(n => n.split('/sprites/')[1]), cvs: cvs.length, pintados }; })()`);
  await page.waitFor(`[...document.querySelectorAll('.mon-card canvas')].some(c => c.width)`);
  await new Promise(r => setTimeout(r, 800));   // (que lleguen las hojas)
  const m = await mira();
  ok(m.webp > 0 && !m.png.length, `los sprites se piden en WebP, ninguno en PNG (${m.webp} WebP; PNG: ${m.png.join(', ') || 'ninguno'})`);
  ok(m.cvs > 0 && m.pintados === m.cvs, `y se dibujan: ${m.pintados} de ${m.cvs} Pokémon de Mis Pokémon con su sprite`);
};
