import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'

export function getCoeficienteComparativo(ejercicio: {
  indiceInflacionAnterior: number | null
  indiceInflacionActual: number | null
}): number {
  const anterior = ejercicio.indiceInflacionAnterior
  const actual = ejercicio.indiceInflacionActual
  if (!anterior || !actual || anterior === 0) return 1
  return actual / anterior
}

export function ajustarCuentas(
  cuentas: CuentaContableDTO[],
  coeficiente: number,
): CuentaContableDTO[] {
  if (coeficiente === 1) return cuentas
  return cuentas.map((c) => ({
    ...c,
    saldoDeudor: c.saldoDeudor * coeficiente,
    saldoAcreedor: c.saldoAcreedor * coeficiente,
    saldoFinal: c.saldoFinal * coeficiente,
  }))
}

export function ajustarCostoVentas(
  dto: CostoVentasDTO | null,
  coeficiente: number,
): CostoVentasDTO | null {
  if (!dto || coeficiente === 1) return dto
  return {
    ...dto,
    existenciaInicial: dto.existenciaInicial * coeficiente,
    compras: dto.compras * coeficiente,
    gastosFabricacion: dto.gastosFabricacion * coeficiente,
    existenciaFinal: dto.existenciaFinal * coeficiente,
  }
}
