#!/usr/bin/env bash
# Vigilante interno de PokéArenas: lo que desde fuera no se ve. Lo lanza arena-watchdog.timer cada
# 5 min (como root) y avisa por Telegram solo cuando algo pasa a ir mal o vuelve a ir bien:
#   - el juego o Caddy parados, o el juego que no responde en localhost:3000
#   - el juego reiniciado solo (por un error) desde la última revisión
#   - disco por encima del 85 % o memoria disponible por debajo de 300 MB
#   - la copia de la base de datos de hoy o de ayer no está
#   - el certificado HTTPS caduca en menos de 14 días
# Credenciales en /etc/arena-alerts.env (solo root): TELEGRAM_TOKEN=… y TELEGRAM_CHAT=…
set -uo pipefail
ENV=/etc/arena-alerts.env
STATE=/var/lib/arena-watchdog
[ -r "$ENV" ] || exit 0
# shellcheck disable=SC1090
. "$ENV"
mkdir -p "$STATE"
DOMAIN=$(cat /etc/arena-domain 2>/dev/null || echo localhost)

send() {
  curl -s --max-time 15 -o /dev/null "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT}" --data-urlencode "text=$1" || true
}
# check <clave> <ok 0|1> <texto si va mal>: avisa al pasar de bien a mal y de mal a bien
check() {
  local key=$1 bad=$2 text=$3 flag="$STATE/$1.bad"
  if [ "$bad" = 1 ] && [ ! -e "$flag" ]; then echo "$text" > "$flag"; send "⚠️ PokéArenas ($(hostname)): $text"
  elif [ "$bad" = 0 ] && [ -e "$flag" ]; then send "✅ PokéArenas: resuelto · $(cat "$flag")"; rm -f "$flag"
  fi
}

# Servicios y respuesta del juego
for s in arena caddy; do
  systemctl is-active --quiet "$s"; check "svc-$s" $([ $? -eq 0 ] && echo 0 || echo 1) "el servicio $s no está en marcha"
done
curl -sf --max-time 5 localhost:3000/healthz | grep -q '"ok":true'; check health $([ $? -eq 0 ] && echo 0 || echo 1) "el juego no responde en localhost:3000"

# Reinicios por error (systemd cuenta los reinicios automáticos)
n=$(systemctl show -p NRestarts --value arena 2>/dev/null || echo 0)
last=$(cat "$STATE/restarts" 2>/dev/null || echo "$n")
echo "$n" > "$STATE/restarts"
if [ "$n" -gt "$last" ] 2>/dev/null; then
  send "⚠️ PokéArenas se ha reiniciado solo $((n - last)) vez/veces por un error. Últimas líneas:
$(journalctl -u arena -n 8 --no-pager -o cat 2>/dev/null | tail -c 1200)"
fi

# Disco y memoria
disk=$(df --output=pcent / | tail -1 | tr -dc 0-9)
check disk $([ "${disk:-0}" -gt 85 ] && echo 1 || echo 0) "disco al ${disk} %"
avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
check mem $([ "${avail:-9999}" -lt 300 ] && echo 1 || echo 0) "solo ${avail} MB de memoria disponible"

# Copia de la base de datos (se hace a las 04:30 UTC): la de hoy o, si aún no toca, la de ayer
today=/var/backups/arena/arena-$(date -u +%F).db
yday=/var/backups/arena/arena-$(date -u -d yesterday +%F).db
check backup $([ -s "$today" ] || [ -s "$yday" ] && echo 0 || echo 1) "no hay copia de la base de datos ni de hoy ni de ayer"

# Certificado HTTPS
end=$(echo | timeout 10 openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
  days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
  check cert $([ "$days" -lt 14 ] && echo 1 || echo 0) "el certificado HTTPS de $DOMAIN caduca en $days días"
fi
exit 0
