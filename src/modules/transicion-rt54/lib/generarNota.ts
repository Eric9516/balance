/**
 * Generador del BORRADOR de la "Nota de Primera Aplicación de la RT 54".
 *
 * Produce texto por párrafos y dos conciliaciones (patrimonio neto al inicio y
 * resultado del ejercicio anterior) a partir de la tabla de ajustes de transición.
 * La IA/automatización no decide importes: todo sale de lo que cargó el contador y
 * el texto es un borrador a revisar antes de emitir. Puro: no toca la base.
 */

import type { CategoriaEnteRT54 } from '@prisma/client'
import { formatFecha } from '@/lib/utils/dates'
import { CATEGORIA_ENTE_LABELS } from '@/modules/ejercicios/domain/types'
import { COMPONENTE_PN_LABELS, type AjusteTransicionDTO } from '../domain/types'

export type FilaConciliacion = {
  concepto: string
  importe: number
  /** fila base (según normas anteriores) */
  esBase?: boolean
  /** fila total (según RT 54) */
  esTotal?: boolean
}

export type ReclasificacionNota = {
  concepto: string
  origen: string
  destino: string
  importe: number
}

export type NotaTransicionGenerada = {
  titulo: string
  parrafos: string[]
  conciliacionPN: FilaConciliacion[]
  conciliacionResultado: FilaConciliacion[]
  reclasificaciones: ReclasificacionNota[]
  advertencias: string[]
}

export type ContextoNotaTransicion = {
  razonSocial: string
  fechaInicio: Date
  fechaCierre: Date
  fechaCierreAnterior: Date | null
  categoriaEnte: CategoriaEnteRT54 | null
  /** PN al cierre del ejercicio anterior según normas contables anteriores */
  pnAnteriorSegunNormasPrevias: number
  /** resultado del ejercicio anterior según normas contables anteriores */
  resultadoAnteriorSegunNormasPrevias: number
  ajustes: AjusteTransicionDTO[]
  /** total de la fila "Modificación de saldos al inicio" del E.E.P.N. actual (null = sin E.E.P.N.) */
  modificacionInicioEEPN: number | null
}

const TOLERANCIA = 0.005

export function generarNotaTransicionRT54(ctx: ContextoNotaTransicion): NotaTransicionGenerada {
  const fechaTransicion = ctx.fechaCierreAnterior ?? ctx.fechaInicio
  const ajustesMedicion = ctx.ajustes.filter((a) => a.tipo === 'AJUSTE_MEDICION')
  const reclasificaciones = ctx.ajustes.filter((a) => a.tipo === 'RECLASIFICACION')

  // ── Conciliaciones ────────────────────────────────────────────────────────
  const conciliacionPN: FilaConciliacion[] = [
    {
      concepto: `Patrimonio neto al ${formatFecha(fechaTransicion)} según normas contables anteriores`,
      importe: ctx.pnAnteriorSegunNormasPrevias,
      esBase: true,
    },
    ...ajustesMedicion.map((a) => ({
      concepto: a.componentePN
        ? `${a.concepto} (${COMPONENTE_PN_LABELS[a.componentePN]})`
        : a.concepto,
      importe: a.importePN,
    })),
  ]
  const totalPN = conciliacionPN.reduce((acc, f) => acc + f.importe, 0)
  conciliacionPN.push({
    concepto: `Patrimonio neto al ${formatFecha(fechaTransicion)} según RT 54`,
    importe: totalPN,
    esTotal: true,
  })

  const conciliacionResultado: FilaConciliacion[] = [
    {
      concepto: 'Resultado del ejercicio anterior según normas contables anteriores',
      importe: ctx.resultadoAnteriorSegunNormasPrevias,
      esBase: true,
    },
    ...ajustesMedicion
      .filter((a) => Math.abs(a.importeResultadoAnterior) > TOLERANCIA)
      .map((a) => ({ concepto: a.concepto, importe: a.importeResultadoAnterior })),
  ]
  const totalResultado = conciliacionResultado.reduce((acc, f) => acc + f.importe, 0)
  conciliacionResultado.push({
    concepto: 'Resultado del ejercicio anterior según RT 54',
    importe: totalResultado,
    esTotal: true,
  })

  const reclasNota: ReclasificacionNota[] = reclasificaciones.map((a) => ({
    concepto: a.concepto,
    origen: a.rubroOrigen ?? '',
    destino: a.rubroDestino ?? '',
    importe: a.importeReclasificado,
  }))

  // ── Texto ─────────────────────────────────────────────────────────────────
  const parrafos: string[] = []
  parrafos.push(
    `${ctx.razonSocial} aplica por primera vez en el ejercicio finalizado el ${formatFecha(ctx.fechaCierre)} la Resolución Técnica N° 54 de la Federación Argentina de Consejos Profesionales de Ciencias Económicas (Norma Unificada Argentina de Contabilidad). La fecha de transición es el ${formatFecha(fechaTransicion)}.`,
  )
  parrafos.push(
    ctx.categoriaEnte
      ? `A los efectos de la norma, la entidad se encuadra como "${CATEGORIA_ENTE_LABELS[ctx.categoriaEnte]}" y aplica las opciones y simplificaciones previstas para esa categoría.`
      : 'A los efectos de la norma, la entidad se encuadra como [completar categoría del ente: pequeña, mediana o restante].',
  )
  const sinEfectos = ajustesMedicion.length === 0
  if (sinEfectos) {
    parrafos.push(
      'La adopción de la norma no produjo efectos sobre el patrimonio neto al inicio del ejercicio ni sobre el resultado del ejercicio anterior. Las cifras comparativas se presentan adecuadas a los criterios de exposición de la RT 54.',
    )
  } else {
    parrafos.push(
      'Las cifras comparativas del ejercicio anterior fueron adecuadas a los criterios de medición y exposición de la RT 54 a fin de que resulten comparables. Los efectos de la transición sobre el patrimonio neto al inicio y sobre el resultado del ejercicio anterior se exponen en las conciliaciones siguientes.',
    )
  }
  if (reclasNota.length > 0) {
    const detalle = reclasNota
      .map((r) =>
        r.origen && r.destino ? `${r.concepto} (de "${r.origen}" a "${r.destino}")` : r.concepto,
      )
      .join('; ')
    parrafos.push(
      `Adicionalmente, se efectuaron las siguientes reclasificaciones de exposición, sin efecto sobre el patrimonio neto ni sobre el resultado: ${detalle}.`,
    )
  }

  // ── Advertencias de control ───────────────────────────────────────────────
  const advertencias: string[] = [
    'Borrador generado automáticamente a partir de los ajustes cargados. Debe ser revisado y completado por el profesional antes de su emisión.',
  ]
  if (ctx.modificacionInicioEEPN != null) {
    const suma = ajustesMedicion.reduce((acc, a) => acc + a.importePN, 0)
    if (Math.abs(suma - ctx.modificacionInicioEEPN) > TOLERANCIA) {
      advertencias.push(
        `La suma de los ajustes de medición (${suma.toFixed(2)}) no coincide con la fila "Modificación de saldos al inicio" del E.E.P.N. (${ctx.modificacionInicioEEPN.toFixed(2)}).`,
      )
    }
  }
  if (!ctx.categoriaEnte) {
    advertencias.push('Falta definir la categoría del ente en el ejercicio.')
  }

  return {
    titulo: 'Primera aplicación de la Resolución Técnica N° 54',
    parrafos,
    conciliacionPN,
    conciliacionResultado,
    reclasificaciones: reclasNota,
    advertencias,
  }
}
