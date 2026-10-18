import { describe, it, expect } from 'vitest'
import type { BienDeUsoDTO } from './types'
import {
  aplicarArrastreBienesDeUso,
  derivarArrastreBienesDeUso,
  normalizarCategoria,
} from './saldosInicio'

function bien(id: string, categoria: string, cols: Partial<BienDeUsoDTO> = {}): BienDeUsoDTO {
  return {
    id,
    ejercicioId: 'e',
    categoria,
    orden: 0,
    costoInicioReexpresado: 0,
    costoAjusteInflacion: 0,
    altas: 0,
    bajas: 0,
    costoFinReexpresado: 0,
    depAcumInicio: 0,
    depAjusteInflacion: 0,
    depEjercicio: 0,
    depBajas: 0,
    depAcumFin: 0,
    netoResidualAnteriorManual: null,
    ...cols,
  }
}

const anterior = [
  bien('a1', 'Rodados', {
    costoInicioReexpresado: 1000,
    altas: 200,
    depAcumInicio: 300,
    depEjercicio: 100,
  }),
  bien('a2', 'Muebles y Útiles', { costoInicioReexpresado: 500, depAcumInicio: 50 }),
]

describe('normalizarCategoria', () => {
  it('ignora mayúsculas, acentos y espacios', () => {
    expect(normalizarCategoria('  Muebles   y  ÚTILES ')).toBe('muebles y utiles')
  })
})

describe('derivarArrastreBienesDeUso', () => {
  it('toma los valores al cierre del anterior', () => {
    const m = derivarArrastreBienesDeUso(anterior)
    expect(m.get('rodados')).toEqual({
      costoInicioReexpresado: 1200,
      depAcumInicio: 400,
      netoResidualAnterior: 800,
    })
  })
})

describe('aplicarArrastreBienesDeUso', () => {
  const actual = [
    bien('b1', 'rodados', {
      costoInicioReexpresado: 1,
      depAcumInicio: 1,
      altas: 50,
      netoResidualAnteriorManual: 9,
    }),
    bien('b2', 'Instalaciones', { costoInicioReexpresado: 70, netoResidualAnteriorManual: 11 }),
  ]
  const arrastre = derivarArrastreBienesDeUso(anterior)

  it('VINCULADO: pisa inicio en filas con fuente, recalcula cierre, deja editables las demás', () => {
    const r = aplicarArrastreBienesDeUso(actual, arrastre, 'VINCULADO')
    const rod = r.bienes.find((b) => b.id === 'b1')!
    expect(rod.costoInicioReexpresado).toBe(1200)
    expect(rod.depAcumInicio).toBe(400)
    expect(rod.costoFinReexpresado).toBe(1250) // 1200 + altas 50
    expect(rod.netoResidualAnteriorManual).toBeNull()
    expect(r.netoAnteriorMap.get('rodados')).toBe(800)
    expect(r.bloqueadas.has('b1')).toBe(true)
    const inst = r.bienes.find((b) => b.id === 'b2')!
    expect(inst.costoInicioReexpresado).toBe(70)
    expect(r.bloqueadas.has('b2')).toBe(false)
    expect(r.sinDato).toEqual(['Instalaciones'])
    expect(r.advertencias[0]).toMatch(/Instalaciones/)
  })

  it('VINCULADO sin anexo anterior: nada bloqueado, todo editable, advertencia', () => {
    const r = aplicarArrastreBienesDeUso(actual, new Map(), 'VINCULADO')
    expect(r.bienes).toBe(actual)
    expect(r.bloqueadas.size).toBe(0)
    expect(r.advertencias[0]).toMatch(/no tiene Anexo/)
  })

  it('MANUAL: no pisa nada y el neto anterior sale del valor manual', () => {
    const r = aplicarArrastreBienesDeUso(actual, arrastre, 'MANUAL')
    expect(r.bienes).toBe(actual)
    expect(r.netoAnteriorMap.get('rodados')).toBe(9)
    expect(r.netoAnteriorMap.get('Instalaciones')).toBe(11)
    expect(r.bloqueadas.size).toBe(0)
  })

  it('SIN_ANTERIOR / PENDIENTE: sin neto anterior', () => {
    expect(aplicarArrastreBienesDeUso(actual, arrastre, 'SIN_ANTERIOR').netoAnteriorMap.size).toBe(
      0,
    )
    expect(aplicarArrastreBienesDeUso(actual, arrastre, 'PENDIENTE').netoAnteriorMap.size).toBe(0)
  })
})
