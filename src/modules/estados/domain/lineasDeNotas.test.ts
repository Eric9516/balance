import { describe, expect, it } from 'vitest'
import type { NotaDTO } from '@/modules/notas/domain/types'
import { aplicarLineasDeNotas, notasParaEERR } from './lineasDeNotas'
import { armarLineasEERR } from './lineasEERR'
import type { EERRData } from './types'

const nota = (id: string, anterior: number, debajoDe: string | null, orden = 1): NotaDTO => ({
  id,
  ejercicioId: 'e',
  numero: orden + 1,
  titulo: `Nota ${id}`,
  tipo: 'CUANTITATIVA',
  orden,
  lineaEerrDebajoDe: debajoDe,
  criterioMedicion: null,
  textoApertura: null,
  detalles: [
    {
      id: `${id}-1`,
      notaEjercicioId: id,
      orden: 1,
      concepto: 'Fila',
      importeActual: 0,
      importeAnterior: anterior,
      esTotal: false,
    },
  ],
})

// Columna anterior del balance de referencia: 5.288.322,87 antes de "Otros ingresos y egresos".
const eerr = {
  ingresos: 0,
  ingresosAnt: 48_715_711.65,
  notaIngresosNum: null,
  costoVentas: 0,
  costoVentasAnt: 14_683_445.54,
  notaCostoVentasNum: null,
  usaAnexoCosto: false,
  seccionesGasto: [{ key: 'ADM', nombre: 'Administración', total: 0, totalAnt: 29_227_954.11 }],
  usaAnexoGastos: true,
  resultadosFinancieros: 0,
  resultadosFinancierosAnt: 484_010.87,
  rfCuentas: [],
  impuestoGanancias: 0,
  impuestoGananciasAnt: 214_163.58,
  igCuentas: [],
  utilidadBruta: 0,
  utilidadBrutaAnt: 34_032_266.11,
  resultadoAntesIG: 0,
  resultadoAntesIGAnt: 5_288_322.87,
  utilidadEjercicio: 0,
  utilidadEjercicioAnt: 5_074_159.29,
} as EERRData

const SIN_CUENTAS = new Set<string>()

describe('Nota como fila del Estado de Resultados', () => {
  it('da el resultado del balance presentado', () => {
    const r = aplicarLineasDeNotas(
      eerr,
      [nota('a', -316_904.13, 'RESULTADOS_FINANCIEROS')],
      SIN_CUENTAS,
    )
    expect(r.resultadoAntesIGAnt).toBe(4_971_418.74)
    expect(r.utilidadEjercicioAnt).toBe(4_757_255.16)
    expect(r.utilidadBrutaAnt).toBe(eerr.utilidadBrutaAnt)
  })

  it('entra en los subtotales que tiene debajo', () => {
    const arriba = aplicarLineasDeNotas(eerr, [nota('a', 100, 'INGRESOS')], SIN_CUENTAS)
    expect(arriba.utilidadBrutaAnt).toBe(34_032_366.11)
    expect(arriba.resultadoAntesIGAnt).toBe(5_288_422.87)
    expect(arriba.utilidadEjercicioAnt).toBe(5_074_259.29)

    const abajo = aplicarLineasDeNotas(eerr, [nota('a', 100, 'IMPUESTO_GANANCIAS')], SIN_CUENTAS)
    expect(abajo.utilidadBrutaAnt).toBe(eerr.utilidadBrutaAnt)
    expect(abajo.resultadoAntesIGAnt).toBe(eerr.resultadoAntesIGAnt)
    expect(abajo.utilidadEjercicioAnt).toBe(5_074_259.29)
  })

  it('si desaparece la sección de gastos de arriba, la fila se sigue viendo y sumando', () => {
    const r = aplicarLineasDeNotas(eerr, [nota('a', 100, 'SECCION_QUE_YA_NO_ESTA')], SIN_CUENTAS)
    expect(r.lineasNota?.[0]?.debajoDe).toBe('UTILIDAD_BRUTA')
    expect(armarLineasEERR(r).map((l) => l.clave)).toContain('nota:a')
    expect(r.utilidadBrutaAnt).toBe(eerr.utilidadBrutaAnt)
    expect(r.resultadoAntesIGAnt).toBe(5_288_422.87)
  })

  it('se elige si suma o resta, sea cual sea el signo con el que se cargó la nota', () => {
    const conEleccion = (anterior: number, resta: boolean | null) =>
      aplicarLineasDeNotas(
        eerr,
        [{ ...nota('a', anterior, 'RESULTADOS_FINANCIEROS'), lineaEerrResta: resta }],
        SIN_CUENTAS,
      )
    // Cargada en positivo y elegida "resta": entre paréntesis y baja el resultado
    expect(conEleccion(316_904.13, true).lineasNota?.[0]?.totalAnt).toBe(-316_904.13)
    expect(conEleccion(316_904.13, true).resultadoAntesIGAnt).toBe(4_971_418.74)
    expect(conEleccion(-316_904.13, true).lineasNota?.[0]?.totalAnt).toBe(-316_904.13)
    // Cargada en negativo y elegida "suma"
    expect(conEleccion(-316_904.13, false).lineasNota?.[0]?.totalAnt).toBe(316_904.13)
    expect(conEleccion(-316_904.13, false).resultadoAntesIGAnt).toBe(5_605_227)
    // Sin elegir (ubicada antes de esta opción): el signo de la nota, como antes
    expect(conEleccion(-316_904.13, null).lineasNota?.[0]?.totalAnt).toBe(-316_904.13)
    expect(conEleccion(316_904.13, null).lineasNota?.[0]?.totalAnt).toBe(316_904.13)
  })

  it('no toca la columna del ejercicio actual', () => {
    const r = aplicarLineasDeNotas(eerr, [nota('a', 100, 'INGRESOS')], SIN_CUENTAS)
    expect(r.utilidadBruta).toBe(0)
    expect(r.resultadoAntesIG).toBe(0)
    expect(r.utilidadEjercicio).toBe(0)
  })

  it('una nota con cuentas de este año no se suma: ya está en otra línea', () => {
    const r = aplicarLineasDeNotas(eerr, [nota('a', 100, 'INGRESOS')], new Set(['a']))
    expect(r).toBe(eerr)
    expect(notasParaEERR([nota('a', 100, null)], new Set(['a']))).toEqual([])
  })

  it('la lista para elegir no trae las que ya están en el estado', () => {
    const lista = notasParaEERR([nota('a', 100, null), nota('b', 5, 'INGRESOS')], SIN_CUENTAS)
    expect(lista.map((n) => n.id)).toEqual(['a'])
    expect(lista[0]?.totalAnt).toBe(100)
  })

  it('en el documento sale debajo de su línea', () => {
    const r = aplicarLineasDeNotas(
      eerr,
      [nota('a', -316_904.13, 'RESULTADOS_FINANCIEROS')],
      SIN_CUENTAS,
    )
    const claves = armarLineasEERR(r).map((l) => l.clave)
    const i = claves.indexOf('RESULTADOS_FINANCIEROS')
    expect(claves[i + 1]).toBe('nota:a')
    expect(armarLineasEERR(r)[i + 1]).toMatchObject({
      valor: 0,
      valorAnt: -316_904.13,
      notaNumero: 2,
    })
  })
})
