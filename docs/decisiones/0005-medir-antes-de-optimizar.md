# 0005. Sobredimensionar lo irreversible y medir con PostgreSQL real y datos grandes

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

BalanceRT tiene que seguir rápida con muchísimos datos: un estudio grande puede tener cientos de sociedades, quince años de ejercicios y millones de cuentas. Optimizar a ciegas agrega complejidad sin saber si ayuda, y medir con la base de desarrollo (56 cuentas) no dice nada.

## Decisión

- **Lo caro de cambiar después se hace grande desde ya:** identidad, claves, tipos de datos, auditoría, versionado y modelo por estudio (Fase 0 de la hoja de ruta).
- **Lo barato de agregar se agrega cuando una medición lo pida:** réplicas, particiones, cachés.
- **Toda medición usa PostgreSQL real** (`embedded-postgres`, misma versión mayor que producción) con datos sintéticos de escala configurable, y ejecuta el código real de la app, no consultas escritas a mano.
- **Se mide por operación:** tiempo (mediana y p95), cantidad de consultas y cantidad de viajes secuenciales a la base. Con la base en Supabase cada viaje cuesta la latencia de red, así que los viajes pesan tanto como el tiempo de cada consulta.
- **Se revisan los planes de ejecución** de cada consulta: una que lee entera una tabla grande es un error.
- La primera medición queda como línea base en `docs/RENDIMIENTO.md`, y cada paso de la Fase 0 se compara contra ella.

## Consecuencias

- Hay una herramienta de medición propia (`pnpm rendimiento`) que se mantiene junto con el esquema.
- Cada optimización llega con su número de antes y después.

## Alternativas descartadas

- **Medir contra Supabase:** tocaría producción, y los tiempos dependerían de la red del momento.
- **PostgreSQL en memoria (PGlite):** sirve para probar reglas, no para medir tiempos.
