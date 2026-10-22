import { describe, expect, it } from 'vitest'
import type { CuentaContableDTO, RubroBaseSimple } from '@/modules/importaciones/domain/types'
import type { NotaDTO } from './types'
import {
  numeracionFinal,
  OPCIONES_POR_DEFECTO,
  planificarRegeneracion,
  resumirPlan,
  seQuitaFila,
} from './regeneracion'

function rubro(id: string, nombre: string, orden: number, extra: Partial<RubroBaseSimple> = {}) {
  return {
    id,
    codigo: id,
    nombre,
    estadoDestino: 'SSP',
    seccionSSP: 'ACTIVO_CORRIENTE',
    seccionEERR: null,
    naturalezaEsperada: 'DEUDORA',
    orden,
    generaNotaInformativa: false,
    textoNotaDefault: null,
    rubroGrupoNombre: null,
    rubroGrupoEsGasto: false,
    esEfectivo: false,
    ...extra,
  } satisfies RubroBaseSimple
}

function cuenta(
  id: string,
  codigo: string,
  nombre: string,
  rubroBaseId: string,
  saldoFinal: number,
  notaEjercicioId: string | null = null,
): CuentaContableDTO {
  return {
    id,
    ejercicioId: 'e',
    codigo,
    nombre,
    saldoDeudor: 0,
    saldoAcreedor: 0,
    saldoFinal,
    rubroBaseId,
    rubroNombre: null,
    notaEjercicioId,
    clasificadaManual: true,
    createdAt: new Date(0),
  }
}

const RUBROS = [
  rubro('caja', 'Caja y Bancos', 10),
  rubro('bdu', 'Bienes de uso', 20, { generaNotaInformativa: true }),
  rubro('capital', 'Capital', 30, { estadoDestino: 'PN' }),
]

describe('planificarRegeneracion: primera generación', () => {
  const plan = planificarRegeneracion({
    notas: [],
    rubros: RUBROS,
    cuentas: [
      cuenta('c2', '1109', 'BCO GALICIA', 'caja', 155_360.78),
      cuenta('c1', '1103', 'BCO NACION CC', 'caja', -1_088.12),
      cuenta('c3', '1501', 'Rodados', 'bdu', 500),
      cuenta('c4', '3101', 'Capital social', 'capital', -1000),
    ],
    config: {},
  })

  it('una nota por rubro (sin PN) más cambios en los criterios, con las filas por código', () => {
    expect(plan.nuevas.map((n) => [n.titulo, n.tipo])).toEqual([
      ['CAJA Y BANCOS', 'CUANTITATIVA'],
      ['BIENES DE USO', 'INFORMATIVA'],
      ['CAMBIOS EN LOS CRITERIOS CONTABLES', 'INFORMATIVA'],
    ])
    expect(plan.nuevas[0]!.filas).toEqual([
      { concepto: 'BCO NACION CC', importeActual: 1_088.12, orden: 1 },
      { concepto: 'BCO GALICIA', importeActual: 155_360.78, orden: 2 },
    ])
    expect(plan.nuevas[0]!.criterioMedicion).toBe('valor nominal')
    expect(plan.nuevas[0]!.textoApertura).toBe(
      'El saldo del rubro a fecha de cierre está compuesto por:',
    )
    expect(plan.nuevas[1]!.filas).toEqual([])
  })

  it('numera desde la Nota 2 en el orden de los rubros', () => {
    const n = numeracionFinal(plan, OPCIONES_POR_DEFECTO)
    expect(n.get('n:CAJA Y BANCOS')).toEqual({ orden: 1, numero: 2 })
    expect(n.get('n:CAMBIOS EN LOS CRITERIOS CONTABLES')).toEqual({ orden: 3, numero: 4 })
  })
})

describe('planificarRegeneracion: regenerar sin perder lo cargado a mano', () => {
  const detalle = (
    id: string,
    concepto: string,
    actual: number,
    anterior: number,
    orden: number,
  ) => ({
    id,
    notaEjercicioId: 'n1',
    orden,
    concepto,
    importeActual: actual,
    importeAnterior: anterior,
    esTotal: false,
  })
  const notas: NotaDTO[] = [
    {
      id: 'transicion',
      ejercicioId: 'e',
      numero: 2,
      titulo: 'NOTA DE TRANSICIÓN',
      tipo: 'POLITICA_CONTABLE',
      orden: 0,
      criterioMedicion: null,
      textoApertura: 'texto',
      detalles: [],
    },
    {
      id: 'n1',
      ejercicioId: 'e',
      numero: 3,
      titulo: 'CAJA Y BANCOS',
      tipo: 'CUANTITATIVA',
      orden: 1,
      criterioMedicion: 'valor nominal',
      textoApertura: 'Texto que escribió el contador',
      detalles: [
        detalle('d1', 'BCO GALICIA', 100, 98_000.5, 1),
        detalle('d2', 'Bco Santander', 0, 10_000, 2),
        detalle('d3', 'Caja chica', 50, 0, 3),
      ],
    },
  ]
  const plan = planificarRegeneracion({
    notas,
    rubros: RUBROS.slice(0, 1),
    cuentas: [
      cuenta('c2', '1109', 'BCO GALICIA', 'caja', 155_360.78, 'n1'),
      cuenta('c1', '1103', 'BCO NACION CC', 'caja', 1_088.12),
    ],
    config: {},
  })
  const caja = plan.existentes.find((n) => n.notaId === 'n1')!

  it('separa filas nuevas, importes del año que cambian y filas que ya no son cuentas', () => {
    expect(caja.filasNuevas).toEqual([
      { concepto: 'BCO NACION CC', importeActual: 1_088.12, orden: 4 },
    ])
    expect(caja.importesActuales).toEqual([
      { detalleId: 'd1', concepto: 'BCO GALICIA', antes: 100, despues: 155_360.78 },
    ])
    expect(caja.filasSinCuenta).toEqual([
      { detalleId: 'd2', concepto: 'Bco Santander', importeAnterior: 10_000 },
      { detalleId: 'd3', concepto: 'Caja chica', importeAnterior: 0 },
    ])
    expect(caja.cuentaIdsAVincular).toEqual(['c1'])
    expect(caja.textos).toEqual({
      criterioMedicion: 'valor nominal',
      textoApertura: 'El saldo del rubro a fecha de cierre está compuesto por:',
    })
  })

  it('por defecto no quita filas con importe anterior ni pisa textos', () => {
    const quitadas = caja.filasSinCuenta.filter((f) => seQuitaFila(f, OPCIONES_POR_DEFECTO))
    expect(quitadas.map((f) => f.concepto)).toEqual(['Caja chica'])
    expect(OPCIONES_POR_DEFECTO.restaurarTextos).toBe(false)
    const todas = { ...OPCIONES_POR_DEFECTO, quitarFilasConAnterior: true }
    expect(caja.filasSinCuenta.filter((f) => seQuitaFila(f, todas))).toHaveLength(2)
  })

  it('las notas que no son de un rubro quedan en su lugar y se renumera todo', () => {
    const n = numeracionFinal(plan, OPCIONES_POR_DEFECTO)
    expect(n.get('e:transicion')).toEqual({ orden: 1, numero: 2 })
    expect(n.get('e:n1')).toEqual({ orden: 2, numero: 3 })
    expect(n.get('n:CAMBIOS EN LOS CRITERIOS CONTABLES')).toEqual({ orden: 3, numero: 4 })
    // Sin crear notas nuevas, la de cambios no ocupa lugar.
    const sinNuevas = numeracionFinal(plan, { ...OPCIONES_POR_DEFECTO, notasNuevas: false })
    expect(sinNuevas.has('n:CAMBIOS EN LOS CRITERIOS CONTABLES')).toBe(false)
  })

  it('el resumen agrupa lo que cambia y separa las filas con importe anterior', () => {
    const r = resumirPlan(plan)
    expect(r.grupos.map((g) => [g.clave, g.items.length])).toEqual([
      ['notasNuevas', 1],
      ['filasNuevas', 1],
      ['importesActuales', 1],
      ['quitarFilasSinCuenta', 1],
      ['quitarFilasConAnterior', 1],
      ['restaurarTextos', 1],
    ])
    expect(r.grupos.find((g) => g.clave === 'quitarFilasConAnterior')?.items).toEqual([
      { nota: 'CAJA Y BANCOS', detalle: 'Bco Santander', importe: 10_000 },
    ])
    // La nota de transición está en el orden 0: al renumerar pasa al 1.
    expect(r.reordena).toBe(true)
  })
})
