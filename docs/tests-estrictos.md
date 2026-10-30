# Tests estrictos: qué se ha hecho (rama `tests-estrictos`)

Objetivo: que los tests dejen de ser complacientes (los escribe quien escribe el código y pasaban aunque el juego
fallara), que los nuevos sean estrictos sí o sí con controles automáticos, y que quede escrito para las próximas
sesiones. Todo está en la rama `tests-estrictos`, sin tocar `main` ni `develop`. La guía para escribir tests es la
skill `tests` (`.claude/skills/tests/SKILL.md`); aquí, el resumen y lo que queda por decidir.

## Números: antes y después

| | Antes | Después |
|---|---|---|
| Nota de mutaciones (cazadas / total) | **28 de 38** | **41 de 41** (3 mutaciones nuevas por los fallos del juego encontrados) |
| Atajos sin justificar (`.click()` en `eval`, `ui.show`, teclas inventadas) | **119** | **0** (45 líneas con `// atajo: motivo`) |
| Llamadas directas al juego (`__app.net.send`, `__app.ui.x()`, eventos de puntero inventados) | 49 | 0 |
| `ok()` que miran `__app` en vez de lo que se ve | 46 | 0 |
| `ok(true, …)` sin esperar algo visible justo antes | 64 | 0 |
| Tests e2e | 57 | 60 (+ `tienda`, `idioma`, `victoria`) |

(Los atajos que quedan llevan `// atajo: motivo`; los que se justifican son sobre todo lo que no se ve: el sonido, la
cámara y las arenas del 3D, los IV de un salvaje, el botón de Google, el barrido de pantallas.)

### Mutaciones: las que se escapaban al empezar y cómo se cazan ahora

| Mutación | Qué notaría el jugador | La caza ahora |
|---|---|---|
| `resultados-sin-medalla` | al ganar un gimnasio no sale la medalla | `victoria.e2e.js` (nuevo: vence a Brock a golpes con el ratón) |
| `resultados-dinero-doble` | los resultados enseñan otro dinero del que se suma | `victoria.e2e.js` (compara con el dinero de arriba) |
| `tienda-compra-otro` | «Comprar» una Super Ball da una Poké Ball | `tienda.e2e.js` (nuevo) |
| `tienda-precio-mentiroso` | la Tienda enseña un precio y cobra otro | `tienda.e2e.js` |
| `tesoros-precio-mentiroso` | Lucky Spin enseña un precio y cobra otro | `tesoros.e2e.js` (mira las gemas de la cabecera) |
| `tutorial-premio-repetido` | el premio del tutorial se cobra dos veces | `tools/server-test.js` |
| `amigos-enviada-sin-nombre` | «Solicitudes enviadas» no dice a quién | `amigos.e2e.js` (ve el nombre de Beto ahí) |
| `idioma-ignorado` | con otro idioma, el juego sigue en español | `idioma.e2e.js` (nuevo: Ajustes → English) |
| `traduccion-sin-traducir` | «Historia» sin traducir en inglés | `idioma.e2e.js` |
| `tooltip-pegado-al-tocar` | con el dedo, tocar deja el tooltip pegado | `movil-menus.e2e.js` (toca algo que no cambia de pantalla) |

Además, 3 mutaciones nuevas por los fallos del juego que salieron (abajo): `resultados-se-ven-a-medias`,
`lucky-spin-sin-gemas` y `movil-rendirse-se-cierra`, cazadas por `victoria`, `tesoros` y `movil`.

Al final se pasaron otra vez las 41 con todos los tests ya limpios (`node tools/mutar.js --comprobar`, 85 min aquí): el
trinquete saltó con `misiones-cambio-gratis-infinito`, porque mi `misiones.e2e.js` nuevo buscaba «Cambios gratis: N»
en toda la pantalla y lo encontraba en las semanales. Arreglado (ahora mira las diarias) y vuelta a cazar: **41 de 41**.

Cómo quedan los tests: la tanda entera (60) pasó aquí con `E2E_TIMEOUT=600` y 2 a la vez salvo 4, que pasaron al
repetirlos: `rendirse` (justo pasó la medianoche UTC y se abrió el premio diario), `recoger-todo` y `ia-pensamiento`
(arreglados: un premio que se cerraba a medias y una etiqueta que se repinta) y `jugadas-lideres`, que con 2 a la vez
en esta máquina falla a veces en «se planta en la lava» (la IA depende de los fotogramas; solo, pasa, y también falla
igual con el código de `main`). Los 30 tests de las mutaciones pasaron todos sin mutar en las dos últimas pasadas.

Los tests son más lentos que antes (juegan de verdad: navegar con botones, ganar a golpes): en esta máquina, que va unas
3 veces más lenta que el CI, los más largos son `maestria` (≈480 s), `motes` (≈430 s), `pantallas-escritorio` (≈400 s,
sin cambios) y `capturas` (≈390 s, recortado después). En el CI cada prueba tiene 5 minutos: conviene mirar
`E2E_TIMES` en la primera tanda y, si alguno se acerca, partirlo en dos (como ya se hizo con `musica` y `musica-temas`).
`tests/e2e/times.json` no lo he tocado (son tiempos del CI).

## Controles nuevos

**En `npm test` (y por tanto en el CI, que no despliega sin él):**
- `tools/e2e-lint.js`: cuenta atajos, llamadas directas, `ok()` con `__app` y `ok(true)` sin `waitSee` antes. Un e2e
  nuevo no puede tener ninguno sin `// atajo: motivo`; uno cambiado, no más que antes; los totales tienen topes en
  `tests/e2e/lint-base.json` que solo bajan (el lint los baja solo; si alguien los sube a mano, el CI lo rechaza).
- `tools/mutar.js --lista`: el catálogo de mutaciones se puede aplicar (cada texto sale una vez) y está en la nota.

**En el hook de pre-push (`.githooks/pre-push`) y en el job `test` del CI:**
- `tools/require-tests.js`: además de lo de antes, cada punto `nuevo` de las notas trae una mutación nueva en
  `tests/mutaciones.js` (excepción: `Sin-mutación: motivo`), y la nota de mutaciones no baja (las cazadas siguen
  cazadas). A `main` no se le aplica, como antes.
- `tools/e2e-lint.js --base <antes de la subida>`.

**Jobs nuevos del CI (`.github/workflows/ci.yml`):**
- `rojo-primero` (push a develop y PR): cada test nuevo o cambiado se pasa contra el código de antes de la subida y
  tiene que fallar (`tools/rojo-primero.js`). `Rojo-con: <mutación>` en el commit para un test que se endurece sin
  cambiar el juego; `Sin-rojo: motivo` si no aplica. **No frena el despliegue** (deploy solo espera a `test`), no corre
  en `main`, y un fallo de la propia herramienta (git, una carpeta) avisa y no pone el CI en rojo.
- `mutaciones` (cada noche a las 3:17 UTC y a mano): pasa todas las mutaciones en 4 máquinas y falla si alguna que la
  nota daba por cazada se escapa. No va en cada push porque tarda: aquí, unos 60 min para 38 con 2 a la vez; en el CI,
  repartidas en 4, unos 20-25 min. En cada push solo se mira la nota guardada (barato).
- `webkit`: los e2e del móvil en WebKit (`E2E_BROWSER=webkit`). Va con `continue-on-error` hasta ver que es estable.

## Bugs del juego encontrados (arreglados en esta rama, sin subir versión)

Para las notas de parche cuando se publique:

1. **Resultados a medias**: tras un combate, los resultados heredaban el desplazamiento de la pantalla anterior; si
   habías bajado en Historia para pulsar «Desafiar», salían ya bajados y no se veía «¡Victoria!» (`ui.js`, `results`).
   Nota posible: «Los resultados de un combate se ven siempre desde arriba, con la victoria o la derrota a la vista.»
2. **Lucky Spin sin gemas**: en la pantalla de Lucky Spin no se veían tus gemas en ningún sitio (el código decía que
   iban en la cabecera, pero la cabecera solo enseñaba dinero). Ahora salen arriba a la derecha (`ui.js`, `topbar`).
   Nota posible: «En Lucky Spin ves arriba cuántas gemas tienes para tirar.»
3. **Rendirse en el móvil**: la bandera abría la ventana de rendirse al poner el dedo, y el clic de levantarlo caía en
   el fondo de la ventana recién abierta y la cerraba: en un teléfono la ventana parpadeaba y se iba. Ahora se abre al
   soltar (`touch.js`). Nota posible: «En el móvil, la bandera de rendirse abre su ventana y se queda abierta.»

Y cosas raras que no he cambiado (para que decida el dueño):
- En la Tienda, los botones «×5» y «×10» no salen nunca: dependen de `item.cap`, que no tiene ningún objeto. O se
  quita ese código o se le pone `cap` a los objetos que se compran de muchos (las Balls).
- En combate, un entrenador de la IA sale como «Pegaso#6254» (con etiqueta #, como una persona) junto a su «IA»; en la
  ladder y en su ficha no lleva #.

Detalle de los commits: el cambio del hook de pre-push se coló en el commit de los helpers del arnés (`8de606a`), no en
el de la tarea 5.

## Herramientas nuevas

- `tools/mutar.js` + `tests/mutaciones.js` + `tests/mutaciones-nota.json` (tarea 1).
- Helpers del arnés (`tools/e2e.js`, tarea 3): `page.see`, `page.waitSee`, `page.tap`, `page.title`, `page.read`,
  `page.within`, `page.key` (teclas del navegador), `page.mouseAt` (apuntar en el 3D), `page.fingerAt/fingerMove`
  (arrastrar con el dedo), `E2E_TIMEOUT` (en una máquina lenta todas las esperas crecen en proporción).
- `tools/rojo-primero.js` (tarea 5), `tools/e2e-lint.js` más duro (tarea 4).
- `E2E_BROWSER=webkit|chromium-pw` (tarea 7): el arnés traduce sus órdenes de CDP a las de Playwright.

## WebKit (tarea 7)

Viable sin reescribir el arnés: con `E2E_BROWSER`, `tools/e2e.js` abre el navegador con Playwright y una función
traduce las ~12 órdenes de CDP que usa (evaluar, navegar, ratón, teclado, dedo, tamaño, capturas, errores y
peticiones) a las de Playwright; las pruebas no cambian. Lo he comprobado con el Chromium de Playwright
(`E2E_BROWSER=chromium-pw`): `portada` y `movil-balls` pasan; `movil` (tocar un movimiento, después del joystick) y
`movil-menus` (el tooltip con el dedo) todavía no, por cómo simula el dedo puesto (Playwright solo tiene toques
enteros: lo que no es un toque corto son eventos de la página). **WebKit no lo he podido pasar aquí**: la red de este entorno no deja bajar el navegador
(`cdn.playwright.dev` y `playwright.download.prss.microsoft.com` bloqueados); en GitHub Actions se instala con
`npx playwright install --with-deps webkit` (job `webkit`). Diferencias: `E2E_SLOW` no hace nada y un dedo que se queda
puesto más de 300 ms son eventos de la página (Playwright solo tiene toques enteros). Lo primero que habrá que mirar
cuando corra: el WebGL de WebKit en Linux sin pantalla (si no hay 3D, el mapa usa su SVG de respaldo y la arena no
se dibuja) y si los e2e del móvil pasan; por eso va con `continue-on-error`.

## Decisiones para el dueño

1. **`continue-on-error` del job `webkit`**: quitarlo cuando pase unas cuantas veces seguidas.
2. **¿`rojo-primero` debería frenar el despliegue?** Ahora no (solo pone el CI en rojo en develop). Si se quiere, añadirlo a
   `needs` de `deploy`… aunque no corre en main, así que habría que cambiar también eso.
3. **La nota de mutaciones cada noche**: el job `mutaciones` solo corre si el workflow está en `main` (los `schedule` de
   GitHub van con la rama por defecto). Hasta que se fusione, se puede lanzar a mano (workflow_dispatch).
4. **`// atajo:` como válvula**: el lint deja pasar lo justificado; conviene mirar los motivos en las revisiones (la
   skill lo pide). Si se abusa, se puede contar también lo justificado y ponerle tope.
5. **`E2E_TIMEOUT`/`PATIENCE`**: en una máquina lenta las esperas crecen; en el CI no se usa (5 min por prueba como antes).
6. Los dos detalles raros de arriba (Tienda «×5», etiqueta # de la IA en combate).
7. **Duración de los e2e en el CI** (ver arriba): si alguno pasa de 5 minutos, partirlo o subir el límite del CI.
8. **`jugadas-lideres`** es sensible a la carga (falla a veces con 2 a la vez en una máquina lenta, también en `main`):
   mirar si en el CI pasa siempre; si no, que espere de otra forma a que el rival pise la lava.
9. **El dedo en WebKit**: si en el job `webkit` fallan los toques largos, la forma buena sería un dedo de verdad que se
   quede puesto (Playwright no lo tiene; con CDP en Chromium sí): dejar esas pruebas solo en Chromium o esperar a Playwright.
10. Esta rama tiene muchos tests reescritos: si se fusiona, en el CI de develop el job `rojo-primero` los pasará contra el
   código de antes; los commits llevan `Rojo-con` o `Sin-rojo` según toque.
