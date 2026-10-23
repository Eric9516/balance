import type { BienDeUsoCategoria } from '@prisma/client'
import { importe, restar, sumar } from '@/lib/importe'

export type BienDeUsoDTO = {
  id: string
  ejercicioId: string
  categoria: string
  orden: number
  // ── COSTO REEXPRESADO ────────────────────────────────────────────────────────
  costoInicioReexpresado: number
  costoAjusteInflacion: number
  altas: number
  bajas: number
  costoFinReexpresado: number // calculado: inicio + ajuste + altas − bajas
  // ── DEPRECIACIONES ACUMULADAS ─────────────────────────────────────────────────
  depAcumInicio: number
  depAjusteInflacion: number
  depEjercicio: number
  depBajas: number
  depAcumFin: number // calculado: inicio + ajuste + ejercicio − bajas
  // ── NETO RESIDUAL ─────────────────────────────────────────────────────────────
  // netoResidual = costoFinReexpresado − depAcumFin  (calculado en app)
  // netoResidualAnteriorManual: ingreso manual cuando no hay ejercicio anterior en sistema
  netoResidualAnteriorManual: number | null
}

export function toBienDeUsoDTO(b: BienDeUsoCategoria): BienDeUsoDTO {
  return {
    id: b.id,
    ejercicioId: b.ejercicioId,
    categoria: b.categoria,
    orden: b.orden,
    costoInicioReexpresado: importe(b.costoInicioReexpresado),
    costoAjusteInflacion: importe(b.costoAjusteInflacion),
    altas: importe(b.altas),
    bajas: importe(b.bajas),
    costoFinReexpresado: importe(b.costoFinReexpresado),
    depAcumInicio: importe(b.depAcumInicio),
    depAjusteInflacion: importe(b.depAjusteInflacion),
    depEjercicio: importe(b.depEjercicio),
    depBajas: importe(b.depBajas),
    depAcumFin: importe(b.depAcumFin),
    netoResidualAnteriorManual:
      b.netoResidualAnteriorManual !== null ? importe(b.netoResidualAnteriorManual) : null,
  }
}

/**
 * Carga manual: neto residual del año anterior de una categoría. El comienzo de este año es el
 * cierre del anterior, así que sale del valor y la amortización al comienzo (con su ajuste por
 * inflación), que ya se cargaron: no se tipea dos veces. Un importe escrito a mano se respeta
 * (los ejercicios ya cargados no cambian). Null si la categoría no tiene comienzo (es del año).
 */
export function netoAnteriorManualBDU(
  b: Pick<
    BienDeUsoDTO,
    | 'costoInicioReexpresado'
    | 'costoAjusteInflacion'
    | 'depAcumInicio'
    | 'depAjusteInflacion'
    | 'netoResidualAnteriorManual'
  >,
): number | null {
  if (b.netoResidualAnteriorManual != null) return b.netoResidualAnteriorManual
  return netoAlComienzoBDU(b)
}

/** Valor al comienzo menos amortización al comienzo, con sus ajustes. Null si no hay comienzo. */
export function netoAlComienzoBDU(
  b: Pick<
    BienDeUsoDTO,
    'costoInicioReexpresado' | 'costoAjusteInflacion' | 'depAcumInicio' | 'depAjusteInflacion'
  >,
): number | null {
  const costo = sumar(b.costoInicioReexpresado, b.costoAjusteInflacion)
  const amortizacion = sumar(b.depAcumInicio, b.depAjusteInflacion)
  if (costo === 0 && amortizacion === 0) return null
  return restar(costo, amortizacion)
}

// Calcula los campos derivados según la fórmula del PDF
export function calcularCierre(
  b: Omit<
    BienDeUsoDTO,
    | 'id'
    | 'ejercicioId'
    | 'orden'
    | 'costoFinReexpresado'
    | 'depAcumFin'
    | 'netoResidualAnteriorManual'
  >,
) {
  const costoFin = restar(sumar(b.costoInicioReexpresado, b.costoAjusteInflacion, b.altas), b.bajas)
  const depFin = restar(sumar(b.depAcumInicio, b.depAjusteInflacion, b.depEjercicio), b.depBajas)
  return {
    costoFinReexpresado: costoFin,
    depAcumFin: depFin,
    netoResidual: restar(costoFin, depFin),
  }
}
