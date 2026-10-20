import { describe, it, expect } from 'vitest'
import type { EstadosData, RubroFila } from '@/modules/estados/domain/types'
import type { ComparativoManualDTO } from '../domain/types'
import {
  editarAnteriorManual,
  fuenteComparativo,
  mostrarColumnaAnterior,
  resolverCostoVentasAnterior,
  resolverEstados,
  resolverGastos,
  seleccionarDerivado,
  seleccionarManual,
} from './politica'

function rubro(id: string, seccionSSP: string, actual: number, anterior: number): RubroFila {
  return {
    id,
    codigo: id,
    nombre: id,
    estadoDestino: 'SSP',
    seccionSSP,
    seccionEERR: null,
    naturalezaEsperada: 'DEUDORA',
    orden: 1,
    displayValue: actual,
    displayValueAnt: anterior,
    notaNumero: null,
    cuentas: [],
  }
}

function estadosBase(): EstadosData {
  return {
    sspRubros: [
      rubro('caja', 'ACTIVO_CORRIENTE', 100, 80),
      rubro('deudas', 'PASIVO_CORRIENTE', 40, 30),
    ],
    eerrRubros: [],
    eerr: {
      ingresos: 1000,
      ingresosAnt: 900,
      notaIngresosNum: null,
      costoVentas: 400,
      costoVentasAnt: 350,
      notaCostoVentasNum: null,
      usaAnexoCosto: false,
      seccionesGasto: [{ key: 'legacy:GASTOS_ADM', nombre: 'Adm', total: 100, totalAnt: 90 }],
      usaAnexoGastos: true,
      resultadosFinancieros: 10,
      resultadosFinancierosAnt: 5,
      rfCuentas: [],
      impuestoGanancias: 50,
      impuestoGananciasAnt: 40,
      igCuentas: [],
      utilidadBruta: 600,
      utilidadBrutaAnt: 550,
      resultadoAntesIG: 510,
      resultadoAntesIGAnt: 465,
      utilidadEjercicio: 460,
      utilidadEjercicioAnt: 425,
    },
    patrimonioNetoFinal: null,
    patrimonioNetoFinalAnt: null,
    sinClasificar: 0,
    totalCuentas: 2,
    hayEjercicioAnterior: true,
  }
}

// Filas manuales "residuales": existen en la base aunque el modo ya no sea MANUAL.
const residuos: ComparativoManualDTO[] = [
  {
    id: '1',
    ejercicioId: 'e',
    modulo: 'SSP',
    clave: 'caja',
    label: 'Caja',
    valor: 999,
    esHuerfano: false,
    orden: 0,
  },
  {
    id: '2',
    ejercicioId: 'e',
    modulo: 'EERR',
    clave: 'INGRESOS',
    label: 'Ingresos',
    valor: 123456,
    esHuerfano: false,
    orden: 0,
  },
  {
    id: '3',
    ejercicioId: 'e',
    modulo: 'GASTOS',
    clave: 'legacy:GASTOS_ADM',
    label: 'Adm',
    valor: 777,
    esHuerfano: false,
    orden: 0,
  },
  {
    id: '4',
    ejercicioId: 'e',
    modulo: 'SSP',
    clave: 'sec:ACTIVO_CORRIENTE:1',
    label: 'Solo antes',
    valor: 50,
    esHuerfano: true,
    orden: 1,
  },
  {
    id: '5',
    ejercicioId: 'e',
    modulo: 'COSTO_VENTAS',
    clave: 'existenciaFinal',
    label: 'EF',
    valor: 10,
    esHuerfano: false,
    orden: 0,
  },
]

describe('fuente por modo', () => {
  it('mapea modo a fuente', () => {
    expect(fuenteComparativo('VINCULADO')).toBe('DERIVADO')
    expect(fuenteComparativo('MANUAL')).toBe('MANUAL')
    expect(fuenteComparativo('SIN_ANTERIOR')).toBe('NINGUNO')
    expect(fuenteComparativo('PENDIENTE')).toBe('NINGUNO')
  })
  it('columna y edición', () => {
    expect(mostrarColumnaAnterior('VINCULADO')).toBe(true)
    expect(mostrarColumnaAnterior('MANUAL')).toBe(true)
    expect(mostrarColumnaAnterior('SIN_ANTERIOR')).toBe(false)
    expect(mostrarColumnaAnterior('PENDIENTE')).toBe(false)
    expect(editarAnteriorManual('MANUAL')).toBe(true)
    expect(editarAnteriorManual('VINCULADO')).toBe(false)
  })
  it('seleccionarDerivado solo deja pasar en VINCULADO', () => {
    expect(seleccionarDerivado('VINCULADO', [1], [])).toEqual([1])
    expect(seleccionarDerivado('MANUAL', [1], [])).toEqual([])
    expect(seleccionarDerivado('SIN_ANTERIOR', [1], [])).toEqual([])
    expect(seleccionarDerivado('PENDIENTE', [1], [])).toEqual([])
  })
  it('seleccionarManual solo deja pasar en MANUAL', () => {
    expect(seleccionarManual('MANUAL', residuos)).toHaveLength(residuos.length)
    expect(seleccionarManual('VINCULADO', residuos)).toEqual([])
    expect(seleccionarManual('SIN_ANTERIOR', residuos)).toEqual([])
  })
})

describe('resolverEstados: escenario A no se contamina con residuos manuales', () => {
  it('VINCULADO devuelve los valores derivados intactos aunque existan filas manuales', () => {
    const r = resolverEstados(estadosBase(), 'VINCULADO', residuos)
    expect(r.sspRubros.find((x) => x.id === 'caja')?.displayValueAnt).toBe(80)
    expect(r.sspRubros.some((x) => x.id.startsWith('sec:'))).toBe(false)
    expect(r.eerr.ingresosAnt).toBe(900)
    expect(r.eerr.seccionesGasto[0]?.totalAnt).toBe(90)
    expect(r.hayEjercicioAnterior).toBe(true)
  })

  it('MANUAL aplica las filas manuales (incluidas huérfanas) y recalcula subtotales', () => {
    const r = resolverEstados(estadosBase(), 'MANUAL', residuos)
    expect(r.sspRubros.find((x) => x.id === 'caja')?.displayValueAnt).toBe(999)
    expect(r.sspRubros.some((x) => x.id.startsWith('sec:ACTIVO_CORRIENTE'))).toBe(true)
    expect(r.eerr.ingresosAnt).toBe(123456)
    expect(r.eerr.seccionesGasto[0]?.totalAnt).toBe(777)
    // utilidad bruta ant = ingresos ant - costo ventas ant (sin override) = 123456 - 350
    expect(r.eerr.utilidadBrutaAnt).toBe(123456 - 350)
    expect(r.hayEjercicioAnterior).toBe(true)
  })

  it('SIN_ANTERIOR y PENDIENTE apagan la columna y no aplican nada', () => {
    for (const modo of ['SIN_ANTERIOR', 'PENDIENTE'] as const) {
      const r = resolverEstados(estadosBase(), modo, residuos)
      expect(r.hayEjercicioAnterior).toBe(false)
      expect(r.sspRubros.find((x) => x.id === 'caja')?.displayValueAnt).toBe(80)
      expect(r.sspRubros).toHaveLength(2)
    }
  })

  it('no muta la entrada', () => {
    const base = estadosBase()
    const copia = JSON.parse(JSON.stringify(base))
    resolverEstados(base, 'MANUAL', residuos)
    expect(base).toEqual(copia)
  })
})

describe('resolverGastos / resolverCostoVentasAnterior', () => {
  const gastos = {
    secciones: [
      {
        key: 'legacy:GASTOS_ADM',
        grupoId: null,
        grupoNombre: 'Adm',
        grupoSigla: null,
        esGastoDefault: true,
        aparecEnEERR: true,
        filas: [],
        total: 100,
        totalAnterior: 90,
      },
    ],
    todasSecciones: [],
  }
  it('gastos: VINCULADO intacto, MANUAL con override', () => {
    expect(resolverGastos(gastos, 'VINCULADO', residuos).secciones[0]?.totalAnterior).toBe(90)
    expect(resolverGastos(gastos, 'MANUAL', residuos).secciones[0]?.totalAnterior).toBe(777)
    expect(resolverGastos(gastos, 'SIN_ANTERIOR', residuos).secciones[0]?.totalAnterior).toBe(90)
  })
  it('gastos: el anterior fila por fila solo en MANUAL, y no se mezcla con los totales por sección', () => {
    const conFilas: ComparativoManualDTO[] = [
      ...residuos,
      {
        id: 'f1',
        ejercicioId: 'e',
        modulo: 'GASTOS_FILA',
        clave: 'fila:SUELDOS',
        label: 'SUELDOS',
        valor: 600.555,
        esHuerfano: false,
        orden: 0,
      },
      {
        id: 'f2',
        ejercicioId: 'e',
        modulo: 'GASTOS_FILA',
        clave: 'huerfano:1',
        label: 'PUBLICIDAD',
        valor: 400,
        esHuerfano: true,
        orden: 1,
      },
    ]
    const manual = resolverGastos(gastos, 'MANUAL', conFilas)
    expect(manual.anteriorManualPorFila).toEqual([
      { clave: 'fila:SUELDOS', nombre: 'SUELDOS', valor: 600.555, soloAnterior: false },
      { clave: 'huerfano:1', nombre: 'PUBLICIDAD', valor: 400, soloAnterior: true },
    ])
    // La fila solo del anterior no se convierte en una sección, y el total por sección no cambia.
    expect(manual.secciones.map((s) => s.key)).toEqual(['legacy:GASTOS_ADM'])
    expect(manual.secciones[0]?.totalAnterior).toBe(777)
    expect(resolverGastos(gastos, 'VINCULADO', conFilas).anteriorManualPorFila).toBeUndefined()
    expect(resolverGastos(gastos, 'SIN_ANTERIOR', conFilas).anteriorManualPorFila).toBeUndefined()
  })

  it('costo de ventas anterior según fuente', () => {
    const derivado = {
      id: 'd',
      ejercicioId: 'ant',
      existenciaInicial: 1,
      compras: 2,
      gastosFabricacion: 0,
      existenciaFinal: 3,
    }
    expect(resolverCostoVentasAnterior(derivado, 'VINCULADO', residuos, 'e')).toBe(derivado)
    expect(resolverCostoVentasAnterior(derivado, 'MANUAL', residuos, 'e')?.existenciaFinal).toBe(10)
    expect(resolverCostoVentasAnterior(derivado, 'MANUAL', residuos, 'e')?.id).toBe('manual')
    expect(resolverCostoVentasAnterior(derivado, 'SIN_ANTERIOR', residuos, 'e')).toBeNull()
    expect(resolverCostoVentasAnterior(null, 'MANUAL', [], 'e')).toBeNull()
  })
})
