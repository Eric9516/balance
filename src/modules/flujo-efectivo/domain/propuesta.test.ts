import { describe, expect, it } from 'vitest'
import {
  lineasParaAplicar,
  motivoExclusion,
  proponerFlujo,
  SIN_ELECCIONES,
  sugerirTipoGasto,
  type InsumosPropuesta,
} from './propuesta'
import { conRecpam, estadoRecpam, cambioColumnaActual, FLUJO_VACIO } from './calculo'
import type { FlujoItemDTO } from './types'

describe('qué es cada gasto del Anexo III (sugerencia por el nombre)', () => {
  it.each([
    ['SUELDOS ADMINISTRACION', 'PERSONAL'],
    ['CARGAS SOCIALES FABRICA', 'PERSONAL'],
    ['SINDICATO', 'PERSONAL'],
    ['IMP. INGRESOS BRUTOS', 'IMPUESTOS'],
    ['IMPUESTOS INTERNOS', 'IMPUESTOS'],
    ['TASA RETRIBUTIVA DE SERVICIOS', 'IMPUESTOS'],
    ['MULTAS AFIP', 'IMPUESTOS'],
    ['AMORTIZACIÓN DEL EJERCICIO', 'NO_ES_PAGO'],
    ['Previsión deudores incobrables', 'NO_ES_PAGO'],
    ['HONORARIOS PROFESIONALES', 'PROVEEDORES'],
    ['FLETES', 'PROVEEDORES'],
  ] as const)('%s → %s', (nombre, tipo) => {
    expect(sugerirTipoGasto(nombre)).toBe(tipo)
  })
})

describe('rubros que quedan afuera de las variaciones por defecto', () => {
  it('caja y bancos, bienes de cambio, inversiones y préstamos', () => {
    expect(motivoExclusion('ACT-CTE-01', true)).toMatch(/efectivo/)
    expect(motivoExclusion('ACT-CTE-09', false)).toMatch(/compras/)
    expect(motivoExclusion('ACT-CTE-02', false)).toMatch(/inversión/)
    expect(motivoExclusion('PAS-CTE-02', false)).toMatch(/financiación/)
    expect(motivoExclusion('ACT-CTE-03', false)).toBeNull()
    expect(motivoExclusion('PAS-CTE-01', false)).toBeNull()
  })
})

/** Un balance chico, con los números a mano. */
const insumos: InsumosPropuesta = {
  ingresos: 1_000,
  compras: 400,
  gastos: [
    { cuentaId: 'g1', nombre: 'Sueldos', seccion: 'Administración', importe: 200 },
    { cuentaId: 'g2', nombre: 'Ingresos brutos', seccion: 'Comercialización', importe: 30 },
    {
      cuentaId: 'g3',
      nombre: 'Amortización del ejercicio',
      seccion: 'Administración',
      importe: 50,
    },
    { cuentaId: 'g4', nombre: 'Fletes', seccion: 'Comercialización', importe: 70 },
  ],
  rubros: [
    {
      id: 'caja',
      nombre: 'Caja y bancos',
      lado: 'ACTIVO',
      actual: 500,
      anterior: 100,
      motivoExcluido: 'efectivo',
    },
    {
      id: 'cred',
      nombre: 'Créditos por ventas',
      lado: 'ACTIVO',
      actual: 300,
      anterior: 200,
      motivoExcluido: null,
    },
    {
      id: 'bc',
      nombre: 'Bienes de cambio',
      lado: 'ACTIVO',
      actual: 80,
      anterior: 60,
      motivoExcluido: 'compras',
    },
    {
      id: 'prov',
      nombre: 'Proveedores',
      lado: 'PASIVO',
      actual: 150,
      anterior: 100,
      motivoExcluido: null,
    },
    {
      id: 'fisc',
      nombre: 'Deudas fiscales',
      lado: 'PASIVO',
      actual: 40,
      anterior: 10,
      motivoExcluido: null,
    },
    {
      id: 'prest',
      nombre: 'Préstamos',
      lado: 'PASIVO',
      actual: 0,
      anterior: 90,
      motivoExcluido: 'financiación',
    },
  ],
  bienesDeUso: { altas: 120, bajas: 5 },
  aportes: null,
  referencias: { prestamos: { actual: 0, anterior: 90 }, impuestoGanancias: 25 },
}

const importeDe = (p: ReturnType<typeof proponerFlujo>, origen: string) =>
  p.lineas.find((l) => l.origen === origen)?.importe

describe('propuesta del flujo desde el balance', () => {
  it('arma cada línea con las reglas del estudio', () => {
    const p = proponerFlujo(insumos, SIN_ELECCIONES)
    expect(importeDe(p, 'COBROS_VENTAS')).toBe(1_000)
    // 400 compras + 350 gastos − 200 sueldos − 30 impuestos − 50 amortización
    expect(importeDe(p, 'PAGOS_PROVEEDORES')).toBe(-470)
    expect(importeDe(p, 'PAGOS_PERSONAL')).toBe(-200)
    expect(importeDe(p, 'PAGOS_IMPUESTOS')).toBe(-30)
    // Créditos aumentan 100: resta. Caja y bienes de cambio quedan afuera.
    expect(importeDe(p, 'VARIACION_ACTIVOS')).toBe(-100)
    // Proveedores +50 y fiscales +30 suman. Préstamos quedan afuera.
    expect(importeDe(p, 'VARIACION_PASIVOS')).toBe(80)
    expect(importeDe(p, 'PAGOS_BIENES_USO')).toBe(-120)
    expect(importeDe(p, 'COBROS_BIENES_USO')).toBe(5)
    expect(importeDe(p, 'APORTES')).toBeUndefined()
    expect(importeDe(p, 'PAGOS_GANANCIAS')).toBeUndefined()
    expect(importeDe(p, 'RECPAM')).toBeUndefined()
    // Lo que el contador no cargó queda avisado
    expect(p.avisos.join(' ')).toMatch(/ganancias/)
    expect(p.avisos.join(' ')).toMatch(/préstamos/)
  })

  it('el contador cambia un gasto y los rubros', () => {
    const p = proponerFlujo(insumos, {
      ...SIN_ELECCIONES,
      tiposGasto: { g4: 'NO_ES_PAGO' },
      rubros: { cred: false, bc: true },
    })
    expect(importeDe(p, 'PAGOS_PROVEEDORES')).toBe(-400)
    // Sin créditos, con bienes de cambio (+20): resta 20
    expect(importeDe(p, 'VARIACION_ACTIVOS')).toBe(-20)
  })

  it('ganancias: lo pagado va en su línea y la variación del impuesto sale de los pasivos', () => {
    // Devengado 25, pagado 15: la deuda del impuesto creció 10 y ya está en lo pagado.
    const p = proponerFlujo(insumos, { ...SIN_ELECCIONES, gananciasPagado: 15 })
    expect(importeDe(p, 'PAGOS_GANANCIAS')).toBe(-15)
    expect(importeDe(p, 'VARIACION_PASIVOS')).toBe(70)
    expect(p.avisos.join(' ')).not.toMatch(/ganancias/)
  })

  it('préstamos: lo recibido suma y lo devuelto resta', () => {
    const p = proponerFlujo(insumos, {
      ...SIN_ELECCIONES,
      prestamosRecibidos: 30,
      prestamosCancelados: 120,
    })
    expect(importeDe(p, 'PRESTAMOS_RECIBIDOS')).toBe(30)
    expect(importeDe(p, 'PRESTAMOS_CANCELADOS')).toBe(-120)
    expect(p.avisos.join(' ')).not.toMatch(/préstamos/)
  })

  it('primer ejercicio: los aportes del saldo al inicio', () => {
    const p = proponerFlujo({ ...insumos, aportes: 1_000 }, SIN_ELECCIONES)
    expect(importeDe(p, 'APORTES')).toBe(1_000)
  })

  it('sin Anexo II, sin compras y con aviso', () => {
    const p = proponerFlujo({ ...insumos, compras: null }, SIN_ELECCIONES)
    expect(importeDe(p, 'PAGOS_PROVEEDORES')).toBe(-70)
    expect(p.avisos.join(' ')).toMatch(/Anexo II/)
  })

  it('cada línea dice de dónde sale, con el importe completo', () => {
    const p = proponerFlujo({ ...insumos, ingresos: 1_234.567 }, SIN_ELECCIONES)
    expect(p.lineas.find((l) => l.origen === 'COBROS_VENTAS')?.detalle.join(' ')).toContain(
      '1.234,567',
    )
  })

  it('se aplican las que tienen importe y las que ya existen (para ponerlas en cero)', () => {
    const p = proponerFlujo({ ...insumos, bienesDeUso: { altas: 0, bajas: 0 } }, SIN_ELECCIONES)
    const origenes = (existentes: string[]) =>
      lineasParaAplicar(p, new Set(existentes as never[])).map((l) => l.origen)
    expect(origenes([])).not.toContain('PAGOS_BIENES_USO')
    expect(origenes(['PAGOS_BIENES_USO'])).toContain('PAGOS_BIENES_USO')
  })
})

describe('el RECPAM es la diferencia para que el estado cierre', () => {
  const item = (
    id: string,
    importe: number,
    origen: FlujoItemDTO['origen'] = null,
  ): FlujoItemDTO => ({
    id,
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: id,
    importe,
    importeAnterior: 0,
    orden: 0,
    origen,
  })
  const flujo = {
    ...FLUJO_VACIO,
    saldoInicial: 100,
    saldoFinal: 1_600,
    items: [item('cobros', 900), item('recpam', 0, 'RECPAM')],
  }

  it('variación 1.500 y actividades 900: el RECPAM es 600', () => {
    const f = conRecpam(flujo)
    expect(f.items.find((i) => i.id === 'recpam')?.importe).toBe(600)
  })

  it('queda pendiente hasta que se revisa, y vuelve a pendiente si cambia', () => {
    const f = conRecpam(flujo)
    expect(estadoRecpam(f)?.pendiente).toBe(true)
    expect(estadoRecpam({ ...f, recpamRevisado: 600 })?.pendiente).toBe(false)
    expect(estadoRecpam({ ...f, recpamRevisado: 599.99 })?.pendiente).toBe(true)
  })

  it('en cero no hay nada que revisar: las líneas explican toda la variación', () => {
    const exacto = { ...flujo, items: [item('cobros', 1_500), item('recpam', 0, 'RECPAM')] }
    expect(estadoRecpam(conRecpam(exacto))).toMatchObject({ importe: 0, pendiente: false })
  })

  it('sin línea de RECPAM no hay nada que calcular', () => {
    const sinRecpam = { ...flujo, items: [item('cobros', 900)] }
    expect(conRecpam(sinRecpam)).toBe(sinRecpam)
    expect(estadoRecpam(sinRecpam)).toBeNull()
  })

  it('cualquier cambio de la columna actual pide revisarlo de nuevo', () => {
    const f = conRecpam(flujo)
    expect(cambioColumnaActual(f, f)).toBe(false)
    const otro = {
      ...f,
      items: f.items.map((i) => (i.id === 'cobros' ? { ...i, importe: 901 } : i)),
    }
    expect(cambioColumnaActual(f, otro)).toBe(true)
    expect(cambioColumnaActual(f, { ...f, modificacionesEjAnt: 1 })).toBe(true)
  })
})
