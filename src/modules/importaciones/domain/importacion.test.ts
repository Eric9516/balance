import { describe, expect, it } from 'vitest'
import { importesDeFila, procesarFilas, validarCuadre } from './importacion'

describe('importesDeFila', () => {
  it('parsea formato AR y calcula saldo = debe - haber sin error de float', () => {
    expect(importesDeFila({ saldoDeudor: '1.234,56', saldoAcreedor: '0' })).toEqual({
      saldoDeudor: 1234.56,
      saldoAcreedor: 0,
      saldoFinal: 1234.56,
    })
    expect(importesDeFila({ saldoDeudor: 0.3, saldoAcreedor: 0.1 }).saldoFinal).toBe(0.2)
  })
})

describe('procesarFilas', () => {
  it('descarta filas sin código o nombre y las cuenta como error', () => {
    const r = procesarFilas([
      { codigo: '1.1.01', nombre: 'Caja', saldoDeudor: '100', saldoAcreedor: '' },
      { codigo: '', nombre: 'Sin código', saldoDeudor: '1', saldoAcreedor: '' },
      { codigo: '2.1.01', nombre: '  ', saldoDeudor: '1', saldoAcreedor: '' },
    ])
    expect(r.cuentas).toHaveLength(1)
    expect(r.filasError).toBe(2)
    expect(r.cuentas[0]).toMatchObject({ codigo: '1.1.01', nombre: 'Caja', saldoFinal: 100 })
  })

  it('detecta códigos repetidos (la DB exige código único por ejercicio)', () => {
    const fila = { nombre: 'X', saldoDeudor: '1', saldoAcreedor: '0' }
    const r = procesarFilas([
      { codigo: 'A', ...fila },
      { codigo: 'B', ...fila },
      { codigo: 'A', ...fila },
      { codigo: ' A ', ...fila },
    ])
    expect(r.codigosDuplicados).toEqual(['A'])
  })
})

describe('validarCuadre', () => {
  it('cuadra cuando debe = haber, sumando en Decimal', () => {
    // 0.1 + 0.2 en float da 0.30000000000000004
    const r = validarCuadre([
      { saldoDeudor: 0.1, saldoAcreedor: 0 },
      { saldoDeudor: 0.2, saldoAcreedor: 0 },
      { saldoDeudor: 0, saldoAcreedor: 0.3 },
    ])
    expect(r).toEqual({ totalDeudor: 0.3, totalAcreedor: 0.3, diferencia: 0, cuadrado: true })
  })

  it('no tolera ninguna diferencia (jamás se redondea)', () => {
    expect(validarCuadre([{ saldoDeudor: 100.5, saldoAcreedor: 100.5 }]).cuadrado).toBe(true)
    expect(validarCuadre([{ saldoDeudor: 100.01, saldoAcreedor: 100 }]).cuadrado).toBe(false)
    expect(validarCuadre([{ saldoDeudor: 100.001, saldoAcreedor: 100 }]).cuadrado).toBe(false)
  })

  it('informa la diferencia con signo (positiva = sobra debe)', () => {
    expect(validarCuadre([{ saldoDeudor: 150, saldoAcreedor: 100 }]).diferencia).toBe(50)
    expect(validarCuadre([{ saldoDeudor: 100, saldoAcreedor: 150 }]).diferencia).toBe(-50)
  })

  it('una lista vacía cuadra en cero', () => {
    expect(validarCuadre([]).cuadrado).toBe(true)
  })
})
