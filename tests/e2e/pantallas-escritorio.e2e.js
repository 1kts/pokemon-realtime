// Las pantallas en escritorio (1280×800), la primera mitad: nada se sale de ancho, ningún botón está tapado, la barra
// legal no pisa nada y sin problemas de accesibilidad graves (ver barrido.js). Un tamaño por prueba y, en escritorio,
// partido en tres (la otra mitad en pantallas-escritorio-2 y las ventanas en pantallas-escritorio-ventanas): juntas
// pasaban de los 5 minutos que tiene cada prueba en el CI
const barrido = require('./barrido.js');
module.exports = barrido([[1280, 800, false]], barrido.VIEWS.slice(0, 8));
