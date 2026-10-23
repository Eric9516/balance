import { describe, it, expect } from 'vitest'
import { aplicarArrastreCostoVentas } from './saldosInicio'

const actual = {
  id: 'a',
  ejercicioId: 'e',
  existenciaInicial: 5,
  compras: 100,
  gastosFabricacion: 0,
  existenciaFinal: 40,
}
const anterior = {
  id: 'b',
  ejercicioId: 'ant',
  existenciaInicial: 1,
  compras: 50,
  gastosFabricacion: 0,
  existenciaFinal: 30,
}

describe('aplicarArrastreCostoVentas', () => {
  it('VINCULADO con fuente: existencia inicial = existencia final anterior, bloqueada', () => {
    const r = aplicarArrastreCostoVentas(actual, anterior, 'VINCULADO')
    expect(r.datos?.existenciaInicial).toBe(30)
    expect(r.datos?.compras).toBe(100)
    expect(r.existenciaInicialBloqueada).toBe(true)
    expect(r.existenciaInicialDerivada).toBe(30)
  })
  it('VINCULADO sin anexo actual todavía: igual informa el valor derivado', () => {
    const r = aplicarArrastreCostoVentas(null, anterior, 'VINCULADO')
    expect(r.datos).toBeNull()
    expect(r.existenciaInicialDerivada).toBe(30)
    expect(r.existenciaInicialBloqueada).toBe(true)
  })
  it('VINCULADO sin fuente: editable con advertencia', () => {
    const r = aplicarArrastreCostoVentas(actual, null, 'VINCULADO')
    expect(r.datos).toBe(actual)
    expect(r.existenciaInicialBloqueada).toBe(false)
    expect(r.advertencias[0]).toMatch(/Costo de Ventas/)
  })
  // MANUAL: la existencia inicial sale de la existencia final cargada en la columna del anterior
  // (ver existencias-manual.test.ts).
  it('sin anterior: nunca pisa', () => {
    for (const modo of ['SIN_ANTERIOR', 'PENDIENTE'] as const) {
      const r = aplicarArrastreCostoVentas(actual, anterior, modo)
      expect(r.datos).toBe(actual)
      expect(r.existenciaInicialBloqueada).toBe(false)
    }
  })
})
