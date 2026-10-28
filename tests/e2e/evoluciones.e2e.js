// Evoluciones con imagen: en la ficha del Pokémon cada evolución sale con su sprite y cómo se consigue (el
// objeto con su imagen), en color si ya la has atrapado y apagada si no. Esc va hacia atrás: cierra la ficha
// y después vuelve de la pantalla al menú
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'evoluciones' });
  me.client.send({ t: 'dev', dex: 133, level: 20, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  me.client.send({ t: 'dev', dex: 135, level: 30, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);
  await page.waitFor(`window.__app.ui.view === 'menu'`);

  await page.eval(`window.__app.ui.show('team'); true`);
  await page.waitFor(`document.querySelector('.mon-card .mon-name')`);
  await page.eval(`[...document.querySelectorAll('.mon-card')].find(c => /Eevee/.test(c.textContent)).querySelector('.mon-name').click(); true`);
  await page.waitFor(`document.querySelector('.mon-sheet .evo-chips.big .evo-chip')`);
  const chip = name => `[...document.querySelectorAll('.mon-sheet .evo-chip')].find(c => c.textContent.includes('${name}'))`;
  ok(await page.eval(`(() => { const j = ${chip('Jolteon')}, v = ${chip('Vaporeon')};
    return !!j && !!v && !!j.querySelector('.evo-mon canvas, .evo-mon img') && !!j.querySelector('img.evo-item') && /Piedra Trueno/.test(j.textContent) && /Piedra Agua/.test(v.textContent); })()`),
    'la ficha de Eevee enseña cada evolución con su sprite y la piedra que necesita, con su imagen');
  ok(await page.eval(`${chip('Jolteon')}.classList.contains('got') && !${chip('Vaporeon')}.classList.contains('got')`), 'Jolteon (atrapado) sale en color y Vaporeon (sin atrapar) apagado');
  if (process.env.SHOTS) await page.shot(process.env.SHOTS + '/evoluciones.png');

  const esc = () => page.eval(`document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true })); true`);
  await esc();
  await page.waitFor(`!document.querySelector('.mon-sheet')`);
  ok(await page.eval(`window.__app.ui.view === 'team'`), 'Esc cierra la ficha y te deja en el equipo');
  await esc();
  await page.waitFor(`window.__app.ui.view === 'menu'`);
  ok(true, 'otro Esc vuelve al menú, como su botón de volver');
};
