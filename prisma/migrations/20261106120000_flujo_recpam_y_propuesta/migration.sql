-- El Estado de Flujo de Efectivo: las líneas que arma la app y la revisión del RECPAM.
--
-- Qué resuelve: el dueño del producto (2026-11-06) definió cómo se completa el flujo con lo que el
-- balance ya tiene, y que la línea "Resultados financieros y por tenencia generados por el efectivo
-- (incluye RECPAM)" la calcule la app como la diferencia para que el estado cierre, pendiente de
-- revisión hasta que alguien la confirme.
--
-- Qué hace:
-- 1) flujo_caja_items.origen: de dónde sale cada línea. NULL = la escribe el contador (como hasta
--    ahora); un valor = la arma la app (RECPAM, o una de las que propone desde el balance). Cada
--    origen va una sola vez por flujo (el índice único no cuenta los NULL).
-- 2) flujo_caja_ejercicio.recpam_revisado (el importe que se revisó), recpam_revisado_por y
--    recpam_revisado_en. Si el RECPAM cambia, ya no coincide con lo revisado y vuelve a quedar
--    pendiente. La base pone quién y cuándo desde la sesión, y no deja que un asistente lo confirme.
-- 3) A cada flujo con líneas se le marca su línea de RECPAM (la que ya tenía ese nombre) o se le
--    agrega una al final de las actividades operativas.
--
-- Cómo revertir: DROP TRIGGER permiso_por_rol ON public.flujo_caja_ejercicio; DROP FUNCTION
-- public._flujo_por_rol(); ALTER TABLE public.flujo_caja_ejercicio DROP COLUMN recpam_revisado,
-- DROP COLUMN recpam_revisado_por, DROP COLUMN recpam_revisado_en; SELECT
-- public._estudio_en_la_tabla('public.flujo_caja_ejercicio'); DROP INDEX
-- public.flujo_caja_items_flujo_id_origen_key; ALTER TABLE public.flujo_caja_items DROP COLUMN
-- origen; DROP TYPE "OrigenLineaFlujo". Las líneas de RECPAM agregadas quedan como líneas comunes.

-- 1) De dónde sale cada línea
CREATE TYPE "OrigenLineaFlujo" AS ENUM (
  'RECPAM',
  'COBROS_VENTAS',
  'PAGOS_PROVEEDORES',
  'PAGOS_PERSONAL',
  'PAGOS_IMPUESTOS',
  'PAGOS_GANANCIAS',
  'VARIACION_ACTIVOS',
  'VARIACION_PASIVOS',
  'COBROS_BIENES_USO',
  'PAGOS_BIENES_USO',
  'APORTES',
  'PRESTAMOS_RECIBIDOS',
  'PRESTAMOS_CANCELADOS'
);

ALTER TABLE public.flujo_caja_items ADD COLUMN origen "OrigenLineaFlujo";
CREATE UNIQUE INDEX flujo_caja_items_flujo_id_origen_key
  ON public.flujo_caja_items (flujo_id, origen);

-- 2) La revisión del RECPAM
ALTER TABLE public.flujo_caja_ejercicio
  ADD COLUMN recpam_revisado numeric,
  ADD COLUMN recpam_revisado_por uuid,
  ADD COLUMN recpam_revisado_en timestamptz(3),
  ADD CONSTRAINT flujo_caja_ejercicio_recpam_revisado_rango CHECK (abs(recpam_revisado) < 1e16),
  ADD CONSTRAINT flujo_caja_ejercicio_recpam_revision_completa
    CHECK ((recpam_revisado IS NULL) = (recpam_revisado_en IS NULL)),
  ADD CONSTRAINT flujo_caja_ejercicio_recpam_revisado_por_fkey FOREIGN KEY (recpam_revisado_por)
    REFERENCES public.usuarios (id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX flujo_caja_ejercicio_recpam_revisado_por_idx
  ON public.flujo_caja_ejercicio (recpam_revisado_por);

-- El estudio de quien revisó tiene que ser el del flujo (el disparador del estudio suma el vínculo)
SELECT public._estudio_en_la_tabla('public.flujo_caja_ejercicio');

-- Quién y cuándo los pone la base. El asistente carga el flujo pero no confirma la revisión.
CREATE FUNCTION public._flujo_por_rol() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  -- Solo corre cuando se escribe alguna de las tres columnas (UPDATE OF): es una revisión, o
  -- quitarla porque el flujo cambió (eso lo puede hacer cualquiera).
  IF NEW.recpam_revisado IS NULL THEN
    NEW.recpam_revisado_por := NULL;
    NEW.recpam_revisado_en := NULL;
    RETURN NEW;
  END IF;
  IF public.rol_de_la_sesion() = 'ASISTENTE' THEN
    RAISE EXCEPTION 'Un asistente no puede dar por revisado el RECPAM del Estado de Flujo de Efectivo: lo hace el dueño o un contador.'
      USING ERRCODE = '42501';
  END IF;
  NEW.recpam_revisado_por := coalesce(public.usuario_de_la_sesion(), NEW.recpam_revisado_por);
  NEW.recpam_revisado_en := pg_catalog.now();
  RETURN NEW;
END
$$;

CREATE TRIGGER permiso_por_rol
  BEFORE INSERT OR UPDATE OF recpam_revisado, recpam_revisado_por, recpam_revisado_en
  ON public.flujo_caja_ejercicio FOR EACH ROW EXECUTE FUNCTION public._flujo_por_rol();

REVOKE EXECUTE ON FUNCTION public._flujo_por_rol() FROM PUBLIC;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._flujo_por_rol() FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;

-- 3) La línea de RECPAM de cada flujo con líneas: se marca la que ya tenía ese nombre (la primera,
--    si hubiera dos) y, si no tenía, se agrega al final de las actividades operativas.
UPDATE public.flujo_caja_items i
SET origen = 'RECPAM'
WHERE i.id IN (
  SELECT DISTINCT ON (x.flujo_id) x.id
  FROM public.flujo_caja_items x
  WHERE NOT x.es_subtotal
    AND x.seccion = 'ACTIVIDADES_OPERATIVAS'
    AND lower(regexp_replace(x.concepto, '\s+', ' ', 'g'))
        = 'resultados financieros y por tenencia generados por el efectivo (incluye recpam)'
  ORDER BY x.flujo_id, x.orden
);

INSERT INTO public.flujo_caja_items
  (flujo_id, estudio_id, seccion, concepto, origen, orden, updated_at)
SELECT f.id, f.estudio_id, 'ACTIVIDADES_OPERATIVAS',
       'Resultados financieros y por tenencia generados por el efectivo (incluye RECPAM)',
       'RECPAM',
       (SELECT coalesce(max(x.orden), 0) + 1 FROM public.flujo_caja_items x WHERE x.flujo_id = f.id),
       now()
FROM public.flujo_caja_ejercicio f
WHERE EXISTS (SELECT 1 FROM public.flujo_caja_items x WHERE x.flujo_id = f.id AND NOT x.es_subtotal)
  AND NOT EXISTS (SELECT 1 FROM public.flujo_caja_items x WHERE x.flujo_id = f.id AND x.origen = 'RECPAM');
