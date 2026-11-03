#!/usr/bin/env bash
# Revisa cada 2 minutos que el servidor esté bien y avisa al celular (por ntfy) cuando algo se rompe y
# cuando se arregla: un aviso por problema, no uno cada 2 minutos. Un problema se avisa recién la segunda
# vez seguida que aparece (así un reinicio de segundos al publicar no manda nada). La lanza
# balancert-vigilancia.timer.
#
# El tema de ntfy (el "canal" al que está suscripto el celular) y el dominio están en
# /etc/balancert/avisos.conf (lo arma preparar.sh). Los avisos no llevan datos de los estudios: solo qué
# falla.
#
# Uso (como root):  balancert-vigilar           revisa todo
#                   balancert-vigilar prueba    manda un aviso de prueba
set -uo pipefail
# shellcheck source=/dev/null
. /etc/balancert/avisos.conf   # TEMA y DOMINIO
ESTADO=/var/lib/balancert-vigilancia
RESPALDO=/var/backups/balancert/huella-supabase   # la deja el respaldo cada vez que sale bien
install -d -m 700 "$ESTADO"

avisar() {  # título, texto, prioridad (1 a 5), ícono
  python3 -c 'import json, sys; t, ti, m, p, e = sys.argv[1:]; print(json.dumps({"topic": t, "title": ti, "message": m, "priority": int(p), "tags": [e]}))' \
    "$TEMA" "BalanceRT: $1" "$2" "${3:-4}" "${4:-warning}" \
    | curl -fsS -m 20 -H 'Content-Type: application/json' --data-binary @- https://ntfy.sh/ >/dev/null \
    || echo "No se pudo mandar el aviso: $1" >&2
}

# revisar <clave> <título> <función>: la función devuelve 0 si está bien y deja en DETALLE qué pasa si no
revisar() {
  local clave=$1 titulo=$2 marca="$ESTADO/$1"
  DETALLE=''
  if "$3"; then
    if [ "$(cat "$marca" 2>/dev/null)" = avisado ]; then avisar "Resuelto: $titulo" 'Volvió a andar bien.' 3 white_check_mark; fi
    rm -f "$marca"
  else
    case "$(cat "$marca" 2>/dev/null)" in
      '') echo 1 > "$marca" ;;
      1) echo avisado > "$marca"; avisar "$titulo" "$DETALLE" 5 rotating_light ;;
    esac
  fi
}

app() {
  DETALLE="https://$DOMINIO no abre desde hace unos minutos."
  curl -fsS -o /dev/null -m 15 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/entrar"
}
base() {
  DETALLE='PostgreSQL no contesta: la app no puede leer ni guardar.'
  pg_isready -q -h 127.0.0.1
}
disco() {
  local uso; uso="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
  DETALLE="El disco está al $uso%. Si se llena, la app deja de guardar."
  [ "$uso" -lt 90 ]
}
memoria() {
  local total libre; read -r total libre < <(awk '/^MemTotal/ {t=$2} /^MemAvailable/ {l=$2} END {print t, l}' /proc/meminfo)
  DETALLE="Quedan $((libre / 1024)) MB libres: la app puede andar lenta o cortarse."
  [ $((libre * 100 / total)) -ge 8 ]
}
certificado() {
  DETALLE="El certificado HTTPS vence el $(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMINIO/cert.pem" | cut -d= -f2) y no se renovó solo."
  openssl x509 -checkend $((14 * 86400)) -noout -in "/etc/letsencrypt/live/$DOMINIO/cert.pem" >/dev/null
}
respaldo() {
  # sale todas las noches a las 4:30: si el último bueno tiene más de 26 horas, el de anoche falló
  # (detalle: journalctl -u balancert-respaldo)
  DETALLE="El último que salió bien fue el $(date -r "$RESPALDO" '+%d/%m a las %H:%M' 2>/dev/null || echo '(nunca)') (UTC)."
  [ ! -f /etc/balancert/pase-hecho ] || [ -n "$(find "$RESPALDO" -mmin -$((26 * 60)) 2>/dev/null)" ]
}

if [ "${1:-}" = prueba ]; then
  avisar 'Prueba de avisos' "Si ves esto, los avisos de $DOMINIO llegan bien." 3 white_check_mark
  exit
fi
revisar app 'La app no responde' app
revisar base 'La base de datos no responde' base
revisar disco 'Se está llenando el disco' disco
revisar memoria 'Al servidor le queda poca memoria' memoria
revisar certificado 'El certificado HTTPS vence pronto' certificado
revisar respaldo 'El respaldo en Supabase está atrasado' respaldo
