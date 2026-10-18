import { describe, it, expect } from 'vitest'
import type { EvolucionPNMovimientoDTO } from './types'
import { aplicarArrastrePN, derivarDesdeAnteriorPN, SIN_DERIVADO_PN } from './saldosInicio'

function mov(
  tipo: EvolucionPNMovimientoDTO['tipo'],
  cols: Partial<EvolucionPNMovimientoDTO> = {},
): EvolucionPNMovimientoDTO {
  return {
    id: '',
    ejercicioId: 'e',
    tipo,
    orden: 0,
    capitalSuscripto: 0,
    ajusteCapital: 0,
    aportesIrrevocables: 0,
    reservaLegal: 0,
    otrasReservas: 0,
    rdosNoAsignados: 0,
    totalAnterior: 0,
    ...cols,
  }
}

const anterior: EvolucionPNMovimientoDTO[] = [
  mov('SALDO_INICIO', { capitalSuscripto: 1000, rdosNoAsignados: 200 }),
  mov('AJUSTE_INFLACION', { ajusteCapital: 300, rdosNoAsignados: 60 }),
  mov('DISTRIB_RESERVA_LEGAL', { reservaLegal: 50, rdosNoAsignados: -50 }),
  mov('RESULTADO_EJERCICIO', { rdosNoAsignados: 400 }),
]

describe('derivarDesdeAnteriorPN', () => {
  it('saldo inicio = saldos al cierre del anterior por componente, sin coeficiente', () => {
    const d = derivarDesdeAnteriorPN(anterior, 1.5)
    expect(d.saldoInicio).toEqual({
      capitalSuscripto: 1000,
      ajusteCapital: 300,
      aportesIrrevocables: 0,
      reservaLegal: 50,
      otrasReservas: 0,
      rdosNoAsignados: 610,
    })
  })
  it('columna anterior = total de cada fila × coeficiente', () => {
    const d = derivarDesdeAnteriorPN(anterior, 1.5)
    expect(d.totalAnteriorByTipo?.SALDO_INICIO).toBe(1200 * 1.5)
    expect(d.totalAnteriorByTipo?.RESULTADO_EJERCICIO).toBe(400 * 1.5)
    expect(d.totalAnteriorByTipo?.DISTRIB_RESERVA_LEGAL).toBe(0)
  })
  it('sin filas anteriores no hay derivado', () => {
    expect(derivarDesdeAnteriorPN([], 2)).toEqual(SIN_DERIVADO_PN)
  })
})

describe('aplicarArrastrePN', () => {
  // Lo que manda el cliente: intentó pisar saldo inicio y la columna anterior.
  const cliente: EvolucionPNMovimientoDTO[] = [
    mov('SALDO_INICIO', { capitalSuscripto: 1, rdosNoAsignados: 1, totalAnterior: 1 }),
    mov('AJUSTE_INFLACION', { ajusteCapital: 77, totalAnterior: 1 }),
    mov('RESULTADO_EJERCICIO', { rdosNoAsignados: 500, totalAnterior: 1 }),
  ]
  const derivado = derivarDesdeAnteriorPN(anterior, 1)

  it('VINCULADO con fuente: pisa SALDO_INICIO y totalAnterior, deja el resto', () => {
    const r = aplicarArrastrePN(cliente, derivado, 'VINCULADO')
    const inicio = r.movimientos.find((m) => m.tipo === 'SALDO_INICIO')!
    expect(inicio.capitalSuscripto).toBe(1000)
    expect(inicio.rdosNoAsignados).toBe(610)
    expect(inicio.totalAnterior).toBe(1200)
    const ajuste = r.movimientos.find((m) => m.tipo === 'AJUSTE_INFLACION')!
    expect(ajuste.ajusteCapital).toBe(77) // del ejercicio actual, no se toca
    expect(ajuste.totalAnterior).toBe(360)
    // tipo sin fila en el anterior → columna anterior en 0, no lo que mandó el cliente
    expect(r.movimientos.find((m) => m.tipo === 'RESULTADO_EJERCICIO')!.totalAnterior).toBe(400)
    expect(r.bloqueo).toEqual({ saldoInicio: true, totalAnterior: true })
    expect(r.advertencias).toEqual([])
  })

  it('VINCULADO sin fuente: no pisa nada, no bloquea y advierte', () => {
    const r = aplicarArrastrePN(cliente, SIN_DERIVADO_PN, 'VINCULADO')
    expect(r.movimientos).toBe(cliente)
    expect(r.bloqueo).toEqual({ saldoInicio: false, totalAnterior: false })
    expect(r.advertencias[0]).toMatch(/no tiene Estado de Evolución/)
  })

  it('MANUAL / SIN_ANTERIOR / PENDIENTE: nunca pisa, aunque haya derivado', () => {
    for (const modo of ['MANUAL', 'SIN_ANTERIOR', 'PENDIENTE'] as const) {
      const r = aplicarArrastrePN(cliente, derivado, modo)
      expect(r.movimientos).toBe(cliente)
      expect(r.bloqueo).toEqual({ saldoInicio: false, totalAnterior: false })
    }
  })
})
