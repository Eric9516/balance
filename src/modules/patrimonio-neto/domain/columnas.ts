/**
 * Modelo de columnas del Estado de Evolución del Patrimonio Neto: los seis
 * componentes del PN agrupados en "Aporte de los propietarios" y "Resultados
 * acumulados", con sus subtotales. Fuente única para la pantalla y el documento.
 */

import type { EvolucionPNMovimientoDTO } from './types'

export type CampoPN =
  | 'capitalSuscripto'
  | 'ajusteCapital'
  | 'aportesIrrevocables'
  | 'reservaLegal'
  | 'otrasReservas'
  | 'rdosNoAsignados'

type Mov = EvolucionPNMovimientoDTO

export const GRUPOS_PN = ['aportes', 'resultados'] as const
export type GrupoPN = (typeof GRUPOS_PN)[number]

export type ColumnaPN =
  | { tipo: 'campo'; campo: CampoPN; label: string }
  | { tipo: 'subtotal'; label: string; calc: (m: Mov) => number }

export const sumAportesPN = (m: Mov) => m.capitalSuscripto + m.ajusteCapital + m.aportesIrrevocables
export const sumReservasPN = (m: Mov) => m.reservaLegal + m.otrasReservas
export const sumResultadosPN = (m: Mov) => sumReservasPN(m) + m.rdosNoAsignados

export const COLUMNAS_PN: Record<
  GrupoPN,
  { titulo: string; columnas: ColumnaPN[]; plegado: ColumnaPN }
> = {
  aportes: {
    titulo: 'Aporte de los propietarios',
    columnas: [
      { tipo: 'campo', campo: 'capitalSuscripto', label: 'Capital suscripto' },
      { tipo: 'campo', campo: 'ajusteCapital', label: 'Ajuste del capital' },
      { tipo: 'campo', campo: 'aportesIrrevocables', label: 'Aportes irrevocables' },
      { tipo: 'subtotal', label: 'Total', calc: sumAportesPN },
    ],
    plegado: { tipo: 'subtotal', label: 'Total aportes', calc: sumAportesPN },
  },
  resultados: {
    titulo: 'Resultados acumulados',
    columnas: [
      { tipo: 'campo', campo: 'reservaLegal', label: 'Reserva legal' },
      { tipo: 'campo', campo: 'otrasReservas', label: 'Otras reservas' },
      { tipo: 'subtotal', label: 'Total reservas', calc: sumReservasPN },
      { tipo: 'campo', campo: 'rdosNoAsignados', label: 'Resultados no asignados' },
    ],
    plegado: { tipo: 'subtotal', label: 'Total resultados', calc: sumResultadosPN },
  },
}

/** Valor de una columna para un movimiento (campo o subtotal). */
export function valorColumnaPN(col: ColumnaPN, mov: Mov): number {
  return col.tipo === 'campo' ? mov[col.campo] : col.calc(mov)
}
