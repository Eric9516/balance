/**
 * Notas como filas de los estados (Resultados y Situación Patrimonial): importes del ejercicio anterior cuyas cuentas no están
 * en el balance de este año. La fila toma el total de la nota y entra en los subtotales que tiene
 * debajo. Solo la columna anterior: lo de este año sale siempre de las cuentas. Puro.
 */

import { restar, sumar, sumarPor } from '@/lib/importe'
import { totalesNota, type NotaDTO } from '@/modules/notas/domain/types'
import type { EERRData, RubroFila } from './types'

export type LineaNotaEERR = {
  notaId: string
  titulo: string
  notaNumero: number | null
  /** Clave de la línea que queda arriba. */
  debajoDe: string
  totalAnt: number
}

/** Una nota que se puede ubicar en un estado. */
export type NotaParaUbicar = { id: string; numero: number | null; titulo: string; totalAnt: number }

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

/**
 * El total con el signo elegido: la que resta va en negativo (entre paréntesis), la que suma en
 * positivo. Sin elegir (se ubicó antes de esta opción), el signo con el que se cargó la nota.
 */
export function conSigno(total: number, resta: boolean | null | undefined): number {
  const negativo = total < 0
  return (resta ?? negativo) === negativo ? total : restar(0, total)
}

/** Las notas que no tienen cuentas de este año: si las tuvieran, ya estarían en otra línea. */
function sinCuentas(notas: NotaDTO[], idsConCuentas: ReadonlySet<string>) {
  return notas.filter((n) => n.tipo === 'CUANTITATIVA' && !idsConCuentas.has(n.id))
}

export function notasParaUbicar(
  notas: NotaDTO[],
  idsConCuentas: ReadonlySet<string>,
): NotaParaUbicar[] {
  // Una nota se usa una sola vez: la que ya está en un estado no se ofrece en ningún +.
  return sinCuentas(notas, idsConCuentas)
    .filter((n) => !n.lineaEerrDebajoDe && !n.lineaSspSeccion)
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
      totalAnt: conSigno(totalesNota(n).anterior, n.lineaEerrResta),
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

/** Secciones del Estado de Situación Patrimonial donde va una nota: el Patrimonio Neto sale del E.E.P.N. */
export const SECCIONES_SSP_CON_FILAS: readonly string[] = [
  'ACTIVO_CORRIENTE',
  'ACTIVO_NO_CORRIENTE',
  'PASIVO_CORRIENTE',
  'PASIVO_NO_CORRIENTE',
]

/**
 * Agrega las notas ubicadas en el Estado de Situación Patrimonial como filas de su sección, debajo
 * de la fila elegida. Son filas como las demás: entran en el subtotal de la sección, en el total y
 * en el cuadre del anterior sin que nadie las sume aparte. Solo tienen importe anterior.
 * Si la fila de arriba ya no está (cambiaron las cuentas), la nota va al final de su sección.
 */
export function aplicarFilasNotaSSP(
  sspRubros: RubroFila[],
  notas: NotaDTO[],
  idsConCuentas: ReadonlySet<string>,
): RubroFila[] {
  const ubicadas = sinCuentas(notas, idsConCuentas)
    .filter((n) => n.lineaSspSeccion && SECCIONES_SSP_CON_FILAS.includes(n.lineaSspSeccion))
    .sort((a, b) => a.orden - b.orden)
  if (ubicadas.length === 0) return sspRubros

  const seccionDe = new Map(sspRubros.map((r) => [r.id, r.seccionSSP]))
  const ultimaDe = (seccion: string) =>
    sspRubros.findLast((r) => r.seccionSSP === seccion)?.id ?? null
  const clave = (seccion: string, debajoDe: string | null) => `${seccion}|${debajoDe ?? ''}`

  const porLugar = new Map<string, RubroFila[]>()
  for (const n of ubicadas) {
    const seccion = n.lineaSspSeccion!
    const pedida = n.lineaSspDebajoDe ?? null
    const debajoDe =
      pedida === null || seccionDe.get(pedida) === seccion ? pedida : ultimaDe(seccion)
    const fila: RubroFila = {
      id: `nota:${n.id}`,
      codigo: '',
      nombre: n.titulo,
      estadoDestino: 'SSP',
      seccionSSP: seccion,
      seccionEERR: null,
      naturalezaEsperada: 'DEUDORA',
      orden: 0,
      displayValue: 0,
      displayValueAnt: conSigno(totalesNota(n).anterior, n.lineaSspResta),
      notaNumero: n.numero,
      cuentas: [],
      notaFila: { notaId: n.id, debajoDe },
    }
    const k = clave(seccion, debajoDe)
    porLugar.set(k, [...(porLugar.get(k) ?? []), fila])
  }

  const resultado: RubroFila[] = []
  const tomar = (k: string) => {
    resultado.push(...(porLugar.get(k) ?? []))
    porLugar.delete(k)
  }
  const empezadas = new Set<string>()
  for (const r of sspRubros) {
    if (r.seccionSSP && !empezadas.has(r.seccionSSP)) {
      empezadas.add(r.seccionSSP)
      tomar(clave(r.seccionSSP, null))
    }
    resultado.push(r)
    if (r.seccionSSP) tomar(clave(r.seccionSSP, r.id))
  }
  // Secciones que este año no tienen rubros: sus notas van igual (el orden lo da la sección).
  for (const filas of porLugar.values()) resultado.push(...filas)
  return resultado
}
