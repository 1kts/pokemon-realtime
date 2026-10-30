// Las pantallas en escritorio (1280×800), la segunda mitad: lo mismo que pantallas-escritorio (ver barrido.js)
const barrido = require('./barrido.js');
module.exports = barrido([[1280, 800, false]], barrido.VIEWS.slice(8));
