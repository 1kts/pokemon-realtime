#!/usr/bin/env bash
# Segunda mitad del despliegue, ya en el servidor. GitHub Actions copia el código a
# /srv/arena/releases/<commit> y lanza esto como el usuario deploy:
#   bash deploy.sh /srv/arena/releases/<commit>
# Instala dependencias, para el servicio (el servidor espera a que acaben los combates en curso,
# hasta 5 min, sin dejar empezar otros), apunta /srv/arena/current a la versión nueva, arranca y
# comprueba que responde con ella. Se quedan las 3 últimas versiones para poder volver atrás.
set -euo pipefail
REL=$1
cd "$REL"
npm ci --omit=dev --no-audit --no-fund --loglevel=error
want=$(node -p "require('./package.json').version")

echo "Parando el servidor (espera a los combates en curso)…"
sudo systemctl stop arena
ln -sfn "$REL" /srv/arena/current
sudo systemctl start arena

for _ in $(seq 30); do
  if curl -fsS localhost:3000/healthz 2>/dev/null | grep -q "\"version\":\"$want\""; then
    echo "Desplegada la v$want ($(basename "$REL"))"
    ls -1dt /srv/arena/releases/*/ | grep -vxF "$REL/" | tail -n +3 | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done
echo "El servidor no responde con la v$want. Últimos registros:" >&2
journalctl -u arena -n 40 --no-pager >&2 || true
exit 1
