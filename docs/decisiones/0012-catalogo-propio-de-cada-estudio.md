# 0012. Cada estudio con su propio catálogo de clasificaciones

- **Estado:** Aceptada
- **Fecha:** 2026-10-30
- **Relacionada:** [0010](0010-catalogo-rt54-versionado.md) (responde su pregunta 1), [0011](0011-una-sola-base-para-todos-los-estudios.md)

## Contexto

Con una sola base para todos los estudios (0011), el catálogo de clasificaciones (`rubros_base`), las secciones (`rubros_grupo`) y la configuración de las secciones de gastos (`gasto_seccion_config`) eran comunes a todos. La app deja crearlos, cambiarlos y borrarlos, así que lo que cambiaba un estudio le cambiaba el balance a todos los demás.

## Decisión

Decisión del dueño del producto (2026-10-30): cada estudio tiene su propio catálogo.

- El catálogo oficial de la RT 54 vive en `catalogo_rubros`. Es de la plataforma: la app no lo lee ni lo cambia.
- Cada estudio recibe una copia del oficial al crearse (disparador `catalogo` en `estudios`) y después cambia la suya sin tocar a los demás.
- Las tres tablas del catálogo llevan `estudio_id`. El código y el orden de una clasificación son únicos dentro del estudio, y la base rechaza que una cuenta use la clasificación de otro estudio o que una clasificación use la sección de otro.
- Una incorporación oficial (por ejemplo, rubros de una actividad nueva o un cambio de norma) es una migración que la agrega a `catalogo_rubros` y al catálogo de cada estudio. Nunca pisa lo que un estudio cambió en el suyo.
- Paso inicial (migración `20261030120000_catalogo_por_estudio`): el catálogo que ya había queda del estudio en uso, con todo lo que se le cambió. Cada uno de los otros estudios recibe una copia, y sus cuentas y su comparativo pasan a apuntar a ella.

## Consecuencias

- Es como ya funcionaba la app para un estudio ("el catálogo es del estudio").
- Toda lectura del catálogo lleva el estudio: el del ejercicio o el de la sesión.
- Unas 60 filas por estudio: no pesa en la base.
- `rubros_activos_estudio` queda sin uso (ya no lo usaba nadie): se quita en una migración aparte.
- 0010 sigue pendiente: proteger un ejercicio cerrado de los cambios en el catálogo (versiones) es otra decisión. Con un catálogo por estudio, el cambio solo afecta al estudio que lo hizo.

## Alternativas descartadas

- **Un catálogo oficial común de solo lectura, más las clasificaciones propias de cada estudio:** más trabajo y una pantalla más complicada para cada estudio, porque tiene que mezclar lo oficial con lo propio.
- **Seguir con un catálogo común editable:** un estudio le cambia el balance a los demás.
