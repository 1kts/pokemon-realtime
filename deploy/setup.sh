#!/usr/bin/env bash
# Prepara un servidor Ubuntu 24.04 recién creado (Hetzner Cloud) para Arena Pokémon. Se ejecuta
# como root desde una copia de esta carpeta, y se puede repetir (por ejemplo, para poner el dominio):
#   DEPLOY_KEY="ssh-ed25519 AAAA… github-actions" bash setup.sh [dominio]
# Sin dominio usa <ip>.sslip.io, que ya tiene HTTPS mientras no haya dominio propio. El dominio se
# recuerda (/etc/arena-domain): repetir setup.sh sin él no vuelve a la dirección provisional.
# Ver deploy/README.md.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
IP=$(hostname -I | awk '{print $1}')
SSLIP=$(echo "$IP" | tr . -).sslip.io
[ -n "${1:-}" ] && echo "$1" > /etc/arena-domain
DOMAIN=$(cat /etc/arena-domain 2>/dev/null || echo "$SSLIP")

echo "== Paquetes"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq curl gnupg rsync sqlite3 ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -yq nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi

echo "== Usuarios y carpetas"
# arena: ejecuta el servidor (sin login). deploy: entra GitHub Actions por SSH para desplegar.
id arena >/dev/null 2>&1 || useradd --system --home-dir /var/lib/arena --shell /usr/sbin/nologin arena
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG systemd-journal deploy
install -d -o deploy -g deploy /srv/arena /srv/arena/releases
install -d -o arena -g arena -m 750 /var/lib/arena /var/backups/arena
if [ -n "${DEPLOY_KEY:-}" ]; then
  install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
  touch /home/deploy/.ssh/authorized_keys
  grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_KEY" >> /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
fi
# deploy solo puede parar y arrancar el servicio
cat > /etc/sudoers.d/arena-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl stop arena, /usr/bin/systemctl start arena, /usr/bin/systemctl restart arena
EOF
chmod 440 /etc/sudoers.d/arena-deploy
visudo -cf /etc/sudoers.d/arena-deploy

echo "== Servicios"
install -m 644 "$HERE/arena.service" "$HERE/arena-backup.service" "$HERE/arena-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable arena            # arranca con el primer despliegue
systemctl enable --now arena-backup.timer
# arena-admin alta|baja|lista: administradores del panel (como el usuario arena, con su base de datos)
printf '%s\n' '#!/bin/sh' 'exec sudo -u arena DB_FILE=/var/lib/arena/arena.db /usr/bin/node /srv/arena/current/tools/admin.js "$@"' > /usr/local/bin/arena-admin
chmod 755 /usr/local/bin/arena-admin
{
  sed "s/^DOMINIO /$DOMAIN /" "$HERE/Caddyfile"
  # Con dominio propio, www y la dirección provisional llevan al dominio (con la misma ruta)
  if [ "$DOMAIN" != "$SSLIP" ]; then
    printf '\nwww.%s, %s {\n\tredir https://%s{uri} permanent\n}\n' "$DOMAIN" "$SSLIP" "$DOMAIN"
  fi
} > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload-or-restart caddy

echo "== SSH"
# Solo con clave: sin contraseñas no hay fuerza bruta posible. Solo si root ya tiene una clave
# autorizada, para no dejar a nadie fuera. 00- para que gane a lo que ponga cloud-init en 50-.
if [ -s /root/.ssh/authorized_keys ]; then
  printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitRootLogin prohibit-password' > /etc/ssh/sshd_config.d/00-arena.conf
  sshd -t && systemctl reload ssh
else
  echo "AVISO: root no tiene clave SSH; se deja el acceso con contraseña. Añade tu clave y repite." >&2
fi

echo "== Cortafuegos"
ufw allow 22/tcp   # SSH (si lo cambias de puerto, ábrelo antes de ejecutar esto)
ufw allow 80/tcp
ufw allow 443
ufw --force enable

echo
echo "Listo. El juego se verá en https://$DOMAIN tras el primer despliegue."
echo "Para GitHub Actions: DEPLOY_HOST=$IP  y  DEPLOY_KNOWN_HOSTS = salida de: ssh-keyscan -t ed25519 $IP"
