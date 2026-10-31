// El Camino de Historia se arrastra con el ratón, de lado, como con el dedo; soltar tras arrastrar no elige la tarjeta
// sobre la que acabas, y un clic normal la sigue eligiendo.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'arrastre' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.eval(`localStorage.setItem('arena.storyGuide', '1'); true`);   // (la guía de la primera vez, ya vista)
  await page.resize(1280, 800);
  await page.tap(/^Historia/);
  await page.waitSee('Desafiar');
  const left = `document.querySelector('.story-path').scrollLeft`;
  const ficha = `document.querySelector('.story-side h3').innerText`;
  const zona = await page.eval(`(() => { const c = document.querySelector('.sp-route .sp-card').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; })()`);
  const antes = await page.eval(left), elegida = await page.eval(ficha);
  await page.mouseDrag(zona.x + 300, zona.y, zona.x, zona.y);   // (hacia la izquierda: el Camino avanza)
  const luego = await page.eval(left);
  ok(luego > antes + 200, `arrastrar con el ratón mueve el Camino (${Math.round(antes)} → ${Math.round(luego)})`);
  ok(await page.eval(ficha) === elegida, `soltar tras arrastrar no elige otra tarjeta (${elegida})`);
  await page.mouseDrag(zona.x, zona.y, zona.x + 300, zona.y);
  ok(await page.eval(left) < luego - 200, 'arrastrar al otro lado lo devuelve');
  await page.tap('Desafiar');
  ok(await page.title() === '', 'un clic normal en «Desafiar» sigue llevando al combate');
};
