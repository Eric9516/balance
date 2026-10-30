-- Fase 1, paso 3 del login (docs/decisiones/0013): el código del celular (TOTP), obligatorio para
-- los dueños.
--
-- Qué resuelve: con solo la contraseña, quien la robe o la adivine entra. El dueño puede hacer todo
-- en su estudio: además de la contraseña, tiene que escribir el número de 6 cifras que muestra la
-- app de su celular (Google Authenticator, Microsoft Authenticator).
--
-- Qué hace:
-- 1) acceso.codigos: el secreto de cada persona, cifrado por la app con una clave que no está en la
--    base (CLAVE_CODIGOS): con una copia de la base sola no se pueden generar códigos. "activado"
--    vacío: a medio configurar. "ultimo_paso": el último código aceptado, que no se acepta dos veces.
-- 2) Sesiones a medio entrar: la contraseña está bien, falta el código. Duran 10 minutos, no ven
--    ningún dato (la app no declara su estudio) y 5 códigos equivocados las cierran.
-- 3) abrir_sesion y sesion_activa dicen si falta el código y si ya está configurado; funciones para
--    guardar el secreto a medio configurar, aceptar un código y anotar uno equivocado.
-- 4) fijar_contrasena puede mantener la sesión de quien la cambia (cierra las de los otros equipos):
--    así, quien entra con una contraseña provisoria elige la suya y sigue con el código sin volver
--    a entrar.
--
-- Cómo revertir: DROP TABLE acceso.codigos; quitar codigo_ok e intentos_codigo de acceso.sesiones;
-- volver a crear abrir_sesion, sesion_activa y fijar_contrasena como en 20261030180000_login_propio y
-- borrar las funciones nuevas (codigo_de_la_sesion, guardar_codigo, aceptar_codigo, codigo_fallido).

-- 1) Los códigos
CREATE TABLE acceso.codigos (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios (id) ON DELETE CASCADE,
  -- 12 de vector + 16 de etiqueta + el secreto (20)
  secreto bytea NOT NULL CHECK (octet_length(secreto) BETWEEN 40 AND 200),
  activado timestamptz(3),
  ultimo_paso bigint,
  creado timestamptz(3) NOT NULL DEFAULT now()
);
ALTER TABLE acceso.codigos ENABLE ROW LEVEL SECURITY;

-- 2) Sesiones a medio entrar
ALTER TABLE acceso.sesiones
  ADD COLUMN codigo_ok boolean NOT NULL DEFAULT true,
  ADD COLUMN intentos_codigo smallint NOT NULL DEFAULT 0;
ALTER TABLE acceso.sesiones ALTER COLUMN codigo_ok DROP DEFAULT;

-- 3) Las funciones
DROP FUNCTION acceso.abrir_sesion(uuid, bytea, boolean, text, text);
DROP FUNCTION acceso.sesion_activa(bytea);

-- Abre la sesión. Si la persona usa código (los dueños siempre), queda a medio entrar por 10
-- minutos hasta que lo escriba.
CREATE FUNCTION acceso.abrir_sesion(
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
  SELECT u.rol = 'DUENO' OR v_configurado INTO v_requiere FROM public.usuarios u WHERE u.id = p_usuario;
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

-- De quién es la sesión: nada si venció o si la persona o su estudio se desactivaron. Si falta el
-- código lo dice (y la app no muestra ningún dato). La estira solo si está completa: las de 8 horas,
-- cada 5 minutos de uso; las recordadas, una vez por día.
CREATE FUNCTION acceso.sesion_activa(p_huella bytea)
RETURNS TABLE (
  usuario_id uuid, estudio_id uuid, rol public."RolUsuario", contrasena_provisoria boolean,
  falta_codigo boolean, codigo_configurado boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.estudio_id, u.rol, coalesce(c.provisoria, true), NOT s.codigo_ok,
         EXISTS (SELECT 1 FROM acceso.codigos k WHERE k.usuario_id = u.id AND k.activado IS NOT NULL)
  FROM acceso.sesiones s
  JOIN public.usuarios u ON u.id = s.usuario_id
  JOIN public.estudios e ON e.id = u.estudio_id
  LEFT JOIN acceso.contrasenas c ON c.usuario_id = u.id
  WHERE s.huella = p_huella AND s.vence > now() AND u.activo AND e.activo;
  IF FOUND THEN
    UPDATE acceso.sesiones s SET usada = now(), vence = now() + acceso._duracion(s.recordar)
    WHERE s.huella = p_huella AND s.codigo_ok
      AND s.usada < now() - CASE WHEN s.recordar THEN interval '1 day' ELSE interval '5 minutes' END;
  END IF;
END
$$;

-- El secreto (cifrado) de quien tiene esta sesión, para revisar su código, y su correo (para el
-- nombre de la cuenta en la app del celular). Nada si la sesión venció.
CREATE FUNCTION acceso.codigo_de_la_sesion(p_huella bytea)
RETURNS TABLE (secreto bytea, activado boolean, ultimo_paso bigint, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT k.secreto, k.activado IS NOT NULL, k.ultimo_paso, u.email
  FROM acceso.sesiones s
  JOIN public.usuarios u ON u.id = s.usuario_id
  LEFT JOIN acceso.codigos k ON k.usuario_id = u.id
  WHERE s.huella = p_huella AND s.vence > now() AND u.activo
$$;

-- Guarda el secreto a medio configurar de quien tiene esta sesión. Si ya tiene uno activado, no:
-- cambiarlo es otra cosa (lo hace la plataforma o, más adelante, la persona desde su cuenta).
CREATE FUNCTION acceso.guardar_codigo(p_huella bytea, p_secreto bytea) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT s.usuario_id INTO v_usuario FROM acceso.sesiones s
  WHERE s.huella = p_huella AND s.vence > now();
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'La sesión venció.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO acceso.codigos (usuario_id, secreto) VALUES (v_usuario, p_secreto)
  ON CONFLICT (usuario_id) DO UPDATE SET secreto = excluded.secreto, creado = now()
    WHERE acceso.codigos.activado IS NULL;
END
$$;

-- Acepta un código ya revisado por la app (p_paso es su momento): lo activa si estaba a medio
-- configurar y completa la sesión. Un código ya usado (o uno anterior) no vale: devuelve false.
CREATE FUNCTION acceso.aceptar_codigo(p_huella bytea, p_paso bigint) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  SELECT s.usuario_id INTO v_usuario FROM acceso.sesiones s
  WHERE s.huella = p_huella AND s.vence > now();
  IF v_usuario IS NULL THEN
    RETURN false;
  END IF;
  UPDATE acceso.codigos k SET ultimo_paso = p_paso, activado = coalesce(k.activado, now())
  WHERE k.usuario_id = v_usuario AND (k.ultimo_paso IS NULL OR p_paso > k.ultimo_paso);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE acceso.sesiones s
  SET codigo_ok = true, intentos_codigo = 0, usada = now(), vence = now() + acceso._duracion(s.recordar)
  WHERE s.huella = p_huella;
  UPDATE public.usuarios u SET ultimo_ingreso = now() WHERE u.id = v_usuario;
  RETURN true;
END
$$;

-- Anota un código equivocado. Al quinto, cierra la sesión: hay que volver a entrar con la
-- contraseña. Devuelve si la sesión sigue.
CREATE FUNCTION acceso.codigo_fallido(p_huella bytea) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_intentos smallint;
BEGIN
  UPDATE acceso.sesiones s SET intentos_codigo = s.intentos_codigo + 1
  WHERE s.huella = p_huella RETURNING s.intentos_codigo INTO v_intentos;
  IF v_intentos >= 5 THEN
    DELETE FROM acceso.sesiones s WHERE s.huella = p_huella;
    RETURN false;
  END IF;
  RETURN v_intentos IS NOT NULL;
END
$$;

-- 4) La contraseña: mantiene la sesión de quien la cambia
DROP FUNCTION acceso.fijar_contrasena(uuid, text, boolean);
CREATE FUNCTION acceso.fijar_contrasena(
  p_usuario uuid, p_huella text, p_provisoria boolean, p_mantener bytea DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u
                 WHERE u.id = p_usuario AND u.estudio_id = public.estudio_de_la_sesion()) THEN
    RAISE EXCEPTION 'La persona no es de este estudio.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO acceso.contrasenas (usuario_id, huella, provisoria, cambiada)
  VALUES (p_usuario, p_huella, p_provisoria, now())
  ON CONFLICT (usuario_id) DO UPDATE
    SET huella = excluded.huella, provisoria = excluded.provisoria, cambiada = excluded.cambiada;
  DELETE FROM acceso.sesiones s
  WHERE s.usuario_id = p_usuario AND (p_mantener IS NULL OR s.huella <> p_mantener);
END
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  acceso.abrir_sesion(uuid, bytea, boolean, text, text),
  acceso.sesion_activa(bytea),
  acceso.codigo_de_la_sesion(bytea),
  acceso.guardar_codigo(bytea, bytea),
  acceso.aceptar_codigo(bytea, bigint),
  acceso.codigo_fallido(bytea),
  acceso.fijar_contrasena(uuid, text, boolean, bytea)
TO balancert_app;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA acceso FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
