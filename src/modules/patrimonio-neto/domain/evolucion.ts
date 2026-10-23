/**
 * Armado del Estado de Evolución del Patrimonio Neto a partir de las filas guardadas:
 * completa las filas faltantes, copia el resultado del ejercicio desde el EERR y
 * aplica el arrastre desde el ejercicio anterior según el modo. Puro.
 */

import type { TipoMovimientoPN } from '@prisma/client'
import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import { aplicarArrastrePN, SIN_DERIVADO_PN, type DerivadoPN } from './saldosInicio'
import {
  PN_MOVIMIENTOS,
  totalMovimientoPN,
  type EvolucionPNData,
  type EvolucionPNMovimientoDTO,
} from './types'
import { sumar, sumarPor } from '@/lib/importe'

export function movimientoVacio(
  ejercicioId: string,
  tipo: TipoMovimientoPN,
  orden: number,
): EvolucionPNMovimientoDTO {
  return {
    id: '',
    ejercicioId,
    tipo,
    orden,
    capitalSuscripto: 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: 0,
    totalAnterior: 0,
  }
}

/** El resultado del ejercicio nunca se carga a mano: viene del EERR. */
export function conResultado(
  movimientos: EvolucionPNMovimientoDTO[],
  resultadoEjercicio: number,
): EvolucionPNMovimientoDTO[] {
  return movimientos.map((mov) =>
    mov.tipo === 'RESULTADO_EJERCICIO' ? { ...mov, rdosNoAsignados: resultadoEjercicio } : mov,
  )
}

/** Completa las 9 filas canónicas en orden, usando las guardadas cuando existen. */
export function completarMovimientos(
  ejercicioId: string,
  guardados: EvolucionPNMovimientoDTO[],
): EvolucionPNMovimientoDTO[] {
  const byTipo = new Map(guardados.map((m) => [m.tipo, m]))
  return PN_MOVIMIENTOS.map(
    (base) => byTipo.get(base.tipo) ?? movimientoVacio(ejercicioId, base.tipo, base.orden),
  )
}

export function armarEvolucionPN(params: {
  ejercicioId: string
  guardados: EvolucionPNMovimientoDTO[]
  resultadoEjercicio: number
  modo: ModoAnteriorEfectivo
  derivado?: DerivadoPN
  /**
   * Carga manual: el resultado del año anterior del estado de resultados anterior. Es la columna
   * "Ejercicio anterior" de la fila del resultado: no se carga a mano (la compuerta exige que
   * coincidan, AUT-012). Null en los demás modos.
   */
  resultadoAnterior?: number | null
}): EvolucionPNData {
  const {
    ejercicioId,
    guardados,
    resultadoEjercicio,
    modo,
    derivado = SIN_DERIVADO_PN,
    resultadoAnterior = null,
  } = params
  const base = conResultado(completarMovimientos(ejercicioId, guardados), resultadoEjercicio)
  const arrastre = aplicarArrastrePN(base, derivado, modo)
  const { bloqueo, advertencias } = arrastre
  const movimientos =
    resultadoAnterior === null
      ? arrastre.movimientos
      : arrastre.movimientos.map((mov) =>
          mov.tipo === 'RESULTADO_EJERCICIO' ? { ...mov, totalAnterior: resultadoAnterior } : mov,
        )
  return {
    movimientos,
    resultadoEjercicio,
    totalActual: sumarPor(movimientos, totalMovimientoPN),
    totalAnterior: sumarPor(movimientos, (mov) => mov.totalAnterior),
    bloqueo,
    advertencias,
  }
}

export function totalFila(movimientos: EvolucionPNMovimientoDTO[], tipo: TipoMovimientoPN): number {
  const mov = movimientos.find((m) => m.tipo === tipo)
  return mov ? totalMovimientoPN(mov) : 0
}

export function totalAnteriorFila(
  movimientos: EvolucionPNMovimientoDTO[],
  tipo: TipoMovimientoPN,
): number {
  return movimientos.find((m) => m.tipo === tipo)?.totalAnterior ?? 0
}

// ─── Filas derivadas del estado ──────────────────────────────────────────────

/** Movimientos que componen "Saldos al inicio modificados". */
export const TIPOS_INICIO_MODIFICADO: readonly TipoMovimientoPN[] = [
  'SALDO_INICIO',
  'AJUSTE_INFLACION',
  'MODIFICACION_INICIO',
]

/**
 * Suma columna a columna los movimientos de los tipos indicados (fila derivada:
 * saldos al inicio modificados, saldos al cierre). Los tipos ausentes suman cero.
 */
export function sumarMovimientosPN(
  movimientos: EvolucionPNMovimientoDTO[],
  tipos: readonly TipoMovimientoPN[],
): EvolucionPNMovimientoDTO {
  const byTipo = new Map(movimientos.map((mov) => [mov.tipo, mov]))
  const base = movimientoVacio(movimientos[0]?.ejercicioId ?? '', tipos[0] ?? 'SALDO_INICIO', 0)
  return tipos.reduce((acc, tipo) => {
    const mov = byTipo.get(tipo)
    if (!mov) return acc
    return {
      ...acc,
      capitalSuscripto: sumar(acc.capitalSuscripto, mov.capitalSuscripto),
      ajusteCapital: sumar(acc.ajusteCapital, mov.ajusteCapital),
      aportesIrrevocables: sumar(acc.aportesIrrevocables, mov.aportesIrrevocables),
      reservaLegal: sumar(acc.reservaLegal, mov.reservaLegal),
      otrasReservas: sumar(acc.otrasReservas, mov.otrasReservas),
      rdosNoAsignados: sumar(acc.rdosNoAsignados, mov.rdosNoAsignados),
      totalAnterior: sumar(acc.totalAnterior, mov.totalAnterior),
    }
  }, base)
}

/** Saldos al inicio modificados = saldo inicio + ajuste por inflación + modificación de saldos. */
export function saldoInicioModificadoPN(movimientos: EvolucionPNMovimientoDTO[]) {
  return sumarMovimientosPN(movimientos, TIPOS_INICIO_MODIFICADO)
}

/** Saldos al cierre = suma de todos los movimientos. */
export function saldoCierrePN(movimientos: EvolucionPNMovimientoDTO[]) {
  return sumarMovimientosPN(
    movimientos,
    movimientos.map((mov) => mov.tipo),
  )
}
