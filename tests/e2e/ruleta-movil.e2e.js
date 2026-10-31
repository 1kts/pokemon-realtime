// Lucky Spin en el móvil, en horizontal: de un vistazo se entiende qué es y qué se gana (qué da una tirada, el gran
// premio, la rareza de cada premio, lo conseguido, las probabilidades) y la tirada cuesta lo que pone: 9 gemas la primera.
module.exports = async ({ page, player, ok }) => {
  for (const [w, h] of [[844, 390], [667, 375]]) {
    const me = await player({ user: `ruleta${w}` });
    me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto', gems: 150, tutorial: false });
    await me.client.wait(m => m.t === 'profile');
    await page.resize(w, h);
    await page.goto('/');
    await page.eval("localStorage.setItem('arena.touch', '1'); true");
    await page.loginAs(me.token);
    await page.tap(/Lucky Spin/);
    await page.waitSee('¡Tirar!');
    const zona = `${w}×${h}`;
    ok(await page.see(/Cada tirada te da uno de estos premios/), `${zona}: se explica qué da una tirada`);
    ok(await page.see('Gran premio', { in: '.tz-strip' }), `${zona}: el gran premio se distingue en la tira`);
    ok(await page.see(/Épico|Legendario/, { in: '.tz-track' }), `${zona}: los premios dicen su rareza`);
    const solape = await page.eval(`document.querySelector('.feature-sign').getBoundingClientRect().right - document.querySelector('.inner-bar .pill.gems').getBoundingClientRect().left`);
    ok(solape <= 0, `${zona}: el letrero no tapa las gemas (se pisan ${solape} px)`);
    ok(await page.see('Conseguido'), `${zona}: se lee qué es el 0/10`);
    ok(await page.see('Probabilidades'), `${zona}: el botón de las probabilidades dice lo que es`);
    const nombres = await page.eval(`[...document.querySelectorAll('.tz-strip .tz-name')].filter(n => n.scrollHeight > n.clientHeight + 1).map(n => n.textContent)`);
    ok(nombres.length === 0, `${zona}: ningún nombre de premio se corta (${nombres})`);
    if (w !== 844) continue;   // (la tirada, una vez basta: tarda)
    const num = async sel => +(await page.read(sel)).replace(/\D/g, '');
    const gems = await num('.inner-bar .pill.gems'), cost = await num('.tz-price b');
    ok(gems === 150 && cost === 9, `${zona}: tienes 150 gemas y la primera tirada cuesta 9 (${gems} y ${cost})`);
    await page.tap('¡Tirar!');
    await page.waitSee(/Premio/, { in: '.loot-pop' });
    await page.click('.loot-pop .acts .primary');
    await page.waitFor(`!document.querySelector('.loot-pop:not(.out)')`);
    await page.waitSee('¡Tirar!');
    const left = await num('.inner-bar .pill.gems'), next = await num('.tz-price b');
    ok(left === 141, `${zona}: la tirada cobra lo que ponía: quedan ${left} gemas`);
    ok(next === 13, `${zona}: la siguiente cuesta algo más: ${next}`);
  }
};
