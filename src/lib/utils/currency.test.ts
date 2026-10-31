import { describe, expect, it } from 'vitest'
import { formatCoeficiente, formatCoeficienteOchoDecimales, formatCurrency } from './currency'

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

  it("con decimales 'todos' muestra el valor completo, sin redondear", () => {
    expect(formatCurrency(1250.0125, { decimales: 'todos' })).toBe('1.250,0125')
    expect(formatCurrency('-0.005', { decimales: 'todos' })).toBe('(0,005)')
    expect(formatCurrency('1.1234567890123456789012345678', { decimales: 'todos' })).toBe(
      '1,1234567890123456789012345678',
    )
    expect(formatCurrency(5, { decimales: 'todos' })).toBe('5,00')
    expect(formatCurrency(0.1, { decimales: 'todos' })).toBe('0,10')
  })
})

describe('formatCoeficiente', () => {
  it('muestra 2 decimales y corta el resto, sin redondear', () => {
    expect(formatCoeficiente(1.3155)).toBe('1,31')
    expect(formatCoeficiente(1)).toBe('1,00')
    expect(formatCoeficiente(12.345678)).toBe('12,34')
    expect(formatCoeficiente(1.999)).toBe('1,99')
  })
})

describe('formatCoeficienteOchoDecimales', () => {
  it('muestra 8 decimales y corta el resto, sin redondear el último', () => {
    expect(formatCoeficienteOchoDecimales(1.123456789)).toBe('1,12345678')
    expect(formatCoeficienteOchoDecimales(1.999999999)).toBe('1,99999999')
  })

  it('completa con ceros y no se rompe con números muy chicos', () => {
    expect(formatCoeficienteOchoDecimales(1)).toBe('1,00000000')
    expect(formatCoeficienteOchoDecimales(1.5)).toBe('1,50000000')
    expect(formatCoeficienteOchoDecimales(0.000000012)).toBe('0,00000001')
  })
})
