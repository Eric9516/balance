import { describe, it, expect } from 'vitest'
import { aplicarArrastreCostoVentas, existenciaFinalAnteriorDesdeNotas } from './saldosInicio'
import { buildCostoVentasAntFromComparativos } from '@/modules/comparativo-manual/lib/apply'
import type { NotaDTO } from '@/modules/notas/domain/types'

const cv = (existenciaInicial: number, existenciaFinal: number) => ({
  id: 'c',
  ejercicioId: 'e',
  existenciaInicial,
  compras: 10,
  gastosFabricacion: 0,
  existenciaFinal,
})

const nota = (id: string, anteriores: number[]): NotaDTO => ({
  id,
  ejercicioId: 'e',
  numero: 3,
  titulo: 'BIENES DE CAMBIO',
  tipo: 'CUANTITATIVA',
  orden: 3,
  criterioMedicion: null,
  textoApertura: null,
  detalles: anteriores.map((importeAnterior, i) => ({
    id: `${id}-${i}`,
    notaEjercicioId: id,
    orden: i,
    concepto: `Cuenta ${i}`,
    importeActual: 0,
    importeAnterior,
    esTotal: false,
  })),
})

const fila = (clave: string, valor: number) => ({
  id: clave,
  ejercicioId: 'e',
  modulo: 'COSTO_VENTAS' as const,
  clave,
  label: clave,
  valor,
  esHuerfano: false,
  orden: 0,
})

describe('Anexo II en carga manual: cada existencia se carga una sola vez', () => {
  it('la existencia al comienzo es la existencia final del año anterior, con candado', () => {
    const r = aplicarArrastreCostoVentas(cv(1, 50), cv(0, 4_200_000.5), 'MANUAL')
    expect(r.existenciaInicialBloqueada).toBe(true)
    expect(r.datos?.existenciaInicial).toBe(4_200_000.5)
  })

  it('sin existencia final del año anterior, la del comienzo queda editable', () => {
    const r = aplicarArrastreCostoVentas(cv(7, 50), null, 'MANUAL')
    expect(r.existenciaInicialBloqueada).toBe(false)
    expect(r.datos?.existenciaInicial).toBe(7)
  })

  it('la existencia final del año anterior se propone desde la nota de bienes de cambio', () => {
    const rubros = [
      { id: 'r-bc', codigo: 'ACT-CTE-09' },
      { id: 'r-caja', codigo: 'ACT-CTE-01' },
    ]
    const cuentas = [
      { rubroBaseId: 'r-bc', notaEjercicioId: 'n-bc' },
      { rubroBaseId: 'r-caja', notaEjercicioId: 'n-caja' },
    ]
    const notas = [nota('n-bc', [4_000_000, 200_000.5]), nota('n-caja', [99])]
    expect(existenciaFinalAnteriorDesdeNotas({ rubros, cuentas, notas })).toBe(4_200_000.5)
    // Sin el anterior cargado en la nota no hay propuesta.
    expect(
      existenciaFinalAnteriorDesdeNotas({ rubros, cuentas, notas: [nota('n-bc', [0, 0])] }),
    ).toBeNull()
  })

  it('la propuesta se usa si la existencia final no se escribió; lo escrito manda', () => {
    const sinEscribir = [fila('existenciaInicial', 3_800_000), fila('compras', 16_000_000)]
    expect(buildCostoVentasAntFromComparativos('e', sinEscribir, 4_200_000)?.existenciaFinal).toBe(
      4_200_000,
    )
    const escrita = [...sinEscribir, fila('existenciaFinal', 4_100_000)]
    expect(buildCostoVentasAntFromComparativos('e', escrita, 4_200_000)?.existenciaFinal).toBe(
      4_100_000,
    )
  })
})
