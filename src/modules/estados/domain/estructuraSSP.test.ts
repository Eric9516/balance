import { describe, expect, it } from 'vitest'
import type { RubroFila } from './types'
import { SSP_STRUCTURE, patrimonioNetoSSP, sumarSeccion, sumarSecciones } from './estructuraSSP'

function rubro(seccionSSP: string | null, displayValue: number, displayValueAnt = 0): RubroFila {
  return {
    id: `${seccionSSP}-${displayValue}`,
    codigo: 'X',
    nombre: 'Rubro',
    estadoDestino: seccionSSP === 'PATRIMONIO_NETO' ? 'PN' : 'SSP',
    seccionSSP,
    seccionEERR: null,
    naturalezaEsperada: 'DEUDORA',
    orden: 1,
    displayValue,
    displayValueAnt,
    notaNumero: null,
    cuentas: [],
  }
}

const rubros = [
  rubro('ACTIVO_CORRIENTE', 100, 80),
  rubro('ACTIVO_NO_CORRIENTE', 50, 40),
  rubro('PASIVO_CORRIENTE', 30, 20),
  rubro('PATRIMONIO_NETO', 120, 100),
  rubro(null, 0, 7),
]

describe('estructura del SSP', () => {
  it('tiene los tres bloques en orden', () => {
    expect(SSP_STRUCTURE.map((b) => b.bloque)).toEqual(['ACTIVO', 'PASIVO', 'PATRIMONIO NETO'])
  })

  it('suma secciones y bloques por columna', () => {
    expect(sumarSeccion(rubros, 'ACTIVO_CORRIENTE', 'actual')).toBe(100)
    expect(sumarSeccion(rubros, 'ACTIVO_CORRIENTE', 'anterior')).toBe(80)
    expect(sumarSecciones(rubros, SSP_STRUCTURE[0].sections, 'actual')).toBe(150)
    expect(sumarSecciones(rubros, SSP_STRUCTURE[0].sections, 'anterior')).toBe(120)
  })

  it('el PN sale del E.E.P.N. cuando existe y de los rubros si no', () => {
    expect(patrimonioNetoSSP(rubros, 999, 'actual')).toBe(999)
    expect(patrimonioNetoSSP(rubros, null, 'actual')).toBe(120)
    expect(patrimonioNetoSSP(rubros, null, 'anterior')).toBe(100)
  })
})
