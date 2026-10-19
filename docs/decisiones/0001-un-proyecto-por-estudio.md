# 0001. Un proyecto de Supabase y una instalación de la app por estudio

- **Estado:** Aceptada
- **Fecha:** 2026-10-18

## Contexto

BalanceRT se vende a estudios contables, que trabajan con secreto profesional. Una base compartida entre estudios obliga a filtrar por estudio en cada consulta y en cada regla: un solo error expone los datos de un estudio a otro, y restaurar un estudio sin tocar a los demás es muy difícil.

## Decisión

- Cada estudio tiene su propio proyecto de Supabase (base, login y archivos), creado con el correo del estudio y a su nombre. Puede vivir en la cuenta del estudio o en una organización propia: el código es el mismo.
- Cada estudio tiene su propia instalación de la app, con el mismo código y la misma versión para todos. Lo propio de cada estudio sale de su configuración.
- Las actualizaciones se aplican por tandas: un estudio de prueba, uno o dos reales y después el resto. Un panel central registra qué versión tiene cada estudio.

## Consecuencias

- Aislamiento total entre estudios, daño acotado si se compromete una base y restauración por estudio.
- Un estudio grande no le quita velocidad a uno chico.
- Las protecciones no pueden depender de que el estudio no tenga las claves de administración de su proyecto: los hashes de las versiones emitidas y del historial se guardan en un servicio central propio, la licencia se verifica en el servidor propio y un chequeo periódico compara cada base contra el esquema esperado.
- Hace falta un instalador y un actualizador para muchas bases, y un costo fijo por estudio (el plan gratuito de Supabase no tiene copias restaurables).
- Un contador que trabaja para varios estudios tiene una cuenta en cada uno.

## Alternativas descartadas

- **Una base compartida con filtro por estudio:** un error de filtro mezcla datos de clientes distintos, y el rendimiento de todos depende del estudio más grande.
- **Una sola app que elige la base según el usuario:** guarda las credenciales de todas las bases, y un error al elegir la base rompe el aislamiento.
