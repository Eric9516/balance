-- El formato del Anexo de Bienes de Uso, en cada balance (reemplaza la preferencia del estudio de
-- 20261104150000).
--
-- Qué resuelve: el dueño del producto (2026-11-05) prefirió elegirlo en cada balance, desde el paso
-- Bienes de Uso con una vista previa con los datos cargados, en vez de una opción del estudio en
-- Configuración que se elegía a ciegas.
--
-- Qué hace:
-- 1) ejercicios_contables.anexo_bienes_uso, 'UN_CUADRO' para todos los que existen (lo que sale
--    hoy). Un ejercicio nuevo hereda el del anterior de la misma sociedad (lo hace la app al crearlo).
-- 2) Un asistente no lo cambia: lo elige el dueño o un contador (como confirmar o cerrar).
-- La columna estudio_configuracion.anexo_bienes_uso queda sin uso. Se quita en una migración aparte,
-- junto con color_primario, para no cortar la app mientras se publica.
--
-- Cómo revertir: ALTER TABLE ejercicios_contables DROP COLUMN anexo_bienes_uso; y volver a crear
-- public._ejercicio_por_rol() como en 20261101120000_anterior_ajustado.

ALTER TABLE public.ejercicios_contables
  ADD COLUMN anexo_bienes_uso "FormatoAnexoBienesUso" NOT NULL DEFAULT 'UN_CUADRO';

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
  IF NEW.anexo_bienes_uso IS DISTINCT FROM OLD.anexo_bienes_uso THEN
    RAISE EXCEPTION 'Un asistente no puede cambiar el formato del Anexo de Bienes de Uso: lo elige el dueño o un contador.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
