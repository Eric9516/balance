-- Fase 1, paso 2 del login (docs/decisiones/0013): sin sesión, la app no ve ningún estudio.
--
-- Qué resuelve: hasta el login, si la base tenía un solo estudio y la app no declaraba ninguno, la
-- base usaba ese (20261030150000_separacion_por_estudio). Con el login, el estudio sale siempre de
-- la sesión de quien usa la app: una pantalla sin sesión no tiene que ver nada, aunque la base
-- tenga un solo estudio.
--
-- Qué hace: estudio_de_la_sesion() devuelve solo el estudio declarado (sigue sin SET search_path,
-- para que PostgreSQL la reemplace por su expresión en cada consulta) y se borra _estudio_unico().
--
-- Cómo revertir: volver a crear _estudio_unico() y estudio_de_la_sesion() como en
-- 20261030150000_separacion_por_estudio, con sus permisos.

CREATE OR REPLACE FUNCTION public.estudio_de_la_sesion() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(pg_catalog.current_setting('app.estudio', true), '')::pg_catalog.uuid
$$;

DROP FUNCTION public._estudio_unico();
