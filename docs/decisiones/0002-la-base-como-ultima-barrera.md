# 0002. La base como última barrera; los cálculos contables en TypeScript

- **Estado:** Aceptada
- **Fecha:** 2026-10-18

## Contexto

Hoy toda regla vive en el código de la app: si una acción del servidor olvida un control, la base acepta cualquier dato. El proyecto de referencia (Gestión empresarial) impone los permisos desde PostgreSQL, y por eso una falla de la pantalla no abre datos. Pero copiarle también la lógica de negocio en SQL duplicaría los cálculos contables, que hoy están bien resueltos y probados en el dominio de TypeScript.

## Decisión

La base hace cumplir cuatro cosas, aunque la app falle:

1. **Permisos:** quién puede leer y escribir (reglas por fila, roles de base separados).
2. **Invariantes duras:** por ejemplo, que un ejercicio vinculado tenga anterior o que la fecha de cierre sea posterior a la de inicio (restricciones CHECK y de exclusión).
3. **Inmutabilidad:** un ejercicio cerrado no se modifica (disparadores).
4. **Auditoría:** quién hizo cada cambio, con el antes y el después (disparadores).

Los cálculos contables (totales, cuadre, arrastres, E.E.P.N., flujo) se quedan en el dominio de TypeScript y no se duplican en SQL.

## Consecuencias

- Varias capas: una falla de la app no abre ni corrompe datos.
- Las reglas en la base se prueban con pruebas propias (matriz de permisos, pgTAP).
- Hay que mantener dos lenguajes, pero cada regla vive en uno solo.

## Alternativas descartadas

- **Todo en la app:** una acción mal escrita alcanza para romper la seguridad.
- **Todo en SQL, como la referencia:** más difícil de leer, probar y cambiar, y duplicaría el dominio contable.
