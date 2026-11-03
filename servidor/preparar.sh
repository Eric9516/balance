#!/usr/bin/env bash
# Prepara el servidor propio para BalanceRT (una sola vez; repetirlo no rompe nada). Ubuntu 24.04.
# Uso (como root, en el servidor, desde la carpeta servidor/):  bash preparar.sh <dominio>
#
# Deja: acceso solo con llave, firewall (22, 80 y 443), fail2ban, memoria de reserva, PostgreSQL 17 solo
# en 127.0.0.1 con la base "balancert" y dos usuarios (balancert_dueno para las migraciones y
# balancert_web para la app, que solo puede pasar al rol balancert_app), Docker, Nginx con HTTPS y
# balancert-app. Las contraseñas se generan acá y quedan solo en /etc/balancert (nunca en el repositorio).
set -euo pipefail
DOMINIO="${1:?Falta el dominio (por ejemplo 64-176-28-71.sslip.io)}"
DIR="$(cd "$(dirname "$0")" && pwd)"
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

apt-get update -q >/dev/null
apt-get -y -q install ufw fail2ban unattended-upgrades curl ca-certificates gnupg nginx certbot \
  python3-certbot-nginx docker.io postgresql-common >/dev/null

# Acceso solo con llave. "00" para que gane sobre el archivo de cloud-init (sshd toma el primer valor).
cat > /etc/ssh/sshd_config.d/00-balancert.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
sshd -t && systemctl reload ssh

ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban docker >/dev/null

# Memoria de reserva: si falta memoria, el servidor anda más lento en vez de cortar la base.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness = 10' > /etc/sysctl.d/89-balancert-swap.conf
# Que la conexión no vuelva a arrancar despacio después de unos segundos quieta, y BBR.
cat > /etc/sysctl.d/90-balancert.conf <<'CONF'
net.ipv4.tcp_slow_start_after_idle = 0
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
CONF
sysctl -q --system

# PostgreSQL 17 del repositorio oficial (PGDG): la misma versión que las pruebas.
[ -f /etc/apt/sources.list.d/pgdg.list ] || /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
apt-get -y -q install postgresql-17 postgresql-client-17 >/dev/null
install -m 644 "$DIR/postgresql.conf" /etc/postgresql/17/main/conf.d/balancert.conf
systemctl restart postgresql

id balancert >/dev/null 2>&1 || useradd --system --home-dir /srv/balancert --shell /usr/sbin/nologin balancert
install -d -o balancert -g balancert /srv/balancert
install -d -m 750 -o root -g balancert /etc/balancert
install -d -m 700 /var/backups/balancert

# Usuarios y base. Las contraseñas se generan solo la primera vez.
if [ ! -f /etc/balancert/web.env ]; then
  DUENO="$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)"
  WEB="$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='balancert_dueno') THEN CREATE ROLE balancert_dueno LOGIN CREATEROLE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='balancert_web') THEN CREATE ROLE balancert_web LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF;
END \$\$;
ALTER ROLE balancert_dueno PASSWORD '$DUENO';
ALTER ROLE balancert_web PASSWORD '$WEB';
SQL
fi
# El dueño de tablas y funciones ve por encima de la separación por estudio, igual que postgres en
# Supabase (y que el usuario de las pruebas): las funciones "security definer" (entrar, la sesión, el
# catálogo) corren con él y sin esto no encuentran nada. La app entra con balancert_web, que no puede.
sudo -u postgres psql -q -c "ALTER ROLE balancert_dueno BYPASSRLS"
if [ ! -f /etc/balancert/web.env ]; then
  (umask 077; echo "DATABASE_URL=postgresql://balancert_dueno:$DUENO@127.0.0.1:5432/balancert" > /etc/balancert/base-dueno.env)
  (umask 027; cat > /etc/balancert/web.env <<ENV
DATABASE_URL=postgresql://balancert_web:$WEB@127.0.0.1:5432/balancert
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
DB_POOL_MAX=6
ENV
  )
  chgrp balancert /etc/balancert/web.env
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='balancert'" | grep -q 1 \
  || sudo -u postgres createdb -O balancert_dueno balancert
sudo -u postgres psql -d balancert -q -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  REVOKE ALL ON DATABASE balancert FROM PUBLIC; GRANT CONNECT ON DATABASE balancert TO balancert_web;"

install -m 755 "$DIR/app.sh" /usr/local/bin/balancert-app
# La copia desde Supabase (ensayo y pase) y el respaldo nocturno a Supabase. El reloj del respaldo se
# prende recién en el pase: antes, Supabase es la base que se usa y no se toca.
install -d -m 755 /usr/local/lib/balancert
install -m 755 "$DIR/copiar-de-supabase.sh" "$DIR/respaldo-a-supabase.sh" /usr/local/lib/balancert/
install -m 644 "$DIR/balancert-respaldo.service" "$DIR/balancert-respaldo.timer" /etc/systemd/system/
systemctl daemon-reload

# Nginx con el dominio, y su certificado HTTPS.
sed -e "s/__DOMINIO__/$DOMINIO/" "$DIR/nginx.conf" > /etc/nginx/sites-available/balancert
ln -sfn /etc/nginx/sites-available/balancert /etc/nginx/sites-enabled/balancert
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
if [ -d "/etc/letsencrypt/live/$DOMINIO" ]; then
  certbot install --nginx --cert-name "$DOMINIO" --non-interactive --redirect -q
else
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect -q
fi
# HTTP/2 en las líneas del 443 que pone certbot: todos los archivos de una pantalla por una sola conexión.
sed -i -E '/listen .*443 ssl/{/http2/!s/443 ssl/443 ssl http2/}' /etc/nginx/sites-available/balancert
nginx -t -q && systemctl reload nginx

# La vigilancia: cada 2 minutos revisa la app, la base, el disco, la memoria, el certificado y el respaldo,
# y avisa al celular por ntfy. El tema (el canal al que se suscribe el celular) se inventa una sola vez:
# es largo y al azar para que nadie más lo encuentre.
if [ ! -f /etc/balancert/avisos.conf ]; then
  (umask 077; printf 'TEMA=balancert-%s\n' "$(openssl rand -hex 10)" > /etc/balancert/avisos.conf)
fi
sed -i '/^DOMINIO=/d' /etc/balancert/avisos.conf && echo "DOMINIO=$DOMINIO" >> /etc/balancert/avisos.conf
install -m 755 "$DIR/vigilar.sh" /usr/local/bin/balancert-vigilar
install -m 644 "$DIR/balancert-vigilancia.service" "$DIR/balancert-vigilancia.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now balancert-vigilancia.timer >/dev/null
echo "Servidor listo para $DOMINIO (avisos al celular: tema $(sed -n 's/^TEMA=//p' /etc/balancert/avisos.conf) en ntfy)"
