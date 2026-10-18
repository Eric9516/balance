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
import { findBienesDeUso } from '../repository/bienes-de-uso.repository'

export async function cargarBienesDeUso(
  ejercicio: EjercicioContableDTO,
): Promise<ResultadoArrastreBDU> {
  const anteriorId = idAnteriorDerivable(ejercicio)
  const [bienes, bienesAnterior] = await Promise.all([
    findBienesDeUso(ejercicio.id),
    anteriorId ? findBienesDeUso(anteriorId) : Promise.resolve([]),
  ])
  return aplicarArrastreBienesDeUso(
    bienes,
    anteriorId ? derivarArrastreBienesDeUso(bienesAnterior) : null,
    modoEfectivo(ejercicio),
  )
}
