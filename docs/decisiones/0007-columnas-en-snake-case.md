# 0007. Columnas en snake_case

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

Las tablas ya estaban en snake_case, pero las columnas estaban en camelCase (`"ejercicioId"`, `"fechaCierre"`). En SQL escrito a mano eso obliga a poner comillas en cada nombre, y un olvido falla de forma confusa: PostgreSQL pasa a minúsculas todo lo que no lleva comillas. Las reglas por fila, las restricciones CHECK y los disparadores de la Fase 2, y el historial de auditoría de la Fase 3, se escriben a mano.

## Decisión

- Todas las columnas van en snake_case. En `schema.prisma` cada campo camelCase lleva `@map("snake_case")`.
- El código de la app no cambia: Prisma sigue usando los nombres de campo de siempre.
- Los índices y claves foráneas usan los nombres que deriva Prisma de las columnas nuevas.
- Los tipos enumerados conservan su nombre.

## Cómo se hizo

La migración `columnas_snake_case` renombra 200 columnas con `RENAME COLUMN`, escrito a mano. Es solo metadato: no reescribe ni copia datos y conserva índices, claves y valores por defecto. Si se deja que Prisma lo genere, lo interpreta como "borrar columna y crear otra" y se pierden los datos. Después renombra 32 índices y 30 claves foráneas, con el SQL que generó `prisma migrate diff`, y el historial queda sin deriva.

## Consecuencias

- El SQL escrito a mano es más simple y menos propenso a errores.
- **Renombrar columnas en producción con clientes exige otro procedimiento.** Ahora se pudo hacer en un paso porque no hay estudios usando la app. Con clientes, un renombre se hace en etapas (agregar, copiar, cambiar el código, quitar) para que no haya un momento en que la app y la base no coincidan.

## Alternativas descartadas

- **Dejar camelCase:** cada línea de SQL a mano necesitaría comillas para siempre.
