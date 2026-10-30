# 0011. Una sola app y una sola base para todos los estudios

- **Estado:** Aceptada
- **Fecha:** 2026-10-29
- **Reemplaza a:** [0001](0001-un-proyecto-por-estudio.md)

## Contexto

La decisión 0001 separaba a los estudios con un proyecto de Supabase y una instalación por estudio. Su costo: un instalador y un actualizador para muchas bases, un costo fijo por estudio, ningún acceso común y un contador que trabaja para varios estudios necesita una cuenta en cada uno.

El dueño del producto quiere un único acceso para todos los usuarios, con la separación de datos entre estudios como requisito más crítico. Su otro producto (Gestión empresarial) pasó el 2026-10-28 de un proyecto por cliente a una sola app y una sola base, con la separación impuesta por la base, y descartó "una base por empresa como regla" porque multiplica el mantenimiento.

El riesgo que señalaba 0001 (un error de filtro mezcla datos de clientes distintos) se ataca haciendo que la separación la imponga la base, no la app.

## Decisión

- Una sola app y una sola base para todos los estudios, con un único acceso.
- Cada tabla con datos de un estudio lleva `estudio_id` obligatorio y una regla por fila **restrictiva** (`solo_su_estudio`) que se suma a las demás, con `force row level security` (vale también para el dueño de las tablas).
- Los vínculos entre tablas llevan el estudio: clave compuesta `(estudio_id, x_id) → (estudio_id, id)`. La base rechaza apuntar a una fila de otro estudio aunque se conozca su id.
- La app se conecta con un rol sin permisos propios ni permiso para saltear las reglas, y en cada transacción le dice a la base quién es el usuario y de qué estudio. Las funciones `security definer` corren con un rol que tampoco puede saltearlas; las pocas que ven todos los estudios a propósito filtran a mano y están listadas.
- **Prueba de espionaje obligatoria:** con dos estudios, desde uno se intenta leer y cambiar lo del otro en cada tabla y con cada función. Falla si una tabla nueva no lleva el estudio, si le falta la regla, si un vínculo no incluye el estudio o si una función saltea las reglas.
- El estudio que exija una base propia ("plan dedicado") la tiene con el mismo código.
- El patrón es el de Gestión empresarial ("varias empresas"): se copian los patrones, nunca se modifica ese proyecto.

## Consecuencias

- Una sola versión, una sola cadena de migraciones y una sola copia de seguridad.
- Un contador puede tener una sola cuenta aunque trabaje para más de un estudio (si se habilita, al diseñar el login).
- La separación depende de que las reglas estén bien: la vigilan la base (regla restrictiva forzada y claves compuestas) y la prueba de espionaje, no la memoria de quien programa.
- Velocidad: todos los estudios comparten la base. Los índices empiezan por `estudio_id` donde las consultas filtran por estudio, y `pnpm rendimiento` se mide con varios estudios. Declarar el usuario en cada transacción suma idas a la base: las consultas de una pantalla van juntas en una sola transacción, y se mide antes de darlo por bueno.
- Restaurar un estudio sin tocar a los demás necesita exportar e importar por estudio (también lo pide la Ley 25.326): queda como trabajo a hacer.
- Los hashes de las versiones emitidas (Fase 3) siguen haciendo falta.

## Alternativas descartadas

- **Un proyecto y una instalación por estudio (0001):** multiplica la instalación, la actualización y el costo, y no permite un acceso común.
- **Una app que elige la base según el usuario:** guarda las credenciales de todas las bases, y un error al elegir la base rompe el aislamiento.
- **Filtrar por estudio solo en la app:** un olvido en una sola consulta expone los datos de otro estudio.
