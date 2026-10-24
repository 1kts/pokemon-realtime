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
  // kind: proj (proyectil) · beam (rayo instantáneo en línea) · melee (golpe en arco delante)
  //       dash (embestida) · area (zona con retardo, en el cursor o en uno mismo)
  //       blink (teletransporte) · heal · buff · smoke (nube de vapor que oculta)
  //       wall (muro que bloquea) · ball (Poké Ball, la añade el servidor)
  // cost energía · cd recarga (s) · wind preparación (s, se ve venir) · rec recuperación (s, vulnerable)
  // Estados: burn quema, poison veneno, wet mojado, slow ralentiza, stun aturde (s).
  // terrain: deja fuego/agua en el suelo. knock: empuje. pull: atrae. drain: cura % del daño.
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
    bofetonLodo: { name: 'Bofetón Lodo', type: 'tierra', kind: 'proj', cost: 0, cd: 0.55, wind: 0.08, rec: 0.12, dmg: 7, speed: 560, range: 440, radius: 8, slow: 0.6 },
    furiaDragon: { name: 'Furia Dragón', type: 'dragon', kind: 'proj', cost: 0, cd: 0.5, wind: 0.1, rec: 0.1, dmg: 8, speed: 600, range: 500, radius: 9 },
    nievePolvo: { name: 'Nieve Polvo', type: 'hielo', kind: 'proj', cost: 0, cd: 0.6, wind: 0.08, rec: 0.12, dmg: 5, speed: 520, range: 440, radius: 7, count: 2, spread: 0.15, slow: 0.8 },
    acido: { name: 'Ácido', type: 'veneno', kind: 'proj', cost: 0, cd: 0.55, wind: 0.08, rec: 0.1, dmg: 5, speed: 560, range: 460, radius: 8, poison: 2 },
    tijeraX: { name: 'Tijera X', type: 'bicho', kind: 'melee', cost: 0, cd: 0.45, wind: 0.08, rec: 0.1, dmg: 11, range: 66, arc: 1.8 },
    mordisco: { name: 'Mordisco', type: 'siniestro', kind: 'melee', cost: 0, cd: 0.5, wind: 0.1, rec: 0.12, dmg: 12, range: 70, arc: 1.4 },
    salpicadura: { name: 'Salpicadura', type: 'normal', kind: 'buff', cost: 0, cd: 1, wind: 0.2, rec: 0.3, dur: 0.1, splash: true },

    // Habilidades
    lanzallamas: { name: 'Lanzallamas', type: 'fuego', kind: 'proj', cost: 30, cd: 4, wind: 0.35, rec: 0.2, dmg: 18, speed: 400, range: 600, radius: 16, burn: 3, terrain: 'fuego' },
    llamarada: { name: 'Llamarada', type: 'fuego', kind: 'area', at: 'cursor', cost: 50, cd: 10, wind: 0.3, rec: 0.3, dmg: 26, radius: 95, delay: 0.65, maxRange: 480, burn: 3, terrain: 'fuego' },
    nitrocarga: { name: 'Nitrocarga', type: 'fuego', kind: 'dash', cost: 20, cd: 5, wind: 0.12, rec: 0.15, dmg: 14, dist: 260, dur: 0.22, haste: 2 },
    punoFuego: { name: 'Puño Fuego', type: 'fuego', kind: 'melee', cost: 20, cd: 4, wind: 0.25, rec: 0.2, dmg: 18, range: 70, arc: 1.4, burn: 3 },
    hidrobomba: { name: 'Hidrobomba', type: 'agua', kind: 'beam', cost: 40, cd: 6, wind: 0.55, rec: 0.3, dmg: 22, len: 540, width: 26, knock: 130, terrain: 'agua' },
    surf: { name: 'Surf', type: 'agua', kind: 'area', at: 'self', cost: 45, cd: 9, wind: 0.2, rec: 0.3, dmg: 20, radius: 150, delay: 0.5, knock: 150, terrain: 'agua', wet: 4 },
    acuaJet: { name: 'Acua Jet', type: 'agua', kind: 'dash', cost: 15, cd: 4, wind: 0.06, rec: 0.12, dmg: 10, dist: 220, dur: 0.15 },
    acuaAro: { name: 'Acua Aro', type: 'agua', kind: 'heal', cost: 35, cd: 12, wind: 0.3, rec: 0.2, heal: 0.2 },
    latigoCepa: { name: 'Látigo Cepa', type: 'planta', kind: 'proj', cost: 20, cd: 3.5, wind: 0.2, rec: 0.2, dmg: 14, speed: 850, range: 230, radius: 14, pull: 110, fx: 'vine' },
    drenadoras: { name: 'Drenadoras', type: 'planta', kind: 'proj', cost: 25, cd: 7, wind: 0.2, rec: 0.15, dmg: 5, speed: 460, range: 560, radius: 11, slow: 2, drain: 1.5, fx: 'seed' },
    rayoSolar: { name: 'Rayo Solar', type: 'planta', kind: 'beam', cost: 55, cd: 11, wind: 0.9, rec: 0.35, dmg: 32, len: 580, width: 32 },
    sintesis: { name: 'Síntesis', type: 'planta', kind: 'heal', cost: 35, cd: 12, wind: 0.35, rec: 0.2, heal: 0.22 },
    rayo: { name: 'Rayo', type: 'electrico', kind: 'beam', cost: 35, cd: 5, wind: 0.45, rec: 0.25, dmg: 18, len: 480, width: 18, stun: 0.4 },
    trueno: { name: 'Trueno', type: 'electrico', kind: 'area', at: 'cursor', cost: 50, cd: 9, wind: 0.25, rec: 0.3, dmg: 24, radius: 85, delay: 0.7, maxRange: 460, stun: 0.6 },
    ondaTrueno: { name: 'Onda Trueno', type: 'electrico', kind: 'proj', cost: 30, cd: 10, wind: 0.2, rec: 0.2, dmg: 2, speed: 520, range: 500, radius: 10, stun: 1.1 },
    rayoHielo: { name: 'Rayo Hielo', type: 'hielo', kind: 'beam', cost: 35, cd: 6, wind: 0.45, rec: 0.25, dmg: 17, len: 470, width: 20, slow: 2 },
    ventisca: { name: 'Ventisca', type: 'hielo', kind: 'area', at: 'cursor', cost: 55, cd: 10, wind: 0.3, rec: 0.3, dmg: 22, radius: 115, delay: 0.8, maxRange: 460, slow: 2.5 },
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
    avalancha: { name: 'Avalancha', type: 'roca', kind: 'area', at: 'cursor', cost: 45, cd: 9, wind: 0.3, rec: 0.3, dmg: 22, radius: 90, delay: 0.6, maxRange: 440, stun: 0.5 },
    golpeAereo: { name: 'Golpe Aéreo', type: 'volador', kind: 'dash', cost: 20, cd: 5, wind: 0.1, rec: 0.15, dmg: 14, dist: 270, dur: 0.2 },
    vendaval: { name: 'Vendaval', type: 'volador', kind: 'area', at: 'cursor', cost: 50, cd: 9, wind: 0.3, rec: 0.3, dmg: 22, radius: 100, delay: 0.6, maxRange: 460, knock: 170 },
    ataqueRapido: { name: 'Ataque Rápido', type: 'normal', kind: 'dash', cost: 15, cd: 4, wind: 0.04, rec: 0.1, dmg: 8, dist: 210, dur: 0.14 },
    golpeCuerpo: { name: 'Golpe Cuerpo', type: 'normal', kind: 'dash', cost: 25, cd: 6, wind: 0.2, rec: 0.2, dmg: 18, dist: 190, dur: 0.25, stun: 0.35 },
    hiperrayo: { name: 'Hiperrayo', type: 'normal', kind: 'beam', cost: 65, cd: 14, wind: 0.8, rec: 1.1, dmg: 38, len: 600, width: 32 },
    descanso: { name: 'Descanso', type: 'psiquico', kind: 'heal', cost: 30, cd: 18, wind: 0.2, rec: 2, heal: 0.5 },
    autodestruccion: { name: 'Autodestrucción', type: 'normal', kind: 'area', at: 'self', cost: 60, cd: 30, wind: 0.6, rec: 0.1, dmg: 48, radius: 150, delay: 0.25, selfKO: true },
    patadaBaja: { name: 'Patada Baja', type: 'lucha', kind: 'melee', cost: 25, cd: 5, wind: 0.25, rec: 0.2, dmg: 17, range: 72, arc: 1.6, stun: 0.45 },
    punoDinamico: { name: 'Puño Dinámico', type: 'lucha', kind: 'melee', cost: 45, cd: 9, wind: 0.5, rec: 0.3, dmg: 28, range: 78, arc: 1.3, stun: 0.9, knock: 120 },
    bombaLodo: { name: 'Bomba Lodo', type: 'veneno', kind: 'proj', cost: 30, cd: 4, wind: 0.3, rec: 0.2, dmg: 16, speed: 460, range: 520, radius: 13, poison: 4 },
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
    vientoFeerico: { name: 'Viento Feérico', type: 'hada', kind: 'proj', cost: 0, cd: 0.5, wind: 0.08, rec: 0.1, dmg: 7, speed: 560, range: 480, radius: 9 },
    brilloMagico: { name: 'Brillo Mágico', type: 'hada', kind: 'area', at: 'self', cost: 35, cd: 7, wind: 0.25, rec: 0.25, dmg: 18, radius: 130, delay: 0.45 },
    fuerzaLunar: { name: 'Fuerza Lunar', type: 'hada', kind: 'proj', cost: 45, cd: 9, wind: 0.45, rec: 0.25, dmg: 26, speed: 420, range: 560, radius: 15 },
    luzLunar: { name: 'Luz Lunar', type: 'hada', kind: 'heal', cost: 35, cd: 12, wind: 0.35, rec: 0.2, heal: 0.22 },
    disparoDemora: { name: 'Disparo Demora', type: 'bicho', kind: 'proj', cost: 0, cd: 0.55, wind: 0.08, rec: 0.1, dmg: 5, speed: 520, range: 440, radius: 8, slow: 0.6 },
    zumbido: { name: 'Zumbido', type: 'bicho', kind: 'beam', cost: 30, cd: 5, wind: 0.4, rec: 0.2, dmg: 17, len: 440, width: 22 },
    idaYVuelta: { name: 'Ida y Vuelta', type: 'bicho', kind: 'dash', cost: 15, cd: 4, wind: 0.05, rec: 0.1, dmg: 10, dist: 220, dur: 0.15 },
    megacuerno: { name: 'Megacuerno', type: 'bicho', kind: 'melee', cost: 45, cd: 9, wind: 0.45, rec: 0.3, dmg: 30, range: 74, arc: 1.3, knock: 100 },
    infortunio: { name: 'Infortunio', type: 'fantasma', kind: 'area', at: 'cursor', cost: 45, cd: 9, wind: 0.25, rec: 0.3, dmg: 24, radius: 85, delay: 0.6, maxRange: 480, slow: 1.5 },
    pulsoDragon: { name: 'Pulso Dragón', type: 'dragon', kind: 'proj', cost: 30, cd: 4, wind: 0.3, rec: 0.2, dmg: 18, speed: 480, range: 540, radius: 14 },
    cometaDraco: { name: 'Cometa Draco', type: 'dragon', kind: 'area', at: 'cursor', cost: 60, cd: 12, wind: 0.35, rec: 0.35, dmg: 32, radius: 105, delay: 0.8, maxRange: 480 },
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
    if (SPECIES[dex]) { Object.assign(SPECIES[dex], { gen, leg, rate, bst, name }); continue; }
    SPECIES[dex] = {
      dex, name, types, gen, leg, rate, bst,
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

  // ---------- Modo historia ----------
  // Rutas temáticas: cada día salen 5 especies (de cualquier generación) de sus tipos y con
  // fuerza (suma de stats base) acorde a la ruta, iguales para todos los jugadores.
  // Además hay un Pokémon misterioso (legendario o muy fuerte) con una probabilidad pequeña.
  // req = medallas necesarias.
  const ROUTES = [
    { id: 'ruta1', name: 'Ruta 1', req: 0, map: 'pradera', ai: 0.02, types: ['normal', 'volador', 'bicho'], lvl: [2, 5], bst: [180, 330], rare: 0.02, x: 8, y: 86 },
    { id: 'bosque', name: 'Bosque Verde', req: 0, map: 'bosque', ai: 0.03, types: ['bicho', 'planta', 'electrico'], lvl: [4, 8], bst: [190, 360], rare: 0.02, x: 18, y: 70 },
    { id: 'montemoon', name: 'Monte Moon', req: 1, map: 'cueva', ai: 0.05, types: ['roca', 'tierra', 'hada', 'veneno'], lvl: [8, 12], bst: [200, 380], rare: 0.025, x: 40, y: 66 },
    { id: 'ruta24', name: 'Puente Pepita', req: 2, map: 'lago', ai: 0.07, types: ['agua', 'psiquico', 'planta', 'hada'], lvl: [12, 16], bst: [220, 400], rare: 0.025, x: 62, y: 62 },
    { id: 'tunelroca', name: 'Túnel Roca', req: 3, map: 'cueva', ai: 0.09, types: ['roca', 'electrico', 'lucha', 'acero'], lvl: [17, 21], bst: [240, 420], rare: 0.03, x: 88, y: 62 },
    { id: 'torre', name: 'Torre Pokémon', req: 4, map: 'cueva', ai: 0.11, types: ['fantasma', 'veneno', 'siniestro', 'psiquico'], lvl: [21, 26], bst: [250, 440], rare: 0.03, x: 68, y: 38 },
    { id: 'safari', name: 'Zona Safari', req: 5, map: 'bosque', ai: 0.14, types: ['normal', 'planta', 'bicho', 'tierra', 'dragon'], lvl: [26, 31], bst: [270, 470], rare: 0.035, x: 44, y: 38 },
    { id: 'islas', name: 'Islas Espuma', req: 6, map: 'lago', ai: 0.17, types: ['agua', 'hielo'], lvl: [30, 35], bst: [290, 490], rare: 0.035, x: 20, y: 40 },
    { id: 'victoria', name: 'Calle Victoria', req: 8, map: 'cueva', ai: 0.22, types: ['lucha', 'roca', 'acero', 'dragon', 'siniestro'], lvl: [38, 44], bst: [330, 530], rare: 0.04, x: 32, y: 24 },
  ];
  const WILD_WEIGHTS = [30, 25, 20, 15, 10];

  // Generador con semilla: la misma ruta y el mismo día dan las mismas especies en servidor y cliente
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
  const routeCache = new Map();
  // Las 5 especies del día y el misterioso de una ruta
  function routeWild(route, day = dayKey()) {
    const key = route.id + day;
    if (routeCache.has(key)) return routeCache.get(key);
    const r = seeded(key);
    const fits = sp => sp.types.some(t => route.types.includes(t));
    const all = Object.values(SPECIES);
    let cands = all.filter(sp => !sp.leg && fits(sp) && sp.bst >= route.bst[0] && sp.bst <= route.bst[1]);
    const picks = [];
    while (picks.length < 5 && cands.length) {
      const i = Math.floor(r() * cands.length);
      const sp = cands.splice(i, 1)[0];
      if (picks.some(p => p.types[0] === sp.types[0]) && cands.some(c => !picks.some(p => p.types[0] === c.types[0])) && r() < 0.6) { cands.push(sp); continue; }
      picks.push(sp);
    }
    picks.sort((a, b) => a.bst - b.bst);   // los más fuertes, más raros
    const rarePool = all.filter(sp => (sp.leg || sp.bst >= 580) && fits(sp));
    const pool = rarePool.length ? rarePool : all.filter(sp => sp.leg);
    const rare = pool[Math.floor(r() * pool.length)];
    const out = { day, list: picks.map((sp, i) => ({ dex: sp.dex, weight: WILD_WEIGHTS[i] })), rare: { dex: rare.dex, chance: route.rare } };
    routeCache.set(key, out);
    if (routeCache.size > 200) routeCache.delete(routeCache.keys().next().value);
    return out;
  }
  // Un encuentro: misterioso con su probabilidad; si no, una de las 5 por peso
  function rollWild(route, rand = Math.random, day = dayKey()) {
    const w = routeWild(route, day);
    const [lo, hi] = route.lvl;
    if (rand() < w.rare.chance) return { dex: w.rare.dex, level: hi + 3, rare: true };
    const total = w.list.reduce((a, x) => a + x.weight, 0);
    let x = rand() * total;
    for (const e of w.list) if ((x -= e.weight) <= 0) return { dex: e.dex, level: lo + Math.floor(rand() * (hi - lo + 1)) };
    return { dex: w.list[0].dex, level: lo };
  }
  // Gimnasios en orden; la Liga va después de las 8 medallas. ai = habilidad de la IA (0-1).
  const GYMS = [
    { id: 'plateada', name: 'Gimnasio Plateada', leader: 'Brock', type: 'roca', map: 'cueva', ai: 0.2, reward: 600, team: [[74, 12], [95, 14]], x: 30, y: 82 },
    { id: 'celeste', name: 'Gimnasio Celeste', leader: 'Misty', type: 'agua', map: 'lago', ai: 0.28, reward: 900, team: [[120, 18], [54, 18], [121, 21]], x: 52, y: 78 },
    { id: 'carmin', name: 'Gimnasio Carmín', leader: 'Lt. Surge', type: 'electrico', map: 'pradera', ai: 0.35, reward: 1200, team: [[100, 21], [25, 22], [26, 24]], x: 74, y: 74 },
    { id: 'azulona', name: 'Gimnasio Azulona', leader: 'Erika', type: 'planta', map: 'bosque', ai: 0.42, reward: 1500, team: [[71, 29], [114, 27], [45, 29]], x: 80, y: 46 },
    { id: 'fucsia', name: 'Gimnasio Fucsia', leader: 'Koga', type: 'veneno', map: 'cueva', ai: 0.48, reward: 1800, team: [[109, 37], [89, 39], [110, 43]], x: 56, y: 48 },
    { id: 'azafran', name: 'Gimnasio Azafrán', leader: 'Sabrina', type: 'psiquico', map: 'pradera', ai: 0.55, reward: 2100, team: [[64, 38], [122, 37], [65, 43]], x: 32, y: 48 },
    { id: 'canela', name: 'Gimnasio Canela', leader: 'Blaine', type: 'fuego', map: 'pradera', ai: 0.6, reward: 2400, team: [[78, 42], [126, 44], [59, 47]], x: 9, y: 28 },
    { id: 'verde', name: 'Gimnasio Verde', leader: 'Giovanni', type: 'tierra', map: 'cueva', ai: 0.66, reward: 3000, team: [[51, 45], [34, 47], [112, 50]], x: 20, y: 16 },
    { id: 'lorelei', name: 'Alto Mando', leader: 'Lorelei', type: 'hielo', map: 'lago', ai: 0.7, reward: 3500, team: [[124, 52], [131, 54], [130, 53]], x: 46, y: 14, elite: true },
    { id: 'bruno', name: 'Alto Mando', leader: 'Bruno', type: 'lucha', map: 'cueva', ai: 0.74, reward: 3500, team: [[95, 53], [68, 56], [76, 55]], x: 58, y: 22, elite: true },
    { id: 'agatha', name: 'Alto Mando', leader: 'Agatha', type: 'fantasma', map: 'cueva', ai: 0.78, reward: 3500, team: [[93, 54], [94, 58], [110, 55]], x: 70, y: 13, elite: true },
    { id: 'lance', name: 'Alto Mando', leader: 'Lance', type: 'dragon', map: 'lago', ai: 0.82, reward: 4000, team: [[130, 58], [148, 56], [149, 62]], x: 82, y: 22, elite: true },
    { id: 'campeon', name: 'Campeón', leader: 'Azul', type: 'normal', map: 'pradera', ai: 0.88, reward: 8000, team: [[18, 61], [65, 63], [6, 65]], x: 92, y: 10, elite: true },
  ];
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
  // Tienda: Poké Balls (multiplican la probabilidad de captura), piedras evolutivas,
  // Caramelo Raro y Pokémon raros a la venta.
  const SHOP = [
    { id: 'pokeball', name: 'Poké Ball', price: 100, ball: 1, desc: 'La de siempre. Mejor con el salvaje debilitado' },
    { id: 'superball', name: 'Super Ball', price: 350, ball: 1.5, desc: 'Captura con más facilidad que la Poké Ball', req: 2 },
    { id: 'ultraball', name: 'Ultra Ball', price: 900, ball: 2.2, desc: 'Muy eficaz: casi siempre atrapa a un salvaje tocado', req: 5 },
    { id: 'caramelo', name: 'Caramelo Raro', price: 1200, desc: 'Sube un nivel a un Pokémon', req: 1 },
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
    { id: 'poke133', name: 'Eevee', price: 3000, dex: 133, level: 20, desc: 'Pokémon de la tienda (nivel 20)', req: 2 },
    { id: 'poke143', name: 'Snorlax', price: 7000, dex: 143, level: 30, desc: 'Pokémon de la tienda (nivel 30)', req: 4 },
    { id: 'poke131', name: 'Lapras', price: 9000, dex: 131, level: 32, desc: 'Pokémon de la tienda (nivel 32)', req: 5 },
    { id: 'poke147', name: 'Dratini', price: 6000, dex: 147, level: 25, desc: 'Pokémon de la tienda (nivel 25)', req: 6 },
  ];

  // ---------- Clasificatoria ----------
  // Todos a nivel 50; draft con 1 veto y 3 elecciones por jugador.
  const RANKED_POOL = [3, 6, 9, 18, 26, 34, 38, 59, 65, 68, 76, 94, 112, 121, 123, 130, 131, 135, 143, 149];
  const RANKED_LEVEL = 50;
  const LEAGUES = [[0, 'Bronce'], [1100, 'Plata'], [1250, 'Oro'], [1400, 'Platino'], [1550, 'Diamante'], [1700, 'Maestro']];
  const leagueOf = elo => LEAGUES.filter(l => elo >= l[0]).pop()[1];

  const api = { TYPE_NAMES, TYPE_LABEL, TYPE_COLOR, CHART, typeMult, MOVES, PROTECT, ENERGY, SWAP, SPECIES,
    levelMult, xpToNext, MAPS, ROUTES, GYMS, STARTERS, SHOP, catchChance, routeWild, rollWild, dayKey, KIT, STONE_IDS, RANKED_POOL, RANKED_LEVEL, LEAGUES, leagueOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Data = api;
})(this);
