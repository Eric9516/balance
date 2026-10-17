import type { CostoVentasEjercicio } from '@prisma/client'

export type CostoVentasDTO = {
  id: string
  ejercicioId: string
  existenciaInicial: number
  compras: number
  gastosFabricacion: number // "Gastos del ejercicio" en el PDF — cero para empresas comerciales
  existenciaFinal: number
  // costoTotal = existenciaInicial + compras + gastosFabricacion − existenciaFinal (calculado)
}

export function toCostoVentasDTO(c: CostoVentasEjercicio): CostoVentasDTO {
  return {
    id: c.id,
    ejercicioId: c.ejercicioId,
    existenciaInicial: Number(c.existenciaInicial),
    compras: Number(c.compras),
    gastosFabricacion: Number(c.gastosFabricacion),
    existenciaFinal: Number(c.existenciaFinal),
  }
}

export function calcularCostoTotal(dto: Omit<CostoVentasDTO, 'id' | 'ejercicioId'>): number {
  return dto.existenciaInicial + dto.compras + dto.gastosFabricacion - dto.existenciaFinal
}
