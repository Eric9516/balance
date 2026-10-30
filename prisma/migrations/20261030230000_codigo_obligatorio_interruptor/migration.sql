-- Login, paso 3 (docs/decisiones/0013): el código del celular obligatorio para los dueños pasa a ser
-- un interruptor de la plataforma, apagado por ahora.
--
-- Qué resuelve: decisión del dueño del producto (2026-10-30): mientras la app no se use con más
-- estudios, que el dueño no tenga que configurar el código; cuando esté por usarse, se prende.
--
-- Qué hace:
-- 1) acceso.ajustes: una sola fila con los ajustes del acceso de toda la plataforma. Por ahora,
--    codigo_obligatorio_duenos (apagado). Se prende con:
--    UPDATE acceso.ajustes SET codigo_obligatorio_duenos = true;
-- 2) abrir_sesion pide el código a quien lo tenga activado (siempre) y a los dueños solo si el
--    interruptor está prendido.
--
-- Cómo revertir: volver a crear abrir_sesion como en 20261030220000_codigo_del_celular (dueños
-- siempre) y DROP TABLE acceso.ajustes.

-- 1) Los ajustes de la plataforma
CREATE TABLE acceso.ajustes (
  unica boolean PRIMARY KEY DEFAULT true CHECK (unica),
  codigo_obligatorio_duenos boolean NOT NULL DEFAULT false,
  actualizado timestamptz(3) NOT NULL DEFAULT now()
);
INSERT INTO acceso.ajustes DEFAULT VALUES;
ALTER TABLE acceso.ajustes ENABLE ROW LEVEL SECURITY;

-- 2) Abrir la sesión
CREATE OR REPLACE FUNCTION acceso.abrir_sesion(
  p_usuario uuid, p_huella bytea, p_recordar boolean, p_ip text, p_navegador text
) RETURNS TABLE (sesion_vence timestamptz, falta_codigo boolean, codigo_configurado boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_configurado boolean;
  v_requiere boolean;
  v_vence timestamptz;
BEGIN
  SELECT EXISTS (SELECT 1 FROM acceso.codigos c WHERE c.usuario_id = p_usuario AND c.activado IS NOT NULL)
    INTO v_configurado;
  SELECT v_configurado
         OR (u.rol = 'DUENO' AND coalesce((SELECT a.codigo_obligatorio_duenos FROM acceso.ajustes a), false))
    INTO v_requiere
  FROM public.usuarios u WHERE u.id = p_usuario;
  v_vence := now() + CASE WHEN v_requiere THEN interval '10 minutes' ELSE acceso._duracion(p_recordar) END;
  INSERT INTO acceso.sesiones (huella, usuario_id, vence, recordar, ip, navegador, codigo_ok)
  VALUES (p_huella, p_usuario, v_vence, p_recordar, left(p_ip, 100), left(p_navegador, 300), NOT v_requiere);
  IF NOT v_requiere THEN
    UPDATE public.usuarios u SET ultimo_ingreso = now() WHERE u.id = p_usuario;
  END IF;
  DELETE FROM acceso.sesiones s WHERE s.vence < now();
  RETURN QUERY SELECT v_vence, v_requiere, v_configurado;
END
$$;

REVOKE EXECUTE ON FUNCTION acceso.abrir_sesion(uuid, bytea, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acceso.abrir_sesion(uuid, bytea, boolean, text, text) TO balancert_app;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON acceso.ajustes FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION acceso.abrir_sesion(uuid, bytea, boolean, text, text) FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
