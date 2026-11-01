/**
 * Anterior cargado a mano y ya autorizado: se muestra ajustado por inflación. Lo escrito no se pisa:
 * en la base queda lo cargado y estas funciones lo ajustan al leer. Lo que vuelve de un guardado se
 * sanea en cada acción, para que nunca se escriba un valor ajustado encima de lo cargado.
 *
 * Mismo criterio que el anterior vinculado: se ajusta la columna "Ejercicio anterior"; el valor y la
 * amortización al comienzo del Anexo I y los saldos al inicio del E.E.P.N. no (su reexpresión se
 * carga en "Ajuste por inflación"). Puro: no toca la base.
 */

import {
  getIndicesReexpresion,
  reexpresar,
  type IndicesReexpresion,
} from '@/modules/estados/lib/ajuste'
import { netoAnteriorManualBDU, type BienDeUsoDTO } from '@/modules/bienes-de-uso/domain/types'
import type { EjercicioContableDTO } from '@/modules/ejercicios/domain/types'
import type { FlujoGuardadoDTO } from '@/modules/flujo-efectivo/domain/types'
import type { NotaDTO } from '@/modules/notas/domain/types'
import type { EvolucionPNMovimientoDTO } from '@/modules/patrimonio-neto/domain/types'
import type { ComparativoManualDTO } from '../domain/types'

type EjercicioAjustable = Pick<
  EjercicioContableDTO,
  'modoAnterior' | 'anteriorAjustadoEn' | 'indiceInflacionAnterior' | 'indiceInflacionActual'
>

export function anteriorAjustado(
  ejercicio: Pick<EjercicioAjustable, 'modoAnterior' | 'anteriorAjustadoEn'>,
) {
  return ejercicio.modoAnterior === 'MANUAL' && ejercicio.anteriorAjustadoEn !== null
}

/** Los índices para ajustar lo cargado a mano; null si este ejercicio no se ajusta. */
export function indicesDelAnteriorManual(ejercicio: EjercicioAjustable): IndicesReexpresion | null {
  return anteriorAjustado(ejercicio) ? getIndicesReexpresion(ejercicio) : null
}

export function ajustarComparativos(
  comparativos: ComparativoManualDTO[],
  indices: IndicesReexpresion | null,
): ComparativoManualDTO[] {
  if (!indices) return comparativos
  return comparativos.map((c) => ({ ...c, valor: reexpresar(c.valor, indices) }))
}

/** Cada fila conserva lo cargado en `anteriorCargado`, para mostrarlo al lado. */
export function ajustarNotas(notas: NotaDTO[], indices: IndicesReexpresion | null): NotaDTO[] {
  if (!indices) return notas
  return notas.map((n) => ({
    ...n,
    detalles: n.detalles.map((d) => ({
      ...d,
      importeAnterior: reexpresar(d.importeAnterior, indices),
      anteriorCargado: d.importeAnterior,
    })),
  }))
}

export function ajustarMovimientosPN(
  movimientos: EvolucionPNMovimientoDTO[],
  indices: IndicesReexpresion | null,
): EvolucionPNMovimientoDTO[] {
  if (!indices) return movimientos
  return movimientos.map((m) => ({ ...m, totalAnterior: reexpresar(m.totalAnterior, indices) }))
}

export function ajustarFlujo(
  flujo: FlujoGuardadoDTO | null,
  indices: IndicesReexpresion | null,
): FlujoGuardadoDTO | null {
  if (!flujo || !indices) return flujo
  return {
    ...flujo,
    saldoInicialAnterior: reexpresar(flujo.saldoInicialAnterior, indices),
    modificacionesEjAntAnt: reexpresar(flujo.modificacionesEjAntAnt, indices),
    items: flujo.items.map((i) => ({
      ...i,
      importeAnterior: reexpresar(i.importeAnterior, indices),
    })),
  }
}

/**
 * Las categorías con su neto anterior ajustado, para sumarlo en el rubro del balance. Solo para
 * calcular: al Anexo I le llegan las categorías como están en la base.
 */
export function ajustarNetosAnexoI(
  bienes: BienDeUsoDTO[],
  indices: IndicesReexpresion | null,
): BienDeUsoDTO[] {
  if (!indices) return bienes
  return bienes.map((b) => {
    const neto = netoAnteriorManualBDU(b)
    return neto === null ? b : { ...b, netoResidualAnteriorManual: reexpresar(neto, indices) }
  })
}
