// Lucky Spin se cierra desde el panel de admin sin sacar versión (server/flags.js). Cerrado, un jugador no ve el botón
// de arriba y tocar sus gemas no lo abre (le dice que está cerrado); un admin lo sigue viendo, con el aviso de que
// está cerrado para los demás, y puede entrar. Abierto otra vez, vuelve para todos. (Que llegue al momento a los
// conectados y que el servidor rechace las tiradas lo prueba tools/admin-test.js; aquí se cambia en la base de datos,
// como el panel, y se vuelve a entrar)
const path = require('path');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
module.exports = async ({ page, player, ok, env }) => {
  const db = new DatabaseSync(env.DB_FILE);
  const setSpin = on => db.prepare('INSERT INTO flags (id, on_, at, by) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET on_ = excluded.on_').run('spin', on ? 1 : 0, Date.now(), 'e2e');
  const me = await player({ user: 'giradora' });
  const boss = await player({ user: 'jefaspin' });
  me.client.send({ t: 'dev', gems: 500 }); await me.client.wait(m => m.t === 'profile');
  boss.client.send({ t: 'dev', gems: 500 }); await boss.client.wait(m => m.t === 'profile');
  // (la jefa, admin: se da de alta por la consola, como en el servidor; antes, que su cuenta esté guardada)
  await new Promise(r => setTimeout(r, 1500));
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'admin.js'), 'alta', 'jefaspin', 'e2e'], { env, encoding: 'utf8' });
  ok(/Clave/.test(out), 'la jefa es admin');
  const spinBtn = `(() => { const b = document.querySelector('.hub-tz'); if (!b) return null; const r = b.getBoundingClientRect(); return { seen: r.width > 0, text: b.textContent }; })()`;
  const enter = async who => {
    await page.loginAs(who.token);
    await page.waitFor(`window.__app.ui.view === 'menu'`);
    await page.eval(`document.querySelectorAll('body > .modal').forEach(m => m.remove()); true`);   // atajo: fuera las ventanas de bienvenida (novedades, premio diario), que no son lo que se prueba
  };
  await page.resize(1280, 800);

  setSpin(false);
  await enter(me);
  ok(await page.eval(spinBtn) === null, 'cerrado, el jugador no ve Lucky Spin arriba');
  await page.click('.hub-me .pill.gems');
  await page.waitFor(`[...document.querySelectorAll('.toast')].some(x => /cerrado/.test(x.textContent))`);
  ok(await page.eval(`window.__app.ui.view`) === 'menu', 'y tocar sus gemas no lo abre: le dice que está cerrado');

  await enter(boss);
  const b = await page.eval(spinBtn);
  ok(b && b.seen && /Cerrado para los jugadores/.test(b.text), `la admin sí lo ve, con el aviso de que está cerrado para los demás (${b && b.text})`);
  await page.click('.hub-tz');
  await page.waitFor(`window.__app.ui.view === 'treasure'`);
  ok(true, 'y puede entrar para probarlo');

  setSpin(true);
  await enter(me);
  const back = await page.eval(spinBtn);
  ok(back && back.seen && !/Cerrado/.test(back.text), 'abierto otra vez, el jugador vuelve a verlo');
  db.close();
};
