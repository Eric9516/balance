# Rendimiento de la base de datos

BalanceRT tiene que seguir rápida con muchísimos datos. Este documento guarda la **línea base** contra la que se compara cada cambio, explica cómo se mide y lista lo que hay para mejorar. Decisión de fondo: [0005](decisiones/0005-medir-antes-de-optimizar.md).

## Cómo se mide

```bash
pnpm rendimiento                              # escala media (por defecto)
RENDIMIENTO_ESCALA=rapida pnpm rendimiento    # 50.000 cuentas, unos 35 segundos
RENDIMIENTO_ESCALA=grande pnpm rendimiento    # 22,5 millones de cuentas, más de una hora
```

- Levanta un **PostgreSQL 17 real** (`embedded-postgres`) en una carpeta temporal, aplica todas las migraciones y siembra un estudio sintético reproducible.
- Ejecuta las operaciones de las pantallas principales **con el código real de la app**, encadenadas igual que en cada página.
- Mide cada operación sin red y a través de un intermediario que simula la latencia de Supabase. De ahí salen los **viajes**: idas y vueltas secuenciales a la base.
- Reproduce cada consulta con `EXPLAIN ANALYZE` y marca las que leen entera una tabla grande.
- Lista las claves foráneas sin índice y las tablas más pesadas.
- El informe queda en `.rendimiento/<escala>.md` y `.json` (fuera de git).

| Escala | Sociedades | Ejercicios por sociedad | Cuentas por ejercicio | Cuentas en total |
|---|---|---|---|---|
| rapida | 20 | 5 | 500 | 50.000 |
| media | 200 | 10 | 800 | 1.600.000 |
| grande | 1.000 | 15 | 1.500 | 22.500.000 |

Cada ejercicio trae además 9 movimientos de E.E.P.N., 5 categorías de bienes de uso, costo de ventas, flujo con 12 ítems, 8 notas con 4 detalles cada una, 3 anexos aceptados, 2 validaciones y su importación. Los ejercicios de cada sociedad están vinculados año a año.

## Línea base (2026-10-19, escala media)

Antes de la Fase 0. Computadora de desarrollo con Windows; los tiempos sirven para comparar entre corridas, no como valor absoluto. "Estimado con red" suma 30 ms por viaje, como con Supabase en otra ciudad.

| Operación | Consultas | Repetidas | Viajes | Local mediana (ms) | Local p95 (ms) | Estimado con red (ms) |
|---|---|---|---|---|---|---|
| Lista de sociedades | 1 | 0 | 1 | 2.8 | 7.5 | 33 |
| Lista de ejercicios de una sociedad | 2 | 0 | 3 | 2.0 | 2.4 | 92 |
| Página del ejercicio: datos base | 16 | 1 | 2 | 7.8 | 9.2 | 68 |
| Paso Estados | 27 | 3 | 9 | 36 | 46 | 306 |
| Paso Anterior con compuerta | 35 | 6 | 13 | 39 | 47 | 429 |
| Documento imprimible completo | 46 | 9 | 12 | 43 | 52 | 403 |
| Cadena de ejercicios anteriores (10 años) | 10 | 0 | 10 | 6.0 | 13 | 306 |
| Importar 800 cuentas (reemplazo) | 2 | 0 | 4 | 146 | 164 | 266 |

Ninguna operación lee entera una tabla grande. `cuentas_contables` ocupa 551 MB con sus índices para 1,6 millones de filas, unos 345 bytes por cuenta.

## Lo que muestra

1. **La base escala bien por ejercicio.** Con 32 veces más cuentas que la escala rápida, cada operación tarda casi lo mismo: los índices por ejercicio hacen su trabajo.
2. **El cuello de botella es la red, no la base.** En las pantallas pesadas, cerca del 90% del tiempo estimado son viajes. Reducir viajes es la mejora más grande disponible.
3. **Cada relación incluida cuesta un viaje más.** Cuando una consulta trae una relación (`include`), Prisma hace una segunda consulta después de la primera. Leer las cuentas con su rubro, o un ejercicio con su auditor, son dos viajes en vez de uno. La alternativa de Prisma que lo resuelve en una consulta (`relationJoins`) sigue en prueba, y CLAUDE.md pide no usar nada experimental.
4. **La cadena de ejercicios anteriores crece con los años.** Hace una consulta por año, una detrás de otra: con 15 años son 15 viajes.
5. **Hay consultas repetidas** en las operaciones pesadas. En una página real, `cache()` de React deduplica las funciones que lo usan; hay que confirmar cuáles quedan.
6. **Hay claves foráneas sin índice en la tabla más grande.** Borrar o reasignar un rubro, o borrar una importación, obliga a recorrer todas las cuentas del estudio.

## Claves foráneas sin índice

| Tabla | Columna | Filas en escala media | Impacto |
|---|---|---|---|
| cuentas_contables | rubroBaseId | 1.600.000 | Alto: borrar un rubro o validar si está en uso recorre todas las cuentas |
| cuentas_contables | importacionExcelId | 1.600.000 | Alto: borrar una importación recorre todas las cuentas |
| notas_ejercicio | plantillaNotaId | 16.000 | Bajo |
| ejercicios_contables | auditorId | 2.000 | Bajo |
| importaciones_excel | mapeoExcelId | 2.000 | Bajo |
| rubros_base, mapeos_excel, plantillas_nota, rubros_activos_estudio, usuarios_estudio | varias | menos de 100 | Muy bajo |

## Próximas mejoras propuestas

Cada una se mide contra esta línea base antes de darla por buena.

| Mejora | Qué cambia | Efecto esperado |
|---|---|---|
| Índices para las claves foráneas | Índices en las columnas de la tabla de arriba, parciales donde la columna suele estar vacía | Borrar o reasignar rubros e importaciones deja de recorrer la tabla entera |
| Cuentas sin `include` de rubro | El rubro de cada cuenta se toma del catálogo de rubros, que ya está cargado | Un viaje menos en cada carga de cuentas y menos datos por fila |
| Ejercicio sin `include` de auditor | El auditor se pide solo donde se usa, en paralelo | Un viaje menos en cada apertura de ejercicio |
| Cadena de anteriores en una consulta | Una consulta recursiva en vez de una por año | De N viajes a uno |
| Consultas repetidas | Identificar y eliminar las que `cache()` no deduplica | Menos consultas en Estados, Anterior y Documento |
| Claves UUIDv7 (Fase 0, paso 4) | Claves de 16 bytes en vez de texto de 25 caracteres | Filas e índices más chicos en `cuentas_contables` |

## Pendiente de medir

- La escala grande completa.
- Operaciones de escritura además de la importación: clasificar cuentas, guardar anexos y confirmar estados.
- Borrar un rubro y una importación, antes y después de los índices.
- Correr la escala rápida en la CI en cada cambio.
