import { describe, expect, it } from 'vitest'
import type { EERRData } from './types'
import { armarLineasEERR, etiquetaResultado } from './lineasEERR'

function eerr(overrides: Partial<EERRData> = {}): EERRData {
  return {
    ingresos: 1000,
    ingresosAnt: 800,
    notaIngresosNum: 5,
    costoVentas: 600,
    costoVentasAnt: 500,
    notaCostoVentasNum: 10,
    usaAnexoCosto: true,
    seccionesGasto: [
      { key: 'grupo:adm', nombre: 'Gastos de administración', total: 100, totalAnt: 90 },
    ],
    usaAnexoGastos: true,
    resultadosFinancieros: -50,
    resultadosFinancierosAnt: 20,
    rfCuentas: [],
    impuestoGanancias: 30,
    impuestoGananciasAnt: 25,
    igCuentas: [],
    utilidadBruta: 400,
    utilidadBrutaAnt: 300,
    resultadoAntesIG: 250,
    resultadoAntesIGAnt: 230,
    utilidadEjercicio: 220,
    utilidadEjercicioAnt: -40,
    ...overrides,
  }
}

describe('armarLineasEERR', () => {
  it('expone las líneas en el orden del estado, con nota, deducción y subtotales', () => {
    const lineas = armarLineasEERR(eerr())
    expect(lineas.map((l) => l.clave)).toEqual([
      'INGRESOS',
      'COSTO_VENTAS',
      'UTILIDAD_BRUTA',
      'grupo:adm',
      'RESULTADOS_FINANCIEROS',
      'RESULTADO_ANTES_IG',
      'IMPUESTO_GANANCIAS',
      'RESULTADO_EJERCICIO',
    ])
    expect(lineas[0]?.notaNumero).toBe(5)
    expect(lineas[1]).toMatchObject({
      etiqueta: 'Costo de los bienes vendidos y servicios (Anexo II)',
      deduccion: true,
      notaNumero: 10,
    })
    expect(lineas[2]?.tipo).toBe('subtotal')
    expect(lineas[3]?.etiqueta).toBe('Gastos de administración (Anexo III)')
    expect(lineas[6]?.deduccion).toBe(true)
  })

  it('sin Anexo II usa la etiqueta de costo sin referencia al anexo', () => {
    const lineas = armarLineasEERR(eerr({ usaAnexoCosto: false }))
    expect(lineas[1]?.etiqueta).toBe('Costo de los bienes vendidos y servicios')
  })

  it('con ganancia, la última línea deja la pérdida del anterior entre paréntesis', () => {
    const final = armarLineasEERR(eerr()).at(-1)
    expect(final).toMatchObject({
      tipo: 'final',
      etiqueta: 'GANANCIA DEL PERÍODO',
      valor: 220,
      valorAnt: -40,
    })
  })

  it('con pérdida, invierte el sentido de ambas columnas', () => {
    const final = armarLineasEERR(eerr({ utilidadEjercicio: -120, utilidadEjercicioAnt: 60 })).at(
      -1,
    )
    expect(final).toMatchObject({ etiqueta: 'PÉRDIDA DEL PERÍODO', valor: 120, valorAnt: -60 })
  })

  it('etiquetaResultado trata el cero como ganancia', () => {
    expect(etiquetaResultado(0)).toBe('GANANCIA DEL PERÍODO')
    expect(etiquetaResultado(-1)).toBe('PÉRDIDA DEL PERÍODO')
  })
})
