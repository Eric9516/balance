/**
 * Notas como filas del Estado de Resultados: importes del ejercicio anterior cuyas cuentas no están
 * en el balance de este año. La fila toma el total de la nota y entra en los subtotales que tiene
 * debajo. Solo la columna anterior: lo de este año sale siempre de las cuentas. Puro.
 */

import { restar, sumar, sumarPor } from '@/lib/importe'
import { totalesNota, type NotaDTO } from '@/modules/notas/domain/types'
import type { EERRData } from './types'

export type LineaNotaEERR = {
  notaId: string
  titulo: string
  notaNumero: number | null
  /** Clave de la línea que queda arriba. */
  debajoDe: string
  totalAnt: number
}

/** Una nota que se puede ubicar en el estado. */
export type NotaParaEERR = { id: string; numero: number | null; titulo: string; totalAnt: number }

/** Líneas después de las cuales una fila ya no entra en la utilidad bruta. */
const ARRIBA_DE_UTILIDAD_BRUTA = new Set(['INGRESOS', 'COSTO_VENTAS'])
/** Líneas después de las cuales una fila solo entra en el resultado del ejercicio. */
const DEBAJO_DE_RESULTADO_ANTES_IG = new Set(['RESULTADO_ANTES_IG', 'IMPUESTO_GANANCIAS'])

const LINEAS_FIJAS = new Set([
  ...ARRIBA_DE_UTILIDAD_BRUTA,
  ...DEBAJO_DE_RESULTADO_ANTES_IG,
  'UTILIDAD_BRUTA',
  'RESULTADOS_FINANCIEROS',
])

/**
 * Una sección de gastos puede desaparecer si cambian las cuentas. La fila no se pierde (sumaría sin
 * verse): pasa debajo de la utilidad bruta, donde entra en los mismos subtotales.
 */
function lineaVigente(debajoDe: string, secciones: ReadonlySet<string>): string {
  return LINEAS_FIJAS.has(debajoDe) || secciones.has(debajoDe) ? debajoDe : 'UTILIDAD_BRUTA'
}

/** Las notas que no tienen cuentas de este año: si las tuvieran, ya estarían en otra línea. */
function sinCuentas(notas: NotaDTO[], idsConCuentas: ReadonlySet<string>) {
  return notas.filter((n) => n.tipo === 'CUANTITATIVA' && !idsConCuentas.has(n.id))
}

export function notasParaEERR(
  notas: NotaDTO[],
  idsConCuentas: ReadonlySet<string>,
): NotaParaEERR[] {
  return sinCuentas(notas, idsConCuentas)
    .filter((n) => !n.lineaEerrDebajoDe)
    .map((n) => ({
      id: n.id,
      numero: n.numero,
      titulo: n.titulo,
      totalAnt: totalesNota(n).anterior,
    }))
}

/** Suma las notas ubicadas en el estado a los subtotales de la columna anterior. */
export function aplicarLineasDeNotas(
  eerr: EERRData,
  notas: NotaDTO[],
  idsConCuentas: ReadonlySet<string>,
): EERRData {
  const secciones = new Set(eerr.seccionesGasto.map((s) => s.key))
  const lineasNota: LineaNotaEERR[] = sinCuentas(notas, idsConCuentas)
    .filter((n) => n.lineaEerrDebajoDe)
    .sort((a, b) => a.orden - b.orden)
    .map((n) => ({
      notaId: n.id,
      titulo: n.titulo,
      notaNumero: n.numero,
      debajoDe: lineaVigente(n.lineaEerrDebajoDe!, secciones),
      totalAnt: totalesNota(n).anterior,
    }))
  if (lineasNota.length === 0) return eerr

  const enUtilidadBruta = sumarPor(
    lineasNota.filter((l) => ARRIBA_DE_UTILIDAD_BRUTA.has(l.debajoDe)),
    (l) => l.totalAnt,
  )
  const soloEnResultado = sumarPor(
    lineasNota.filter((l) => DEBAJO_DE_RESULTADO_ANTES_IG.has(l.debajoDe)),
    (l) => l.totalAnt,
  )
  const enTodas = sumarPor(lineasNota, (l) => l.totalAnt)
  const antesDeIG = restar(enTodas, soloEnResultado)

  return {
    ...eerr,
    lineasNota,
    utilidadBrutaAnt: sumar(eerr.utilidadBrutaAnt, enUtilidadBruta),
    resultadoAntesIGAnt: sumar(eerr.resultadoAntesIGAnt, antesDeIG),
    utilidadEjercicioAnt: sumar(eerr.utilidadEjercicioAnt, enTodas),
  }
}
