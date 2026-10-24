# Arena Pokémon

Combates Pokémon **en tiempo real** en el navegador, estilo HD-2D (arena 3D con Three.js y sprites de
*Pokémon Mundo Misterioso*). Modo historia por Kanto, clasificatoria online con draft y ELO, partida
rápida y práctica contra la IA. Proyecto de fans sin ánimo de lucro (ver [CREDITS.md](CREDITS.md)).

## Cómo jugar

```bash
npm install
npm start          # http://localhost:3000
```

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

- **Historia**: elige inicial, explora 9 rutas (captura debilitando y lanzando Poké Balls), compra en la
  tienda (Balls, Caramelos Raros, piedras evolutivas y Pokémon raros), vence a los 8 gimnasios, al Alto
  Mando y al Campeón. La IA de cada líder es más hábil que la anterior. Experiencia, niveles y
  evoluciones (por nivel o con piedra).
- **Clasificatoria**: cola por ELO, draft (cada uno veta 1 y elige 3 de 20), todos a nivel 50, ligas de
  Bronce a Maestro y ranking.
- **Partida rápida**: online sin veto ni ELO. **Práctica**: contra la IA con 4 dificultades.

Los perfiles se guardan en `data/profiles.json`; cada navegador recuerda su token.

## Arquitectura

- **Servidor autoritativo** (Node + `ws`, 30 ticks/s): `server/battle.js` simula el combate,
  `server/ai.js` la IA (usa la misma entrada que un jugador), `server/story.js` la historia,
  `server/index.js` conexiones, colas, draft y ELO, `server/store.js` los perfiles.
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

`node tools/import-sprites.js <clon de PokéSurvivor>` copia los sprites de todas las especies de
`data.js` y regenera `public/sprites/meta.js` y la tabla de artistas de `CREDITS.md`.
