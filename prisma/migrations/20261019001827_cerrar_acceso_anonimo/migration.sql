-- Cierra la base al acceso anónimo de la API de datos de Supabase.
--
-- Problema (verificado el 2026-10-18): Supabase les da por defecto a los roles "anon" y "authenticated" todos los
-- permisos sobre las tablas que se crean en el esquema public. Ninguna tabla tenía reglas por fila, así que con la
-- dirección del proyecto y la clave pública cualquiera podía leer, cambiar o borrar las 27 tablas por la API REST.
--
-- BalanceRT no usa esos roles: el servidor se conecta con Prisma como dueño de las tablas, que no está alcanzado
-- por las reglas por fila. La app sigue funcionando igual.
--
-- Dos capas:
--   1) Reglas por fila activas en todas las tablas, sin políticas: los roles de la API no ven ninguna fila.
--   2) Sin permisos de tabla ni de secuencia para "anon" y "authenticated", también para lo que se cree después.
--
-- Corre también en un PostgreSQL común (CI, pruebas de integración): si esos roles no existen, la parte 2 se salta.
--
-- Para revertir (en una migración nueva, nunca editando esta):
--   ALTER TABLE public.<tabla> DISABLE ROW LEVEL SECURITY;  -- por cada tabla
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

DO $$
DECLARE
  t   record;
  rol text;
BEGIN
  -- 1) Reglas por fila en todas las tablas del esquema public (incluye _prisma_migrations).
  FOR t IN
    SELECT c.relname
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  -- 2) Sin permisos para los roles de la API de Supabase.
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      -- Lo mismo para las tablas y secuencias que cree de acá en adelante el rol que migra.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
    END IF;
  END LOOP;
END
$$;
