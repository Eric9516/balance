-- Login, paso 4 (docs/decisiones/0013): qué puede hacer cada rol, controlado también por la base.
--
-- Qué resuelve: hasta ahora cualquiera que entraba podía hacer todo. Decisión del dueño del
-- producto (2026-10-30):
--   - Dueño: todo, y es el único que maneja a la gente del estudio y los datos del estudio.
--   - Contador: arma, confirma y cierra los balances; configura auditores y clasificaciones.
--   - Asistente: carga datos (importa, clasifica, completa anexos y notas); no confirma estados ni
--     el E.E.P.N., no autoriza el anterior, no pasa a revisión ni cierra, no elimina ejercicios y
--     no toca auditores, clasificaciones ni secciones.
-- La app lo controla y lo explica; la base lo hace cumplir aunque la app se equivoque.
--
-- Qué hace:
-- 1) La app declara también quién es y con qué rol (app.usuario, app.rol), como ya declara el
--    estudio. Sin rol declarado (tareas internas y de la plataforma), no se limita nada por rol: la
--    separación entre estudios sigue igual.
-- 2) Disparadores "permiso_por_rol" en las tablas que cada rol no puede cambiar.
-- 3) fijar_contrasena: la propia, cualquiera; la de otro, solo el dueño.
-- 4) Para la pantalla de usuarios (solo el dueño): el estado del acceso de cada persona de su
--    estudio (contraseña provisoria, código del celular) y quitarle el código a quien perdió el
--    celular. Reglas de Gestión empresarial (web/db/03-usuarios.sql): nadie se elimina, se
--    desactiva ni se cambia el rol a sí mismo, y a un dueño no se lo elimina (primero se le cambia
--    el rol).
-- 5) Mi cuenta: cerrar la sesión en los demás equipos.
--
-- Cómo revertir: DROP TRIGGER permiso_por_rol en usuarios, estudios, estudio_configuracion,
-- auditores, rubros_base, rubros_grupo, gasto_seccion_config y ejercicios_contables; DROP FUNCTION
-- de _solo_dueno, _sin_asistente, _ejercicio_por_rol, rol_de_la_sesion, usuario_de_la_sesion,
-- acceso.estado_de_usuarios, acceso.quitar_codigo y acceso.cerrar_otras_sesiones; volver a crear
-- acceso.fijar_contrasena como en 20261030220000_codigo_del_celular.

-- 1) Quién usa la app (como estudio_de_la_sesion: sin SET search_path, para que se reemplace en
--    línea en cada consulta)
CREATE FUNCTION public.rol_de_la_sesion() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT nullif(pg_catalog.current_setting('app.rol', true), '') $$;

CREATE FUNCTION public.usuario_de_la_sesion() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(pg_catalog.current_setting('app.usuario', true), '')::pg_catalog.uuid $$;

-- 2) Los permisos por rol
-- Solo el dueño (o una tarea sin rol): la gente del estudio y los datos del estudio.
CREATE FUNCTION public._solo_dueno() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF public.rol_de_la_sesion() IN ('CONTADOR', 'ASISTENTE') THEN
    RAISE EXCEPTION 'Solo el dueño del estudio puede cambiar %.', TG_ARGV[0] USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

-- Todos menos el asistente: auditores, clasificaciones y secciones.
CREATE FUNCTION public._sin_asistente() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF public.rol_de_la_sesion() = 'ASISTENTE' THEN
    RAISE EXCEPTION 'Un asistente no puede cambiar %: lo hace el dueño o un contador.', TG_ARGV[0]
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

-- El ejercicio: el asistente lo carga y lo edita, pero no confirma, no autoriza, no pasa a
-- revisión ni cierra (ni lo reabre) y no lo elimina. Desconfirmar (porque cambió un dato) sí.
CREATE FUNCTION public._ejercicio_por_rol() RETURNS trigger
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
         AND NEW.comparativo_autorizado_en IS DISTINCT FROM OLD.comparativo_autorizado_en) THEN
    RAISE EXCEPTION 'Un asistente no puede confirmar, autorizar, pasar a revisión ni cerrar un ejercicio: lo hace el dueño o un contador.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

-- La gente del estudio: solo el dueño; nadie se elimina, se desactiva ni se cambia el rol a sí
-- mismo, y a un dueño no se lo elimina (primero se le cambia el rol).
CREATE FUNCTION public._usuarios_por_rol() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  -- Sin rol: una tarea interna o de la plataforma (por ejemplo, borrar un estudio entero)
  IF public.rol_de_la_sesion() IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF public.rol_de_la_sesion() IN ('CONTADOR', 'ASISTENTE') THEN
    -- Su propio nombre (Mi cuenta), sí
    IF TG_OP = 'UPDATE' AND OLD.id = public.usuario_de_la_sesion()
       AND NEW.rol = OLD.rol AND NEW.activo = OLD.activo AND NEW.email = OLD.email
       AND NEW.estudio_id = OLD.estudio_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Solo el dueño del estudio puede cambiar a la gente del estudio.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.id = public.usuario_de_la_sesion() THEN
      RAISE EXCEPTION 'No podés eliminar tu propia cuenta.' USING ERRCODE = '42501';
    END IF;
    IF OLD.rol = 'DUENO' THEN
      RAISE EXCEPTION 'No se puede eliminar a un dueño: primero cambiale el rol.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.id = public.usuario_de_la_sesion()
     AND (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo) THEN
    RAISE EXCEPTION 'No podés cambiar tu propio rol ni desactivarte: lo hace otro dueño.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR DELETE OR UPDATE OF estudio_id, email, nombre, rol, activo
  ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public._usuarios_por_rol();
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.estudios FOR EACH ROW EXECUTE FUNCTION public._solo_dueno('los datos del estudio');
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.estudio_configuracion FOR EACH ROW
  EXECUTE FUNCTION public._solo_dueno('la configuración del estudio');
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.auditores FOR EACH ROW EXECUTE FUNCTION public._sin_asistente('los auditores');
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.rubros_base FOR EACH ROW EXECUTE FUNCTION public._sin_asistente('las clasificaciones');
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.rubros_grupo FOR EACH ROW EXECUTE FUNCTION public._sin_asistente('las secciones');
CREATE TRIGGER permiso_por_rol BEFORE INSERT OR UPDATE OR DELETE
  ON public.gasto_seccion_config FOR EACH ROW
  EXECUTE FUNCTION public._sin_asistente('las secciones de gastos');
CREATE TRIGGER permiso_por_rol BEFORE UPDATE OR DELETE
  ON public.ejercicios_contables FOR EACH ROW EXECUTE FUNCTION public._ejercicio_por_rol();

-- 3) La contraseña: la propia, cualquiera; la de otro de su estudio, solo el dueño
CREATE OR REPLACE FUNCTION acceso.fijar_contrasena(
  p_usuario uuid, p_huella text, p_provisoria boolean, p_mantener bytea DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u
                 WHERE u.id = p_usuario AND u.estudio_id = public.estudio_de_la_sesion()) THEN
    RAISE EXCEPTION 'La persona no es de este estudio.' USING ERRCODE = '42501';
  END IF;
  IF public.rol_de_la_sesion() IN ('CONTADOR', 'ASISTENTE')
     AND p_usuario IS DISTINCT FROM public.usuario_de_la_sesion() THEN
    RAISE EXCEPTION 'Solo el dueño del estudio puede cambiar la contraseña de otra persona.'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO acceso.contrasenas (usuario_id, huella, provisoria, cambiada)
  VALUES (p_usuario, p_huella, p_provisoria, now())
  ON CONFLICT (usuario_id) DO UPDATE
    SET huella = excluded.huella, provisoria = excluded.provisoria, cambiada = excluded.cambiada;
  DELETE FROM acceso.sesiones s
  WHERE s.usuario_id = p_usuario AND (p_mantener IS NULL OR s.huella <> p_mantener);
END
$$;

-- 4) Para la pantalla de usuarios
-- El estado del acceso de cada persona del estudio de la sesión. Solo el dueño.
CREATE FUNCTION acceso.estado_de_usuarios()
RETURNS TABLE (usuario_id uuid, contrasena_provisoria boolean, codigo_activado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.rol_de_la_sesion() IN ('CONTADOR', 'ASISTENTE') THEN
    RAISE EXCEPTION 'Solo el dueño del estudio ve el acceso de su gente.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, coalesce(c.provisoria, true), k.activado IS NOT NULL
  FROM public.usuarios u
  LEFT JOIN acceso.contrasenas c ON c.usuario_id = u.id
  LEFT JOIN acceso.codigos k ON k.usuario_id = u.id
  WHERE u.estudio_id = public.estudio_de_la_sesion();
END
$$;

-- Quita el código del celular de una persona del estudio (lo configura de nuevo al entrar) y cierra
-- sus sesiones. Solo el dueño.
CREATE FUNCTION acceso.quitar_codigo(p_usuario uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios u
                 WHERE u.id = p_usuario AND u.estudio_id = public.estudio_de_la_sesion()) THEN
    RAISE EXCEPTION 'La persona no es de este estudio.' USING ERRCODE = '42501';
  END IF;
  IF public.rol_de_la_sesion() IN ('CONTADOR', 'ASISTENTE') THEN
    RAISE EXCEPTION 'Solo el dueño del estudio puede quitar el código de otra persona.'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM acceso.codigos k WHERE k.usuario_id = p_usuario;
  DELETE FROM acceso.sesiones s WHERE s.usuario_id = p_usuario;
END
$$;

-- 5) Mi cuenta: cierra las demás sesiones de quien tiene esta (la de este equipo queda abierta)
CREATE FUNCTION acceso.cerrar_otras_sesiones(p_huella bytea) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  DELETE FROM acceso.sesiones s
  WHERE s.huella <> p_huella
    AND s.usuario_id = (SELECT x.usuario_id FROM acceso.sesiones x WHERE x.huella = p_huella)
$$;

-- Permisos de las funciones
REVOKE EXECUTE ON FUNCTION public.rol_de_la_sesion(), public.usuario_de_la_sesion(),
  public._solo_dueno(), public._sin_asistente(), public._ejercicio_por_rol(),
  public._usuarios_por_rol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_de_la_sesion(), public.usuario_de_la_sesion() TO balancert_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  acceso.fijar_contrasena(uuid, text, boolean, bytea),
  acceso.estado_de_usuarios(),
  acceso.quitar_codigo(uuid),
  acceso.cerrar_otras_sesiones(bytea)
TO balancert_app;
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA acceso FROM %I', v_rol);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.rol_de_la_sesion(), public.usuario_de_la_sesion(), public._solo_dueno(), public._sin_asistente(), public._ejercicio_por_rol(), public._usuarios_por_rol() FROM %I', v_rol);
    END IF;
  END LOOP;
END
$$;
