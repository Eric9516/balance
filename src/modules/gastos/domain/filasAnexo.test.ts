import { describe, expect, it } from 'vitest'
import type { GastoSeccion } from '../repository/gastos-dinamico.repository'
import {
  advertenciaFilasSinSeccion,
  anteriorPorSeccionDesdeFilas,
  claveFilaAnterior,
  claveFilaAnteriorEnSeccion,
  filasAnexoGastos,
  seccionDeFilaSoloAnterior,
  type AnteriorManualFila,
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

// "SUELDOS" está en dos secciones; las demás filas, en una sola.
const secciones = [
  seccion('legacy:GASTOS_ADM', [
    ['SUELDOS', 1000.1, 800],
    ['ALQUILERES', 300, 250.5],
  ]),
  seccion('grupo:operativos', [
    ['SUELDOS', 500, 400],
    ['FLETES', 120.25, 0],
  ]),
]

const manual = (clave: string, nombre: string, valor: number, soloAnterior = false) =>
  ({ clave, nombre, valor, soloAnterior }) satisfies AnteriorManualFila

describe('filasAnexoGastos', () => {
  it('una fila por cuenta, ordenadas por nombre, con su importe en cada sección', () => {
    const filas = filasAnexoGastos(secciones)
    expect(filas.map((f) => f.nombre)).toEqual(['ALQUILERES', 'FLETES', 'SUELDOS'])
    const sueldos = filas.find((f) => f.nombre === 'SUELDOS')!
    expect(sueldos.importes).toEqual({ 'legacy:GASTOS_ADM': 1000.1, 'grupo:operativos': 500 })
    expect(sueldos.totalActual).toBe(1500.1)
    expect(sueldos.secciones).toEqual(['legacy:GASTOS_ADM', 'grupo:operativos'])
  })

  it('anterior vinculado: sale de las cuentas del ejercicio anterior, sección por sección', () => {
    const filas = filasAnexoGastos(secciones)
    expect(filas.find((f) => f.nombre === 'SUELDOS')).toMatchObject({
      anteriorPorSeccion: { 'legacy:GASTOS_ADM': 800, 'grupo:operativos': 400 },
      totalAnterior: 1200,
    })
  })

  it('carga manual: una fila en una sola sección suma en esa sección', () => {
    const filas = filasAnexoGastos(secciones, [
      manual(claveFilaAnterior('ALQUILERES'), 'ALQUILERES', 240.555),
    ])
    expect(filas.find((f) => f.nombre === 'ALQUILERES')).toMatchObject({
      anteriorPorSeccion: { 'legacy:GASTOS_ADM': 240.555 },
      totalAnterior: 240.555,
      sinSeccion: false,
    })
    // Lo que no se cargó queda en cero, sin derivar nada del anterior.
    expect(filas.find((f) => f.nombre === 'FLETES')?.totalAnterior).toBe(0)
  })

  it('carga manual: una fila en varias secciones tiene un importe por sección', () => {
    const filas = filasAnexoGastos(secciones, [
      manual(claveFilaAnteriorEnSeccion('SUELDOS', 'legacy:GASTOS_ADM'), 'SUELDOS', 700),
      manual(claveFilaAnteriorEnSeccion('SUELDOS', 'grupo:operativos'), 'SUELDOS', 300.3),
    ])
    expect(filas.find((f) => f.nombre === 'SUELDOS')).toMatchObject({
      anteriorPorSeccion: { 'legacy:GASTOS_ADM': 700, 'grupo:operativos': 300.3 },
      totalAnterior: 1000.3,
      sinSeccion: false,
    })
  })

  it('carga manual: un gasto solo del año anterior suma en la sección que eligió el contador', () => {
    const filas = filasAnexoGastos(secciones, [
      manual('sec:grupo:operativos:1700000000000', 'PUBLICIDAD', 5000, true),
    ])
    expect(filas.at(-1)).toMatchObject({
      nombre: 'PUBLICIDAD',
      soloAnterior: true,
      importes: {},
      totalActual: 0,
      secciones: ['grupo:operativos'],
      anteriorPorSeccion: { 'grupo:operativos': 5000 },
      totalAnterior: 5000,
    })
  })

  it('un importe que no se puede asignar a ninguna sección queda marcado', () => {
    const filas = filasAnexoGastos(secciones, [
      manual(claveFilaAnterior('SUELDOS'), 'SUELDOS', 100), // fila en dos secciones
      manual('huerfano:1', 'PUBLICIDAD', 50, true), // gasto viejo sin clasificación
    ])
    expect(filas.filter((f) => f.sinSeccion).map((f) => f.nombre)).toEqual([
      'SUELDOS',
      'PUBLICIDAD',
    ])
    expect(advertenciaFilasSinSeccion(filas)).toContain(
      'SUELDOS, PUBLICIDAD no tiene clasificación',
    )
    expect(advertenciaFilasSinSeccion(filasAnexoGastos(secciones, []))).toBeNull()
  })
})

describe('anteriorPorSeccionDesdeFilas', () => {
  it('suma lo que cada fila aporta a cada sección, sin redondear', () => {
    const filas = filasAnexoGastos(secciones, [
      manual(claveFilaAnterior('ALQUILERES'), 'ALQUILERES', 0.1),
      manual(claveFilaAnterior('FLETES'), 'FLETES', 2000),
      manual(claveFilaAnteriorEnSeccion('SUELDOS', 'legacy:GASTOS_ADM'), 'SUELDOS', 0.2),
      manual(claveFilaAnteriorEnSeccion('SUELDOS', 'grupo:operativos'), 'SUELDOS', 9000.005),
      manual('sec:grupo:operativos:1', 'PUBLICIDAD', 5000, true),
    ])
    expect(Object.fromEntries(anteriorPorSeccionDesdeFilas(filas))).toEqual({
      'legacy:GASTOS_ADM': 0.3,
      'grupo:operativos': 16000.005,
    })
  })
})

describe('seccionDeFilaSoloAnterior', () => {
  it('lee la sección aunque su clave tenga ":"', () => {
    expect(seccionDeFilaSoloAnterior('sec:grupo:019e8524-6a4b:1700000000000')).toBe(
      'grupo:019e8524-6a4b',
    )
    expect(seccionDeFilaSoloAnterior('sec:legacy:GASTOS_ADM:1')).toBe('legacy:GASTOS_ADM')
    expect(seccionDeFilaSoloAnterior('huerfano:1700000000000')).toBeNull()
  })
})
