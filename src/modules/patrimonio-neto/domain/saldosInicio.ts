/**
 * Arrastre de saldos del E.E.P.N. desde el ejercicio anterior (escenario A).
 *
 *  - Saldos al inicio  = suma de TODAS las filas del E.E.P.N. anterior, por componente
 *                        (es decir, su "Saldos al cierre"), en moneda de cierre anterior.
 *                        La reexpresión va en la fila "Ajuste por inflación" del actual.
 *  - Columna anterior  = total de cada fila del E.E.P.N. anterior × coeficiente.
 *
 * Regla de bloqueo: duro cuando hay fuente (el anterior tiene E.E.P.N. cargado);
 * si el anterior no tiene E.E.P.N., nada se pisa y queda editable con advertencia.
 *
 * Puro: no toca la base.
 */

import type { TipoMovimientoPN } from '@prisma/client'
import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { totalMovimientoPN, type EvolucionPNMovimientoDTO } from './types'
import { multiplicar, sumar } from '@/lib/importe'

export type ColumnasPN = Pick<
  EvolucionPNMovimientoDTO,
  | 'capitalSuscripto'
  | 'ajusteCapital'
  | 'aportesIrrevocables'
  | 'reservaLegal'
  | 'otrasReservas'
  | 'rdosNoAsignados'
>

export const COLUMNAS_PN_CERO: ColumnasPN = {
  capitalSuscripto: 0,
  ajusteCapital: 0,
  aportesIrrevocables: 0,
  reservaLegal: 0,
  otrasReservas: 0,
  rdosNoAsignados: 0,
}

export function sumarColumnasPN(acc: ColumnasPN, mov: ColumnasPN): ColumnasPN {
  return {
    capitalSuscripto: sumar(acc.capitalSuscripto, mov.capitalSuscripto),
    ajusteCapital: sumar(acc.ajusteCapital, mov.ajusteCapital),
    aportesIrrevocables: sumar(acc.aportesIrrevocables, mov.aportesIrrevocables),
    reservaLegal: sumar(acc.reservaLegal, mov.reservaLegal),
    otrasReservas: sumar(acc.otrasReservas, mov.otrasReservas),
    rdosNoAsignados: sumar(acc.rdosNoAsignados, mov.rdosNoAsignados),
  }
}

export type DerivadoPN = {
  /** Saldos al cierre del anterior por componente. null = el anterior no tiene E.E.P.N. */
  saldoInicio: ColumnasPN | null
  /** Total de cada fila del anterior × coeficiente. null = sin E.E.P.N. anterior. */
  totalAnteriorByTipo: Partial<Record<TipoMovimientoPN, number>> | null
}

export const SIN_DERIVADO_PN: DerivadoPN = { saldoInicio: null, totalAnteriorByTipo: null }

export function derivarDesdeAnteriorPN(
  movimientosAnterior: EvolucionPNMovimientoDTO[],
  coeficiente: number,
): DerivadoPN {
  if (movimientosAnterior.length === 0) return SIN_DERIVADO_PN
  const saldoInicio = movimientosAnterior.reduce<ColumnasPN>(sumarColumnasPN, {
    ...COLUMNAS_PN_CERO,
  })
  const totalAnteriorByTipo = Object.fromEntries(
    movimientosAnterior.map((mov) => [mov.tipo, multiplicar(totalMovimientoPN(mov), coeficiente)]),
  ) as Partial<Record<TipoMovimientoPN, number>>
  return { saldoInicio, totalAnteriorByTipo }
}

export type BloqueoPN = {
  /** las 6 columnas de la fila "Saldos al inicio" vienen del anterior */
  saldoInicio: boolean
  /** la columna "Ejercicio anterior" viene del anterior */
  totalAnterior: boolean
}

export const SIN_BLOQUEO_PN: BloqueoPN = { saldoInicio: false, totalAnterior: false }

export type ResultadoArrastrePN = {
  movimientos: EvolucionPNMovimientoDTO[]
  bloqueo: BloqueoPN
  advertencias: string[]
}

/**
 * Aplica el arrastre según el modo. Fuera de VINCULADO no pisa nada.
 * En VINCULADO pisa SALDO_INICIO y totalAnterior con lo derivado, cuando hay fuente.
 * Sirve tanto para mostrar como para sanear lo que manda el cliente al guardar.
 */
export function aplicarArrastrePN(
  movimientos: EvolucionPNMovimientoDTO[],
  derivado: DerivadoPN,
  modo: ModoAnteriorEfectivo,
): ResultadoArrastrePN {
  if (modo !== 'VINCULADO') {
    return { movimientos, bloqueo: SIN_BLOQUEO_PN, advertencias: [] }
  }
  if (!derivado.saldoInicio || !derivado.totalAnteriorByTipo) {
    return {
      movimientos,
      bloqueo: SIN_BLOQUEO_PN,
      advertencias: [
        'El ejercicio anterior vinculado no tiene Estado de Evolución del Patrimonio Neto cargado: los saldos al inicio y la columna "Ejercicio anterior" quedan editables.',
      ],
    }
  }
  const saldoInicio = derivado.saldoInicio
  const totales = derivado.totalAnteriorByTipo
  const saneados = movimientos.map((mov) => ({
    ...mov,
    ...(mov.tipo === 'SALDO_INICIO' ? saldoInicio : null),
    totalAnterior: totales[mov.tipo] ?? 0,
  }))
  return {
    movimientos: saneados,
    bloqueo: { saldoInicio: true, totalAnterior: true },
    advertencias: [],
  }
}
