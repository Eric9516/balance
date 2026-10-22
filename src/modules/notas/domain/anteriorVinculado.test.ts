import { describe, expect, it } from 'vitest'
import type { CuentaContableDTO } from '@/modules/importaciones/domain/types'
import type { NotaDTO } from './types'
import { derivarAnteriorDeNotas, esFilaSoloAnterior } from './anteriorVinculado'

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

const detalle = (id: string, concepto: string, importeAnterior: number, orden: number) => ({
  id,
  notaEjercicioId: 'n1',
  orden,
  concepto,
  importeActual: 10,
  importeAnterior,
  esTotal: false,
})

const nota = (detalles: NotaDTO['detalles'], tipo: NotaDTO['tipo'] = 'CUANTITATIVA'): NotaDTO => ({
  id: 'n1',
  ejercicioId: 'e',
  numero: 2,
  titulo: 'CAJA Y BANCOS',
  tipo,
  orden: 1,
  criterioMedicion: null,
  textoApertura: null,
  detalles,
})

const actuales = [
  cuenta('c1', '1103', 'BCO NACION CC', 'caja', 100, 'n1'),
  cuenta('c2', '1109', 'BCO GALICIA', 'caja', 200, 'n1'),
]

describe('derivarAnteriorDeNotas', () => {
  it('toma el anterior de cada fila de la cuenta del mismo nombre y rubro, sin signo', () => {
    const [n] = derivarAnteriorDeNotas(
      [nota([detalle('d1', 'BCO NACION CC', 999, 1), detalle('d2', 'bco galicia ', 999, 2)])],
      actuales,
      [
        cuenta('a1', '1103', 'BCO NACION CC', 'caja', 1_250.5),
        cuenta('a2', '1109', 'BCO GALICIA', 'caja', -30),
        cuenta('a3', '1109', 'BCO GALICIA', 'otro', 7), // otro rubro: no cuenta
      ],
    )
    expect(n!.detalles.map((d) => [d.concepto, d.importeAnterior])).toEqual([
      ['BCO NACION CC', 1_250.5],
      ['bco galicia ', 30],
    ])
  })

  it('agrega como "solo anterior" las cuentas del anterior que ya no están, y pone cero a las nuevas', () => {
    const [n] = derivarAnteriorDeNotas(
      [nota([detalle('d1', 'BCO NACION CC', 5, 1), detalle('d2', 'BCO GALICIA', 5, 2)])],
      actuales,
      [
        cuenta('a1', '1103', 'BCO NACION CC', 'caja', 100),
        cuenta('a9', '1120', 'BCO SANTANDER', 'caja', 10_000),
      ],
    )
    expect(n!.detalles.map((d) => [d.concepto, d.importeActual, d.importeAnterior])).toEqual([
      ['BCO NACION CC', 10, 100],
      ['BCO GALICIA', 10, 0],
      ['BCO SANTANDER', 0, 10_000],
    ])
    expect(esFilaSoloAnterior(n!.detalles[2]!)).toBe(true)
    expect(n!.detalles[2]!.orden).toBe(3)
    expect(esFilaSoloAnterior(n!.detalles[0]!)).toBe(false)
  })

  it('no toca las notas de texto', () => {
    const informativa = nota([], 'INFORMATIVA')
    expect(derivarAnteriorDeNotas([informativa], actuales, [])).toEqual([informativa])
  })
})
