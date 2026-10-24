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
Si usas Cloudflare, deja el registro en "solo DNS" (nube gris) hasta que Caddy haya sacado el certificado.

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
