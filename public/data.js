// Datos del juego compartidos por servidor y cliente: tipos, movimientos, Pokémon, mapas,
// rutas, gimnasios y tienda. Sin lógica: las reglas viven en shared.js y server/battle.js.
(function (root) {
  // ---------- Tipos ----------
  const TYPE_NAMES = ['normal', 'fuego', 'agua', 'planta', 'electrico', 'hielo', 'lucha', 'veneno',
    'tierra', 'volador', 'psiquico', 'bicho', 'roca', 'fantasma', 'dragon', 'acero', 'siniestro', 'hada'];
  const TYPE_LABEL = { normal: 'Normal', fuego: 'Fuego', agua: 'Agua', planta: 'Planta', electrico: 'Eléctrico',
    hielo: 'Hielo', lucha: 'Lucha', veneno: 'Veneno', tierra: 'Tierra', volador: 'Volador', psiquico: 'Psíquico',
    bicho: 'Bicho', roca: 'Roca', fantasma: 'Fantasma', dragon: 'Dragón', acero: 'Acero', siniestro: 'Siniestro', hada: 'Hada' };
  const TYPE_COLOR = { normal: '#c8c0a0', fuego: '#ff7a30', agua: '#4a90ff', planta: '#5cd04a', electrico: '#ffd23a',
    hielo: '#90e8ff', lucha: '#e05030', veneno: '#b050d0', tierra: '#d8b060', volador: '#a8a8ff', psiquico: '#ff5890',
    bicho: '#a8c830', roca: '#b8a058', fantasma: '#7058c0', dragon: '#7038f8', acero: '#b8b8d0', siniestro: '#705848', hada: '#ff9ee0' };
  // Atacante -> defensor. Lo que no aparece vale 1. Las inmunidades se suavizan a 0.25
  // para que en tiempo real nunca haya un golpe que no haga nada.
  const S = 1.5, W = 0.67, I = 0.25;
  const CHART = {
    normal: { roca: W, fantasma: I, acero: W },
    fuego: { fuego: W, agua: W, planta: S, hielo: S, bicho: S, roca: W, dragon: W, acero: S },
    agua: { fuego: S, agua: W, planta: W, tierra: S, roca: S, dragon: W },
    planta: { fuego: W, agua: S, planta: W, veneno: W, tierra: S, volador: W, bicho: W, roca: S, dragon: W, acero: W },
    electrico: { agua: S, planta: W, electrico: W, tierra: I, volador: S, dragon: W },
    hielo: { fuego: W, agua: W, planta: S, hielo: W, tierra: S, volador: S, dragon: S, acero: W },
    lucha: { normal: S, hielo: S, veneno: W, volador: W, psiquico: W, bicho: W, roca: S, fantasma: I, acero: S, siniestro: S, hada: W },
    veneno: { planta: S, veneno: W, tierra: W, roca: W, fantasma: W, acero: I, hada: S },
    tierra: { fuego: S, planta: W, electrico: S, veneno: S, volador: I, bicho: W, roca: S, acero: S },
    volador: { planta: S, electrico: W, lucha: S, bicho: S, roca: W, acero: W },
    psiquico: { lucha: S, veneno: S, psiquico: W, acero: W, siniestro: I },
    bicho: { fuego: W, planta: S, lucha: W, veneno: W, volador: W, psiquico: S, fantasma: W, acero: W, siniestro: S, hada: W },
    roca: { fuego: S, hielo: S, lucha: W, tierra: W, volador: S, bicho: S, acero: W },
    fantasma: { normal: I, psiquico: S, fantasma: S, siniestro: W },
    dragon: { dragon: S, acero: W, hada: I },
    acero: { fuego: W, agua: W, electrico: W, hielo: S, roca: S, acero: W, hada: S },
    siniestro: { lucha: W, psiquico: S, fantasma: S, siniestro: W, hada: W },
    hada: { fuego: W, lucha: S, veneno: W, dragon: S, siniestro: S, acero: W },
  };
  function typeMult(atk, defTypes) {
    let m = 1;
    for (const d of defTypes) m *= (CHART[atk] && CHART[atk][d]) || 1;
    return m;
  }

  // ---------- Movimientos ----------
  // kind: proj (proyectil; con explode, estalla donde apuntas) · beam (rayo instantáneo en línea)
  //       melee (golpe en arco delante) · cone (chorro o ráfaga en abanico: range, arc)
  //       wave (ola que avanza con un frente ancho: width) · area (con count: varios impactos, scatter o line)
  //       dash (embestida) · area (zona con retardo, en el cursor o en uno mismo)
  //       blink (teletransporte) · heal · buff · smoke (nube de vapor que oculta)
  // heal: cura ese % de los PS; selfStun: te deja aturdido esos segundos (sin moverte, atacar ni proteger);
  //       cure: quita quemadura, veneno y drenadoras (solo Descanso, como en los juegos)
  //       wall (muro que bloquea) · ball (Poké Ball, la añade el servidor)
  // cost energía · cd recarga (s) · wind preparación (s, se ve venir) · rec recuperación (s, vulnerable)
  // Estados: burn quema, poison veneno, wet mojado, slow ralentiza, stun aturde (s).
  // terrain: deja fuego/agua en el suelo (el hielo congela el agua). knock: empuje. pull: atrae. drain: cura % del daño.
  const MOVES = {
    // Básicos (coste 0)
    ascuas: { name: 'Ascuas', type: 'fuego', kind: 'proj', cost: 0, cd: 0.45, wind: 0.08, rec: 0.1, dmg: 7, speed: 640, range: 520, radius: 7 },
    pistolaAgua: { name: 'Pistola Agua', type: 'agua', kind: 'proj', cost: 0, cd: 0.5, wind: 0.08, rec: 0.1, dmg: 6, speed: 580, range: 480, radius: 8, wet: 2 },
    hojaAfilada: { name: 'Hoja Afilada', type: 'planta', kind: 'proj', cost: 0, cd: 0.6, wind: 0.08, rec: 0.12, dmg: 4, speed: 620, range: 420, radius: 6, count: 3, spread: 0.2 },
    impactrueno: { name: 'Impactrueno', type: 'electrico', kind: 'proj', cost: 0, cd: 0.45, wind: 0.08, rec: 0.1, dmg: 7, speed: 780, range: 470, radius: 6 },
    placaje: { name: 'Placaje', type: 'normal', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 10, range: 70, arc: 1.9, knock: 60 },
    tornado: { name: 'Tornado', type: 'volador', kind: 'proj', cost: 0, cd: 0.5, wind: 0.08, rec: 0.1, dmg: 6, speed: 520, range: 460, radius: 11 },
    lanzarrocas: { name: 'Lanzarrocas', type: 'roca', kind: 'proj', cost: 0, cd: 0.6, wind: 0.12, rec: 0.12, dmg: 10, speed: 520, range: 420, radius: 9 },
    confusion: { name: 'Confusión', type: 'psiquico', kind: 'proj', cost: 0, cd: 0.5, wind: 0.08, rec: 0.1, dmg: 7, speed: 600, range: 520, radius: 7 },
    lenguetazo: { name: 'Lengüetazo', type: 'fantasma', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 9, range: 70, arc: 1.4, slow: 0.6 },
    golpeKarate: { name: 'Golpe Kárate', type: 'lucha', kind: 'melee', cost: 0, cd: 0.45, wind: 0.08, rec: 0.12, dmg: 11, range: 62, arc: 1.5, knock: 50 },
    bofetonLodo: { name: 'Bofetón Lodo', type: 'tierra', kind: 'cone', cost: 0, cd: 0.55, wind: 0.08, rec: 0.12, dmg: 7, range: 150, arc: 0.75, slow: 0.6 },
    furiaDragon: { name: 'Furia Dragón', type: 'dragon', kind: 'proj', cost: 0, cd: 0.5, wind: 0.1, rec: 0.1, dmg: 8, speed: 600, range: 500, radius: 9 },
    nievePolvo: { name: 'Nieve Polvo', type: 'hielo', kind: 'cone', cost: 0, cd: 0.6, wind: 0.08, rec: 0.12, dmg: 6, range: 160, arc: 0.9, slow: 0.8 },
    acido: { name: 'Ácido', type: 'veneno', kind: 'proj', cost: 0, cd: 0.55, wind: 0.08, rec: 0.1, dmg: 5, speed: 560, range: 460, radius: 8, poison: 2 },
    tijeraX: { name: 'Tijera X', type: 'bicho', kind: 'melee', cost: 0, cd: 0.45, wind: 0.08, rec: 0.1, dmg: 11, range: 66, arc: 1.8 },
    mordisco: { name: 'Mordisco', type: 'siniestro', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 12, range: 70, arc: 1.4 },
    salpicadura: { name: 'Salpicadura', type: 'normal', kind: 'buff', cost: 0, cd: 1, wind: 0.2, rec: 0.3, dur: 0.1, splash: true },

    // Habilidades
    lanzallamas: { name: 'Lanzallamas', type: 'fuego', kind: 'cone', cost: 30, cd: 4, wind: 0.3, rec: 0.25, dmg: 18, range: 230, arc: 0.6, burn: 3, terrain: 'fuego' },
    llamarada: { name: 'Llamarada', type: 'fuego', kind: 'proj', cost: 50, cd: 10, wind: 0.35, rec: 0.3, dmg: 28, speed: 430, range: 480, radius: 18, maxRange: 480, explode: 95, burn: 3, terrain: 'fuego' },
    nitrocarga: { name: 'Nitrocarga', type: 'fuego', kind: 'dash', cost: 20, cd: 5, wind: 0.12, rec: 0.15, dmg: 14, dist: 260, dur: 0.22, haste: 2 },
    punoFuego: { name: 'Puño Fuego', type: 'fuego', kind: 'melee', cost: 20, cd: 4, wind: 0.25, rec: 0.2, dmg: 18, range: 70, arc: 1.4, burn: 3 },
    hidrobomba: { name: 'Hidrobomba', type: 'agua', kind: 'beam', cost: 40, cd: 6, wind: 0.55, rec: 0.3, dmg: 22, len: 540, width: 26, knock: 130, terrain: 'agua' },
    surf: { name: 'Surf', type: 'agua', kind: 'wave', cost: 45, cd: 9, wind: 0.45, rec: 0.3, dmg: 20, speed: 340, range: 560, width: 260, thick: 22, knock: 150, terrain: 'agua', wet: 4 },
    acuaJet: { name: 'Acua Jet', type: 'agua', kind: 'dash', cost: 15, cd: 4, wind: 0.06, rec: 0.12, dmg: 10, dist: 220, dur: 0.15 },
    acuaAro: { name: 'Acua Aro', type: 'agua', kind: 'heal', cost: 35, cd: 20, wind: 0.3, rec: 0.2, heal: 0.16, selfStun: 1.2 },
    latigoCepa: { name: 'Látigo Cepa', type: 'planta', kind: 'proj', cost: 20, cd: 3.5, wind: 0.2, rec: 0.2, dmg: 14, speed: 850, range: 230, radius: 14, pull: 110, fx: 'vine' },
    drenadoras: { name: 'Drenadoras', type: 'planta', kind: 'proj', cost: 25, cd: 7, wind: 0.2, rec: 0.15, dmg: 5, speed: 460, range: 560, radius: 11, slow: 2, drain: 1.5, fx: 'seed' },
    rayoSolar: { name: 'Rayo Solar', type: 'planta', kind: 'beam', cost: 55, cd: 11, wind: 0.9, rec: 0.35, dmg: 32, len: 580, width: 32 },
    sintesis: { name: 'Síntesis', type: 'planta', kind: 'heal', cost: 35, cd: 20, wind: 0.35, rec: 0.2, heal: 0.16, selfStun: 1.2 },
    rayo: { name: 'Rayo', type: 'electrico', kind: 'beam', cost: 35, cd: 5, wind: 0.45, rec: 0.25, dmg: 18, len: 480, width: 18, stun: 0.4 },
    trueno: { name: 'Trueno', type: 'electrico', kind: 'area', at: 'cursor', cost: 50, cd: 9, wind: 0.25, rec: 0.3, dmg: 24, radius: 85, delay: 0.7, maxRange: 460, stun: 0.6 },
    ondaTrueno: { name: 'Onda Trueno', type: 'electrico', kind: 'proj', cost: 30, cd: 10, wind: 0.2, rec: 0.2, dmg: 2, speed: 520, range: 500, radius: 10, stun: 1.1 },
    rayoHielo: { name: 'Rayo Hielo', type: 'hielo', kind: 'beam', cost: 35, cd: 6, wind: 0.45, rec: 0.25, dmg: 17, len: 470, width: 20, slow: 2, terrain: 'hielo' },
    ventisca: { name: 'Ventisca', type: 'hielo', kind: 'cone', cost: 55, cd: 10, wind: 0.4, rec: 0.3, dmg: 22, range: 290, arc: 1.25, slow: 2.5, terrain: 'hielo' },
    psiquico: { name: 'Psíquico', type: 'psiquico', kind: 'area', at: 'cursor', cost: 35, cd: 6, wind: 0.2, rec: 0.25, dmg: 20, radius: 70, delay: 0.5, maxRange: 520, stun: 0.3 },
    psicorrayo: { name: 'Psicorrayo', type: 'psiquico', kind: 'beam', cost: 30, cd: 5, wind: 0.35, rec: 0.2, dmg: 16, len: 460, width: 18, slow: 1 },
    teletransporte: { name: 'Teletransporte', type: 'psiquico', kind: 'blink', cost: 20, cd: 6, wind: 0.05, rec: 0.1, dist: 230 },
    hipnosis: { name: 'Hipnosis', type: 'psiquico', kind: 'proj', cost: 35, cd: 12, wind: 0.3, rec: 0.2, dmg: 0, speed: 420, range: 480, radius: 11, stun: 1.4, fx: 'hypno' },
    barrera: { name: 'Barrera', type: 'psiquico', kind: 'wall', cost: 25, cd: 9, wind: 0.2, rec: 0.15, wallHp: 40, wallDur: 4, wallLen: 120, maxRange: 140 },
    agilidad: { name: 'Agilidad', type: 'psiquico', kind: 'buff', cost: 20, cd: 10, wind: 0.1, rec: 0.1, haste: 3 },
    bolaSombra: { name: 'Bola Sombra', type: 'fantasma', kind: 'proj', cost: 30, cd: 4, wind: 0.3, rec: 0.2, dmg: 19, speed: 480, range: 560, radius: 13 },
    terremoto: { name: 'Terremoto', type: 'tierra', kind: 'area', at: 'self', cost: 55, cd: 10, wind: 0.3, rec: 0.35, dmg: 25, radius: 170, delay: 0.6, stun: 0.3 },
    excavar: { name: 'Excavar', type: 'tierra', kind: 'dash', cost: 30, cd: 7, wind: 0.15, rec: 0.15, dmg: 16, dist: 250, dur: 0.5, invuln: true },
    tumbaRocas: { name: 'Tumba Rocas', type: 'roca', kind: 'area', at: 'cursor', cost: 30, cd: 7, wind: 0.2, rec: 0.25, dmg: 14, radius: 60, delay: 0.45, maxRange: 420, slow: 2, rockWall: true },
    avalancha: { name: 'Avalancha', type: 'roca', kind: 'area', at: 'cursor', cost: 45, cd: 9, wind: 0.3, rec: 0.3, dmg: 12, radius: 60, delay: 0.5, maxRange: 420, count: 3, pattern: 'line', stagger: 0.12, stun: 0.4 },
    golpeAereo: { name: 'Golpe Aéreo', type: 'volador', kind: 'dash', cost: 20, cd: 5, wind: 0.1, rec: 0.15, dmg: 14, dist: 270, dur: 0.2 },
    vendaval: { name: 'Vendaval', type: 'volador', kind: 'area', at: 'cursor', cost: 50, cd: 9, wind: 0.3, rec: 0.3, dmg: 22, radius: 100, delay: 0.6, maxRange: 460, knock: 170 },
    ataqueRapido: { name: 'Ataque Rápido', type: 'normal', kind: 'dash', cost: 15, cd: 4, wind: 0.04, rec: 0.1, dmg: 8, dist: 210, dur: 0.14 },
    golpeCuerpo: { name: 'Golpe Cuerpo', type: 'normal', kind: 'dash', cost: 25, cd: 6, wind: 0.2, rec: 0.2, dmg: 18, dist: 190, dur: 0.25, stun: 0.35 },
    hiperrayo: { name: 'Hiperrayo', type: 'normal', kind: 'beam', cost: 65, cd: 14, wind: 0.8, rec: 1.1, dmg: 38, len: 600, width: 32 },
    descanso: { name: 'Descanso', type: 'psiquico', kind: 'heal', cost: 30, cd: 28, wind: 0.2, rec: 0.2, heal: 0.35, selfStun: 2.5, cure: true },
    autodestruccion: { name: 'Autodestrucción', type: 'normal', kind: 'area', at: 'self', cost: 60, cd: 30, wind: 0.6, rec: 0.1, dmg: 48, radius: 150, delay: 0.25, selfKO: true },
    patadaBaja: { name: 'Patada Baja', type: 'lucha', kind: 'melee', cost: 25, cd: 5, wind: 0.25, rec: 0.2, dmg: 17, range: 72, arc: 1.6, stun: 0.45 },
    punoDinamico: { name: 'Puño Dinámico', type: 'lucha', kind: 'melee', cost: 45, cd: 9, wind: 0.5, rec: 0.3, dmg: 28, range: 78, arc: 1.3, stun: 0.9, knock: 120 },
    bombaLodo: { name: 'Bomba Lodo', type: 'veneno', kind: 'proj', cost: 30, cd: 5, wind: 0.3, rec: 0.2, dmg: 16, speed: 460, range: 480, radius: 13, maxRange: 480, explode: 60, poison: 4, puddle: 'veneno' },
    toxico: { name: 'Tóxico', type: 'veneno', kind: 'proj', cost: 25, cd: 8, wind: 0.25, rec: 0.15, dmg: 2, speed: 500, range: 480, radius: 10, poison: 7 },
    pantallaHumo: { name: 'Pantalla de Humo', type: 'normal', kind: 'smoke', cost: 20, cd: 10, wind: 0.1, rec: 0.1, radius: 2 },
    danzaDragon: { name: 'Danza Dragón', type: 'dragon', kind: 'buff', cost: 30, cd: 12, wind: 0.3, rec: 0.1, haste: 4, power: 4 },
    danzaEspada: { name: 'Danza Espada', type: 'normal', kind: 'buff', cost: 25, cd: 12, wind: 0.3, rec: 0.1, power: 5 },
    ciclon: { name: 'Ciclón', type: 'dragon', kind: 'proj', cost: 30, cd: 5, wind: 0.3, rec: 0.2, dmg: 9, speed: 520, range: 480, radius: 12, count: 3, spread: 0.3 },
    fuegoFatuo: { name: 'Fuego Fatuo', type: 'fuego', kind: 'proj', cost: 25, cd: 8, wind: 0.2, rec: 0.15, dmg: 2, speed: 380, range: 520, radius: 10, burn: 6 },
    rayoBurbuja: { name: 'Rayo Burbuja', type: 'agua', kind: 'proj', cost: 25, cd: 4, wind: 0.25, rec: 0.2, dmg: 6, speed: 480, range: 480, radius: 8, count: 3, spread: 0.25, slow: 1, wet: 3 },
    // Movimientos de los tipos y Pokémon de otras generaciones
    garraMetal: { name: 'Garra Metal', type: 'acero', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 11, range: 66, arc: 1.5 },
    focoResplandor: { name: 'Foco Resplandor', type: 'acero', kind: 'beam', cost: 35, cd: 5, wind: 0.45, rec: 0.25, dmg: 19, len: 470, width: 20 },
    cabezaHierro: { name: 'Cabeza de Hierro', type: 'acero', kind: 'dash', cost: 25, cd: 6, wind: 0.15, rec: 0.2, dmg: 16, dist: 220, dur: 0.22, stun: 0.3 },
    punoMeteoro: { name: 'Puño Meteoro', type: 'acero', kind: 'melee', cost: 45, cd: 9, wind: 0.45, rec: 0.3, dmg: 28, range: 76, arc: 1.4, knock: 110 },
    pulsoUmbrio: { name: 'Pulso Umbrío', type: 'siniestro', kind: 'proj', cost: 30, cd: 4, wind: 0.3, rec: 0.2, dmg: 18, speed: 500, range: 540, radius: 13 },
    golpeBajo: { name: 'Golpe Bajo', type: 'siniestro', kind: 'dash', cost: 15, cd: 4, wind: 0.04, rec: 0.1, dmg: 11, dist: 210, dur: 0.14 },
    triturar: { name: 'Triturar', type: 'siniestro', kind: 'melee', cost: 40, cd: 8, wind: 0.35, rec: 0.25, dmg: 26, range: 72, arc: 1.4, stun: 0.3 },
    vientoFeerico: { name: 'Viento Feérico', type: 'hada', kind: 'cone', cost: 0, cd: 0.5, wind: 0.08, rec: 0.1, dmg: 7, range: 170, arc: 0.8 },
    brilloMagico: { name: 'Brillo Mágico', type: 'hada', kind: 'area', at: 'self', cost: 35, cd: 7, wind: 0.25, rec: 0.25, dmg: 18, radius: 130, delay: 0.45 },
    fuerzaLunar: { name: 'Fuerza Lunar', type: 'hada', kind: 'proj', cost: 45, cd: 9, wind: 0.45, rec: 0.25, dmg: 26, speed: 420, range: 560, radius: 15 },
    luzLunar: { name: 'Luz Lunar', type: 'hada', kind: 'heal', cost: 35, cd: 20, wind: 0.35, rec: 0.2, heal: 0.16, selfStun: 1.2 },
    disparoDemora: { name: 'Disparo Demora', type: 'bicho', kind: 'proj', cost: 0, cd: 0.55, wind: 0.08, rec: 0.1, dmg: 5, speed: 520, range: 440, radius: 8, slow: 0.6 },
    zumbido: { name: 'Zumbido', type: 'bicho', kind: 'cone', cost: 30, cd: 5, wind: 0.35, rec: 0.2, dmg: 16, range: 300, arc: 0.95 },
    idaYVuelta: { name: 'Ida y Vuelta', type: 'bicho', kind: 'dash', cost: 15, cd: 4, wind: 0.05, rec: 0.1, dmg: 11, dist: 220, dur: 0.15, back: true },
    megacuerno: { name: 'Megacuerno', type: 'bicho', kind: 'melee', cost: 45, cd: 9, wind: 0.45, rec: 0.3, dmg: 30, range: 74, arc: 1.3, knock: 100 },
    infortunio: { name: 'Infortunio', type: 'fantasma', kind: 'area', at: 'cursor', cost: 45, cd: 9, wind: 0.25, rec: 0.3, dmg: 24, radius: 85, delay: 0.6, maxRange: 480, slow: 1.5 },
    pulsoDragon: { name: 'Pulso Dragón', type: 'dragon', kind: 'proj', cost: 30, cd: 4, wind: 0.3, rec: 0.2, dmg: 18, speed: 480, range: 540, radius: 14 },
    cometaDraco: { name: 'Cometa Draco', type: 'dragon', kind: 'area', at: 'cursor', cost: 60, cd: 12, wind: 0.35, rec: 0.35, dmg: 17, radius: 70, delay: 0.8, maxRange: 480, count: 3, scatter: 80, stagger: 0.18 },
    tierraViva: { name: 'Tierra Viva', type: 'tierra', kind: 'area', at: 'cursor', cost: 30, cd: 6, wind: 0.2, rec: 0.25, dmg: 18, radius: 70, delay: 0.5, maxRange: 480 },
    cantoHelado: { name: 'Canto Helado', type: 'hielo', kind: 'dash', cost: 15, cd: 4, wind: 0.04, rec: 0.1, dmg: 10, dist: 210, dur: 0.14, slow: 0.8 },
    lanzaMugre: { name: 'Lanza Mugre', type: 'veneno', kind: 'proj', cost: 45, cd: 9, wind: 0.45, rec: 0.25, dmg: 26, speed: 440, range: 540, radius: 15, poison: 4 },
    aireAfilado: { name: 'Aire Afilado', type: 'volador', kind: 'proj', cost: 25, cd: 4, wind: 0.25, rec: 0.2, dmg: 16, speed: 640, range: 520, radius: 10 },
  };
  // Protección (Espacio) la tienen todos: los primeros PERFECT segundos devuelven el golpe.
  const PROTECT = { name: 'Protección', cd: 4.5, dur: 0.55, perfect: 0.18, block: 0.8 };
  const ENERGY = { max: 100, regen: 11, onHit: 4 };
  const SWAP = { cd: 4, time: 0.3, perfect: 0.35 };

  // ---------- Pokémon ----------
  const STONE_IDS = ['agua', 'trueno', 'fuego', 'hoja', 'lunar', 'sol', 'hielo', 'noche', 'alba', 'dia'];
  // hp, atk (multiplicador de daño) y spd a nivel 50. evo: [dex, nivel] o [dex, 'piedra'].
  const SPECIES = {};
  function sp(dex, name, types, hp, atk, spd, moves, evo) {
    SPECIES[dex] = { dex, name, types, hp, atk, spd, moves, evo: evo || null };
  }
  sp(1, 'Bulbasaur', ['planta', 'veneno'], 100, 0.95, 210, ['hojaAfilada', 'latigoCepa', 'drenadoras', 'rayoSolar'], [2, 16]);
  sp(2, 'Ivysaur', ['planta', 'veneno'], 112, 1.02, 210, ['hojaAfilada', 'latigoCepa', 'drenadoras', 'rayoSolar'], [3, 32]);
  sp(3, 'Venusaur', ['planta', 'veneno'], 128, 1.1, 200, ['hojaAfilada', 'latigoCepa', 'sintesis', 'rayoSolar']);
  sp(4, 'Charmander', ['fuego'], 92, 1.0, 222, ['ascuas', 'lanzallamas', 'pantallaHumo', 'nitrocarga'], [5, 16]);
  sp(5, 'Charmeleon', ['fuego'], 104, 1.07, 224, ['ascuas', 'lanzallamas', 'nitrocarga', 'llamarada'], [6, 36]);
  sp(6, 'Charizard', ['fuego', 'volador'], 120, 1.15, 226, ['ascuas', 'lanzallamas', 'golpeAereo', 'llamarada']);
  sp(7, 'Squirtle', ['agua'], 106, 0.95, 200, ['pistolaAgua', 'hidrobomba', 'acuaJet', 'acuaAro'], [8, 16]);
  sp(8, 'Wartortle', ['agua'], 116, 1.02, 204, ['pistolaAgua', 'hidrobomba', 'acuaJet', 'surf'], [9, 36]);
  sp(9, 'Blastoise', ['agua'], 136, 1.1, 192, ['pistolaAgua', 'hidrobomba', 'acuaAro', 'surf']);
  sp(16, 'Pidgey', ['normal', 'volador'], 84, 0.9, 232, ['tornado', 'ataqueRapido', 'golpeAereo', 'vendaval'], [17, 18]);
  sp(17, 'Pidgeotto', ['normal', 'volador'], 98, 1.0, 236, ['tornado', 'ataqueRapido', 'golpeAereo', 'vendaval'], [18, 36]);
  sp(18, 'Pidgeot', ['normal', 'volador'], 114, 1.1, 242, ['tornado', 'agilidad', 'golpeAereo', 'vendaval']);
  sp(19, 'Rattata', ['normal'], 78, 0.95, 242, ['mordisco', 'ataqueRapido', 'agilidad', 'golpeCuerpo'], [20, 20]);
  sp(20, 'Raticate', ['normal'], 100, 1.08, 240, ['mordisco', 'ataqueRapido', 'golpeCuerpo', 'hiperrayo']);
  sp(25, 'Pikachu', ['electrico'], 86, 1.0, 242, ['impactrueno', 'rayo', 'ataqueRapido', 'trueno'], [26, 'trueno']);
  sp(26, 'Raichu', ['electrico'], 106, 1.12, 236, ['impactrueno', 'rayo', 'ondaTrueno', 'trueno']);
  sp(27, 'Sandshrew', ['tierra'], 100, 0.98, 206, ['bofetonLodo', 'excavar', 'tumbaRocas', 'terremoto'], [28, 22]);
  sp(28, 'Sandslash', ['tierra'], 118, 1.08, 210, ['bofetonLodo', 'excavar', 'tumbaRocas', 'terremoto']);
  sp(32, 'Nidoran♂', ['veneno'], 88, 0.95, 220, ['acido', 'ataqueRapido', 'toxico', 'bombaLodo'], [33, 16]);
  sp(33, 'Nidorino', ['veneno'], 104, 1.02, 222, ['acido', 'ataqueRapido', 'toxico', 'bombaLodo'], [34, 'lunar']);
  sp(34, 'Nidoking', ['veneno', 'tierra'], 124, 1.12, 214, ['acido', 'bombaLodo', 'excavar', 'terremoto']);
  sp(37, 'Vulpix', ['fuego'], 88, 0.98, 228, ['ascuas', 'fuegoFatuo', 'pantallaHumo', 'lanzallamas'], [38, 'fuego']);
  sp(38, 'Ninetales', ['fuego'], 112, 1.1, 232, ['ascuas', 'fuegoFatuo', 'lanzallamas', 'llamarada']);
  sp(43, 'Oddish', ['planta', 'veneno'], 92, 0.95, 200, ['acido', 'drenadoras', 'bombaLodo', 'rayoSolar'], [44, 21]);
  sp(44, 'Gloom', ['planta', 'veneno'], 106, 1.02, 200, ['acido', 'drenadoras', 'bombaLodo', 'rayoSolar'], [45, 'hoja']);
  sp(45, 'Vileplume', ['planta', 'veneno'], 124, 1.12, 196, ['hojaAfilada', 'drenadoras', 'bombaLodo', 'rayoSolar']);
  sp(50, 'Diglett', ['tierra'], 66, 0.95, 250, ['bofetonLodo', 'excavar', 'ataqueRapido', 'terremoto'], [51, 26]);
  sp(51, 'Dugtrio', ['tierra'], 88, 1.1, 252, ['bofetonLodo', 'excavar', 'tumbaRocas', 'terremoto']);
  sp(54, 'Psyduck', ['agua'], 100, 0.95, 205, ['pistolaAgua', 'confusion', 'hidrobomba', 'psiquico'], [55, 33]);
  sp(55, 'Golduck', ['agua'], 118, 1.08, 214, ['pistolaAgua', 'psiquico', 'hidrobomba', 'surf']);
  sp(58, 'Growlithe', ['fuego'], 104, 1.0, 226, ['ascuas', 'nitrocarga', 'mordisco', 'lanzallamas'], [59, 'fuego']);
  sp(59, 'Arcanine', ['fuego'], 130, 1.14, 236, ['ascuas', 'nitrocarga', 'lanzallamas', 'llamarada']);
  sp(63, 'Abra', ['psiquico'], 72, 1.0, 222, ['confusion', 'teletransporte', 'psicorrayo', 'psiquico'], [64, 16]);
  sp(64, 'Kadabra', ['psiquico'], 88, 1.08, 224, ['confusion', 'teletransporte', 'psicorrayo', 'psiquico'], [65, 36]);
  sp(65, 'Alakazam', ['psiquico'], 102, 1.18, 226, ['confusion', 'teletransporte', 'psicorrayo', 'psiquico']);
  sp(66, 'Machop', ['lucha'], 110, 1.05, 200, ['golpeKarate', 'patadaBaja', 'ataqueRapido', 'punoDinamico'], [67, 28]);
  sp(67, 'Machoke', ['lucha'], 124, 1.12, 202, ['golpeKarate', 'patadaBaja', 'golpeCuerpo', 'punoDinamico'], [68, 40]);
  sp(68, 'Machamp', ['lucha'], 140, 1.2, 204, ['golpeKarate', 'patadaBaja', 'golpeCuerpo', 'punoDinamico']);
  sp(69, 'Bellsprout', ['planta', 'veneno'], 86, 1.0, 214, ['hojaAfilada', 'latigoCepa', 'acido', 'drenadoras'], [70, 21]);
  sp(70, 'Weepinbell', ['planta', 'veneno'], 100, 1.07, 214, ['hojaAfilada', 'latigoCepa', 'bombaLodo', 'drenadoras'], [71, 'hoja']);
  sp(71, 'Victreebel', ['planta', 'veneno'], 118, 1.16, 214, ['hojaAfilada', 'latigoCepa', 'bombaLodo', 'rayoSolar']);
  sp(74, 'Geodude', ['roca', 'tierra'], 108, 1.0, 182, ['lanzarrocas', 'tumbaRocas', 'excavar', 'avalancha'], [75, 25]);
  sp(75, 'Graveler', ['roca', 'tierra'], 122, 1.08, 184, ['lanzarrocas', 'tumbaRocas', 'excavar', 'avalancha'], [76, 40]);
  sp(76, 'Golem', ['roca', 'tierra'], 142, 1.16, 186, ['lanzarrocas', 'tumbaRocas', 'terremoto', 'avalancha']);
  sp(77, 'Ponyta', ['fuego'], 96, 1.02, 244, ['ascuas', 'nitrocarga', 'ataqueRapido', 'lanzallamas'], [78, 40]);
  sp(78, 'Rapidash', ['fuego'], 114, 1.12, 252, ['ascuas', 'nitrocarga', 'lanzallamas', 'llamarada']);
  sp(81, 'Magnemite', ['electrico'], 84, 1.02, 196, ['impactrueno', 'ondaTrueno', 'rayo', 'trueno'], [82, 30]);
  sp(82, 'Magneton', ['electrico'], 104, 1.12, 198, ['impactrueno', 'ondaTrueno', 'rayo', 'trueno']);
  sp(88, 'Grimer', ['veneno'], 116, 0.98, 186, ['acido', 'toxico', 'pantallaHumo', 'bombaLodo'], [89, 38]);
  sp(89, 'Muk', ['veneno'], 140, 1.1, 188, ['acido', 'toxico', 'pantallaHumo', 'bombaLodo']);
  sp(92, 'Gastly', ['fantasma', 'veneno'], 74, 1.05, 228, ['lenguetazo', 'bolaSombra', 'hipnosis', 'teletransporte'], [93, 25]);
  sp(93, 'Haunter', ['fantasma', 'veneno'], 88, 1.12, 230, ['lenguetazo', 'bolaSombra', 'hipnosis', 'teletransporte'], [94, 38]);
  sp(94, 'Gengar', ['fantasma', 'veneno'], 104, 1.2, 232, ['lenguetazo', 'bolaSombra', 'hipnosis', 'bombaLodo']);
  sp(95, 'Onix', ['roca', 'tierra'], 140, 0.95, 192, ['lanzarrocas', 'tumbaRocas', 'golpeCuerpo', 'terremoto']);
  sp(100, 'Voltorb', ['electrico'], 88, 0.95, 250, ['impactrueno', 'ataqueRapido', 'rayo', 'autodestruccion'], [101, 30]);
  sp(101, 'Electrode', ['electrico'], 104, 1.05, 258, ['impactrueno', 'ondaTrueno', 'rayo', 'autodestruccion']);
  sp(109, 'Koffing', ['veneno'], 98, 0.98, 184, ['acido', 'pantallaHumo', 'bombaLodo', 'autodestruccion'], [110, 35]);
  sp(110, 'Weezing', ['veneno'], 120, 1.08, 186, ['acido', 'pantallaHumo', 'bombaLodo', 'autodestruccion']);
  sp(111, 'Rhyhorn', ['tierra', 'roca'], 124, 1.05, 190, ['lanzarrocas', 'golpeCuerpo', 'tumbaRocas', 'terremoto'], [112, 42]);
  sp(112, 'Rhydon', ['tierra', 'roca'], 145, 1.15, 192, ['lanzarrocas', 'golpeCuerpo', 'avalancha', 'terremoto']);
  sp(114, 'Tangela', ['planta'], 118, 1.02, 200, ['hojaAfilada', 'latigoCepa', 'drenadoras', 'sintesis']);
  sp(120, 'Staryu', ['agua'], 88, 0.98, 236, ['pistolaAgua', 'rayoBurbuja', 'ataqueRapido', 'hidrobomba'], [121, 'agua']);
  sp(121, 'Starmie', ['agua', 'psiquico'], 106, 1.12, 244, ['pistolaAgua', 'psiquico', 'teletransporte', 'hidrobomba']);
  sp(122, 'Mr. Mime', ['psiquico'], 98, 1.06, 210, ['confusion', 'barrera', 'psiquico', 'psicorrayo']);
  sp(123, 'Scyther', ['bicho', 'volador'], 104, 1.14, 246, ['tijeraX', 'ataqueRapido', 'golpeAereo', 'danzaEspada']);
  sp(124, 'Jynx', ['hielo', 'psiquico'], 98, 1.1, 214, ['nievePolvo', 'hipnosis', 'rayoHielo', 'ventisca']);
  sp(126, 'Magmar', ['fuego'], 110, 1.12, 222, ['ascuas', 'punoFuego', 'lanzallamas', 'llamarada']);
  sp(129, 'Magikarp', ['agua'], 64, 0.5, 200, ['salpicadura', 'placaje', 'salpicadura', 'salpicadura'], [130, 20]);
  sp(130, 'Gyarados', ['agua', 'volador'], 140, 1.16, 214, ['mordisco', 'hidrobomba', 'danzaDragon', 'hiperrayo']);
  sp(131, 'Lapras', ['agua', 'hielo'], 152, 1.06, 190, ['nievePolvo', 'rayoHielo', 'surf', 'ventisca']);
  sp(133, 'Eevee', ['normal'], 94, 0.96, 232, ['placaje', 'ataqueRapido', 'agilidad', 'golpeCuerpo'], [[134, 'agua'], [135, 'trueno'], [136, 'fuego']]);
  sp(134, 'Vaporeon', ['agua'], 145, 1.06, 206, ['pistolaAgua', 'hidrobomba', 'acuaAro', 'surf']);
  sp(135, 'Jolteon', ['electrico'], 98, 1.1, 254, ['impactrueno', 'rayo', 'ataqueRapido', 'trueno']);
  sp(136, 'Flareon', ['fuego'], 104, 1.18, 222, ['ascuas', 'nitrocarga', 'punoFuego', 'llamarada']);
  sp(143, 'Snorlax', ['normal'], 190, 1.1, 168, ['placaje', 'golpeCuerpo', 'descanso', 'hiperrayo']);
  sp(147, 'Dratini', ['dragon'], 86, 1.0, 222, ['furiaDragon', 'ciclon', 'agilidad', 'danzaDragon'], [148, 30]);
  sp(148, 'Dragonair', ['dragon'], 104, 1.08, 228, ['furiaDragon', 'ciclon', 'rayo', 'danzaDragon'], [149, 55]);
  sp(149, 'Dragonite', ['dragon', 'volador'], 140, 1.2, 230, ['furiaDragon', 'golpeAereo', 'danzaDragon', 'hiperrayo']);

  // ---------- Resto de especies (todas las generaciones), generadas desde dex.js ----------
  // Cada tipo tiene un kit: básico, habilidad, embestida, curación, apoyo y definitivo.
  const KIT = {
    normal: { basic: 'placaje', skill: 'golpeCuerpo', dash: 'ataqueRapido', big: 'hiperrayo', heal: 'descanso' },
    fuego: { basic: 'ascuas', skill: 'lanzallamas', dash: 'nitrocarga', big: 'llamarada', util: 'fuegoFatuo' },
    agua: { basic: 'pistolaAgua', skill: 'hidrobomba', dash: 'acuaJet', big: 'surf', heal: 'acuaAro' },
    planta: { basic: 'hojaAfilada', skill: 'latigoCepa', big: 'rayoSolar', heal: 'sintesis', util: 'drenadoras' },
    electrico: { basic: 'impactrueno', skill: 'rayo', big: 'trueno', util: 'ondaTrueno' },
    hielo: { basic: 'nievePolvo', skill: 'rayoHielo', dash: 'cantoHelado', big: 'ventisca' },
    lucha: { basic: 'golpeKarate', skill: 'patadaBaja', big: 'punoDinamico' },
    veneno: { basic: 'acido', skill: 'bombaLodo', big: 'lanzaMugre', util: 'toxico' },
    tierra: { basic: 'bofetonLodo', skill: 'tierraViva', dash: 'excavar', big: 'terremoto' },
    volador: { basic: 'tornado', skill: 'aireAfilado', dash: 'golpeAereo', big: 'vendaval' },
    psiquico: { basic: 'confusion', skill: 'psicorrayo', dash: 'teletransporte', big: 'psiquico', util: 'hipnosis' },
    bicho: { basic: 'disparoDemora', skill: 'zumbido', dash: 'idaYVuelta', big: 'megacuerno' },
    roca: { basic: 'lanzarrocas', skill: 'tumbaRocas', big: 'avalancha' },
    fantasma: { basic: 'lenguetazo', skill: 'bolaSombra', dash: 'teletransporte', big: 'infortunio', util: 'hipnosis' },
    dragon: { basic: 'furiaDragon', skill: 'pulsoDragon', big: 'cometaDraco', util: 'danzaDragon' },
    acero: { basic: 'garraMetal', skill: 'focoResplandor', dash: 'cabezaHierro', big: 'punoMeteoro' },
    siniestro: { basic: 'mordisco', skill: 'pulsoUmbrio', dash: 'golpeBajo', big: 'triturar' },
    hada: { basic: 'vientoFeerico', skill: 'brilloMagico', big: 'fuerzaLunar', heal: 'luzLunar' },
  };

  function genMoves(types, st) {
    const [hp, atk, def, spa, spd, spe] = st;
    const k1 = KIT[types[0]], k2 = KIT[types[1]] || k1;
    const moves = [k1.basic, k1.skill];
    const bulky = (hp + def + spd) / 3 >= 85;
    const util = spe >= 85 ? (k1.dash || k2.dash) : bulky ? (k1.heal || k2.heal) : null;
    moves.push(util || k1.util || k2.util || k1.dash || k2.dash || k2.skill || 'ataqueRapido');
    moves.push(types[1] ? k2.big : k1.big);
    // Sin repetidos
    const pool = [k2.skill, k1.big, k2.big, k1.util, k2.util, 'ataqueRapido', 'agilidad', 'placaje'];
    for (let i = 1; i < 4; i++) while (moves.indexOf(moves[i]) !== i || !moves[i]) moves[i] = pool.shift();
    return moves;
  }

  const DEX = typeof module !== 'undefined' && module.exports ? require('./dex.js') : root.DEX;
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  for (const [id, d] of Object.entries(DEX)) {
    const dex = +id;
    const [name, types, st, gen, leg, , rate] = d;
    const bst = st.reduce((a, b) => a + b, 0);
    // Defensa: multiplicador del daño recibido (1 / def); de la media de Defensa y Def. Especial
    const def = +clampN(0.9 + ((st[2] + st[4]) / 2 - 70) / 330, 0.75, 1.3).toFixed(2);
    if (SPECIES[dex]) { Object.assign(SPECIES[dex], { gen, leg, rate, bst, name, def, base: st }); continue; }
    SPECIES[dex] = {
      dex, name, types, gen, leg, rate, bst, def, base: st,
      hp: Math.round(clampN(55 + st[0] * 0.95, 60, 200)),
      atk: +clampN(0.9 + (Math.max(st[1], st[3]) - 60) / 350 + (bst - 450) / 3000, 0.7, 1.3).toFixed(2),
      spd: Math.round(clampN(175 + st[5] * 0.6, 170, 268)),
      moves: genMoves(types, st), evo: null,
    };
  }
  // Evoluciones: por nivel, con piedra, o el resto (amistad, intercambio…) convertidas a nivel
  for (const [id, d] of Object.entries(DEX)) {
    const from = d[5], how = d[7];
    if (!from || !SPECIES[from] || !SPECIES[id]) continue;
    const base = SPECIES[from];
    const handmade = base.evo && (Array.isArray(base.evo[0]) ? base.evo : [base.evo]).some(e => e[0] === +id);
    if (handmade) continue;
    const stage = DEX[from] && DEX[from][5] ? 2 : 1;
    const cond = typeof how === 'number' ? how : STONE_IDS.includes(how) ? how : stage === 1 ? 30 : 40;
    const list = base.evo ? (Array.isArray(base.evo[0]) ? base.evo : [base.evo]) : [];
    list.push([+id, cond]);
    base.evo = list.length === 1 ? list[0] : list;
  }
  // Evoluciones por intercambio de la Gen 1 y 2: las de solo intercambio, con el Cordón Unión; las de
  // intercambio con objeto, con ese objeto (Revestimiento Metálico, Escama Dragón, Roca del Rey, Mejora)
  const EVO_ITEM = { 64: [[65, 'cordon']], 67: [[68, 'cordon']], 75: [[76, 'cordon']], 93: [[94, 'cordon']], 95: [[208, 'revestimiento']],
    123: [[212, 'revestimiento']], 117: [[230, 'escamadragon']], 61: [[186, 'rocarey']], 79: [[199, 'rocarey']], 137: [[233, 'mejora']] };
  for (const [from, list] of Object.entries(EVO_ITEM)) {
    const cur = SPECIES[from].evo, opts = cur ? (Array.isArray(cur[0]) ? cur : [cur]) : [];
    for (const [to, item] of list) { const o = opts.find(e => e[0] === to); if (o) o[1] = item; else opts.push([to, item]); }
    SPECIES[from].evo = opts.length === 1 ? opts[0] : opts;
  }

  // ---------- Movimientos por nivel ----------
  // Cada especie aprende sus movimientos al subir de nivel, como en los juegos: primero los
  // básicos de sus tipos, luego habilidades y apoyo, y los definitivos a partir del nivel 32.
  // El jugador elige qué 4 lleva (de los que ya ha aprendido).
  const LEARN_LEVELS = [1, 1, 8, 14, 20, 26, 32, 40, 48];
  const learnCache = new Map();
  function learnset(dex) {
    if (learnCache.has(dex)) return learnCache.get(dex);
    const sp = SPECIES[dex];
    const k1 = KIT[sp.types[0]], k2 = KIT[sp.types[1]] || {};
    const order = [];
    const add = m => { if (m && MOVES[m] && !order.includes(m)) order.push(m); };
    // Los 4 de siempre de la especie van primero (en su orden), intercalados con los del kit
    const base = sp.moves.filter(m => MOVES[m]);
    add(base[0]); add(k2.basic || 'placaje'); add(base[1]); add(base[2]);
    add(k1.dash || k2.dash); add(k2.skill); add(k1.heal || k2.heal || k1.util || k2.util); add(base[3]);
    add(k1.big); add(k2.big); add(k1.skill);
    const list = order.slice(0, LEARN_LEVELS.length).map((m, i) => {
      // Los movimientos caros no se aprenden antes del nivel 32
      const lvl = MOVES[m].cost >= 45 ? Math.max(32, LEARN_LEVELS[i]) : LEARN_LEVELS[i];
      return [lvl, m];
    }).sort((a, b) => a[0] - b[0]);
    learnCache.set(dex, list);
    return list;
  }
  const learnedAt = (dex, level) => learnset(dex).filter(([l]) => l <= level).map(([, m]) => m);
  // El básico y los 3 más recientes que ya sabe (lo que llevan los salvajes y los líderes)
  function defaultMoves(dex, level) {
    const l = learnedAt(dex, level);
    return l.length <= 4 ? l : [l[0], ...l.slice(-3)];
  }

  // Nivel -> multiplicador de PS y daño. A nivel 50 vale 1.
  const levelMult = lvl => 0.55 + lvl * 0.009;
  const xpToNext = lvl => 20 + lvl * 12;

  // ---------- Mapas de combate ----------
  // Rejilla de 24x15 celdas de 40 px. '#' hierba alta (oculta y arde), '~' agua, 'o' roca.
  const MAPS = {
    pradera: [
      '........................',
      '..##..............##....',
      '..###............###....',
      '...#..............#.....',
      '........................',
      '..........o.............',
      '.....##.........##......',
      '.....##...~~~...##......',
      '.....##.........##......',
      '.............o..........',
      '........................',
      '...#..............#.....',
      '..###............###....',
      '..##..............##....',
      '........................',
    ],
    bosque: [
      '........................',
      '...####........####.....',
      '...####........####.....',
      '........................',
      '..........####..........',
      '.##.......####.......##.',
      '.##..................##.',
      '.##.......o..o.......##.',
      '.##..................##.',
      '.##.......####.......##.',
      '..........####..........',
      '........................',
      '...####........####.....',
      '...####........####.....',
      '........................',
    ],
    cueva: [
      '........................',
      '....o..............o....',
      '........................',
      '........oo....oo........',
      '........................',
      '...~~..............~~...',
      '...~~.....o..o.....~~...',
      '........................',
      '...~~.....o..o.....~~...',
      '...~~..............~~...',
      '........................',
      '........oo....oo........',
      '........................',
      '....o..............o....',
      '........................',
    ],
    lago: [
      '........................',
      '.........~~~~~~.........',
      '..##.....~~~~~~.....##..',
      '..##................##..',
      '........................',
      '.~~~......####......~~~.',
      '.~~~......####......~~~.',
      '.~~~......####......~~~.',
      '........................',
      '..##................##..',
      '..##.....~~~~~~.....##..',
      '.........~~~~~~.........',
      '........................',
      '........................',
      '........................',
    ],
  };

  // ---------- Arenas de gimnasio ----------
  // Una por tipo para los líderes de gimnasio (g-) y una por miembro del Alto Mando o Campeón (e-). rows: como MAPS, más
  // 'i' hielo · 'p' veneno · 'w' telaraña · 'L' lava · 'x' muro invisible · 'H' baldosa de curación
  // 'A'/'a' 'B'/'b' 'C'/'c' teletransportes por parejas · 'v' / '^' agua con corriente · 'E' placa eléctrica.
  // mech: mecánicas del entorno (server/arena.js).
  const ARENAS = {
    'g-roca': { name: 'Cueva de Plateada', desc: 'Caen rocas del techo: sal de las marcas antes de que lleguen. Las rocas caídas sirven de cobertura un rato.', mech: { rockfall: { every: 3.4, warn: 1.1, r: 48, dmg: 0.08, ttl: 7 } },
      rows: [
        '........................',
        '...o................o...',
        '........................',
        '.......o........o.......',
        '........................',
        '...........oo...........',
        '..o..................o..',
        '........................',
        '..o..................o..',
        '...........oo...........',
        '........................',
        '.......o........o.......',
        '........................',
        '...o................o...',
        '........................',
      ] },
    'g-agua': { name: 'Piscina Celeste', desc: 'La marea sube y baja cada pocos segundos. En el agua estás mojado (más daño eléctrico y de hielo) y una descarga electrocuta todo el charco.', mech: { tide: { every: 9 } },
      rows: [
        '........................',
        '........................',
        '....~~............~~....',
        '....~~............~~....',
        '........................',
        '.........~~~~~~.........',
        '........~~~~~~~~........',
        '........~~~~~~~~........',
        '........~~~~~~~~........',
        '.........~~~~~~.........',
        '........................',
        '....~~............~~....',
        '....~~............~~....',
        '........................',
        '........................',
      ] },
    'g-electrico': { name: 'Central de Carmín', desc: 'Las placas del suelo se electrifican por turnos: cuando parpadean, sal de ellas. A los de tipo eléctrico no les afecta.', mech: { shock: { every: 3.2, warn: 1, dmg: 0.07, stun: 0.6 } },
      rows: [
        '........................',
        '........................',
        '....o..EEEEEEEEEE..o....',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEooEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '.......EEEEEEEEEE.......',
        '....o..EEEEEEEEEE..o....',
        '........................',
        '........................',
      ] },
    'g-planta': { name: 'Jardín Azulona', desc: 'La hierba alta vuelve a crecer poco después de quemarse: escóndete en ella o quémala.', mech: { regrow: 7 },
      rows: [
        '........................',
        '..####....####....####..',
        '..####....####....####..',
        '........................',
        '.....##..........##.....',
        '.....##...####...##.....',
        '..........####..........',
        '........................',
        '..........####..........',
        '.....##...####...##.....',
        '.....##..........##.....',
        '........................',
        '..####....####....####..',
        '..####....####....####..',
        '........................',
      ] },
    'g-veneno': { name: 'Dojo Fucsia', desc: 'Charcos tóxicos que envenenan y se extienden, y muros invisibles que solo se notan al chocar.', mech: { toxic: { every: 5, ttl: 7 } },
      rows: [
        '........................',
        '...pp..............pp...',
        '...pp....xxxxxx....pp...',
        '........................',
        '.......pp......pp.......',
        '.....x....pppp....x.....',
        '.....x....pppp....x.....',
        '.....x............x.....',
        '.....x....pppp....x.....',
        '.....x....pppp....x.....',
        '.......pp......pp.......',
        '........................',
        '...pp....xxxxxx....pp...',
        '...pp..............pp...',
        '........................',
      ] },
    'g-psiquico': { name: 'Sala Azafrán', desc: 'Baldosas de teletransporte por parejas: pisa una y apareces en su pareja.', mech: { warp: { cd: 1.8 } },
      rows: [
        '........................',
        '...........C............',
        '........................',
        '.....A............B.....',
        '........o......o........',
        '........................',
        '........................',
        '...........oo...........',
        '........................',
        '........................',
        '........o......o........',
        '.....b............a.....',
        '........................',
        '............c...........',
        '........................',
      ] },
    'g-fuego': { name: 'Volcán Canela', desc: 'La lava quema. Cuando un charco de lava se marca, va a entrar en erupción: aléjate.', mech: { eruption: { every: 5.5, warn: 1.2, r: 70, dmg: 0.08 } },
      rows: [
        '........................',
        '...LL..............LL...',
        '...LL.....LLLL.....LL...',
        '..........LLLL..........',
        '........................',
        '.....L............L.....',
        '........................',
        '........................',
        '........................',
        '.....L............L.....',
        '........................',
        '..........LLLL..........',
        '...LL.....LLLL.....LL...',
        '...LL..............LL...',
        '........................',
      ] },
    'g-tierra': { name: 'Arena Verde', desc: 'Terremotos: una onda recorre la arena desde el epicentro. Escóndete detrás de una roca (la zona verde) o usa Protección; a los voladores no les afecta.', mech: { quake: { every: 8, warn: 1, speed: 340, dmg: 0.09, slow: 1.2 } },
      rows: [
        '........................',
        '........................',
        '.....o............o.....',
        '..........o..o..........',
        '........................',
        '........................',
        '..o..................o..',
        '........................',
        '..o..................o..',
        '........................',
        '........................',
        '..........o..o..........',
        '.....o............o.....',
        '........................',
        '........................',
      ] },
    'g-volador': { name: 'Torre Malva', desc: 'Ráfagas de viento que te arrastran hacia un lado. A los voladores no les afecta.', mech: { wind: { every: 7, warn: 1.2, dur: 2.6, force: 95 } },
      rows: [
        '........................',
        '........................',
        '.......o........o.......',
        '........................',
        '........................',
        '...........oo...........',
        '........................',
        '........................',
        '........................',
        '...........oo...........',
        '........................',
        '........................',
        '.......o........o.......',
        '........................',
        '........................',
      ] },
    'g-bicho': { name: 'Invernadero Azalea', desc: 'Telarañas que ralentizan (menos a los de tipo bicho) y hierba que vuelve a crecer. El fuego las quema.', mech: { regrow: 8 },
      rows: [
        '........................',
        '..###....wwwwww....###..',
        '..###..............###..',
        '..###...##....##...###..',
        '........##....##........',
        '.....ww..........ww.....',
        '.....ww...####...ww.....',
        '..........####..........',
        '.....ww...####...ww.....',
        '.....ww..........ww.....',
        '........##....##........',
        '..###...##....##...###..',
        '..###..............###..',
        '..###....wwwwww....###..',
        '........................',
      ] },
    'g-normal': { name: 'Estadio Trigal', desc: 'Baldosas de curación: cúrate encima mientras les quede energía. Luego tardan en recargarse.', mech: { heal: { rate: 0.045, drain: 0.22, cd: 12 } },
      rows: [
        '........................',
        '........................',
        '........................',
        '......H..........H......',
        '..........o..o..........',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '..........o..o..........',
        '......H..........H......',
        '........................',
        '........................',
        '........................',
      ] },
    'g-fantasma': { name: 'Torre Iris', desc: 'Oscuridad: solo ves al rival de cerca o justo cuando ataca.', mech: { dark: 230 },
      rows: [
        '........................',
        '....o..............o....',
        '........................',
        '........o......o........',
        '........................',
        '..o........##........o..',
        '..........####..........',
        '........................',
        '..........####..........',
        '..o........##........o..',
        '........................',
        '........o......o........',
        '........................',
        '....o..............o....',
        '........................',
      ] },
    'g-siniestro': { name: 'Sala Nocturna', desc: 'Noche cerrada: solo ves al rival de cerca o justo cuando ataca.', mech: { dark: 260 },
      rows: [
        '........................',
        '........................',
        '......o..........o......',
        '...........##...........',
        '.....##...####...##.....',
        '..........####..........',
        '........................',
        '...........oo...........',
        '........................',
        '..........####..........',
        '.....##...####...##.....',
        '...........##...........',
        '......o..........o......',
        '........................',
        '........................',
      ] },
    'g-lucha': { name: 'Cascadas Orquídea', desc: 'Dos cascadas con corriente que te arrastran. Crúzalas por los puentes de piedra.', mech: { flow: 115 },
      rows: [
        '.......vv......^^.......',
        '.......vv......^^.......',
        '.......vv......^^.......',
        '.......vv......^^.......',
        '........................',
        '.......vv......^^.......',
        '...o...vv......^^...o...',
        '.......vv......^^.......',
        '...o...vv......^^...o...',
        '.......vv......^^.......',
        '........................',
        '.......vv......^^.......',
        '.......vv......^^.......',
        '.......vv......^^.......',
        '.......vv......^^.......',
      ] },
    'g-acero': { name: 'Faro Olivo', desc: 'El haz del faro gira sin parar y quema al que alcanza. A los de tipo acero no les afecta.', mech: { beam: { speed: 0.55, len: 560, width: 14, dmg: 0.07 } },
      rows: [
        '........................',
        '........................',
        '....o..............o....',
        '........................',
        '........................',
        '........................',
        '........................',
        '...........oo...........',
        '........................',
        '........................',
        '........................',
        '........................',
        '....o..............o....',
        '........................',
        '........................',
      ] },
    'g-hielo': { name: 'Pista Caoba', desc: 'Suelo helado: resbalas y cuesta frenar. El fuego lo derrite un rato y los ataques de hielo congelan el agua.', mech: { ice: true },
      rows: [
        '........................',
        '..iiiiiiiiiiiiiiiiiiii..',
        '..iiiiiiiiiiiiiiiiiiii..',
        '..iiio.iiiiiiiiii.oiii..',
        '..iiiiiiiiiiiiiiiiiiii..',
        '.....iiiiiiiiiiiiii.....',
        '.....iiiiiiooiiiiii.....',
        '.....iiiiiiiiiiiiii.....',
        '.....iiiiiiooiiiiii.....',
        '.....iiiiiiiiiiiiii.....',
        '..iiiiiiiiiiiiiiiiiiii..',
        '..iiio.iiiiiiiiii.oiii..',
        '..iiiiiiiiiiiiiiiiiiii..',
        '..iiiiiiiiiiiiiiiiiiii..',
        '........................',
      ] },
    'g-dragon': { name: 'Cráter Endrino', desc: 'Ríos de lava, erupciones y el viento de las alas de los dragones.', mech: { eruption: { every: 7, warn: 1.2, r: 70, dmg: 0.08 }, wind: { every: 9, warn: 1.2, dur: 2.2, force: 80 } },
      rows: [
        'LLLLLLL..........LLLLLLL',
        'LLLL................LLLL',
        '........................',
        '........................',
        '..........LLLL..........',
        '.....o....LLLL....o.....',
        '........................',
        '........................',
        '........................',
        '.....o....LLLL....o.....',
        '..........LLLL..........',
        '........................',
        '........................',
        'LLLL................LLLL',
        'LLLLLLL..........LLLLLLL',
      ] },
    // Salas propias del Alto Mando y los Campeones: varias mecánicas a la vez y más intensas
    'e-lorelei': { name: 'Cámara Glacial', desc: 'Alto Mando. Suelo helado, carámbanos que caen del techo y ventiscas que te arrastran.', mech: { ice: true, rockfall: { every: 2.6, warn: 1, r: 46, dmg: 0.09, ttl: 6, ty: 'hielo', slow: 1.5 }, wind: { every: 8, warn: 1.1, dur: 2.4, force: 85 } },
      rows: [
        '..iiiiiiiiiiiiiiiiiiii..',
        '.iiiiiiiiiiiiiiiiiiiiii.',
        '.iiio..iiiiiiiiii..oiii.',
        '.iiiiiiiii~~~~iiiiiiiii.',
        '.iiiiiiii~~~~~~iiiiiiii.',
        '..iiiiiii~~~~~~iiiiiii..',
        '...iiiiiiiiooiiiiiiii...',
        '...iiiiiiiiiiiiiiiiii...',
        '...iiiiiiiiooiiiiiiii...',
        '..iiiiiii~~~~~~iiiiiii..',
        '.iiiiiiii~~~~~~iiiiiiii.',
        '.iiiiiiiii~~~~iiiiiiiii.',
        '.iiio..iiiiiiiiii..oiii.',
        '.iiiiiiiiiiiiiiiiiiiiii.',
        '..iiiiiiiiiiiiiiiiiiii..',
      ] },
    'e-bruno': { name: 'Dojo de Roca', desc: 'Alto Mando. Terremotos seguidos y rocas que caen del techo.', mech: { quake: { every: 6.5, warn: 0.9, speed: 380, dmg: 0.1, slow: 1.4 }, rockfall: { every: 3.2, warn: 1, r: 48, dmg: 0.08, ttl: 6 } },
      rows: [
        '........................',
        '..o..................o..',
        '......o..........o......',
        '..........o..o..........',
        '....o..............o....',
        '........................',
        '..........o..o..........',
        '........................',
        '..........o..o..........',
        '........................',
        '....o..............o....',
        '..........o..o..........',
        '......o..........o......',
        '..o..................o..',
        '........................',
      ] },
    'e-agatha': { name: 'Cripta Espectral', desc: 'Alto Mando. A oscuras, con teletransportes y charcos tóxicos que se extienden.', mech: { dark: 200, warp: { cd: 1.5 }, toxic: { every: 6, ttl: 6 } },
      rows: [
        '........................',
        '...o................o...',
        '.....A............B.....',
        '.........o....o.........',
        '........................',
        '..##......pppp......##..',
        '..##................##..',
        '........................',
        '..##................##..',
        '..##......pppp......##..',
        '........................',
        '.........o....o.........',
        '.....b............a.....',
        '...o................o...',
        '........................',
      ] },
    'e-lance': { name: 'Guarida del Dragón', desc: 'Alto Mando. Un anillo de lava, el aliento de dragón que gira desde el centro, erupciones y ráfagas.', mech: { beam: { speed: 0.7, len: 560, width: 16, dmg: 0.08, ty: 'dragon' }, eruption: { every: 6, warn: 1.1, r: 70, dmg: 0.08 }, wind: { every: 9, warn: 1.1, dur: 2.2, force: 90 } },
      rows: [
        'LLL..................LLL',
        'LL....................LL',
        '........................',
        '.....o............o.....',
        '........................',
        '.........LLLLLL.........',
        '........LL....LL........',
        '........L..oo..L........',
        '........LL....LL........',
        '.........LLLLLL.........',
        '........................',
        '.....o............o.....',
        '........................',
        'LL....................LL',
        'LLL..................LLL',
      ] },
    'e-azul': { name: 'Sala del Campeón', desc: 'Campeón. Placas eléctricas en el centro, terremotos y baldosas de curación en las esquinas.', mech: { shock: { every: 2.8, warn: 0.9, dmg: 0.08, stun: 0.6 }, quake: { every: 9, warn: 1, speed: 360, dmg: 0.09, slow: 1.2 }, heal: { rate: 0.04, drain: 0.3, cd: 15 } },
      rows: [
        '........................',
        '..H..................H..',
        '........................',
        '....o..............o....',
        '.........EEEEEE.........',
        '.........EEEEEE.........',
        '.........EEEEEE.........',
        '.........EEooEE.........',
        '.........EEEEEE.........',
        '.........EEEEEE.........',
        '.........EEEEEE.........',
        '....o..............o....',
        '........................',
        '..H..................H..',
        '........................',
      ] },
    'e-will': { name: 'Sala Psíquica', desc: 'Alto Mando. Teletransportes y un haz psíquico que gira y aturde.', mech: { warp: { cd: 1.4 }, beam: { speed: 0.8, len: 560, width: 14, dmg: 0.07, ty: 'psiquico' } },
      rows: [
        '........................',
        '....A..............B....',
        '........................',
        '.......o........o.......',
        '........................',
        '........................',
        '........................',
        '...........oo...........',
        '........................',
        '........................',
        '........................',
        '.......o........o.......',
        '........................',
        '....b..............a....',
        '........................',
      ] },
    'e-kogaj': { name: 'Dojo Ninja', desc: 'Alto Mando. Penumbra, muros invisibles y charcos tóxicos que se extienden deprisa.', mech: { dark: 270, toxic: { every: 3.5, ttl: 9 } },
      rows: [
        '........................',
        '..pp....x......x....pp..',
        '..pp....x......x....pp..',
        '........x......x........',
        '.....pp..........pp.....',
        '..........xxxx..........',
        '.....x..pp....pp..x.....',
        '.....x............x.....',
        '.....x..pp....pp..x.....',
        '..........xxxx..........',
        '.....pp..........pp.....',
        '........x......x........',
        '..pp....x......x....pp..',
        '..pp....x......x....pp..',
        '........................',
      ] },
    'e-brunoj': { name: 'Templo de las Cascadas', desc: 'Alto Mando. Cascadas con mucha corriente y terremotos.', mech: { flow: 140, quake: { every: 7, warn: 0.9, speed: 380, dmg: 0.1, slow: 1.4 } },
      rows: [
        '......vv........^^......',
        '......vv........^^......',
        '......vv........^^......',
        '........................',
        '......vv........^^......',
        '..o...vv........^^...o..',
        '......vv........^^......',
        '........................',
        '......vv........^^......',
        '..o...vv........^^...o..',
        '......vv........^^......',
        '........................',
        '......vv........^^......',
        '......vv........^^......',
        '......vv........^^......',
      ] },
    'e-karen': { name: 'Sala de las Sombras', desc: 'Alto Mando. Oscuridad y emboscadas desde las sombras.', mech: { dark: 200, rockfall: { every: 3, warn: 0.9, r: 46, dmg: 0.08, ttl: 5, ty: 'siniestro' } },
      rows: [
        '........................',
        '...##..............##...',
        '...##....o....o....##...',
        '........................',
        '.......##......##.......',
        '..........#..#..........',
        '........................',
        '...........oo...........',
        '........................',
        '..........#..#..........',
        '.......##......##.......',
        '........................',
        '...##....o....o....##...',
        '...##..............##...',
        '........................',
      ] },
    'e-lancej': { name: 'Cumbre del Dragón', desc: 'Campeón. Lava, erupciones continuas, vendavales y terremotos.', mech: { eruption: { every: 4.5, warn: 1.1, r: 72, dmg: 0.09 }, wind: { every: 8, warn: 1.1, dur: 2.4, force: 95 }, quake: { every: 9, warn: 1, speed: 380, dmg: 0.09, slow: 1.2 } },
      rows: [
        'LLLL................LLLL',
        'LL....................LL',
        '........................',
        '......L..........L......',
        '.....LL....oo....LL.....',
        '......L..........L......',
        '........................',
        '..........LLLL..........',
        '........................',
        '......L..........L......',
        '.....LL....oo....LL.....',
        '......L..........L......',
        '........................',
        'LL....................LL',
        'LLLL................LLLL',
      ] },
  };

  // ---------- Modo historia: regiones reales ----------
  // public/regions.js (generado por tools/fetch-regions.js): rutas en el orden real con sus
  // encuentros reales, y líderes, Alto Mando y Campeón con sus equipos reales.
  const REGIONS = typeof module !== 'undefined' && module.exports ? require('./regions.js') : root.REGIONS;
  const REGION_IDS = Object.keys(REGIONS);
  const NODES = {};          // id -> nodo (con .region)
  for (const r of Object.values(REGIONS)) {
    let gi = 0;
    for (const n of r.nodes) {
      n.region = r.id;
      if (n.kind !== 'route') {
        n.index = gi++;   // orden de los combates de líder (= medallas necesarias)
        // El Alto Mando y los Campeones tienen sala propia; los líderes, la arena de su tipo
        if (ARENAS['e-' + n.id]) n.map = 'e-' + n.id;
        else if (ARENAS['g-' + n.type]) n.map = 'g-' + n.type;
      }
      else {
        // Algunas zonas juntan niveles de hierba, surf y caña de dos juegos (Tentacool de Nv.5 a 40): cada
        // especie se queda con los 8 niveles más altos de su tramo para que no salgan niveles tan dispares
        for (const w of n.wild) w[1] = Math.max(w[1], w[2] - 8);
        n.lvl = [Math.min(...n.wild.map(w => w[1])), Math.max(...n.wild.map(w => w[2]))];
        n.ai = Math.min(0.25, 0.02 + n.req * 0.025);
        n.rare = 0.015 + n.req * 0.003;
      }
      NODES[n.id] = n;
    }
  }
  const leadersOf = region => REGIONS[region].nodes.filter(n => n.kind !== 'route');
  // Compatibilidad: listas planas (Kanto primero)
  const ROUTES = REGION_IDS.flatMap(r => REGIONS[r].nodes.filter(n => n.kind === 'route'));
  const GYMS = leadersOf('kanto');

  // Generador con semilla: la misma ruta y el mismo día dan lo mismo en servidor y cliente
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
  // Momento (ms) en que cambian las rutas: la próxima medianoche UTC
  const nextDay = (t = Date.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
  // Encuentros de una ruta: cada 6 horas salen 4 especies al azar de las que aparecen de verdad en ese
  // tramo y 1 de sus especiales (el legendario o el Pokémon raro que da esa zona en los juegos: estáticos,
  // regalos, fósiles, la Zona Safari, el Gyarados rojo…). Al azar, pero con «suerte acumulada»: cada tanda
  // que una especie se queda fuera, su probabilidad de salir en la siguiente se multiplica por
  // (tandas sin salir + 1)³; así las comunes salen más, pero ninguna tarda más de unos 3 días. Los perros
  // legendarios de Johto, además, vagan por todas las rutas de Johto. Es la misma secuencia para todos,
  // calculada desde ROT_EPOCH, igual en servidor y cliente.
  const ROT_EPOCH = Date.UTC(2026, 9, 1), ROT_MS = 6 * 3600e3, ROT_SHOWN = 4, ROT_PITY = 3;
  const ROT_WEIGHTS = [35, 30, 20, 15];
  const rotIndex = (t = Date.now()) => Math.max(0, Math.floor((t - ROT_EPOCH) / ROT_MS));
  const rotEnds = (t = Date.now()) => ROT_EPOCH + (rotIndex(t) + 1) * ROT_MS;
  const ROUTE_SPECIALS = {
    'k-ruta1': [25], 'k-ruta2': [25], 'k-ruta3': [35, 138, 140, 142], 'k-ruta24': [1, 4], 'k-ruta6': [7, 51],
    'k-ruta11': [145, 143], 'k-tunelroca': [133, 106, 107], 'k-torre': [93, 105], 'k-ruta15': [143],
    'k-safari': [113, 147, 123, 127, 115, 128], 'k-ruta19': [131], 'k-espuma': [144], 'k-ruta23': [146],
    'j-ruta29': [175, 152, 155, 158], 'j-oscura': [206], 'j-ruta32': [235], 'j-ruta33': [131], 'j-encinar': [251],
    'j-ruta35': [123, 127], 'j-ruta37': [243, 244, 245], 'j-ruta38': [213], 'j-ruta41': [249], 'j-ruta42': [236],
    'j-ruta43': [{ dex: 130, shiny: true }], 'j-ruta44': [215], 'j-guarida': [148], 'j-ruta46': [246],
  };
  const ROAMERS = { johto: [243, 244, 245] };
  const ROAM_CHANCE = 0.005;
  // Elige n de la lista con sus pesos (base · (tandas sin salir + 1)^ROT_PITY), sin repetir
  function pickWithPity(r, base, miss, n) {
    const pool = base.map((_, i) => i), out = [];
    while (out.length < n && pool.length) {
      const ws = pool.map(i => base[i] * (1 + miss[i]) ** ROT_PITY), total = ws.reduce((a, b) => a + b, 0);
      let x = r() * total, j = 0;
      while (j < pool.length - 1 && (x -= ws[j]) > 0) j++;
      out.push(pool.splice(j, 1)[0]);
    }
    return out;
  }
  // Tanda k de una ruta: se avanza desde la última calculada (o desde el principio) apuntando cuántas
  // tandas lleva cada especie y cada especial sin salir
  const rotState = new Map();
  function rotation(route, k) {
    const sps = ROUTE_SPECIALS[route.id] || [];
    let st = rotState.get(route.id);
    if (!st || st.k > k) st = { k: -1, miss: route.wild.map(() => 0), spMiss: sps.map(() => 0), picks: [], sp: -1 };
    while (st.k < k) {
      st.k++;
      const r = seeded(route.id + ':' + st.k);
      st.picks = pickWithPity(r, route.wild.map(w => w[3]), st.miss, ROT_SHOWN);
      st.sp = sps.length ? pickWithPity(r, sps.map(() => 1), st.spMiss, 1)[0] : -1;
      st.miss = st.miss.map((m, i) => st.picks.includes(i) ? 0 : m + 1);
      st.spMiss = st.spMiss.map((m, i) => i === st.sp ? 0 : m + 1);
    }
    rotState.set(route.id, st);
    return st;
  }
  // Lo que sale ahora en una ruta: las 4 de la tanda (de la más común a la más rara), su especial, los
  // errantes y cuándo cambia
  function routeWild(route, t = Date.now()) {
    const st = rotation(route, rotIndex(t));
    const picks = st.picks.map(i => route.wild[i]).sort((a, b) => b[3] - a[3]);
    const list = picks.map(([dex, min, max], i) => ({ dex, min, max, weight: ROT_WEIGHTS[i] / ROT_WEIGHTS.slice(0, picks.length).reduce((a, b) => a + b, 0) }));
    const sp = st.sp >= 0 ? ROUTE_SPECIALS[route.id][st.sp] : null;
    const specials = sp ? [typeof sp === 'number' ? { dex: sp } : sp] : [];
    const roam = (ROAMERS[route.region] || []).filter(d => !specials.some(x => x.dex === d));
    return { list, specials, chance: specials.length ? route.rare : 0, roam, roamChance: roam.length ? ROAM_CHANCE : 0, level: route.lvl[1] + 3, ends: rotEnds(t) };
  }
  // Un encuentro: a veces un especial (o un perro errante en Johto); si no, una especie según su probabilidad
  function rollWild(route, rand = Math.random, t = Date.now()) {
    const w = routeWild(route, t);
    const x0 = rand();
    if (x0 < w.chance) { const sp = w.specials[Math.floor(rand() * w.specials.length)]; return { dex: sp.dex, level: w.level, rare: true, shiny: !!sp.shiny }; }
    if (x0 < w.chance + w.roamChance) return { dex: w.roam[Math.floor(rand() * w.roam.length)], level: w.level, rare: true };
    let x = rand();
    for (const e of w.list) if ((x -= e.weight) <= 0) return { dex: e.dex, level: e.min + Math.floor(rand() * (e.max - e.min + 1)) };
    const e = w.list[0];
    return { dex: e.dex, level: e.min };
  }

  // Pokémon de la tienda: 4 al día (cambian con las rutas), uno por franja de fuerza, sin legendarios.
  // Llegan con IV perfectos al tope de nivel de tu región y son muy caros; cada uno, una vez al día.
  const SHOP_TIERS = [[300, 430, 1, 15000], [430, 500, 3, 25000], [500, 560, 5, 40000], [560, 620, 7, 65000]];
  const shopCache = new Map();
  function shopMons(day = dayKey()) {
    if (shopCache.has(day)) return shopCache.get(day);
    const r = seeded('tienda:' + day);
    const all = Object.values(SPECIES).filter(sp => !sp.leg && sp.dex < 1000);
    const list = SHOP_TIERS.map(([lo, hi, req, base]) => {
      const pool = all.filter(sp => sp.bst >= lo && sp.bst < hi);
      const sp = pool[Math.floor(r() * pool.length)];
      return { id: 'daily' + sp.dex, name: sp.name, dex: sp.dex, daily: true, perfect: true, req,
        price: Math.round((base + (sp.bst - lo) * 120) / 500) * 500, desc: 'IV perfectos · llega a tu tope de nivel' };
    });
    shopCache.set(day, list);
    return list;
  }
  // El Pokémon misterioso de cada ruta sale con IV perfectos 1 de cada 3 veces
  const RARE_PERFECT = 1 / 3;
  const PERFECT_IVS = { hp: 31, atk: 31, def: 31, spe: 31 };

  // Progreso por región: prog = { kanto: medallas/combates ganados, johto: ... }
  const progOf = (p, region) => (p && p.prog && p.prog[region]) || 0;
  // Equipo de combate de un líder: los 3 más fuertes de su equipo real, con el as al final.
  // 'rival' = el inicial del rival según el tuyo (ventaja de tipo sobre ti).
  function leaderTeam(node, playerStarter) {
    const rivalAce = { planta: 6, fuego: 9, agua: 3 };
    const st = playerStarter && SPECIES[playerStarter] ? SPECIES[playerStarter].types[0] : 'planta';
    const team = node.team.map(([d, l]) => [d === 'rival' ? (rivalAce[st] || 6) : d, l]);
    const idx = team.map((t, i) => i).sort((i, j) => team[j][1] - team[i][1] || j - i).slice(0, 3).sort((i, j) => i - j);
    return idx.map(i => team[i]);
  }
  // Tope de nivel POR REGIÓN: los Pokémon de una región no pasan de la media de niveles del
  // siguiente líder de esa región (sin tope cuando la región está completada).
  // levelCap(perfil, región) · levelCap(medallas) = Kanto (compatibilidad).
  // La Liga (Alto Mando y Campeón, desde el 9.º líder) se juega de una vez: 5 combates seguidos
  const LEAGUE_FROM = 8;
  const avgLevel = n => n.team.reduce((a, [, l]) => a + l, 0) / n.team.length;
  // Tope de nivel: la media del siguiente líder; con las 8 medallas, la de toda la Liga (se juega seguida);
  // después del Campeón, 100
  function levelCap(p, region = 'kanto') {
    const prog = typeof p === 'number' ? p : progOf(p, region), leaders = leadersOf(region);
    if (prog >= leaders.length) return 100;
    if (prog >= LEAGUE_FROM) { const league = leaders.slice(LEAGUE_FROM); return Math.round(league.reduce((a, n) => a + avgLevel(n), 0) / league.length); }
    return Math.round(avgLevel(leaders[prog]));
  }
  // Iniciales de cada región (al empezar una región eliges uno nuevo: los Pokémon no viajan)
  const REGION_STARTERS = { kanto: [1, 4, 7], johto: [152, 155, 158] };
  // Iniciales de las 9 generaciones (solo los que tienen sprites)
  const STARTERS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912].filter(d => SPECIES[d]);
  // Probabilidad de captura: sube cuantos menos PS le quedan y si tiene un estado alterado.
  // Cada Ball hace 3 sacudidas; cada una sale bien con p^(1/3), así que las 3 juntas valen p.
  // Las especies difíciles (ratio de captura bajo: legendarios, pseudolegendarios) cuestan bastante más.
  function catchChance(hpFrac, ballId, hasStatus, dex) {
    const item = SHOP.find(s => s.id === ballId);
    const base = 0.12 + 0.78 * (1 - hpFrac) * (1 - hpFrac * 0.35);
    const rate = dex && SPECIES[dex] && SPECIES[dex].rate ? SPECIES[dex].rate : 45;
    const hard = Math.min(1, Math.sqrt(rate / 45));
    return Math.max(0.02, Math.min(1, base * item.ball * (hasStatus ? 1.3 : 1) * hard));
  }
  // EV: 0-252 por estadística y 510 en total (cada 252 = +25 %). Solo se consiguen con vitaminas
  // (+10 EV cada una). IV: 0-31 por estadística, fijos al capturar (hasta +10 %).
  const EV_MAX = 252, EV_TOTAL = 510, EV_VIT = 10, IV_MAX = 31;
  const evTotal = ev => ev ? Object.values(ev).reduce((a, b) => a + (b || 0), 0) : 0;
  const VIT_STATS = { hp: 'PS', atk: 'Ataque', def: 'Defensa', spe: 'Velocidad' };
  const STAT_KEYS = ['hp', 'atk', 'def', 'spe'];
  // Naturalezas reales: [nombre, sube, baja] sobre Atq/Def/At.Esp/Df.Esp/Vel. Para el combate:
  // Atq o At.Esp cuentan si es el ataque que usa la especie (física o especial), Def y Df.Esp
  // valen la mitad cada una (nuestra Defensa es la media) y Velocidad ±10 %.
  const NATURES = {
    fuerte: ['Fuerte', null, null], huraña: ['Huraña', 'atk', 'def'], audaz: ['Audaz', 'atk', 'spe'], firme: ['Firme', 'atk', 'spa'], pícara: ['Pícara', 'atk', 'spd'],
    osada: ['Osada', 'def', 'atk'], dócil: ['Dócil', null, null], plácida: ['Plácida', 'def', 'spe'], agitada: ['Agitada', 'def', 'spa'], floja: ['Floja', 'def', 'spd'],
    miedosa: ['Miedosa', 'spe', 'atk'], activa: ['Activa', 'spe', 'def'], seria: ['Seria', null, null], alegre: ['Alegre', 'spe', 'spa'], ingenua: ['Ingenua', 'spe', 'spd'],
    modesta: ['Modesta', 'spa', 'atk'], afable: ['Afable', 'spa', 'def'], mansa: ['Mansa', 'spa', 'spe'], tímida: ['Tímida', null, null], alocada: ['Alocada', 'spa', 'spd'],
    serena: ['Serena', 'spd', 'atk'], amable: ['Amable', 'spd', 'def'], grosera: ['Grosera', 'spd', 'spe'], cauta: ['Cauta', 'spd', 'spa'], rara: ['Rara', null, null],
  };
  const NATURE_IDS = Object.keys(NATURES);
  const STAT6 = { atk: 'Ataque', def: 'Defensa', spa: 'At. Especial', spd: 'Def. Especial', spe: 'Velocidad' };
  const randomNature = () => NATURE_IDS[Math.floor(Math.random() * NATURE_IDS.length)];
  const randomIv = () => ({ hp: Math.floor(Math.random() * 32), atk: Math.floor(Math.random() * 32), def: Math.floor(Math.random() * 32), spe: Math.floor(Math.random() * 32) });
  // Multiplicadores de la naturaleza para nuestras 4 estadísticas
  function natureMult(dex, nat) {
    const n = NATURES[nat];
    const out = { hp: 1, atk: 1, def: 1, spe: 1 };
    if (!n || !n[1]) return out;
    const sp = SPECIES[dex];
    const physical = !sp.base || sp.base[1] >= sp.base[3];
    const apply = (stat, sign) => {
      if (stat === 'atk' && physical) out.atk += 0.1 * sign;
      if (stat === 'spa' && !physical) out.atk += 0.1 * sign;
      if (stat === 'def' || stat === 'spd') out.def += 0.05 * sign;
      if (stat === 'spe') out.spe += 0.1 * sign;
    };
    apply(n[1], 1); apply(n[2], -1);
    return out;
  }
  // Probabilidad de que un salvaje sea shiny (los misteriosos, el triple; los huevos, mucho más)
  const SHINY_RATE = 1 / 300;
  // Un shiny se puede ver con sus colores normales (m.plain): sigue siendo shiny, solo cambia cómo se ve
  const looksShiny = m => !!(m && m.shiny && !m.plain);
  // Precio al vender un Pokémon: por fuerza de la especie y nivel; los shiny valen mucho más
  function sellPrice(mon) {
    const sp = SPECIES[mon.dex];
    const base = 30 + Math.max(0, sp.bst - 150) * 0.5 + mon.level * 10 + (sp.leg ? 1500 : 0);
    return Math.round(base * (mon.shiny ? 6 : 1));
  }
  // Tienda: Poké Balls (multiplican la probabilidad de captura), piedras evolutivas,
  // Caramelo Raro, vitaminas y Pokémon raros a la venta.
  const SHOP = [
    { id: 'pokeball', name: 'Poké Ball', price: 100, ball: 1, desc: 'La de siempre. Mejor con el salvaje debilitado' },
    { id: 'superball', name: 'Super Ball', price: 350, ball: 1.5, desc: 'Captura con más facilidad que la Poké Ball', req: 2 },
    { id: 'ultraball', name: 'Ultra Ball', price: 900, ball: 2.2, desc: 'Muy eficaz: casi siempre atrapa a un salvaje tocado', req: 5 },
    { id: 'masterball', name: 'Master Ball', price: 30000, ball: 255, desc: 'Atrapa seguro a cualquier Pokémon salvaje', req: 8 },
    { id: 'caramelo', name: 'Caramelo Raro', price: 1200, desc: 'Sube un nivel a un Pokémon', req: 1 },
    { id: 'maspsps', name: 'Más PS', price: 2500, vit: 'hp', desc: '+10 EV de PS (máx. 252 por stat, 510 en total)', req: 1 },
    { id: 'proteina', name: 'Proteína', price: 2500, vit: 'atk', desc: '+10 EV de Ataque (máx. 252 por stat, 510 en total)', req: 1 },
    { id: 'hierro', name: 'Hierro', price: 2500, vit: 'def', desc: '+10 EV de Defensa (máx. 252 por stat, 510 en total)', req: 1 },
    { id: 'carburante', name: 'Carburante', price: 2500, vit: 'spe', desc: '+10 EV de Velocidad (máx. 252 por stat, 510 en total)', req: 1 },
    { id: 'agua', name: 'Piedra Agua', price: 2000, stone: true, desc: 'Evoluciona a Eevee, Staryu…', req: 2 },
    { id: 'trueno', name: 'Piedra Trueno', price: 2000, stone: true, desc: 'Evoluciona a Pikachu, Eevee…', req: 3 },
    { id: 'fuego', name: 'Piedra Fuego', price: 2000, stone: true, desc: 'Evoluciona a Vulpix, Growlithe, Eevee', req: 3 },
    { id: 'hoja', name: 'Piedra Hoja', price: 2000, stone: true, desc: 'Evoluciona a Gloom, Weepinbell', req: 4 },
    { id: 'lunar', name: 'Piedra Lunar', price: 2000, stone: true, desc: 'Evoluciona a Nidorino, Clefairy…', req: 4 },
    { id: 'sol', name: 'Piedra Solar', price: 2000, stone: true, desc: 'Evoluciona a Gloom, Sunkern, Cottonee…', req: 4 },
    { id: 'hielo', name: 'Piedra Hielo', price: 2500, stone: true, desc: 'Evoluciona a Eevee (Glaceon), Vulpix de Alola…', req: 5 },
    { id: 'noche', name: 'Piedra Noche', price: 2500, stone: true, desc: 'Evoluciona a Murkrow, Misdreavus…', req: 5 },
    { id: 'alba', name: 'Piedra Alba', price: 2500, stone: true, desc: 'Evoluciona a Kirlia (macho), Snorunt (hembra)…', req: 6 },
    { id: 'dia', name: 'Piedra Día', price: 2500, stone: true, desc: 'Evoluciona a Togetic, Roselia, Minccino…', req: 6 },
    // Objetos de intercambio: como en los juegos, la descripción no dice para qué son
    { id: 'cordon', name: 'Cordón Unión', price: 3000, stone: true, desc: 'Un cordón extraño que parece unir a dos Pokémon. Algunos reaccionan al tocarlo…', req: 4 },
    { id: 'revestimiento', name: 'Revestimiento Metálico', price: 3000, stone: true, desc: 'Una capa metálica especial. ¿Qué pasará si se la das a cierto Pokémon?', req: 5 },
    { id: 'rocarey', name: 'Roca del Rey', price: 3000, stone: true, desc: 'Una roca con forma de corona. Dicen que a algunos Pokémon les sienta muy bien…', req: 5 },
    { id: 'escamadragon', name: 'Escama Dragón', price: 3500, stone: true, desc: 'Una escama muy dura y brillante. Algo despierta en quien la lleva…', req: 6 },
    { id: 'mejora', name: 'Mejora', price: 3500, stone: true, desc: 'Una caja transparente llena de datos misteriosos. ¿Quién podría usarla?', req: 6 },
  ];
  // Poké Balls, de la más común a la Master Ball (en combate, R las recorre en este orden)
  const BALL_IDS = SHOP.filter(i => i.ball).map(i => i.id);

  // ---------- Clasificatoria ----------
  // Todos a nivel 50; draft con 1 veto y 3 elecciones por jugador.
  const RANKED_POOL = [3, 6, 9, 18, 26, 34, 38, 59, 65, 68, 76, 94, 112, 121, 123, 130, 131, 135, 143, 149];
  const RANKED_LEVEL = 50;
  // Equipo de PvP (Clasificatoria y Partida rápida): 3 Pokémon distintos del pool, cada uno con hasta 4 de
  // los movimientos que sabe a Nv.50 (sin ninguno válido, los de por defecto). null si no vale
  function pvpTeam(team) {
    if (!Array.isArray(team) || team.length !== 3) return null;
    const out = [];
    for (const x of team) {
      const dex = +(x && x.dex);
      if (!RANKED_POOL.includes(dex) || out.some(o => o.dex === dex)) return null;
      const can = learnedAt(dex, RANKED_LEVEL);
      const moves = [...new Set((Array.isArray(x.moves) ? x.moves : []).map(String))].filter(m => can.includes(m)).slice(0, 4);
      out.push({ dex, moves: moves.length ? moves : defaultMoves(dex, RANKED_LEVEL) });
    }
    return out;
  }
  // Largo máximo del mote de un Pokémon (como en los juegos)
  const NICK_MAX = 12;
  const LEAGUES = [[0, 'Bronce'], [1100, 'Plata'], [1250, 'Oro'], [1400, 'Platino'], [1550, 'Diamante'], [1700, 'Maestro']];
  const leagueOf = elo => LEAGUES.filter(l => elo >= l[0]).pop()[1];
  // Temporada actual. Al subir el id, cada perfil cobra el premio de la anterior según su mejor liga
  // y su ELO se acerca a la mitad hacia 1000.
  const SEASON = { id: 1, name: 'Temporada 1', start: '2026-10-24', end: '2026-12-31' };
  // Recompensas por alcanzar una liga por primera vez en la temporada (se reclaman a mano).
  // Los títulos y marcos se quedan para siempre; dinero y objetos son para la historia.
  const RANKED_REWARDS = {
    Bronce: { coins: 0, items: {}, title: 'Novato', frame: 'bronce' },
    Plata: { coins: 1000, items: { superball: 5 }, title: 'Aspirante', frame: 'plata' },
    Oro: { coins: 2000, items: { ultraball: 5, caramelo: 1 }, title: 'Estratega', frame: 'oro' },
    Platino: { coins: 3500, items: { caramelo: 3 }, title: 'Veterano', frame: 'platino' },
    Diamante: { coins: 5000, items: { caramelo: 5, proteina: 1, carburante: 1 }, title: 'As del draft', frame: 'diamante' },
    Maestro: { coins: 8000, items: { caramelo: 10, maspsps: 1, hierro: 1 }, title: 'Maestro de la Arena', frame: 'maestro' },
  };
  // Premio de fin de temporada según la mejor liga alcanzada en ella
  const SEASON_REWARDS = { Bronce: 300, Plata: 800, Oro: 1500, Platino: 2500, Diamante: 4000, Maestro: 6000 };
  const seasonTitle = (league, season) => `${league} · T${season}`;
  // Dinero por combate de clasificatoria y extra por la primera victoria del día
  const RANKED_PAY = { win: 120, loss: 40, firstWin: 400 };

  // El Alto Mando y los Campeones llevan Pokémon criados a conciencia: IV perfectos y 120 EV por stat
  const ELITE_EV = 120;
  const leaderExtras = node => (node.kind === 'elite' || node.kind === 'champion')
    ? { iv: Object.fromEntries(STAT_KEYS.map(k => [k, IV_MAX])), ev: Object.fromEntries(STAT_KEYS.map(k => [k, ELITE_EV])) } : {};

  // ---------- Logros ----------
  // Cada logro mide un número del perfil (progress) contra una meta. Al cumplirse se queda para siempre
  // y da su premio: título, marco del avatar y/o dinero. Se pueden fijar hasta 3 en el perfil como
  // insignias. tier: 1 bronce · 2 plata · 3 oro. icon: sprite de objeto (public/items) o 'badge:<región>'.
  // La Pokédex cuenta solo las generaciones con región abierta (una por región: Kanto = Gen 1, Johto = Gen 2…)
  const DEX_GENS = REGION_IDS.length;
  const inDex = dex => !!SPECIES[dex] && SPECIES[dex].gen <= DEX_GENS;
  const DEX_TOTAL = Object.values(SPECIES).filter(s => s.gen <= DEX_GENS).length;
  const dexCount = p => (p.caught || []).filter(inDex).length;
  const shinyCount = p => Math.max((p.shinies || []).length, (p.mons || []).filter(m => m.shiny).length);
  const perfectCount = p => (p.mons || []).filter(m => m.iv && STAT_KEYS.every(k => m.iv[k] === IV_MAX)).length;
  const badgeCount = (p, r) => Math.min(8, progOf(p, r));
  const champ = (p, r) => (progOf(p, r) >= leadersOf(r).length ? 1 : 0);
  const towerBest = p => (p.tower && p.tower.best) || 0;
  const ACHIEVEMENTS = [
    { id: 'captura1', cat: 'coleccion', name: 'Primera captura', desc: 'Atrapa tu primer Pokémon salvaje.', icon: 'poke-ball', tier: 1, goal: 2,   /* el inicial cuenta como 1 */ progress: dexCount, reward: { coins: 300, aura: 'tipo-normal' } },
    { id: 'dex25', cat: 'coleccion', name: 'Coleccionista', desc: 'Registra 25 especies en la Pokédex.', icon: 'great-ball', tier: 1, goal: 25, progress: dexCount, reward: { coins: 1000, title: 'Coleccionista' } },
    { id: 'dex100', cat: 'coleccion', name: 'Investigador', desc: 'Registra 100 especies en la Pokédex.', icon: 'ultra-ball', tier: 2, goal: 100, progress: dexCount, reward: { coins: 3000, frame: 'pokedex', title: 'Investigador Pokémon' } },
    { id: 'dex250', cat: 'coleccion', name: 'Enciclopedia andante', desc: 'Registra 250 especies en la Pokédex.', icon: 'master-ball', tier: 3, goal: 250, progress: dexCount, reward: { coins: 8000, title: 'Profesor Pokémon', aura: 'prisma' } },
    { id: 'shiny1', cat: 'coleccion', name: 'Destello', desc: 'Consigue tu primer Pokémon shiny.', icon: 'shiny-charm', tier: 2, goal: 1, progress: shinyCount, reward: { coins: 2000, frame: 'shiny', title: 'Cazador de shinies' } },
    { id: 'shiny5', cat: 'coleccion', name: 'Coleccionista de destellos', desc: 'Consigue 5 Pokémon shiny.', icon: 'shiny-stone', tier: 3, goal: 5, progress: shinyCount, reward: { coins: 6000, title: 'Rey de los destellos', aura: 'estelar' } },
    { id: 'perfecto', cat: 'coleccion', name: 'Ejemplar perfecto', desc: 'Ten un Pokémon con IV perfectos.', icon: 'star-piece', tier: 2, goal: 1, progress: perfectCount, reward: { coins: 2000, title: 'Criador' } },
    { id: 'medalla1', cat: 'progreso', name: 'Primera medalla', desc: 'Gana tu primera medalla de gimnasio.', icon: 'badge:kanto', tier: 1, goal: 1, progress: p => badgeCount(p, 'kanto') + badgeCount(p, 'johto'), reward: { coins: 500 } },
    { id: 'kanto8', cat: 'progreso', name: 'Ocho medallas de Kanto', desc: 'Consigue las 8 medallas de Kanto.', icon: 'badge:kanto', tier: 2, goal: 8, progress: p => badgeCount(p, 'kanto'), reward: { coins: 3000, title: 'Entrenador de Kanto' } },
    { id: 'kantoChamp', cat: 'progreso', name: 'Campeón de Kanto', desc: 'Vence al Alto Mando y al Campeón de Kanto.', icon: 'relic-crown', tier: 3, goal: 1, progress: p => champ(p, 'kanto'), reward: { coins: 8000, title: 'Campeón de Kanto', aura: 'dorado' } },
    { id: 'johto8', cat: 'progreso', name: 'Ocho medallas de Johto', desc: 'Consigue las 8 medallas de Johto.', icon: 'badge:johto', tier: 2, goal: 8, progress: p => badgeCount(p, 'johto'), reward: { coins: 3000, title: 'Entrenador de Johto' } },
    { id: 'johtoChamp', cat: 'progreso', name: 'Campeón de Johto', desc: 'Vence al Alto Mando y al Campeón de Johto.', icon: 'relic-crown', tier: 3, goal: 1, progress: p => champ(p, 'johto'), reward: { coins: 8000, title: 'Campeón de Johto', aura: 'sombra' } },
    { id: 'torre7', cat: 'torre', name: 'Escalador', desc: 'Gana 7 combates seguidos en la Torre Batalla.', icon: 'exp-share', tier: 1, goal: 7, progress: towerBest, reward: { coins: 1000 } },
    { id: 'torre21', cat: 'torre', name: 'Cerebro vencido', desc: 'Llega a 21 victorias seguidas en la Torre Batalla.', icon: 'amulet-coin', tier: 2, goal: 21, progress: towerBest, reward: { coins: 4000, frame: 'torre', title: 'Desafiante de la Torre' } },
    { id: 'torre49', cat: 'torre', name: 'Leyenda de la Torre', desc: 'Llega a 49 victorias seguidas en la Torre Batalla.', icon: 'nugget', tier: 3, goal: 49, progress: towerBest, reward: { coins: 10000, title: 'Leyenda de la Torre' } },
    { id: 'ranked1', cat: 'pvp', name: 'Primera victoria online', desc: 'Gana una clasificatoria.', icon: 'vs-seeker', tier: 1, goal: 1, progress: p => p.wins || 0, reward: { coins: 500 } },
    { id: 'ranked25', cat: 'pvp', name: 'Competidor', desc: 'Gana 25 clasificatorias.', icon: 'tm-normal', tier: 2, goal: 25, progress: p => p.wins || 0, reward: { coins: 3000, title: 'Competidor' } },
    { id: 'equipo10', cat: 'coleccion', name: 'Equipo creciente', desc: 'Ten 10 Pokémon.', icon: 'lucky-egg', tier: 1, goal: 10, progress: p => (p.mons || []).length, reward: { coins: 800 } },
    // Combate: debilitar con movimientos de cada tipo da su marco
    ...TYPE_NAMES.map(type => ({ id: 'ko-' + type, cat: 'combate', type, name: 'Especialista en {type}', desc: 'Debilita {n} Pokémon con movimientos de tipo {type}.',
      icon: 'type:' + type, tier: 2, goal: 100, progress: p => ((p.koByType || {})[type] || 0), reward: { coins: 1500, aura: 'tipo-' + type } })),
  ];
  const achievementProgress = (p, a) => Math.min(a.goal, a.progress(p));
  const SHOWCASE_MAX = 3;
  // Avatares de colección (además de los Pokémon atrapados): el icono de cada logro conseguido
  // ('item:<sprite>') y cada medalla de gimnasio ganada ('badge:<región>:<n>'). Se recogen a mano.
  const achievementAvatar = a => a.icon.startsWith('badge:') || a.icon.startsWith('type:') ? null : 'item:' + a.icon;
  // Categorías de los logros (pestañas de Logros)
  const ACH_CATS = ['progreso', 'combate', 'coleccion', 'torre', 'pvp'];
  const badgeAvatar = (region, index) => `badge:${region}:${index}`;
  const avatarIds = () => [...new Set(ACHIEVEMENTS.map(achievementAvatar).filter(Boolean))];

  // ---------- Torre Batalla ----------
  // Todos a Nv.50; cada 7 victorias sube el bloque (IA más lista) y cada 21 combates espera el Cerebro de
  // la Frontera. Premios (server/tower.js; la ventana de Premios de la Torre los enseña desde aquí): dinero
  // por victoria (base + por bloque), cada bloque un Caramelo Raro, una vitamina y gemas (GEMS.towerBlock),
  // y el Cerebro dinero extra y, la primera vez de cada uno, su símbolo con premio.
  const TOWER = {
    level: 50, block: 7, brainEvery: 21,
    coins: { base: 100, perBlock: 50, brain: 2500 },
    blockPrize: { caramelo: 1 },             // y una vitamina al azar y GEMS.towerBlock gemas
    symbolPrize: { masterball: 1, caramelo: 3, gems: 50 },
    brainAgain: { caramelo: 2, ultraball: 3, gems: 25 },
  };
  // ---------- Misiones diarias y semanales ----------
  // Cada día (medianoche UTC) salen 3 diarias y cada lunes 3 semanales, al azar de estas listas.
  // ev: lo que cuenta (server/missions.js) · type: sale con un tipo al azar de MISSION_TYPES ·
  // max: cuenta el mejor valor y no la suma. Cumplida, el premio se recoge a mano; las que no
  // convencen se cambian (unas gratis y después pagando) y recoger las 3 abre el cofre.
  const MISSIONS = {
    daily: [
      { id: 'd-wild', ev: 'wild', goal: 5, name: 'Vence a {n} Pokémon salvajes', reward: { coins: 200, items: { pokeball: 2 } } },
      { id: 'd-catch', ev: 'catch', goal: 3, name: 'Atrapa {n} Pokémon', reward: { coins: 250, items: { pokeball: 3 } } },
      { id: 'd-catch-type', ev: 'catch', type: true, goal: 1, name: 'Atrapa un Pokémon de tipo {type}', reward: { coins: 300, items: { superball: 2 } } },
      { id: 'd-win-type', ev: 'win', type: true, goal: 3, name: 'Gana {n} combates con un Pokémon de tipo {type} en tu equipo', reward: { coins: 250, items: { superball: 1 } } },
      { id: 'd-gym', ev: 'gym', goal: 2, name: 'Gana {n} combates contra líderes de gimnasio', reward: { coins: 300, items: { caramelo: 1 } } },
      { id: 'd-tower', ev: 'tower', goal: 3, name: 'Gana {n} combates en la Torre Batalla', reward: { coins: 300, items: { caramelo: 1 } } },
      { id: 'd-online', ev: 'online', goal: 2, name: 'Juega {n} combates online', reward: { coins: 300, items: { superball: 1 } } },
      { id: 'd-level', ev: 'level', goal: 5, name: 'Sube {n} niveles a tus Pokémon', reward: { coins: 200, items: { caramelo: 1 } } },
    ],
    weekly: [
      { id: 'w-wild', ev: 'wild', goal: 30, name: 'Vence a {n} Pokémon salvajes', reward: { coins: 1000, items: { ultraball: 2, caramelo: 1 } } },
      { id: 'w-catch', ev: 'catch', goal: 15, name: 'Atrapa {n} Pokémon', reward: { coins: 1500, items: { ultraball: 5 } } },
      { id: 'w-dex', ev: 'dex', goal: 5, name: 'Registra {n} especies nuevas en la Pokédex', reward: { coins: 1500, items: { caramelo: 1, carburante: 1 } } },
      { id: 'w-win-type', ev: 'win', type: true, goal: 10, name: 'Gana {n} combates con un Pokémon de tipo {type} en tu equipo', reward: { coins: 1000, items: { proteina: 1 } } },
      { id: 'w-gym', ev: 'gym', goal: 6, name: 'Gana {n} combates contra líderes de gimnasio', reward: { coins: 1500, items: { caramelo: 1, hierro: 1 } } },
      { id: 'w-tower', ev: 'towerStreak', max: true, goal: 7, name: 'Consigue una racha de {n} en la Torre Batalla', reward: { coins: 2000, items: { caramelo: 1, maspsps: 1 } } },
      { id: 'w-ranked', ev: 'rankedWin', goal: 5, name: 'Gana {n} clasificatorias', reward: { coins: 2000, items: { caramelo: 1, proteina: 1 } } },
      { id: 'w-evolve', ev: 'evolve', goal: 2, name: 'Haz evolucionar {n} Pokémon', reward: { coins: 1500, items: { caramelo: 1, carburante: 1 } } },
      { id: 'w-level', ev: 'level', goal: 30, name: 'Sube {n} niveles a tus Pokémon', reward: { coins: 1800, items: { caramelo: 2 } } },
    ],
  };
  const MISSION_COUNT = 3;
  const MISSION_TYPES = ['normal', 'fuego', 'agua', 'planta', 'electrico', 'bicho', 'volador', 'veneno', 'tierra', 'roca', 'psiquico', 'lucha'];
  // Cambios gratis por día (diarias) y por semana (semanales); después cuestan dinero
  const MISSION_REROLLS = { daily: 2, weekly: 1 };
  const MISSION_REROLL_COST = { daily: 200, weekly: 1000 };
  // Glows del avatar (p.aura): una luz alrededor de tu foto de perfil. Los de tipo salen de la maestría
  // de una línea de ese tipo, de Lucky Spin o del cofre semanal de misiones (uno que no tengas); los
  // especiales, de logros (reward.aura en ACHIEVEMENTS) y el prismático también de la Torre
  const AURA_SPECIAL = ['prisma', 'dorado', 'sombra', 'estelar'];
  const AURAS = [...AURA_SPECIAL, ...TYPE_NAMES.map(t => 'tipo-' + t)];
  const MISSION_CHEST = {
    daily: { coins: 500, items: { caramelo: 1, superball: 3 } },
    weekly: { coins: 4000, items: { caramelo: 4, ultraball: 5, maspsps: 1, proteina: 1 } },
  };
  // Premio diario por entrar: un ciclo de 7 días que va a más (el 7.º es el grande). Se recoge a mano;
  // si se salta un día, se vuelve al 1.º
  const DAILY_LOGIN = [
    { coins: 200, gems: 3, items: { pokeball: 5 } },
    { coins: 300, gems: 3, items: { superball: 2 } },
    { coins: 300, gems: 5, items: { caramelo: 1 } },
    { coins: 500, gems: 5, items: { superball: 3 } },
    { coins: 500, gems: 5, items: { ultraball: 2 } },
    { coins: 700, gems: 8, items: { caramelo: 2 } },
    { coins: 1500, gems: 20, items: { ultraball: 3, caramelo: 2, maspsps: 1 } },
  ];
  // Premio por acabar el tutorial (una vez)
  const TUTORIAL_REWARD = { coins: 500, items: { pokeball: 5, superball: 2 } };
  const MISSION_BY_ID = Object.fromEntries([...MISSIONS.daily, ...MISSIONS.weekly].map(m => [m.id, m]));
  // Semana: la fecha (UTC) de su lunes, y cuándo empieza la siguiente
  const weekKey = (t = Date.now()) => { const d = new Date(t); return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (d.getUTCDay() + 6) % 7)); };
  const nextWeek = (t = Date.now()) => Date.parse(weekKey(t)) + 7 * 86400e3;

  // ---------- Maestría por línea evolutiva ----------
  // Cada combate ganado (historia, Torre, clasificatoria o rápida; la práctica no) suma una victoria a
  // la línea evolutiva de cada Pokémon de tu equipo: Charmander, Charmeleon y Charizard suman a la misma.
  // Premios por línea (se recogen a mano en Colección): estrella a 10, la ilustración oficial como
  // avatar a 25, el brillo de burbuja de su tipo a 50, el marco animado de su tipo a 100 (el primero de
  // la especie base: fuego para la línea de Charmander) y las skins Oro (150), Holo (250) y Galaxia
  // (400, con el título de maestro de la línea y el brillo prismático). La skin Elemental (paleta y
  // partículas del tipo) ya no es de maestría: sale en las ruletas de Tesoros, para una línea concreta.
  const PRE = {};
  for (const s of Object.values(SPECIES)) for (const [to] of (!s.evo ? [] : Array.isArray(s.evo[0]) ? s.evo : [s.evo])) if (!PRE[to]) PRE[to] = s.dex;
  const lineOf = dex => { let d = dex, n = 0; while (PRE[d] && SPECIES[PRE[d]] && n++ < 4) d = PRE[d]; return d; };
  const lineMembers = root => Object.values(SPECIES).filter(s => lineOf(s.dex) === root).map(s => s.dex).sort((a, b) => a - b);
  // Retos de cada línea evolutiva (pestaña Líneas de Logros). La mayoría cuentan victorias con la línea en el
  // equipo; Holo, las victorias online (clasificatoria o rápida) con ella, y Galaxia, la mejor racha de la
  // Torre con ella en el equipo. Los marcos de tipo ya no son de aquí: salen de los logros de debilitar con
  // movimientos de ese tipo (ACHIEVEMENTS ko-<tipo>).
  const MASTERY_TIERS = [
    { wins: 10, kind: 'reward', coins: 500, items: { caramelo: 1 } },
    { wins: 50, kind: 'art' },
    { wins: 100, kind: 'portrait' },
    { wins: 200, kind: 'title' },
    { wins: 500, kind: 'skin', skin: 'oro' },
    { stat: 'pvp', goal: 25, kind: 'skin', skin: 'holo' },
    { stat: 'tower', goal: 50, kind: 'skin', skin: 'galaxia', aura: 'prisma' },
  ];
  const tierGoal = x => x.goal || x.wins;
  const MASTERY = MASTERY_TIERS.filter(x => !x.stat).map(x => x.wins);   // victorias de cada estrella
  const MASTERY_ART = MASTERY_TIERS.find(x => x.kind === 'art').wins;
  const SKINS = ['oro', 'holo', 'galaxia', 'elemental'];
  const masteryWins = (p, dex) => ((p.mastery || {})[lineOf(dex)] || 0);
  // Contador de un reto de línea: victorias, victorias online o mejor racha de la Torre con la línea
  const lineStat = (p, dex, stat = 'wins') => stat === 'wins' ? masteryWins(p, dex) : (((p.lineStats || {})[stat] || {})[lineOf(dex)] || 0);
  const masteryTier = wins => MASTERY.filter(n => wins >= n).length;
  const typeFrameOf = dex => 'tipo-' + SPECIES[lineOf(dex)].types[0];
  const typeAuraOf = dex => 'tipo-' + SPECIES[lineOf(dex)].types[0];
  const masteryTitle = dex => 'Maestro de ' + SPECIES[lineOf(dex)].name;
  // Premios de maestría ya recogidos de una línea (índices de MASTERY_TIERS) y los que se pueden recoger
  const masteryClaimed = (p, dex) => ((p.masteryClaimed || {})[lineOf(dex)] || []);
  const masteryReady = (p, dex) => MASTERY_TIERS.map((x, i) => i).filter(i => lineStat(p, dex, MASTERY_TIERS[i].stat) >= tierGoal(MASTERY_TIERS[i]) && !masteryClaimed(p, dex).includes(i));
  const hasMastery = (p, dex, kind, skin) => masteryClaimed(p, dex).some(i => MASTERY_TIERS[i].kind === kind && (!skin || MASTERY_TIERS[i].skin === skin));
  // Skins de una línea: las de maestría y las ganadas en Tesoros ('elemental:<línea>' en cosmetics.skins)
  const hasSkin = (p, dex, id) => hasMastery(p, dex, 'skin', id) || ((p.cosmetics || {}).skins || []).includes(id + ':' + lineOf(dex));
  // Skin que lleva un Pokémon (la elegida para su línea, si la tiene)
  // Partículas de una línea (brasas, burbujas, chispas… del tipo de la línea) alrededor del sprite, con
  // cualquier skin. Se ganan en Lucky Spin (la línea en cosmetics.particles) y se encienden por línea
  const hasParticles = (p, dex) => ((p.cosmetics || {}).particles || []).includes(lineOf(dex));
  const particlesOf = (p, dex) => hasParticles(p, dex) && (p.particles || {})[lineOf(dex)] ? SPECIES[lineOf(dex)].types[0] : null;
  const skinOf = (p, dex) => { const s = (p.skins || {})[lineOf(dex)]; return s && hasSkin(p, dex, s) ? s : null; };

  // ---------- Tesoros ----------
  // Una moneda propia, las gemas, que dan las misiones y sus cofres, la primera victoria online del día,
  // los líderes (y el Alto Mando y el Campeón), cada bloque de 7 de la Torre, subir de liga y los
  // salvajes raros o shiny. Se gastan en ruletas que cambian cada 2 semanas: 3 a la vez, cada una de un
  // tipo, con 10 premios (skins Elementales de líneas de ese tipo, glows, retratos con efecto y algo de
  // dinero y caramelos). Cada tirada da uno de los que faltan: lo más común sale más; lo conseguido sale
  // de la bolsa y el resto gana probabilidad; la décima tirada da el último, seguro. Cada tirada cuesta
  // más que la anterior. Al cambiar las ruletas, lo conseguido se queda y lo que faltaba se va.
  // Gemas: quien entra cada día y hace sus misiones diarias saca en 2 semanas (lo que dura cada tanda de
  // ruletas) unas 400 (premio diario ~100 + misiones y cofre diario ~310), y las 3 ruletas enteras cuestan
  // 3 × 130 = 390 (SPIN_COST): todo desbloqueable jugando a diario. Las semanales, la Torre, el online, los
  // líderes y los salvajes raros dan más y antes: cuanto más juegas, antes lo tienes.
  const GEMS = { missionDaily: 4, missionWeekly: 10, chestDaily: 10, chestWeekly: 40, firstWin: 10, leader: 15, leaderAgain: 4, towerBlock: 20, league: 30, rareWild: 5, shiny: 25 };
  const TREASURE_EPOCH = Date.UTC(2026, 9, 19), TREASURE_DAYS = 14, TREASURE_COUNT = 3;
  const treasurePeriod = (t = Date.now()) => Math.floor((t - TREASURE_EPOCH) / (TREASURE_DAYS * 86400e3));
  const treasureEnds = (t = Date.now()) => TREASURE_EPOCH + (treasurePeriod(t) + 1) * TREASURE_DAYS * 86400e3;
  const RARITY = {
    comun: { w: 40, name: 'Común', color: '#9aa6bd' }, raro: { w: 24, name: 'Raro', color: '#4aa0ff' },
    epico: { w: 13, name: 'Épico', color: '#a35cff' }, legendario: { w: 6, name: 'Legendario', color: '#ffb21a' },
    mitico: { w: 3, name: 'Mítico', color: '#ff3d6e' },
  };
  // Cada tirada, más cara (300 gemas la ruleta entera): entrando a diario sale 1 tirada al día; jugando más, 2
  const SPIN_COST = [10, 14, 18, 22, 26, 30, 34, 39, 48, 59];
  // Efecto dentro de la burbuja de los retratos, según el tipo; 'aurora' es el especial (prismático)
  const PORTRAIT_FX = { fuego: 'llamas', agua: 'burbujas', electrico: 'chispas', planta: 'hojas', bicho: 'hojas', hielo: 'copos',
    fantasma: 'sombras', siniestro: 'sombras', veneno: 'sombras', psiquico: 'estrellas', hada: 'estrellas', dragon: 'estrellas' };
  const portraitFx = type => PORTRAIT_FX[type] || 'destellos';
  // Efectos del avatar: algo animado por encima de la imagen (cualquier retrato, medalla o Pokémon). Son
  // aparte de los retratos (la cara), los marcos (el contorno) y los glows (la luz de fuera): se consiguen
  // y se ponen por separado
  const EFFECTS = ['llamas', 'burbujas', 'chispas', 'hojas', 'copos', 'sombras', 'estrellas', 'destellos', 'aurora'];
  // Retratos con emoción (public/portraits/emo, índice en portraits/emo.js, tools/import-collab.js): de momento
  // la Gen 1 y 2. En Tesoros, cada cara sale con una emoción según su rareza (si esa especie la tiene), como
  // variante distinta de la normal
  const PORTRAIT_EMO = (typeof module !== 'undefined' && module.exports ? require('./portraits/emo.js') : root.PORTRAIT_EMO) || {};
  const FACE_EMOTIONS = ['Happy', 'Determined', 'Joyous', 'Inspired'];
  const hasEmotion = (dex, emo) => !!(PORTRAIT_EMO[dex] && PORTRAIT_EMO[dex].e.includes(emo));
  const treasureCache = new Map();
  // Ruletas de Lucky Spin: de momento solo de la Gen 1 y 2 (como la historia). Cada una es de una línea
  // evolutiva: el gran premio es su skin Elemental, 2 premios medianos son retratos de esa línea (con
  // emoción y el efecto de su tipo) y el glow de su tipo, y el resto, cosas útiles para avanzar. Las 3 de
  // cada tanda salen en orden: primero los iniciales (Charmander, Bulbasaur, Squirtle, luego Johto) y
  // después el resto de líneas mezcladas, siempre igual en servidor y cliente.
  const TREASURE_STARTERS = [4, 1, 7, 155, 152, 158];
  const TREASURE_LINES = (() => {
    const roots = [...new Set(Object.values(SPECIES).filter(s => s.dex <= 251 && !s.leg).map(s => lineOf(s.dex)))]
      .filter(d => d <= 251 && SPECIES[d] && !TREASURE_STARTERS.includes(d));
    const rnd = seeded('lucky-spin-lines');
    return [...TREASURE_STARTERS, ...roots.sort((x, y) => x - y).sort(() => rnd() - 0.5)];
  })();
  function treasures(period = treasurePeriod()) {
    if (treasureCache.has(period)) return treasureCache.get(period);
    const rnd = seeded('tesoros:' + period);   // las mismas en el servidor y en el cliente
    const n = TREASURE_LINES.length, base = ((period * TREASURE_COUNT) % n + n) % n;
    const out = Array.from({ length: TREASURE_COUNT }, (_, k) => {
      const line = TREASURE_LINES[(base + k) % n];
      const members = lineMembers(line).filter(d => d <= 251);
      const type = SPECIES[line].types[0];
      const fx = portraitFx(type);
      const last = members[members.length - 1], first = members[0];
      const face = (d, emo) => ({ id: `pt:${d}${hasEmotion(d, emo) ? ':' + emo : ''}`, kind: 'portrait', dex: d, ...(hasEmotion(d, emo) ? { emo } : {}) });
      const vit = SHOP.filter(i => i.vit)[Math.floor(rnd() * 4)].id;
      const prizes = [
        { id: `skin:elemental:${line}`, kind: 'skin', skin: 'elemental', dex: line, rarity: 'mitico' },
        { id: 'fx:' + fx, kind: 'effect', effect: fx, rarity: 'legendario' },
        { ...face(last, 'Determined'), rarity: 'epico' },
        { ...face(first === last ? line : first, 'Happy'), rarity: 'epico' },
        { id: 'pfx:' + line, kind: 'particles', dex: line, rarity: 'epico' },
        { id: 'item:caramelo:3', kind: 'item', item: 'caramelo', qty: 3, rarity: 'raro' },
        { id: `item:${vit}:2`, kind: 'item', item: vit, qty: 2, rarity: 'raro' },
        { id: 'item:ultraball:5', kind: 'item', item: 'ultraball', qty: 5, rarity: 'raro' },
        { id: 'coins:2500', kind: 'coins', coins: 2500, rarity: 'comun' },
        { id: 'item:superball:5', kind: 'item', item: 'superball', qty: 5, rarity: 'comun' },
      ];
      // Si la línea tiene una sola especie, los dos retratos coinciden: el segundo pasa a ser Master Ball
      if (prizes[2].id === prizes[3].id) prizes[3] = { id: 'item:masterball:1', kind: 'item', item: 'masterball', qty: 1, rarity: 'epico' };
      return { id: `${period}-${line}`, type, line, prizes };
    });
    treasureCache.set(period, out);
    return out;
  }
  // Probabilidad de cada premio que falta en la próxima tirada (por su rareza)
  function treasureOdds(roulette, got) {
    const left = roulette.prizes.filter(x => !got.includes(x.id));
    const total = left.reduce((a, x) => a + RARITY[x.rarity].w, 0);
    return left.map(x => ({ prize: x, p: RARITY[x.rarity].w / total }));
  }

  const api = { TYPE_NAMES, TYPE_LABEL, TYPE_COLOR, CHART, typeMult, MOVES, PROTECT, ENERGY, SWAP, SPECIES,
    DAILY_LOGIN, TUTORIAL_REWARD,
    levelMult, xpToNext, MAPS, ARENAS, ROUTES, GYMS, REGIONS, REGION_IDS, NODES, leadersOf, progOf, LEAGUE_FROM, leaderTeam, leaderExtras, REGION_STARTERS, STARTERS, SHOP, BALL_IDS, catchChance, routeWild, rollWild, ROUTE_SPECIALS, ROT_MS, ROT_EPOCH, rotIndex, rotEnds, dayKey, nextDay, shopMons, RARE_PERFECT, PERFECT_IVS, KIT, STONE_IDS, learnset, learnedAt, defaultMoves, levelCap, EV_MAX, EV_TOTAL, EV_VIT, IV_MAX, evTotal, VIT_STATS, STAT_KEYS, NATURES, NATURE_IDS, STAT6, randomNature, randomIv, natureMult, SHINY_RATE, looksShiny, sellPrice, RANKED_POOL, RANKED_LEVEL, pvpTeam, NICK_MAX, LEAGUES, leagueOf, SEASON, RANKED_REWARDS, SEASON_REWARDS, ACHIEVEMENTS, ACH_CATS, DEX_GENS, DEX_TOTAL, inDex, dexCount, achievementProgress, SHOWCASE_MAX, lineOf, lineMembers, MASTERY, MASTERY_TIERS, MASTERY_ART, tierGoal, lineStat, SKINS, masteryWins, masteryTier, typeFrameOf, typeAuraOf, masteryTitle, masteryClaimed, masteryReady, hasMastery, skinOf, hasParticles, particlesOf, seasonTitle, RANKED_PAY, hasSkin, TOWER, GEMS, TREASURE_DAYS, treasurePeriod, treasureEnds, RARITY, SPIN_COST, PORTRAIT_FX, portraitFx, EFFECTS, FACE_EMOTIONS, hasEmotion, treasures, treasureOdds,
    achievementAvatar, badgeAvatar, avatarIds, MISSIONS, MISSION_COUNT, MISSION_TYPES, MISSION_REROLLS, MISSION_REROLL_COST, MISSION_CHEST, MISSION_BY_ID, weekKey, nextWeek, AURAS, AURA_SPECIAL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Data = api;
})(this);
