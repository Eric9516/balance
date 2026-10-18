/**
 * Arrastre del Anexo I (Bienes de Uso) desde el ejercicio anterior (escenario A).
 *
 *  - Valor al comienzo del ejercicio      = valor al cierre del anterior (misma categoría)
 *  - Amortización acumulada al comienzo   = amortización acumulada al cierre del anterior
 *  - Neto residual "ejercicio anterior"   = neto residual al cierre del anterior
 *
 * Las categorías se emparejan por nombre normalizado (sin mayúsculas, acentos ni
 * espacios dobles). Bloqueo duro por fila cuando hay fuente; las categorías sin
 * contraparte en el anterior quedan editables y se informan.
 *
 * Puro: no toca la base.
 */

import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { calcularCierre, type BienDeUsoDTO } from './types'

export function normalizarCategoria(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export type ArrastreBDU = {
  costoInicioReexpresado: number
  depAcumInicio: number
  netoResidualAnterior: number
}

/** Mapa categoría normalizada → valores de cierre del anterior. */
export function derivarArrastreBienesDeUso(
  bienesAnterior: BienDeUsoDTO[],
): Map<string, ArrastreBDU> {
  const map = new Map<string, ArrastreBDU>()
  for (const b of bienesAnterior) {
    const { costoFinReexpresado, depAcumFin, netoResidual } = calcularCierre(b)
    map.set(normalizarCategoria(b.categoria), {
      costoInicioReexpresado: costoFinReexpresado,
      depAcumInicio: depAcumFin,
      netoResidualAnterior: netoResidual,
    })
  }
  return map
}

export type ResultadoArrastreBDU = {
  bienes: BienDeUsoDTO[]
  /** ids de filas cuyas columnas de inicio están bloqueadas (tienen fuente) */
  bloqueadas: Set<string>
  /** categorías del actual sin contraparte en el anterior (editables, con aviso) */
  sinDato: string[]
  /** neto residual anterior por categoría (nombre tal cual del actual) */
  netoAnteriorMap: Map<string, number>
  advertencias: string[]
}

/**
 * Aplica el arrastre según el modo. Fuera de VINCULADO no pisa nada y devuelve
 * el neto anterior manual de cada fila (modo MANUAL) o vacío.
 */
export function aplicarArrastreBienesDeUso(
  bienes: BienDeUsoDTO[],
  arrastre: Map<string, ArrastreBDU> | null,
  modo: ModoAnteriorEfectivo,
): ResultadoArrastreBDU {
  const netoAnteriorMap = new Map<string, number>()

  if (modo !== 'VINCULADO') {
    if (modo === 'MANUAL') {
      for (const b of bienes) {
        if (b.netoResidualAnteriorManual != null)
          netoAnteriorMap.set(b.categoria, b.netoResidualAnteriorManual)
      }
    }
    return { bienes, bloqueadas: new Set(), sinDato: [], netoAnteriorMap, advertencias: [] }
  }

  if (!arrastre || arrastre.size === 0) {
    return {
      bienes,
      bloqueadas: new Set(),
      sinDato: bienes.map((b) => b.categoria),
      netoAnteriorMap,
      advertencias: [
        'El ejercicio anterior vinculado no tiene Anexo de Bienes de Uso cargado: los valores al comienzo del ejercicio quedan editables.',
      ],
    }
  }

  const bloqueadas = new Set<string>()
  const sinDato: string[] = []
  const saneados = bienes.map((b) => {
    const fuente = arrastre.get(normalizarCategoria(b.categoria))
    if (!fuente) {
      sinDato.push(b.categoria)
      return b
    }
    bloqueadas.add(b.id)
    netoAnteriorMap.set(b.categoria, fuente.netoResidualAnterior)
    const conInicio = {
      ...b,
      costoInicioReexpresado: fuente.costoInicioReexpresado,
      depAcumInicio: fuente.depAcumInicio,
      netoResidualAnteriorManual: null,
    }
    const cierre = calcularCierre(conInicio)
    return {
      ...conInicio,
      costoFinReexpresado: cierre.costoFinReexpresado,
      depAcumFin: cierre.depAcumFin,
    }
  })

  const advertencias =
    sinDato.length > 0
      ? [
          `Sin dato en el ejercicio anterior para: ${sinDato.join(', ')}. Esas filas quedan editables; verificá que la categoría tenga el mismo nombre en ambos ejercicios.`,
        ]
      : []

  return { bienes: saneados, bloqueadas, sinDato, netoAnteriorMap, advertencias }
}
