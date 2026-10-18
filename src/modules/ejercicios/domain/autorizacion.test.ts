import { describe, it, expect } from 'vitest'
import { validarAutorizacionFinal, type ContextoAutorizacion } from './autorizacion'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function ctx(partial: Partial<ContextoAutorizacion> = {}): ContextoAutorizacion {
  return {
    modo: 'VINCULADO',
    categoriaEnte: 'PEQUENA',
    comparativoAutorizadoEn: null,
    fechaInicio: d('2025-01-01'),
    anterior: {
      denominacion: 'Ejercicio al 31/12/2024',
      estado: 'CERRADO',
      estadosConfirmado: true,
      pnConfirmado: true,
    },
    cuadreAnterior: null,
    resultadoAnterior: null,
    transicion: null,
    sociedad: null,
    ...partial,
  }
}

const codigos = (items: { codigo: string }[]) => items.map((i) => i.codigo)

describe('compuerta: configuración básica', () => {
  it('modo pendiente y categoría faltante bloquean', () => {
    const r = validarAutorizacionFinal(
      ctx({ modo: 'PENDIENTE', categoriaEnte: null, anterior: null }),
    )
    expect(codigos(r.bloqueantes)).toEqual(['AUT-001', 'AUT-002'])
    expect(r.puedeAutorizar).toBe(false)
  })
})

describe('compuerta: escenario A (VINCULADO)', () => {
  it('anterior confirmado y no borrador: autoriza', () => {
    const r = validarAutorizacionFinal(ctx())
    expect(r.bloqueantes).toEqual([])
    expect(r.puedeAutorizar).toBe(true)
  })
  it('sin anterior asociado bloquea', () => {
    expect(codigos(validarAutorizacionFinal(ctx({ anterior: null })).bloqueantes)).toContain(
      'AUT-020',
    )
  })
  it('anterior en borrador bloquea', () => {
    const r = validarAutorizacionFinal(
      ctx({
        anterior: {
          denominacion: 'X',
          estado: 'BORRADOR',
          estadosConfirmado: true,
          pnConfirmado: true,
        },
      }),
    )
    expect(codigos(r.bloqueantes)).toContain('AUT-021')
  })
  it('anterior sin confirmar estados o EEPN bloquea y nombra lo que falta', () => {
    const r = validarAutorizacionFinal(
      ctx({
        anterior: {
          denominacion: 'X',
          estado: 'EN_PROCESO',
          estadosConfirmado: false,
          pnConfirmado: true,
        },
      }),
    )
    expect(codigos(r.bloqueantes)).toEqual(['AUT-022'])
    expect(r.bloqueantes[0]?.mensaje).toContain('los estados contables')
    expect(r.bloqueantes[0]?.mensaje).not.toContain('E.E.P.N.')
  })
  it('no exige CERRADO: EN_PROCESO confirmado alcanza', () => {
    const r = validarAutorizacionFinal(
      ctx({
        anterior: {
          denominacion: 'X',
          estado: 'EN_PROCESO',
          estadosConfirmado: true,
          pnConfirmado: true,
        },
      }),
    )
    expect(r.puedeAutorizar).toBe(true)
  })
})

describe('compuerta: escenario B (MANUAL)', () => {
  const base = ctx({ modo: 'MANUAL', anterior: null })

  it('sin autorización explícita bloquea', () => {
    expect(codigos(validarAutorizacionFinal(base).bloqueantes)).toEqual(['AUT-010'])
  })
  it('autorizado y cuadrado: autoriza', () => {
    const r = validarAutorizacionFinal({
      ...base,
      comparativoAutorizadoEn: d('2025-06-01'),
      cuadreAnterior: { activo: 1000, pasivo: 400, patrimonioNeto: 600 },
      resultadoAnterior: { eerr: 150, eepn: 150 },
    })
    expect(r.puedeAutorizar).toBe(true)
  })
  it('descuadre del anterior bloquea con importes', () => {
    const r = validarAutorizacionFinal({
      ...base,
      comparativoAutorizadoEn: d('2025-06-01'),
      cuadreAnterior: { activo: 1000, pasivo: 400, patrimonioNeto: 500 },
    })
    expect(codigos(r.bloqueantes)).toEqual(['AUT-011'])
    expect(r.bloqueantes[0]?.mensaje).toContain('no cuadra')
  })
  it('tolera diferencias de redondeo', () => {
    const r = validarAutorizacionFinal({
      ...base,
      comparativoAutorizadoEn: d('2025-06-01'),
      cuadreAnterior: { activo: 1000.004, pasivo: 400, patrimonioNeto: 600 },
    })
    expect(r.puedeAutorizar).toBe(true)
  })
  it('resultado anterior distinto entre EERR y EEPN bloquea', () => {
    const r = validarAutorizacionFinal({
      ...base,
      comparativoAutorizadoEn: d('2025-06-01'),
      resultadoAnterior: { eerr: 150, eepn: 0 },
    })
    expect(codigos(r.bloqueantes)).toEqual(['AUT-012'])
  })
})

describe('compuerta: primer ejercicio (SIN_ANTERIOR)', () => {
  it('nunca bloquea por comparativo, pero advierte', () => {
    const r = validarAutorizacionFinal(ctx({ modo: 'SIN_ANTERIOR', anterior: null }))
    expect(r.puedeAutorizar).toBe(true)
    expect(codigos(r.advertencias)).toEqual(['AUT-031'])
  })
  it('sociedad inscripta hace más de un año: advertencia fuerte', () => {
    const r = validarAutorizacionFinal(
      ctx({
        modo: 'SIN_ANTERIOR',
        anterior: null,
        sociedad: { fechaInscripcion: d('2020-03-01') },
      }),
    )
    expect(codigos(r.advertencias)).toEqual(['AUT-030'])
  })
  it('sociedad inscripta dentro del año: advertencia informativa', () => {
    const r = validarAutorizacionFinal(
      ctx({
        modo: 'SIN_ANTERIOR',
        anterior: null,
        sociedad: { fechaInscripcion: d('2024-10-01') },
      }),
    )
    expect(codigos(r.advertencias)).toEqual(['AUT-031'])
  })
})

describe('compuerta: primera aplicación RT 54', () => {
  it('ajustes de medición que no coinciden con la modificación de inicio: advertencia, no bloqueo', () => {
    const r = validarAutorizacionFinal(
      ctx({
        transicion: {
          esPrimeraAdopcion: true,
          sumaAjustesMedicion: 100,
          modificacionInicioEEPN: 80,
        },
      }),
    )
    expect(r.puedeAutorizar).toBe(true)
    expect(codigos(r.advertencias)).toEqual(['AUT-040'])
  })
  it('coinciden: sin advertencia', () => {
    const r = validarAutorizacionFinal(
      ctx({
        transicion: {
          esPrimeraAdopcion: true,
          sumaAjustesMedicion: 100,
          modificacionInicioEEPN: 100,
        },
      }),
    )
    expect(r.advertencias).toEqual([])
  })
  it('aplicación continuada: no evalúa', () => {
    const r = validarAutorizacionFinal(
      ctx({
        transicion: {
          esPrimeraAdopcion: false,
          sumaAjustesMedicion: 100,
          modificacionInicioEEPN: 0,
        },
      }),
    )
    expect(r.advertencias).toEqual([])
  })
})
