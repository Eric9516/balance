# 0010. Catálogo RT 54 versionado

- **Estado:** Propuesta (pendiente de aprobación: toca reglas contables)
- **Fecha:** 2026-10-19

## Problema

El catálogo de rubros (57 rubros, grupos de gasto y su configuración) es uno solo, editable y global:

1. **Un balance cerrado no está protegido de cambios en el catálogo.** Renombrar un rubro, cambiarlo de sección o cambiar su naturaleza cambia también lo que muestran los ejercicios ya cerrados y emitidos.
2. **Eliminar un rubro des-clasifica sus cuentas en todos los ejercicios**, incluidos los cerrados (la clave foránea es `ON DELETE SET NULL`).
3. **Cuando la FACPCE cambie la norma no hay forma de que convivan** el catálogo viejo (para los ejercicios ya emitidos) y el nuevo.

## Propuesta recomendada: versiones inmutables

- **Catálogos con versión.** Una tabla `catalogos` (nombre, versión, norma, estado `BORRADOR` / `PUBLICADO` / `RETIRADO`, fecha de publicación y versión de la que se copió). Rubros, grupos de gasto y su configuración pertenecen a un catálogo. El código de rubro es único dentro de cada catálogo.
- **Cada ejercicio queda atado a un catálogo** (`ejercicios_contables.catalogo_id`, obligatorio), que se fija al crearlo con la versión publicada vigente.
- **Una versión publicada no se modifica nunca.** Lo impide la base con un disparador, no solo la pantalla. Para cambiar algo se copia la versión, se edita la copia en borrador y se publica. Ningún rubro se borra físicamente: en la versión nueva se marca inactivo.
- **Un ejercicio cerrado conserva siempre su versión**, así que se ve exactamente como se emitió.
- **Un ejercicio abierto puede pasar a una versión nueva** por decisión del contador. Las cuentas se reclasifican solas por código de rubro; las que quedan sin equivalente se muestran sin clasificar y la compuerta no deja confirmar estados hasta resolverlas.
- **El comparativo con el ejercicio anterior empareja rubros por código**, no por identificador: un anterior con la versión 1 se compara con un actual con la versión 2.
- **Las reglas de anexos y notas ya están expresadas por código**, así que no cambian.
- **Migración inicial:** se crea el catálogo "RT 54, versión 1" publicado con los 57 rubros, grupos y configuración actuales, y todos los ejercicios existentes pasan a apuntar a él. Lo que se ve hoy no cambia.

## Alternativa descartada: foto al cerrar

Guardar una copia del catálogo cuando un ejercicio se cierra. Es más simple, pero no resuelve los ejercicios abiertos ni los cambios de norma, y deja dos fuentes de verdad (el catálogo vivo y las fotos).

## Preguntas para decidir antes de implementar

1. **¿Quién mantiene el catálogo?** (a) Solo el proveedor de BalanceRT publica versiones, por cambios normativos, y los estudios no las editan; o (b) cada estudio puede crear su propia versión a partir de la oficial. Hoy cualquier usuario edita todo.
2. **Al publicar una versión nueva, ¿los ejercicios abiertos pasan solos o decide el contador ejercicio por ejercicio?** Recomendación: decide el contador.
3. **¿Los grupos de gasto (secciones del Anexo III) y su orden son parte del catálogo versionado o configuración libre del estudio?** Recomendación: parte del catálogo, porque cambian lo que muestra el Estado de Resultados.
4. **Un rubro sin equivalente en la versión nueva, ¿bloquea la confirmación de estados hasta reclasificar a mano?** Recomendación: sí.
