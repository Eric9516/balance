-- Fase 1a, etapa 1 (docs/decisiones/0011): el estudio en cada tabla que cuelga de un ejercicio.
--
-- Qué resuelve: con una sola base para todos los estudios, cada fila tiene que decir de qué estudio
-- es, y la base tiene que impedir que una fila apunte a un dato de otro estudio. Hasta ahora solo lo
-- decían sociedades, ejercicios, auditores y las configuraciones del estudio; las 13 tablas que
-- cuelgan de un ejercicio (cuentas, notas, anexos, flujo, comparativo...) dependían del ejercicio.
--
-- Qué hace:
-- 1) estudio_de_la_sesion(): el estudio que la app declara en su transacción (app.estudio). Hoy la
--    app no lo declara y devuelve null; en la etapa 2 lo usan las reglas por fila.
-- 2) estudio_id en las 13 tablas: se completa desde su ejercicio (los detalles, desde su nota; los
--    ítems del flujo, desde su flujo), queda obligatorio y su valor por defecto es el de la sesión.
-- 3) Un disparador por cada tabla que lleva el estudio (lo arma _estudio_en_la_tabla mirando sus
--    claves foráneas). Al insertar o al cambiar un vínculo: completa el estudio desde el dato al que
--    apunta si no vino, rechaza un vínculo a un dato de otro estudio y rechaza cambiar el estudio de
--    una fila. Cubre también las tablas que ya tenían el estudio: por ejemplo, un ejercicio con la
--    sociedad, el auditor o el ejercicio anterior de otro estudio.
--    Es lo mismo que las claves compuestas (estudio_id, id) de Gestión empresarial; acá es un
--    disparador porque Prisma no admite una clave compuesta con una parte obligatoria (el estudio) y
--    otra opcional (por ejemplo, la nota de una cuenta). Toda tabla nueva que lleve el estudio
--    termina su migración con: SELECT public._estudio_en_la_tabla('public.<tabla>');
--    Los rechazos usan el código check_violation (23514): con foreign_key_violation, Prisma oculta
--    el mensaje y la app no sabría qué pasó.
--    La prueba src/test/integracion/estudio-en-cada-tabla.itest.ts falla si alguna no lo tiene.
--
-- Volumen: los UPDATE reescriben las filas de las 13 tablas (hoy, pocas). No se crean índices por
-- estudio: estas tablas se consultan siempre por su ejercicio, que ya tiene índice y es de un solo
-- estudio.
--
-- Cómo revertir: en cada tabla con estudio_id, DROP TRIGGER estudio ON <tabla> y DROP FUNCTION
-- public._estudio_de_<tabla>(); en las 13 tablas, ALTER TABLE <tabla> DROP COLUMN estudio_id; al
-- final, DROP FUNCTION public._estudio_en_la_tabla(regclass) y public.estudio_de_la_sesion().

-- 1) El estudio de la sesión
CREATE FUNCTION public.estudio_de_la_sesion() RETURNS uuid
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT nullif(current_setting('app.estudio', true), '')::uuid
$$;

-- 2) El estudio en las 13 tablas
ALTER TABLE public.importaciones_excel ADD COLUMN estudio_id uuid;
ALTER TABLE public.cuentas_contables ADD COLUMN estudio_id uuid;
ALTER TABLE public.notas_ejercicio ADD COLUMN estudio_id uuid;
ALTER TABLE public.detalles_nota ADD COLUMN estudio_id uuid;
ALTER TABLE public.evolucion_pn_movimientos ADD COLUMN estudio_id uuid;
ALTER TABLE public.flujo_caja_ejercicio ADD COLUMN estudio_id uuid;
ALTER TABLE public.flujo_caja_items ADD COLUMN estudio_id uuid;
ALTER TABLE public.bienes_de_uso_categorias ADD COLUMN estudio_id uuid;
ALTER TABLE public.costo_ventas_ejercicio ADD COLUMN estudio_id uuid;
ALTER TABLE public.errores_validacion ADD COLUMN estudio_id uuid;
ALTER TABLE public.comparativo_manual ADD COLUMN estudio_id uuid;
ALTER TABLE public.documentos_ejercicio ADD COLUMN estudio_id uuid;
ALTER TABLE public.ajustes_transicion_rt54 ADD COLUMN estudio_id uuid;

DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'importaciones_excel', 'cuentas_contables', 'notas_ejercicio', 'evolucion_pn_movimientos',
    'flujo_caja_ejercicio', 'bienes_de_uso_categorias', 'costo_ventas_ejercicio',
    'errores_validacion', 'comparativo_manual', 'documentos_ejercicio', 'ajustes_transicion_rt54'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I t SET estudio_id = e.estudio_id FROM public.ejercicios_contables e WHERE e.id = t.ejercicio_id',
      v_tabla);
  END LOOP;
END
$$;
UPDATE public.detalles_nota d SET estudio_id = n.estudio_id
FROM public.notas_ejercicio n WHERE n.id = d.nota_ejercicio_id;
UPDATE public.flujo_caja_items i SET estudio_id = f.estudio_id
FROM public.flujo_caja_ejercicio f WHERE f.id = i.flujo_id;

DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'importaciones_excel', 'cuentas_contables', 'notas_ejercicio', 'detalles_nota',
    'evolucion_pn_movimientos', 'flujo_caja_ejercicio', 'flujo_caja_items',
    'bienes_de_uso_categorias', 'costo_ventas_ejercicio', 'errores_validacion',
    'comparativo_manual', 'documentos_ejercicio', 'ajustes_transicion_rt54'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN estudio_id SET NOT NULL', v_tabla);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN estudio_id SET DEFAULT public.estudio_de_la_sesion()',
      v_tabla);
  END LOOP;
END
$$;

-- 3) El disparador de cada tabla con estudio
CREATE FUNCTION public._estudio_en_la_tabla(p_tabla regclass) RETURNS void
LANGUAGE plpgsql SET search_path = ''
AS $gen$
DECLARE
  v_tabla text := (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_funcion text := '_estudio_de_' || (SELECT relname FROM pg_class WHERE oid = p_tabla);
  v_cuerpo text := '';
  v_columnas text[] := ARRAY['estudio_id'];
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
END
$gen$;

-- Los datos que ya están tienen que cumplir lo mismo: si algún vínculo cruza estudios, la migración
-- se detiene y dice dónde (no se arregla solo: hay que mirarlo).
DO $$
DECLARE
  v record;
  v_cantidad bigint;
  v_problemas text := '';
BEGIN
  FOR v IN
    SELECT c.conrelid::regclass AS tabla, a.attname AS columna, c.confrelid::regclass AS padre
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.connamespace = 'public'::regnamespace AND c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.conrelid
                  AND x.attname = 'estudio_id' AND NOT x.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = c.confrelid
                  AND x.attname = 'estudio_id' AND NOT x.attisdropped)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN %s p ON p.id = t.%I WHERE p.estudio_id <> t.estudio_id',
      v.tabla, v.padre, v.columna) INTO v_cantidad;
    IF v_cantidad > 0 THEN
      v_problemas := v_problemas || format(' %s.%s: %s filas;', v.tabla, v.columna, v_cantidad);
    END IF;
  END LOOP;
  IF v_problemas <> '' THEN
    RAISE EXCEPTION 'Hay vínculos entre estudios distintos:%', v_problemas;
  END IF;
END
$$;

SELECT public._estudio_en_la_tabla(c.oid::regclass)
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid
              AND a.attname = 'estudio_id' AND NOT a.attisdropped)
ORDER BY c.relname;

-- Las funciones nuevas, cerradas (el rol de la app de la etapa 2 va a necesitar
-- GRANT EXECUTE sobre estudio_de_la_sesion, que usan el valor por defecto y las reglas).
REVOKE EXECUTE ON FUNCTION public.estudio_de_la_sesion() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.estudio_de_la_sesion() FROM anon;
    REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION public.estudio_de_la_sesion() FROM authenticated;
    REVOKE EXECUTE ON FUNCTION public._estudio_en_la_tabla(regclass) FROM authenticated;
  END IF;
END
$$;
