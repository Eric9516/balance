import { describe, it, expect } from 'vitest'
import type { RubroFila } from '@/modules/estados/domain/types'
import {
  armarFlujo,
  cambioColumnaAnterior,
  conceptoDuplicado,
  efectivoDesdeSSP,
  FLUJO_VACIO,
  normalizarConcepto,
} from './calculo'
import type { FlujoGuardadoDTO, FlujoItemDTO } from './types'

function rubro(id: string, actual: number, anterior: number): RubroFila {
  return {
    id,
    codigo: id,
    nombre: id,
    estadoDestino: 'SSP',
    seccionSSP: 'ACTIVO_CORRIENTE',
    seccionEERR: null,
    naturalezaEsperada: 'DEUDORA',
    orden: 1,
    displayValue: actual,
    displayValueAnt: anterior,
    notaNumero: null,
    cuentas: [],
  }
}

function item(id: string, partial: Partial<FlujoItemDTO>): FlujoItemDTO {
  return {
    id,
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: id,
    importe: 0,
    importeAnterior: 0,
    orden: 0,
    ...partial,
  }
}

function flujo(partial: Partial<FlujoGuardadoDTO>): FlujoGuardadoDTO {
  return { ...FLUJO_VACIO, id: 'f', ...partial }
}

const efectivo = { actual: 150_000, anterior: 125_000 }

describe('efectivoDesdeSSP', () => {
  it('suma solo los rubros de efectivo en ambas columnas', () => {
    const e = efectivoDesdeSSP(
      [rubro('caja', 150, 125), rubro('bancos', 50, 25), rubro('creditos', 999, 999)],
      new Set(['caja', 'bancos']),
    )
    expect(e).toEqual({ actual: 200, anterior: 150 })
  })
})

describe('conceptoDuplicado', () => {
  it('detecta el mismo concepto en la misma sección, no en otra', () => {
    const op = 'ACTIVIDADES_OPERATIVAS' as const
    expect(
      conceptoDuplicado([
        { seccion: op, concepto: 'Pagos de impuestos' },
        { seccion: 'ACTIVIDADES_INVERSION', concepto: 'Pagos de impuestos' },
      ]),
    ).toBeNull()
    expect(
      conceptoDuplicado([
        { seccion: op, concepto: 'Pagos de impuestos' },
        { seccion: op, concepto: 'PAGOS DE IMPUESTOS ' },
      ])?.concepto,
    ).toBe('PAGOS DE IMPUESTOS ')
  })
})

describe('normalizarConcepto', () => {
  it('ignora mayúsculas, acentos y espacios', () => {
    expect(normalizarConcepto('  Pagos  de IMPUESTOS ')).toBe(
      normalizarConcepto('pagos de impuestos'),
    )
    expect(normalizarConcepto('Financiación')).toBe('financiacion')
  })
})

describe('armarFlujo: efectivo derivado del balance', () => {
  it('el cliente no puede pisar el efectivo al inicio ni al cierre', () => {
    const r = armarFlujo({
      guardado: flujo({ saldoInicial: 1, saldoFinal: 2, saldoFinalAnterior: 3 }),
      efectivo,
      modo: 'MANUAL',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(r.guardado.saldoFinal).toBe(150_000)
    expect(r.guardado.saldoInicial).toBe(125_000)
    expect(r.guardado.saldoFinalAnterior).toBe(125_000)
    expect(r.bloqueo.saldoFinal).toBe(true)
    expect(r.bloqueo.saldoInicial).toBe(true)
  })

  it('primer ejercicio: el inicio es editable y no hay columna anterior', () => {
    const r = armarFlujo({
      guardado: flujo({
        saldoInicial: 10,
        saldoInicialAnterior: 7,
        items: [item('a', { importeAnterior: 5 })],
      }),
      efectivo,
      modo: 'SIN_ANTERIOR',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(r.guardado.saldoInicial).toBe(10)
    expect(r.bloqueo.saldoInicial).toBe(false)
    expect(r.mostrarAnterior).toBe(false)
    expect(r.anterior).toBeNull()
    expect(r.guardado.items[0]?.importeAnterior).toBe(0)
    expect(r.guardado.saldoInicialAnterior).toBe(0)
  })

  it('control: la variación neta debe ser igual a la suma de las actividades', () => {
    const items = [
      item('cobros', { importe: 300_000 }),
      item('pagos', { importe: -260_000 }),
      item('rodados', { seccion: 'ACTIVIDADES_INVERSION', importe: -50_000 }),
      item('aportes', { seccion: 'ACTIVIDADES_FINANCIAMIENTO', importe: 35_000 }),
    ]
    const ok = armarFlujo({
      guardado: flujo({ items }),
      efectivo,
      modo: 'MANUAL',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(ok.actual.variacionNeta).toBe(25_000)
    expect(ok.actual.porSeccion).toEqual({
      ACTIVIDADES_OPERATIVAS: 40_000,
      ACTIVIDADES_INVERSION: -50_000,
      ACTIVIDADES_FINANCIAMIENTO: 35_000,
    })
    expect(ok.actual.cuadra).toBe(true)

    const mal = armarFlujo({
      guardado: flujo({ items: items.slice(0, 3) }),
      efectivo,
      modo: 'MANUAL',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(mal.actual.cuadra).toBe(false)
    expect(mal.actual.diferencia).toBe(35_000)
  })

  it('las modificaciones de ejercicios anteriores entran en el inicio modificado', () => {
    const r = armarFlujo({
      guardado: flujo({ modificacionesEjAnt: 5_000, items: [item('x', { importe: 20_000 })] }),
      efectivo,
      modo: 'MANUAL',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(r.actual.efectivoInicioModificado).toBe(130_000)
    expect(r.actual.variacionNeta).toBe(20_000)
    expect(r.actual.cuadra).toBe(true)
  })
})

describe('armarFlujo: escenario A (VINCULADO)', () => {
  const anterior = flujo({
    saldoInicial: 80_000,
    modificacionesEjAnt: 0,
    items: [
      item('p1', { concepto: 'Cobros por ventas', importe: 200_000 }),
      item('p2', { concepto: 'Pagos a proveedores', importe: -180_000 }),
      item('p3', {
        concepto: 'Pago de dividendos',
        seccion: 'ACTIVIDADES_FINANCIAMIENTO',
        importe: -10_000,
      }),
    ],
  })

  it('la columna anterior sale del flujo anterior × coeficiente y se bloquea; el cliente no la pisa', () => {
    const r = armarFlujo({
      guardado: flujo({
        items: [
          item('a', { concepto: 'cobros  por VENTAS', importe: 300_000, importeAnterior: 1 }),
          item('b', { concepto: 'Otro concepto nuevo', importe: 5, importeAnterior: 99 }),
        ],
      }),
      efectivo,
      modo: 'VINCULADO',
      flujoAnterior: anterior,
      coeficiente: 1.25,
    })
    const a = r.guardado.items.find((i) => i.id === 'a')!
    expect(a.importeAnterior).toBe(250_000)
    expect(r.bloqueo.lineasAnterior.has('a')).toBe(true)
    expect(r.guardado.items.find((i) => i.id === 'b')!.importeAnterior).toBe(0)
    expect(r.guardado.saldoInicialAnterior).toBe(100_000)
    expect(r.bloqueo.cabeceraAnterior).toBe(true)
    expect(r.conceptosSoloAnterior.map((c) => c.concepto)).toEqual([
      'Pagos a proveedores',
      'Pago de dividendos',
    ])
    expect(r.advertencias[0]).toMatch(/2 conceptos/)
    expect(r.controlarAnterior).toBe(true)
  })

  it('sin flujo en el anterior: columna anterior de actividades vacía con advertencia', () => {
    const r = armarFlujo({
      guardado: flujo({ saldoInicialAnterior: 5, items: [item('a', { importeAnterior: 77 })] }),
      efectivo,
      modo: 'VINCULADO',
      flujoAnterior: null,
      coeficiente: 1,
    })
    expect(r.guardado.items[0]?.importeAnterior).toBe(0)
    expect(r.advertencias[0]).toMatch(/no tiene Estado de Flujo/)
    // Toda la columna anterior sigue bloqueada: en VINCULADO no se carga a mano.
    expect(r.bloqueo.cabeceraAnterior).toBe(true)
    expect(r.guardado.saldoInicialAnterior).toBe(0)
    expect(r.controlarAnterior).toBe(false)
  })
})

describe('cambioColumnaAnterior', () => {
  const base = flujo({ saldoInicialAnterior: 10, items: [item('a', { importeAnterior: 5 })] })
  it('detecta cambios en cabecera o líneas de la columna anterior', () => {
    expect(cambioColumnaAnterior(base, base)).toBe(false)
    expect(cambioColumnaAnterior(base, { ...base, saldoInicialAnterior: 11 })).toBe(true)
    expect(
      cambioColumnaAnterior(base, { ...base, items: [item('a', { importeAnterior: 6 })] }),
    ).toBe(true)
    expect(
      cambioColumnaAnterior(base, {
        ...base,
        items: [item('a', { importe: 999, importeAnterior: 5 })],
      }),
    ).toBe(false)
  })
})
