-- Claves UUIDv7 en vez de cuid.
--
-- Problema: los identificadores eran texto de 25 caracteres (cuid) generado por la app.
--  - Ocupan más que un UUID (16 bytes fijos), y cada fila de cuentas_contables lleva cinco, igual
--    que casi todos sus índices: a gran volumen, tablas e índices más grandes y más lecturas.
--  - Comparar texto usa las reglas de orden del idioma; comparar un UUID es comparar 16 bytes.
--  - La base no sabía generar ese formato: las funciones y disparadores de las Fases 2 y 3 no
--    podían insertar filas por su cuenta. Y Supabase Auth identifica a los usuarios con UUID.
--
-- Decisión (docs/decisiones/0008-claves-uuid-v7.md): UUIDv7, que empieza con la hora en
-- milisegundos (se inserta ordenado al final de los índices, como el cuid) y lo genera la base.
--
-- Cómo, todo en esta única transacción:
--  1. uuidv7(): PostgreSQL 18 la trae de fábrica; en 17 se define acá con el mismo nombre.
--  2. Un mapa viejo → nuevo. Cada identificador nuevo se arma con la fecha de creación de su fila,
--     así el orden por identificador sigue siendo el orden de creación.
--  3. Se guardan las definiciones exactas de las claves foráneas y se quitan.
--  4. Se convierten a uuid los identificadores y todas las columnas que los referencian (las que
--     se llaman id o terminan en _id), con el mapa. Si una referencia no tiene dueño, la migración
--     se corta: nunca queda un valor vacío en silencio.
--  5. Las claves del comparativo manual que son el identificador de un rubro pasan al nuevo.
--  6. Se restauran las claves foráneas con su definición original y uuidv7() queda como valor por
--     defecto de cada id.
--
-- Los índices y claves primarias se reconstruyen solos al cambiar el tipo.
-- Para revertir: no hay vuelta automática (los identificadores viejos no se guardan); se restaura
-- la copia de seguridad previa.

-- ─── 1. Generador de UUIDv7 ───────────────────────────────────────────────────
-- 48 bits de milisegundos Unix + versión 7 + variante RFC 9562 + bits aleatorios de gen_random_uuid().
-- (set_bit numera desde el bit menos significativo de cada byte: 52 y 53 llevan la versión de 4 a 7.)
CREATE OR REPLACE FUNCTION public.uuidv7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE
SET search_path = ''
AS $$
  -- Sin esquema delante: overlay y substring usan sintaxis especial; con search_path vacío igual
  -- resuelven a pg_catalog, que siempre se busca primero.
  SELECT encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
        PLACING substring(int8send(floor(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint) FROM 3)
        FROM 1 FOR 6),
      52, 1), 53, 1),
    'hex')::uuid
$$;

-- Los valores por defecto se calculan con los permisos de quien inserta: hoy es el dueño de las
-- tablas. El rol de la app de la Fase 2 va a necesitar GRANT EXECUTE sobre esta función.
REVOKE EXECUTE ON FUNCTION public.uuidv7() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.uuidv7() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION public.uuidv7() FROM authenticated;
  END IF;
END
$$;

-- Lo mismo pero con un instante dado: solo para esta migración (vive en la sesión).
CREATE FUNCTION pg_temp.uuidv7_en(instante timestamptz) RETURNS uuid
LANGUAGE sql VOLATILE
AS $$
  SELECT encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
        PLACING substring(int8send(floor(EXTRACT(EPOCH FROM instante) * 1000)::bigint) FROM 3)
        FROM 1 FOR 6),
      52, 1), 53, 1),
    'hex')::uuid
$$;

-- ─── 2. Mapa de identificadores ───────────────────────────────────────────────
CREATE TEMP TABLE mapa_ids (viejo text PRIMARY KEY, nuevo uuid NOT NULL UNIQUE);

DO $$
DECLARE
  t record;
  con_fecha boolean;
BEGIN
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.column_name = 'id' AND c.data_type = 'text'
       AND c.table_name <> '_prisma_migrations'
     ORDER BY c.table_name
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t.table_name AND column_name = 'created_at'
    ) INTO con_fecha;
    EXECUTE format(
      'INSERT INTO pg_temp.mapa_ids (viejo, nuevo) SELECT id, pg_temp.uuidv7_en(%s) FROM public.%I',
      CASE WHEN con_fecha THEN 'created_at' ELSE 'pg_catalog.clock_timestamp()' END,
      t.table_name);
  END LOOP;
END
$$;

-- Traduce un identificador viejo; si no está en el mapa, corta la migración.
CREATE FUNCTION pg_temp.nuevo_id(viejo text) RETURNS uuid
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  resultado uuid;
BEGIN
  IF viejo IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT m.nuevo INTO resultado FROM pg_temp.mapa_ids m WHERE m.viejo = nuevo_id.viejo;
  IF resultado IS NULL THEN
    RAISE EXCEPTION 'Identificador sin dueño: %', viejo;
  END IF;
  RETURN resultado;
END
$$;

-- ─── 3. Guardar y quitar las claves foráneas ─────────────────────────────────
CREATE TEMP TABLE claves_foraneas AS
  SELECT conrelid::regclass::text AS tabla, conname AS nombre, pg_get_constraintdef(oid) AS definicion
    FROM pg_constraint
   WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN SELECT * FROM pg_temp.claves_foraneas LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', f.tabla, f.nombre);
  END LOOP;
END
$$;

-- ─── 4. Convertir identificadores y referencias ──────────────────────────────
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name,
           string_agg(
             format('ALTER COLUMN %I TYPE uuid USING pg_temp.nuevo_id(%I)', c.column_name, c.column_name),
             ', ' ORDER BY c.column_name) AS cambios
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.data_type = 'text'
       AND (c.column_name = 'id' OR c.column_name LIKE '%\_id')
       AND c.table_name <> '_prisma_migrations'
     GROUP BY c.table_name
     ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I %s', t.table_name, t.cambios);
  END LOOP;
END
$$;

-- ─── 5. Claves del comparativo manual que son el identificador de un rubro ───
UPDATE comparativo_manual c
   SET clave = m.nuevo::text
  FROM pg_temp.mapa_ids m
 WHERE c.clave = m.viejo;

-- ─── 6. Restaurar claves foráneas y valores por defecto ─────────────────────
DO $$
DECLARE
  f record;
  t record;
BEGIN
  FOR f IN SELECT * FROM pg_temp.claves_foraneas ORDER BY tabla, nombre LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', f.tabla, f.nombre, f.definicion);
  END LOOP;
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.column_name = 'id' AND c.data_type = 'uuid'
       AND c.table_name <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT uuidv7()', t.table_name);
  END LOOP;
END
$$;
