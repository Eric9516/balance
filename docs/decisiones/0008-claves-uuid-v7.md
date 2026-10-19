# 0008. Claves UUIDv7 generadas por la base

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

Los identificadores eran texto de 25 caracteres (cuid) generado por la app:

- Ocupan más que un UUID (16 bytes fijos). Cada fila de `cuentas_contables` lleva cinco, igual que casi todos sus índices.
- Supabase compara textos con reglas de idioma (ICU, `en_US.UTF-8`); comparar dos UUID es comparar 16 bytes.
- PostgreSQL no sabe generar cuid: las funciones y disparadores de las Fases 2 y 3 no podrían insertar filas por su cuenta.
- Supabase Auth identifica a los usuarios con UUID, y las reglas por fila de la Fase 2 los comparan con columnas propias.

## Decisión

- Todas las tablas: `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid`. Toda referencia: `String @db.Uuid`.
- **La base genera los identificadores** con `uuidv7()`. PostgreSQL 18 la trae de fábrica; en 17 la define la migración `claves_uuid_v7` con el mismo nombre (48 bits de milisegundos, versión 7, variante RFC 9562, bits aleatorios de `gen_random_uuid()`).
- UUIDv7 empieza con la hora: se inserta ordenado al final de los índices, como el cuid.
- Las búsquedas que reciben identificadores de afuera validan con `esUuid` y responden "no encontrado"; los controles de permisos responden "sin permiso".

## Cómo se migró

Una sola transacción, escrita como procedimiento general en vez de 25 tablas a mano: mapa de identificador viejo a nuevo (cada nuevo con la fecha de creación de su fila, así el orden por identificador sigue siendo el orden de creación), definiciones de las claves foráneas guardadas y quitadas, conversión de los identificadores y de toda columna que los referencia (una referencia sin dueño corta la migración), conversión de las claves del comparativo manual que son el identificador de un rubro, y claves foráneas restauradas con su definición original.

Antes de producción se ensayó sobre una copia de los datos reales, con un caso agregado que hoy no existe (comparativo manual con clave de rubro). Resultado: 58 de 58 huellas iguales (contenido de cada tabla y destino de cada relación, sin mirar identificadores), todo UUID versión 7 en orden de creación, ningún identificador viejo en textos ni JSON, 30 claves foráneas restauradas. El ensayo encontró además un error de sintaxis en la función, que se corrigió antes de tocar producción.

## Resultado medido (escala media, 1,6 millones de cuentas)

| Medida | Con cuid | Con UUIDv7 | Cambio |
|---|---|---|---|
| Base completa | 622,6 MB | 504,2 MB | −19% |
| `cuentas_contables`, datos | 315,8 MB | 257,8 MB | −18% |
| `cuentas_contables`, índices | 263,8 MB | 209,2 MB | −21% |

La reducción quedó apenas por debajo del 20–30% estimado antes de medir. La velocidad local no cambió de forma medible: a esta escala todo entra en memoria, y la base de la medición compara texto byte a byte (`--locale=C`), así que no puede mostrar la ventaja frente a las reglas ICU de Supabase. Queda pendiente medir con la misma intercalación que Supabase.

## Consecuencias

- Tablas e índices más chicos: más datos en memoria a gran volumen.
- La base puede insertar filas por su cuenta (funciones, disparadores, auditoría).
- `uuidv7()` no se puede ejecutar como `PUBLIC`: el rol de la app de la Fase 2 necesita `GRANT EXECUTE`, porque el valor por defecto se calcula con los permisos de quien inserta.
- Los links guardados con identificadores viejos dejaron de funcionar (no había clientes).
- No hay vuelta automática: los identificadores viejos no se guardan. Revertir es restaurar una copia de seguridad previa.

## Alternativas descartadas

- **UUID versión 4:** totalmente aleatorio; cada inserción cae en cualquier parte del índice y lo fragmenta.
- **Enteros autoincrementales:** más chicos, pero revelan cantidades y orden de creación en las direcciones, y no sirven para unir datos de bases de distintos estudios.
- **Generar el UUID en la app (`@default(uuid(7))` de Prisma):** la base seguiría sin poder generar identificadores por su cuenta.
