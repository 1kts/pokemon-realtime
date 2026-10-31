// La entrada y el perfil en el móvil: la portada cabe entera en horizontal; en el editor del avatar la foto no se sale
// de su círculo y las imágenes van en una sola lista con un buscador; la cuenta está a mano en la tarjeta de entrenador.
module.exports = async ({ page, player, ok }) => {
  // ---------- Portada: entera en pantalla, con cada pestaña ----------
  const cabe = async (w, h, tab) => {
    const r = await page.eval(`(() => { const r = document.querySelector('.title-panel').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; })()`);
    ok(r.t >= 0 && r.b <= h && r.l >= 0 && r.r <= w, `en ${w}×${h} la portada (${tab}) cabe entera (${Math.round(r.t)}-${Math.round(r.b)} de ${h})`);
  };
  for (const [w, h] of [[844, 390], [667, 375]]) {
    await page.resize(w, h);
    await page.goto('/');
    await page.eval(`localStorage.setItem('arena.touch', '1'); localStorage.setItem('arena.lang', 'es'); localStorage.setItem('arena.seenVersion', CHANGELOG[0].v); true`);
    await page.reload();
    await page.waitSee('Invitado');
    await cabe(w, h, 'Invitado');
    ok(await page.see('Jugar', { in: '.title-panel' }), `en ${w}×${h} «Jugar» se ve sin desplazar nada`);
    await page.tap('Iniciar sesión');
    await page.waitSee('Entrar', { in: '.title-panel' });
    await cabe(w, h, 'Iniciar sesión');
    await page.tap('Crear cuenta');
    await page.waitSee('Crear cuenta y jugar');
    await cabe(w, h, 'Crear cuenta');
    ok(await page.see('Repite la contraseña', { in: '.title-panel' }), `en ${w}×${h} se ven todos los campos de crear cuenta`);
  }

  // ---------- Cuenta en la tarjeta ----------
  const invitado = await player({ name: 'Gary' });
  invitado.client.send({ t: 'dev', dex: 4, level: 20, region: 'kanto' });
  await invitado.client.wait(m => m.t === 'profile');
  await page.loginAs(invitado.token);
  await page.tap('Perfil');
  await page.waitSee('Crear cuenta', { in: '.trainer-card' });
  ok(await page.see('Iniciar sesión', { in: '.trainer-card' }), 'un invitado ve en su tarjeta «Crear cuenta» e «Iniciar sesión» sin bajar');
  await page.tap('Crear cuenta', { in: '.trainer-card' });
  await page.waitSee('Repite la contraseña');
  await page.type('.modal input[autocomplete=username]', 'garyoak');
  await page.type('.modal input[autocomplete=new-password]', 'pikachu1');
  await page.type('.modal label:nth-of-type(3) input', 'pikachu1');
  await page.tap('Crear cuenta', { in: '.modal' });
  await page.waitSee('Cerrar sesión', { in: '.trainer-card' });
  ok(await page.see('@garyoak', { in: '.trainer-card' }), 'al crearla se cierra la ventana y la tarjeta dice la cuenta y «Cerrar sesión»');

  // ---------- Editor del avatar, en el móvil ----------
  const me = await player({ user: 'avatares' });
  for (const dex of [4, 25]) { me.client.send({ t: 'dev', dex, level: 50, region: 'kanto' }); await me.client.wait(m => m.t === 'profile'); }
  me.client.send({ t: 'dev', badges: 2, region: 'kanto' });
  await me.client.wait(m => m.t === 'profile');
  await page.resize(844, 390);
  await page.loginAs(me.token);
  await page.tap('Perfil');
  await page.waitSee('Cerrar sesión', { in: '.trainer-card' });
  await page.tap('Editar');
  await page.waitSee('Imagen', { in: '.ava-edit' });
  const foto = await page.eval(`(() => { const c = document.querySelector('.ae-preview .ava').getBoundingClientRect(), i = document.querySelector('.ae-preview canvas').getBoundingClientRect();
    return { dx: Math.abs((c.left + c.right) / 2 - (i.left + i.right) / 2), dy: Math.abs((c.top + c.bottom) / 2 - (i.top + i.bottom) / 2), cw: c.width, iw: i.width }; })()`);
  ok(foto.dx <= 2 && foto.dy <= 2 && foto.iw <= foto.cw, `la foto va centrada y dentro de su círculo (círculo ${foto.cw}, foto ${foto.iw}, desvío ${foto.dx},${foto.dy})`);
  ok(await page.see('Charmander', { in: '.ae-body' }), 'en Imagen se ven los Pokémon a la primera, sin bajar');
  ok(await page.eval(`document.querySelectorAll('.ae-body input[type=search]').length === 1`), 'hay un solo buscador');

  const busca = async q => {
    await page.eval(`(() => { const i = document.querySelector('.ae-body input[type=search]'); i.value = ''; return true; })()`);
    await page.type('.ae-body input[type=search]', q);
  };
  await busca('pokeball');
  await page.waitSee('Poké Ball', { in: '.ae-body' });
  ok(!(await page.see('Charmander', { in: '.ae-body', ms: 0 })), 'buscando «pokeball» sale la Poké Ball y no los Pokémon');
  ok(await page.see('Logro: Primera captura', { in: '.ae-body' }), 'y como no la tienes dice de dónde sale');
  await busca('charm');
  await page.waitSee('Charmander', { in: '.ae-body' });
  ok(!(await page.see('Poké Ball', { in: '.ae-body', ms: 0 })), 'buscando «charm» sale Charmander');
  await busca('cascada');
  await page.waitSee('Medalla Cascada', { in: '.ae-body' });
  await busca('zzzz');
  await page.waitSee('Nada coincide con tu búsqueda', { in: '.ae-body' });
  ok(true, 'sin resultados lo dice');
  await busca('pika');
  await page.waitSee('Pikachu', { in: '.ae-body' });
  await page.tap('Pikachu', { in: '.ae-body' });
  // (el dibujo de la foto, que es un canvas: el sprite que está pintando)
  const pinta = `document.querySelector('.ae-preview canvas')?.sprite?.img.src || ''`;
  ok(await page.waitFor(`/\\/(0*25)\\//.test(${pinta}) || /[-_/]0*25[-_.]/.test(${pinta})`).then(() => true, () => false), 'pulsar un Pokémon de la lista lo pone de foto');
};
