// Gráficos automáticos: la calidad que bajó sola en un móvil flojo (main.js, a menos de 40 FPS y, el último escalón,
// a menos de 30) se recuerda en el dispositivo: al volver a entrar empieza ya en ella, Ajustes dice cuál usa y «Volver a
// la calidad alta» la quita. (Que baje sola depende de los FPS de la máquina: aquí se parte de lo que quedó guardado)
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'movilflojo' });
  me.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' }); await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.goto('/');
  await page.eval("localStorage.setItem('arena.touch', '1'); localStorage.removeItem('arena.gfx'); true");
  await page.loginAs(me.token);
  await page.tap('Ajustes');
  await page.waitSee('Calidad ahora:', { scroll: true });
  ok(await page.see(/Calidad ahora:\s*Alta/, { scroll: true }) && !await page.see('Volver a la calidad alta', { ms: 0 }), 'en un dispositivo nuevo, la calidad es la alta');
  // Lo que dejó guardado la vez anterior un móvil que iba a menos de 30 FPS
  await page.eval("localStorage.setItem('arena.gfx', '4'); true");
  await page.loginAs(me.token);
  await page.tap('Ajustes');
  await page.waitSee('Calidad ahora:', { scroll: true });
  ok(await page.see(/Calidad ahora:\s*Muy baja\s*\(automática\)/, { scroll: true }), 'al volver a entrar empieza ya en la que le iba bien (Muy baja), y Ajustes lo dice');
  await page.tap('Volver a la calidad alta', { scroll: true });
  await page.waitFor(`document.querySelector('.title-panel button.primary')`, 20000);
  await page.loginAs(me.token);
  await page.tap('Ajustes');
  await page.waitSee('Calidad ahora:', { scroll: true });
  ok(await page.see(/Calidad ahora:\s*Alta/, { scroll: true }), '«Volver a la calidad alta» la devuelve a la alta');
};
