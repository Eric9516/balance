import { comparaImportes, restar, sumarPor } from '@/lib/importe'
import { formatCurrency } from '@/lib/utils/currency'
import type { GastoSeccion } from '../repository/gastos-dinamico.repository'

/**
 * Anexo III — Gastos: filas y columna "Total ejercicio anterior".
 *
 * Como en el modelo de estados contables de la RT 54 (FACPCE, Informe CENCyA N° 27), el ejercicio
 * anterior se expone en una columna al lado del total del ejercicio actual, con un importe por cada
 * fila de gasto. Esta es la única regla que arma esas filas: la usan la pantalla y el documento.
 */

/** Clave del importe anterior cargado a mano para una fila (cuenta) del ejercicio actual. */
export const claveFilaAnterior = (nombre: string) => `fila:${nombre}`

/** Importe del ejercicio anterior cargado a mano para una fila (solo modo MANUAL). */
export type AnteriorManualFila = {
  clave: string
  nombre: string
  valor: number
  /** true = la fila solo existió en el ejercicio anterior. */
  soloAnterior: boolean
}

export type FilaAnexoGastos = {
  clave: string
  nombre: string
  /** Importe del ejercicio actual en cada sección: clave de sección → importe. */
  importes: Record<string, number>
  totalActual: number
  totalAnterior: number
  /** true = la fila solo existió en el ejercicio anterior (carga manual). */
  soloAnterior: boolean
}

/**
 * Una fila por cuenta de gasto del ejercicio actual, ordenadas por nombre, con su importe en cada
 * sección y su total del ejercicio anterior:
 * - Anterior vinculado (`anteriorManual` ausente): sale de las cuentas del ejercicio anterior.
 * - Carga manual: sale de lo cargado fila por fila (cero si todavía no se cargó), y al final van
 *   las filas que solo existieron en el ejercicio anterior.
 */
export function filasAnexoGastos(
  secciones: readonly GastoSeccion[],
  anteriorManual?: readonly AnteriorManualFila[] | null,
): FilaAnexoGastos[] {
  const nombres = [...new Set(secciones.flatMap((s) => s.filas.map((f) => f.cuentaNombre)))].sort()
  const manual = anteriorManual ? new Map(anteriorManual.map((f) => [f.clave, f.valor])) : null

  const actuales = nombres.map((nombre): FilaAnexoGastos => {
    const clave = claveFilaAnterior(nombre)
    const importes: Record<string, number> = {}
    for (const s of secciones) {
      const fila = s.filas.find((f) => f.cuentaNombre === nombre)
      if (fila) importes[s.key] = fila.importe
    }
    return {
      clave,
      nombre,
      importes,
      totalActual: sumarPor(Object.values(importes), (v) => v),
      totalAnterior: manual
        ? (manual.get(clave) ?? 0)
        : sumarPor(
            secciones,
            (s) => s.filas.find((f) => f.cuentaNombre === nombre)?.importeAnterior,
          ),
      soloAnterior: false,
    }
  })

  const soloAnterior = (anteriorManual ?? [])
    .filter((f) => f.soloAnterior)
    .map((f): FilaAnexoGastos => ({
      clave: f.clave,
      nombre: f.nombre,
      importes: {},
      totalActual: 0,
      totalAnterior: f.valor,
      soloAnterior: true,
    }))

  return [...actuales, ...soloAnterior]
}

export type CuadreAnteriorGastos = {
  /** Suma de la columna "Total ejercicio anterior" (fila por fila). */
  porFilas: number
  /** Suma de los totales del ejercicio anterior por sección (los que van al Estado de Resultados). */
  porSecciones: number
  diferencia: number
  coincide: boolean
}

/** ¿La columna anterior fila por fila suma lo mismo que los totales anteriores por sección? */
export function cuadreAnteriorGastos(
  anteriorPorFila: readonly number[],
  anteriorPorSeccion: readonly number[],
): CuadreAnteriorGastos {
  const porFilas = sumarPor(anteriorPorFila, (v) => v)
  const porSecciones = sumarPor(anteriorPorSeccion, (v) => v)
  return {
    porFilas,
    porSecciones,
    diferencia: restar(porFilas, porSecciones),
    coincide: comparaImportes(porFilas, porSecciones),
  }
}

/** Advertencia para el contador cuando no cuadra (null si cuadra). Sin redondear: es un control. */
export function advertenciaCuadreAnterior(cuadre: CuadreAnteriorGastos): string | null {
  if (cuadre.coincide) return null
  const importe = (v: number) => formatCurrency(v, { decimales: 'todos' })
  return (
    `La columna "Total ejercicio anterior" suma ${importe(cuadre.porFilas)} y los totales del ` +
    `ejercicio anterior por sección suman ${importe(cuadre.porSecciones)}: hay una diferencia de ` +
    `${importe(cuadre.diferencia)}. Revisá los importes del ejercicio anterior fila por fila o por sección.`
  )
}
