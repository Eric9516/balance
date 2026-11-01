/**
 * Estado de Flujo de Efectivo (método directo). Puro: sin acceso a la base.
 *
 * Reglas:
 *  - El efectivo al CIERRE es la suma de los rubros de efectivo del SSP del ejercicio
 *    (columna actual). Siempre derivado y bloqueado: el flujo no puede contradecir al balance.
 *  - El efectivo al INICIO es la columna "Ejercicio anterior" de esos mismos rubros, que
 *    ya viene resuelta por el modo del ejercicio anterior (VINCULADO: derivada y
 *    reexpresada; MANUAL: cargada a mano y autorizada). Bloqueado cuando hay comparativo.
 *    En primer ejercicio o modo pendiente queda editable (normalmente 0).
 *  - Control: aumento (disminución) neta del efectivo = suma de las tres actividades.
 *  - Columna anterior: VINCULADO → del flujo del anterior, por sección y concepto,
 *    reexpresado; toda la columna queda bloqueada (lo que no tiene fuente va en 0).
 *    MANUAL → a mano; resto → no se muestra.
 */

import type { ModoAnteriorEfectivo } from '@/modules/ejercicios/domain/ejercicioAnterior'
import type { RubroFila } from '@/modules/estados/domain/types'
import {
  SECCIONES_FLUJO,
  type FlujoGuardadoDTO,
  type FlujoItemDTO,
  type SeccionFlujo,
} from './types'
import { restar, sumar, sumarPor } from '@/lib/importe'
import { reexpresar, type IndicesReexpresion } from '@/modules/estados/lib/ajuste'

export function normalizarConcepto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const claveLinea = (seccion: SeccionFlujo, concepto: string) =>
  `${seccion}|${normalizarConcepto(concepto)}`

/**
 * Primer concepto repetido dentro de una misma sección (ignorando mayúsculas y acentos).
 * Dos líneas iguales tomarían el mismo importe del anterior y lo duplicarían.
 */
export function conceptoDuplicado(
  lineas: { seccion: SeccionFlujo; concepto: string }[],
): { seccion: SeccionFlujo; concepto: string } | null {
  const vistas = new Set<string>()
  for (const l of lineas) {
    const clave = claveLinea(l.seccion, l.concepto)
    if (vistas.has(clave)) return l
    vistas.add(clave)
  }
  return null
}

// ─── Efectivo desde el SSP ───────────────────────────────────────────────────

export type EfectivoSSP = { actual: number; anterior: number }

/** Suma de los rubros de efectivo del SSP (ya resuelto por modo) en ambas columnas. */
export function efectivoDesdeSSP(sspRubros: RubroFila[], rubrosEfectivo: Set<string>): EfectivoSSP {
  const deEfectivo = sspRubros.filter((r) => rubrosEfectivo.has(r.id))
  return {
    actual: sumarPor(deEfectivo, (r) => r.displayValue),
    anterior: sumarPor(deEfectivo, (r) => r.displayValueAnt),
  }
}

// ─── Armado ──────────────────────────────────────────────────────────────────

export type BloqueoFlujo = {
  saldoInicial: boolean
  saldoFinal: boolean
  /** saldo inicial / modificaciones / final de la columna anterior */
  cabeceraAnterior: boolean
  /** ids de líneas cuya columna anterior viene del flujo del anterior (llevan candado) */
  lineasAnterior: Set<string>
}

export type TotalesColumna = {
  efectivoInicio: number
  modificaciones: number
  efectivoInicioModificado: number
  efectivoCierre: number
  /** cierre − inicio modificado */
  variacionNeta: number
  porSeccion: Record<SeccionFlujo, number>
  sumaActividades: number
  /** variacionNeta − sumaActividades */
  diferencia: number
  cuadra: boolean
}

export type FlujoData = {
  guardado: FlujoGuardadoDTO
  mostrarAnterior: boolean
  editarAnterior: boolean
  /** Anterior manual ya ajustado: lo que se había cargado, para mostrarlo al lado. */
  cargado: FlujoGuardadoDTO | null
  /**
   * Si tiene sentido exigir que la columna anterior cuadre: MANUAL, o VINCULADO con
   * flujo en el anterior. Sin ese flujo la columna queda vacía y ya hay advertencia.
   */
  controlarAnterior: boolean
  bloqueo: BloqueoFlujo
  actual: TotalesColumna
  anterior: TotalesColumna | null
  /** Líneas del flujo anterior sin contraparte este año (solo VINCULADO). */
  conceptosSoloAnterior: { seccion: SeccionFlujo; concepto: string; importe: number }[]
  advertencias: string[]
}

export const FLUJO_VACIO: FlujoGuardadoDTO = {
  id: '',
  saldoInicial: 0,
  modificacionesEjAnt: 0,
  saldoFinal: 0,
  saldoInicialAnterior: 0,
  modificacionesEjAntAnt: 0,
  saldoFinalAnterior: 0,
  items: [],
}

function totales(
  efectivoInicio: number,
  modificaciones: number,
  efectivoCierre: number,
  items: FlujoItemDTO[],
  importe: (i: FlujoItemDTO) => number,
): TotalesColumna {
  const porSeccion = Object.fromEntries(SECCIONES_FLUJO.map((s) => [s, 0])) as Record<
    SeccionFlujo,
    number
  >
  for (const s of SECCIONES_FLUJO) {
    porSeccion[s] = sumarPor(
      items.filter((i) => i.seccion === s),
      importe,
    )
  }
  const sumaActividades = sumarPor(SECCIONES_FLUJO, (s) => porSeccion[s])
  const efectivoInicioModificado = sumar(efectivoInicio, modificaciones)
  const variacionNeta = restar(efectivoCierre, efectivoInicioModificado)
  const diferencia = restar(variacionNeta, sumaActividades)
  return {
    efectivoInicio,
    modificaciones,
    efectivoInicioModificado,
    efectivoCierre,
    variacionNeta,
    porSeccion,
    sumaActividades,
    diferencia,
    cuadra: diferencia === 0,
  }
}

/**
 * Combina lo guardado (o lo que manda el cliente) con lo derivado. Sirve para mostrar
 * y para SANEAR antes de guardar: lo bloqueado siempre sale de acá, nunca del cliente.
 */
export function armarFlujo(params: {
  guardado: FlujoGuardadoDTO | null
  efectivo: EfectivoSSP
  modo: ModoAnteriorEfectivo
  /** Flujo guardado del ejercicio anterior (solo VINCULADO). */
  flujoAnterior: FlujoGuardadoDTO | null
  indices: IndicesReexpresion
  /** Anterior manual ya ajustado: lo que se había cargado. Bloquea la columna anterior. */
  cargado?: FlujoGuardadoDTO | null
  /** Si el anterior se ajustó: el efectivo al inicio de este año, que nunca se ajusta. */
  efectivoInicial?: number | null
}): FlujoData {
  const { efectivo, modo, flujoAnterior, indices } = params
  const base = params.guardado ?? FLUJO_VACIO
  const mostrarAnterior = modo === 'VINCULADO' || modo === 'MANUAL'
  const editarAnterior = modo === 'MANUAL'
  const advertencias: string[] = []

  // ── Columna actual ────────────────────────────────────────────────────────
  const saldoFinal = efectivo.actual
  const saldoInicial = mostrarAnterior
    ? (params.efectivoInicial ?? efectivo.anterior)
    : base.saldoInicial

  // ── Columna anterior ──────────────────────────────────────────────────────
  const lineasAnterior = new Set<string>()
  let items = base.items
  let saldoInicialAnterior = base.saldoInicialAnterior
  let modificacionesEjAntAnt = base.modificacionesEjAntAnt
  const saldoFinalAnterior = mostrarAnterior ? efectivo.anterior : 0
  const conceptosSoloAnterior: FlujoData['conceptosSoloAnterior'] = []

  if (modo === 'VINCULADO') {
    if (flujoAnterior) {
      saldoInicialAnterior = reexpresar(flujoAnterior.saldoInicial, indices)
      modificacionesEjAntAnt = reexpresar(flujoAnterior.modificacionesEjAnt, indices)
      const porClave = new Map(
        flujoAnterior.items.map((i) => [
          claveLinea(i.seccion, i.concepto),
          reexpresar(i.importe, indices),
        ]),
      )
      const usadas = new Set<string>()
      items = items.map((i) => {
        const clave = claveLinea(i.seccion, i.concepto)
        const v = porClave.get(clave)
        if (v === undefined) return { ...i, importeAnterior: 0 }
        usadas.add(clave)
        lineasAnterior.add(i.id)
        return { ...i, importeAnterior: v }
      })
      for (const i of flujoAnterior.items) {
        if (!usadas.has(claveLinea(i.seccion, i.concepto))) {
          conceptosSoloAnterior.push({
            seccion: i.seccion,
            concepto: i.concepto,
            importe: reexpresar(i.importe, indices),
          })
        }
      }
      if (conceptosSoloAnterior.length > 0) {
        advertencias.push(
          `Hay ${conceptosSoloAnterior.length} ${conceptosSoloAnterior.length === 1 ? 'concepto' : 'conceptos'} del ejercicio anterior sin línea este año: la columna anterior no va a cuadrar hasta que los traigas.`,
        )
      }
    } else {
      items = items.map((i) => ({ ...i, importeAnterior: 0 }))
      saldoInicialAnterior = 0
      modificacionesEjAntAnt = 0
      advertencias.push(
        'El ejercicio anterior vinculado no tiene Estado de Flujo de Efectivo cargado: la columna "Ejercicio anterior" de las actividades queda vacía.',
      )
    }
  } else if (!editarAnterior) {
    items = items.map((i) => ({ ...i, importeAnterior: 0 }))
    saldoInicialAnterior = 0
    modificacionesEjAntAnt = 0
  }

  const guardado: FlujoGuardadoDTO = {
    ...base,
    saldoInicial,
    saldoFinal,
    saldoInicialAnterior,
    modificacionesEjAntAnt,
    saldoFinalAnterior,
    items,
  }

  return {
    guardado,
    mostrarAnterior,
    editarAnterior: editarAnterior && !params.cargado,
    cargado: params.cargado ?? null,
    // Ya ajustado, lo cargado se controló al autorizar: los importes ajustados no se comparan exactos.
    controlarAnterior:
      (editarAnterior && !params.cargado) || (modo === 'VINCULADO' && flujoAnterior !== null),
    bloqueo: {
      saldoInicial: mostrarAnterior,
      saldoFinal: true,
      cabeceraAnterior: modo === 'VINCULADO' || Boolean(params.cargado),
      lineasAnterior: params.cargado ? new Set(items.map((i) => i.id)) : lineasAnterior,
    },
    ...totalesFlujo(guardado, mostrarAnterior),
    conceptosSoloAnterior,
    advertencias,
  }
}

/** Totales y control de ambas columnas. Puro: la vista lo recalcula sobre el borrador. */
export function totalesFlujo(
  f: FlujoGuardadoDTO,
  mostrarAnterior: boolean,
): { actual: TotalesColumna; anterior: TotalesColumna | null } {
  return {
    actual: totales(f.saldoInicial, f.modificacionesEjAnt, f.saldoFinal, f.items, (i) => i.importe),
    anterior: mostrarAnterior
      ? totales(
          f.saldoInicialAnterior,
          f.modificacionesEjAntAnt,
          f.saldoFinalAnterior,
          f.items,
          (i) => i.importeAnterior,
        )
      : null,
  }
}

/** ¿Cambió algo de la columna anterior? (en MANUAL anula la autorización del comparativo) */
export function cambioColumnaAnterior(antes: FlujoGuardadoDTO, despues: FlujoGuardadoDTO): boolean {
  const dif = (a: number, b: number) => restar(a, b) !== 0
  if (dif(antes.saldoInicialAnterior, despues.saldoInicialAnterior)) return true
  if (dif(antes.modificacionesEjAntAnt, despues.modificacionesEjAntAnt)) return true
  const previo = new Map(antes.items.map((i) => [i.id, i.importeAnterior]))
  return despues.items.some((i) => dif(previo.get(i.id) ?? 0, i.importeAnterior))
}
