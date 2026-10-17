import type { RubroFila } from '../domain/types'

export interface ResultadoCuadreSP {
  totalActivo: number
  totalPasivoPN: number
  diferencia: number
  cuadrado: boolean
}

export function calcularCuadreSP(
  sspRubros: RubroFila[],
  patrimonioNetoFinal: number | null,
): ResultadoCuadreSP {
  const secTotal = (key: string) =>
    sspRubros.filter((r) => r.seccionSSP === key).reduce((acc, r) => acc + r.displayValue, 0)

  const totalActivo = secTotal('ACTIVO_CORRIENTE') + secTotal('ACTIVO_NO_CORRIENTE')
  const totalPasivoPN =
    secTotal('PASIVO_CORRIENTE') +
    secTotal('PASIVO_NO_CORRIENTE') +
    (patrimonioNetoFinal ??
      sspRubros
        .filter((r) => r.seccionSSP === 'PATRIMONIO_NETO')
        .reduce((acc, r) => acc + r.displayValue, 0))

  const diferencia = totalActivo - totalPasivoPN
  const cuadrado = Math.abs(diferencia) < 0.01

  return { totalActivo, totalPasivoPN, diferencia, cuadrado }
}
