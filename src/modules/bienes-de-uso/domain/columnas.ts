/**
 * Modelo de columnas del Anexo I (Bienes de uso): valor de origen y amortizaciones
 * acumuladas, con los campos editables y los calculados. Fuente única para la
 * pantalla y el documento. Puro.
 */

import { calcularCierre, type BienDeUsoDTO } from './types'

export type CampoEditableBDU =
  | 'costoInicioReexpresado'
  | 'costoAjusteInflacion'
  | 'altas'
  | 'bajas'
  | 'depAcumInicio'
  | 'depAjusteInflacion'
  | 'depBajas'
  | 'depEjercicio'

export type ColumnaBDU =
  | {
      tipo: 'campo'
      campo: CampoEditableBDU
      label: string
      /** Arrastrada del anterior vinculado (candado) cuando la fila tiene fuente. */
      inicio?: boolean
      negativo?: boolean
    }
  | { tipo: 'calc'; label: string; calc: (b: BienDeUsoDTO) => number }

export const GRUPOS_BDU = ['origen', 'amortizaciones'] as const
export type GrupoBDU = (typeof GRUPOS_BDU)[number]

const costoFin = (b: BienDeUsoDTO) => calcularCierre(b).costoFinReexpresado
const depFin = (b: BienDeUsoDTO) => calcularCierre(b).depAcumFin

export const COLUMNAS_BDU: Record<
  GrupoBDU,
  { titulo: string; columnas: ColumnaBDU[]; plegado: ColumnaBDU }
> = {
  origen: {
    titulo: 'Valor de origen',
    columnas: [
      { tipo: 'campo', campo: 'costoInicioReexpresado', label: 'Al comienzo', inicio: true },
      { tipo: 'campo', campo: 'costoAjusteInflacion', label: 'Ajuste por inflación' },
      { tipo: 'campo', campo: 'altas', label: 'Aumentos' },
      { tipo: 'campo', campo: 'bajas', label: 'Disminuciones', negativo: true },
      { tipo: 'calc', label: 'Al cierre', calc: costoFin },
    ],
    plegado: { tipo: 'calc', label: 'Valor al cierre', calc: costoFin },
  },
  amortizaciones: {
    titulo: 'Amortizaciones acumuladas',
    columnas: [
      { tipo: 'campo', campo: 'depAcumInicio', label: 'Al comienzo', inicio: true },
      { tipo: 'campo', campo: 'depAjusteInflacion', label: 'Ajuste por inflación' },
      { tipo: 'campo', campo: 'depBajas', label: 'Bajas', negativo: true },
      { tipo: 'campo', campo: 'depEjercicio', label: 'Del ejercicio' },
      { tipo: 'calc', label: 'Al cierre', calc: depFin },
    ],
    plegado: { tipo: 'calc', label: 'Amortización al cierre', calc: depFin },
  },
}

/** Valor de una columna para una fila del anexo (campo o calculado). */
export function valorColumnaBDU(col: ColumnaBDU, bien: BienDeUsoDTO): number {
  return col.tipo === 'calc' ? col.calc(bien) : bien[col.campo]
}

/** Total de una columna sobre todas las filas. */
export function totalColumnaBDU(col: ColumnaBDU, bienes: BienDeUsoDTO[]): number {
  return bienes.reduce((acc, b) => acc + valorColumnaBDU(col, b), 0)
}
