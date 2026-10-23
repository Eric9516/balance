/**
 * Arrastre del Anexo II (Costo de Ventas) desde el ejercicio anterior: existencia inicial =
 * existencia final del anterior, vinculado o cargado a mano. Bloqueo duro cuando hay fuente.
 * Puro: no toca la base.
 */

import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { REGLA_POR_CLAVE } from '@/modules/documentos/domain/reglas'
import { sumarPor } from '@/lib/importe'
import {
  notaPorRubro,
  tieneAnteriorCargado,
  totalesNota,
  type NotaDTO,
} from '@/modules/notas/domain/types'
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
  // Carga manual: la existencia final del año anterior se carga (o se propone desde la nota de
  // bienes de cambio) en la columna "Ejercicio anterior"; la del comienzo es esa, no se tipea.
  if (modo === 'MANUAL' && anterior && anterior.existenciaFinal !== 0) {
    return {
      datos: datos ? { ...datos, existenciaInicial: anterior.existenciaFinal } : null,
      existenciaInicialBloqueada: true,
      existenciaInicialDerivada: anterior.existenciaFinal,
      advertencias: [],
    }
  }
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

/**
 * Carga manual: la existencia final del año anterior que se propone en el Anexo II es el anterior
 * de los rubros de bienes de cambio ya cargado en sus notas: el mismo número no se tipea dos veces.
 * Null si ninguna de esas notas tiene el anterior cargado. Es una propuesta: el contador puede
 * escribir otra (por ejemplo, si el rubro incluye anticipos a proveedores).
 */
export function existenciaFinalAnteriorDesdeNotas(params: {
  rubros: { id: string; codigo: string }[]
  cuentas: { rubroBaseId: string | null; notaEjercicioId: string | null }[]
  notas: NotaDTO[]
}): number | null {
  const codigos = new Set(REGLA_POR_CLAVE.get('NOTA_BIENES_CAMBIO')?.rubros ?? [])
  const notaDeRubro = notaPorRubro(params.cuentas, params.notas)
  const cargadas = new Map<string, NotaDTO>()
  for (const r of params.rubros) {
    const nota = codigos.has(r.codigo) ? notaDeRubro.get(r.id) : undefined
    if (nota && nota.tipo === 'CUANTITATIVA' && tieneAnteriorCargado(nota))
      cargadas.set(nota.id, nota)
  }
  return cargadas.size > 0 ? sumarPor([...cargadas.values()], (n) => totalesNota(n).anterior) : null
}
