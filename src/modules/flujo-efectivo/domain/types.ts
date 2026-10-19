import type { FlujoDeCajaEjercicio, FlujoDeCajaItem, SeccionFlujo } from '@prisma/client'
import { importe } from '@/lib/importe'

export type { SeccionFlujo }

export const SECCIONES_FLUJO: readonly SeccionFlujo[] = [
  'ACTIVIDADES_OPERATIVAS',
  'ACTIVIDADES_INVERSION',
  'ACTIVIDADES_FINANCIAMIENTO',
] as const

export const SECCION_FLUJO_LABELS: Record<SeccionFlujo, string> = {
  ACTIVIDADES_OPERATIVAS: 'Actividades operativas',
  ACTIVIDADES_INVERSION: 'Actividades de inversión',
  ACTIVIDADES_FINANCIAMIENTO: 'Actividades de financiación',
}

/** Textos fijos del bloque "Variaciones del efectivo" y de los totales. */
export const TEXTOS_FLUJO = {
  variaciones: 'Variaciones del efectivo',
  efectivoInicio: 'Efectivo al inicio del ejercicio',
  modificaciones: 'Modificación de ejercicios anteriores',
  efectivoInicioModificado: 'Efectivo modificado al inicio del ejercicio',
  efectivoCierre: 'Efectivo al cierre del ejercicio',
  variacionNeta: 'Aumento (disminución) neta del efectivo',
  causas: 'Causas de las variaciones del efectivo',
} as const

/** Texto del subtotal de cada sección, como se expone en el estado. */
export const SECCION_FLUJO_SUBTOTAL: Record<SeccionFlujo, string> = {
  ACTIVIDADES_OPERATIVAS:
    'Flujo neto de efectivo generado por (utilizado en) las actividades operativas',
  ACTIVIDADES_INVERSION:
    'Flujo neto de efectivo generado por (utilizado en) las actividades de inversión',
  ACTIVIDADES_FINANCIAMIENTO:
    'Flujo neto de efectivo generado por (utilizado en) las actividades de financiación',
}

/**
 * Conceptos habituales del método directo. Son sugerencias: el contador decide
 * cuáles usa y con qué importes. Signo: positivo = ingreso de efectivo, negativo = egreso.
 */
export const CONCEPTOS_SUGERIDOS: Record<SeccionFlujo, string[]> = {
  ACTIVIDADES_OPERATIVAS: [
    'Cobros por ventas de bienes y servicios',
    'Pagos a proveedores de bienes y servicios',
    'Pagos al personal y cargas sociales',
    'Pagos de impuestos',
    'Pagos de intereses',
    'Resultados financieros y por tenencia generados por el efectivo (incluye RECPAM)',
  ],
  ACTIVIDADES_INVERSION: [
    'Pagos por compras de bienes de uso',
    'Cobros por ventas de bienes de uso',
    'Pagos por compras de inversiones',
  ],
  ACTIVIDADES_FINANCIAMIENTO: [
    'Aportes de los propietarios',
    'Pago de dividendos',
    'Préstamos obtenidos',
    'Cancelación de préstamos',
  ],
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type FlujoItemDTO = {
  id: string
  seccion: SeccionFlujo
  concepto: string
  importe: number
  importeAnterior: number
  orden: number
}

/** Lo que está guardado en la base (cabecera + ítems). */
export type FlujoGuardadoDTO = {
  id: string
  saldoInicial: number
  modificacionesEjAnt: number
  saldoFinal: number
  saldoInicialAnterior: number
  modificacionesEjAntAnt: number
  saldoFinalAnterior: number
  items: FlujoItemDTO[]
}

export function toFlujoItemDTO(i: FlujoDeCajaItem): FlujoItemDTO {
  return {
    id: i.id,
    seccion: i.seccion,
    concepto: i.concepto,
    importe: importe(i.importe),
    importeAnterior: importe(i.importeAnterior),
    orden: i.orden,
  }
}

export function toFlujoGuardadoDTO(
  f: FlujoDeCajaEjercicio & { items: FlujoDeCajaItem[] },
): FlujoGuardadoDTO {
  return {
    id: f.id,
    saldoInicial: importe(f.saldoInicial),
    modificacionesEjAnt: importe(f.modificacionesEjAnt),
    saldoFinal: importe(f.saldoFinal),
    saldoInicialAnterior: importe(f.saldoInicialAnterior),
    modificacionesEjAntAnt: importe(f.modificacionesEjAntAnt),
    saldoFinalAnterior: importe(f.saldoFinalAnterior),
    items: f.items
      .filter((i) => !i.esSubtotal)
      .sort((a, b) => a.orden - b.orden)
      .map(toFlujoItemDTO),
  }
}
