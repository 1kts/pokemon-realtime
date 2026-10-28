# PokéArenas: cómo se trabaja aquí

Juego de combates Pokémon en tiempo real en el navegador. Servidor Node (`server.js`, `server/`) con `ws` y SQLite
(`node:sqlite`); cliente en módulos ES sin paso de build (`public/js/`), three.js r160 en `public/vendor/`.
La simulación compartida entre servidor y cliente está en `public/shared.js`; los datos del juego, en `public/data.js`
y `public/regions.js`. Ver `README.md` (jugar y modos) y `deploy/README.md` (servidor).

## Arrancar y probar

```bash
npm start                                   # http://localhost:3000
npm test                                    # servidor, tienda, seguridad, admin, arenas, i18n, notas, legal y 60 combates simulados
node tools/e2e.js tests/e2e/movil.e2e.js    # un e2e (ver tests/e2e/README.md); sin argumentos, todos
```

En esta máquina el Chrome de los e2e se pasa con `CHROME=~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`.

## Ramas, CI y despliegue

- Se sube a `develop` y a `main`. El hook de pre-push (`.githooks/pre-push`, `tools/require-tests.js`) exige un e2e
  por cada punto `nuevo` de las notas y algún test por cada cambio de código; a `main` no se le aplica.
- El CI pasa `npm test` y los e2e en cada push. **Solo despliega `main` si pasa `npm test`**: con el CI en rojo,
  producción se queda en la versión anterior sin avisar. Después de subir, comprobar que
  `https://pokearenas.com/healthz` da la versión nueva.
- Todo cambio que el jugador note lleva notas de parche y versión nueva: skill `patch-notes`.

## Flujo con las skills

- Antes de subir código del juego: `code-review` (nivel medio) sobre el cambio; `simplify` si el cambio es grande.
- Un fallo que llega del jugador: `engineering:debug`. Algo grande (p. ej. pasar los tests a Playwright):
  `engineering:architecture` antes de empezar.
- De vez en cuando: `engineering:tech-debt`, `security-review` (cuentas, panel de admin y el WebSocket público) y
  `engineering:testing-strategy`.
- Escenarios 3D: skill `arenas-3d`. Efectos de los movimientos: skill `vfx-3d`.

## Tests que no sean complacientes

- Un test comprueba lo que ve y hace el jugador (texto visible, que nada tape un botón, que quepa en pantalla),
  no clases CSS ni detalles de cómo está hecho.
- Pulsar y escribir como un jugador (`page.click`, `page.type`, `page.slide`, `page.press`: entradas reales) en vez de
  `.click()` dentro de `eval` o de `ui.show()`; si hace falta un atajo, `// atajo: motivo` (`tools/e2e-lint.js`).
- Si un test falla, primero se sospecha del código. Cambiar un test para que pase solo cuando el comportamiento ha
  cambiado a propósito, y diciéndolo.
- Lo de móvil se prueba en 844×390 y 667×375 (horizontal) con `localStorage arena.touch = '1'`.

## Convenciones

- Textos con `t('…')` en español; cada texto nuevo va traducido en los 7 idiomas de `public/js/lang/`
  (`node tools/i18n-check.js --strict`). Dentro de `t()` no va un ternario: dos `t()`.
- La CSP no deja manejadores en línea (`onclick=""`, `onerror=""`): se asignan desde JS.
- Móvil en horizontal: `@media (max-height: 500px)`, en `public/mobile.css` (por pantallas, junto con lo de ventana
  estrecha y vertical; se carga después de `cards.css`). Pantalla táctil: `touchMode()` (`public/js/touch.js`),
  `body.touch` y `#hud.touch`. El mapa de Historia es un contenedor: se adapta con `@container`.
- Tras tocar el CSS: `tests/e2e/pantallas-*.e2e.js` (nada tapado, desbordado ni inaccesible en 4 tamaños).
- Comentarios en español, en el tono del código de alrededor.
