import { describe, expect, it } from 'vitest'
import { importeEditable, parseImporte } from './parseImporte'

describe('parseImporte', () => {
  it.each([
    // Formato argentino
    ['1.234,56', 1234.56],
    ['1.234.567,89', 1234567.89],
    ['1,5', 1.5],
    ['0,01', 0.01],
    // Miles AR sin decimales (antes devolvía 150 y 1.234)
    ['150.000', 150000],
    ['1.000', 1000],
    ['1.234.567', 1234567],
    // Formato anglosajón
    ['1,234.56', 1234.56],
    ['1,234,567', 1234567],
    // Punto decimal no ambiguo
    ['1.5', 1.5],
    ['1234.56', 1234.56],
    ['0.123', 0.123],
    // Negativos y símbolos
    ['-1.234,56', -1234.56],
    ['(1.234,56)', -1234.56],
    ['$ 1.234,56', 1234.56],
    ['  42  ', 42],
  ])('"%s" → %d', (entrada, esperado) => {
    expect(parseImporte(entrada)).toBe(esperado)
  })

  it.each(['', '-', '—', 'abc', '1,2,3.4.5x', null, undefined])('%j → 0', (entrada) => {
    expect(parseImporte(entrada)).toBe(0)
  })

  it('números pasan tal cual; NaN/Infinity → 0', () => {
    expect(parseImporte(1234.56)).toBe(1234.56)
    expect(parseImporte(Number.NaN)).toBe(0)
    expect(parseImporte(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('importeEditable', () => {
  it('formatea en AR sin miles y 0 como vacío', () => {
    expect(importeEditable(1234.56)).toBe('1234,56')
    expect(importeEditable(-5)).toBe('-5')
    expect(importeEditable(0)).toBe('')
  })

  it.each([1234.56, 1.234, 150000, -0.5, 0.01, 1234567.89])(
    'es la inversa exacta de parseImporte (%d)',
    (n) => {
      expect(parseImporte(importeEditable(n))).toBe(n)
    },
  )
})
