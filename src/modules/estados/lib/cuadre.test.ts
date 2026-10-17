import { describe, expect, it } from 'vitest'
import type { RubroFila } from '../domain/types'
import { calcularCuadreSP } from './cuadre'

function rubro(seccionSSP: string, displayValue: number): RubroFila {
  return {
    id: `${seccionSSP}-${displayValue}`,
    codigo: '',
    nombre: '',
    estadoDestino: seccionSSP === 'PATRIMONIO_NETO' ? 'PN' : 'SSP',
    seccionSSP,
    seccionEERR: null,
    naturalezaEsperada: seccionSSP.startsWith('ACTIVO') ? 'DEUDORA' : 'ACREEDORA',
    orden: 0,
    displayValue,
    displayValueAnt: 0,
    notaNumero: null,
    cuentas: [],
  }
}

describe('calcularCuadreSP: Activo = Pasivo + PN', () => {
  const rubros = [
    rubro('ACTIVO_CORRIENTE', 700),
    rubro('ACTIVO_NO_CORRIENTE', 300),
    rubro('PASIVO_CORRIENTE', 400),
    rubro('PASIVO_NO_CORRIENTE', 100),
    rubro('PATRIMONIO_NETO', 500),
  ]

  it('cuadra con el PN de los rubros', () => {
    expect(calcularCuadreSP(rubros, null)).toEqual({
      totalActivo: 1000,
      totalPasivoPN: 1000,
      diferencia: 0,
      cuadrado: true,
    })
  })

  it('el PN final de la Evolución del PN reemplaza al de los rubros', () => {
    const r = calcularCuadreSP(rubros, 450)
    expect(r.totalPasivoPN).toBe(950)
    expect(r.diferencia).toBe(50)
    expect(r.cuadrado).toBe(false)
  })
})
