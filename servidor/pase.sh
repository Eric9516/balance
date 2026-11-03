#!/usr/bin/env bash
# El pase: desde ahora BalanceRT trabaja en el servidor propio y Supabase queda de respaldo.
# Uso (como root, en el servidor, con la app vieja sin usar):  bash pase.sh
# 1. Copia final de Supabase al servidor, con la comparación tabla por tabla (copiar-de-supabase.sh).
# 2. Guarda la huella de Supabase: si alguien cambia algo allá después del pase (la app vieja), el
#    respaldo de la noche lo detecta y lo guarda aparte antes de pisarlo.
# 3. Marca el pase hecho y prende el respaldo nocturno (respaldo-a-supabase.sh).
set -euo pipefail
PASE=/etc/balancert/pase-hecho
[ ! -f "$PASE" ] || { echo "✗ El pase ya está hecho ($(cat "$PASE")): no se vuelve a copiar desde Supabase." >&2; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"
SUPABASE="$(cat /etc/balancert/supabase.conn)"
COPIAS=/var/backups/balancert

bash "$DIR/copiar-de-supabase.sh"

# La misma huella que calcula respaldo-a-supabase.sh.
TABLAS="select format('%I.%I', schemaname, tablename) from pg_tables
        where schemaname in ('public', 'acceso') and tablename <> '_prisma_migrations' order by 1"
q="$(psql "$SUPABASE" -Atc "select string_agg(format('select %L, count(*), md5(coalesce(string_agg(md5(x::text), '''' order by md5(x::text)), '''')) from %s x', t, t), ' union all ' order by t) from ($TABLAS) z(t)")"
psql -q "$SUPABASE" -At -F' ' -c "set row_security = off; $q order by 1" > "$COPIAS/huella-supabase"

date -u '+%Y-%m-%d %H:%M UTC' > "$PASE"
systemctl enable --now balancert-respaldo.timer >/dev/null
echo "✔ Pase hecho: BalanceRT trabaja en el servidor. Respaldo en Supabase todas las noches a las 4:30."
