#!/usr/bin/env bash
# Copia los datos de Supabase a la base del servidor propio: para el ensayo y para el pase.
# Uso (como root, en el servidor):  bash copiar-de-supabase.sh
#
# Seguros:
# - Solo lee Supabase (pg_dump), nunca le escribe.
# - Antes de copiar compara las migraciones: si las dos bases no tienen exactamente las mismas, no copia
#   (primero hay que publicar la misma versión: servidor/desplegar.sh).
# - Deja una copia de la base del servidor antes de pisarla (/var/backups/balancert).
# - Todo va en una sola transacción: si algo falla, la base del servidor queda como estaba.
# - Al final compara la cantidad de filas de cada tabla en las dos bases.
# La conexión a Supabase está solo en /etc/balancert/supabase.conn (root).
set -euo pipefail
SUPABASE="$(cat /etc/balancert/supabase.conn)"
BASE=balancert
COPIAS=/var/backups/balancert
FECHA="$(date -u +%Y%m%d-%H%M)"
local_() { sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$BASE" "$@"; }
MIGRACIONES="select migration_name from public._prisma_migrations where finished_at is not null and rolled_back_at is null order by 1"

echo "→ Migraciones"
diff <(psql "$SUPABASE" -Atc "$MIGRACIONES") <(local_ -Atc "$MIGRACIONES") \
  || { echo "✗ Las migraciones no son las mismas: no se copia nada." >&2; exit 1; }

echo "→ Copia de la base del servidor antes de pisarla"
install -d -m 700 "$COPIAS"
sudo -u postgres pg_dump -Fc -d "$BASE" > "$COPIAS/servidor-antes-de-copiar-$FECHA.dump"

# Las tablas con datos: las de public (menos el registro de migraciones) y las de acceso.
TABLAS="select format('%I.%I', schemaname, tablename) from pg_tables
        where schemaname in ('public', 'acceso') and tablename <> '_prisma_migrations' order by 1"

echo "→ Datos de Supabase al servidor"
{
  echo "set session_replication_role = replica;"
  echo "truncate $(local_ -Atc "select string_agg(t, ', ') from ($TABLAS) x(t)");"
  # pg_dump trabaja con row_security off: si alguna regla por fila escondiera filas, falla en vez de
  # copiar de menos.
  pg_dump "$SUPABASE" --data-only --schema=public --schema=acceso \
    --exclude-table-data=public._prisma_migrations --no-owner --no-privileges
  echo "set session_replication_role = origin;"
} | local_ --single-transaction -o /dev/null

echo "→ Comparando"
contar() {
  local q; q="$("$@" -Atc "select string_agg(format('select %L, count(*) from %s', t, t), ' union all ' order by t) from ($TABLAS) x(t)")"
  "$@" -At -F' ' -c "set row_security = off; $q order by 1"
}
diff <(contar local_) <(contar psql "$SUPABASE") \
  || { echo "✗ El servidor no quedó igual que Supabase." >&2; exit 1; }
echo "✔ Copiadas $(local_ -Atc "select count(*) from ($TABLAS) x") tablas, iguales a Supabase ($(date -u '+%Y-%m-%d %H:%M') UTC)"
