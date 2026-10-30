# Tests e2e

El juego de verdad en un navegador de verdad: `tools/e2e.js` arranca el servidor con una base de datos
temporal (y `ARENA_DEV`, para el gancho de pruebas), abre Chromium sin ventana y ejecuta cada
`tests/e2e/*.e2e.js`. Un test falla si alguna comprobación falla, si la página tiene un error de JavaScript o
una violación de la CSP, o si carga algo de fuera de nuestro dominio.

**Antes de escribir o cambiar un test, lee la skill `tests` (`.claude/skills/tests/SKILL.md`)**: qué está prohibido
y por qué, rojo primero y las mutaciones. Aquí, lo práctico.

```bash
npm run test:e2e                              # todos (4 a la vez)
node tools/e2e.js tests/e2e/admin.e2e.js      # uno
E2E_JOBS=1 npm run test:e2e                   # uno detrás de otro
E2E_SHARD=2/3 npm run test:e2e                # solo el trozo 2 de 3 (el CI reparte la tanda en 6 máquinas)
E2E_TIMES=1 npm run test:e2e                  # con lo que tarda cada prueba
E2E_SLOW=4 node tools/e2e.js tests/e2e/x.e2e.js   # con el navegador 4 veces más lento (para lo que solo falla en el CI)
E2E_TIMEOUT=600 node tools/e2e.js …           # hasta 10 min por prueba y todas las esperas el doble (máquinas lentas)
E2E_BROWSER=webkit node tools/e2e.js tests/e2e/movil.e2e.js   # en WebKit, el motor del Safari del iPhone (abajo)
```

Al subir, el hook de pre-push no pasa tests: solo comprueba al momento que cada novedad trae su e2e y su mutación,
que el código trae tests, que los e2e cambiados no son más complacientes (`tools/e2e-lint.js`), que la nota de
mutaciones no baja y que las notas de parche y las traducciones están bien. Los tests (`npm test`, la tanda e2e
completa y rojo primero) los pasa el CI en cada push a develop y main, y sin `npm test` no se despliega. Para pasarlos
también en local al subir: `LOCAL_TESTS=1 git push` (los e2e relacionados con lo que cambia) o `E2E_ALL=1 git push`.

Cada prueba tiene su propio servidor y su propio Chrome, así que se pasan varias a la vez: no compartas nada
entre pruebas ni dependas del orden. Lo que quieras escribir en la salida, con `log('…')` (no `console.log`, que
se mezclaría con las demás). Espera a que pase algo con `waitSee` o `waitFor`, no con pausas fijas.

**Cada novedad para el jugador lleva su test e2e** (lo exige el hook de pre-push y el CI): uno que use la
novedad como lo haría un jugador, de principio a fin, y compruebe lo que ve. Y su mutación en `tests/mutaciones.js`.

```js
// tests/e2e/mi-novedad.e2e.js — qué hace el jugador y qué ve, en una o dos líneas
module.exports = async ({ page, player, ok }) => {
  const me = await player({ user: 'alguien' });                         // perfil con cuenta (por WebSocket)
  me.client.send({ t: 'dev', dex: 25, level: 30, region: 'kanto' });    // datos con el gancho de pruebas
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);                                         // entra al menú con ese perfil
  await page.tap('Mis Pokémon');                                        // el botón que lo dice, con un clic de verdad
  await page.type('.mon-filters input', 'pika');                        // teclea de verdad
  ok(await page.see('Pikachu') && !(await page.see('Charmander', { ms: 0 })), 'buscar «pika» deja a Pikachu');
};
```

## API

Lo que ve el jugador (para los `ok`):

| | |
|---|---|
| `page.see(texto \| /re/, { in, ms, scroll })` | `true` si se ve: en pantalla, dentro de la ventana, sin nada encima (espera hasta `ms`, 5 s). Si da `false`, el `ok()` siguiente dice por qué |
| `page.waitSee(texto, opts)` | espera a que se vea (15 s) o falla diciendo por qué no |
| `page.title()` | qué pantalla ve el jugador: el título de la ventana de encima o el letrero de la pantalla («Tienda»); el logo en el menú; «¡Victoria!»/«Derrota» en los resultados; `''` en combate |
| `page.read(selector)` | el texto visible de un sitio (`''` si no se ve) |
| `page.within(texto, selector)` | el sitio (de los que cumplen el selector) que dice ese texto, para `{ in }` |

Entradas de verdad:

| | |
|---|---|
| `page.tap(nombre \| /re/, { in, nth })` | el botón (enlace, pestaña, tarjeta pulsable) que dice eso (texto, `aria-label` o tooltip), con un clic de verdad; falla si no se ve, si está tapado o si hay varios iguales |
| `page.click(selector \| texto)` | clic de ratón de verdad en su centro; espera a que esté a la vista, activo y quieto, y falla diciendo qué lo tapa |
| `page.type(selector, texto)` | teclea de verdad (y al acabar, `change`) |
| `page.key(code, ms)` | una tecla del navegador: `'Escape'`, `'KeyD'`, `'Digit2'`, `'Space'`, flechas… |
| `page.mouseAt(x, y, { click, button })` | el ratón en un punto (apuntar en la arena 3D) |
| `page.slide(selector, valor)` | mueve un deslizador pulsando en su barra |
| `page.press(selector, ms)`, `page.fingerDown(selector)`, `page.fingerUp()` | el dedo de verdad en el centro del elemento: un toque, o una pulsación larga (como el clic, falla si no se ve o algo lo tapa) |
| `page.fingerAt(x, y)`, `page.fingerMove(x, y)` | el dedo en un punto y arrastrándolo (el joystick, apuntar un movimiento) |

Y además: `page.goto/reload/eval/waitFor/shot/resize/loginAs`, `player({ name | user, pass })`, `client()`
(WebSocket directo, con `send/wait/ask`), `env` (el del servidor: `DB_FILE`…), `ok(cond, texto)`, `log(texto)`.

Chrome: el del sistema (`google-chrome`, `chromium`), el de Playwright si está en la caché, o la ruta en
`CHROME`. En GitHub Actions ya viene instalado.

## Como un jugador

- `tools/e2e-lint.js` (en `npm test`, el hook y el CI) cuenta lo complaciente: atajos (`.click()` dentro de
  `page.eval`, `ui.show('…')`, teclas inventadas), llamadas directas al juego (`__app.net.send`, `__app.ui.algo()`,
  eventos de puntero inventados), `ok()` que miran `__app` y `ok(true, …)` que no van justo después de un
  `await page.waitSee(…)`. Un e2e nuevo no puede tener ninguno; uno cambiado, no más que antes; y los totales
  (`tests/e2e/lint-base.json`) solo bajan. El que haga falta de verdad lleva `// atajo: motivo`.
- `pantallas-*.e2e.js` (con `barrido.js`) recorren todas las pantallas y ventanas en 4 tamaños y fallan si algo se sale
  de ancho, si un botón visible está tapado o si con el dedo un botón es demasiado pequeño. Con `E2E_GEOM=archivo.json`
  guardan dónde está cada cosa, para comparar un antes y un después al tocar el CSS.
- Móvil: 844×390 y 667×375 en horizontal, con `localStorage arena.touch = '1'`.

## Rojo primero y mutaciones

- `tools/rojo-primero.js` (job `rojo-primero` del CI): cada test nuevo o cambiado se pasa contra el código de antes
  de la subida y tiene que fallar. `Rojo-con: <mutación>` en el commit si endurece un test sin cambiar el juego;
  `Sin-rojo: motivo` si de verdad no aplica.
- `tools/mutar.js` con `tests/mutaciones.js`: fallos pequeños que el jugador notaría y los tests que deben cazarlos.
  La nota (`tests/mutaciones-nota.json`) no baja; cada noche el CI las pasa todas (job `mutaciones`).

## WebKit (Safari del iPhone)

`E2E_BROWSER=webkit` abre WebKit con Playwright en vez de Chrome (las pruebas son las mismas: el arnés traduce sus
órdenes a las de Playwright). Hace falta Playwright y su WebKit:

```bash
npm i --no-save playwright && npx playwright install --with-deps webkit
E2E_BROWSER=webkit node tools/e2e.js tests/e2e/movil.e2e.js tests/e2e/pantallas-movil.e2e.js
```

El CI pasa así los de móvil (`movil*.e2e.js` y `pantallas-movil*.e2e.js`) en el job `webkit`. Diferencias con
Chrome: `E2E_SLOW` no hace nada, y un dedo que se queda puesto (`fingerDown` de más de 300 ms) son eventos de
puntero y de toque de la página (Playwright solo tiene toques enteros); un toque corto sí es de verdad.
`E2E_BROWSER=chromium-pw` hace lo mismo con el Chromium de Playwright (para comprobar el arnés sin WebKit); con él aún
fallan `movil` y `movil-menus` por esa diferencia del dedo (por eso el job `webkit` no tumba el CI).
