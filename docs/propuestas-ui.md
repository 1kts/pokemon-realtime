# Propuestas de aspecto para PokéArenas

Hay tres direcciones para elegir antes de cambiar nada. Cada una es una capa opcional, que **no cambia el aspecto
de siempre**: sin tema no se carga ninguna hoja.

- Para verla: `?tema=a`, `?tema=b` o `?tema=c` en la dirección (por ejemplo `http://localhost:3000/?tema=b`). Se
  recuerda en `localStorage` (`arena.tema`) y `?tema=no` la quita.
- Cómo está hecho: `public/js/tema.js` carga `public/themes/tema-X.css` después de `mobile.css` y pone la clase
  `tema-X` en el `<body>`. Todas las reglas van bajo `body.tema-X`.
- El test e2e `tests/e2e/temas.e2e.js` comprueba lo siguiente: sin tema no se pide nada, con tema se ve y se recuerda,
  `?tema=no` lo quita y «¡Desafiar!» sigue a la vista y sin nada encima.
- Alcance: el menú principal y la pantalla de Historia (la vista «Camino» y la ficha de al lado), en escritorio
  (1280×800) y en el móvil en horizontal (844×390). El resto de pantallas sigue con el aspecto actual aunque haya un
  tema puesto.

## Qué se quiere arreglar

La revisión de diseño vio en la interfaz actual estos rasgos «de plantilla»:

1. **Todos los bloques son la misma tarjeta**: redondeada, con degradado, brillo, rayas, reflejo y sombra. Los
   modos del menú, las filas de misiones, la colección, el objetivo y la ficha son todos iguales.
2. **Etiquetas en mayúsculas sobre los bloques**: «TU OBJETIVO», «PRÓXIMAMENTE», «MISIONES DIARIAS», «AVENTURA»,
   «JUGAR ›».
3. **Datos unidos con puntos medios**: «Kanto 3/8 · Johto 0/8 · 4 Pokémon».
4. **El dorado está en todo**, así que no señala nada. Son dorados los diez «Jugar», el borde de Lucky Spin, la
   Tienda, Logros, el panel de misiones, «Cómo se juega», la pestaña de región elegida, el reloj, las marcas de
   los títulos y el siguiente reto.
5. **Brillos y animaciones en muchos sitios a la vez**: misiones, Logros, Lucky Spin, Novedades, el corazón de
   Apoyar, el Tutorial y el siguiente reto laten todos a la vez.

Las tres propuestas aplican los mismos principios:

- Partir del propio tema: la forma de las interfaces de los juegos de Pokémon.
- Gastar el atrevimiento en un solo sitio por pantalla.
- Dorado solo para «lo que toca hacer ahora». En el menú es Historia, y en Historia el siguiente reto y
  «¡Desafiar!».
- Un solo movimiento pensado por pantalla. Con `prefers-reduced-motion` no hay ninguno.
- Etiquetas en minúsculas, como frases.
- Contraste de 4,5:1 o más en el texto, foco visible y que todo quepa en 844×390.

Cada propuesta resuelve los rasgos 1, 2, 4 y 5 solo con CSS. **El 3 (los puntos medios) no se puede arreglar con
CSS**, porque es texto que monta el JS. Para el tema que se elija se propone, por ejemplo, que la tarjeta de
Historia muestre las medallas de cada región con sus pastillas (como `.rg-pips`) en vez de «Kanto 3/8 · Johto 0/8»,
y que «Ruta 11 · Ruta 9 · Ruta 10» pase a ser una lista. No está hecho.

## Capturas

Están en `docs/propuestas-ui/`, con el mismo perfil de prueba en todas (3 medallas de Kanto y 4 Pokémon). En cada
fila se compara el aspecto actual con las tres propuestas.

| | Actual | A · Caja de texto | B · Pokédex | C · Ruta |
|---|---|---|---|---|
| Menú, escritorio | ![](propuestas-ui/actual-escritorio-menu.png) | ![](propuestas-ui/a-escritorio-menu.png) | ![](propuestas-ui/b-escritorio-menu.png) | ![](propuestas-ui/c-escritorio-menu.png) |
| Historia, escritorio | ![](propuestas-ui/actual-escritorio-historia.png) | ![](propuestas-ui/a-escritorio-historia.png) | ![](propuestas-ui/b-escritorio-historia.png) | ![](propuestas-ui/c-escritorio-historia.png) |
| Menú, móvil | ![](propuestas-ui/actual-movil-menu.png) | ![](propuestas-ui/a-movil-menu.png) | ![](propuestas-ui/b-movil-menu.png) | ![](propuestas-ui/c-movil-menu.png) |
| Historia, móvil | ![](propuestas-ui/actual-movil-historia.png) | ![](propuestas-ui/a-movil-historia.png) | ![](propuestas-ui/b-movil-historia.png) | ![](propuestas-ui/c-movil-historia.png) |

## A · «Caja de texto» (GBA/DS)

Toma la forma de los menús de Rojo Fuego, Esmeralda y Diamante. Lo que se lee va en cajas de papel claro con marco
doble y sombra dura. Lo de alrededor (la cabecera y el camino) es «el mundo»: oscuro y liso. El cursor ▶ de los
menús de Pokémon marca lo que eliges.

| Token | Valor | Uso |
|---|---|---|
| `--ta-paper` | `#f7f4ea` | fondo de las cajas |
| `--ta-ink` | `#1e2433` | texto sobre el papel (14,1:1) |
| `--ta-mute` | `#535c70` | texto secundario (6,1:1 sobre el papel; 5,2:1 sobre `--ta-paper-2`) |
| `--ta-frame` / `--ta-band` | `#2b3a67` / `#7fa6d9` | marco doble: borde oscuro y banda clara por dentro |
| `--ta-field` | `#131a38` | el mundo: cabecera, pestañas y el camino |
| `--ta-now` | `#f5bf1a` | solo lo que toca (tinta encima: 9,1:1) |

- **Letra**: M PLUS Rounded 1c para los títulos y Nunito para el texto. Las dos ya están en `public/vendor/fonts`.
  Para ir más lejos se podría añadir una letra de píxel libre (OFL), por ejemplo *Pixelify Sans* o
  *Press Start 2P*, alojada en `public/vendor/fonts` como las otras. Solo serviría para cifras y rótulos cortos,
  porque no tiene caracteres chinos, japoneses ni coreanos. No está incluida.
- **Paneles**: 3 px de marco y 3 px de banda, esquinas de 10 px, sombra dura de 4 px sin difuminar. Sin
  degradados, brillos ni reflejos. Dentro de las cajas no hay tarjetas, sino filas lisas (`--ta-paper-2`). Las
  barras de progreso son como la barra de PS de los combates de GBA.
- **Atrevimiento**: cada modo lleva una franja lisa de su color. Historia es el único «Jugar» con forma de botón
  dorado. La región elegida es una caja de papel, no un brillo dorado.
- **Camino**: el tramo recorrido va en el azul claro de la banda. El dorado queda solo para el siguiente reto.
- **Movimiento**: el cursor ▶ de lo que toca va y viene a saltos (`steps`), como la flecha de las cajas de texto.
  En el menú está en Historia y en el camino en el siguiente reto. Nada más se mueve.
- **Móvil**: los marcos son de 2 px y la franja del modo va arriba, porque a la izquierda no cabían los nombres.

Qué arregla: las tarjetas dejan de ser todas iguales (cajas de papel, el mundo oscuro y filas dentro), el dorado
queda en un sitio por pantalla y deja de latir todo a la vez. Es la más «Pokémon» de las tres. A cambio, es la
más llamativa: el papel claro pesa mucho sobre el 3D, y llevarla al resto de pantallas es lo que más trabajo da,
porque hay que revisar el color de texto de cada panel, que hoy da por hecho un fondo oscuro.

## B · «Pokédex» (plano, colores de tipo)

Trata la interfaz como el aparato Pokédex: superficies de carbón lisas separadas por líneas finas, esquinas
pequeñas y datos legibles. El color sale solo de los tipos y del color de cada modo, como pestaña de índice.

| Token | Valor | Uso |
|---|---|---|
| `--tb-body` | `#17191f` | superficie de los paneles |
| `--tb-row` | `#22252e` | filas, huecos y botones secundarios |
| `--tb-line` | `#363a47` | líneas de 1 px (no hay sombras) |
| `--tb-text` / `--tb-mute` | `#eef0f4` / `#a7adbb` | texto (15,4:1) y secundario (7,8:1; 6,8:1 sobre `--tb-row`) |
| `--tb-red` | `#c8272b` | el rojo de la Pokédex, solo como filo del cartel de cada pantalla |
| `--tb-now` | `#ffcb05` | solo lo que toca (tinta encima: 12:1) |

- **Letra**: Nunito en todo, también en los títulos (900, con algo menos de espacio entre letras). Las cifras van
  tabulares, para que el reloj y los contadores no bailen. Es más sobria y lee mejor los números.
- **Paneles**: fondo liso, borde de 1 px, esquinas de 4 a 6 px, sin sombra ni desenfoque. Las secciones del menú
  son un índice: el nombre y una línea hasta el borde. Las misiones y la colección son listas.
- **Atrevimiento**: Historia es un bloque liso de su color (tinta encima, 5,5:1), con el único botón dorado. En
  Historia lo atrevido es el siguiente reto, con su anillo y su nombre en dorado. El objetivo y la ficha del líder
  llevan el color del tipo del líder (Planta para Erika) como filo.
- **Movimiento**: una sola vez y sin bucles. En el menú, Historia entra primero y lo demás 0,18 s después. En el
  camino, el siguiente reto lanza dos ondas al abrir.
- **Eje del camino**: blanco lo recorrido y punteado lo que falta, así que el dorado ya no se usa para el progreso.

Qué arregla: tiene la jerarquía más clara de las tres, quita todos los efectos y deja que el color del tipo dé
la información. A cambio, es la menos «de juego»: sin el bloque de Historia y los tipos podría ser cualquier panel
de datos. Un detalle: el anillo de un gimnasio ganado de tipo Eléctrico es amarillo (es el color del tipo) y se
parece algo al dorado de «lo que toca». Se distingue por el tamaño y la etiqueta, pero habría que vigilarlo.

## C · «Ruta» (HUD ligero sobre el mundo) · la elegida

El juego ya tiene un mundo 3D detrás de los menús, así que esta propuesta lo deja ser el protagonista. La interfaz
se queda en lo justo: velos azul noche sin bordes ni sombras, letra grande y casi ninguna caja dentro de otra.
Recuerda a una pantalla de título o al HUD de los juegos en 3D.

La primera versión quedó «apagadísima» (velos casi negros y todo en blanco y gris), y se perdieron los colores que
destacan las funciones y enganchan. Ahora cada cosa vuelve a tener su color, pero con el lenguaje de C: tinte que
se desvanece y una barra a la izquierda en vez de una tarjeta con marco.

| Token | Valor | Uso |
|---|---|---|
| `--tc-veil` / `--tc-veil-2` | `rgba(20,32,84,.8)` / `rgba(26,42,104,.88)` | velo de los paneles, azul noche. Sobre un fondo blanco, el blanco da 8,2:1 y el secundario 6:1 |
| `--tc-row` | `rgba(140,180,255,.13)` | filas y huecos |
| `--tc-hair` | `rgba(170,200,255,.3)` | bordes de los botones secundarios |
| `--tc-text` / `--tc-mute` | `#ffffff` / `#d2ddf5` | texto y secundario |
| `--tc-done` | `#5fd8ff` | lo recorrido (el camino, la región elegida, el modo Camino, la cuenta atrás) |
| `--tc-now` | `#ffcb05` | lo que toca hacer ahora: «Jugar» de Historia, «¡Desafiar!», el siguiente reto |
| `--tc-gold` | `#ffd23f` | lo que engancha: Lucky Spin, gemas, premios por recoger (marco y brillo) |
| `--tc-pink` | `#ff6b8a` | Apoyar |
| `--c` / `--cc` / `--tc` | de cada modo, baldosa o tipo | tinte al 34 % sobre el azul noche y barra de 3-4 px a la izquierda |

- **Letra**: M PLUS Rounded 1c en 900 y muy grande en lo principal («Historia» a 64 px en el menú y el título de
  la pantalla a 40 px, encima del mundo). Nunito para todo lo demás.
- **Paneles**: velo liso, sin borde, esquinas de 4 px. Los modos son filas bajas teñidas con su color y su barra.
- **Color en el menú**: Historia, portada en rojo cálido con el único botón dorado. Lucky Spin con marco y nombre
  dorados; monedas y gemas en píldora dorada; Apoyar en rosa; Novedades con borde dorado si hay algo nuevo. En «Tu
  colección», cada baldosa con su color (Mis Pokémon rojo, Mochila azul, Tienda y Logros dorados, Pokédex
  violeta) y, si hay algo que recoger, marco dorado entero y brillo. Misiones con marco dorado cuando hay premios,
  «Recoger todo» en píldora dorada, los iconos sobre un cuadrito de color y la misión cumplida con barra dorada.
  La burbuja roja de Logros se queda.
- **Color en Historia**: el rótulo «Historia» con el rojo de la portada detrás; la región elegida subrayada y
  teñida de celeste; las medallas ganadas con brillo dorado detrás; «Tu objetivo» en dorado, con la medalla del
  líder en un anillo de su tipo y las rutas nuevas en verde hierba; la cuenta atrás en celeste. En el camino, las
  rutas vuelven a ser verdes con su anillo de capturados, los contadores «2/7» van en píldora (verde si está
  completa) y «Nueva» en rosa frambuesa. La ficha del líder lleva una banda del color de su tipo arriba.
- **Medallas que no tienes** (para todos, no solo con el tema): en gris y algo opacas, no en silueta blanca, en el
  camino, la barra de medallas de arriba (también la pequeña del móvil), la lista, el mapa y el objetivo.
- **Movimiento**: al abrir Historia, la línea del camino se dibuja tramo a tramo desde el pueblo, y el siguiente
  reto aparece cuando llega la línea. En el menú, el Pokémon de Historia da un salto al entrar. Lo que tiene algo
  listo para recoger late despacio (2,4 s) y a turnos, para que no lata todo a la vez: Lucky Spin, Tienda, Logros
  y «Recoger todo». El resto de parpadeos de siempre, fuera. Con `prefers-reduced-motion` nada se mueve: queda el
  marco y el brillo.
- **Móvil**: la portada se encoge (título de 30 px) y se quita el punto de color de los modos, porque no
  cabían los nombres.
- **Contraste**: calculado en el peor caso (el velo sobre un fondo blanco y el tinte más claro, el dorado o el
  amarillo de Eléctrico). Blanco y secundario dan 4,5:1 o más en los modos, las baldosas, Lucky Spin («Lucky
  Spin» en oro liso: el degradado dorado de siempre bajaba a 3,8:1), la ficha del líder, «Nueva» (4,9:1) y la
  cuenta atrás (5:1). El rótulo «Historia» da 4,7:1. El subtítulo de la portada de Historia y el del rótulo de la
  pantalla van sobre el mundo, sostenidos por una sombra: no se puede garantizar con cualquier fondo.

Qué arregla: casi no quedan tarjetas, y el mundo 3D, que es lo que distingue al juego, se ve más, sin perder lo
que llama la atención. A cambio, legibilidad y aspecto dependen algo de lo que haya detrás. Es la que más se
notaría en el móvil con poca potencia, porque se ve más 3D.

### Decisiones para el dueño

- **Tienda dorada siempre**: en C, Tienda y Logros van en dorado aunque no haya nada nuevo, y lo «listo» se marca
  con el marco entero y el latido. Sin tema, la Tienda solo es dorada cuando ha rotado. ¿Se prefiere así?
- **El latido**: ahora laten despacio y a turnos cuatro cosas como mucho. Si se quiere más vida, se puede volver al
  corazón de Apoyar que late (ahora está quieto, en rosa).
- **«Nueva» en rosa frambuesa** en vez de dorado, para que el dorado sea solo de lo que toca y de los premios.
- **Medallas en gris también sin tema**: el cambio está en `cards.css`, así que se ve igual con y sin tema.
- **El rojo detrás del rótulo de Historia**: une la pantalla con su portada del menú. Si se ve demasiado, se quita.

## Recomendación

(El dueño ha elegido la C, con más color: ver arriba.) La recomendación de entonces era **B («Pokédex») como base, con dos préstamos de A.**

- B resuelve los cinco rasgos con menos riesgo. Las superficies lisas y las líneas finas se pueden llevar al resto
  de pantallas (tienda, Mis Pokémon, Torre y combate) sin revisar el color de cada texto, porque sigue siendo una
  interfaz oscura como la de hoy.
- B pone el color en los tipos, que es el idioma de Pokémon que todo jugador reconoce.
- A es la más bonita y la más «Pokémon», pero el papel claro obliga a repasar el contraste pantalla por pantalla
  y pesa mucho sobre el 3D.
- C es la más elegante en el escritorio, pero depende demasiado del fondo.
- De A se tomarían el cursor ▶ en lo que toca (es el movimiento más propio de Pokémon de los tres, en lugar de la
  onda de B) y el marco doble solo para la ficha del sitio elegido (la «caja de texto» del juego). Así lo atrevido
  de la pantalla de Historia tendría su forma.

## Lo que falta

- Ninguna propuesta cubre el resto de pantallas (tienda, Mis Pokémon, Torre, combate, ventanas). Con el tema
  puesto, esas pantallas mezclan los dos aspectos.
- Los puntos medios del texto (rasgo 3) piden cambiar el JS de la pantalla elegida.
- No hay ninguna letra nueva. La de píxel de A habría que descargarla y alojarla como las otras.
- En 844×390, el nombre del siguiente reto queda pegado a la barra de desplazamiento del camino. Pasa con
  todos los temas y también sin tema.
- Se ha comprobado con capturas en 1280×800 y 844×390 y con el e2e `temas.e2e.js`. La C, además, con los cuatro
  barridos `pantallas-*.e2e.js` pasando `?tema=c` en cada página (escritorio, ventana, 844×390 y 667×375): pasan.
  Con ellos salió que el rótulo de 40 px se salía de ancho en una ventana de 390 px; ya se encoge a 24 px. Los
  barridos con el tema no están en el repositorio (se pasaron con un envoltorio aparte). A, B y axe con tema, sin
  pasar.
