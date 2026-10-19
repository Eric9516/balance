# 0004. pnpm con controles de cadena de suministro

- **Estado:** Aceptada
- **Fecha:** 2026-10-19

## Contexto

Un paquete comprometido corre con los permisos de quien instala y, en producción, con acceso a la base. npm ejecuta por defecto los scripts de instalación de cualquier dependencia y no tiene una espera mínima para versiones nuevas. La versión de SheetJS publicada en npm tiene fallas conocidas sin versión corregida en npm.

## Decisión

- pnpm es el único gestor de paquetes, con la versión fijada en `packageManager`.
- Solo se autorizan los scripts de instalación que hacen falta (`allowBuilds` en `pnpm-workspace.yaml`).
- No se instalan versiones publicadas hace menos de 3 días (`minimumReleaseAge`): una versión comprometida suele detectarse y retirarse en ese plazo.
- Las dependencias internas con fallas se fuerzan a versiones corregidas con `overrides`, con una nota para quitarlas cuando ya no hagan falta.
- Los paquetes que no vienen de npm (SheetJS 0.20.3) se guardan en `vendor/` con su origen y su huella.
- `pnpm audit --prod` sin vulnerabilidades altas ni críticas.

## Consecuencias

- Una corrección urgente publicada hoy no se puede instalar hasta dentro de 3 días, salvo que se excluya a mano y con motivo.
- La CI instala con `--frozen-lockfile`: lo que se prueba es exactamente lo que se instala.

## Alternativas descartadas

- **Seguir con npm:** sin control de scripts de instalación ni espera mínima.
