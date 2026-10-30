---
name: tests
description: Cómo se escriben, cambian y revisan los tests de PokéArenas para que sean estrictos y no complacientes (e2e con el arnés tools/e2e.js y los tools/*-test.js), con rojo primero y pruebas de mutación. Úsala SIEMPRE que se escriba, cambie o revise un test, se añada una funcionalidad o se arregle un fallo (aunque no se pidan tests), y cuando un test falle o haya que decidir si cambiarlo.
---

# Tests estrictos en PokéArenas

Un test **complaciente** pasa aunque el juego falle: lo escribe quien escribe el código, mira lo que el código ya
hace (una clase CSS, una variable interna) y dice en su mensaje más de lo que comprueba. Aquí cada test se escribe
pensando en **cómo podría fallar el juego para el jugador** y comprueba eso, con lo que ve el jugador y con las
entradas que usa. Hay controles automáticos (lint, rojo primero, mutaciones) que hacen fallar el hook y el CI si no.

## 1. Antes de escribir: qué fallo cazaría

Escribe primero, en una frase, qué notaría el jugador si la funcionalidad se rompe («“Comprar” no compra», «cobra
más de lo que pone», «la medalla no sale»). Eso es lo que el test tiene que comprobar, y es la **mutación** que
añadirás a `tests/mutaciones.js` (sección 5). Si no sabes decir qué fallo caza, el test no prueba nada.

## 2. Cómo se escribe un e2e

El arnés (`tools/e2e.js`) arranca un servidor con base de datos temporal y `ARENA_DEV` y un Chromium sin ventana,
y ejecuta `tests/e2e/*.e2e.js`. Falla también si la página tiene un error de JavaScript, una violación de la CSP
o carga algo de fuera. Cada prueba tiene su servidor y su navegador: nada compartido, nada dependiente del orden.

```js
// tests/e2e/tienda.e2e.js — una línea de qué hace el jugador y qué ve
module.exports = async ({ page, player, ok, log }) => {
  const me = await player({ user: 'compradora' });                    // perfil con cuenta (por WebSocket)
  me.client.send({ t: 'dev', dex: 4, level: 12, region: 'kanto', badges: 2 });   // preparar datos (gancho dev)
  await me.client.wait(m => m.t === 'profile');
  await page.loginAs(me.token);                                         // entra al menú con «Continuar como…»
  await page.tap('Tienda');                                             // el botón que dice «Tienda», clic de verdad
  await page.waitSee('Poké Balls');                                     // espera a que se vea
  const ball = await page.within('Super Ball', '.shop-item');           // la tarjeta que dice «Super Ball»
  await page.tap('Comprar', { in: ball });
  await page.waitSee('Tienes: 1', { in: ball, scroll: true });
  ok(true, '«Comprar» en la Super Ball te da una Super Ball');          // ok(true) solo justo tras waitSee
};
```

### Lo que ve el jugador (úsalo en los ok)
- `page.see(texto | /regex/, { in, ms, scroll })` → `true` si el texto está en pantalla: visible, dentro de la
  ventana y sin nada encima (espera hasta 5 s). No desplaza salvo `scroll: true`. Si da `false`, el `ok()` que va
  detrás dice por qué (tapado por…, fuera de la ventana, oculto). `{ ms: 0 }` para comprobar que **no** se ve.
- `page.waitSee(texto, opts)` → como `see` pero para esperar: falla si en 15 s no se ve.
- `page.title()` → qué pantalla ve el jugador: el título de la ventana de encima, o el letrero de la pantalla
  («Tienda», «Mis Pokémon»), el logo en el menú y la portada, «¡Victoria!»/«Derrota» en los resultados; `''` en combate.
- `page.read(selector)` → el texto visible de un sitio (`''` si no se ve): para números («+600», «Tienes: 3»).
- `page.within(texto, selector)` → el sitio (p. ej. la `.shop-item`) que dice ese texto, para usarlo en `{ in }`.

### Como un jugador (entradas de verdad)
- `page.tap(nombre | /regex/, { in, nth })`: busca el botón (o enlace, pestaña, tarjeta pulsable) por lo que lee el
  jugador (texto, `aria-label`, tooltip) y hace un clic de verdad. Falla si no se ve, si está tapado o si hay varios
  iguales (di cuál con `{ in }`). Es lo primero que se usa.
- `page.click(selector | texto)`: clic de ratón de verdad en el centro, con *hit-testing*: falla si algo lo tapa.
- `page.type(selector, texto)`, `page.slide(selector, valor)`, `page.key('Escape' | 'KeyD' | 'Digit2' | 'Space', ms)`
  (teclas del navegador, no eventos inventados), `page.mouseAt(x, y, { click })` (apuntar en la arena 3D),
  `page.press(selector, ms)`, `page.fingerDown(selector)` / `page.fingerUp()` (el dedo de verdad, en el centro y
  comprobando como el clic que llega a su sitio), `page.fingerAt(x, y)` / `page.fingerMove(x, y)` (arrastrar).
- `page.waitFor(expr, ms)`: esperar algo de la página (puede mirar `window.__app`: esperar no es comprobar).
- `page.eval(expr)`: para preparar o leer cosas que no se ven (dónde está el rival en el 3D). Nunca para pulsar.
- Escucha en el documento, no en un elemento: muchas pantallas se repintan solas cada poco (el menú, con los que hay en
  línea) y el botón al que le pusiste el oído ya no es el que se ve (así un test daba por bueno un toque que no llegó).
- Una comprobación de tiempo («no sale al momento») se mide con el reloj de la página (`setTimeout` dentro), no desde
  fuera: con la máquina cargada, lo que se pide de 60 ms puede durar dos segundos.

### Preparar datos
- `player({ user })` (cuenta) o `player({ name })` (invitado) → `{ token, id, client, profile }`; `client()` es un
  WebSocket directo con `send`, `wait`, `ask`.
- El gancho `{ t: 'dev', … }` (solo con `ARENA_DEV`, ver `server/index.js`): `dex, level, region, shiny` (un Pokémon),
  `badges` (medallas de `region`), `coins`, `gems`, `item, qty`, `elo`, `daily: { last, streak }`, `tutorial: false`,
  `mastery: { dex, wins }`, `catches: { dex, n }`, `aura`, `auras`, `effects`, `missionsDone`, `towerStreak`,
  `foeHp` (el rival del combate en curso con esa fracción de vida: mándalo desde la página, `// atajo:` incluido).
- Prepara por WebSocket lo que no es lo que se prueba; lo que se prueba, por la interfaz.

### Móvil, tamaños y capturas
- Móvil en horizontal: **844×390 y 667×375**, con `localStorage arena.touch = '1'` antes de entrar:
  `await page.resize(844, 390); await page.eval("localStorage.setItem('arena.touch', '1'); true"); await page.reload()`.
  Con el dedo: `press`, `fingerDown/fingerUp`. Vuelve con `page.resize()`.
- Tras tocar el CSS: `tests/e2e/pantallas-*.e2e.js` (barrido.js: nada se sale, nada tapado, axe-core, botones de al
  menos 24 px con el dedo, en 4 tamaños).
- `page.shot(archivo)` guarda una captura (si una prueba falla, el arnés guarda una en el tmp y dice dónde);
  `log('…')` escribe en la salida sin mezclarse con otras pruebas.
- WebKit (el Safari del iPhone): `E2E_BROWSER=webkit` (ver `tests/e2e/README.md`).

## 3. Prohibido (lo vigila `tools/e2e-lint.js`)

| No | Por qué | En su lugar |
|---|---|---|
| `.click()` dentro de `page.eval` | llega aunque el botón esté tapado o no se vea | `page.tap` / `page.click` |
| `ui.show('…')`, `__app.ui.algo()` | llega a la pantalla sin pasar por sus botones | pulsar el botón que lleva ahí |
| `__app.net.send(…)` para jugar | se salta lo que hace el botón | el botón; el WebSocket solo para preparar datos |
| `dispatchEvent(new KeyboardEvent/PointerEvent…)` | teclas y toques inventados: no pasan por el navegador | `page.key`, `page.press`, `fingerDown` |
| `ok(… __app …)` | mira el estado interno, no lo que ve el jugador | `page.see`, `page.title`, `page.read` |
| `ok(true, 'mensaje')` tras un `waitFor` | el mensaje promete más de lo que se esperó | `await page.waitSee(…)` y justo después `ok(true, …)`, o `ok(await page.see(…), …)` |
| comprobar clases CSS (`.sel`, `.on`, `.got`) | la clase puede estar y no verse nada (o al revés) | el texto o lo que cambia en pantalla |
| mensajes que dicen más de lo que se mira | «sale Beto» cuando solo se mira que hay una tarjeta | comprueba lo que dice el mensaje, o recorta el mensaje |
| pausas fijas (`setTimeout`) para esperar | lentas o inestables según la máquina | `waitSee` / `waitFor` |

Reglas del lint (en `npm test`, el hook y el CI, comparando con lo que había antes de la subida):
- un e2e **nuevo** no puede tener ninguno de estos sin justificar; uno **cambiado** no puede tener más que antes;
- el total de cada cosa tiene un tope en `tests/e2e/lint-base.json` que **solo baja** (el lint lo baja solo: sube el
  archivo en el commit; si lo subes a mano, el CI lo rechaza);
- lo que de verdad no se puede hacer como un jugador lleva `// atajo: motivo` en su línea o la de antes (un motivo de
  verdad, que se revisa: «el 3D no tiene elemento que buscar», «el sonido no se ve»). No es una puerta para saltarse
  la regla: si el motivo es «es más fácil», no vale.

## 4. Rojo primero

Un test nuevo o cambiado tiene que **fallar con el código de antes**. Si pasa igual sin tu cambio, no prueba tu
cambio. Lo comprueba `tools/rojo-primero.js` en el CI (job `rojo-primero`, en cada push a develop y en los PR): monta
el código del commit base con los tests nuevos encima y pasa cada test nuevo o cambiado; si alguno pasa, el CI falla.

- Hazlo tú antes: escribe el test, míralo fallar (con el cambio quitado o con la mutación puesta), y luego el código.
  `node tools/rojo-primero.js origin/develop HEAD` lo pasa en local.
- Si endureces un test sin cambiar el juego (como al tapar el hueco de una mutación), di qué fallo caza en el mensaje
  del commit: `Rojo-con: id-de-la-mutación` (se pasa contra el código de antes con esa mutación puesta: tiene que fallar).
- Solo si de verdad no aplica (el test solo se ordena, cambia de nombre o se parte en dos), `Sin-rojo: motivo`.

## 5. Mutaciones

`tests/mutaciones.js` es un catálogo de fallos pequeños que el jugador notaría (un botón que no hace nada, cobrar
mal, no dar la medalla, una traducción sin traducir…), cada uno con los tests que tienen que cazarlo.
`tools/mutar.js` aplica cada uno en una copia del proyecto y pasa solo esos tests: si alguno falla, **cazada**; si
todos pasan, **escapada** (los tests no miran lo que dicen mirar). La nota está en `tests/mutaciones-nota.json`.

- **Cada punto `nuevo` de las notas de parche añade al menos una mutación** (lo exige `tools/require-tests.js` en el
  hook y el CI; excepción: `Sin-mutación: motivo`): la forma más sencilla de romper esa novedad, con su e2e.
- Cómo se añade una:
  ```js
  { id: 'tienda-cobra-de-mas', que: 'La Tienda cobra más de lo que vale',
    archivo: 'server/story.js', buscar: 'p.coins -= item.price * qty;', poner: 'p.coins -= item.price * qty + 50;',
    tests: ['tests/e2e/tienda.e2e.js', 'tools/server-test.js'] },
  ```
  `buscar` tiene que salir **una sola vez** en el archivo (`node tools/mutar.js --lista` lo comprueba, en `npm test`).
  Que sea algo que el jugador nota, no un detalle interno. Luego `node tools/mutar.js <id> --nota` (la pasa y la
  apunta en la nota) y sube la nota con el commit.
- La nota **no baja**: una mutación cazada tiene que seguir cazándose (lo mira `tools/require-tests.js` en cada
  push; cada noche el CI las pasa todas con `node tools/mutar.js --comprobar`, job `mutaciones`).
- Si una se escapa, el test tiene un hueco: arréglalo (o escribe uno nuevo) hasta cazarla. Si de verdad no se puede
  cazar con un test, explícalo en un comentario encima de su entrada y díselo al dueño: la nota la seguirá contando
  como escapada (no se esconde).
- Ojo con los textos que se repiten: «Cambios gratis: 1» puede estar en las diarias y en las semanales; busca dentro
  de su sitio con `{ in }` (así se escapaba una mutación con un test que parecía bueno).

## 6. Cuando un test falla

1. **Primero se sospecha del juego**, no del test: reprodúcelo (`node tools/e2e.js tests/e2e/x.e2e.js`; con
   `E2E_SLOW=4` si solo falla en el CI) y mira la captura que guarda el arnés. Muchas veces es un fallo de verdad.
2. Si es el juego: arréglalo (y si el jugador lo nota, apúntalo para las notas de parche: skill `patch-notes`).
3. Cambiar un test para que pase solo si el comportamiento ha cambiado **a propósito**, y diciéndolo en el commit.
   Nunca se relaja una comprobación, se quita un `ok` o se pone un `// atajo:` para que pase.
4. «Inestable» no es una causa: si falla a veces, busca qué espera mal (una pausa fija, una animación) y espera a lo
   que se ve con `waitSee`.

## 7. Tests sin navegador (tools/*-test.js)

`server-test`, `store-test`, `security-test`, `admin-test`, `arena-test`, `ai-test`, `sim-test` (en `npm test`).
Las mismas ideas: comprobar el resultado que importa (el dinero que queda, el Pokémon guardado), no que «no da error»;
mensajes que digan solo lo que se mira; y rojo primero también para ellos.

## Comandos

```bash
npm test                                      # lint de e2e, catálogo de mutaciones, servidor, tienda, seguridad…
node tools/e2e.js tests/e2e/x.e2e.js          # un e2e (CHROME=… si no lo encuentra; E2E_TIMEOUT=600 en máquinas lentas)
node tools/e2e-lint.js --base origin/develop  # lo que mira el hook
node tools/rojo-primero.js origin/develop HEAD   # rojo primero de lo que vas a subir
node tools/mutar.js <id> [<id>…] --nota       # pasar unas mutaciones y apuntarlas en la nota
node tools/mutar.js                           # todas (tarda: cada una pasa sus e2e)
```
