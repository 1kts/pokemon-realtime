# Arena Pokémon

Combates Pokémon **en tiempo real** en el navegador, estilo HD-2D (arena 3D con Three.js y sprites de
*Pokémon Mundo Misterioso*). Modo historia por Kanto, clasificatoria online con draft y ELO, partida
rápida y práctica contra la IA. Proyecto de fans sin ánimo de lucro (ver [CREDITS.md](CREDITS.md)).

## Cómo jugar

```bash
npm install
npm start          # http://localhost:3000
```

Opcional: `node tools/fetch-maps.js` descarga el mapa del Pokégear de HeartGold/SoulSilver (del proyecto
pret/pokeheartgold) y lo deja en `public/maps/`. Ese mapa es arte de Nintendo y no está en el repositorio;
sin él, la historia usa un mapa de tiles con licencia CC0.

Para jugar online con alguien, abrid los dos la misma dirección (misma red o servidor público) y buscad
partida a la vez. Para probarlo solo, abre dos pestañas.

**Controles:** `WASD` moverte · ratón apuntar · `Clic` / `Clic dcho` / `Q` / `E` los 4 movimientos ·
`Espacio` Protección · `1` `2` `3` cambiar de Pokémon · `F` lanzar Poké Ball y `R` cambiar de Ball
(contra salvajes) · `Esc` rendirse.

## Combate

- Cada ataque tiene **preparación** (se marca en el suelo: se puede esquivar) y **recuperación**.
- **Protección** bloquea el 80 % del daño; si el golpe llega en sus primeros 180 ms es un **parry**:
  el proyectil vuelve o el atacante queda aturdido.
- **Energía** para los ataques fuertes; se recarga sola y al golpear.
- Equipos de 3 con **cambio** en cualquier momento. **Cambio perfecto**: si el que entra recibe un
  ataque de un tipo que resiste, no le hace daño y ganas energía.
- **Terreno**: la hierba alta oculta, el fuego quema la hierba y se propaga, fuego + agua = vapor que
  oculta, eléctrico en un charco electrocuta a quien esté dentro, mojado = más daño eléctrico y de hielo.
- 15 tipos con su tabla de eficacias y STAB. A los 2 min, muerte súbita; a los 3 min gana quien tenga
  más PS.

## Modos

- **Historia**: elige inicial (de las 9 generaciones), explora 9 rutas temáticas donde cada día salen 5 especies
  de cualquier generación y un Pokémon misterioso muy raro (legendario o pseudolegendario), captura con
  Poké Balls (3 sacudidas, probabilidad según PS y estado), compra en la
  tienda (Balls, Caramelos Raros, piedras evolutivas y Pokémon raros), vence a los 8 gimnasios, al Alto
  Mando y al Campeón. La IA de cada líder es más hábil que la anterior. Experiencia, niveles y
  evoluciones (por nivel o con piedra).
- **Clasificatoria**: cola por ELO, draft (cada uno veta 1 y elige 3 de 20), todos a nivel 50, ligas de
  Bronce a Maestro y ranking.
- **Partida rápida**: online sin veto ni ELO. **Práctica**: contra la IA con 4 dificultades.
- **Torre Batalla**: combates seguidos contra la IA con 3 Pokémon tuyos (de cualquier región, sin legendarios)
  o de alquiler, todos a nivel 50. Cada 7 victorias sube el bloque (IA más lista, rivales más fuertes) y cada 21
  combates espera el Cerebro de la Frontera. Se ve el siguiente rival en silueta y entre combates se puede reordenar
  el equipo. Perder acaba la racha; retirarse la guarda. Premios en dinero, Caramelos Raros, vitaminas y símbolos
  (sin experiencia: no salta el tope de nivel de la historia).
- **Ladder**: rankings de clasificatoria (ELO), Torre (mejor racha) y Pokédex, con buscador, quién está en línea
  y la ficha pública de cada entrenador.

Los perfiles se guardan en `data/profiles.json`; cada navegador recuerda su token.

## Arquitectura

- **Servidor autoritativo** (Node + `ws`, 30 ticks/s): `server/battle.js` simula el combate,
  `server/ai.js` la IA (usa la misma entrada que un jugador), `server/story.js` la historia,
  `server/tower.js` la Torre Batalla, `server/index.js` conexiones, colas, draft y ELO, `server/store.js` los
  perfiles y la ladder.
- **Datos y reglas compartidos**: `public/data.js` (tipos, 62 movimientos, 78 Pokémon, mapas, rutas,
  gimnasios, tienda) y `public/shared.js` (movimiento con colisiones, estadísticas por nivel).
- **Cliente** (`public/js/`): predicción del propio movimiento con reconciliación e interpolación del
  rival; Three.js con sombras, bloom y partículas; sprites como billboards con sombra de silueta.

## Pruebas

```bash
npm test               # integración del servidor + 60 combates IA contra IA
npm run test:sim 300   # más combates
```

## Sprites

`node tools/fetch-dex.js <clon de PokéSurvivor>` descarga de PokeAPI los datos de las 966 especies con sprite
(`public/dex.js`) y `node tools/import-sprites.js <clon de PokéSurvivor>` copia los sprites de todas las especies de
`data.js` y regenera `public/sprites/meta.js` y la tabla de artistas de `CREDITS.md`.
