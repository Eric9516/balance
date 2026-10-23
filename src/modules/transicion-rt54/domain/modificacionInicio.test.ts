import { describe, it, expect } from 'vitest'
import { filaSigueAjustes, modificacionInicioDesdeAjustes } from './modificacionInicio'

const ajuste = (
  componentePN: 'RDOS_NO_ASIGNADOS' | 'RESERVA_LEGAL' | null,
  importePN: number,
  tipo: 'AJUSTE_MEDICION' | 'RECLASIFICACION' = 'AJUSTE_MEDICION',
) => ({ tipo, componentePN, importePN })

const vacia = {
  capitalSuscripto: 0,
  ajusteCapital: 0,
  aportesIrrevocables: 0,
  reservaLegal: 0,
  otrasReservas: 0,
  rdosNoAsignados: 0,
}

describe('Modificación de saldos al inicio desde los ajustes de transición RT 54', () => {
  it('suma los ajustes de medición en la columna de su componente', () => {
    expect(
      modificacionInicioDesdeAjustes([
        ajuste('RDOS_NO_ASIGNADOS', -150_000),
        ajuste('RDOS_NO_ASIGNADOS', -0.25),
        ajuste('RESERVA_LEGAL', 10),
        ajuste('RDOS_NO_ASIGNADOS', 999, 'RECLASIFICACION'), // no cambia el patrimonio
      ]),
    ).toEqual({ ...vacia, rdosNoAsignados: -150_000.25, reservaLegal: 10 })
  })

  it('sin componente no se puede repartir', () => {
    expect(modificacionInicioDesdeAjustes([ajuste(null, -5)])).toBeNull()
  })

  it('la fila sigue a los ajustes si está vacía o si coincidía con ellos; si no, es del contador', () => {
    const antes = { ...vacia, rdosNoAsignados: -150_000 }
    expect(filaSigueAjustes(vacia, antes)).toBe(true)
    expect(filaSigueAjustes({ ...vacia, rdosNoAsignados: -150_000 }, antes)).toBe(true)
    expect(filaSigueAjustes({ ...vacia, rdosNoAsignados: -170_000 }, antes)).toBe(false)
  })
})
