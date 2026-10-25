---
name: patch-notes
description: Escribe las notas de parche de PokéArenas (public/changelog.js) de forma uniforme y pensada para el jugador, sube la versión (package.json) y las traduce a todos los idiomas del juego. Úsala SIEMPRE que se vaya a hacer commit, push o publicar un cambio que el jugador note (algo nuevo, un cambio de cómo se juega o se ve, un arreglo), aunque no se pidan notas explícitamente, y siempre que se mencionen notas de parche, changelog, novedades, release notes, "qué ha cambiado" o subir de versión. No hace falta para cambios que el jugador no ve (servidor, tests, panel de admin, despliegue, refactors).
---

# Notas de parche de PokéArenas

Las notas son lo que el jugador lee en la ventana de Novedades al entrar después de una actualización (y en
el aviso de la barra superior). Son un anuncio, no un registro técnico: tienen que hacer que el jugador sepa
**qué puede hacer ahora que antes no**, **qué se ha movido o se juega distinto** y **qué ya funciona bien**,
y que le den ganas de probarlo. Si una frase solo la entiende quien ha tocado el código, sobra.

## 1. ¿Hace falta nota?

Sí, si el jugador lo nota: una función nueva, un cambio en cómo se juega, se ve o se encuentra algo, o un
fallo que veía y ya no. No, si no lo ve: servidor, base de datos, seguridad interna, tests, despliegue, panel
de admin, refactors, rendimiento que no se percibe. Si un cambio interno tiene un efecto visible (p. ej. «la
web carga más rápido»), la nota cuenta el efecto, nunca la causa.

Para saber qué ha cambiado desde la última nota:
```bash
git log --oneline $(git log -1 --format=%H -- public/changelog.js)..HEAD
git diff $(git log -1 --format=%H -- public/changelog.js)..HEAD --stat -- public server
```
Mira también si hay cambios de otras sesiones sin nota: todas van a la misma versión.

## 2. Versión

Cada tanda de cambios que se sube a `develop` lleva su propia versión (los jugadores ven juntas todas las
que aún no se han publicado, así que no pasa nada por tener varias seguidas).
- Si `CHANGELOG[0].v` es **tuya y aún no la has subido** (es distinta de la de
  `git show origin/develop:package.json`), añade tus puntos a esa versión en vez de crear otra.
- Si no, crea una nueva al principio de la lista:
  - con algún punto `nuevo` → sube el número del medio: `0.12.1` → `0.13.0`;
  - solo `cambio` o `arreglo` → sube el último: `0.13.0` → `0.13.1`.
- Pon la misma versión en `package.json` (`"version"`). El servidor la anuncia y el cliente compara: si no
  coinciden, los jugadores verían el aviso de versión nueva en bucle.
- `date`: la fecha de hoy, `AAAA-MM-DD`.

## 3. Formato

```js
{
  v: '0.13.0', date: '2026-10-26', title: 'Buscador en Mis Pokémon',
  items: [
    ['nuevo', 'En Mis Pokémon puedes buscar por nombre o número y filtrar por tipo, shiny o legendarios.'],
    ['cambio', 'Solo las cuentas registradas salen en los rankings; crea una cuenta y entras con lo que ya tienes.'],
    ['arreglo', 'El aviso de versión nueva ya no aparece dos veces seguidas.'],
  ],
},
```

- **Título**: 2-5 palabras, lo más llamativo de la versión, sin punto final («Misiones y premios para
  recoger», «Cursor a tu gusto»). Es lo que sale en el aviso de la barra: que dé ganas de abrirlo.
- **Puntos**: de 1 a 6, en orden `nuevo` → `cambio` → `arreglo`, y dentro de cada grupo lo más importante
  primero. Si hay más de 6, junta los pequeños o deja fuera lo que menos se nota.
- **Cada punto**: una o dos frases, 25-180 caracteres, con mayúscula al principio y punto al final.

## 4. Cómo se escribe cada punto

- **De tú al jugador y en presente**: «Puedes…», «Tus Pokémon…», «Ahora…», o la cosa como sujeto («La
  Mochila enseña…»).
- **Qué y dónde**: di qué se puede hacer y dónde se encuentra («En Ajustes puedes elegir…», «Desde tu
  perfil…»). Un jugador tiene que poder ir directo a probarlo.
- **Concreto**: números y nombres del juego («18 logros de bronce, plata y oro», «4 Pokémon al día»), no
  «varias mejoras».
- **`arreglo`**: describe lo que ahora funciona, no el fallo ni la palabra «arreglado»: «La Torre guarda tu
  racha si cierras la pestaña en mitad de un combate.»
- **`cambio`**: si quita o empeora algo para el jugador, dilo claro y explica qué gana a cambio o qué hacer.
- Usa los nombres que ve el jugador (Mis Pokémon, Mochila, Ladder, Torre Batalla, Ajustes…), los nombres
  oficiales de Pokémon, movimientos y objetos, y «shiny» como en el resto del juego.
- Nada de: nombres de archivo, código, variables, «refactor», «servidor/base de datos/despliegue/panel de
  admin», referencias a tickets, ni promesas («pronto…»).

| Mal (técnico o vago) | Bien (para el jugador) |
|---|---|
| Añadido filtro en view_team con data-attrs | En Mis Pokémon puedes buscar por nombre o número y filtrar por tipo, shiny o legendarios. |
| Arreglado bug del ladder | La ladder ya enseña bien tu puesto cuando empatas a ELO con otro jugador. |
| Mejoras de rendimiento | Los combates van más fluidos con muchos efectos en pantalla. |
| Cambios en los rankings | Solo las cuentas registradas salen en los rankings; crea una cuenta y entras con lo que ya tienes. |

## 5. Traducciones

Cada título y cada punto se muestran en el idioma del jugador, así que se traducen a **todos** los idiomas
del juego (los de `LANGS` en `public/js/i18n.js`, menos el español). Escribe un JSON (en el scratchpad, no
en el repo) con la versión y, por idioma, cada texto en español como clave:

```json
{ "v": "0.13.0",
  "en": { "Buscador en Mis Pokémon": "Search in My Pokémon", "En Mis Pokémon puedes…": "In My Pokémon you can…" },
  "zh": { … }, "fr": { … }, "de": { … }, "ja": { … }, "ko": { … }, "it": { … } }
```

```bash
node tools/changelog-i18n.js /ruta/traducciones.json
```

Traduce el sentido y el tono (cercano, de tú; *du* en alemán, *tu* en francés e italiano), no palabra por
palabra, y usa los nombres oficiales de cada idioma: los de Pokémon, movimientos y objetos salen de los
diccionarios del juego, y *shiny* es *chromatique* (fr), *schillernd* (de), *cromatico* (it), 色違い (ja),
색이 다른 (ko) y 异色 (zh). Las variables `{n}` se quedan igual.

## 6. Comprobar

```bash
node tools/changelog-check.js        # formato, versión y estilo de estas reglas
node tools/i18n-check.js --strict    # todo traducido en todos los idiomas
npm test                             # incluye las dos cosas
```

`changelog-check.js` rechaza lo que se salta estas reglas (orden, longitudes, jerga, versión sin subir, etc.).
Si rechaza algo, corrige la nota; no relajes el comprobador para que pase.

Cada punto `nuevo` necesita además un **test e2e** en `tests/e2e/` que use la novedad como un jugador (ver
`tests/e2e/README.md`): el hook de pre-push y el CI no dejan subir ni desplegar una novedad sin él. Escribir
la nota y el test a la vez ayuda: si no sabes describir en el test qué hace el jugador, la nota tampoco lo
dirá claro.
