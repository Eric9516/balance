import { restar, sumar, sumarPor } from '@/lib/importe'
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
    sumarPor(
      sspRubros.filter((r) => r.seccionSSP === key),
      (r) => r.displayValue,
    )

  const totalActivo = sumar(secTotal('ACTIVO_CORRIENTE'), secTotal('ACTIVO_NO_CORRIENTE'))
  const totalPasivoPN = sumar(
    secTotal('PASIVO_CORRIENTE'),
    secTotal('PASIVO_NO_CORRIENTE'),
    patrimonioNetoFinal ?? secTotal('PATRIMONIO_NETO'),
  )

  const diferencia = restar(totalActivo, totalPasivoPN)
  const cuadrado = Math.abs(diferencia) < 0.01

  return { totalActivo, totalPasivoPN, diferencia, cuadrado }
}
