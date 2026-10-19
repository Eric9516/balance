import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import type { CostoVentasDTO } from '@/modules/costo-ventas/domain/types'
import { dividir, multiplicar } from '@/lib/importe'

export function getCoeficienteComparativo(ejercicio: {
  indiceInflacionAnterior: number | null
  indiceInflacionActual: number | null
}): number {
  const anterior = ejercicio.indiceInflacionAnterior
  const actual = ejercicio.indiceInflacionActual
  if (!anterior || !actual || anterior === 0) return 1
  return dividir(actual, anterior)
}

export function ajustarCuentas(
  cuentas: CuentaContableDTO[],
  coeficiente: number,
): CuentaContableDTO[] {
  if (coeficiente === 1) return cuentas
  return cuentas.map((c) => ({
    ...c,
    saldoDeudor: multiplicar(c.saldoDeudor, coeficiente),
    saldoAcreedor: multiplicar(c.saldoAcreedor, coeficiente),
    saldoFinal: multiplicar(c.saldoFinal, coeficiente),
  }))
}

export function ajustarCostoVentas(
  dto: CostoVentasDTO | null,
  coeficiente: number,
): CostoVentasDTO | null {
  if (!dto || coeficiente === 1) return dto
  return {
    ...dto,
    existenciaInicial: multiplicar(dto.existenciaInicial, coeficiente),
    compras: multiplicar(dto.compras, coeficiente),
    gastosFabricacion: multiplicar(dto.gastosFabricacion, coeficiente),
    existenciaFinal: multiplicar(dto.existenciaFinal, coeficiente),
  }
}
