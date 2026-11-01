// Las mecánicas extra de Práctica (gravedad, tormenta) encima de una arena normal, como mecanicas.e2e.js (juntas
// rozaban los 5 minutos en el CI)
module.exports = require('./mecanicas.e2e.js').prueba([['lago', 'gravity', 'gravity'], ['pradera', 'storm', 'storm']]);
