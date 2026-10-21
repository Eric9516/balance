import { sumar, sumarPor } from '@/lib/importe'
import type { GastoSeccion } from '../repository/gastos-dinamico.repository'

/**
 * Anexo III — Gastos: filas, columna "Total ejercicio anterior" y totales del anterior por sección.
 *
 * Como en el modelo de estados contables de la RT 54 (FACPCE, Informe CENCyA N° 27), el ejercicio
 * anterior se expone en una columna al lado del total del ejercicio actual, con un importe por cada
 * fila de gasto. Con el anterior cargado a mano, ese importe se carga UNA sola vez, fila por fila, y
 * los totales del anterior por sección (columna) se calculan solos: cada fila suma en la sección
 * donde está este año, o en la que eligió el contador si solo existió el año pasado. Esos totales
 * son los que van al Estado de Resultados. Esta es la única regla: la usan la pantalla, el documento
 * y el Estado de Resultados.
 */

/** Clave del importe anterior de una fila (cuenta) del ejercicio actual que está en una sola sección. */
export const claveFilaAnterior = (nombre: string) => `fila:${nombre}`

/** Clave del importe anterior de una fila que este año está en varias secciones: uno por sección. */
export const claveFilaAnteriorEnSeccion = (nombre: string, seccion: string) =>
  `fila:${nombre}@${seccion}`

/**
 * Sección elegida para una fila que solo existió en el ejercicio anterior. Su clave la arma
 * `buildClaveHuerfano(seccion)`: `sec:<clave de la sección>:<marca de tiempo>`. La clave de la
 * sección puede tener ":" (grupo:…, legacy:…), así que se toma todo lo que hay entre el prefijo y el
 * último ":". Sin sección (clave `huerfano:…`) devuelve null.
 */
export function seccionDeFilaSoloAnterior(clave: string): string | null {
  if (!clave.startsWith('sec:')) return null
  const fin = clave.lastIndexOf(':')
  return fin > 4 ? clave.slice(4, fin) : null
}

/** Importe del ejercicio anterior cargado a mano para una fila (solo modo MANUAL). */
export type AnteriorManualFila = {
  clave: string
  nombre: string
  valor: number
  /** true = la fila solo existió en el ejercicio anterior. */
  soloAnterior: boolean
}

export type FilaAnexoGastos = {
  /** Clave del importe anterior (fila en una sola sección o solo del anterior). */
  clave: string
  nombre: string
  /** Importe del ejercicio actual en cada sección: clave de sección → importe. */
  importes: Record<string, number>
  totalActual: number
  /** Secciones de la fila: donde está este año o, si solo existió el año pasado, la elegida. */
  secciones: string[]
  /** Importe del ejercicio anterior en cada sección (lo que suma en el total por sección). */
  anteriorPorSeccion: Record<string, number>
  /** Total del ejercicio anterior de la fila (columna "Total ejercicio anterior"). */
  totalAnterior: number
  /** true = la fila solo existió en el ejercicio anterior (carga manual). */
  soloAnterior: boolean
  /** true = tiene importe anterior que no se puede asignar a ninguna sección. */
  sinSeccion: boolean
}

/**
 * Una fila por cuenta de gasto del ejercicio actual, ordenadas por nombre, con su importe en cada
 * sección y su ejercicio anterior:
 * - Anterior vinculado (`anteriorManual` ausente): sale de las cuentas del ejercicio anterior.
 * - Carga manual: sale de lo cargado (cero si todavía no se cargó). Una fila en una sola sección
 *   suma en esa sección; una fila en varias secciones tiene un importe por sección; al final van
 *   las filas que solo existieron en el anterior, en la sección que eligió el contador.
 */
export function filasAnexoGastos(
  secciones: readonly GastoSeccion[],
  anteriorManual?: readonly AnteriorManualFila[] | null,
): FilaAnexoGastos[] {
  const nombres = [...new Set(secciones.flatMap((s) => s.filas.map((f) => f.cuentaNombre)))].sort()
  const manual = anteriorManual ? new Map(anteriorManual.map((f) => [f.clave, f.valor])) : null

  const actuales = nombres.map((nombre): FilaAnexoGastos => {
    const importes: Record<string, number> = {}
    const anteriorPorSeccion: Record<string, number> = {}
    const enSecciones: string[] = []
    for (const s of secciones) {
      const fila = s.filas.find((f) => f.cuentaNombre === nombre)
      if (!fila) continue
      enSecciones.push(s.key)
      importes[s.key] = fila.importe
      if (!manual) anteriorPorSeccion[s.key] = fila.importeAnterior
    }

    let sinAsignar = 0
    if (manual) {
      if (enSecciones.length === 1) {
        const [s] = enSecciones as [string]
        // Solo la clave de la fila: un importe por sección de cuando estaba en varias se ignora
        // (sumarlo lo contaría dos veces al guardar la fila otra vez).
        anteriorPorSeccion[s] = manual.get(claveFilaAnterior(nombre)) ?? 0
      } else {
        for (const s of enSecciones) {
          anteriorPorSeccion[s] = manual.get(claveFilaAnteriorEnSeccion(nombre, s)) ?? 0
        }
        // Un importe cargado para la fila entera no se puede repartir entre varias secciones.
        sinAsignar = manual.get(claveFilaAnterior(nombre)) ?? 0
      }
    }

    return {
      clave: claveFilaAnterior(nombre),
      nombre,
      importes,
      totalActual: sumarPor(Object.values(importes), (v) => v),
      secciones: enSecciones,
      anteriorPorSeccion,
      totalAnterior: sumar(
        sumarPor(Object.values(anteriorPorSeccion), (v) => v),
        sinAsignar,
      ),
      soloAnterior: false,
      sinSeccion: sinAsignar !== 0,
    }
  })

  const soloAnterior = (anteriorManual ?? [])
    .filter((f) => f.soloAnterior)
    .map((f): FilaAnexoGastos => {
      const seccion = seccionDeFilaSoloAnterior(f.clave)
      return {
        clave: f.clave,
        nombre: f.nombre,
        importes: {},
        totalActual: 0,
        secciones: seccion ? [seccion] : [],
        anteriorPorSeccion: seccion ? { [seccion]: f.valor } : {},
        totalAnterior: f.valor,
        soloAnterior: true,
        sinSeccion: !seccion && f.valor !== 0,
      }
    })

  return [...actuales, ...soloAnterior]
}

/**
 * Total del ejercicio anterior de cada sección, sumando lo que cada fila aporta a esa sección.
 * Es la fila "Total ejercicio anterior" del anexo y lo que va al Estado de Resultados.
 */
export function anteriorPorSeccionDesdeFilas(
  filas: readonly FilaAnexoGastos[],
): Map<string, number> {
  const totales = new Map<string, number>()
  for (const fila of filas) {
    for (const [seccion, valor] of Object.entries(fila.anteriorPorSeccion)) {
      totales.set(seccion, sumar(totales.get(seccion), valor))
    }
  }
  return totales
}

/** Aviso cuando hay importes del año anterior que no suman en ninguna sección (null si no hay). */
export function advertenciaFilasSinSeccion(filas: readonly FilaAnexoGastos[]): string | null {
  const nombres = filas.filter((f) => f.sinSeccion).map((f) => f.nombre)
  if (nombres.length === 0) return null
  return (
    `El importe del ejercicio anterior de ${nombres.join(', ')} no tiene clasificación, así que no ` +
    'suma en ninguna columna ni en el Estado de Resultados. Cargalo en la columna que corresponde ' +
    '(o eliminá el gasto y agregalo de nuevo eligiendo su clasificación).'
  )
}
