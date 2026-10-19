# 0003. La base nace cerrada a los roles de la API de Supabase

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

Supabase les da por defecto a los roles `anon` y `authenticated` todos los permisos sobre las tablas que se crean en el esquema `public`. El 2026-10-18 se verificó que ninguna tabla tenía reglas por fila: con la dirección del proyecto y la clave pública se podían leer, cambiar o borrar las 27 tablas por la API REST.

## Decisión

- Todas las tablas tienen reglas por fila activadas. Sin políticas, los roles de la API no ven ninguna fila.
- `anon` y `authenticated` no tienen permisos de tabla ni de secuencia, tampoco sobre lo que se cree después.
- Se aplicó en la migración `20261019001827_cerrar_acceso_anonimo`, que corre igual en PostgreSQL común y en Supabase.
- Toda tabla nueva nace así. Abrir algo exige una política explícita y probada.

## Consecuencias

- La app no usa esos roles (se conecta con Prisma como dueña de las tablas), así que no cambió nada para el usuario.
- El permiso por defecto de ejecutar funciones sigue abierto para `anon` y `authenticated`. Hoy no hay funciones en la base; se cierra en la Fase 2, con las primeras.

## Alternativas descartadas

- **Apagar la API de datos de Supabase en el panel:** depende de una configuración manual por proyecto que la base no puede comprobar.
