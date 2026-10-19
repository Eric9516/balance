/**
 * Estructura del Estado de Situación Patrimonial: bloques, secciones y totales.
 * Fuente única para la pantalla (SSPTab) y el documento imprimible. Puro.
 */

import type { RubroFila } from './types'
import { sumarPor } from '@/lib/importe'

export const SSP_STRUCTURE = [
  {
    bloque: 'ACTIVO',
    sections: ['ACTIVO_CORRIENTE', 'ACTIVO_NO_CORRIENTE'],
    totalLabel: 'TOTAL ACTIVO',
  },
  {
    bloque: 'PASIVO',
    sections: ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE'],
    totalLabel: 'TOTAL PASIVO',
  },
  {
    bloque: 'PATRIMONIO NETO',
    sections: ['PATRIMONIO_NETO'],
    totalLabel: 'TOTAL PATRIMONIO NETO',
  },
] as const

export type BloqueSSP = (typeof SSP_STRUCTURE)[number]

export const SECCIONES_PASIVO: readonly string[] = ['PASIVO_CORRIENTE', 'PASIVO_NO_CORRIENTE']

export type ColumnaEjercicio = 'actual' | 'anterior'

function valorDe(r: RubroFila, columna: ColumnaEjercicio): number {
  return columna === 'actual' ? r.displayValue : r.displayValueAnt
}

export function rubrosDeSeccion(sspRubros: RubroFila[], seccion: string): RubroFila[] {
  return sspRubros.filter((r) => r.seccionSSP === seccion)
}

/** Suma de una sección del SSP en la columna indicada. */
export function sumarSeccion(
  sspRubros: RubroFila[],
  seccion: string,
  columna: ColumnaEjercicio,
): number {
  return sumarPor(rubrosDeSeccion(sspRubros, seccion), (r) => valorDe(r, columna))
}

/** Suma de varias secciones (un bloque) en la columna indicada. */
export function sumarSecciones(
  sspRubros: RubroFila[],
  secciones: readonly string[],
  columna: ColumnaEjercicio,
): number {
  return sumarPor(secciones, (s) => sumarSeccion(sspRubros, s, columna))
}

/**
 * Patrimonio neto a exponer en el SSP: el total del E.E.P.N. cuando existe; si no,
 * la suma de los rubros clasificados como PN.
 */
export function patrimonioNetoSSP(
  sspRubros: RubroFila[],
  patrimonioNetoFinal: number | null,
  columna: ColumnaEjercicio,
): number {
  return patrimonioNetoFinal ?? sumarSeccion(sspRubros, 'PATRIMONIO_NETO', columna)
}
