/**
 * Dominio: cómo se resuelve el ejercicio anterior de un ejercicio contable.
 *
 * Tres modos (ModoEjercicioAnterior):
 *  - VINCULADO    → el anterior está cargado en el sistema. Saldos de inicio y columna
 *                   comparativa se DERIVAN del anterior y se bloquean.
 *  - MANUAL       → no hay historial en el sistema. El contador carga a mano los saldos
 *                   del ejercicio anterior y los AUTORIZA explícitamente.
 *  - SIN_ANTERIOR → primer ejercicio de la sociedad. No hay columna comparativa.
 *  - null         → pendiente de configurar (bloquea la autorización final).
 *
 * Todo lo de este archivo es puro: sin acceso a base de datos.
 */

import type { EstadoEjercicio, ModoEjercicioAnterior } from '@prisma/client'
import { formatFecha } from '@/lib/utils/dates'

export type ModoAnteriorEfectivo = ModoEjercicioAnterior | 'PENDIENTE'

export const MODOS_ANTERIOR: readonly ModoEjercicioAnterior[] = [
  'VINCULADO',
  'MANUAL',
  'SIN_ANTERIOR',
] as const

export function esModoAnterior(v: unknown): v is ModoEjercicioAnterior {
  return typeof v === 'string' && (MODOS_ANTERIOR as readonly string[]).includes(v)
}

export function modoEfectivo(e: {
  modoAnterior: ModoEjercicioAnterior | null
}): ModoAnteriorEfectivo {
  return e.modoAnterior ?? 'PENDIENTE'
}

/**
 * Id del ejercicio anterior que se puede usar como FUENTE DERIVADA.
 * Única puerta: fuera de VINCULADO nunca se deriva nada del anterior, aunque
 * el vínculo exista en la base por un estado inconsistente.
 */
export function idAnteriorDerivable(e: {
  modoAnterior: ModoEjercicioAnterior | null
  ejercicioAnteriorId: string | null
}): string | null {
  return e.modoAnterior === 'VINCULADO' ? e.ejercicioAnteriorId : null
}

// ─── Invariantes modo ⇄ vínculo ──────────────────────────────────────────────

const MODO_LABEL_CORTO: Record<ModoEjercicioAnterior, string> = {
  VINCULADO: 'Vinculado',
  MANUAL: 'Carga manual',
  SIN_ANTERIOR: 'Primer ejercicio',
}

/** Devuelve el mensaje de error si modo y vínculo son incompatibles; null si son coherentes. */
export function validarInvariantesModo(
  modo: ModoEjercicioAnterior | null,
  ejercicioAnteriorId: string | null,
): string | null {
  if (modo === 'VINCULADO' && !ejercicioAnteriorId) {
    return 'Para vincular el ejercicio anterior tenés que elegir cuál es.'
  }
  if ((modo === 'MANUAL' || modo === 'SIN_ANTERIOR') && ejercicioAnteriorId) {
    return `El modo "${MODO_LABEL_CORTO[modo]}" no admite un ejercicio anterior vinculado.`
  }
  if (modo === null && ejercicioAnteriorId) {
    return 'Si elegís un ejercicio anterior, el modo tiene que ser "Vinculado".'
  }
  return null
}

// ─── Vínculo con el ejercicio anterior ───────────────────────────────────────

export type EjercicioResumen = {
  id: string
  sociedadId: string
  denominacion: string
  fechaInicio: Date
  fechaCierre: Date
  ejercicioAnteriorId: string | null
  estado: EstadoEjercicio
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Día siguiente en UTC (las fechas contables se guardan a medianoche UTC). */
export function diaSiguienteUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + DIA_MS)
}

/** Día anterior en UTC. En modo MANUAL es la fecha de cierre del ejercicio anterior. */
export function diaAnteriorUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - DIA_MS)
}

function mismoDiaUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

/** true si el ejercicio actual empieza el día siguiente al cierre del anterior. */
export function esConsecutivo(fechaCierreAnterior: Date, fechaInicioActual: Date): boolean {
  return mismoDiaUTC(diaSiguienteUTC(fechaCierreAnterior), fechaInicioActual)
}

export type ResultadoVinculo = { errores: string[]; advertencias: string[] }

/**
 * Valida que `anterior` pueda ser el ejercicio anterior de `actual`.
 * `cadenaDelAnterior`: ids de los antecesores del candidato (su anterior, el anterior
 * de ese, ...). Sirve para detectar ciclos sin acceso a la base.
 * `usadoPor`: id del ejercicio que ya tiene al candidato como anterior (si existe).
 */
export function validarVinculoEjercicioAnterior(params: {
  actual: { id: string | null; sociedadId: string; fechaInicio: Date }
  anterior: EjercicioResumen
  cadenaDelAnterior: string[]
  usadoPor: string | null
}): ResultadoVinculo {
  const { actual, anterior, cadenaDelAnterior, usadoPor } = params
  const errores: string[] = []
  const advertencias: string[] = []

  if (actual.id && anterior.id === actual.id) {
    errores.push('Un ejercicio no puede ser su propio ejercicio anterior.')
  }
  if (anterior.sociedadId !== actual.sociedadId) {
    errores.push('El ejercicio anterior tiene que pertenecer a la misma sociedad.')
  }
  if (anterior.fechaCierre.getTime() >= actual.fechaInicio.getTime()) {
    errores.push(
      `El cierre del ejercicio anterior (${formatFecha(anterior.fechaCierre)}) tiene que ser previo al inicio de este ejercicio (${formatFecha(actual.fechaInicio)}).`,
    )
  } else if (!esConsecutivo(anterior.fechaCierre, actual.fechaInicio)) {
    advertencias.push(
      `Los ejercicios no son consecutivos: el anterior cierra el ${formatFecha(anterior.fechaCierre)} y este empieza el ${formatFecha(actual.fechaInicio)}. Verificá que no falte un ejercicio intermedio.`,
    )
  }
  if (actual.id && cadenaDelAnterior.includes(actual.id)) {
    errores.push('El vínculo generaría un ciclo: ese ejercicio ya depende de este.')
  }
  if (usadoPor && usadoPor !== actual.id) {
    errores.push(`${anterior.denominacion} ya es el ejercicio anterior de otro ejercicio.`)
  }

  return { errores, advertencias }
}

/**
 * Ejercicios que pueden elegirse como anterior de `actual`: misma lista de la sociedad,
 * excluyendo el propio, los que ya son anterior de otro ejercicio y, si se conoce la fecha
 * de inicio, los que cierran después de ella. Ordenados por cierre descendente.
 */
export function elegiblesComoAnterior(
  ejercicios: EjercicioResumen[],
  actual: { id: string | null; fechaInicio: Date | null },
): EjercicioResumen[] {
  const usados = new Set(
    ejercicios
      .filter((e) => e.ejercicioAnteriorId && e.id !== actual.id)
      .map((e) => e.ejercicioAnteriorId as string),
  )
  return ejercicios
    .filter((e) => e.id !== actual.id)
    .filter((e) => !usados.has(e.id))
    .filter((e) => !actual.fechaInicio || e.fechaCierre.getTime() < actual.fechaInicio.getTime())
    .sort((a, b) => b.fechaCierre.getTime() - a.fechaCierre.getTime())
}

/** El elegible que cierra exactamente el día anterior al inicio, si existe. */
export function candidatoAutomatico(
  elegibles: EjercicioResumen[],
  fechaInicio: Date | null,
): EjercicioResumen | null {
  if (!fechaInicio) return null
  return elegibles.find((e) => esConsecutivo(e.fechaCierre, fechaInicio)) ?? null
}

// ─── Efectos de cambiar el modo o el vínculo ─────────────────────────────────

export type ConfigAnterior = {
  modoAnterior: ModoEjercicioAnterior | null
  ejercicioAnteriorId: string | null
}

export type EfectosCambioModo = {
  /** borrar filas de comparativo_manual (quedan sin sentido fuera de MANUAL) */
  limpiarComparativosManuales: boolean
  /** anular la autorización explícita de saldos manuales */
  anularAutorizacion: boolean
  /** desconfirmar estados y E.E.P.N. (sus números pueden cambiar) */
  desconfirmar: boolean
}

export function efectosCambioModo(
  antes: ConfigAnterior,
  despues: ConfigAnterior,
): EfectosCambioModo {
  const cambio =
    antes.modoAnterior !== despues.modoAnterior ||
    (antes.ejercicioAnteriorId ?? null) !== (despues.ejercicioAnteriorId ?? null)
  if (!cambio) {
    return { limpiarComparativosManuales: false, anularAutorizacion: false, desconfirmar: false }
  }
  return {
    limpiarComparativosManuales: despues.modoAnterior !== 'MANUAL',
    anularAutorizacion: true,
    desconfirmar: true,
  }
}
