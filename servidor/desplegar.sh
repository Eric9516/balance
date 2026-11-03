#!/usr/bin/env bash
# Publica en el servidor propio la versión guardada en git (HEAD). Se corre desde esta computadora:
#   bash servidor/desplegar.sh
# 1. Manda el código (git archive: solo lo guardado, nunca .env ni lo que no está en git).
# 2. El servidor arma la caja de la app y la de herramientas (Dockerfile).
# 3. Copia de la base y migraciones nuevas, con el usuario dueño. Si una falla, no se cambia la app.
# 4. Cambia la app (balancert-app): si la nueva no responde, vuelve sola a la anterior.
set -euo pipefail
SERVIDOR="${SERVIDOR:-root@64.176.28.71}"
DOMINIO="${DOMINIO:-64-176-28-71.sslip.io}"
V="$(git rev-parse HEAD)"
[ -z "$(git status --porcelain --untracked-files=no)" ] || echo "  (hay cambios sin guardar: no van en esta publicación)"

echo "→ Mandando la versión ${V:0:7}"
git archive --format=tar HEAD | ssh -o BatchMode=yes "$SERVIDOR" \
  'install -d -m 700 /srv/armado && cat > /srv/armado/codigo.tar'

echo "→ Armando la caja en el servidor"
ssh -o BatchMode=yes -o ServerAliveInterval=30 "$SERVIDOR" "set -e
  docker build -q --build-arg VERSION=$V -t balancert-web:$V - < /srv/armado/codigo.tar >/dev/null
  docker build -q --target armado --build-arg VERSION=$V -t balancert-herramientas:ultima - < /srv/armado/codigo.tar >/dev/null
  rm -f /srv/armado/codigo.tar"

echo "→ Copia de la base y migraciones"
ssh -o BatchMode=yes "$SERVIDOR" "set -e
  sudo -u postgres pg_dump -Fc -d balancert > /var/backups/balancert/antes-${V:0:7}.dump
  docker run --rm --network host --env-file /etc/balancert/base-dueno.env balancert-herramientas:ultima \
    pnpm exec prisma migrate deploy
  sudo -u postgres psql -d balancert -q -c 'GRANT balancert_app TO balancert_web WITH INHERIT FALSE, SET TRUE'"

echo "→ Cambiando la app"
ssh -o BatchMode=yes "$SERVIDOR" "balancert-app cambiar balancert-web:$V"

codigo="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMINIO/entrar" || true)"
[ "$codigo" = 200 ] || { echo "✗ https://$DOMINIO no responde bien ($codigo)" >&2; exit 1; }
echo "✔ Publicada la versión ${V:0:7}: https://$DOMINIO"
