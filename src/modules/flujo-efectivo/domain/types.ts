import type {
  FlujoDeCajaEjercicio,
  FlujoDeCajaItem,
  OrigenLineaFlujo,
  SeccionFlujo,
} from '@prisma/client'
import { importe } from '@/lib/importe'

export type { OrigenLineaFlujo, SeccionFlujo }

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

/** La línea que calcula la app como la diferencia para que el estado cierre (pendiente de revisión). */
export const CONCEPTO_RECPAM =
  'Resultados financieros y por tenencia generados por el efectivo (incluye RECPAM)'

/**
 * Las líneas que arma la app: en qué sección van y con qué nombre. El nombre es fijo (el comparativo
 * de un ejercicio vinculado se busca por nombre). En la sección, van en este orden.
 */
export const LINEAS_DE_LA_APP: Record<
  OrigenLineaFlujo,
  { seccion: SeccionFlujo; concepto: string }
> = {
  COBROS_VENTAS: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Cobros por ventas de bienes y servicios',
  },
  PAGOS_PROVEEDORES: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Pagos a proveedores de bienes y servicios',
  },
  PAGOS_PERSONAL: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Pagos al personal y cargas sociales',
  },
  PAGOS_IMPUESTOS: { seccion: 'ACTIVIDADES_OPERATIVAS', concepto: 'Pagos de impuestos' },
  PAGOS_GANANCIAS: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Pagos de impuesto a las ganancias',
  },
  VARIACION_ACTIVOS: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Disminución (aumento) de activos operativos',
  },
  VARIACION_PASIVOS: {
    seccion: 'ACTIVIDADES_OPERATIVAS',
    concepto: 'Aumento (disminución) de pasivos operativos',
  },
  RECPAM: { seccion: 'ACTIVIDADES_OPERATIVAS', concepto: CONCEPTO_RECPAM },
  PAGOS_BIENES_USO: {
    seccion: 'ACTIVIDADES_INVERSION',
    concepto: 'Pagos por compras de bienes de uso',
  },
  COBROS_BIENES_USO: {
    seccion: 'ACTIVIDADES_INVERSION',
    concepto: 'Cobros por ventas de bienes de uso',
  },
  APORTES: { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Aportes de los propietarios' },
  PRESTAMOS_RECIBIDOS: { seccion: 'ACTIVIDADES_FINANCIAMIENTO', concepto: 'Préstamos obtenidos' },
  PRESTAMOS_CANCELADOS: {
    seccion: 'ACTIVIDADES_FINANCIAMIENTO',
    concepto: 'Cancelación de préstamos',
  },
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
    'Pagos de impuesto a las ganancias',
    'Pagos de intereses',
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
  /** null = la escribe el contador; un valor = la arma la app (ver LINEAS_DE_LA_APP). */
  origen: OrigenLineaFlujo | null
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
  /** El RECPAM que se dio por revisado (null: nunca). Si el RECPAM cambió, ya no coincide. */
  recpamRevisado: number | null
  /** Quién lo revisó (nombre) y cuándo. */
  recpamRevisadoPor: string | null
  recpamRevisadoEn: Date | null
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
    origen: i.origen,
  }
}

export function toFlujoGuardadoDTO(
  f: FlujoDeCajaEjercicio & { items: FlujoDeCajaItem[]; revisor?: { nombre: string } | null },
): FlujoGuardadoDTO {
  return {
    id: f.id,
    saldoInicial: importe(f.saldoInicial),
    modificacionesEjAnt: importe(f.modificacionesEjAnt),
    saldoFinal: importe(f.saldoFinal),
    saldoInicialAnterior: importe(f.saldoInicialAnterior),
    modificacionesEjAntAnt: importe(f.modificacionesEjAntAnt),
    saldoFinalAnterior: importe(f.saldoFinalAnterior),
    recpamRevisado: f.recpamRevisado === null ? null : importe(f.recpamRevisado),
    recpamRevisadoPor: f.revisor?.nombre ?? null,
    recpamRevisadoEn: f.recpamRevisadoEn,
    items: f.items
      .filter((i) => !i.esSubtotal)
      .sort((a, b) => a.orden - b.orden)
      .map(toFlujoItemDTO),
  }
}
