# Tests e2e

El juego de verdad en un navegador de verdad: `tools/e2e.js` arranca el servidor con una base de datos
temporal (y `ARENA_DEV`, para el gancho de pruebas), abre Chromium sin ventana y ejecuta cada
`tests/e2e/*.e2e.js`. Un test falla si alguna comprobación falla, si la página tiene un error de JavaScript o
una violación de la CSP, o si carga algo de fuera de nuestro dominio.

Al subir, el hook de pre-push no pasa tests: solo comprueba al momento que cada novedad trae su e2e, que el
código trae tests y que las notas de parche y las traducciones están bien. Los tests (`npm test` y la tanda
e2e completa) los pasa el CI en cada push a develop y main, y sin ellos no se despliega. Para pasarlos también
en local al subir: `LOCAL_TESTS=1 git push` (los e2e relacionados con lo que cambia) o `E2E_ALL=1 git push`
(todos).

```bash
npm run test:e2e                              # todos (4 a la vez)
node tools/e2e.js tests/e2e/admin.e2e.js      # uno
E2E_JOBS=1 npm run test:e2e                   # uno detrás de otro
E2E_SHARD=2/3 npm run test:e2e                # solo el trozo 2 de 3 (el CI reparte la tanda en 3 máquinas)
E2E_TIMES=1 npm run test:e2e                  # con lo que tarda cada prueba
E2E_SLOW=4 node tools/e2e.js tests/e2e/x.e2e.js   # con el navegador 4 veces más lento (para lo que solo falla en el CI)
```

Cada prueba tiene su propio servidor y su propio Chrome, así que se pasan varias a la vez: no compartas nada
entre pruebas ni dependas del orden. Lo que quieras escribir en la salida, con `log('…')` (no `console.log`, que
se mezclaría con las demás). Con varias a la vez todo va algo más lento: espera a que pase algo con `waitFor`,
no con pausas fijas.

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

API: `page.goto/reload/eval/waitFor/click/type/shot/resize/media/loginAs`, `player({ name | user, pass })`,
`client()` (WebSocket directo, con `send/wait/ask`), `env` (el del servidor: `DB_FILE`…), `ok(cond, texto)`.

Chrome: el del sistema (`google-chrome`, `chromium`), el de Playwright si está en la caché, o la ruta en
`CHROME`. En GitHub Actions ya viene instalado.

## Como un jugador

Las pruebas usan el juego como lo haría un jugador, y el arnés lo comprueba:

- `page.click(selector o texto)` es un clic de ratón de verdad: espera a que el elemento esté a la vista, activo, quieto
  (sin animaciones de entrada) y sin nada encima, y falla diciendo qué lo tapa. `page.type` teclea de verdad.
- `page.slide(selector, valor)` mueve un deslizador pulsando en su barra; `page.press(selector, ms)`,
  `page.fingerDown(selector)` y `page.fingerUp()` son toques con el dedo de verdad (un toque o una pulsación larga).
- `tools/e2e-lint.js` (en `npm test`) cuenta los atajos: `.click()` dentro de `page.eval`, `ui.show('…')` y teclas
  inventadas. No pueden crecer; el que haga falta de verdad lleva `// atajo: motivo`.
- `pantallas-*.e2e.js` (con `barrido.js`) recorren todas las pantallas y ventanas en 4 tamaños y falla si algo se sale de ancho, si un botón
  visible está tapado o si con el dedo un botón es demasiado pequeño. Con `E2E_GEOM=archivo.json` guarda dónde está cada
  cosa, para comparar un antes y un después al tocar el CSS.

