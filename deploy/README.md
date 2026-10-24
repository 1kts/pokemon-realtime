# Servidor de Hetzner

Un servidor Ubuntu 24.04 con Node 24 (el juego, en el puerto 3000, como el usuario `arena`) y Caddy delante
(HTTPS con Let's Encrypt y WebSocket). GitHub Actions despliega cada push a `main` por SSH como el usuario
`deploy`. Todo se ha probado en un Ubuntu 24.04 con systemd: preparación, despliegue, despliegue con un
combate en curso (espera a que acabe y el corte es de ~50 ms), copia de seguridad y vuelta atrás.

| Qué | Dónde |
|---|---|
| Versiones desplegadas (se quedan las 3 últimas) | `/srv/arena/releases/<commit>` |
| La que está en marcha | `/srv/arena/current` → una de las anteriores |
| Base de datos (SQLite) | `/var/lib/arena/arena.db` |
| Copias diarias (04:30 UTC, 14 días) | `/var/backups/arena/arena-AAAA-MM-DD.db` |
| Servicios | `arena`, `arena-backup.timer`, `caddy` |
| Admins del panel | `arena-admin alta\|baja\|lista` |

## Puesta en marcha (una vez)

1. **Crear el servidor** en [Hetzner Cloud](https://console.hetzner.cloud): Ubuntu 24.04, el tipo compartido
   más pequeño de 2 vCPU y 4 GB, en Núremberg o Falkenstein (buen ping desde España). Añade tu clave SSH
   pública al crearlo. Activa **Backups** (copia diaria de todo el servidor fuera de él, unos 20 % más).
2. **Clave para GitHub Actions**, en tu PC:
   ```bash
   ssh-keygen -t ed25519 -f arena-deploy -N "" -C github-actions
   ```
3. **Preparar el servidor** (cambia `IP` por la del servidor):
   ```bash
   scp -r deploy root@IP:/root/arena-deploy
   ssh root@IP "DEPLOY_KEY='$(cat arena-deploy.pub)' bash /root/arena-deploy/setup.sh"
   ```
   Sin dominio, el juego queda en `https://IP-con-guiones.sslip.io` (p. ej. `https://49-12-1-2.sslip.io`).
4. **Secretos en GitHub** (repositorio → Settings → Secrets and variables → Actions → New repository secret):
   - `DEPLOY_HOST`: la IP del servidor.
   - `DEPLOY_SSH_KEY`: el contenido de `arena-deploy` (la privada, sin `.pub`).
   - `DEPLOY_KNOWN_HOSTS`: la salida de `ssh-keyscan -t ed25519 IP`.

   Después borra `arena-deploy` de tu PC (o guárdala en un gestor de contraseñas).
5. **Publicar**: fusiona `develop` en `main` y haz push. En la pestaña *Actions* se ve cómo pasan las pruebas y
   se despliega.

## Dominio

Cómpralo (por ejemplo en Cloudflare), crea un registro **A** con la IP del servidor y vuelve a ejecutar la
preparación con el dominio:
```bash
ssh root@IP "bash /root/arena-deploy/setup.sh tudominio.com"
```
`www.` y la dirección provisional `<ip>.sslip.io` pasan a redirigir al dominio. El dominio queda guardado en
`/etc/arena-domain`, así que volver a ejecutar `setup.sh` sin él no lo cambia.

Con Cloudflare, los registros tienen que ir en **"solo DNS" (nube gris)**: con el proxy (nube naranja) el
servidor vería las IPs de Cloudflare en vez de las de los jugadores, y los límites por IP y la auditoría
dejarían de servir.

## Panel de administración

En `https://<dominio>/admin`. Para entrar hacen falta tres cosas: una cuenta registrada del juego, que esa
cuenta esté dada de alta como admin (solo desde el servidor: desde la web no hay forma) y el código de 6 cifras
de una app de autenticación (Google Authenticator, Authy, 1Password…).

1. Regístrate en el juego con usuario y contraseña (si aún no lo estás).
2. En **tu terminal** (la clave que sale es secreta: no la pegues en ningún chat):
   ```bash
   ssh root@IP arena-admin alta <tu-usuario>
   ```
3. En la app del móvil: añadir código → introducir clave → pega la clave que ha salido.
4. Entra en `/admin` con usuario, contraseña y el código de la app.

Otras órdenes: `arena-admin lista`, `arena-admin baja <usuario>`. Si pierdes el móvil, vuelve a ejecutar `alta`
(da una clave nueva y la vieja deja de valer). La sesión caduca a los 30 min sin usarla (o a las 12 h).

Qué hay en el panel:
- **Resumen** (se actualiza solo): conectados y qué hacen, combates por modo, colas, perfiles y cuentas,
  altas de hoy, suspendidos, memoria, carga, tamaño de la base de datos y eventos de las últimas 24 h.
- **Jugadores**: buscar por nombre, usuario o id; ficha con sus datos, IPs, otros perfiles desde las mismas
  IPs e historial. Suspender (con motivo y duración), levantar la suspensión, desconectar, renombrar y
  resetear la contraseña (la nueva se ve una sola vez).
- **Auditoría**: todo lo que pasa (entradas y fallos de contraseña, registros, cambios de nombre, tienda,
  clasificatoria, premios, límites, arranques y paradas, y cada acción de un admin), con filtros por tipo,
  jugador, IP y fechas, y exportación a CSV. Se guarda 40 días; las acciones de los admins, siempre.
- **Servidor**: anuncio a todos los conectados y modo mantenimiento (no se empiezan combates nuevos).

## Día a día

```bash
ssh root@IP
journalctl -u arena -f                       # registros del juego en directo
systemctl status arena                       # estado
curl -s localhost:3000/healthz               # versión y jugadores conectados
```

**Volver a la versión anterior** (espera a los combates en curso, como un despliegue):
```bash
ls -t /srv/arena/releases                    # la primera es la actual
ln -sfn /srv/arena/releases/<commit> /srv/arena/current && systemctl restart arena
```

**Restaurar una copia de la base de datos:**
```bash
systemctl stop arena
cp /var/backups/arena/arena-AAAA-MM-DD.db /var/lib/arena/arena.db && rm -f /var/lib/arena/arena.db-wal /var/lib/arena/arena.db-shm
chown arena:arena /var/lib/arena/arena.db && systemctl start arena
```

**Bajarte una copia a tu PC:** `scp root@IP:/var/backups/arena/arena-AAAA-MM-DD.db .`
