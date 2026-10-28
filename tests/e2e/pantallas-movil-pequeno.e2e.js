// Todas las pantallas y ventanas en un móvil pequeño en horizontal (667×375, con pantalla táctil): nada se sale de ancho, ningún botón está tapado, la barra legal no
// pisa nada y sin problemas de accesibilidad graves (ver barrido.js; un tamaño por prueba, que juntos pasaban de los
// 5 minutos que tiene cada una en el CI)
module.exports = require('./barrido.js')([[667, 375, true]]);
