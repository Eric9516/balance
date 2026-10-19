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
