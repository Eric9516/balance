import { describe, expect, it } from 'vitest'
import type { GastoSeccion } from '../repository/gastos-dinamico.repository'
import {
  advertenciaCuadreAnterior,
  claveFilaAnterior,
  cuadreAnteriorGastos,
  filasAnexoGastos,
} from './filasAnexo'

const seccion = (
  key: string,
  filas: [nombre: string, importe: number, importeAnterior?: number][],
): GastoSeccion => ({
  key,
  grupoId: null,
  grupoNombre: key,
  grupoSigla: null,
  esGastoDefault: true,
  aparecEnEERR: true,
  filas: filas.map(([cuentaNombre, importe, importeAnterior = 0]) => ({
    cuentaId: cuentaNombre,
    cuentaNombre,
    importe,
    importeAnterior,
  })),
  total: 0,
  totalAnterior: 0,
})

const secciones = [
  seccion('ADM', [
    ['SUELDOS', 1000.1, 800],
    ['ALQUILERES', 300, 250.5],
  ]),
  seccion('COM', [
    ['SUELDOS', 500, 400],
    ['FLETES', 120.25, 0],
  ]),
]

describe('filasAnexoGastos', () => {
  it('una fila por cuenta, ordenadas por nombre, con su importe en cada sección', () => {
    const filas = filasAnexoGastos(secciones)
    expect(filas.map((f) => f.nombre)).toEqual(['ALQUILERES', 'FLETES', 'SUELDOS'])
    const sueldos = filas.find((f) => f.nombre === 'SUELDOS')!
    expect(sueldos.importes).toEqual({ ADM: 1000.1, COM: 500 })
    expect(sueldos.totalActual).toBe(1500.1)
    expect(sueldos.clave).toBe(claveFilaAnterior('SUELDOS'))
  })

  it('anterior vinculado: el total anterior sale de las cuentas del ejercicio anterior', () => {
    const filas = filasAnexoGastos(secciones)
    expect(Object.fromEntries(filas.map((f) => [f.nombre, f.totalAnterior]))).toEqual({
      ALQUILERES: 250.5,
      FLETES: 0,
      SUELDOS: 1200,
    })
  })

  it('carga manual: usa lo cargado fila por fila (cero si falta) y agrega las filas solo del anterior', () => {
    const filas = filasAnexoGastos(secciones, [
      {
        clave: claveFilaAnterior('SUELDOS'),
        nombre: 'SUELDOS',
        valor: 1111.111,
        soloAnterior: false,
      },
      { clave: 'huerfano:1', nombre: 'PUBLICIDAD', valor: 75, soloAnterior: true },
    ])
    expect(filas.map((f) => [f.nombre, f.totalAnterior, f.soloAnterior])).toEqual([
      ['ALQUILERES', 0, false],
      ['FLETES', 0, false],
      ['SUELDOS', 1111.111, false],
      ['PUBLICIDAD', 75, true],
    ])
    const publicidad = filas.at(-1)!
    expect(publicidad).toMatchObject({ clave: 'huerfano:1', importes: {}, totalActual: 0 })
  })

  it('carga manual sin nada cargado todavía: todas las filas en cero, sin derivar del anterior', () => {
    expect(filasAnexoGastos(secciones, []).map((f) => f.totalAnterior)).toEqual([0, 0, 0])
  })
})

describe('cuadreAnteriorGastos', () => {
  it('cuadra cuando la columna por filas suma lo mismo que los totales por sección', () => {
    const c = cuadreAnteriorGastos([0.1, 0.2, 1000], [1000.3])
    expect(c).toEqual({ porFilas: 1000.3, porSecciones: 1000.3, diferencia: 0, coincide: true })
    expect(advertenciaCuadreAnterior(c)).toBeNull()
  })

  it('si no cuadra, avisa con los importes completos y la diferencia', () => {
    const c = cuadreAnteriorGastos([0], [13001849.01])
    expect(c.coincide).toBe(false)
    expect(advertenciaCuadreAnterior(c)).toBe(
      'La columna "Total ejercicio anterior" suma 0,00 y los totales del ejercicio anterior por ' +
        'sección suman 13.001.849,01: hay una diferencia de (13.001.849,01). Revisá los importes ' +
        'del ejercicio anterior fila por fila o por sección.',
    )
  })

  it('no redondea la diferencia en el aviso', () => {
    const c = cuadreAnteriorGastos([100.555], [100.5])
    expect(advertenciaCuadreAnterior(c)).toContain('diferencia de 0,055')
  })
})
