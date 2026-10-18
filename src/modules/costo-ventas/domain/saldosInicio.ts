/**
 * Arrastre del Anexo II (Costo de Ventas) desde el ejercicio anterior (escenario A):
 * existencia inicial = existencia final del anterior. Bloqueo duro cuando hay fuente.
 * Puro: no toca la base.
 */

import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { CostoVentasDTO } from './types'

export type ResultadoArrastreCV = {
  datos: CostoVentasDTO | null
  /** la existencia inicial viene del anterior y no se edita */
  existenciaInicialBloqueada: boolean
  /** valor que debe tener la existencia inicial (null = sin fuente) */
  existenciaInicialDerivada: number | null
  advertencias: string[]
}

export function aplicarArrastreCostoVentas(
  datos: CostoVentasDTO | null,
  anterior: CostoVentasDTO | null,
  modo: ModoAnteriorEfectivo,
): ResultadoArrastreCV {
  if (modo !== 'VINCULADO') {
    return {
      datos,
      existenciaInicialBloqueada: false,
      existenciaInicialDerivada: null,
      advertencias: [],
    }
  }
  if (!anterior) {
    return {
      datos,
      existenciaInicialBloqueada: false,
      existenciaInicialDerivada: null,
      advertencias: [
        'El ejercicio anterior vinculado no tiene Anexo de Costo de Ventas cargado: la existencia al comienzo del ejercicio queda editable.',
      ],
    }
  }
  return {
    datos: datos ? { ...datos, existenciaInicial: anterior.existenciaFinal } : null,
    existenciaInicialBloqueada: true,
    existenciaInicialDerivada: anterior.existenciaFinal,
    advertencias: [],
  }
}
