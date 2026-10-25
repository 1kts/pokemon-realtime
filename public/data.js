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
    placaje: { name: 'Placaje', type: 'normal', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 10, range: 64, arc: 1.7, knock: 60 },
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
    surf: { name: 'Surf', type: 'agua', kind: 'wave', cost: 45, cd: 9, wind: 0.3, rec: 0.3, dmg: 20, speed: 340, range: 560, width: 260, thick: 22, knock: 150, terrain: 'agua', wet: 4 },
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
  // Encuentros de una ruta: cada día salen 4 especies al azar de las que aparecen de verdad en ese
  // tramo (las comunes, más a menudo) y 1 especial: un legendario o muy raro de la región que
  // comparta tipo con la zona si es posible. Igual en servidor y cliente.
  const DAILY_WEIGHTS = [35, 30, 20, 15];
  const routeCache = new Map();
  function routeWild(route, day = dayKey()) {
    const key = route.id + day;
    if (routeCache.has(key)) return routeCache.get(key);
    const r = seeded(key);
    const pool = route.wild.slice();
    const picks = [];
    while (picks.length < 4 && pool.length) {
      const total = pool.reduce((a, w) => a + w[3], 0);
      let x = r() * total, i = 0;
      while (i < pool.length - 1 && (x -= pool[i][3]) > 0) i++;
      picks.push(pool.splice(i, 1)[0]);
    }
    picks.sort((a, b) => b[3] - a[3]);
    const types = new Set(route.wild.flatMap(([d]) => SPECIES[d].types));
    const legends = REGIONS[route.region].legends;
    const fitting = legends.filter(d => SPECIES[d].types.some(t => types.has(t)));
    const pickFrom = fitting.length ? fitting : legends;
    const rare = pickFrom[Math.floor(r() * pickFrom.length)];
    const out = { day, list: picks.map(([dex, min, max], i) => ({ dex, min, max, weight: DAILY_WEIGHTS[i] })), rare: { dex: rare, chance: route.rare } };
    routeCache.set(key, out);
    if (routeCache.size > 300) routeCache.delete(routeCache.keys().next().value);
    return out;
  }
  function rollWild(route, rand = Math.random, day = dayKey()) {
    const w = routeWild(route, day);
    if (rand() < w.rare.chance) return { dex: w.rare.dex, level: route.lvl[1] + 3, rare: true };
    const total = w.list.reduce((a, x) => a + x.weight, 0);
    let x = rand() * total;
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
  function levelCap(p, region = 'kanto') {
    const prog = typeof p === 'number' ? p : progOf(p, region);
    const next = leadersOf(region)[prog];
    return next ? Math.round(next.team.reduce((a, [, l]) => a + l, 0) / next.team.length) : 100;
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
  ];

  // ---------- Clasificatoria ----------
  // Todos a nivel 50; draft con 1 veto y 3 elecciones por jugador.
  const RANKED_POOL = [3, 6, 9, 18, 26, 34, 38, 59, 65, 68, 76, 94, 112, 121, 123, 130, 131, 135, 143, 149];
  const RANKED_LEVEL = 50;
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
  const dexCount = p => (p.caught || []).length;
  const shinyCount = p => Math.max((p.shinies || []).length, (p.mons || []).filter(m => m.shiny).length);
  const perfectCount = p => (p.mons || []).filter(m => m.iv && STAT_KEYS.every(k => m.iv[k] === IV_MAX)).length;
  const badgeCount = (p, r) => Math.min(8, progOf(p, r));
  const champ = (p, r) => (progOf(p, r) >= leadersOf(r).length ? 1 : 0);
  const towerBest = p => (p.tower && p.tower.best) || 0;
  const ACHIEVEMENTS = [
    { id: 'captura1', name: 'Primera captura', desc: 'Atrapa tu primer Pokémon salvaje.', icon: 'poke-ball', tier: 1, goal: 2,   /* el inicial cuenta como 1 */ progress: dexCount, reward: { coins: 300 } },
    { id: 'dex25', name: 'Coleccionista', desc: 'Registra 25 especies en la Pokédex.', icon: 'great-ball', tier: 1, goal: 25, progress: dexCount, reward: { coins: 1000, title: 'Coleccionista' } },
    { id: 'dex100', name: 'Investigador', desc: 'Registra 100 especies en la Pokédex.', icon: 'ultra-ball', tier: 2, goal: 100, progress: dexCount, reward: { coins: 3000, frame: 'pokedex', title: 'Investigador Pokémon' } },
    { id: 'dex250', name: 'Enciclopedia andante', desc: 'Registra 250 especies en la Pokédex.', icon: 'master-ball', tier: 3, goal: 250, progress: dexCount, reward: { coins: 8000, title: 'Profesor Pokémon' } },
    { id: 'shiny1', name: 'Destello', desc: 'Consigue tu primer Pokémon shiny.', icon: 'shiny-charm', tier: 2, goal: 1, progress: shinyCount, reward: { coins: 2000, frame: 'shiny', title: 'Cazador de shinies' } },
    { id: 'shiny5', name: 'Coleccionista de destellos', desc: 'Consigue 5 Pokémon shiny.', icon: 'shiny-stone', tier: 3, goal: 5, progress: shinyCount, reward: { coins: 6000, title: 'Rey de los destellos' } },
    { id: 'perfecto', name: 'Ejemplar perfecto', desc: 'Ten un Pokémon con IV perfectos.', icon: 'star-piece', tier: 2, goal: 1, progress: perfectCount, reward: { coins: 2000, title: 'Criador' } },
    { id: 'medalla1', name: 'Primera medalla', desc: 'Gana tu primera medalla de gimnasio.', icon: 'badge:kanto', tier: 1, goal: 1, progress: p => badgeCount(p, 'kanto') + badgeCount(p, 'johto'), reward: { coins: 500 } },
    { id: 'kanto8', name: 'Ocho medallas de Kanto', desc: 'Consigue las 8 medallas de Kanto.', icon: 'badge:kanto', tier: 2, goal: 8, progress: p => badgeCount(p, 'kanto'), reward: { coins: 3000, title: 'Entrenador de Kanto' } },
    { id: 'kantoChamp', name: 'Campeón de Kanto', desc: 'Vence al Alto Mando y al Campeón de Kanto.', icon: 'relic-crown', tier: 3, goal: 1, progress: p => champ(p, 'kanto'), reward: { coins: 8000, frame: 'campeon', title: 'Campeón de Kanto' } },
    { id: 'johto8', name: 'Ocho medallas de Johto', desc: 'Consigue las 8 medallas de Johto.', icon: 'badge:johto', tier: 2, goal: 8, progress: p => badgeCount(p, 'johto'), reward: { coins: 3000, title: 'Entrenador de Johto' } },
    { id: 'johtoChamp', name: 'Campeón de Johto', desc: 'Vence al Alto Mando y al Campeón de Johto.', icon: 'relic-crown', tier: 3, goal: 1, progress: p => champ(p, 'johto'), reward: { coins: 8000, frame: 'campeon', title: 'Campeón de Johto' } },
    { id: 'torre7', name: 'Escalador', desc: 'Gana 7 combates seguidos en la Torre Batalla.', icon: 'exp-share', tier: 1, goal: 7, progress: towerBest, reward: { coins: 1000 } },
    { id: 'torre21', name: 'Cerebro vencido', desc: 'Llega a 21 victorias seguidas en la Torre Batalla.', icon: 'amulet-coin', tier: 2, goal: 21, progress: towerBest, reward: { coins: 4000, frame: 'torre', title: 'Desafiante de la Torre' } },
    { id: 'torre49', name: 'Leyenda de la Torre', desc: 'Llega a 49 victorias seguidas en la Torre Batalla.', icon: 'nugget', tier: 3, goal: 49, progress: towerBest, reward: { coins: 10000, title: 'Leyenda de la Torre' } },
    { id: 'ranked1', name: 'Primera victoria online', desc: 'Gana una clasificatoria.', icon: 'vs-seeker', tier: 1, goal: 1, progress: p => p.wins || 0, reward: { coins: 500 } },
    { id: 'ranked25', name: 'Competidor', desc: 'Gana 25 clasificatorias.', icon: 'tm-normal', tier: 2, goal: 25, progress: p => p.wins || 0, reward: { coins: 3000, title: 'Competidor' } },
    { id: 'equipo10', name: 'Equipo creciente', desc: 'Ten 10 Pokémon.', icon: 'lucky-egg', tier: 1, goal: 10, progress: p => (p.mons || []).length, reward: { coins: 800 } },
  ];
  const achievementProgress = (p, a) => Math.min(a.goal, a.progress(p));
  const SHOWCASE_MAX = 3;
  // Avatares de colección (además de los Pokémon atrapados): el icono de cada logro conseguido
  // ('item:<sprite>') y cada medalla de gimnasio ganada ('badge:<región>:<n>'). Se recogen a mano.
  const achievementAvatar = a => a.icon.startsWith('badge:') ? null : 'item:' + a.icon;
  const badgeAvatar = (region, index) => `badge:${region}:${index}`;
  const avatarIds = () => [...new Set(ACHIEVEMENTS.map(achievementAvatar).filter(Boolean))];

  // ---------- Misiones diarias y semanales ----------
  // Cada día (medianoche UTC) salen 3 diarias y cada lunes 3 semanales, al azar de estas listas.
  // ev: lo que cuenta (server/missions.js) · type: sale con un tipo al azar de MISSION_TYPES ·
  // max: cuenta el mejor valor y no la suma. Cumplida, el premio se recoge a mano; las que no
  // convencen se cambian (unas gratis y después pagando) y recoger las 3 abre el cofre.
  const MISSIONS = {
    daily: [
      { id: 'd-wild', ev: 'wild', goal: 5, name: 'Vence a {n} Pokémon salvajes', reward: { coins: 300 } },
      { id: 'd-catch', ev: 'catch', goal: 3, name: 'Atrapa {n} Pokémon', reward: { coins: 250, items: { pokeball: 3 } } },
      { id: 'd-catch-type', ev: 'catch', type: true, goal: 1, name: 'Atrapa un Pokémon de tipo {type}', reward: { coins: 300, items: { superball: 2 } } },
      { id: 'd-win-type', ev: 'win', type: true, goal: 3, name: 'Gana {n} combates con un Pokémon de tipo {type} en tu equipo', reward: { coins: 350 } },
      { id: 'd-gym', ev: 'gym', goal: 2, name: 'Gana {n} combates contra líderes de gimnasio', reward: { coins: 400 } },
      { id: 'd-tower', ev: 'tower', goal: 3, name: 'Gana {n} combates en la Torre Batalla', reward: { coins: 400, items: { caramelo: 1 } } },
      { id: 'd-online', ev: 'online', goal: 2, name: 'Juega {n} combates online', reward: { coins: 400 } },
      { id: 'd-level', ev: 'level', goal: 5, name: 'Sube {n} niveles a tus Pokémon', reward: { coins: 300, items: { caramelo: 1 } } },
    ],
    weekly: [
      { id: 'w-wild', ev: 'wild', goal: 30, name: 'Vence a {n} Pokémon salvajes', reward: { coins: 1500, items: { ultraball: 3 } } },
      { id: 'w-catch', ev: 'catch', goal: 15, name: 'Atrapa {n} Pokémon', reward: { coins: 1500, items: { ultraball: 5 } } },
      { id: 'w-dex', ev: 'dex', goal: 5, name: 'Registra {n} especies nuevas en la Pokédex', reward: { coins: 2000, items: { caramelo: 2 } } },
      { id: 'w-win-type', ev: 'win', type: true, goal: 10, name: 'Gana {n} combates con un Pokémon de tipo {type} en tu equipo', reward: { coins: 1800 } },
      { id: 'w-gym', ev: 'gym', goal: 6, name: 'Gana {n} combates contra líderes de gimnasio', reward: { coins: 2000, items: { caramelo: 1 } } },
      { id: 'w-tower', ev: 'towerStreak', max: true, goal: 7, name: 'Consigue una racha de {n} en la Torre Batalla', reward: { coins: 2500, items: { caramelo: 2 } } },
      { id: 'w-ranked', ev: 'rankedWin', goal: 5, name: 'Gana {n} clasificatorias', reward: { coins: 2500, items: { caramelo: 2 } } },
      { id: 'w-evolve', ev: 'evolve', goal: 2, name: 'Haz evolucionar {n} Pokémon', reward: { coins: 1800, items: { caramelo: 1 } } },
      { id: 'w-level', ev: 'level', goal: 30, name: 'Sube {n} niveles a tus Pokémon', reward: { coins: 1800, items: { caramelo: 2 } } },
    ],
  };
  const MISSION_COUNT = 3;
  const MISSION_TYPES = ['normal', 'fuego', 'agua', 'planta', 'electrico', 'bicho', 'volador', 'veneno', 'tierra', 'roca', 'psiquico', 'lucha'];
  // Cambios gratis por día (diarias) y por semana (semanales); después cuestan dinero
  const MISSION_REROLLS = { daily: 2, weekly: 1 };
  const MISSION_REROLL_COST = { daily: 200, weekly: 1000 };
  const MISSION_CHEST = {
    daily: { coins: 500, items: { caramelo: 1, superball: 3 } },
    weekly: { coins: 4000, items: { caramelo: 4, ultraball: 5, maspsps: 1, proteina: 1 } },
  };
  const MISSION_BY_ID = Object.fromEntries([...MISSIONS.daily, ...MISSIONS.weekly].map(m => [m.id, m]));
  // Semana: la fecha (UTC) de su lunes, y cuándo empieza la siguiente
  const weekKey = (t = Date.now()) => { const d = new Date(t); return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (d.getUTCDay() + 6) % 7)); };
  const nextWeek = (t = Date.now()) => Date.parse(weekKey(t)) + 7 * 86400e3;

  // ---------- Maestría por línea evolutiva ----------
  // Cada combate ganado (historia, Torre, clasificatoria o rápida; la práctica no) suma una victoria a
  // la línea evolutiva de cada Pokémon de tu equipo: Charmander, Charmeleon y Charizard suman a la misma.
  // Premios por línea: estrella de bronce a 10, la ilustración oficial como avatar a 50, y a 100 el
  // marco animado de su tipo (el primero de la especie base: fuego para la línea de Charmander).
  const PRE = {};
  for (const s of Object.values(SPECIES)) for (const [to] of (!s.evo ? [] : Array.isArray(s.evo[0]) ? s.evo : [s.evo])) if (!PRE[to]) PRE[to] = s.dex;
  const lineOf = dex => { let d = dex, n = 0; while (PRE[d] && SPECIES[PRE[d]] && n++ < 4) d = PRE[d]; return d; };
  const lineMembers = root => Object.values(SPECIES).filter(s => lineOf(s.dex) === root).map(s => s.dex).sort((a, b) => a - b);
  const MASTERY = [10, 50, 100];
  const MASTERY_ART = 50, MASTERY_FRAME = 100;
  const masteryWins = (p, dex) => ((p.mastery || {})[lineOf(dex)] || 0);
  const masteryTier = wins => MASTERY.filter(n => wins >= n).length;
  const typeFrameOf = dex => 'tipo-' + SPECIES[lineOf(dex)].types[0];

  const api = { TYPE_NAMES, TYPE_LABEL, TYPE_COLOR, CHART, typeMult, MOVES, PROTECT, ENERGY, SWAP, SPECIES,
    levelMult, xpToNext, MAPS, ARENAS, ROUTES, GYMS, REGIONS, REGION_IDS, NODES, leadersOf, progOf, leaderTeam, leaderExtras, REGION_STARTERS, STARTERS, SHOP, catchChance, routeWild, rollWild, dayKey, nextDay, shopMons, RARE_PERFECT, PERFECT_IVS, KIT, STONE_IDS, learnset, learnedAt, defaultMoves, levelCap, EV_MAX, EV_TOTAL, EV_VIT, IV_MAX, evTotal, VIT_STATS, STAT_KEYS, NATURES, NATURE_IDS, STAT6, randomNature, randomIv, natureMult, SHINY_RATE, looksShiny, sellPrice, RANKED_POOL, RANKED_LEVEL, LEAGUES, leagueOf, SEASON, RANKED_REWARDS, SEASON_REWARDS, ACHIEVEMENTS, achievementProgress, SHOWCASE_MAX, lineOf, lineMembers, MASTERY, MASTERY_ART, MASTERY_FRAME, masteryWins, masteryTier, typeFrameOf, seasonTitle, RANKED_PAY,
    achievementAvatar, badgeAvatar, avatarIds, MISSIONS, MISSION_COUNT, MISSION_TYPES, MISSION_REROLLS, MISSION_REROLL_COST, MISSION_CHEST, MISSION_BY_ID, weekKey, nextWeek };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Data = api;
})(this);
