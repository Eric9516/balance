/**
 * Primera aplicación de la RT 54: la fila "Modificación de saldos al inicio" del E.E.P.N. es, columna
 * por columna, la suma de los ajustes de medición de la nota de transición. Se calcula acá para no
 * tipear dos veces el mismo importe. Puro.
 */
import { restar, sumar } from '@/lib/importe'
import type { AjusteTransicionDTO, ComponentePN } from './types'

export type ColumnasPN = {
  capitalSuscripto: number
  ajusteCapital: number
  aportesIrrevocables: number
  reservaLegal: number
  otrasReservas: number
  rdosNoAsignados: number
}

const COLUMNA: Record<ComponentePN, keyof ColumnasPN> = {
  CAPITAL_SUSCRIPTO: 'capitalSuscripto',
  AJUSTE_CAPITAL: 'ajusteCapital',
  APORTES_IRREVOCABLES: 'aportesIrrevocables',
  RESERVA_LEGAL: 'reservaLegal',
  OTRAS_RESERVAS: 'otrasReservas',
  RDOS_NO_ASIGNADOS: 'rdosNoAsignados',
}

const COLUMNAS = Object.values(COLUMNA)

/**
 * La fila que corresponde a los ajustes de medición. Null si algún ajuste con importe no dice a qué
 * componente del patrimonio neto va: no se puede repartir y la fila queda como la cargó el contador.
 */
export function modificacionInicioDesdeAjustes(
  ajustes: Pick<AjusteTransicionDTO, 'tipo' | 'componentePN' | 'importePN'>[],
): ColumnasPN | null {
  const fila: ColumnasPN = {
    capitalSuscripto: 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: 0,
  }
  for (const a of ajustes) {
    if (a.tipo !== 'AJUSTE_MEDICION' || a.importePN === 0) continue
    if (!a.componentePN) return null
    const columna = COLUMNA[a.componentePN]
    fila[columna] = sumar(fila[columna], a.importePN)
  }
  return fila
}

/**
 * La fila sigue a los ajustes si está vacía (nunca se cargó) o si es igual a lo que daban los ajustes
 * antes del cambio. Si el contador la cambió a mano (por ejemplo, para incluir la corrección de un
 * error), no se toca: la compuerta avisa la diferencia (AUT-040).
 */
export function filaSigueAjustes(fila: ColumnasPN, antes: ColumnasPN | null): boolean {
  if (COLUMNAS.every((c) => fila[c] === 0)) return true
  return antes !== null && COLUMNAS.every((c) => restar(fila[c], antes[c]) === 0)
}

export function mismasColumnas(a: ColumnasPN, b: ColumnasPN): boolean {
  return COLUMNAS.every((c) => restar(a[c], b[c]) === 0)
}
