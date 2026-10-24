# Arena Monstruos

Prototipo de juego de combates de criaturas **en tiempo real** para navegador, inspirado en los combates tipo Pokémon. Las criaturas, nombres y gráficos son originales (dibujados con formas en canvas) para evitar problemas de copyright con Nintendo / The Pokémon Company.

## Cómo jugar

```bash
npm install
npm start          # http://localhost:3000
```

- **Combate online**: abre dos pestañas (o dos equipos en la misma red) y pulsa "Combate online" en ambas.
- **Contra bot**: un rival controlado por IA.

Controles: WASD para moverte, ratón para apuntar, clic izquierdo / clic derecho / Q / E para los cuatro movimientos (también 1‑4).

## Criaturas

| Criatura | Tipo | Movimientos |
|---|---|---|
| Brasilio | fuego | Ascuas, Llamarada, Embestida (carga), Escudo ígneo |
| Marejo | agua | Burbuja, Hidrochorro, Maremoto (área), Manantial (curación) |
| Hojarín | planta | Hoja afilada (abanico), Latigazo (corto alcance), Raíces (ralentiza), Corteza |

Tabla de tipos: fuego > planta > agua > fuego (×1,5 eficaz, ×0,67 poco eficaz). Los escudos reducen el daño un 80 %.

## Arquitectura de red

- **Servidor autoritativo** (Node + `ws`) que simula a 30 ticks/s: movimiento, cooldowns, proyectiles, daño y fin de combate. El cliente nunca decide si un golpe acierta.
- El cliente envía su **entrada** por tick (dirección, ángulo de apuntado, movimiento lanzado, número de secuencia).
- **Predicción en cliente + reconciliación**: tu criatura se mueve al instante; al llegar cada instantánea se parte de la posición del servidor y se repiten las entradas no confirmadas. Los errores se suavizan.
- **Interpolación** del rival y de los proyectiles con 100 ms de retraso para que se vean fluidos.
- La lógica compartida (datos de criaturas, tabla de tipos, paso de movimiento) vive en `public/shared.js` y la usan servidor y cliente.

## Estructura

```
server.js          servidor HTTP + WebSocket y simulación del combate
public/shared.js   datos y reglas compartidas
public/client.js   red, predicción, interpolación, entrada y render
public/index.html  menú y canvas
public/style.css
```

## Siguientes pasos posibles

Equipos de varias criaturas con cambio en combate, más tipos y movimientos, obstáculos en la arena, salas con código para jugar con amigos, sprites propios, sonido y despliegue (Fly.io, Render, Railway…).
