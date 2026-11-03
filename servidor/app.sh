#!/usr/bin/env bash
# Prende la app en el servidor con Docker (preparar.sh lo instala como balancert-app). La caja (imagen) la
# arma servidor/desplegar.sh en el mismo servidor.
#
#   balancert-app cambiar <imagen>   La prende en lugar de la que está y revisa que responda; si no
#                                    responde, vuelve sola a la anterior. Quedan las 3 últimas.
#   balancert-app reiniciar          La vuelve a prender con la misma imagen (así relee /etc/balancert/web.env).
#   balancert-app parar | arrancar
#
# Cómo corre (lo que gana con estar en una caja):
# - con el usuario "balancert" del servidor, sin ningún permiso de administrador y sin poder pedirlos;
# - todo de solo lectura, menos dos carpetas temporales;
# - con 700 MB de memoria como máximo: si se pasa, Docker la reinicia (la base queda a salvo);
# - en la red del servidor (escucha solo en 127.0.0.1:3000, Nginx la publica): así llega a PostgreSQL,
#   que solo atiende en 127.0.0.1, y no abre ningún puerto hacia afuera.
set -euo pipefail
NOMBRE=balancert-web
QUEDAN=3

crear() {
  docker rm -f "$NOMBRE" >/dev/null 2>&1 || true
  docker run -d --name "$NOMBRE" --restart unless-stopped \
    --network host --user "$(id -u balancert):$(id -g balancert)" \
    --env-file /etc/balancert/web.env \
    --read-only --tmpfs /tmp --tmpfs /app/.next/cache:mode=1777 \
    --cap-drop ALL --security-opt no-new-privileges \
    --memory 700m --memory-swap 900m \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$1" >/dev/null
}
responde() { for _ in $(seq 1 30); do curl -fs -o /dev/null http://127.0.0.1:3000/entrar && return 0; sleep 1; done; return 1; }
actual() { docker inspect -f '{{.Config.Image}}' "$NOMBRE" 2>/dev/null || true; }

case "${1:-}" in
  cambiar)
    NUEVA="${2:?Falta la imagen}"
    ANTERIOR="$(actual)"
    crear "$NUEVA"
    if ! responde; then
      echo "✗ La versión nueva no responde: se vuelve a la anterior" >&2
      docker logs --tail 30 "$NOMBRE" >&2 || true
      [ -n "$ANTERIOR" ] && crear "$ANTERIOR" && responde
      exit 1
    fi
    # las 3 últimas (la que corre incluida), por si hay que volver atrás a mano: balancert-app cambiar <imagen anterior>
    docker image ls balancert-web --format '{{.Repository}}:{{.Tag}}' | grep -v ':ultima$' | tail -n +$((QUEDAN + 1)) | xargs -r docker rmi >/dev/null 2>&1 || true
    echo "  la app responde ($NUEVA)"
    ;;
  reiniciar) IMAGEN="$(actual)"; [ -n "$IMAGEN" ] || { echo "✗ La app no está creada" >&2; exit 1; }; crear "$IMAGEN"; responde ;;
  parar) docker stop "$NOMBRE" >/dev/null ;;
  arrancar) docker start "$NOMBRE" >/dev/null; responde ;;
  *) echo "Uso: balancert-app <cambiar <imagen>|reiniciar|parar|arrancar>" >&2; exit 1 ;;
esac
