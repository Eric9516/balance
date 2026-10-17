import { describe, expect, it } from 'vitest'
import { formatCurrency } from './currency'

describe('formatCurrency (formato AR)', () => {
  it.each([
    [1234567.891, '1.234.567,89'],
    [0, '0,00'],
    [-1234.5, '(1.234,50)'],
    ['999.995', '1.000,00'],
  ])('%s → %s', (valor, esperado) => {
    expect(formatCurrency(valor)).toBe(esperado)
  })

  it('respeta opciones de decimales, símbolo y cero como guion', () => {
    expect(formatCurrency(1234.5, { decimales: 0 })).toBe('1.235')
    expect(formatCurrency(10, { mostrarSimbolo: true })).toBe('$ 10,00')
    expect(formatCurrency(0, { ceroComoGuion: true })).toBe('-')
    expect(formatCurrency(null)).toBe('-')
  })
})
