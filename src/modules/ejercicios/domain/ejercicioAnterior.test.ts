import { describe, it, expect } from 'vitest'
import {
  candidatoAutomatico,
  diaSiguienteUTC,
  efectosCambioModo,
  elegiblesComoAnterior,
  esConsecutivo,
  idAnteriorDerivable,
  modoEfectivo,
  validarInvariantesModo,
  validarVinculoEjercicioAnterior,
  type EjercicioResumen,
} from './ejercicioAnterior'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function ej(partial: Partial<EjercicioResumen> & { id: string }): EjercicioResumen {
  return {
    sociedadId: 'soc-1',
    denominacion: `Ejercicio ${partial.id}`,
    fechaInicio: d('2024-01-01'),
    fechaCierre: d('2024-12-31'),
    ejercicioAnteriorId: null,
    estado: 'CERRADO',
    ...partial,
  }
}

describe('modoEfectivo / idAnteriorDerivable', () => {
  it('null es PENDIENTE', () => {
    expect(modoEfectivo({ modoAnterior: null })).toBe('PENDIENTE')
    expect(modoEfectivo({ modoAnterior: 'MANUAL' })).toBe('MANUAL')
  })

  it('solo VINCULADO habilita derivar del anterior, aunque el vínculo exista en la base', () => {
    expect(idAnteriorDerivable({ modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'a' })).toBe('a')
    expect(idAnteriorDerivable({ modoAnterior: 'MANUAL', ejercicioAnteriorId: 'a' })).toBeNull()
    expect(
      idAnteriorDerivable({ modoAnterior: 'SIN_ANTERIOR', ejercicioAnteriorId: 'a' }),
    ).toBeNull()
    expect(idAnteriorDerivable({ modoAnterior: null, ejercicioAnteriorId: 'a' })).toBeNull()
  })
})

describe('validarInvariantesModo', () => {
  it('VINCULADO exige vínculo', () => {
    expect(validarInvariantesModo('VINCULADO', null)).toMatch(/elegir cuál/)
    expect(validarInvariantesModo('VINCULADO', 'a')).toBeNull()
  })
  it('MANUAL y SIN_ANTERIOR rechazan vínculo', () => {
    expect(validarInvariantesModo('MANUAL', 'a')).toMatch(/no admite/)
    expect(validarInvariantesModo('SIN_ANTERIOR', 'a')).toMatch(/no admite/)
    expect(validarInvariantesModo('MANUAL', null)).toBeNull()
    expect(validarInvariantesModo('SIN_ANTERIOR', null)).toBeNull()
  })
  it('modo pendiente con vínculo es incoherente', () => {
    expect(validarInvariantesModo(null, 'a')).toMatch(/Vinculado/)
    expect(validarInvariantesModo(null, null)).toBeNull()
  })
})

describe('fechas', () => {
  it('diaSiguienteUTC cruza fin de año en UTC', () => {
    expect(diaSiguienteUTC(d('2024-12-31')).toISOString()).toBe('2025-01-01T00:00:00.000Z')
  })
  it('esConsecutivo', () => {
    expect(esConsecutivo(d('2024-12-31'), d('2025-01-01'))).toBe(true)
    expect(esConsecutivo(d('2024-12-31'), d('2025-01-02'))).toBe(false)
    expect(esConsecutivo(d('2024-06-30'), d('2024-07-01'))).toBe(true)
  })
})

describe('validarVinculoEjercicioAnterior', () => {
  const actual = { id: 'act', sociedadId: 'soc-1', fechaInicio: d('2025-01-01') }

  it('vínculo correcto y consecutivo: sin errores ni advertencias', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant' }),
      cadenaDelAnterior: [],
      usadoPor: null,
    })
    expect(r).toEqual({ errores: [], advertencias: [] })
  })

  it('rechaza autovínculo', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'act', fechaCierre: d('2024-12-31') }),
      cadenaDelAnterior: [],
      usadoPor: null,
    })
    expect(r.errores.some((e) => e.includes('propio'))).toBe(true)
  })

  it('rechaza otra sociedad', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant', sociedadId: 'soc-2' }),
      cadenaDelAnterior: [],
      usadoPor: null,
    })
    expect(r.errores.some((e) => e.includes('misma sociedad'))).toBe(true)
  })

  it('rechaza cierre posterior o igual al inicio', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant', fechaCierre: d('2025-01-01') }),
      cadenaDelAnterior: [],
      usadoPor: null,
    })
    expect(r.errores.some((e) => e.includes('previo al inicio'))).toBe(true)
  })

  it('advierte hueco cuando no son consecutivos', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant', fechaCierre: d('2023-12-31') }),
      cadenaDelAnterior: [],
      usadoPor: null,
    })
    expect(r.errores).toEqual([])
    expect(r.advertencias.some((a) => a.includes('no son consecutivos'))).toBe(true)
  })

  it('rechaza ciclos', () => {
    const r = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant' }),
      cadenaDelAnterior: ['x', 'act'],
      usadoPor: null,
    })
    expect(r.errores.some((e) => e.includes('ciclo'))).toBe(true)
  })

  it('rechaza un anterior ya usado por otro ejercicio, pero no por el propio', () => {
    const usado = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant' }),
      cadenaDelAnterior: [],
      usadoPor: 'otro',
    })
    expect(usado.errores.some((e) => e.includes('ya es el ejercicio anterior'))).toBe(true)
    const propio = validarVinculoEjercicioAnterior({
      actual,
      anterior: ej({ id: 'ant' }),
      cadenaDelAnterior: [],
      usadoPor: 'act',
    })
    expect(propio.errores).toEqual([])
  })
})

describe('elegiblesComoAnterior / candidatoAutomatico', () => {
  const lista: EjercicioResumen[] = [
    ej({ id: 'e2024', fechaInicio: d('2024-01-01'), fechaCierre: d('2024-12-31') }),
    ej({ id: 'e2023', fechaInicio: d('2023-01-01'), fechaCierre: d('2023-12-31') }),
    ej({
      id: 'e2025',
      fechaInicio: d('2025-01-01'),
      fechaCierre: d('2025-12-31'),
      ejercicioAnteriorId: 'e2024',
    }),
  ]

  it('excluye el propio, los usados por otros y los que cierran después del inicio', () => {
    const el = elegiblesComoAnterior(lista, { id: 'nuevo', fechaInicio: d('2025-01-01') })
    // e2024 está usado por e2025; e2025 cierra después del inicio → solo e2023
    expect(el.map((e) => e.id)).toEqual(['e2023'])
  })

  it('al editar, el anterior que YA usa el propio ejercicio sigue siendo elegible', () => {
    const el = elegiblesComoAnterior(lista, { id: 'e2025', fechaInicio: d('2025-01-01') })
    expect(el.map((e) => e.id)).toEqual(['e2024', 'e2023'])
  })

  it('candidato automático = el que cierra el día previo al inicio', () => {
    const el = elegiblesComoAnterior(lista, { id: 'e2025', fechaInicio: d('2025-01-01') })
    expect(candidatoAutomatico(el, d('2025-01-01'))?.id).toBe('e2024')
    expect(candidatoAutomatico(el, d('2026-01-01'))).toBeNull()
    expect(candidatoAutomatico(el, null)).toBeNull()
  })
})

describe('efectosCambioModo', () => {
  it('sin cambios no hace nada', () => {
    const cfg = { modoAnterior: 'MANUAL' as const, ejercicioAnteriorId: null }
    expect(efectosCambioModo(cfg, cfg)).toEqual({
      limpiarComparativosManuales: false,
      anularAutorizacion: false,
      desconfirmar: false,
    })
  })
  it('pasar de MANUAL a VINCULADO limpia manuales, anula autorización y desconfirma', () => {
    expect(
      efectosCambioModo(
        { modoAnterior: 'MANUAL', ejercicioAnteriorId: null },
        { modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'a' },
      ),
    ).toEqual({ limpiarComparativosManuales: true, anularAutorizacion: true, desconfirmar: true })
  })
  it('pasar de VINCULADO a MANUAL desconfirma y anula, pero no borra lo manual que recién empieza', () => {
    expect(
      efectosCambioModo(
        { modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'a' },
        { modoAnterior: 'MANUAL', ejercicioAnteriorId: null },
      ),
    ).toEqual({ limpiarComparativosManuales: false, anularAutorizacion: true, desconfirmar: true })
  })
  it('cambiar solo el ejercicio vinculado también desconfirma', () => {
    expect(
      efectosCambioModo(
        { modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'a' },
        { modoAnterior: 'VINCULADO', ejercicioAnteriorId: 'b' },
      ).desconfirmar,
    ).toBe(true)
  })
})
