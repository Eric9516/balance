/**
 * Preferencias de visualización por estudio: la densidad de las tablas de trabajo. Puro: valores
 * por defecto y textos.
 *
 * El color de la app es el mismo para todos los estudios (decisión del dueño del producto,
 * 2026-11-05): está en app/globals.css (--acento) y no se configura. El formato del Anexo de Bienes
 * de Uso se elige en cada balance (paso Bienes de Uso → Apariencia).
 */

import type { DensidadTablas } from '@prisma/client'

export type { DensidadTablas }

export const DENSIDAD_DEFAULT: DensidadTablas = 'COMODA'

export type PreferenciasEstudio = {
  densidadTablas: DensidadTablas
}

export const PREFERENCIAS_DEFAULT: PreferenciasEstudio = {
  densidadTablas: DENSIDAD_DEFAULT,
}

export const DENSIDAD_LABELS: Record<DensidadTablas, string> = {
  COMODA: 'Cómoda',
  COMPACTA: 'Compacta',
}
