// Tienda: desde el menú se compra lo que se pulsa, al precio que pone. Comprar una Super Ball resta su precio del
// dinero de arriba y la suma a «Tienes»; lo que pide más medallas sale bloqueado y no se puede comprar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'compradora2' });
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 }); await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.tap('Tienda');
  await page.waitSee('Poké Balls');
  ok(await page.title() === 'Tienda', 'el menú abre la Tienda');

  const money = async () => +(await page.read('.inner-bar .pill.coins')).replace(/\D/g, '');
  const ball = await page.within('Super Ball', '.shop-item');
  const price = +(await page.read('.price', { in: ball })).replace(/\D/g, '');
  const before = await money();
  ok(price > 0 && await page.see('Tienes: 0', { in: ball, scroll: true }), `la Super Ball dice su precio (${price}) y que no tienes ninguna`);
  await page.tap('Comprar', { in: ball });
  await page.waitSee('Tienes: 1', { in: ball, scroll: true });
  ok(true, '«Comprar» en la Super Ball te da una Super Ball');
  ok(await money() === before - price, `y cuesta lo que pone: ${before} − ${price} = ${await money()}`);

  // Lo que pide más medallas: bloqueado, sin botón de comprar
  const ultra = await page.within('Ultra Ball', '.shop-item');
  ok(await page.see('Requiere 5 medallas', { in: ultra, scroll: true }), 'la Ultra Ball (5 medallas) dice que la necesita');
  ok(!(await page.see('Comprar', { in: ultra, ms: 0 })), 'y no tiene botón de comprar');
};
