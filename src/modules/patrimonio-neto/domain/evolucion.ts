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
}): EvolucionPNData {
  const { ejercicioId, guardados, resultadoEjercicio, modo, derivado = SIN_DERIVADO_PN } = params
  const base = conResultado(completarMovimientos(ejercicioId, guardados), resultadoEjercicio)
  const { movimientos, bloqueo, advertencias } = aplicarArrastrePN(base, derivado, modo)
  return {
    movimientos,
    resultadoEjercicio,
    totalActual: movimientos.reduce((acc, mov) => acc + totalMovimientoPN(mov), 0),
    totalAnterior: movimientos.reduce((acc, mov) => acc + mov.totalAnterior, 0),
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
