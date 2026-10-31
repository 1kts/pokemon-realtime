// Tienda resumida: de un vistazo caben varios artículos con su nombre, precio, lo que tienes y «Comprar», sin desplazar.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'resumida' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 8, coins: 90000 }); await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.goto('/');
  await page.eval("localStorage.setItem('arena.touch', '1'); true");
  await page.loginAs(me.token);
  await page.tap('Tienda');
  await page.waitSee('Super Ball');
  for (const [w, h, min] of [[844, 390, 4], [667, 375, 2], [1280, 800, 12]]) {
    await page.resize(w, h);
    await page.waitSee('Poké Ball', { in: '.shop-sections' });
    const n = await page.eval(`[...document.querySelectorAll('.shop-item')].filter(c => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length`);
    ok(n >= min, `en ${w}×${h} se ven enteros al menos ${min} artículos sin desplazar (${n})`);
    const ball = await page.within('Super Ball', '.shop-item');
    ok(await page.see('Tienes: 0', { in: ball, ms: 0 }), `en ${w}×${h} la tarjeta dice lo que tienes`);
    ok(/\d/.test(await page.read('.price', { in: ball })), `en ${w}×${h} la tarjeta dice el precio`);
    ok(await page.see('Comprar', { in: ball, ms: 0 }), `en ${w}×${h} «Comprar» se ve`);
    await page.eval(`document.querySelector('#screen').scrollTop = 0; true`);
  }
};
