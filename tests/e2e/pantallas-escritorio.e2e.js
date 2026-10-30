// Todas las pantallas en escritorio (1280×800): nada se sale de ancho, ningún botón está tapado, la barra legal no
// pisa nada y sin problemas de accesibilidad graves (ver barrido.js; un tamaño por prueba y, en escritorio, las
// ventanas aparte, en pantallas-escritorio-ventanas: juntas pasaban de los 5 minutos que tiene cada una en el CI)
module.exports = require('./barrido.js')([[1280, 800, false]], 'pantallas');
