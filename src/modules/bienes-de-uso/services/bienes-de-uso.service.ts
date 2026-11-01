/**
 * Servicio: Anexo I (Bienes de uso) de un ejercicio con el arrastre desde el
 * ejercicio anterior resuelto según el modo. Única forma de obtenerlo para la
 * pantalla y el documento imprimible.
 */

import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import { idAnteriorDerivable, modoEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import {
  aplicarArrastreBienesDeUso,
  derivarArrastreBienesDeUso,
  type ResultadoArrastreBDU,
} from '../domain/saldosInicio'
import { getIndicesReexpresion, reexpresar } from '@/modules/estados/lib/ajuste'
import { indicesDelAnteriorManual } from '@/modules/comparativo-manual/lib/ajuste'
import { findBienesDeUso } from '../repository/bienes-de-uso.repository'

export async function cargarBienesDeUso(
  ejercicio: EjercicioContableDTO,
): Promise<ResultadoArrastreBDU> {
  const anteriorId = idAnteriorDerivable(ejercicio)
  const [bienes, bienesAnterior] = await Promise.all([
    findBienesDeUso(ejercicio.id),
    anteriorId ? findBienesDeUso(anteriorId) : Promise.resolve([]),
  ])
  const arrastre = aplicarArrastreBienesDeUso(
    bienes,
    anteriorId
      ? derivarArrastreBienesDeUso(bienesAnterior, getIndicesReexpresion(ejercicio))
      : null,
    modoEfectivo(ejercicio),
  )
  const manual = indicesDelAnteriorManual(ejercicio)
  if (!manual) return arrastre
  // Las categorías siguen como en la base: se ajusta solo el neto que se muestra como anterior.
  return {
    ...arrastre,
    netoCargadoMap: arrastre.netoAnteriorMap,
    netoAnteriorMap: new Map(
      [...arrastre.netoAnteriorMap].map(([categoria, neto]) => [
        categoria,
        reexpresar(neto, manual),
      ]),
    ),
  }
}
