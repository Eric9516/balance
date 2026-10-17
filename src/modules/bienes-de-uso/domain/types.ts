import type { BienDeUsoCategoria } from '@prisma/client'

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
  costoFinReexpresado: number   // calculado: inicio + ajuste + altas − bajas
  // ── DEPRECIACIONES ACUMULADAS ─────────────────────────────────────────────────
  depAcumInicio: number
  depAjusteInflacion: number
  depEjercicio: number
  depBajas: number
  depAcumFin: number            // calculado: inicio + ajuste + ejercicio − bajas
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
    costoInicioReexpresado: Number(b.costoInicioReexpresado),
    costoAjusteInflacion: Number(b.costoAjusteInflacion),
    altas: Number(b.altas),
    bajas: Number(b.bajas),
    costoFinReexpresado: Number(b.costoFinReexpresado),
    depAcumInicio: Number(b.depAcumInicio),
    depAjusteInflacion: Number(b.depAjusteInflacion),
    depEjercicio: Number(b.depEjercicio),
    depBajas: Number(b.depBajas),
    depAcumFin: Number(b.depAcumFin),
    netoResidualAnteriorManual: b.netoResidualAnteriorManual !== null ? Number(b.netoResidualAnteriorManual) : null,
  }
}

// Calcula los campos derivados según la fórmula del PDF
export function calcularCierre(b: Omit<BienDeUsoDTO, 'id' | 'ejercicioId' | 'orden' | 'costoFinReexpresado' | 'depAcumFin' | 'netoResidualAnteriorManual'>) {
  const costoFin = b.costoInicioReexpresado + b.costoAjusteInflacion + b.altas - b.bajas
  const depFin = b.depAcumInicio + b.depAjusteInflacion + b.depEjercicio - b.depBajas
  return {
    costoFinReexpresado: costoFin,
    depAcumFin: depFin,
    netoResidual: costoFin - depFin,
  }
}
