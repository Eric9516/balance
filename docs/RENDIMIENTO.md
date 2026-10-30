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

Antes de la Fase 0 y de las mejoras rápidas. Computadora de desarrollo con Windows; los tiempos sirven para comparar entre corridas, no como valor absoluto. "Estimado con red" suma 30 ms por viaje, como con Supabase en otra ciudad.

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
6. **Había 10 claves foráneas sin índice**, dos en la tabla más grande (`rubroBaseId` e `importacionExcelId` de `cuentas_contables`). Borrar o reasignar un rubro, o borrar una importación, obligaba a recorrer todas las cuentas del estudio.

## Mejoras rápidas (2026-10-19)

Qué se cambió:

- **Índices para las 10 claves foráneas que no tenían** (migración `20261019021426_indices_claves_foraneas`). Ninguna clave foránea queda sin índice, y `pnpm rendimiento` ahora falla si aparece una.
- **Cuentas con el nombre de su rubro en un solo viaje:** los rubros se piden en paralelo con las cuentas, no con `include`.
- **Ejercicios con su auditor en un solo viaje**, tanto al abrir uno como en la lista de la sociedad.
- **Notas con sus detalles en un solo viaje**, y con `cache()`: la página, los estados y el documento ya no las piden dos veces en el mismo render.
- **Gastos dinámicos sin el segundo viaje por rubro:** el catálogo de rubros va en la misma oleada. Desaparecen las consultas vacías (`IN (NULL)`) que hacía cuando una sección no tenía cuentas. También llevan `cache()`.
- **La cadena de ejercicios anteriores es una sola consulta recursiva**, con el mismo límite de 100 saltos y la misma protección contra ciclos.

La técnica está documentada en `claude/patrones.md` (punto 18).

### Antes y después (escala media)

| Operación | Viajes antes | Viajes después | Estimado con red antes (ms) | Estimado con red después (ms) | Cambio |
|---|---|---|---|---|---|
| Lista de sociedades | 1 | 1 | 33 | 33 | igual |
| Lista de ejercicios de una sociedad | 3 | 1 | 92 | 32 | −65% |
| Página del ejercicio: datos base | 2 | 2 a 3 | 68 | 68 a 98 | sin diferencia medible (ver límites) |
| Paso Estados | 9 | 7 | 306 | 242 | −21% |
| Paso Anterior con compuerta | 13 | 9 | 429 | 302 | −30% |
| Documento imprimible completo | 12 | 9 | 403 | 307 | −24% |
| Cadena de ejercicios anteriores (10 años) | 10 | 1 | 306 | 31 | −90% |
| Importar 800 cuentas (reemplazo) | 4 | 4 | 266 | 269 | igual |

Costo de los índices nuevos: `cuentas_contables` pasa de 551 a 578 MB en la escala media (5% más) y la importación tarda unos 3 ms más en local, porque hay dos índices más que mantener. A cambio, borrar o reasignar rubros e importaciones deja de recorrer la tabla entera.

### Cómo se verificó

- **Mismo resultado que antes:** `src/test/integracion/lecturas-en-paralelo.itest.ts` tiene 8 pruebas sobre las lecturas cambiadas (contenido, orden, nombres, casos sin relación, ciclos). Pasan con el código nuevo **y con el anterior**.
- **Sin regresiones:** pasan las 32 pruebas de integración contra PostgreSQL 17 real, las 193 unitarias, tipos y lint.
- **Esquema sin deriva:** `prisma migrate diff` entre el historial de migraciones y `schema.prisma` no da diferencias.

### Límites de la medición

- **La primera oleada de la página del ejercicio varía entre 2 y 4 viajes** de una corrida a otra, con el código viejo y con el nuevo: lanza muchas consultas a la vez y el resultado depende de cuántas conexiones del pool estaban abiertas. Medida tres veces con cada versión, no hay diferencia.
- **En Windows los temporizadores tienen unos 15 ms de resolución**, así que cada viaje simulado de 30 ms cuesta en realidad unos 46. Por eso los viajes se calculan con la ida y vuelta medida, y el estimado con red usa 30 ms por viaje.
- **La medición no deduplica con `cache()` de React**, que sí lo hace en una página real. Las repetidas que quedan en el informe son el máximo posible.

## Claves UUIDv7 (2026-10-19)

Ver [0008](decisiones/0008-claves-uuid-v7.md). Escala media, misma siembra:

| Medida | Con cuid | Con UUIDv7 | Cambio |
|---|---|---|---|
| Base completa | 622,6 MB | 504,2 MB | −19% |
| `cuentas_contables`, datos | 315,8 MB | 257,8 MB | −18% |
| `cuentas_contables`, índices | 263,8 MB | 209,2 MB | −21% |

La velocidad local no cambió de forma medible: a esta escala todo entra en memoria y la base de la medición compara texto byte a byte, mientras que Supabase usa reglas de idioma ICU (`en_US.UTF-8`).

## Próximas mejoras propuestas

| Mejora | Qué cambia | Efecto esperado |
|---|---|---|
| Menos consultas en la primera oleada de la página | Juntar los conteos y comprobaciones de existencia, y evitar que la evaluación de documentos repita el catálogo de rubros y el costo de ventas | Menos consultas simultáneas y menos variación |
| Repetidas que quedan | Catálogo de rubros y grupos de rubros pedidos más de una vez por los servicios | Menos consultas en Estados, Anterior y Documento |
| Medir con la caché de React | Simular en la medición la deduplicación por pedido de `cache()` | Números más fieles a una página real |
| Grupos de gasto en los datos sintéticos | Sembrar grupos de rubros, como los que configura un estudio | Medir el camino completo de gastos dinámicos |

## Pendiente de medir

- Con la misma intercalación que Supabase (ICU, `en_US.UTF-8`): la base de la medición usa `--locale=C`, que compara texto byte a byte.
- La escala grande completa.
- Operaciones de escritura además de la importación: clasificar cuentas, guardar anexos y confirmar estados.
- Borrar un rubro y una importación con datos grandes.
- Correr la escala rápida en la CI en cada cambio.

## El estudio en cada tabla (2026-10-29, escala media)

Ver [0011](decisiones/0011-una-sola-base-para-todos-los-estudios.md). Las 13 tablas que cuelgan de un ejercicio llevan `estudio_id`, y un disparador por tabla completa el estudio desde el dato al que apunta y rechaza los vínculos a otro estudio. Misma siembra (1,6 millones de cuentas):

| Medida | 19/10 | 29/10 | Cambio |
|---|---|---|---|
| Importar 800 cuentas (reemplazo), mediana local | 155,6 ms | 153,1 ms | sin diferencia medible |
| `cuentas_contables` con índices | 467 MB | 490 MB | +5% (16 bytes por cuenta) |
| Base completa | 504 MB | 530 MB | +5% |

Los disparadores corren adentro de la base: no suman viajes. Hay más viajes que el 19/10 en el documento imprimible (de 9 a 13) y en el paso Estados (de 7 a 8) por lo que se agregó desde entonces (Nota 1, flujo de efectivo), no por este cambio: conviene agruparlos, aunque con la app y la base en el mismo servidor cada viaje deja de costar decenas de milisegundos.

## Cada estudio con su catálogo (2026-10-30, escala media)

Ver [0012](decisiones/0012-catalogo-propio-de-cada-estudio.md). La medición siembra ahora dos estudios, cada uno con su catálogo (57 clasificaciones), y todas las lecturas del catálogo filtran por estudio. Resultado igual al 29/10: importar 800 cuentas 155 ms de mediana local, los mismos viajes en cada operación (Estados 8, documento imprimible 13), base de 530,7 MB, ninguna clave foránea sin índice y ninguna lectura completa de tablas grandes. Los saldos por código del paso Documentos leen ahora solo las clasificaciones que usan las cuentas del ejercicio (antes, el catálogo entero).

## La base separa a los estudios (2026-10-30, escala media)

Ver la migración `20261030150000_separacion_por_estudio`. La medición corre ahora como la app: con el rol `balancert_app`, el estudio declarado y la regla `solo_su_estudio` en cada tabla (también los planes de ejecución).

| Medida | Sin reglas | Con reglas, primera versión | Con reglas, final |
|---|---|---|---|
| Importar 800 cuentas (reemplazo), mediana local | 155 ms | 202 ms | 159 ms |
| Paso Estados, mediana local | 36 ms | 39 ms | 38 ms |
| Documento imprimible, mediana local | 63 ms | 64 ms | 66 ms |

- **La primera versión costaba un 30% al importar:** `estudio_de_la_sesion()` llevaba `SET search_path`, y así PostgreSQL la llamaba en cada fila (valor por defecto de `estudio_id` y control de cada vínculo). Sin esa línea, y con todo escrito con su esquema, la reemplaza por su expresión: volvió a 159 ms.
- **Declarar el estudio no suma viajes:** el pool lo fija en la conexión solo cuando cambia (un viaje la primera vez que una conexión pasa a otro estudio). Medido aparte con la red simulada, una lista de 200 sociedades tarda lo mismo con reglas y sin ellas (49 ms y 48 ms). En la tabla de arriba, la cantidad de viajes de las operaciones de una o dos consultas varía en uno entre corridas: es el redondeo de la medición (los temporizadores de Windows tienen unos 15 ms de resolución), no la regla.
- Ninguna lectura completa de tablas grandes y ninguna clave foránea sin índice. Base de 530,4 MB, igual que antes.

