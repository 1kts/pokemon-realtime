// En el móvil en horizontal: la ficha de ruta dice lo justo con «Explorar» a la vista; Mis Pokémon enseña muchos de un
// vistazo y lo demás sigue en su ficha; y el editor del avatar lleva pestañas, filtro y buscador en una fila.
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'compacto' });
  for (const dex of [4, 16, 19, 25, 7, 1, 10, 13, 41, 74, 92]) { me.client.send({ t: 'dev', dex, level: 20, region: 'kanto', item: 'caramelo', qty: 2 }); await me.client.wait(m => m.t === 'profile'); }
  await page.goto('/');
  await page.eval(`localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.storyGuide', '1'); true`);
  for (const [w, h] of [[844, 390], [667, 375]]) {
    const en = `${w}×${h}`;
    await page.resize(w, h);
    await page.loginAs(me.token);
    await page.tap(/^Historia/);
    await page.waitSee('Explorar', { in: '.story-side' });
    ok(await page.see(/\d+ %/, { in: '.route-list' }), `${en}: la ruta dice la probabilidad de cada Pokémon`);
    ok(!(await page.see(/Nv\.\d+-\d+$/, { in: '.route-list .mini', ms: 0 })), `${en}: sin repetir el nivel en cada Pokémon`);
    ok(await page.see(/Nv\.\d+-\d+/, { in: '.story-side' }), `${en}: el nivel de la ruta sigue en su ficha`);
    const fits = await page.eval(`(() => { const s = document.querySelector('.story-side .node-info').getBoundingClientRect(); return [...document.querySelectorAll('.route-list .mini')].filter(m => { const r = m.getBoundingClientRect(); return r.bottom <= s.bottom && r.top >= s.top; }).length; })()`);
    const tandas = await page.eval(`document.querySelectorAll('.route-list .mini').length`);
    ok(fits === tandas, `${en}: los ${tandas} Pokémon de la ruta se ven sin bajar (${fits})`);
    // En combate, cinco botones regulares, grandes y sin pisarse con nada
    await page.tap('Explorar', { in: '.story-side' });
    await page.waitFor(`window.__app.battle && window.__app.battle.latest && window.__app.battle.latest.state === 'fight'`, 40000);
    const mandos = await page.eval(`(() => { const rs = q => [...document.querySelectorAll(q)].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); const pisa = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      const mv = rs('#hud .mv'), otros = [...rs('#hud .balls .ball'), ...rs('#hud .energy'), ...rs('#hud .team.foe')]; let cruces = 0;
      mv.forEach((a, i) => { mv.slice(i + 1).forEach(b => { if (pisa(a, b)) cruces++; }); otros.forEach(b => { if (pisa(a, b)) cruces++; }); });
      return { n: mv.length, cruces, min: Math.min(...mv.map(r => Math.min(r.width, r.height))), fuera: mv.filter(r => r.right > innerWidth || r.bottom > innerHeight).length }; })()`);
    ok(mandos.n === 5 && mandos.min >= 44 && !mandos.cruces && !mandos.fuera, `${en}: cinco botones de al menos 44 px sin pisarse (${JSON.stringify(mandos)})`);
    await page.loginAs(me.token);
    await page.tap('Mis Pokémon');
    await page.waitSee('Charmander', { in: '.mon-card' });
    const seen = await page.eval(`[...document.querySelectorAll('.mon-card')].filter(c => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length`);
    ok(seen >= 6, `${en}: se ven al menos 6 Pokémon sin bajar (${seen})`);
    const card = await page.within('Charmander', '.mon-card');
    ok(await page.see(/Nv\.\d+/, { in: card }) && await page.see('Fuego', { in: card }), `${en}: cada tarjeta dice nivel y tipo`);
    ok(!(await page.see('Ascuas', { in: card, ms: 0 })) && !(await page.see('Vender', { in: card, ms: 0 })), `${en}: ni movimientos ni vender en la tarjeta`);
    await page.click(card);
    await page.waitSee('Vender', { in: '.mon-sheet' });
    ok(await page.see('Caramelo Raro', { in: '.mon-sheet' }), `${en}: vender y el Caramelo Raro siguen en su ficha`);
    await page.loginAs(me.token);
    await page.tap('Perfil');
    await page.click('.trainer-card .ava');
    await page.waitSee('Marco', { in: '.ae-tabs' });
    const altura = q => `(() => { const r = document.querySelector('${q}').getBoundingClientRect(); return r.top + r.height / 2; })()`;
    const lejos = async q => Math.abs(await page.eval(altura('.ae-tabs')) - await page.eval(altura(q)));
    const buscador = await lejos('.ava-edit input[type=search]');
    await page.tap('Marco', { in: '.ae-tabs' });
    await page.waitSee('Todos', { in: '.own-filter' });
    const filtro = await lejos('.ava-edit .own-filter');
    const fila = await page.eval(`(() => { const ae = document.querySelector('.ae-body').getBoundingClientRect(); return { lista: ae.height / innerHeight, dentro: ae.bottom <= innerHeight }; })()`);
    fila.misma = buscador < 14 && filtro < 14;
    ok(fila.misma, `${en}: pestañas, filtro y buscador van en una sola fila`);
    ok(fila.lista >= 0.55 && fila.dentro, `${en}: la lista ocupa la mayor parte de la pantalla (${fila.lista.toFixed(2)})`);
    // Tarjeta de perfil: los botones de la cuenta, a la derecha y sin pisar los datos
    await page.key('Escape');
    await page.loginAs(me.token);
    await page.tap('Perfil');
    await page.waitSee('Cerrar sesión', { in: '.trainer-card' });
    const tc = await page.eval(`(() => { const r = q => document.querySelector(q).getBoundingClientRect(), a = r('.tc-acc'), c = r('.trainer-card'), name = [...document.querySelectorAll('.tc-info > *')].filter(x => !x.classList.contains('tc-acc')).every(x => { const b = document.createRange(); b.selectNodeContents(x); const q = b.getBoundingClientRect(); return q.right <= a.left + 1 || q.bottom <= a.top || q.top >= a.bottom; }); return { derecha: a.left > c.left + c.width / 2, libre: name, alto: c.height }; })()`);
    ok(tc.derecha && tc.libre, `${en}: la cuenta va a la derecha y no pisa los datos (${JSON.stringify(tc)})`);
  }
};
