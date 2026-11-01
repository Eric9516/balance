-- Anterior cargado a mano: se ajusta por inflación al autorizarlo.
--
-- Qué resuelve: los saldos del ejercicio anterior cargados a mano salían en el balance tal cual se
-- escribieron, sin llevarlos a moneda de cierre. Decisión del dueño del producto (2026-11-01): al
-- autorizarlos (todo cuadra) se ajustan por el coeficiente. Lo escrito no se pisa: queda en sus
-- columnas y el valor ajustado se calcula al leer, así se puede ver y corregir.
--
-- Qué hace:
-- 1) ejercicios_contables.anterior_ajustado_en: cuándo se ajustó. Null = se muestra lo cargado. Los
--    ejercicios ya autorizados quedan sin ajustar hasta autorizarlos de nuevo, porque pueden tener
--    importes ya ajustados a mano.
-- 2) Sin autorización no hay ajuste: un CHECK lo exige y un disparador lo quita cuando se anula la
--    autorización, sea cual sea el camino.
-- 3) Un asistente no puede ajustar: es parte de autorizar (migración 20261030235000).
--
-- Cómo revertir: DROP TRIGGER ajuste_sigue_autorizacion ON ejercicios_contables; DROP FUNCTION
-- public._ajuste_sigue_autorizacion(); volver a crear _ejercicio_por_rol como en
-- 20261030235000_permisos_por_rol; ALTER TABLE ejercicios_contables DROP COLUMN anterior_ajustado_en
-- (también quita el CHECK).

ALTER TABLE public.ejercicios_contables
  ADD COLUMN anterior_ajustado_en timestamptz(3),
  ADD CONSTRAINT ejercicios_contables_ajuste_con_autorizacion
    CHECK (anterior_ajustado_en IS NULL OR comparativo_autorizado_en IS NOT NULL);

CREATE FUNCTION public._ajuste_sigue_autorizacion() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.comparativo_autorizado_en IS NULL THEN
    NEW.anterior_ajustado_en := NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER ajuste_sigue_autorizacion BEFORE UPDATE OF comparativo_autorizado_en
  ON public.ejercicios_contables
  FOR EACH ROW EXECUTE FUNCTION public._ajuste_sigue_autorizacion();

CREATE OR REPLACE FUNCTION public._ejercicio_por_rol() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF public.rol_de_la_sesion() IS DISTINCT FROM 'ASISTENTE' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un asistente no puede eliminar un ejercicio: lo hace el dueño o un contador.'
      USING ERRCODE = '42501';
  END IF;
  IF (NEW.estado IS DISTINCT FROM OLD.estado
        AND (NEW.estado IN ('REVISION', 'CERRADO') OR OLD.estado IN ('REVISION', 'CERRADO')))
     OR (NEW.estados_confirmado AND NOT OLD.estados_confirmado)
     OR (NEW.pn_confirmado AND NOT OLD.pn_confirmado)
     OR (NEW.comparativo_autorizado_en IS NOT NULL
         AND NEW.comparativo_autorizado_en IS DISTINCT FROM OLD.comparativo_autorizado_en)
     OR (NEW.anterior_ajustado_en IS NOT NULL
         AND NEW.anterior_ajustado_en IS DISTINCT FROM OLD.anterior_ajustado_en) THEN
    RAISE EXCEPTION 'Un asistente no puede confirmar, autorizar, pasar a revisión ni cerrar un ejercicio: lo hace el dueño o un contador.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

REVOKE EXECUTE ON FUNCTION public._ajuste_sigue_autorizacion() FROM PUBLIC;
DO $$
DECLARE v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._ajuste_sigue_autorizacion() FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
