// Notas de cada versión, de la más nueva a la más antigua. La primera es la versión actual:
// mantenla igual que "version" en package.json (el servidor avisa si no coinciden).
// tag: 'nuevo' | 'cambio' | 'arreglo'
(function (root) {
  const CHANGELOG = [
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
