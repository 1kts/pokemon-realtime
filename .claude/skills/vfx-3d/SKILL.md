---
name: vfx-3d
description: Guía para hacer o rehacer los efectos 3D de los movimientos de PokéArenas (estilo HD hecho a mano en public/js/vfxhd.js). Úsala al crear o mejorar el efecto de cualquier ataque, curación, mejora o terremoto en 3D.
---

# Efectos 3D de los movimientos (estilo HD)

Los efectos 3D están en `public/js/vfxhd.js`. Se conectan desde `public/js/effects.js`, y desde `battle.js` en el caso de las curaciones, mejoras y embestidas, **siempre bajo `if (this.v3)`**, que es el estilo 3D. El estilo pixel no se toca.
El estilo 3D sale con `localStorage['arena.vfx'] = '3d'` y por defecto en `localhost`. Los tests usan `127.0.0.1` y van en pixel.

## Qué le gusta al dueño (y qué no)

- **Sí**: geometría hecha a mano con volumen y movimiento. Por ejemplo, Hidrobomba (núcleo con textura que fluye y dos espirales que se enroscan), los 3 anillos de Hipnosis, el zigzag del Rayo, las hojas que barren en los golpes, la columna con anillos de las curas y las grietas con picos de roca del Terremoto.
- **No**: sprites o texturas planas de partículas (las de Kenney y wawa-vfx le parecieron «feísimas, demasiado básicas» y «muy translúcidas»), ni bolas sueltas que no dicen nada.
- Cada tipo con **su forma**: fuego con llamas, agua con gotas o espiral, eléctrico con zigzag, hielo y acero con cristales, tierra y roca con piedras, fantasma con fuegos fatuos, dragón con hélice, hada con estrellas…
- Que se lea bien sobre la hierba y en arenas claras. Si todo es aditivo, sale blanco quemado. Usa `orbMaterial` con mezcla normal (`alpha < 1`) para el cuerpo, y `glowMat`, que es aditivo, solo para filos, halos finos y espirales.

## Piezas que ya hay (en vfxhd.js)

- `orbMaterial({ a, b, c, disp, speed, scale, rim, additive, alpha })`: shader con ruido simplex que deforma la superficie, degradado de 3 colores y borde fresnel. Se anima con `uniforms.uTime` y se apaga con `uniforms.uAlpha`.
- `ORB[tipo]`: los colores (`a` oscuro, `b` medio, `c` brillo y `ribbon` del filo) y el `extra` de cada tipo.
- `glowMat(color, opacidad)`: un material aditivo que brilla.
- `solidMat(color, emisivo, rugosidad, metal)`: un material sólido de caras planas, para rocas y cristales.
- `Ribbon(scene, color, ancho, n)`: estela que se estrecha. Se le hace `push(vector)` en cada fotograma. Para que se recoja sola, mete `ribbon.mesh` en un grupo que pase por `addTemp`.
- `leafGeo()`, `starGeo()`, `boltPoints()`: formas.
- Ya hechos: `hdProjectile`, `hdImpact`, `hdSlash` (golpes), `hdBreath` (conos), `hdBoom` (explosiones y zonas), `hdAura` (curas y mejoras), `hdBeam` y `hdBolt` (rayos), `hdQuake` (terremoto), `hdDash` (embestidas), `hdSpikes` y `hdBlink`.

## Cómo se hace uno

1. Una función `export function hdAlgo(fx, ...)` en vfxhd.js que cree el grupo de mallas y llame a `fx.addTemp(obj, vidaMs, f => { ... })`, donde `f` va de 0 a 1. Al acabar, `addTemp` lo quita de la escena y libera las geometrías.
2. Las fases que mejor quedan: **abrirse rápido** (`Math.min(1, f * 6)`), **mantenerse** y **cerrarse al final** (`f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4`). Mientras dura, que algo gire, se enrosque o fluya.
3. Si se crea un `addTemp` **desde dentro de otro `update`**, hay que hacerlo con `queueMicrotask(() => fx.addTemp(...))`. Si no, el bucle de `update` se lo come y la malla se queda en la escena, quieta.
4. Para conectarlo en effects.js, ponlo al principio del método correspondiente (`beam`, `melee`, `cone`, `boom`, `quake`…): `if (this.v3) { hdAlgo(this, ...); return; }`. Si el efecto de antes ya es bueno y lo nuevo se suma, ponlo sin `return`.
5. Las coordenadas del juego se pasan al mundo con `toWorld(x, y, h)`, de world.js. Los radios del juego, en píxeles, se multiplican por `U` (1/40).

## Ver cómo queda (capturas)

El navegador de los tests va a ~4 FPS, así que hay que **controlar el reloj**: se cambia `performance.now` por `window.__t`, se lanzan los efectos y se avanza el reloj a mano. Puedes hacerlo de una vez (`__t = t0 + ms`) o con un paso fijo por fotograma (`requestAnimationFrame(() => __t += 25)`) para ver la cámara lenta. Es un test temporal, `tests/e2e/zz-hd.e2e.js`, que se borra después:

```js
await page.eval(`localStorage.setItem('arena.vfx', '3d'); true`); await page.reload();
// ...esconder #screen y .legal-bar, y luego:
const fx = window.__app.effects; window.__t = performance.now(); performance.now = () => window.__t;
fx.beam({ x1: 150, y1: 130, x2: 560, y2: 130, w: 20, ty: 'agua' });
fx.quake({ x: 900, y: 330, d: 0, sp: 1200 });
window.__t0 = window.__t; const step = () => { window.__t += 25; requestAnimationFrame(step); }; requestAnimationFrame(step);
// y capturas con page.shot() cuando window.__t pase de __t0 + ms
```

Se lanza con `PATH=$HOME/.nvm/versions/node/v24.11.1/bin:$PATH node tools/e2e.js tests/e2e/zz-hd.e2e.js`. Junta varias capturas en una con PIL (venv del scratchpad) y míralas. **Borra el test al acabar.**

## Estado

- Hechos en 3D: proyectiles (menos `vine` y `hypno`, que se quedan como estaban), impactos, golpes, conos, explosiones y zonas, y los rayos, incluido el eléctrico. También terremoto, curas y mejoras, embestidas, Teletransporte (`hdBlink`) y Trueno (`hdThunder`: rayo grueso con ramas que parpadea y descargas por el suelo). Surf lleva `hdWaveMaterial`, agua con textura que fluye, y una estela con `hdWake`. Las zonas tienen picos de roca o cristal (`hdSpikes`) y algo propio de cada tipo (`hdAreaExtra`: cometa de dragón, tornado, anillos psíquicos, estrellas de hada, fuegos fatuos, zarcillos siniestros y burbujas de veneno).
- Pendientes: Barrera (`world.js` `syncObstacles`), Pantalla de humo, Drenadoras (`seed`) y Látigo Cepa (`vine`).
