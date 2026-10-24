// Notas de cada versión, de la más nueva a la más antigua. La primera es la versión actual:
// mantenla igual que "version" en package.json (el servidor avisa si no coinciden).
// tag: 'nuevo' | 'cambio' | 'arreglo'
(function (root) {
  const CHANGELOG = [
    {
      v: '0.3.0', date: '2026-10-24', title: 'Cuentas, perfil y Temporada 1',
      items: [
        ['nuevo', 'Cuentas con usuario y contraseña: regístrate sin perder tu partida de invitado y entra desde cualquier dispositivo.'],
        ['nuevo', 'Pantalla de perfil: estadísticas, historial de clasificatorias, títulos, marcos y Pokémon de avatar.'],
        ['nuevo', 'Temporada 1 de clasificatoria: premio por cada liga alcanzada (dinero, objetos, título y marco) y premio de fin de temporada.'],
        ['nuevo', 'Dinero por cada clasificatoria y extra por la primera victoria del día.'],
        ['nuevo', 'Ranking con tu puesto, títulos y marcos.'],
        ['nuevo', 'Esta pantalla de novedades y aviso cuando hay una versión nueva.'],
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
