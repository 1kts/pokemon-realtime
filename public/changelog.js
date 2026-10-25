// Notas de cada versión, de la más nueva a la más antigua. La primera es la versión actual:
// mantenla igual que "version" en package.json (el servidor avisa si no coinciden).
// tag: 'nuevo' | 'cambio' | 'arreglo'
(function (root) {
  const CHANGELOG = [
    {
      v: '0.16.0', date: '2026-10-25', title: 'Música para cada momento',
      items: [
        ['nuevo', 'El juego tiene música: un tema para los menús y el mapa, y otros para los combates, los líderes y el Campeón, con fanfarria al ganar.'],
        ['nuevo', 'En Ajustes puedes subir o bajar el volumen de la música, o quitarla; se recuerda en este navegador.'],
      ],
    },
    {
      v: '0.15.5', date: '2026-10-25', title: 'Cámara centrada',
      items: [
        ['cambio', 'La cámara del combate queda centrada: el campo ya no se ve pegado a la parte de arriba de la pantalla.'],
      ],
    },
    {
      v: '0.15.4', date: '2026-10-25', title: 'Cámara más abierta',
      items: [
        ['cambio', 'La cámara del combate está más lejos: ves el campo entero, también las esquinas de abajo, y el HUD ya no tapa a ningún Pokémon.'],
      ],
    },
    {
      v: '0.15.3', date: '2026-10-25', title: 'Curarse tiene precio',
      items: [
        ['cambio', 'Acua Aro, Síntesis y Luz Lunar curan el 16 % (antes 20-22 %), tardan 20 s en recargarse y te dejan aturdido 1,2 s: cúrate lejos del rival.'],
        ['cambio', 'Descanso cura el 35 % (antes 50 %), tarda 28 s en recargarse y te duerme 2,5 s; es la única cura que quita quemadura, veneno y drenadoras.'],
      ],
    },
    {
      v: '0.15.2', date: '2026-10-25', title: 'Mapa más limpio',
      items: [
        ['cambio', 'Los caminos del mapa de la historia ya no llevan línea discontinua: así destacan las que van de «Estás aquí» a las rutas nuevas y a tu siguiente reto.'],
      ],
    },
    {
      v: '0.15.0', date: '2026-10-25', title: 'Los líderes dan la cara',
      items: [
        ['nuevo', 'Cada líder, miembro del Alto Mando y Campeón sale con su sprite de los juegos al elegirlo en el mapa de la historia.'],
        ['nuevo', 'Al empezar un combate contra un líder, se presenta con su sprite antes del combate y su cara queda junto a su nombre en el marcador.'],
        ['cambio', 'En el mapa, el Alto Mando y los Campeones se reconocen por su cara en vez de por una estrella.'],
      ],
    },
    {
      v: '0.14.0', date: '2026-10-25', title: 'Buscador y shiny a tu gusto',
      items: [
        ['nuevo', 'En Mis Pokémon puedes buscar por nombre o número, filtrar la caja por tipo, shiny o legendarios y ordenarla a tu gusto.'],
        ['nuevo', 'Tus shiny tienen un botón para verlos con sus colores normales, también en combate; siguen contando como shiny.'],
        ['cambio', 'En los rankings solo salen las cuentas registradas: crea una cuenta desde tu perfil y entras con todo lo que ya tienes.'],
        ['cambio', 'Las partidas de invitado que pasan 60 días sin conectarse se borran; crea una cuenta para no perder la tuya.'],
        ['cambio', 'La ayuda «Cómo se juega» del menú explica la forma de cada ataque y las mecánicas de las arenas.'],
      ],
    },
    {
      v: '0.13.0', date: '2026-10-25', title: 'Mapa más claro y medallas en el mapa',
      items: [
        ['nuevo', 'Los gimnasios del mapa muestran su medalla, en color si ya la tienes.'],
        ['nuevo', 'El mapa marca dónde estás, tu objetivo, las rutas nuevas, lo que llevas capturado en cada una y lo que sigue bloqueado.'],
      ],
    },
    {
      v: '0.12.1', date: '2026-10-25', title: 'Cursor a tu gusto',
      items: [
        ['nuevo', 'En Ajustes puedes elegir el color del cursor; también tiñe la retícula del combate.'],
        ['cambio', 'Los filtros de tipo y de orden de Mis Pokémon y la Pokédex tienen el estilo del juego, con el icono de cada tipo.'],
      ],
    },
    {
      v: '0.12.0', date: '2026-10-25', title: 'Renders 3D, iconos y animaciones',
      items: [
        ['nuevo', 'La ficha de la Pokédex enseña cada Pokémon como sprite, render 3D de HOME, ilustración oficial y animación.'],
        ['nuevo', 'Al capturar un Pokémon lo ves en 3D, y las listas usan los iconos de menú de los juegos.'],
        ['cambio', 'Las medallas sin el borde blanco y Protección con un icono como el de los tipos.'],
      ],
    },
    {
      v: '0.11.0', date: '2026-10-25', title: 'Misiones y premios para recoger',
      items: [
        ['nuevo', 'Misiones diarias y semanales: cúmplelas jugando y recoge su premio. Si una no te convence, cámbiala por otra.'],
        ['nuevo', 'Recoge las 3 misiones del día o de la semana para abrir su cofre.'],
        ['nuevo', 'Cada medalla de gimnasio y cada logro te dan un avatar nuevo para tu perfil.'],
        ['cambio', 'Los premios de los logros ya no llegan solos: se recogen en Misiones.'],
      ],
    },
    {
      v: '0.10.0', date: '2026-10-25', title: 'Marcos animados y maestría de Pokémon',
      items: [
        ['nuevo', 'Los marcos de liga y de logros tienen efectos: brillos, laureles, gemas, órbitas y la corona del Maestro.'],
        ['nuevo', 'Maestría: cada victoria suma a la línea evolutiva de tus Pokémon. A 10, estrella; a 50, su ilustración oficial como avatar; a 100, el marco animado de su tipo.'],
      ],
    },
    {
      v: '0.9.2', date: '2026-10-25', title: 'Avatares shiny y buscador',
      items: [
        ['nuevo', 'Puedes elegir de avatar la versión shiny de los Pokémon que tengas en shiny.'],
        ['nuevo', 'El selector de avatar tiene buscador por nombre o número.'],
      ],
    },
    {
      v: '0.9.1', date: '2026-10-25', title: 'Ataques como antes e iconos oficiales',
      items: [
        ['cambio', 'Los proyectiles vuelven a ser los de antes, con su brillo.'],
        ['cambio', 'Cada movimiento lleva el icono oficial de su tipo.'],
      ],
    },
    {
      v: '0.9.0', date: '2026-10-25', title: 'Logros e insignias',
      items: [
        ['nuevo', '18 logros de bronce, plata y oro con premios: títulos, dinero y marcos nuevos (Pokédex, Shiny, Campeón y Torre).'],
        ['nuevo', 'Fija hasta 3 logros como insignias en tu perfil; se ven también en tu ficha pública.'],
      ],
    },
    {
      v: '0.8.2', date: '2026-10-25', title: 'Mochila y estilo propio',
      items: [
        ['nuevo', 'Nueva Mochila en la barra superior: ves todos tus objetos y los usas eligiendo el objeto y luego el Pokémon.'],
        ['cambio', 'Botones dorados y cabeceras azules propias de PokéArenas.'],
      ],
    },
    {
      v: '0.8.1', date: '2026-10-25', title: 'Medallas y ataques nuevos',
      items: [
        ['nuevo', 'Las medallas son las de los juegos: en la barra de la región, al ganarlas y en el nuevo estuche de medallas del perfil.'],
        ['cambio', 'Los proyectiles son sprites pixel art con la forma de cada ataque: llamas, gotas, rayos, burbujas, estrellas…'],
        ['arreglo', 'En los escenarios claros (hielo, piscina, baldosas) los efectos y los avisos se oscurecen para verse bien.'],
      ],
    },
    {
      v: '0.8.0', date: '2026-10-25', title: 'Nuevo aspecto',
      items: [
        ['cambio', 'Interfaz renovada: tipografía redondeada, botones y ventanas con rayas, y tarjetas del menú con icono.'],
        ['nuevo', 'Iconos de objetos reales en la tienda, el equipo y los premios, y monedas pixel art.'],
        ['nuevo', 'Cada movimiento muestra un emblema con su tipo y su forma (proyectil, cono, rayo, embestida…).'],
      ],
    },
    {
      v: '0.7.1', date: '2026-10-24', title: 'Nuevo nombre: PokéArenas',
      items: [
        ['cambio', 'El juego pasa a llamarse PokéArenas.'],
        ['nuevo', 'Botón de Ko-fi para quien quiera ayudar a pagar el servidor. El juego es y seguirá siendo gratis, y donar no da ventajas.'],
      ],
    },
    {
      v: '0.7.0', date: '2026-10-24', title: 'Pokédex, guía y Pokémon del día',
      items: [
        ['nuevo', 'Pokédex con las 966 especies: filtra por generación, tipo y las que te faltan, y mira en qué rutas aparece cada una (y si sale hoy).'],
        ['nuevo', 'Guía del modo historia: cómo funcionan las regiones, las rutas, las capturas, el tope de nivel y los líderes.'],
        ['nuevo', 'Cuenta atrás hasta que cambian los Pokémon de las rutas y de la tienda.'],
        ['nuevo', 'La tienda vende 4 Pokémon al día con IV perfectos, muy caros y de uno en uno; cambian a la vez que las rutas.'],
        ['nuevo', 'El Pokémon misterioso de cada ruta tiene IV perfectos 1 de cada 3 veces.'],
      ],
    },
    {
      v: '0.6.0', date: '2026-10-24', title: 'Movimientos con forma propia',
      items: [
        ['cambio', 'Lanzallamas, Ventisca, Zumbido, Nieve Polvo, Viento Feérico y Bofetón Lodo salen en cono delante de ti.'],
        ['cambio', 'Surf es una ola ancha que avanza, moja el suelo y no se puede devolver con un parry.'],
        ['cambio', 'Llamarada y Bomba Lodo estallan donde apuntas; Bomba Lodo deja un charco tóxico.'],
        ['cambio', 'Cometa Draco hace caer tres meteoritos, Avalancha cae en fila e Ida y Vuelta vuelve a su sitio.'],
        ['nuevo', 'Terremoto de las arenas con counterplay: escóndete detrás de una roca (zona verde) y la onda no te alcanza.'],
      ],
    },
    {
      v: '0.5.0', date: '2026-10-24', title: 'Salas del Alto Mando y rutas únicas',
      items: [
        ['nuevo', 'Cada miembro del Alto Mando y cada Campeón tiene su propia sala, con dos o tres mecánicas a la vez y más intensas.'],
        ['nuevo', 'Carámbanos en la Cámara Glacial de Lorelei, aliento de dragón giratorio en la Guarida de Lance y haz psíquico en la sala de Mento.'],
        ['cambio', 'El Alto Mando y los Campeones llevan Pokémon con IV perfectos y entrenamiento en todas las estadísticas.'],
        ['nuevo', 'Cada ruta tiene su propio mapa, siempre el mismo, según sea pradera, bosque, cueva o lago.'],
        ['cambio', 'Las rutas de Johto tienen colores de otoño.'],
      ],
    },
    {
      v: '0.4.0', date: '2026-10-24', title: 'Arenas de gimnasio',
      items: [
        ['nuevo', 'Cada líder, Alto Mando y Campeón pelea en una arena de su tipo, con su escenario y una mecánica propia.'],
        ['nuevo', 'Rocas que caen en la cueva de Brock, marea en la piscina de Misty, placas eléctricas en la central de Lt. Surge y hierba que vuelve a crecer en el jardín de Erika.'],
        ['nuevo', 'Charcos tóxicos y muros invisibles en el dojo de Koga, teletransportes en la sala de Sabrina, lava y erupciones en el volcán de Blaine y terremotos en la arena de Giovanni.'],
        ['nuevo', 'En Johto: ráfagas de viento, telarañas, baldosas de curación, oscuridad, cascadas con corriente, el haz giratorio del faro y suelo helado en el que se resbala.'],
        ['nuevo', 'Cada tipo aguanta el peligro de su propia arena: los de fuego la lava, los eléctricos las placas, los voladores el viento…'],
        ['cambio', 'Las rutas tienen su propio escenario: bosque, cueva y lago.'],
        ['cambio', 'Los ataques de hielo congelan el agua, el fuego derrite el hielo, y el agua y el hielo del mapa vuelven al pasar el efecto.'],
      ],
    },
    {
      v: '0.3.0', date: '2026-10-24', title: 'Cuentas, perfil y Temporada 1',
      items: [
        ['nuevo', 'Cuentas con usuario y contraseña: regístrate sin perder tu partida de invitado y entra desde cualquier dispositivo.'],
        ['nuevo', 'Pantalla de perfil: estadísticas, historial de clasificatorias, títulos, marcos y Pokémon de avatar.'],
        ['nuevo', 'Temporada 1 de clasificatoria: premio por cada liga alcanzada (dinero, objetos, título y marco) y premio de fin de temporada.'],
        ['nuevo', 'Dinero por cada clasificatoria y extra por la primera victoria del día.'],
        ['nuevo', 'Ranking con tu puesto, títulos y marcos.'],
        ['nuevo', 'Esta pantalla de novedades. Cuando sale una versión nueva, el juego se actualiza solo al volver a los menús, sin cortar tu combate.'],
      ],
    },
    {
      v: '0.2.0', date: '2026-10-24', title: 'Kanto y Johto',
      items: [
        ['nuevo', 'Kanto y Johto reales: rutas con sus encuentros, líderes, Alto Mando y Campeón.'],
        ['nuevo', 'Inicial propio en cada región; tus Pokémon combaten solo en la suya.'],
        ['nuevo', 'Mapa de cada región con tiles pixel art.'],
        ['nuevo', 'Naturalezas, IV y EV como en los juegos; vitaminas en la tienda.'],
        ['nuevo', 'Shinies, hitbox según el tamaño, ficha con stats y venta de Pokémon.'],
        ['nuevo', 'Movimientos por nivel a elegir y tope de nivel por gimnasio.'],
        ['cambio', 'Rediseño de la interfaz; Mis Pokémon y Tienda accesibles desde cualquier pantalla.'],
        ['arreglo', 'El mapa de la región no cargaba tras elegir inicial.'],
      ],
    },
    {
      v: '0.1.0', date: '2026-10-24', title: 'Primera versión',
      items: [
        ['nuevo', 'Combates en tiempo real HD-2D con preparación, recuperación, Protección y parry.'],
        ['nuevo', 'Historia, clasificatoria con draft y ELO, partida rápida y práctica contra la IA.'],
        ['nuevo', 'Pokémon de las 9 generaciones, rutas temáticas y Pokémon misterioso del día.'],
        ['nuevo', 'Captura con Poké Balls y animación de 3 sacudidas.'],
        ['nuevo', 'IA por utilidad que se adapta al combate.'],
      ],
    },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = CHANGELOG;
  else root.CHANGELOG = CHANGELOG;
})(this);
