import { describe, it, expect } from 'vitest'
import { armarEvolucionPN } from './evolucion'

describe('E.E.P.N.: resultado del año anterior en carga manual', () => {
  const guardados = [
    {
      id: '',
      ejercicioId: 'e',
      tipo: 'RESULTADO_EJERCICIO' as const,
      orden: 90,
      capitalSuscripto: 0,
      ajusteCapital: 0,
      aportesIrrevocables: 0,
      reservaLegal: 0,
      otrasReservas: 0,
      rdosNoAsignados: 0,
      totalAnterior: 999, // escrito antes: no cuenta
    },
  ]

  it('sale del estado de resultados anterior y suma en el total del anterior', () => {
    const pn = armarEvolucionPN({
      ejercicioId: 'e',
      guardados,
      resultadoEjercicio: 100,
      modo: 'MANUAL',
      resultadoAnterior: 30_000.25,
    })
    expect(pn.movimientos.find((m) => m.tipo === 'RESULTADO_EJERCICIO')?.totalAnterior).toBe(
      30_000.25,
    )
    expect(pn.totalAnterior).toBe(30_000.25)
  })

  it('sin resultado anterior (otros modos) queda lo guardado', () => {
    const pn = armarEvolucionPN({
      ejercicioId: 'e',
      guardados,
      resultadoEjercicio: 100,
      modo: 'SIN_ANTERIOR',
    })
    expect(pn.movimientos.find((m) => m.tipo === 'RESULTADO_EJERCICIO')?.totalAnterior).toBe(999)
  })
})
