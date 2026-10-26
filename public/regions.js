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
    "name": "Ruta 1 · Ruta 22",
    "req": 0,
    "map": "pradera",
    "x": 8,
    "y": 62,
    "parts": [
     "Ruta 1",
     "Ruta 22"
    ],
    "wild": [
     [
      19,
      2,
      5,
      39
     ],
     [
      16,
      2,
      5,
      25
     ],
     [
      56,
      2,
      5,
      14
     ],
     [
      129,
      5,
      9,
      7
     ],
     [
      54,
      5,
      9,
      4
     ],
     [
      79,
      5,
      9,
      4
     ],
     [
      21,
      3,
      5,
      3
     ],
     [
      60,
      5,
      9,
      2
     ],
     [
      118,
      5,
      9,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta2",
    "name": "Ruta 2 · Bosque Verde",
    "req": 0,
    "map": "bosque",
    "x": 18,
    "y": 48,
    "parts": [
     "Ruta 2",
     "Bosque Verde"
    ],
    "wild": [
     [
      19,
      2,
      5,
      22
     ],
     [
      16,
      2,
      5,
      22
     ],
     [
      10,
      3,
      5,
      22
     ],
     [
      13,
      3,
      5,
      22
     ],
     [
      11,
      4,
      6,
      4
     ],
     [
      14,
      4,
      6,
      4
     ],
     [
      25,
      3,
      5,
      2
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
    "name": "Ruta 3 · Monte Moon",
    "req": 1,
    "map": "cueva",
    "x": 42,
    "y": 20,
    "parts": [
     "Ruta 3",
     "Monte Moon",
     "Ruta 4"
    ],
    "wild": [
     [
      21,
      6,
      12,
      19
     ],
     [
      46,
      5,
      12,
      13
     ],
     [
      41,
      7,
      11,
      13
     ],
     [
      16,
      6,
      7,
      10
     ],
     [
      19,
      8,
      12,
      7
     ],
     [
      74,
      7,
      10,
      6
     ],
     [
      72,
      6,
      16,
      5
     ],
     [
      129,
      6,
      15,
      5
     ],
     [
      56,
      7,
      12,
      4
     ],
     [
      39,
      3,
      7,
      3
     ],
     [
      32,
      6,
      7,
      3
     ],
     [
      29,
      6,
      7,
      3
     ],
     [
      23,
      6,
      12,
      3
     ],
     [
      27,
      6,
      12,
      3
     ],
     [
      116,
      6,
      15,
      1
     ],
     [
      98,
      6,
      15,
      1
     ],
     [
      35,
      8,
      12,
      1
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
    "name": "Ruta 24 · Ruta 5",
    "req": 2,
    "map": "pradera",
    "x": 76,
    "y": 8,
    "parts": [
     "Ruta 24",
     "Ruta 25",
     "Ruta 5"
    ],
    "wild": [
     [
      16,
      11,
      16,
      20
     ],
     [
      52,
      10,
      16,
      12
     ],
     [
      43,
      12,
      16,
      10
     ],
     [
      69,
      12,
      16,
      10
     ],
     [
      129,
      7,
      15,
      9
     ],
     [
      13,
      7,
      8,
      9
     ],
     [
      10,
      7,
      8,
      9
     ],
     [
      63,
      8,
      13,
      7
     ],
     [
      72,
      7,
      18,
      5
     ],
     [
      54,
      14,
      18,
      3
     ],
     [
      79,
      14,
      18,
      3
     ],
     [
      60,
      8,
      15,
      2
     ],
     [
      14,
      8,
      9,
      1
     ],
     [
      116,
      7,
      15,
      1
     ],
     [
      98,
      7,
      15,
      1
     ],
     [
      11,
      8,
      8,
      1
     ],
     [
      118,
      8,
      15,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta6",
    "name": "Ruta 6 · Cueva Diglett",
    "req": 2,
    "map": "cueva",
    "x": 44,
    "y": 64,
    "parts": [
     "Ruta 6",
     "Cueva Diglett"
    ],
    "wild": [
     [
      50,
      15,
      22,
      48
     ],
     [
      16,
      13,
      16,
      13
     ],
     [
      52,
      10,
      16,
      11
     ],
     [
      129,
      10,
      15,
      7
     ],
     [
      54,
      16,
      20,
      4
     ],
     [
      43,
      13,
      16,
      4
     ],
     [
      79,
      16,
      20,
      4
     ],
     [
      69,
      13,
      16,
      4
     ],
     [
      60,
      10,
      15,
      3
     ],
     [
      51,
      29,
      31,
      3
     ],
     [
      118,
      10,
      15,
      1
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
    "name": "Ruta 11 · Ruta 10",
    "req": 3,
    "map": "pradera",
    "x": 76,
    "y": 22,
    "parts": [
     "Ruta 11",
     "Ruta 9",
     "Ruta 10"
    ],
    "wild": [
     [
      21,
      13,
      17,
      26
     ],
     [
      19,
      14,
      17,
      13
     ],
     [
      23,
      11,
      17,
      11
     ],
     [
      27,
      11,
      17,
      11
     ],
     [
      72,
      11,
      21,
      11
     ],
     [
      129,
      11,
      15,
      9
     ],
     [
      100,
      14,
      17,
      8
     ],
     [
      96,
      11,
      15,
      5
     ],
     [
      116,
      11,
      15,
      2
     ],
     [
      98,
      11,
      15,
      2
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-tunelroca",
    "name": "Túnel Roca · Ruta 7",
    "req": 3,
    "map": "cueva",
    "x": 76,
    "y": 46,
    "parts": [
     "Túnel Roca",
     "Ruta 8",
     "Ruta 7"
    ],
    "wild": [
     [
      52,
      17,
      20,
      23
     ],
     [
      16,
      18,
      22,
      20
     ],
     [
      74,
      5,
      30,
      14
     ],
     [
      41,
      15,
      16,
      9
     ],
     [
      58,
      15,
      20,
      5
     ],
     [
      37,
      15,
      20,
      5
     ],
     [
      56,
      16,
      17,
      4
     ],
     [
      66,
      16,
      17,
      4
     ],
     [
      23,
      17,
      19,
      3
     ],
     [
      27,
      17,
      19,
      3
     ],
     [
      43,
      19,
      22,
      3
     ],
     [
      69,
      19,
      22,
      3
     ],
     [
      95,
      13,
      17,
      2
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
    "name": "Torre Pokémon · Ruta 14",
    "req": 4,
    "map": "cueva",
    "x": 82,
    "y": 80,
    "parts": [
     "Torre Pokémon",
     "Ruta 12",
     "Ruta 13",
     "Ruta 14"
    ],
    "wild": [
     [
      92,
      13,
      19,
      21
     ],
     [
      48,
      24,
      26,
      17
     ],
     [
      16,
      23,
      27,
      10
     ],
     [
      43,
      22,
      26,
      10
     ],
     [
      69,
      22,
      26,
      10
     ],
     [
      72,
      22,
      34,
      8
     ],
     [
      129,
      22,
      22,
      7
     ],
     [
      132,
      23,
      25,
      4
     ],
     [
      104,
      15,
      19,
      2
     ],
     [
      17,
      29,
      29,
      2
     ],
     [
      44,
      28,
      30,
      2
     ],
     [
      70,
      28,
      30,
      2
     ],
     [
      93,
      20,
      25,
      1
     ],
     [
      116,
      22,
      22,
      1
     ],
     [
      98,
      22,
      22,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "k-ruta15",
    "name": "Ruta 15 · Ruta 18",
    "req": 4,
    "map": "pradera",
    "x": 26,
    "y": 62,
    "parts": [
     "Ruta 15",
     "Ruta 16",
     "Ruta 17",
     "Ruta 18"
    ],
    "wild": [
     [
      84,
      18,
      28,
      26
     ],
     [
      21,
      20,
      22,
      22
     ],
     [
      20,
      23,
      29,
      11
     ],
     [
      19,
      18,
      22,
      10
     ],
     [
      48,
      24,
      26,
      7
     ],
     [
      16,
      25,
      27,
      5
     ],
     [
      22,
      25,
      29,
      5
     ],
     [
      43,
      22,
      26,
      4
     ],
     [
      69,
      22,
      26,
      4
     ],
     [
      132,
      25,
      25,
      1
     ],
     [
      17,
      29,
      29,
      1
     ],
     [
      44,
      28,
      30,
      1
     ],
     [
      70,
      28,
      30,
      1
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
    "parts": [
     "Zona Safari"
    ],
    "wild": [
     [
      129,
      22,
      22,
      16
     ],
     [
      102,
      23,
      27,
      15
     ],
     [
      54,
      22,
      37,
      9
     ],
     [
      79,
      22,
      37,
      9
     ],
     [
      32,
      22,
      30,
      8
     ],
     [
      29,
      22,
      30,
      8
     ],
     [
      111,
      25,
      26,
      7
     ],
     [
      84,
      26,
      26,
      7
     ],
     [
      118,
      22,
      22,
      6
     ],
     [
      48,
      22,
      23,
      6
     ],
     [
      46,
      22,
      23,
      6
     ],
     [
      33,
      30,
      33,
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
    "name": "Ruta 19 · Ruta 20",
    "req": 6,
    "map": "lago",
    "x": 36,
    "y": 96,
    "parts": [
     "Ruta 19",
     "Ruta 20"
    ],
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
    "name": "Islas Espuma · Ruta 21",
    "req": 6,
    "map": "lago",
    "x": 14,
    "y": 86,
    "parts": [
     "Islas Espuma",
     "Ruta 21"
    ],
    "wild": [
     [
      114,
      17,
      28,
      32
     ],
     [
      86,
      25,
      35,
      12
     ],
     [
      129,
      17,
      22,
      11
     ],
     [
      41,
      22,
      26,
      8
     ],
     [
      72,
      17,
      32,
      8
     ],
     [
      54,
      26,
      40,
      7
     ],
     [
      79,
      26,
      40,
      7
     ],
     [
      42,
      26,
      30,
      5
     ],
     [
      116,
      17,
      30,
      3
     ],
     [
      98,
      17,
      30,
      3
     ],
     [
      55,
      32,
      40,
      2
     ],
     [
      80,
      32,
      40,
      2
     ],
     [
      87,
      32,
      40,
      2
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
    "name": "Ruta 23 · Calle Victoria",
    "req": 8,
    "map": "cueva",
    "x": 6,
    "y": 32,
    "parts": [
     "Ruta 23",
     "Calle Victoria"
    ],
    "wild": [
     [
      95,
      40,
      48,
      14
     ],
     [
      66,
      32,
      34,
      10
     ],
     [
      74,
      32,
      34,
      10
     ],
     [
      56,
      32,
      34,
      10
     ],
     [
      22,
      40,
      44,
      8
     ],
     [
      129,
      32,
      32,
      7
     ],
     [
      21,
      32,
      34,
      5
     ],
     [
      41,
      32,
      34,
      5
     ],
     [
      54,
      32,
      40,
      4
     ],
     [
      79,
      32,
      40,
      4
     ],
     [
      23,
      32,
      34,
      3
     ],
     [
      27,
      32,
      34,
      3
     ],
     [
      57,
      42,
      42,
      3
     ],
     [
      60,
      32,
      32,
      3
     ],
     [
      24,
      44,
      46,
      3
     ],
     [
      42,
      44,
      46,
      3
     ],
     [
      105,
      44,
      48,
      3
     ],
     [
      67,
      44,
      48,
      3
     ],
     [
      28,
      44,
      46,
      2
     ],
     [
      118,
      32,
      32,
      1
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
    "name": "Ruta 29 · Ruta 31",
    "req": 0,
    "map": "pradera",
    "x": 72,
    "y": 60,
    "parts": [
     "Ruta 29",
     "Ruta 30",
     "Ruta 31"
    ],
    "wild": [
     [
      16,
      2,
      5,
      25
     ],
     [
      163,
      2,
      5,
      17
     ],
     [
      19,
      2,
      5,
      10
     ],
     [
      161,
      2,
      4,
      9
     ],
     [
      10,
      3,
      5,
      8
     ],
     [
      13,
      3,
      5,
      7
     ],
     [
      60,
      4,
      9,
      6
     ],
     [
      129,
      4,
      9,
      4
     ],
     [
      167,
      2,
      3,
      3
     ],
     [
      165,
      3,
      4,
      3
     ],
     [
      11,
      4,
      5,
      3
     ],
     [
      14,
      4,
      5,
      2
     ],
     [
      69,
      3,
      3,
      2
     ],
     [
      61,
      4,
      8,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-oscura",
    "name": "Cueva Oscura · Torre Bellsprout",
    "req": 0,
    "map": "cueva",
    "x": 54,
    "y": 34,
    "parts": [
     "Cueva Oscura",
     "Torre Bellsprout"
    ],
    "wild": [
     [
      19,
      3,
      6,
      35
     ],
     [
      92,
      3,
      6,
      16
     ],
     [
      129,
      2,
      20,
      14
     ],
     [
      74,
      2,
      23,
      14
     ],
     [
      41,
      2,
      23,
      10
     ],
     [
      206,
      4,
      8,
      4
     ],
     [
      118,
      10,
      20,
      3
     ],
     [
      75,
      25,
      25,
      3
     ],
     [
      202,
      20,
      25,
      2
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
    "name": "Ruta 32 · Ruinas Alfa",
    "req": 1,
    "map": "cueva",
    "x": 48,
    "y": 50,
    "parts": [
     "Ruta 32",
     "Ruinas Alfa",
     "Cueva Unión"
    ],
    "wild": [
     [
      201,
      5,
      5,
      23
     ],
     [
      69,
      6,
      6,
      9
     ],
     [
      129,
      6,
      20,
      8
     ],
     [
      194,
      6,
      20,
      7
     ],
     [
      19,
      4,
      20,
      7
     ],
     [
      41,
      4,
      22,
      7
     ],
     [
      74,
      3,
      21,
      7
     ],
     [
      179,
      6,
      6,
      6
     ],
     [
      177,
      18,
      24,
      5
     ],
     [
      72,
      6,
      20,
      4
     ],
     [
      195,
      6,
      25,
      4
     ],
     [
      187,
      6,
      6,
      2
     ],
     [
      27,
      6,
      8,
      2
     ],
     [
      20,
      22,
      22,
      2
     ],
     [
      23,
      4,
      4,
      2
     ],
     [
      118,
      10,
      20,
      1
     ],
     [
      95,
      6,
      23,
      1
     ],
     [
      42,
      22,
      22,
      1
     ],
     [
      60,
      10,
      20,
      1
     ],
     [
      235,
      20,
      22,
      1
     ],
     [
      73,
      6,
      10,
      1
     ],
     [
      211,
      6,
      10,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta33",
    "name": "Ruta 33 · Pozo Slowpoke",
    "req": 1,
    "map": "lago",
    "x": 40,
    "y": 86,
    "parts": [
     "Ruta 33",
     "Pozo Slowpoke"
    ],
    "wild": [
     [
      41,
      4,
      23,
      36
     ],
     [
      187,
      6,
      8,
      16
     ],
     [
      79,
      5,
      25,
      12
     ],
     [
      19,
      4,
      7,
      11
     ],
     [
      21,
      6,
      6,
      9
     ],
     [
      129,
      10,
      20,
      7
     ],
     [
      23,
      7,
      7,
      3
     ],
     [
      118,
      10,
      20,
      3
     ],
     [
      42,
      23,
      23,
      1
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
    "name": "Encinar · Ruta 34",
    "req": 2,
    "map": "bosque",
    "x": 32,
    "y": 64,
    "parts": [
     "Encinar",
     "Ruta 34"
    ],
    "wild": [
     [
      96,
      10,
      12,
      15
     ],
     [
      19,
      11,
      13,
      11
     ],
     [
      129,
      6,
      17,
      10
     ],
     [
      43,
      5,
      6,
      9
     ],
     [
      10,
      5,
      6,
      8
     ],
     [
      13,
      5,
      6,
      8
     ],
     [
      72,
      10,
      17,
      7
     ],
     [
      11,
      5,
      6,
      4
     ],
     [
      14,
      5,
      6,
      4
     ],
     [
      41,
      5,
      6,
      3
     ],
     [
      46,
      5,
      6,
      3
     ],
     [
      54,
      5,
      10,
      3
     ],
     [
      63,
      10,
      10,
      3
     ],
     [
      98,
      10,
      17,
      3
     ],
     [
      60,
      6,
      10,
      1
     ],
     [
      132,
      10,
      10,
      1
     ],
     [
      73,
      13,
      17,
      1
     ],
     [
      222,
      13,
      17,
      1
     ],
     [
      55,
      6,
      10,
      1
     ],
     [
      120,
      13,
      17,
      1
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
    "name": "Ruta 35 · Parque Nacional",
    "req": 3,
    "map": "bosque",
    "x": 42,
    "y": 34,
    "parts": [
     "Ruta 35",
     "Parque Nacional",
     "Ruta 36"
    ],
    "wild": [
     [
      163,
      10,
      15,
      17
     ],
     [
      16,
      10,
      15,
      15
     ],
     [
      32,
      12,
      13,
      14
     ],
     [
      29,
      12,
      13,
      14
     ],
     [
      54,
      10,
      18,
      4
     ],
     [
      129,
      10,
      18,
      4
     ],
     [
      10,
      10,
      12,
      4
     ],
     [
      13,
      10,
      12,
      4
     ],
     [
      96,
      14,
      14,
      4
     ],
     [
      11,
      10,
      10,
      3
     ],
     [
      14,
      10,
      10,
      3
     ],
     [
      191,
      10,
      12,
      3
     ],
     [
      60,
      10,
      18,
      2
     ],
     [
      63,
      10,
      10,
      2
     ],
     [
      58,
      13,
      15,
      1
     ],
     [
      37,
      13,
      15,
      1
     ],
     [
      234,
      13,
      13,
      1
     ],
     [
      132,
      10,
      10,
      1
     ],
     [
      55,
      14,
      18,
      1
     ],
     [
      193,
      12,
      12,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta37",
    "name": "Ruta 37 · Torre Quemada",
    "req": 3,
    "map": "cueva",
    "x": 34,
    "y": 14,
    "parts": [
     "Ruta 37",
     "Torre Quemada"
    ],
    "wild": [
     [
      19,
      13,
      16,
      23
     ],
     [
      16,
      13,
      15,
      21
     ],
     [
      109,
      14,
      16,
      19
     ],
     [
      163,
      13,
      15,
      9
     ],
     [
      234,
      15,
      15,
      7
     ],
     [
      167,
      13,
      15,
      5
     ],
     [
      165,
      13,
      15,
      5
     ],
     [
      126,
      14,
      16,
      5
     ],
     [
      41,
      14,
      15,
      4
     ],
     [
      58,
      14,
      15,
      2
     ],
     [
      37,
      14,
      15,
      2
     ],
     [
      17,
      15,
      15,
      1
     ],
     [
      20,
      15,
      15,
      1
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
    "name": "Ruta 38 · Ruta 40",
    "req": 4,
    "map": "lago",
    "x": 18,
    "y": 20,
    "parts": [
     "Ruta 38",
     "Ruta 39",
     "Ruta 40"
    ],
    "wild": [
     [
      20,
      16,
      17,
      15
     ],
     [
      52,
      16,
      16,
      15
     ],
     [
      72,
      10,
      25,
      13
     ],
     [
      129,
      10,
      20,
      12
     ],
     [
      19,
      16,
      16,
      10
     ],
     [
      81,
      16,
      16,
      10
     ],
     [
      83,
      16,
      16,
      10
     ],
     [
      98,
      10,
      20,
      5
     ],
     [
      241,
      13,
      15,
      3
     ],
     [
      128,
      13,
      15,
      2
     ],
     [
      73,
      15,
      25,
      1
     ],
     [
      222,
      20,
      20,
      1
     ],
     [
      120,
      20,
      20,
      1
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
    "id": "j-ruta41",
    "name": "Ruta 41 · Islas Remolino",
    "req": 4,
    "map": "lago",
    "x": 16,
    "y": 66,
    "parts": [
     "Ruta 41",
     "Islas Remolino"
    ],
    "wild": [
     [
      72,
      10,
      25,
      24
     ],
     [
      129,
      10,
      22,
      24
     ],
     [
      98,
      22,
      25,
      21
     ],
     [
      41,
      23,
      24,
      12
     ],
     [
      86,
      22,
      25,
      6
     ],
     [
      73,
      15,
      25,
      6
     ],
     [
      116,
      22,
      25,
      3
     ],
     [
      170,
      20,
      20,
      2
     ],
     [
      42,
      23,
      24,
      2
     ],
     [
      226,
      15,
      25,
      1
     ],
     [
      90,
      20,
      20,
      1
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
    "name": "Ruta 42 · Monte Mortero",
    "req": 6,
    "map": "cueva",
    "x": 62,
    "y": 20,
    "parts": [
     "Ruta 42",
     "Monte Mortero"
    ],
    "wild": [
     [
      41,
      13,
      17,
      18
     ],
     [
      118,
      13,
      30,
      16
     ],
     [
      21,
      14,
      16,
      15
     ],
     [
      129,
      13,
      20,
      11
     ],
     [
      179,
      13,
      15,
      9
     ],
     [
      74,
      13,
      31,
      7
     ],
     [
      66,
      13,
      28,
      6
     ],
     [
      19,
      14,
      16,
      4
     ],
     [
      56,
      15,
      15,
      3
     ],
     [
      75,
      31,
      31,
      2
     ],
     [
      67,
      32,
      32,
      2
     ],
     [
      180,
      15,
      17,
      2
     ],
     [
      20,
      16,
      30,
      1
     ],
     [
      119,
      15,
      30,
      1
     ],
     [
      42,
      30,
      30,
      1
     ],
     [
      183,
      15,
      15,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta43",
    "name": "Ruta 43 · Lago de la Furia",
    "req": 6,
    "map": "lago",
    "x": 74,
    "y": 4,
    "parts": [
     "Ruta 43",
     "Lago de la Furia"
    ],
    "wild": [
     [
      129,
      5,
      21,
      56
     ],
     [
      17,
      17,
      17,
      10
     ],
     [
      180,
      15,
      17,
      9
     ],
     [
      203,
      15,
      15,
      7
     ],
     [
      179,
      15,
      16,
      6
     ],
     [
      164,
      17,
      17,
      4
     ],
     [
      48,
      15,
      17,
      4
     ],
     [
      130,
      10,
      20,
      4
     ],
     [
      60,
      15,
      20,
      2
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
    "name": "Ruta 44 · Ruta Helada",
    "req": 7,
    "map": "cueva",
    "x": 88,
    "y": 14,
    "parts": [
     "Ruta 44",
     "Ruta Helada"
    ],
    "wild": [
     [
      220,
      21,
      24,
      18
     ],
     [
      42,
      22,
      23,
      13
     ],
     [
      70,
      22,
      24,
      11
     ],
     [
      60,
      22,
      30,
      10
     ],
     [
      114,
      23,
      23,
      9
     ],
     [
      41,
      22,
      23,
      9
     ],
     [
      129,
      22,
      22,
      7
     ],
     [
      69,
      22,
      22,
      6
     ],
     [
      108,
      24,
      26,
      5
     ],
     [
      124,
      22,
      23,
      4
     ],
     [
      225,
      22,
      23,
      4
     ],
     [
      61,
      22,
      30,
      1
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
    "name": "Guarida Dragón · Ruta 45",
    "req": 8,
    "map": "cueva",
    "x": 92,
    "y": 42,
    "parts": [
     "Guarida Dragón",
     "Ruta 45"
    ],
    "wild": [
     [
      129,
      5,
      25,
      62
     ],
     [
      75,
      23,
      27,
      15
     ],
     [
      74,
      23,
      23,
      10
     ],
     [
      147,
      5,
      20,
      4
     ],
     [
      60,
      20,
      20,
      4
     ],
     [
      207,
      24,
      24,
      3
     ],
     [
      231,
      20,
      20,
      2
     ],
     [
      216,
      20,
      20,
      2
     ],
     [
      227,
      27,
      27,
      1
     ]
    ]
   },
   {
    "kind": "route",
    "id": "j-ruta46",
    "name": "Ruta 46 · Cataratas Tohjo",
    "req": 0,
    "map": "lago",
    "x": 96,
    "y": 62,
    "parts": [
     "Ruta 46",
     "Cataratas Tohjo"
    ],
    "wild": [
     [
      21,
      2,
      3,
      21
     ],
     [
      19,
      2,
      20,
      18
     ],
     [
      74,
      2,
      3,
      13
     ],
     [
      41,
      22,
      22,
      10
     ],
     [
      20,
      22,
      22,
      10
     ],
     [
      118,
      20,
      20,
      8
     ],
     [
      79,
      20,
      23,
      7
     ],
     [
      129,
      20,
      20,
      7
     ],
     [
      42,
      22,
      22,
      7
     ],
     [
      119,
      20,
      20,
      1
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
