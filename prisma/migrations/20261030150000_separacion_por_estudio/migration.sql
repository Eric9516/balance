-- Fase 1a, etapa 2 (docs/decisiones/0011): la base separa a los estudios.
--
-- Qué resuelve: cada fila ya dice de qué estudio es (20261029150000 y 20261030120000), pero la app
-- entraba como dueña de las tablas y veía todo: un filtro olvidado mostraba los datos de otro
-- estudio. Ahora la base solo deja ver y cambiar las filas del estudio de la sesión, aunque el
-- código se equivoque.
--
-- Qué hace:
-- 1) balancert_app: el rol con que trabaja la app. No saltea las reglas por fila ni hereda
--    permisos; el usuario que se conecta pasa a este rol en cada conexión (src/lib/pool-pg.ts).
--    No tiene permisos sobre el historial de migraciones ni sobre el registro técnico.
-- 2) estudio_de_la_sesion(): el estudio que declara la app (app.estudio). Mientras no hay login,
--    si en la base hay un solo estudio y la app no declaró ninguno, ese (como hoy en producción).
--    Con dos o más estudios y sin declarar, ninguno: la app no ve nada (falla cerrada).
-- 3) Cada tabla con estudio: reglas por fila activas y forzadas, la regla restrictiva
--    solo_su_estudio y el permiso para la app (lo arma _estudio_en_la_tabla, que ahora también
--    hace esto: toda tabla nueva con estudio lo recibe con la misma llamada de siempre).
-- 4) estudios: cada uno ve y cambia solo el suyo; la app no borra estudios. catalogo_rubros: la
--    app solo lo lee (lo copia el disparador que da el catálogo a un estudio nuevo).
--
-- Velocidad: la regla compara estudio_id con un valor que se calcula una sola vez por consulta.
-- Las consultas ya filtran por ejercicio o por estudio con índice; la regla agrega una
-- comparación por fila leída. Ver docs/RENDIMIENTO.md.
--
-- Cómo revertir: en cada tabla con estudio, DROP POLICY solo_su_estudio y la_app, NO FORCE ROW
-- LEVEL SECURITY y REVOKE ALL ... FROM balancert_app (las reglas por fila quedan activas y sin
-- políticas, como antes); lo mismo en estudios y catalogo_rubros; REVOKE de las funciones,
-- DROP FUNCTION public._estudio_unico(), volver a la versión anterior de estudio_de_la_sesion y de
-- _estudio_en_la_tabla (20261030120000) y DROP ROLE balancert_app. La app vieja (sin cambio de rol)
-- sigue andando con o sin esta migración.

-- 1) El rol de la app
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'balancert_app') THEN
    CREATE ROLE balancert_app NOLOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
-- Quien se conecta (el dueño de las tablas) puede pasar a este rol, sin heredar nada de él.
GRANT balancert_app TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA public TO balancert_app;

-- 2) El estudio de la sesión
CREATE FUNCTION public._estudio_unico() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(e.id))[1] END
  FROM (SELECT id FROM public.estudios LIMIT 2) e
$$;

-- Sin SET search_path a propósito (todo va con su esquema): así PostgreSQL la reemplaza por su
-- expresión dentro de cada consulta y de cada valor por defecto, en vez de llamarla. La regla de
-- cada tabla y el estudio de cada fila insertada la usan: con la llamada, importar 800 cuentas
-- tardaba un 30% más (medido el 2026-10-30).
CREATE OR REPLACE FUNCTION public.estudio_de_la_sesion() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(pg_catalog.current_setting('app.estudio', true), '')::pg_catalog.uuid,
    public._estudio_unico())
$$;

-- 3) Cada tabla con estudio
CREATE OR REPLACE FUNCTION public._estudio_en_la_tabla(p_tabla regclass) RETURNS void
LANGUAGE plpgsql SET search_path = ''
AS $gen$
DECLARE
  v_tabla text := (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_funcion text := '_estudio_de_' || (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_cuerpo text := '';
  v_columnas text[] := ARRAY['estudio_id'];
  v_cruzadas bigint;
  v record;
  v_rol text;
BEGIN
  -- Cada clave foránea de una columna hacia otra tabla que también lleva el estudio
  FOR v IN
    SELECT a.attname AS columna, pc.relname AS padre
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class pc ON pc.oid = c.confrelid
    WHERE c.conrelid = p_tabla AND c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid
                  AND x.attname = 'estudio_id' AND NOT x.attisdropped)
    ORDER BY a.attname
  LOOP
    -- Lo que ya está tiene que cumplirlo: si no, se detiene y dice dónde (hay que mirarlo)
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN public.%I p ON p.id = t.%I WHERE p.estudio_id <> t.estudio_id',
      p_tabla, v.padre, v.columna) INTO v_cruzadas;
    IF v_cruzadas > 0 THEN
      RAISE EXCEPTION 'En %, % filas de % apuntan a un dato de otro estudio.',
        v_tabla, v_cruzadas, v.columna USING ERRCODE = '23514';
    END IF;

    v_columnas := v_columnas || v.columna::text;
    v_cuerpo := v_cuerpo || format($b$
  IF NEW.%1$I IS NOT NULL THEN
    SELECT p.estudio_id INTO v_estudio FROM public.%2$I p WHERE p.id = NEW.%1$I;
    IF NEW.estudio_id IS NULL THEN
      NEW.estudio_id := v_estudio;
    ELSIF v_estudio IS DISTINCT FROM NEW.estudio_id THEN
      RAISE EXCEPTION 'En %3$s, %1$s apunta a un dato de otro estudio.' USING ERRCODE = '23514';
    END IF;
  END IF;$b$, v.columna, v.padre, v_tabla);
  END LOOP;

  EXECUTE format($f$
CREATE OR REPLACE FUNCTION public.%1$I() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $cuerpo$
DECLARE
  v_estudio uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estudio_id IS DISTINCT FROM OLD.estudio_id THEN
    RAISE EXCEPTION 'El estudio de una fila de %2$s no se cambia.' USING ERRCODE = '23514';
  END IF;%3$s
  RETURN NEW;
END
$cuerpo$$f$, v_funcion, v_tabla, v_cuerpo);

  EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC', v_funcion);
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM %I', v_funcion, v_rol);
    END IF;
  END LOOP;

  EXECUTE format('DROP TRIGGER IF EXISTS estudio ON %s', p_tabla);
  EXECUTE format(
    'CREATE TRIGGER estudio BEFORE INSERT OR UPDATE OF %s ON %s FOR EACH ROW EXECUTE FUNCTION public.%I()',
    (SELECT string_agg(quote_ident(c), ', ') FROM unnest(v_columnas) c), p_tabla, v_funcion);

  -- Solo las filas del estudio de la sesión, para leer y para escribir. Restrictiva: se suma a
  -- cualquier otra regla. Forzada: vale también para el dueño de la tabla (salvo los roles que
  -- saltean las reglas a propósito: el que migra y la plataforma).
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_tabla);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_tabla);
  EXECUTE format('DROP POLICY IF EXISTS solo_su_estudio ON %s', p_tabla);
  EXECUTE format(
    'CREATE POLICY solo_su_estudio ON %s AS RESTRICTIVE FOR ALL TO public
       USING (estudio_id = (SELECT public.estudio_de_la_sesion()))
       WITH CHECK (estudio_id = (SELECT public.estudio_de_la_sesion()))', p_tabla);
  EXECUTE format('DROP POLICY IF EXISTS la_app ON %s', p_tabla);
  EXECUTE format(
    'CREATE POLICY la_app ON %s FOR ALL TO balancert_app USING (true) WITH CHECK (true)', p_tabla);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO balancert_app', p_tabla);
END
$gen$;

SELECT public._estudio_en_la_tabla(c.oid::regclass)
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
              AND a.attname = 'estudio_id' AND NOT a.attisdropped)
ORDER BY c.relname;

-- 4) Los estudios y el catálogo oficial
ALTER TABLE public.estudios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudios FORCE ROW LEVEL SECURITY;
CREATE POLICY solo_su_estudio ON public.estudios AS RESTRICTIVE FOR ALL TO public
  USING (id = (SELECT public.estudio_de_la_sesion()))
  WITH CHECK (id = (SELECT public.estudio_de_la_sesion()));
CREATE POLICY la_app ON public.estudios FOR ALL TO balancert_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.estudios TO balancert_app;

ALTER TABLE public.catalogo_rubros ENABLE ROW LEVEL SECURITY;
CREATE POLICY la_app_lee ON public.catalogo_rubros FOR SELECT TO balancert_app USING (true);
GRANT SELECT ON public.catalogo_rubros TO balancert_app;

-- Las funciones: las que usa la app, para ella; todas, cerradas para el resto
GRANT EXECUTE ON FUNCTION public.uuidv7(), public.estudio_de_la_sesion(), public._estudio_unico()
  TO balancert_app;
REVOKE EXECUTE ON FUNCTION public._estudio_unico() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM PUBLIC;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._estudio_unico() FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
