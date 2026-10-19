import type { EvolucionPNMovimiento, TipoMovimientoPN } from '@prisma/client'
import { importe, sumar } from '@/lib/importe'

export const PN_MOVIMIENTOS: Array<{ tipo: TipoMovimientoPN; orden: number; label: string }> = [
  { tipo: 'SALDO_INICIO', orden: 10, label: 'Saldos al inicio del ejercicio' },
  { tipo: 'AJUSTE_INFLACION', orden: 20, label: 'Ajuste por inflación del ejercicio' },
  {
    tipo: 'MODIFICACION_INICIO',
    orden: 30,
    label: 'Modificación de saldos al inicio del ejercicio',
  },
  { tipo: 'DISTRIB_HONORARIOS', orden: 40, label: 'Honorarios' },
  { tipo: 'DISTRIB_DIVIDENDOS', orden: 50, label: 'Dividendos' },
  { tipo: 'DISTRIB_RESERVA_LEGAL', orden: 60, label: 'Reserva Legal' },
  { tipo: 'DISTRIB_OTRAS_RESERVAS', orden: 70, label: 'Otras Reservas' },
  { tipo: 'DISTRIB_APORTES_IRREVOCABLES', orden: 80, label: 'Aportes Irrevocables' },
  { tipo: 'RESULTADO_EJERCICIO', orden: 90, label: 'Resultado del ejercicio' },
]

export type EvolucionPNMovimientoDTO = {
  id: string
  ejercicioId: string
  tipo: TipoMovimientoPN
  orden: number
  capitalSuscripto: number
  ajusteCapital: number
  aportesIrrevocables: number
  reservaLegal: number
  otrasReservas: number
  rdosNoAsignados: number
  totalAnterior: number
}

export type EvolucionPNData = {
  movimientos: EvolucionPNMovimientoDTO[]
  resultadoEjercicio: number
  totalActual: number
  totalAnterior: number
  /** Qué viene bloqueado desde el ejercicio anterior (modo VINCULADO con fuente). */
  bloqueo: { saldoInicio: boolean; totalAnterior: boolean }
  advertencias: string[]
}

export type EvolucionPNInput = Omit<EvolucionPNMovimientoDTO, 'id' | 'ejercicioId'>

export function toEvolucionPNMovimientoDTO(row: EvolucionPNMovimiento): EvolucionPNMovimientoDTO {
  return {
    id: row.id,
    ejercicioId: row.ejercicioId,
    tipo: row.tipo,
    orden: row.orden,
    capitalSuscripto: importe(row.capitalSuscripto),
    ajusteCapital: importe(row.ajusteCapital),
    aportesIrrevocables: importe(row.aportesIrrevocables),
    reservaLegal: importe(row.reservaLegal),
    otrasReservas: importe(row.otrasReservas),
    rdosNoAsignados: importe(row.rdosNoAsignados),
    totalAnterior: importe(row.totalAnterior),
  }
}

export function totalMovimientoPN(
  row: Pick<
    EvolucionPNMovimientoDTO,
    | 'capitalSuscripto'
    | 'ajusteCapital'
    | 'aportesIrrevocables'
    | 'reservaLegal'
    | 'otrasReservas'
    | 'rdosNoAsignados'
  >,
): number {
  return sumar(
    row.capitalSuscripto,
    row.ajusteCapital,
    row.aportesIrrevocables,
    row.reservaLegal,
    row.otrasReservas,
    row.rdosNoAsignados,
  )
}
