import { describe, expect, it } from 'vitest'
import {
  SECCIONES_EERR,
  SECCIONES_SSP,
  esSeccionEERR,
  esSeccionSSP,
  labelSeccion,
  opcionesSeccion,
  SECCION_SSP_LABELS,
} from './secciones'

describe('secciones', () => {
  it('expone todas las secciones de cada estado', () => {
    expect(SECCIONES_SSP).toHaveLength(5)
    expect(SECCIONES_EERR).toHaveLength(8)
  })

  it('distingue secciones SSP y EERR', () => {
    expect(esSeccionSSP('ACTIVO_CORRIENTE')).toBe(true)
    expect(esSeccionSSP('INGRESOS')).toBe(false)
    expect(esSeccionEERR('INGRESOS')).toBe(true)
    expect(esSeccionEERR(null)).toBe(false)
  })

  it('etiqueta secciones y deja intacto un valor desconocido', () => {
    expect(labelSeccion('PATRIMONIO_NETO')).toBe('Patrimonio Neto')
    expect(labelSeccion('GASTOS_ADM')).toBe('Gastos de Administración')
    expect(labelSeccion('OTRA')).toBe('OTRA')
  })

  it('arma opciones para un select', () => {
    expect(opcionesSeccion(SECCION_SSP_LABELS)[0]).toEqual({
      value: 'ACTIVO_CORRIENTE',
      label: 'Activo Corriente',
    })
  })
})
