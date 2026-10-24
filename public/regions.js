// Generado por tools/fetch-regions.js (tools/regions-src.js + encuentros reales de PokeAPI). No editar a mano.
// Ruta: wild = [[dex, nivel mín, nivel máx, peso %], ...]. Líderes: team real completo.
(function (root) {
  const REGIONS = {
 "kanto": {
  "id": "kanto",
  "name": "Kanto",
  "legends": [
   144,
   145,
   146,
   150,
   151,
   143,
   131,
   147,
   133,
   142
  ],
  "nodes": [
   {
    "kind": "route",
    "id": "k-ruta1",
    "name": "Ruta 1",
    "req": 0,
    "map": "pradera",
    "x": 18,
    "y": 76,
    "wild": [
     [
      16,
      2,
      5,
      50
     ],
     [
      19,
      2,
      4,
      50
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta22",
    "name": "Ruta 22",
    "req": 0,
    "map": "pradera",
    "x": 8,
    "y": 62,
    "wild": [
     [
      19,
      2,
      5,
      29
     ],
     [
      56,
      2,
      5,
      29
     ],
     [
      129,
      5,
      9,
      14
     ],
     [
      54,
      5,
      9,
      8
     ],
     [
      79,
      5,
      9,
      8
     ],
     [
      21,
      3,
      5,
      6
     ],
     [
      60,
      5,
      9,
      5
     ],
     [
      118,
      5,
      9,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta2",
    "name": "Ruta 2",
    "req": 0,
    "map": "pradera",
    "x": 18,
    "y": 54,
    "wild": [
     [
      19,
      2,
      5,
      45
     ],
     [
      16,
      2,
      5,
      45
     ],
     [
      10,
      4,
      5,
      5
     ],
     [
      13,
      4,
      5,
      5
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-bosque",
    "name": "Bosque Verde",
    "req": 0,
    "map": "bosque",
    "x": 18,
    "y": 42,
    "wild": [
     [
      10,
      3,
      5,
      40
     ],
     [
      13,
      3,
      5,
      40
     ],
     [
      11,
      4,
      6,
      8
     ],
     [
      14,
      4,
      6,
      8
     ],
     [
      25,
      3,
      5,
      5
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "brock",
    "name": "Gimnasio Plateada",
    "leader": "Brock",
    "type": "roca",
    "badge": "Medalla Roca",
    "map": "cueva",
    "ai": 0.2,
    "reward": 600,
    "team": [
     [
      74,
      12
     ],
     [
      95,
      14
     ]
    ],
    "x": 18,
    "y": 28
   },
   {
    "kind": "route",
    "id": "k-ruta3",
    "name": "Ruta 3",
    "req": 1,
    "map": "pradera",
    "x": 30,
    "y": 26,
    "wild": [
     [
      21,
      6,
      8,
      35
     ],
     [
      16,
      6,
      7,
      30
     ],
     [
      56,
      7,
      7,
      10
     ],
     [
      39,
      3,
      7,
      10
     ],
     [
      32,
      6,
      7,
      8
     ],
     [
      29,
      6,
      7,
      8
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-montemoon",
    "name": "Monte Moon",
    "req": 1,
    "map": "cueva",
    "x": 42,
    "y": 20,
    "wild": [
     [
      46,
      5,
      12,
      40
     ],
     [
      41,
      7,
      11,
      39
     ],
     [
      74,
      7,
      10,
      18
     ],
     [
      35,
      8,
      12,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta4",
    "name": "Ruta 4",
    "req": 1,
    "map": "pradera",
    "x": 52,
    "y": 24,
    "wild": [
     [
      21,
      8,
      12,
      22
     ],
     [
      19,
      8,
      12,
      22
     ],
     [
      72,
      6,
      16,
      16
     ],
     [
      129,
      6,
      15,
      14
     ],
     [
      23,
      6,
      12,
      8
     ],
     [
      27,
      6,
      12,
      8
     ],
     [
      116,
      6,
      15,
      3
     ],
     [
      98,
      6,
      15,
      3
     ],
     [
      56,
      10,
      12,
      3
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "misty",
    "name": "Gimnasio Celeste",
    "leader": "Misty",
    "type": "agua",
    "badge": "Medalla Cascada",
    "map": "lago",
    "ai": 0.28,
    "reward": 900,
    "team": [
     [
      120,
      18
     ],
     [
      121,
      21
     ]
    ],
    "x": 64,
    "y": 22
   },
   {
    "kind": "route",
    "id": "k-ruta24",
    "name": "Ruta 24",
    "req": 2,
    "map": "pradera",
    "x": 64,
    "y": 10,
    "wild": [
     [
      72,
      7,
      18,
      16
     ],
     [
      129,
      7,
      15,
      14
     ],
     [
      13,
      7,
      7,
      13
     ],
     [
      10,
      7,
      7,
      13
     ],
     [
      16,
      11,
      13,
      10
     ],
     [
      63,
      8,
      12,
      10
     ],
     [
      43,
      12,
      14,
      8
     ],
     [
      69,
      12,
      14,
      8
     ],
     [
      116,
      7,
      15,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta25",
    "name": "Ruta 25",
    "req": 2,
    "map": "pradera",
    "x": 76,
    "y": 8,
    "wild": [
     [
      129,
      8,
      15,
      14
     ],
     [
      13,
      8,
      8,
      13
     ],
     [
      10,
      8,
      8,
      13
     ],
     [
      16,
      11,
      13,
      10
     ],
     [
      63,
      9,
      13,
      10
     ],
     [
      54,
      14,
      18,
      8
     ],
     [
      43,
      12,
      14,
      8
     ],
     [
      79,
      14,
      18,
      8
     ],
     [
      69,
      12,
      14,
      8
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta5",
    "name": "Ruta 5",
    "req": 2,
    "map": "pradera",
    "x": 64,
    "y": 34,
    "wild": [
     [
      16,
      13,
      16,
      40
     ],
     [
      52,
      10,
      16,
      35
     ],
     [
      43,
      13,
      16,
      13
     ],
     [
      69,
      13,
      16,
      13
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta6",
    "name": "Ruta 6",
    "req": 2,
    "map": "pradera",
    "x": 64,
    "y": 56,
    "wild": [
     [
      16,
      13,
      16,
      25
     ],
     [
      52,
      10,
      16,
      22
     ],
     [
      129,
      10,
      15,
      14
     ],
     [
      54,
      16,
      20,
      8
     ],
     [
      43,
      13,
      16,
      8
     ],
     [
      79,
      16,
      20,
      8
     ],
     [
      69,
      13,
      16,
      8
     ],
     [
      60,
      10,
      15,
      5
     ],
     [
      118,
      10,
      15,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-diglett",
    "name": "Cueva Diglett",
    "req": 2,
    "map": "cueva",
    "x": 44,
    "y": 64,
    "wild": [
     [
      50,
      15,
      22,
      95
     ],
     [
      51,
      29,
      31,
      5
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "surge",
    "name": "Gimnasio Carmín",
    "leader": "Lt. Surge",
    "type": "electrico",
    "badge": "Medalla Trueno",
    "map": "pradera",
    "ai": 0.35,
    "reward": 1200,
    "team": [
     [
      100,
      21
     ],
     [
      25,
      18
     ],
     [
      26,
      24
     ]
    ],
    "x": 64,
    "y": 70
   },
   {
    "kind": "route",
    "id": "k-ruta11",
    "name": "Ruta 11",
    "req": 3,
    "map": "pradera",
    "x": 76,
    "y": 70,
    "wild": [
     [
      21,
      13,
      17,
      22
     ],
     [
      72,
      11,
      21,
      16
     ],
     [
      96,
      11,
      15,
      16
     ],
     [
      129,
      11,
      15,
      14
     ],
     [
      23,
      12,
      15,
      13
     ],
     [
      27,
      12,
      15,
      13
     ],
     [
      116,
      11,
      15,
      3
     ],
     [
      98,
      11,
      15,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta9",
    "name": "Ruta 9",
    "req": 3,
    "map": "pradera",
    "x": 76,
    "y": 22,
    "wild": [
     [
      19,
      14,
      17,
      40
     ],
     [
      21,
      13,
      17,
      35
     ],
     [
      23,
      11,
      17,
      13
     ],
     [
      27,
      11,
      17,
      13
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta10",
    "name": "Ruta 10",
    "req": 3,
    "map": "pradera",
    "x": 88,
    "y": 28,
    "wild": [
     [
      100,
      14,
      17,
      25
     ],
     [
      21,
      13,
      17,
      22
     ],
     [
      72,
      11,
      21,
      16
     ],
     [
      129,
      11,
      15,
      14
     ],
     [
      23,
      11,
      17,
      8
     ],
     [
      27,
      11,
      17,
      8
     ],
     [
      116,
      11,
      15,
      3
     ],
     [
      98,
      11,
      15,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-tunelroca",
    "name": "Túnel Roca",
    "req": 3,
    "map": "cueva",
    "x": 88,
    "y": 40,
    "wild": [
     [
      74,
      5,
      30,
      43
     ],
     [
      41,
      15,
      16,
      26
     ],
     [
      56,
      16,
      17,
      13
     ],
     [
      66,
      16,
      17,
      11
     ],
     [
      95,
      13,
      17,
      7
     ],
     [
      75,
      25,
      40,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta8",
    "name": "Ruta 8",
    "req": 3,
    "map": "pradera",
    "x": 76,
    "y": 46,
    "wild": [
     [
      16,
      18,
      20,
      30
     ],
     [
      52,
      18,
      20,
      30
     ],
     [
      58,
      15,
      18,
      10
     ],
     [
      23,
      17,
      19,
      10
     ],
     [
      37,
      15,
      18,
      10
     ],
     [
      27,
      17,
      19,
      10
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta7",
    "name": "Ruta 7",
    "req": 3,
    "map": "pradera",
    "x": 50,
    "y": 46,
    "wild": [
     [
      52,
      17,
      20,
      40
     ],
     [
      16,
      19,
      22,
      30
     ],
     [
      43,
      19,
      22,
      10
     ],
     [
      69,
      19,
      22,
      10
     ],
     [
      58,
      18,
      20,
      5
     ],
     [
      37,
      18,
      20,
      5
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "erika",
    "name": "Gimnasio Azulona",
    "leader": "Erika",
    "type": "planta",
    "badge": "Medalla Arcoíris",
    "map": "bosque",
    "ai": 0.42,
    "reward": 1500,
    "team": [
     [
      71,
      29
     ],
     [
      114,
      24
     ],
     [
      45,
      29
     ]
    ],
    "x": 40,
    "y": 46
   },
   {
    "kind": "route",
    "id": "k-torre",
    "name": "Torre Pokémon",
    "req": 4,
    "map": "cueva",
    "x": 88,
    "y": 52,
    "wild": [
     [
      92,
      13,
      19,
      84
     ],
     [
      104,
      15,
      19,
      9
     ],
     [
      93,
      20,
      25,
      6
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta12",
    "name": "Ruta 12",
    "req": 4,
    "map": "lago",
    "x": 88,
    "y": 64,
    "wild": [
     [
      48,
      24,
      26,
      19
     ],
     [
      16,
      23,
      27,
      19
     ],
     [
      72,
      22,
      34,
      16
     ],
     [
      129,
      22,
      22,
      14
     ],
     [
      43,
      22,
      26,
      11
     ],
     [
      69,
      22,
      26,
      11
     ],
     [
      116,
      22,
      22,
      3
     ],
     [
      98,
      22,
      22,
      3
     ],
     [
      44,
      28,
      30,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta13",
    "name": "Ruta 13",
    "req": 4,
    "map": "pradera",
    "x": 82,
    "y": 80,
    "wild": [
     [
      48,
      24,
      26,
      19
     ],
     [
      72,
      22,
      34,
      16
     ],
     [
      129,
      22,
      22,
      14
     ],
     [
      16,
      25,
      27,
      13
     ],
     [
      43,
      22,
      26,
      11
     ],
     [
      69,
      22,
      26,
      11
     ],
     [
      116,
      22,
      22,
      3
     ],
     [
      98,
      22,
      22,
      3
     ],
     [
      132,
      25,
      25,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta14",
    "name": "Ruta 14",
    "req": 4,
    "map": "pradera",
    "x": 72,
    "y": 86,
    "wild": [
     [
      48,
      24,
      26,
      30
     ],
     [
      43,
      22,
      26,
      18
     ],
     [
      69,
      22,
      26,
      18
     ],
     [
      132,
      23,
      23,
      15
     ],
     [
      16,
      27,
      27,
      10
     ],
     [
      17,
      29,
      29,
      5
     ],
     [
      44,
      30,
      30,
      3
     ],
     [
      70,
      30,
      30,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta15",
    "name": "Ruta 15",
    "req": 4,
    "map": "pradera",
    "x": 60,
    "y": 86,
    "wild": [
     [
      48,
      24,
      26,
      30
     ],
     [
      16,
      25,
      27,
      20
     ],
     [
      43,
      22,
      26,
      18
     ],
     [
      69,
      22,
      26,
      18
     ],
     [
      132,
      25,
      25,
      5
     ],
     [
      17,
      29,
      29,
      5
     ],
     [
      44,
      28,
      30,
      3
     ],
     [
      70,
      28,
      30,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta16",
    "name": "Ruta 16",
    "req": 4,
    "map": "pradera",
    "x": 30,
    "y": 46,
    "wild": [
     [
      84,
      18,
      22,
      35
     ],
     [
      21,
      20,
      22,
      30
     ],
     [
      19,
      18,
      22,
      30
     ],
     [
      20,
      23,
      25,
      5
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta17",
    "name": "Ruta 17",
    "req": 4,
    "map": "pradera",
    "x": 26,
    "y": 62,
    "wild": [
     [
      84,
      24,
      28,
      35
     ],
     [
      21,
      20,
      22,
      30
     ],
     [
      20,
      25,
      29,
      25
     ],
     [
      19,
      22,
      22,
      5
     ],
     [
      22,
      25,
      27,
      5
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta18",
    "name": "Ruta 18",
    "req": 4,
    "map": "pradera",
    "x": 34,
    "y": 80,
    "wild": [
     [
      84,
      24,
      28,
      35
     ],
     [
      21,
      20,
      22,
      30
     ],
     [
      20,
      25,
      29,
      15
     ],
     [
      22,
      25,
      29,
      15
     ],
     [
      19,
      22,
      22,
      5
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "koga",
    "name": "Gimnasio Fucsia",
    "leader": "Koga",
    "type": "veneno",
    "badge": "Medalla Alma",
    "map": "cueva",
    "ai": 0.48,
    "reward": 1800,
    "team": [
     [
      109,
      37
     ],
     [
      89,
      39
     ],
     [
      109,
      37
     ],
     [
      110,
      43
     ]
    ],
    "x": 48,
    "y": 84
   },
   {
    "kind": "route",
    "id": "k-safari",
    "name": "Zona Safari",
    "req": 5,
    "map": "bosque",
    "x": 48,
    "y": 94,
    "wild": [
     [
      129,
      22,
      22,
      14
     ],
     [
      102,
      23,
      27,
      13
     ],
     [
      54,
      22,
      37,
      8
     ],
     [
      79,
      22,
      37,
      8
     ],
     [
      32,
      22,
      30,
      7
     ],
     [
      29,
      22,
      30,
      7
     ],
     [
      111,
      25,
      26,
      6
     ],
     [
      84,
      26,
      26,
      6
     ],
     [
      118,
      22,
      22,
      5
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "sabrina",
    "name": "Gimnasio Azafrán",
    "leader": "Sabrina",
    "type": "psiquico",
    "badge": "Medalla Pantano",
    "map": "pradera",
    "ai": 0.55,
    "reward": 2100,
    "team": [
     [
      64,
      38
     ],
     [
      122,
      37
     ],
     [
      49,
      38
     ],
     [
      65,
      43
     ]
    ],
    "x": 64,
    "y": 44
   },
   {
    "kind": "route",
    "id": "k-ruta19",
    "name": "Ruta 19",
    "req": 6,
    "map": "lago",
    "x": 48,
    "y": 98,
    "wild": [
     [
      72,
      5,
      40,
      43
     ],
     [
      129,
      5,
      15,
      39
     ],
     [
      116,
      5,
      15,
      9
     ],
     [
      98,
      5,
      15,
      9
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta20",
    "name": "Ruta 20",
    "req": 6,
    "map": "lago",
    "x": 36,
    "y": 96,
    "wild": [
     [
      72,
      5,
      40,
      43
     ],
     [
      129,
      5,
      15,
      39
     ],
     [
      116,
      5,
      15,
      9
     ],
     [
      98,
      5,
      15,
      9
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-espuma",
    "name": "Islas Espuma",
    "req": 6,
    "map": "lago",
    "x": 26,
    "y": 96,
    "wild": [
     [
      86,
      25,
      35,
      24
     ],
     [
      41,
      22,
      26,
      16
     ],
     [
      54,
      26,
      40,
      14
     ],
     [
      79,
      26,
      40,
      14
     ],
     [
      42,
      26,
      30,
      9
     ],
     [
      129,
      22,
      22,
      7
     ],
     [
      55,
      32,
      40,
      4
     ],
     [
      80,
      32,
      40,
      4
     ],
     [
      116,
      22,
      30,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta21",
    "name": "Ruta 21",
    "req": 6,
    "map": "lago",
    "x": 14,
    "y": 86,
    "wild": [
     [
      114,
      17,
      28,
      63
     ],
     [
      72,
      17,
      32,
      16
     ],
     [
      129,
      17,
      17,
      14
     ],
     [
      116,
      17,
      17,
      3
     ],
     [
      98,
      17,
      17,
      3
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "blaine",
    "name": "Gimnasio Canela",
    "leader": "Blaine",
    "type": "fuego",
    "badge": "Medalla Volcán",
    "map": "pradera",
    "ai": 0.6,
    "reward": 2400,
    "team": [
     [
      58,
      42
     ],
     [
      77,
      40
     ],
     [
      78,
      42
     ],
     [
      59,
      47
     ]
    ],
    "x": 12,
    "y": 96
   },
   {
    "kind": "gym",
    "id": "giovanni",
    "name": "Gimnasio Verde",
    "leader": "Giovanni",
    "type": "tierra",
    "badge": "Medalla Tierra",
    "map": "cueva",
    "ai": 0.66,
    "reward": 3000,
    "team": [
     [
      111,
      45
     ],
     [
      51,
      42
     ],
     [
      31,
      44
     ],
     [
      34,
      45
     ],
     [
      112,
      50
     ]
    ],
    "x": 18,
    "y": 64
   },
   {
    "kind": "route",
    "id": "k-ruta23",
    "name": "Ruta 23",
    "req": 8,
    "map": "pradera",
    "x": 6,
    "y": 46,
    "wild": [
     [
      56,
      32,
      34,
      19
     ],
     [
      22,
      40,
      44,
      16
     ],
     [
      129,
      32,
      32,
      14
     ],
     [
      21,
      32,
      34,
      10
     ],
     [
      54,
      32,
      40,
      8
     ],
     [
      79,
      32,
      40,
      8
     ],
     [
      23,
      32,
      34,
      6
     ],
     [
      27,
      32,
      34,
      6
     ],
     [
      60,
      32,
      32,
      5
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-victoria",
    "name": "Calle Victoria",
    "req": 8,
    "map": "cueva",
    "x": 6,
    "y": 32,
    "wild": [
     [
      95,
      40,
      48,
      27
     ],
     [
      66,
      32,
      34,
      20
     ],
     [
      74,
      32,
      34,
      20
     ],
     [
      41,
      32,
      34,
      10
     ],
     [
      42,
      44,
      46,
      5
     ],
     [
      105,
      44,
      48,
      5
     ],
     [
      67,
      44,
      48,
      5
     ],
     [
      57,
      42,
      42,
      3
     ],
     [
      24,
      44,
      46,
      3
     ]
    ]
   },
   {
    "kind": "elite",
    "id": "lorelei",
    "name": "Alto Mando",
    "leader": "Lorelei",
    "type": "hielo",
    "map": "lago",
    "ai": 0.7,
    "reward": 3500,
    "team": [
     [
      87,
      52
     ],
     [
      91,
      51
     ],
     [
      80,
      52
     ],
     [
      124,
      54
     ],
     [
      131,
      54
     ]
    ],
    "x": 4,
    "y": 18
   },
   {
    "kind": "elite",
    "id": "bruno",
    "name": "Alto Mando",
    "leader": "Bruno",
    "type": "lucha",
    "map": "cueva",
    "ai": 0.74,
    "reward": 3500,
    "team": [
     [
      95,
      51
     ],
     [
      107,
      53
     ],
     [
      106,
      53
     ],
     [
      95,
      54
     ],
     [
      68,
      56
     ]
    ],
    "x": 12,
    "y": 12
   },
   {
    "kind": "elite",
    "id": "agatha",
    "name": "Alto Mando",
    "leader": "Agatha",
    "type": "fantasma",
    "map": "cueva",
    "ai": 0.78,
    "reward": 3500,
    "team": [
     [
      94,
      54
     ],
     [
      42,
      54
     ],
     [
      93,
      53
     ],
     [
      24,
      56
     ],
     [
      94,
      58
     ]
    ],
    "x": 22,
    "y": 8
   },
   {
    "kind": "elite",
    "id": "lance",
    "name": "Alto Mando",
    "leader": "Lance",
    "type": "dragon",
    "map": "lago",
    "ai": 0.82,
    "reward": 4000,
    "team": [
     [
      130,
      56
     ],
     [
      148,
      54
     ],
     [
      148,
      54
     ],
     [
      142,
      58
     ],
     [
      149,
      60
     ]
    ],
    "x": 32,
    "y": 6
   },
   {
    "kind": "champion",
    "id": "azul",
    "name": "Campeón",
    "leader": "Azul",
    "type": "normal",
    "map": "pradera",
    "ai": 0.88,
    "reward": 8000,
    "team": [
     [
      18,
      59
     ],
     [
      65,
      57
     ],
     [
      112,
      59
     ],
     [
      59,
      59
     ],
     [
      103,
      59
     ],
     [
      "rival",
      63
     ]
    ],
    "x": 42,
    "y": 6
   }
  ]
 },
 "johto": {
  "id": "johto",
  "name": "Johto",
  "legends": [
   243,
   244,
   245,
   249,
   250,
   251,
   246,
   147,
   143,
   131,
   133
  ],
  "nodes": [
   {
    "kind": "route",
    "id": "j-ruta29",
    "name": "Ruta 29",
    "req": 0,
    "map": "pradera",
    "x": 82,
    "y": 72,
    "wild": [
     [
      16,
      2,
      4,
      37
     ],
     [
      163,
      2,
      4,
      29
     ],
     [
      161,
      2,
      4,
      27
     ],
     [
      19,
      2,
      4,
      7
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta30",
    "name": "Ruta 30",
    "req": 0,
    "map": "pradera",
    "x": 72,
    "y": 60,
    "wild": [
     [
      16,
      2,
      4,
      21
     ],
     [
      163,
      3,
      4,
      13
     ],
     [
      10,
      3,
      4,
      12
     ],
     [
      13,
      3,
      4,
      12
     ],
     [
      19,
      3,
      4,
      11
     ],
     [
      60,
      4,
      8,
      9
     ],
     [
      129,
      4,
      8,
      6
     ],
     [
      167,
      2,
      2,
      4
     ],
     [
      165,
      3,
      3,
      4
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta31",
    "name": "Ruta 31",
    "req": 0,
    "map": "pradera",
    "x": 66,
    "y": 46,
    "wild": [
     [
      16,
      3,
      5,
      16
     ],
     [
      19,
      4,
      5,
      13
     ],
     [
      10,
      4,
      5,
      11
     ],
     [
      60,
      5,
      9,
      10
     ],
     [
      13,
      4,
      5,
      10
     ],
     [
      163,
      4,
      5,
      8
     ],
     [
      129,
      5,
      9,
      7
     ],
     [
      69,
      3,
      3,
      6
     ],
     [
      167,
      3,
      3,
      5
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-oscura",
    "name": "Cueva Oscura",
    "req": 0,
    "map": "cueva",
    "x": 72,
    "y": 36,
    "wild": [
     [
      129,
      2,
      20,
      27
     ],
     [
      74,
      2,
      23,
      27
     ],
     [
      41,
      2,
      23,
      20
     ],
     [
      206,
      4,
      8,
      8
     ],
     [
      118,
      10,
      20,
      6
     ],
     [
      75,
      25,
      25,
      6
     ],
     [
      202,
      20,
      25,
      4
     ],
     [
      42,
      23,
      23,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-bellsprout",
    "name": "Torre Bellsprout",
    "req": 0,
    "map": "pradera",
    "x": 54,
    "y": 34,
    "wild": [
     [
      19,
      3,
      6,
      69
     ],
     [
      92,
      3,
      6,
      31
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "falkner",
    "name": "Gimnasio Malva",
    "leader": "Pegaso",
    "type": "volador",
    "badge": "Medalla Céfiro",
    "map": "pradera",
    "ai": 0.2,
    "reward": 600,
    "team": [
     [
      16,
      9
     ],
     [
      17,
      13
     ]
    ],
    "x": 58,
    "y": 42
   },
   {
    "kind": "route",
    "id": "j-ruta32",
    "name": "Ruta 32",
    "req": 1,
    "map": "pradera",
    "x": 58,
    "y": 58,
    "wild": [
     [
      69,
      6,
      6,
      27
     ],
     [
      179,
      6,
      6,
      17
     ],
     [
      194,
      6,
      6,
      12
     ],
     [
      19,
      4,
      6,
      10
     ],
     [
      72,
      6,
      10,
      8
     ],
     [
      129,
      6,
      10,
      7
     ],
     [
      187,
      6,
      6,
      7
     ],
     [
      23,
      4,
      4,
      5
     ],
     [
      41,
      4,
      4,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-alfa",
    "name": "Ruinas Alfa",
    "req": 1,
    "map": "cueva",
    "x": 48,
    "y": 50,
    "wild": [
     [
      201,
      5,
      5,
      68
     ],
     [
      177,
      18,
      24,
      15
     ],
     [
      74,
      3,
      14,
      5
     ],
     [
      129,
      10,
      20,
      4
     ],
     [
      194,
      10,
      20,
      3
     ],
     [
      60,
      10,
      20,
      2
     ],
     [
      235,
      20,
      22,
      2
     ],
     [
      195,
      10,
      25,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-union",
    "name": "Cueva Unión",
    "req": 1,
    "map": "cueva",
    "x": 56,
    "y": 70,
    "wild": [
     [
      41,
      5,
      22,
      17
     ],
     [
      74,
      6,
      21,
      15
     ],
     [
      129,
      10,
      20,
      14
     ],
     [
      19,
      4,
      20,
      11
     ],
     [
      27,
      6,
      8,
      6
     ],
     [
      194,
      10,
      20,
      6
     ],
     [
      20,
      22,
      22,
      6
     ],
     [
      195,
      10,
      25,
      6
     ],
     [
      118,
      10,
      20,
      4
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta33",
    "name": "Ruta 33",
    "req": 1,
    "map": "pradera",
    "x": 50,
    "y": 80,
    "wild": [
     [
      187,
      6,
      8,
      32
     ],
     [
      19,
      4,
      7,
      23
     ],
     [
      41,
      4,
      8,
      20
     ],
     [
      21,
      6,
      6,
      18
     ],
     [
      23,
      7,
      7,
      7
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-slowpoke",
    "name": "Pozo Slowpoke",
    "req": 1,
    "map": "lago",
    "x": 40,
    "y": 86,
    "wild": [
     [
      41,
      5,
      23,
      52
     ],
     [
      79,
      5,
      25,
      25
     ],
     [
      129,
      10,
      20,
      14
     ],
     [
      118,
      10,
      20,
      7
     ],
     [
      42,
      23,
      23,
      2
     ],
     [
      80,
      15,
      27,
      1
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "bugsy",
    "name": "Gimnasio Azalea",
    "leader": "Antón",
    "type": "bicho",
    "badge": "Medalla Colmena",
    "map": "bosque",
    "ai": 0.28,
    "reward": 900,
    "team": [
     [
      11,
      15
     ],
     [
      14,
      15
     ],
     [
      123,
      17
     ]
    ],
    "x": 44,
    "y": 78
   },
   {
    "kind": "route",
    "id": "j-encinar",
    "name": "Encinar",
    "req": 2,
    "map": "bosque",
    "x": 32,
    "y": 76,
    "wild": [
     [
      43,
      5,
      6,
      18
     ],
     [
      10,
      5,
      6,
      16
     ],
     [
      13,
      5,
      6,
      16
     ],
     [
      11,
      5,
      6,
      9
     ],
     [
      14,
      5,
      6,
      9
     ],
     [
      41,
      5,
      6,
      7
     ],
     [
      46,
      5,
      6,
      7
     ],
     [
      54,
      5,
      10,
      7
     ],
     [
      129,
      6,
      10,
      7
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta34",
    "name": "Ruta 34",
    "req": 2,
    "map": "pradera",
    "x": 32,
    "y": 64,
    "wild": [
     [
      96,
      10,
      12,
      31
     ],
     [
      19,
      11,
      13,
      22
     ],
     [
      72,
      10,
      17,
      14
     ],
     [
      129,
      10,
      17,
      14
     ],
     [
      63,
      10,
      10,
      6
     ],
     [
      98,
      10,
      17,
      6
     ],
     [
      132,
      10,
      10,
      3
     ],
     [
      73,
      13,
      17,
      2
     ],
     [
      222,
      13,
      17,
      2
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "whitney",
    "name": "Gimnasio Trigal",
    "leader": "Blanca",
    "type": "normal",
    "badge": "Medalla Planicie",
    "map": "pradera",
    "ai": 0.35,
    "reward": 1200,
    "team": [
     [
      35,
      17
     ],
     [
      241,
      19
     ]
    ],
    "x": 32,
    "y": 52
   },
   {
    "kind": "route",
    "id": "j-ruta35",
    "name": "Ruta 35",
    "req": 3,
    "map": "pradera",
    "x": 32,
    "y": 40,
    "wild": [
     [
      32,
      12,
      12,
      18
     ],
     [
      29,
      12,
      12,
      18
     ],
     [
      54,
      10,
      18,
      13
     ],
     [
      129,
      10,
      18,
      13
     ],
     [
      96,
      14,
      14,
      12
     ],
     [
      60,
      10,
      18,
      6
     ],
     [
      63,
      10,
      10,
      6
     ],
     [
      16,
      14,
      14,
      6
     ],
     [
      163,
      14,
      14,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-parque",
    "name": "Parque Nacional",
    "req": 3,
    "map": "bosque",
    "x": 42,
    "y": 34,
    "wild": [
     [
      163,
      10,
      14,
      33
     ],
     [
      10,
      10,
      12,
      13
     ],
     [
      13,
      10,
      12,
      13
     ],
     [
      16,
      10,
      14,
      12
     ],
     [
      11,
      10,
      10,
      10
     ],
     [
      14,
      10,
      10,
      10
     ],
     [
      191,
      10,
      12,
      8
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta36",
    "name": "Ruta 36",
    "req": 3,
    "map": "pradera",
    "x": 48,
    "y": 28,
    "wild": [
     [
      16,
      12,
      15,
      26
     ],
     [
      32,
      12,
      13,
      24
     ],
     [
      29,
      12,
      13,
      24
     ],
     [
      163,
      13,
      15,
      15
     ],
     [
      58,
      13,
      15,
      4
     ],
     [
      37,
      13,
      15,
      4
     ],
     [
      234,
      13,
      13,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta37",
    "name": "Ruta 37",
    "req": 3,
    "map": "pradera",
    "x": 42,
    "y": 22,
    "wild": [
     [
      16,
      13,
      15,
      41
     ],
     [
      163,
      13,
      15,
      18
     ],
     [
      234,
      15,
      15,
      14
     ],
     [
      167,
      13,
      15,
      9
     ],
     [
      165,
      13,
      15,
      9
     ],
     [
      58,
      14,
      15,
      3
     ],
     [
      37,
      14,
      15,
      3
     ],
     [
      17,
      15,
      15,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-quemada",
    "name": "Torre Quemada",
    "req": 3,
    "map": "cueva",
    "x": 34,
    "y": 14,
    "wild": [
     [
      19,
      13,
      16,
      46
     ],
     [
      109,
      14,
      16,
      37
     ],
     [
      126,
      14,
      16,
      9
     ],
     [
      41,
      14,
      15,
      7
     ],
     [
      20,
      15,
      15,
      2
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "morty",
    "name": "Gimnasio Iris",
    "leader": "Morti",
    "type": "fantasma",
    "badge": "Medalla Niebla",
    "map": "cueva",
    "ai": 0.42,
    "reward": 1500,
    "team": [
     [
      92,
      21
     ],
     [
      93,
      21
     ],
     [
      93,
      23
     ],
     [
      94,
      25
     ]
    ],
    "x": 42,
    "y": 12
   },
   {
    "kind": "route",
    "id": "j-ruta38",
    "name": "Ruta 38",
    "req": 4,
    "map": "pradera",
    "x": 28,
    "y": 14,
    "wild": [
     [
      20,
      16,
      16,
      23
     ],
     [
      52,
      16,
      16,
      23
     ],
     [
      19,
      16,
      16,
      15
     ],
     [
      81,
      16,
      16,
      15
     ],
     [
      83,
      16,
      16,
      15
     ],
     [
      241,
      13,
      13,
      4
     ],
     [
      128,
      13,
      13,
      3
     ],
     [
      209,
      13,
      13,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta39",
    "name": "Ruta 39",
    "req": 4,
    "map": "pradera",
    "x": 18,
    "y": 20,
    "wild": [
     [
      20,
      17,
      17,
      23
     ],
     [
      52,
      16,
      16,
      23
     ],
     [
      19,
      16,
      16,
      15
     ],
     [
      81,
      16,
      16,
      15
     ],
     [
      83,
      16,
      16,
      15
     ],
     [
      241,
      15,
      15,
      4
     ],
     [
      128,
      15,
      15,
      4
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta40",
    "name": "Ruta 40",
    "req": 4,
    "map": "lago",
    "x": 12,
    "y": 44,
    "wild": [
     [
      72,
      10,
      25,
      38
     ],
     [
      129,
      10,
      20,
      37
     ],
     [
      98,
      10,
      20,
      15
     ],
     [
      73,
      15,
      25,
      4
     ],
     [
      222,
      20,
      20,
      4
     ],
     [
      120,
      20,
      20,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta41",
    "name": "Ruta 41",
    "req": 4,
    "map": "lago",
    "x": 8,
    "y": 60,
    "wild": [
     [
      72,
      10,
      25,
      44
     ],
     [
      129,
      10,
      20,
      38
     ],
     [
      73,
      15,
      25,
      9
     ],
     [
      170,
      20,
      20,
      4
     ],
     [
      226,
      15,
      25,
      2
     ],
     [
      90,
      20,
      20,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-remolino",
    "name": "Islas Remolino",
    "req": 4,
    "map": "lago",
    "x": 16,
    "y": 66,
    "wild": [
     [
      98,
      22,
      25,
      42
     ],
     [
      41,
      23,
      24,
      23
     ],
     [
      86,
      22,
      25,
      12
     ],
     [
      129,
      22,
      22,
      9
     ],
     [
      116,
      22,
      25,
      5
     ],
     [
      42,
      23,
      24,
      4
     ],
     [
      72,
      22,
      25,
      3
     ],
     [
      73,
      22,
      25,
      2
     ],
     [
      117,
      22,
      29,
      1
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "chuck",
    "name": "Gimnasio Orquídea",
    "leader": "Aníbal",
    "type": "lucha",
    "badge": "Medalla Tormenta",
    "map": "pradera",
    "ai": 0.48,
    "reward": 1800,
    "team": [
     [
      57,
      29
     ],
     [
      62,
      31
     ]
    ],
    "x": 4,
    "y": 52
   },
   {
    "kind": "gym",
    "id": "jasmine",
    "name": "Gimnasio Olivo",
    "leader": "Yasmina",
    "type": "acero",
    "badge": "Medalla Mineral",
    "map": "cueva",
    "ai": 0.55,
    "reward": 2100,
    "team": [
     [
      81,
      30
     ],
     [
      81,
      30
     ],
     [
      208,
      35
     ]
    ],
    "x": 16,
    "y": 32
   },
   {
    "kind": "route",
    "id": "j-ruta42",
    "name": "Ruta 42",
    "req": 6,
    "map": "pradera",
    "x": 56,
    "y": 14,
    "wild": [
     [
      21,
      14,
      16,
      31
     ],
     [
      179,
      13,
      15,
      18
     ],
     [
      41,
      14,
      16,
      15
     ],
     [
      118,
      13,
      21,
      15
     ],
     [
      129,
      13,
      20,
      10
     ],
     [
      56,
      15,
      15,
      7
     ],
     [
      180,
      15,
      17,
      4
     ],
     [
      119,
      15,
      21,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-mortero",
    "name": "Monte Mortero",
    "req": 6,
    "map": "cueva",
    "x": 62,
    "y": 20,
    "wild": [
     [
      41,
      13,
      17,
      22
     ],
     [
      118,
      13,
      30,
      17
     ],
     [
      74,
      13,
      31,
      14
     ],
     [
      66,
      13,
      28,
      12
     ],
     [
      129,
      13,
      20,
      12
     ],
     [
      19,
      14,
      16,
      8
     ],
     [
      75,
      31,
      31,
      5
     ],
     [
      67,
      32,
      32,
      5
     ],
     [
      20,
      16,
      30,
      3
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta43",
    "name": "Ruta 43",
    "req": 6,
    "map": "pradera",
    "x": 72,
    "y": 12,
    "wild": [
     [
      129,
      15,
      21,
      20
     ],
     [
      17,
      17,
      17,
      19
     ],
     [
      180,
      15,
      17,
      17
     ],
     [
      203,
      15,
      15,
      13
     ],
     [
      179,
      15,
      16,
      11
     ],
     [
      164,
      17,
      17,
      8
     ],
     [
      48,
      15,
      17,
      8
     ],
     [
      60,
      15,
      20,
      4
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-furia",
    "name": "Lago de la Furia",
    "req": 6,
    "map": "lago",
    "x": 74,
    "y": 4,
    "wild": [
     [
      129,
      5,
      20,
      93
     ],
     [
      130,
      10,
      20,
      7
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "pryce",
    "name": "Gimnasio Caoba",
    "leader": "Fredo",
    "type": "hielo",
    "badge": "Medalla Glaciar",
    "map": "lago",
    "ai": 0.6,
    "reward": 2400,
    "team": [
     [
      86,
      30
     ],
     [
      87,
      32
     ],
     [
      221,
      34
     ]
    ],
    "x": 72,
    "y": 22
   },
   {
    "kind": "route",
    "id": "j-ruta44",
    "name": "Ruta 44",
    "req": 7,
    "map": "pradera",
    "x": 80,
    "y": 22,
    "wild": [
     [
      70,
      22,
      24,
      22
     ],
     [
      60,
      22,
      30,
      21
     ],
     [
      114,
      23,
      23,
      19
     ],
     [
      129,
      22,
      22,
      14
     ],
     [
      69,
      22,
      22,
      13
     ],
     [
      108,
      24,
      26,
      10
     ],
     [
      61,
      22,
      30,
      2
     ],
     [
      223,
      22,
      22,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-helada",
    "name": "Ruta Helada",
    "req": 7,
    "map": "cueva",
    "x": 88,
    "y": 14,
    "wild": [
     [
      220,
      21,
      24,
      36
     ],
     [
      42,
      22,
      23,
      27
     ],
     [
      41,
      22,
      23,
      18
     ],
     [
      124,
      22,
      23,
      9
     ],
     [
      225,
      22,
      23,
      9
     ]
    ]
   },
   {
    "kind": "gym",
    "id": "clair",
    "name": "Gimnasio Endrino",
    "leader": "Débora",
    "type": "dragon",
    "badge": "Medalla Dragón",
    "map": "lago",
    "ai": 0.66,
    "reward": 3000,
    "team": [
     [
      148,
      37
     ],
     [
      148,
      37
     ],
     [
      148,
      37
     ],
     [
      230,
      41
     ]
    ],
    "x": 92,
    "y": 26
   },
   {
    "kind": "route",
    "id": "j-guarida",
    "name": "Guarida Dragón",
    "req": 8,
    "map": "lago",
    "x": 96,
    "y": 14,
    "wild": [
     [
      129,
      5,
      20,
      93
     ],
     [
      147,
      5,
      20,
      7
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta45",
    "name": "Ruta 45",
    "req": 8,
    "map": "cueva",
    "x": 92,
    "y": 42,
    "wild": [
     [
      75,
      23,
      27,
      30
     ],
     [
      129,
      20,
      25,
      30
     ],
     [
      74,
      23,
      23,
      19
     ],
     [
      60,
      20,
      20,
      7
     ],
     [
      207,
      24,
      24,
      6
     ],
     [
      231,
      20,
      20,
      3
     ],
     [
      216,
      20,
      20,
      3
     ],
     [
      227,
      27,
      27,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta46",
    "name": "Ruta 46",
    "req": 0,
    "map": "pradera",
    "x": 88,
    "y": 58,
    "wild": [
     [
      21,
      2,
      3,
      41
     ],
     [
      19,
      2,
      4,
      32
     ],
     [
      74,
      2,
      3,
      26
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-cascadas",
    "name": "Cataratas Tohjo",
    "req": 8,
    "map": "lago",
    "x": 96,
    "y": 62,
    "wild": [
     [
      41,
      22,
      22,
      19
     ],
     [
      20,
      22,
      22,
      19
     ],
     [
      118,
      20,
      20,
      16
     ],
     [
      79,
      20,
      23,
      14
     ],
     [
      129,
      20,
      20,
      14
     ],
     [
      42,
      22,
      22,
      13
     ],
     [
      19,
      20,
      20,
      3
     ],
     [
      119,
      20,
      20,
      2
     ]
    ]
   },
   {
    "kind": "elite",
    "id": "will",
    "name": "Alto Mando",
    "leader": "Mento",
    "type": "psiquico",
    "map": "pradera",
    "ai": 0.7,
    "reward": 3500,
    "team": [
     [
      178,
      40
     ],
     [
      124,
      41
     ],
     [
      103,
      41
     ],
     [
      80,
      41
     ],
     [
      178,
      42
     ]
    ],
    "x": 96,
    "y": 82
   },
   {
    "kind": "elite",
    "id": "kogaj",
    "name": "Alto Mando",
    "leader": "Koga",
    "type": "veneno",
    "map": "cueva",
    "ai": 0.74,
    "reward": 3500,
    "team": [
     [
      168,
      40
     ],
     [
      49,
      41
     ],
     [
      205,
      43
     ],
     [
      89,
      42
     ],
     [
      169,
      44
     ]
    ],
    "x": 88,
    "y": 90
   },
   {
    "kind": "elite",
    "id": "brunoj",
    "name": "Alto Mando",
    "leader": "Bruno",
    "type": "lucha",
    "map": "cueva",
    "ai": 0.78,
    "reward": 3500,
    "team": [
     [
      237,
      42
     ],
     [
      106,
      42
     ],
     [
      107,
      42
     ],
     [
      95,
      43
     ],
     [
      68,
      46
     ]
    ],
    "x": 78,
    "y": 94
   },
   {
    "kind": "elite",
    "id": "karen",
    "name": "Alto Mando",
    "leader": "Karen",
    "type": "siniestro",
    "map": "cueva",
    "ai": 0.82,
    "reward": 4000,
    "team": [
     [
      197,
      42
     ],
     [
      45,
      42
     ],
     [
      94,
      45
     ],
     [
      198,
      44
     ],
     [
      229,
      47
     ]
    ],
    "x": 68,
    "y": 96
   },
   {
    "kind": "champion",
    "id": "lancej",
    "name": "Campeón",
    "leader": "Lance",
    "type": "dragon",
    "map": "lago",
    "ai": 0.88,
    "reward": 8000,
    "team": [
     [
      130,
      44
     ],
     [
      149,
      47
     ],
     [
      149,
      47
     ],
     [
      142,
      46
     ],
     [
      6,
      46
     ],
     [
      149,
      50
     ]
    ],
    "x": 58,
    "y": 96
   }
  ]
 }
};
  if (typeof module !== 'undefined' && module.exports) module.exports = REGIONS;
  else root.REGIONS = REGIONS;
})(this);
