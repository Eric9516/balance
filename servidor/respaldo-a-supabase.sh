#!/usr/bin/env bash
# Después del pase: copia los datos del servidor a Supabase, que queda de respaldo. Lo dispara
# balancert-respaldo.timer todas las noches. Además deja en el servidor una copia de la base de cada noche
# (las últimas 7, en /var/backups/balancert). Todo va en una sola transacción: si algo falla, Supabase
# queda como estaba.
#
# Seguros:
# - No corre si el pase no se hizo (/etc/balancert/pase-hecho): antes del pase BalanceRT trabaja en
#   Supabase y se lo pisaría.
# - Si una publicación agregó migraciones, primero se le aplican a Supabase (con copia previa).
# - Si alguien cambió algo en Supabase después del último respaldo (por ejemplo, la app vieja), antes de
#   pisarlo lo guarda entero en /var/backups/balancert/supabase-<fecha>.dump: nada se pierde sin copia.
# La conexión a Supabase está solo en /etc/balancert/supabase.conn (root).
set -euo pipefail
PASE=/etc/balancert/pase-hecho
SUPABASE="$(cat /etc/balancert/supabase.conn)"
COPIAS=/var/backups/balancert
HUELLA="$COPIAS/huella-supabase"
BASE=balancert
[ -f "$PASE" ] || { echo "✗ El pase no está hecho: BalanceRT todavía trabaja en Supabase y no se toca." >&2; exit 1; }
local_() { sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$BASE" "$@"; }
install -d -m 700 "$COPIAS"
FECHA="$(date -u +%Y%m%d-%H%M)"

echo "→ Copia de la base en el servidor"
sudo -u postgres pg_dump -Fc -d "$BASE" > "$COPIAS/servidor-$FECHA.dump"
ls -1t "$COPIAS"/servidor-2*.dump | tail -n +8 | xargs -r rm -f

TABLAS="select format('%I.%I', schemaname, tablename) from pg_tables
        where schemaname in ('public', 'acceso') and tablename <> '_prisma_migrations' order by 1"
# La huella de Supabase: cuántas filas tiene cada tabla y un resumen de su contenido.
huella() {
  local q; q="$(psql "$SUPABASE" -Atc "select string_agg(format('select %L, count(*), md5(coalesce(string_agg(md5(x::text), '''' order by md5(x::text)), '''')) from %s x', t, t), ' union all ' order by t) from ($TABLAS) z(t)")"
  psql -q "$SUPABASE" -At -F' ' -c "set row_security = off; $q order by 1"
}
if [ -f "$HUELLA" ] && ! diff -q <(huella) "$HUELLA" >/dev/null; then
  echo "⚠ Alguien cambió datos en Supabase después del último respaldo: se guarda lo de allá antes de pisarlo"
  pg_dump -Fc "$SUPABASE" --schema=public --schema=acceso --no-owner --no-privileges > "$COPIAS/supabase-$FECHA.dump"
fi

echo "→ Migraciones de Supabase"
MIGRACIONES="select migration_name from public._prisma_migrations where finished_at is not null and rolled_back_at is null order by 1"
if ! diff -q <(psql "$SUPABASE" -Atc "$MIGRACIONES") <(local_ -Atc "$MIGRACIONES") >/dev/null; then
  pg_dump -Fc "$SUPABASE" --schema=public --schema=acceso --no-owner --no-privileges > "$COPIAS/supabase-antes-de-migrar-$FECHA.dump"
  docker run --rm --network host -e DATABASE_URL="$SUPABASE" balancert-herramientas:ultima pnpm exec prisma migrate deploy
fi

echo "→ Datos a Supabase"
{
  echo "set session_replication_role = replica;"
  echo "truncate $(psql "$SUPABASE" -Atc "select string_agg(t, ', ') from ($TABLAS) x(t)");"
  sudo -u postgres pg_dump -d "$BASE" --data-only --schema=public --schema=acceso \
    --exclude-table-data=public._prisma_migrations --no-owner --no-privileges
  echo "set session_replication_role = origin;"
} | psql "$SUPABASE" -v ON_ERROR_STOP=1 -q --single-transaction -o /dev/null

echo "→ Comparando"
contar() {
  local q; q="$("$@" -Atc "select string_agg(format('select %L, count(*) from %s', t, t), ' union all ' order by t) from ($TABLAS) x(t)")"
  "$@" -At -F' ' -c "set row_security = off; $q order by 1"
}
diff <(contar local_) <(contar psql -q "$SUPABASE") || { echo "✗ Supabase no quedó igual que el servidor." >&2; exit 1; }
huella > "$HUELLA"
echo "✔ Respaldo en Supabase al día ($(date -u '+%Y-%m-%d %H:%M') UTC)"
