import { describe, it, expect } from 'vitest'
import type { EstadosData, RubroFila } from '@/modules/estados/domain/types'
import type { NotaDTO } from '@/modules/notas/domain/types'
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
    // Los gastos NO se aplican acá: llegan ya resueltos desde el Anexo III (resolverGastos,
    // total por sección calculado desde las filas). El 777 cargado a mano no pisa nada.
    expect(r.eerr.seccionesGasto[0]?.totalAnt).toBe(90)
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

describe('resolverEstados: en MANUAL el anterior del rubro sale de su nota', () => {
  const detalle = (concepto: string, importeAnterior: number, esTotal = false) => ({
    id: concepto,
    notaEjercicioId: 'n',
    orden: 1,
    concepto,
    importeActual: 0,
    importeAnterior,
    esTotal,
  })
  const nota = (
    detalles: NotaDTO['detalles'],
    tipo: NotaDTO['tipo'] = 'CUANTITATIVA',
  ): NotaDTO => ({
    id: 'n',
    ejercicioId: 'e',
    numero: 2,
    titulo: 'CAJA Y BANCOS',
    tipo,
    orden: 1,
    criterioMedicion: null,
    textoApertura: null,
    detalles,
  })
  const caja = (r: EstadosData) => r.sspRubros.find((x) => x.id === 'caja')

  it('usa el total de la nota (sin la fila de total) y pisa lo escrito en el estado', () => {
    const notas = new Map([
      [
        'caja',
        nota([
          detalle('Bco Santander', 600.25),
          detalle('Bco Córdoba', 300.5),
          detalle('Total a mano', 5000, true),
        ]),
      ],
    ])
    const r = resolverEstados(estadosBase(), 'MANUAL', residuos, notas)
    expect(caja(r)?.displayValueAnt).toBe(900.75)
    expect(caja(r)?.anteriorDesdeNota).toEqual({
      notaNumero: 2,
      notaTitulo: 'CAJA Y BANCOS',
      filas: [
        { concepto: 'Bco Santander', importeAnterior: 600.25 },
        { concepto: 'Bco Córdoba', importeAnterior: 300.5 },
      ],
    })
    // Los demás rubros no cambian.
    expect(r.sspRubros.find((x) => x.id === 'deudas')?.displayValueAnt).toBe(30)
  })

  it('con la columna anterior de la nota vacía conserva el importe escrito en el estado', () => {
    const notas = new Map([['caja', nota([detalle('Bco Santander', 0)])]])
    const r = resolverEstados(estadosBase(), 'MANUAL', residuos, notas)
    expect(caja(r)?.displayValueAnt).toBe(999)
    expect(caja(r)?.anteriorDesdeNota).toBeUndefined()
  })

  it('una nota informativa no completa el rubro', () => {
    const notas = new Map([['caja', nota([detalle('Texto', 10)], 'INFORMATIVA')]])
    expect(caja(resolverEstados(estadosBase(), 'MANUAL', residuos, notas))?.displayValueAnt).toBe(
      999,
    )
  })

  it('fuera de MANUAL no usa las notas', () => {
    const notas = new Map([['caja', nota([detalle('Bco Santander', 600)])]])
    for (const modo of ['VINCULADO', 'SIN_ANTERIOR', 'PENDIENTE'] as const) {
      const r = resolverEstados(estadosBase(), modo, residuos, notas)
      expect(caja(r)?.displayValueAnt).toBe(80)
      expect(caja(r)?.anteriorDesdeNota).toBeUndefined()
    }
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
  it('gastos: VINCULADO intacto; en MANUAL los totales cargados por sección ya no cuentan', () => {
    expect(resolverGastos(gastos, 'VINCULADO', residuos).secciones[0]?.totalAnterior).toBe(90)
    // Sin filas cargadas, el total por sección es cero: el 777 escrito a mano se ignora.
    expect(resolverGastos(gastos, 'MANUAL', residuos).secciones[0]?.totalAnterior).toBe(0)
    expect(resolverGastos(gastos, 'SIN_ANTERIOR', residuos).secciones[0]?.totalAnterior).toBe(90)
  })

  it('gastos: en MANUAL el total por sección se calcula desde las filas', () => {
    const conCuenta = {
      ...gastos,
      secciones: [
        {
          ...gastos.secciones[0]!,
          filas: [{ cuentaId: 'c1', cuentaNombre: 'SUELDOS', importe: 100, importeAnterior: 0 }],
        },
      ],
    }
    const fila = (clave: string, label: string, valor: number, esHuerfano: boolean) =>
      ({
        id: clave,
        ejercicioId: 'e',
        modulo: 'GASTOS_FILA',
        clave,
        label,
        valor,
        esHuerfano,
        orden: 0,
      }) satisfies ComparativoManualDTO
    const conFilas: ComparativoManualDTO[] = [
      ...residuos,
      fila('fila:SUELDOS', 'SUELDOS', 600.555, false),
      // Gasto que solo existió el año pasado, clasificado por el contador en Administración.
      fila('sec:legacy:GASTOS_ADM:1', 'PUBLICIDAD', 400, true),
    ]
    const manual = resolverGastos(conCuenta, 'MANUAL', conFilas)
    expect(manual.anteriorManualPorFila).toEqual([
      { clave: 'fila:SUELDOS', nombre: 'SUELDOS', valor: 600.555, soloAnterior: false },
      { clave: 'sec:legacy:GASTOS_ADM:1', nombre: 'PUBLICIDAD', valor: 400, soloAnterior: true },
    ])
    // 600,555 de SUELDOS + 400 de PUBLICIDAD; el 777 cargado a mano por sección no cuenta.
    expect(manual.secciones.map((x) => x.key)).toEqual(['legacy:GASTOS_ADM'])
    expect(manual.secciones[0]?.totalAnterior).toBe(1000.555)
    expect(resolverGastos(conCuenta, 'VINCULADO', conFilas).anteriorManualPorFila).toBeUndefined()
    expect(
      resolverGastos(conCuenta, 'SIN_ANTERIOR', conFilas).anteriorManualPorFila,
    ).toBeUndefined()
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
