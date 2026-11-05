/**
 * Preferencias de visualización por estudio: densidad de las tablas y formato del Anexo de
 * Bienes de Uso en el documento. Puro: valores por defecto y textos.
 *
 * El color de la app es el mismo para todos los estudios (decisión del dueño del producto,
 * 2026-11-05): está en app/globals.css (--acento) y no se configura.
 */

import type { DensidadTablas, FormatoAnexoBienesUso } from '@prisma/client'

export type { DensidadTablas, FormatoAnexoBienesUso }

export const DENSIDAD_DEFAULT: DensidadTablas = 'COMODA'
/** El formato tradicional: valor de origen, amortizaciones y netos en la misma fila. */
export const ANEXO_BIENES_USO_DEFAULT: FormatoAnexoBienesUso = 'UN_CUADRO'

export type PreferenciasEstudio = {
  densidadTablas: DensidadTablas
  /** Cómo se dibuja el Anexo de Bienes de Uso en el documento (los mismos números). */
  anexoBienesUso: FormatoAnexoBienesUso
}

export const PREFERENCIAS_DEFAULT: PreferenciasEstudio = {
  densidadTablas: DENSIDAD_DEFAULT,
  anexoBienesUso: ANEXO_BIENES_USO_DEFAULT,
}

export const DENSIDAD_LABELS: Record<DensidadTablas, string> = {
  COMODA: 'Cómoda',
  COMPACTA: 'Compacta',
}
