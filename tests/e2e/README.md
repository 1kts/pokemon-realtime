# Tests e2e

El juego de verdad en un navegador de verdad: `tools/e2e.js` arranca el servidor con una base de datos
temporal (y `ARENA_DEV`, para el gancho de pruebas), abre Chromium sin ventana y ejecuta cada
`tests/e2e/*.e2e.js`. Un test falla si alguna comprobación falla, si la página tiene un error de JavaScript o
una violación de la CSP, o si carga algo de fuera de nuestro dominio.

```bash
npm run test:e2e                              # todos
node tools/e2e.js tests/e2e/admin.e2e.js      # uno
```

**Cada novedad para el jugador lleva su test e2e** (lo exige el hook de pre-push y el CI): uno que use la
novedad como lo haría un jugador, de principio a fin, y compruebe lo que ve.

```js
// tests/e2e/mi-novedad.e2e.js
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'alguien' });          // perfil con cuenta (por WebSocket)
  me.client.send({ t: 'dev', dex: 25, level: 30, region: 'kanto' });   // datos con el gancho de pruebas
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);                          // entra al menú con ese perfil
  await page.click('Mis Pokémon');                       // por texto visible o selector CSS
  await page.type('.mon-filters input', 'pika');
  ok(await page.eval(`document.querySelectorAll('.mon-card:not([hidden])').length`) === 1, 'buscar encuentra a Pikachu');
};
```

API: `page.goto/reload/eval/waitFor/click/type/shot/resize/loginAs`, `player({ name | user, pass })`,
`client()` (WebSocket directo, con `send/wait/ask`), `env` (el del servidor: `DB_FILE`…), `ok(cond, texto)`.

Chrome: el del sistema (`google-chrome`, `chromium`), el de Playwright si está en la caché, o la ruta en
`CHROME`. En GitHub Actions ya viene instalado.
