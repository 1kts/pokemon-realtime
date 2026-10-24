# PokéArenas

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

Los perfiles se guardan en `data/arena.db` (SQLite; un `data/profiles.json` antiguo se importa solo al arrancar);
cada navegador recuerda su token.

## Cuentas, perfil y temporadas

- Se puede jugar como **invitado** (la partida vive en ese navegador) o con **cuenta** (usuario y contraseña,
  guardada con scrypt y sal). Un invitado puede registrarse desde su perfil sin perder nada.
- **Perfil**: estadísticas, últimas 15 clasificatorias, títulos, marcos y Pokémon de avatar.
- **Temporada** (`SEASON` en `public/data.js`): cada liga alcanzada da un premio que se reclama una vez por
  temporada (`RANKED_REWARDS`). Para cerrar una temporada, sube `SEASON.id` (y sus fechas): al entrar, cada
  jugador cobra `SEASON_REWARDS` según su mejor liga, gana un título desde Oro y su ELO se acerca a la mitad
  hacia 1000.
- **Novedades**: `public/changelog.js`. La primera entrada debe coincidir con `version` de `package.json`;
  los jugadores con la página abierta ven un aviso para recargar cuando se despliega otra versión.

## Publicar

Va en un servidor de **Hetzner** (Ubuntu 24.04) con Caddy delante para el HTTPS. Cada push a `main` pasa las
pruebas y se despliega solo con GitHub Actions (`.github/workflows/ci.yml`). Cómo preparar el servidor la primera
vez, el dominio, las copias de seguridad y cómo volver a una versión anterior: [deploy/README.md](deploy/README.md).

- Hace falta un **Node con proceso persistente** (WebSocket): no sirve un hosting estático ni serverless.
- Los perfiles van en SQLite (`DB_FILE`, por defecto `data/arena.db`), que debe estar en un **disco persistente**.
- Al desplegar, el servidor recibe `SIGTERM`: deja de aceptar colas y combates nuevos, espera a que acaben los que
  están en curso (como mucho 5 min) y guarda los perfiles antes de salir. El hosting tiene que dar ese margen
  (systemd: `TimeoutStopSec=330`). Al volver a conectar, el cliente ve la versión nueva y se recarga solo en
  cuanto el jugador está en los menús.
- Detrás de HTTPS el cliente usa `wss://` solo. `GET /healthz` devuelve `{ ok, version, players }`.
- No definas `ARENA_DEV` en producción (activa el gancho de desarrollo que regala dinero y Pokémon).

## Arquitectura

- **Servidor autoritativo** (Node + `ws`, 30 ticks/s): `server/battle.js` simula el combate,
  `server/ai.js` la IA (usa la misma entrada que un jugador), `server/story.js` la historia,
  `server/tower.js` la Torre Batalla, `server/index.js` conexiones, colas, draft y ELO, `server/store.js` los
  perfiles (SQLite, solo se escribe lo que cambia) y la ladder.
- **Datos y reglas compartidos**: `public/data.js` (tipos, 62 movimientos, 78 Pokémon, mapas, rutas,
  gimnasios, tienda) y `public/shared.js` (movimiento con colisiones, estadísticas por nivel).
- **Cliente** (`public/js/`): predicción del propio movimiento con reconciliación e interpolación del
  rival; Three.js con sombras, bloom y partículas; sprites como billboards con sombra de silueta.

## Idiomas

Inglés (por defecto), español y chino simplificado. Cada jugador elige el suyo en Ajustes o en la portada
(se recuerda en el navegador). Los textos se escriben en español dentro de `t('…')` (`public/js/i18n.js`) y
esa frase es la clave en cada diccionario (`public/js/lang/<idioma>.js`); lo que no está traducido sale en
español. Los nombres oficiales de Pokémon, movimientos, tipos, objetos, naturalezas y estadísticas salen de
PokeAPI con `node tools/fetch-names.js <idioma>` (genera `lang/names-<idioma>.js`), y los mensajes que llegan
ya montados del servidor se traducen con `patterns`. Cada idioma se descarga solo cuando se elige.
`npm run i18n` lista lo que falta (el inglés es la referencia) y `npm test` falla si falta algo.

Para añadir un idioma: copia `en.js`, tradúcelo, genera sus nombres si PokeAPI los tiene y añádelo a `LANGS`,
`LOCALES` y, si tiene nombres, `HAS_NAMES` en `i18n.js`.

## Pruebas

```bash
npm test               # integración del servidor + 60 combates IA contra IA
npm run test:sim 300   # más combates
```

## Sprites

`node tools/fetch-dex.js <clon de PokéSurvivor>` descarga de PokeAPI los datos de las 966 especies con sprite
(`public/dex.js`) y `node tools/import-sprites.js <clon de PokéSurvivor>` copia los sprites de todas las especies de
`data.js` y regenera `public/sprites/meta.js` y la tabla de artistas de `CREDITS.md`.

## Apoyar el proyecto

PokéArenas es gratis y sin ánimo de lucro. Si quieres ayudar a pagar el servidor, puedes invitarme a un café en [Ko-fi](https://ko-fi.com/1kts_). Donar no da ninguna ventaja en el juego.
