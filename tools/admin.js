// Dar de alta y de baja administradores. Solo desde el servidor (por SSH): desde la web no hay
// forma de hacerse admin. En producción: arena-admin <orden> (ver deploy/README.md).
//   node tools/admin.js alta <usuario> [nota]   admin nuevo (o 2FA nuevo si ya lo era)
//   node tools/admin.js baja <usuario>
//   node tools/admin.js lista
// La cuenta tiene que existir y estar registrada (usuario y contraseña) en el juego.
process.removeAllListeners('warning');   // sin el aviso de SQLite experimental
const admin = require('../server/admin.js');

const [cmd, user, ...note] = process.argv.slice(2);
try {
  if (cmd === 'alta' && user) {
    const { p, secret, uri } = admin.grant(user, note.join(' '));
    console.log(`\n${p.account.user} (${p.name}) ya es admin. Ahora, en el móvil:\n`);
    console.log('  1. Abre Google Authenticator (o Authy, Microsoft Authenticator, 1Password…)');
    console.log('  2. Añadir código → "Introducir clave de configuración"');
    console.log(`  3. Nombre: PokéArenas · Clave: ${secret.match(/.{1,4}/g).join(' ')} · Basado en el tiempo\n`);
    console.log(`  (O, si tu app lo admite, este enlace: ${uri})\n`);
    console.log('Luego entra en /admin con tu usuario, tu contraseña y el código de 6 cifras de la app.');
    console.log('Guarda la clave en un sitio seguro: si pierdes el móvil, vuelve a ejecutar "alta" para tener otra.\n');
  } else if (cmd === 'baja' && user) {
    const p = admin.revoke(user);
    console.log(`${p.account.user} (${p.name}) ya no es admin.`);
  } else if (cmd === 'lista') {
    const rows = admin.list();
    if (!rows.length) console.log('No hay admins.');
    for (const r of rows) console.log(`${r.user.padEnd(24)} ${r.name.padEnd(16)} desde ${new Date(r.created).toLocaleString('es-ES')}${r.note ? '  · ' + r.note : ''}`);
  } else {
    console.log('Uso: admin.js alta <usuario> [nota] | baja <usuario> | lista');
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
