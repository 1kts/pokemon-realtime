// Tesoros: con gemas se abre la ruleta desde el menú, una tirada gira la rueda y da un premio (con su
// animación), cuesta lo que dice y lo conseguido queda marcado; los premios se ven con su rareza y su
// probabilidad, y un retrato ganado se puede poner de avatar
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'tesoros' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', gems: 150 });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(await page.eval(`document.querySelector('.hub-me .pill.gems').textContent.includes('150')`), 'las gemas salen arriba, junto al dinero');
  ok(await page.eval(`!!document.querySelector('.hub-left .hub-tz.ready')`), 'Lucky Spin sale arriba, en su burbuja junto a la de pantalla completa, y avisa de que hay gemas para tirar');
  await page.click('.hub-tz');
  await page.waitFor(`window.__app.ui.view === 'treasure' && document.querySelector('.tz-board')`);
  ok(await page.eval(`document.querySelectorAll('.tz-tab').length === 3 && document.querySelectorAll('.tz-card').length === 10 && document.querySelector('.tz-card:first-child').classList.contains('big')`), '3 ruletas, cada una con 10 premios y el más raro en grande en el centro');
  // Tocar un premio: su rareza y su probabilidad
  await page.click('.tz-card.r-mitico');
  await page.waitFor(`document.querySelector('.tz-card.r-mitico.sel')`);
  ok(await page.eval(`/Mítico/.test(document.querySelector('.tz-info').textContent) && /%/.test(document.querySelector('.tz-info').textContent)`), 'un premio enseña su rareza y su probabilidad');
  // Tiradas hasta que salga un retrato (o 6 como mucho)
  // (lo que se ve: las gemas de la cabecera y el precio de la tirada)
  const num = async sel => +(await page.read(sel)).replace(/\D/g, '');
  let spins = 0, gotPortrait = false;
  for (let i = 0; i < 6; i++) {
    const gems = await num('.inner-bar .pill.gems'), cost = await num('.tz-price b');
    if (i === 0) ok(gems === 150 && cost > 0, `arriba salen tus gemas (${gems}) y la tirada dice lo que cuesta (${cost})`);
    await page.tap('¡Tirar!');
    await page.waitFor(`document.querySelector('.loot-pop')`, 15000);
    if (i === 0) ok(await page.see(/Premio/, { in: '.loot-pop' }), 'la tirada enciende las cartas por turnos y sale el premio con su rareza');
    // (un retrato se puede poner de avatar desde el propio premio)
    const portrait = await page.see('Usar de avatar', { in: '.loot-pop', ms: 0 });
    if (portrait) await page.tap('Usar de avatar', { in: '.loot-pop' }); else await page.click('.loot-pop .acts .primary');
    await page.waitFor(`!document.querySelector('.loot-pop:not(.out)')`);
    const left = await num('.inner-bar .pill.gems');
    ok(left === gems - cost, `la tirada ${i + 1} cuesta lo que decía: ${gems} − ${cost} = ${left}`);
    spins++;
    if (portrait) { gotPortrait = true; break; }
  }
  const n = await page.eval(`document.querySelectorAll('.tz-card.got').length`);
  ok(n === spins && await page.read('.tz-bar .tz-progress b') === `${n}/10`, `lo conseguido queda marcado (${n} de ${spins} tiradas: ${n}/10)`);
  if (gotPortrait) {
    await page.tap('Volver');
    ok(await page.waitFor(`document.querySelector('.hub-ava .pt-face img.pt-img')`).then(() => true, () => false), '«Usar de avatar» en el retrato ganado lo pone de avatar: la cara de cerca con su efecto');
  }
};
