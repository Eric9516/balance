# 0009. Importes con aritmética exacta

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

La base guarda los importes como decimales exactos (`numeric`), pero la app los pasaba a `number` de JavaScript y los sumaba, restaba y multiplicaba con aritmética de punto flotante: `0.1 + 0.2 = 0.30000000000000004`. El error es chico, pero se acumula en totales de cientos de cuentas y en las comparaciones de cuadre. Además, un `number` pierde centavos en silencio a partir de cierto tamaño.

## Decisión

- **`@/lib/importe` es la única aritmética de dinero** de la app: `importe` (leer de la base), `sumar`, `sumarPor`, `restar`, `multiplicar`, `dividir` y `comparaImportes`. Se usa en el dominio, los servicios, los repositorios y las pantallas.
- **Cada operación es exacta.** Un `number` se lee por su representación decimal más corta (0.1 es exactamente 0,10), así que encadenar operaciones no acumula error.
- **Los importes siguen viajando como `number`** entre el servidor y la pantalla, como antes.
- **Límite: 70.368.744.177.663,99 pesos (2⁴⁶ − 0,01).** Hasta ahí un `number` distingue todos los centavos; desde 2⁴⁶ la separación entre dos `number` es 1/64 de peso. Un resultado mayor no se redondea en silencio: corta con el error NEG-060, con el importe y el límite en el mensaje.
- **La base tampoco redondea.** Las columnas eran `numeric(18,2)` (importes) y `numeric(18,6)` (índices de inflación), y PostgreSQL redondeaba en silencio al guardar: un importe reexpresado de 1.250,0125 quedaba en 1.250,01. La migración `20261019163923_importes_sin_redondeo` las pasó a `numeric` sin escala, que guarda el valor exacto. Conserva el tope de tamaño anterior con un CHECK por columna (menos de 16 dígitos enteros en importes, 12 en índices), que además rechaza NaN e infinito: antes la base aceptaba NaN como importe. No reescribió ninguna tabla ni cambió ningún valor guardado (ensayado sobre una copia de los datos reales, dígito por dígito).
- **Jamás se redondea nada** (decisión del dueño del producto, 2026-10-19; ver CLAUDE.md). El módulo no redondea: los importes reexpresados por el coeficiente conservan todos sus decimales. Quedan por definir con el dueño del producto dos puntos de presentación y cálculo: cómo se muestran los importes con más de 2 decimales y con cuántos dígitos se trabaja el coeficiente.

### Tres caminos con el mismo resultado

| Camino | Cuándo | Cómo |
|---|---|---|
| Rápido | Todos los valores son `number` con a lo sumo 2 decimales (casi siempre) | Suma de centavos enteros |
| Exacto con BigInt | Algún valor tiene más decimales (reexpresados) o es una multiplicación | Enteros grandes escalados y conversión final por texto |
| decimal.js | Texto, `Decimal` o notación exponencial | Decimal de 34 dígitos |

Las pruebas comparan los caminos rápidos contra decimal.js en miles de combinaciones al azar (sumas, restas y 5.000 multiplicaciones) y exigen el mismo resultado exacto.

## Cómo se verificó

- **Ningún resultado cambió:** se capturó el texto de las 8 pantallas de cálculo (298 importes visibles, incluido el documento imprimible completo) con los datos reales antes del cambio, y después dio idéntico, con el servidor reiniciado en limpio.
- La reexpresión por coeficiente (que los datos reales no usan) la cubren las pruebas de integración con un ejercicio anterior vinculado e índices 100 y 125.
- 210 pruebas unitarias y 43 de integración.

## Costo medido (escala rápida, tiempo local)

| Operación | Antes | Después |
|---|---|---|
| Paso Estados | 26 ms | 29 ms |
| Paso Anterior con compuerta | 30 ms | 31 ms |
| Documento imprimible completo | 34 ms | 36 ms |

Con la latencia de Supabase (unos 240 a 300 ms por pantalla) es cerca de 1%. La primera versión, toda con decimal.js, costaba el triple: los caminos rápidos se agregaron por esa medición.

## Alternativas descartadas

- **Más decimales con escala fija** (por ejemplo `numeric(28,10)`): solo corre el problema de lugar, porque redondea igual a partir del décimo decimal. `numeric` sin escala ocupa lo mismo por valor y no redondea nunca.
- **Hacer viajar los importes como texto de punta a punta:** quitaría el límite de 70 billones, pero obliga a cambiar todos los tipos de datos, pantallas y pruebas. Para estudios con clientes PyME el límite está lejos; se reconsidera si un cliente se acerca.
- **Todo con decimal.js:** exacto, pero tres veces más lento en las pantallas pesadas.
