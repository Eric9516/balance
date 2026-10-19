import type { CostoVentasEjercicio } from '@prisma/client'
import { importe, restar, sumar, sumarPor } from '@/lib/importe'

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
    existenciaInicial: importe(c.existenciaInicial),
    compras: importe(c.compras),
    gastosFabricacion: importe(c.gastosFabricacion),
    existenciaFinal: importe(c.existenciaFinal),
  }
}

export function calcularCostoTotal(dto: Omit<CostoVentasDTO, 'id' | 'ejercicioId'>): number {
  return restar(
    sumar(dto.existenciaInicial, dto.compras, dto.gastosFabricacion),
    dto.existenciaFinal,
  )
}

// ─── Exposición del anexo ─────────────────────────────────────────────────────

export const COSTO_VENTAS_VACIO: Omit<CostoVentasDTO, 'id' | 'ejercicioId'> = {
  existenciaInicial: 0,
  compras: 0,
  gastosFabricacion: 0,
  existenciaFinal: 0,
}

export type ConceptoCostoVentas = keyof typeof COSTO_VENTAS_VACIO

/** Filas fijas del Anexo II en el orden de exposición. La existencia final resta. */
export const CONCEPTOS_COSTO_VENTAS: { clave: ConceptoCostoVentas; label: string }[] = [
  { clave: 'existenciaInicial', label: 'Existencia al comienzo del ejercicio' },
  { clave: 'compras', label: 'Compras del ejercicio' },
  { clave: 'gastosFabricacion', label: 'Gastos del ejercicio' },
  { clave: 'existenciaFinal', label: 'Existencia al final del ejercicio' },
]

export const TOTAL_COSTO_VENTAS_LABEL = 'Costo de Mercaderías Vendidas'

/**
 * Costo total de la columna "Ejercicio anterior": el de las filas fijas más los
 * conceptos que solo existieron ese año (carga manual). null si no hay nada.
 */
export function costoAnteriorConExtras(
  datosAnteriores: CostoVentasDTO | null,
  extras: { valor: number }[],
): number | null {
  const sumaExtra = sumarPor(extras, (c) => c.valor)
  if (datosAnteriores) return sumar(calcularCostoTotal(datosAnteriores), sumaExtra)
  return sumaExtra !== 0 ? sumaExtra : null
}
