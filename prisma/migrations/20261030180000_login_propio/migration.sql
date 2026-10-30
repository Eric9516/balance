-- Fase 1, paso 1 (login propio, sin Supabase Auth): usuarios, contraseñas, sesiones e intentos.
--
-- Qué resuelve: la app no tenía login (usaba "el único estudio"). Decisiones del dueño del
-- producto (2026-10-30): una cuenta por estudio (el correo es único en toda la plataforma), tres
-- roles (dueño, contador y asistente) y sesiones de 8 horas sin uso o de 30 días con "recordar
-- este equipo". El patrón es el de Gestión empresarial (web/db/02-sesiones.sql).
--
-- Qué hace:
-- 1) public.usuarios: quién entra, de qué estudio es y con qué rol. Lleva el estudio y su regla
--    (_estudio_en_la_tabla): cada estudio ve y maneja solo a su gente. Siempre queda al menos un
--    dueño activo en cada estudio que tenga usuarios. Reemplaza a usuarios_estudio, que no usaba
--    nadie (0 filas en producción el 2026-10-30).
-- 2) El esquema acceso, cerrado para la app: contraseñas (solo su huella Argon2id), sesiones (solo
--    la huella sha-256 del número que viaja en la cookie: una copia de la base no sirve para
--    entrar) e intentos fallidos. La app no lee ni escribe estas tablas: usa las funciones de
--    abajo, que corren como su dueño. Son las únicas que ven más de un estudio a propósito (entrar
--    es antes de saber de qué estudio es la persona) y cada una devuelve o toca solo lo justo.
-- 3) Freno a quien prueba contraseñas: 5 fallos seguidos de un correo o 30 de una dirección en 15
--    minutos.
--
-- Cómo revertir: DROP SCHEMA acceso CASCADE; DROP TABLE public.usuarios; DROP FUNCTION
-- public._siempre_un_dueno(); DROP TYPE "RolUsuario"; y volver a crear usuarios_estudio como en
-- 20261019115418 (vacía).

-- 1) Usuarios
DROP TABLE public.usuarios_estudio;
DROP TYPE "RolEstudio";

CREATE TYPE "RolUsuario" AS ENUM ('DUENO', 'CONTADOR', 'ASISTENTE');

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT uuidv7(),
  estudio_id uuid NOT NULL DEFAULT public.estudio_de_la_sesion(),
  email text NOT NULL,
  nombre text NOT NULL,
  rol "RolUsuario" NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  ultimo_ingreso timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  -- El correo se guarda como se compara: sin espacios y en minúsculas
  CONSTRAINT usuarios_email_normalizado
    CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%'),
  CONSTRAINT usuarios_nombre_largo CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX usuarios_email_key ON public.usuarios (email);
CREATE INDEX usuarios_estudio_id_idx ON public.usuarios (estudio_id);
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_estudio_id_fkey
  FOREIGN KEY (estudio_id) REFERENCES public.estudios (id) ON DELETE CASCADE ON UPDATE CASCADE;
SELECT public._estudio_en_la_tabla('public.usuarios');

-- Nunca sin dueño: al final de la transacción (así se puede pasar el rol de uno a otro), el estudio
-- de un dueño que dejó de serlo tiene que tener otro dueño activo. No cuenta si el estudio se borró.
CREATE FUNCTION public._siempre_un_dueno() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF OLD.rol = 'DUENO' AND OLD.activo
     AND EXISTS (SELECT 1 FROM public.estudios e WHERE e.id = OLD.estudio_id)
     AND NOT EXISTS (SELECT 1 FROM public.usuarios u
                     WHERE u.estudio_id = OLD.estudio_id AND u.rol = 'DUENO' AND u.activo) THEN
    RAISE EXCEPTION 'Cada estudio tiene que tener al menos un dueño activo: asigná otro antes de quitar este.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER siempre_un_dueno
  AFTER UPDATE OF rol, activo OR DELETE ON public.usuarios
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._siempre_un_dueno();

-- 2) El esquema acceso
CREATE SCHEMA acceso;
REVOKE ALL ON SCHEMA acceso FROM PUBLIC;
GRANT USAGE ON SCHEMA acceso TO balancert_app;

CREATE TABLE acceso.contrasenas (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios (id) ON DELETE CASCADE,
  huella text NOT NULL CHECK (huella LIKE '$argon2id$%'),
  -- Provisoria: la generó otro (el dueño o la plataforma) y hay que cambiarla al entrar
  provisoria boolean NOT NULL DEFAULT true,
  cambiada timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE acceso.sesiones (
  huella bytea PRIMARY KEY CHECK (octet_length(huella) = 32),
  usuario_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  creada timestamptz(3) NOT NULL DEFAULT now(),
  usada timestamptz(3) NOT NULL DEFAULT now(),
  vence timestamptz(3) NOT NULL,
  recordar boolean NOT NULL,
  ip text,
  navegador text
);
CREATE INDEX sesiones_usuario_id_idx ON acceso.sesiones (usuario_id);
CREATE INDEX sesiones_vence_idx ON acceso.sesiones (vence);

CREATE TABLE acceso.intentos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  momento timestamptz(3) NOT NULL DEFAULT now(),
  email text NOT NULL,
  ip text NOT NULL,
  ok boolean NOT NULL
);
CREATE INDEX intentos_email_idx ON acceso.intentos (email, momento DESC);
CREATE INDEX intentos_ip_idx ON acceso.intentos (ip, momento DESC);
-- Se agrega siempre al final: BRIN ocupa muy poco y sirve para borrar los viejos
CREATE INDEX intentos_momento_idx ON acceso.intentos USING brin (momento);

ALTER TABLE acceso.contrasenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceso.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE acceso.intentos ENABLE ROW LEVEL SECURITY;

-- Duración: 8 horas sin uso; con "recordar este equipo", 30 días.
CREATE FUNCTION acceso._duracion(p_recordar boolean) RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT CASE WHEN p_recordar THEN interval '30 days' ELSE interval '8 hours' END $$;

-- Lo justo para revisar una contraseña. Si el correo no existe no devuelve nada (y la app igual
-- tarda lo mismo, comparando contra una huella de relleno).
CREATE FUNCTION acceso.datos_para_entrar(p_email text)
RETURNS TABLE (usuario_id uuid, huella text, puede_entrar boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, c.huella, u.activo AND e.activo
  FROM public.usuarios u
  JOIN public.estudios e ON e.id = u.estudio_id
  LEFT JOIN acceso.contrasenas c ON c.usuario_id = u.id
  WHERE u.email = lower(btrim(p_email))
$$;

CREATE FUNCTION acceso.puede_intentar(p_email text, p_ip text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM acceso.intentos i
      WHERE i.email = lower(btrim(p_email)) AND NOT i.ok
        AND i.momento > now() - interval '15 minutes'
        AND i.momento > coalesce((SELECT max(x.momento) FROM acceso.intentos x
                                  WHERE x.email = lower(btrim(p_email)) AND x.ok), '-infinity')) < 5
    AND (SELECT count(*) FROM acceso.intentos i
          WHERE i.ip = coalesce(p_ip, '') AND NOT i.ok
            AND i.momento > now() - interval '15 minutes') < 30
$$;

CREATE FUNCTION acceso.registrar_intento(p_email text, p_ip text, p_ok boolean) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO acceso.intentos (email, ip, ok)
  VALUES (left(lower(btrim(p_email)), 254), left(coalesce(p_ip, ''), 100), p_ok);
  DELETE FROM acceso.intentos WHERE momento < now() - interval '30 days';
$$;

CREATE FUNCTION acceso.abrir_sesion(
  p_usuario uuid, p_huella bytea, p_recordar boolean, p_ip text, p_navegador text
) RETURNS timestamptz
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_vence timestamptz := now() + acceso._duracion(p_recordar);
BEGIN
  INSERT INTO acceso.sesiones (huella, usuario_id, vence, recordar, ip, navegador)
  VALUES (p_huella, p_usuario, v_vence, p_recordar, left(p_ip, 100), left(p_navegador, 300));
  UPDATE public.usuarios SET ultimo_ingreso = now() WHERE id = p_usuario;
  DELETE FROM acceso.sesiones WHERE vence < now();
  RETURN v_vence;
END
$$;

-- De quién es la sesión: nada si venció o si la persona o su estudio se desactivaron. La estira:
-- las de 8 horas, cada 5 minutos de uso; las recordadas, una vez por día.
CREATE FUNCTION acceso.sesion_activa(p_huella bytea)
RETURNS TABLE (usuario_id uuid, estudio_id uuid, rol public."RolUsuario", contrasena_provisoria boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.estudio_id, u.rol, coalesce(c.provisoria, true)
  FROM acceso.sesiones s
  JOIN public.usuarios u ON u.id = s.usuario_id
  JOIN public.estudios e ON e.id = u.estudio_id
  LEFT JOIN acceso.contrasenas c ON c.usuario_id = u.id
  WHERE s.huella = p_huella AND s.vence > now() AND u.activo AND e.activo;
  IF FOUND THEN
    UPDATE acceso.sesiones s SET usada = now(), vence = now() + acceso._duracion(s.recordar)
    WHERE s.huella = p_huella
      AND s.usada < now() - CASE WHEN s.recordar THEN interval '1 day' ELSE interval '5 minutes' END;
  END IF;
END
$$;

CREATE FUNCTION acceso.cerrar_sesion(p_huella bytea) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$ DELETE FROM acceso.sesiones WHERE huella = p_huella $$;

-- Fija la contraseña de una persona del estudio de la sesión (la suya o, siendo dueño, la de su
-- gente: eso lo controla la app) y cierra todas sus sesiones. De otro estudio, no.
CREATE FUNCTION acceso.fijar_contrasena(p_usuario uuid, p_huella text, p_provisoria boolean)
RETURNS void
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
  DELETE FROM acceso.sesiones WHERE usuario_id = p_usuario;
END
$$;

-- Las funciones: las de entrar, para la app; ninguna para el resto
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._siempre_un_dueno() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  acceso.datos_para_entrar(text),
  acceso.puede_intentar(text, text),
  acceso.registrar_intento(text, text, boolean),
  acceso.abrir_sesion(uuid, bytea, boolean, text, text),
  acceso.sesion_activa(bytea),
  acceso.cerrar_sesion(bytea),
  acceso.fijar_contrasena(uuid, text, boolean)
TO balancert_app;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA acceso FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA acceso FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public._siempre_un_dueno() FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
