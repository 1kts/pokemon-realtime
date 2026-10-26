---
name: arenas-3d
description: Guía para hacer o retocar los escenarios 3D de los combates de PokéArenas (arenas, decorado, mecánicas del entorno y su aspecto) y las fotos de Práctica. Úsala al tocar world.js, scenery.js, arenamech.js, server/arena.js o las arenas de data.js.
---

# Escenarios 3D de los combates

## Lo que quiere el dueño
- **Que destaquen los Pokémon y los ataques.** El escenario es mate, sólido y de colores algo apagados. Nada de orbes, brillos aditivos, espirales ni colores chillones de tipo en el decorado: eso es de los ataques (ver la skill `vfx-3d`). Los elementos de juego (lava, placas, faro, teletransportes) sí pueden brillar, pero poco.
- **El campo, limpio y de valor medio y uniforme.** Así los ataques y los avisos de ataque contrastan. El detalle va fuera de los muros y en los bordes: la cámara del combate solo ve una o dos casillas más allá del muro, así que montañas o fondos lejanos no se ven nunca.
- **Le gusta que las arenas se vean «medio pochas», sencillas.** Las mejoras se tienen que notar, pero sin recargar.
- **Cada arena con su identidad:** cantera para roca, piscina para agua, instalación industrial para eléctrico, cementerio para fantasma, muelle para acero…
- **Sin cambiar la jugabilidad:** ni obstáculos, ni colisiones, ni el tamaño del campo.

## Dónde está cada cosa
- `public/data.js`, `ARENAS`: cada arena (`g-<tipo>` para los gimnasios, `e-<id>` para el Alto Mando) con `name`, `desc` (se traduce: añade la traducción a los 7 idiomas de `public/js/lang`), `mech` y `rows` (el mapa de 24×15).
  - Letras de `rows`: `#` hierba alta, `~ v ^` agua (con corriente), `i` hielo, `p` veneno, `w` telaraña, `L` lava, `o` roca, `x` muro invisible, `H` curación, `E` placa eléctrica, `A/a B/b C/c` teletransportes, `F/f` flores (curan / adormecen).
  - `MODIFIERS`: las mecánicas que se pueden poner encima de cualquier arena en Práctica.
- `public/js/world.js`, `THEMES`: suelo, paleta, decorado, luz y si la arena es oscura. `applyTheme`, `buildProps` (elementos de juego) y `syncObstacles` (rocas, pilares, barreras…).
- `public/js/scenery.js`: el decorado de fuera del campo, por tema. Usa modelos de Kenney (`public/models/kenney/`, CC0, instanciados) y piezas hechas a mano fundidas en pocas mallas.
- `public/js/arenamech.js`: lo que se ve de las mecánicas nuevas (cintas, niebla, espejos, flores, pozo de gravedad) y los pilares.
- `server/arena.js`: simula las mecánicas. El cliente solo dibuja lo que le llega por eventos (`b.ev({ k: … })`) y por el campo `ar` de cada instantánea.
- `public/shared.js`:
  - `arenaStep` mueve igual en servidor y cliente: hielo, corriente, viento, cintas y gravedad;
  - `mechFor(mapa, mod)` da las mecánicas de un combate;
  - `fogZones`, `pillarSpots` y `mirrorSegs` dan los sitios fijos.
- `public/js/battle.js`: recibe los eventos de arena (`case 'geyser'`…) y la predicción del movimiento (`step`).
- `public/js/effects.js` y `public/js/vfxhd.js`: los efectos de las mecánicas (géiser, gravedad, rayo, hielo roto…), con el estilo 3D de los ataques.

## Mecánicas (server/arena.js)
`rockfall`, `tide`, `shock`, `regrow`, `toxic`, `warp`, `eruption`, `quake`, `wind`, `heal`, `dark`, `flow`, `beam`, `ice`, y las nuevas:
- `geyser`: aviso y chorro que hace daño y lanza hacia fuera.
- `crack`: el hielo se rompe si te quedas encima y vuelve a congelarse al rato.
- `belts`: cintas transportadoras, en franjas de filas.
- `pillars`: pilares que suben y bajan por turnos.
- `gravity`: pozo que atrae y curva los proyectiles, y hace daño en el centro.
- `mirrors`: espejos que hacen rebotar los proyectiles.
- `storm`: rayos con aviso; si caen junto al agua, la electrifican.
- `fog`: niebla; quien está dentro no se ve.
- `flowers`: flores que curan o adormecen.

Para una mecánica nueva:
1. Pon sus parámetros en `mech` (y en `MODIFIERS` si sirve para cualquier arena sin marcas en el mapa).
2. Simúlala en `Arena.update`, con `warnAt` si tiene aviso: así la IA la esquiva.
3. Si mueve a los Pokémon, ponla en `Shared.arenaStep`, para que la predicción del cliente cuadre.
4. Mándala al cliente por eventos o en `snap()`.
5. Dibújala en `arenamech.js` (lo que está quieto, mate) y en `effects.js`/`vfxhd.js` (lo que pasa en un momento).
6. Escribe su prueba en `tools/arena-test.js` y añádela a `tests/e2e/mecanicas.e2e.js`.
7. Explícala en el `desc` de la arena, con traducción.

Una regla: nada de peligros en la línea de salida de los Pokémon (izquierda y derecha del centro). Por ejemplo, el haz del faro empieza en vertical.

## Ver cómo queda
- **Las arenas en su sitio:** en la consola del navegador, `__app.ui.hide(); __app.world.loadMap('g-fuego', Shared.parseMap('g-fuego').terrain)`.
- **Fotos de Práctica** (`public/img/arenas/<arena>.webp`, 320×200): se sacan con `ARENA_THUMBS=<carpeta> ARENA_ONLY=g-fuego,lago node tools/e2e.js tools/arena-thumbs.e2e.js`. Van por tandas, porque las 31 de golpe pasan de los 3 minutos. Luego se pasan a webp con PIL (`resize((320,200))`, `quality=72`). Hay que rehacerlas cuando cambia el aspecto de una arena.
- **El contraste**, con efectos encima: `localStorage.setItem('arena.vfx','3d')` y `__app.effects.beam({...})` o `__app.effects.boom({...})`.

## Rendimiento (se juega en el móvil)
- Modelos instanciados y geometrías fundidas, con pocos materiales.
- Sombras solo en lo que importa: la hierba y las piezas planas no proyectan.
- Animaciones en el shader o baratas. Mira las llamadas de dibujo y los triángulos (`renderer.info`).
