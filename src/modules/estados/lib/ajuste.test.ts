import { describe, expect, it } from 'vitest'
import { dividir, multiplicar } from '@/lib/importe'
import { getCoeficienteComparativo, getIndicesReexpresion, reexpresar } from './ajuste'

describe('reexpresar', () => {
  it('un resultado que cae justo en centavos da esos centavos, sin quedar apenas abajo', () => {
    let casos = 0
    let porElCoeficiente = 0
    for (let a = 1000; a < 9000; a += 37.13) {
      const anterior = multiplicar(Number(a.toPrecision(6)), 1)
      for (let actual = 9000.07; actual < 15000; actual += 511.09) {
        const indice = Number(actual.toPrecision(6))
        for (const n of [1, 7, 12, 300, 4999]) {
          const valor = multiplicar(anterior, n)
          const exacto = multiplicar(indice, n)
          expect(reexpresar(valor, { actual: indice, anterior })).toBe(exacto)
          casos++
          if (multiplicar(valor, dividir(indice, anterior)) !== exacto) porElCoeficiente++
        }
      }
    }
    // Muestra por qué no se pasa por el coeficiente: así, parte de estos casos daba otra cosa
    expect(casos).toBeGreaterThan(1000)
    expect(porElCoeficiente).toBeGreaterThan(0)
  })

  it('no cambia el importe si los índices son iguales o el importe es cero', () => {
    expect(reexpresar(1234.567, { actual: 100, anterior: 100 })).toBe(1234.567)
    expect(reexpresar(0, { actual: 125, anterior: 100 })).toBe(0)
  })

  it('reexpresa también los negativos y los importes con más decimales', () => {
    expect(reexpresar(-1000, { actual: 125, anterior: 100 })).toBe(-1250)
    expect(reexpresar(1000.01, { actual: 125, anterior: 100 })).toBe(1250.0125)
  })
})

describe('los índices del ejercicio', () => {
  it('sin los dos índices no se reexpresa', () => {
    for (const e of [
      { indiceInflacionAnterior: null, indiceInflacionActual: 100 },
      { indiceInflacionAnterior: 100, indiceInflacionActual: null },
      { indiceInflacionAnterior: 0, indiceInflacionActual: 100 },
    ]) {
      expect(getIndicesReexpresion(e)).toEqual({ actual: 1, anterior: 1 })
      expect(getCoeficienteComparativo(e)).toBe(1)
    }
  })

  it('el coeficiente para mostrar es actual ÷ anterior', () => {
    const e = { indiceInflacionAnterior: 100, indiceInflacionActual: 125 }
    expect(getIndicesReexpresion(e)).toEqual({ actual: 125, anterior: 100 })
    expect(getCoeficienteComparativo(e)).toBe(1.25)
  })
})
