import type { SeccionEERR, SeccionSSP } from '@prisma/client'

// Fuente ÚNICA de las secciones de los estados contables y sus etiquetas.
// `satisfies Record<Enum, string>` obliga a cubrir todo el enum de Prisma:
// si se agrega una sección al schema, esto deja de compilar hasta etiquetarla.

export const SECCION_SSP_LABELS = {
  ACTIVO_CORRIENTE: 'Activo Corriente',
  ACTIVO_NO_CORRIENTE: 'Activo No Corriente',
  PASIVO_CORRIENTE: 'Pasivo Corriente',
  PASIVO_NO_CORRIENTE: 'Pasivo No Corriente',
  PATRIMONIO_NETO: 'Patrimonio Neto',
} as const satisfies Record<SeccionSSP, string>

export const SECCION_EERR_LABELS = {
  INGRESOS: 'Ingresos',
  COSTO_VENTAS: 'Costo de Ventas',
  GASTOS_ADM: 'Gastos de Administración',
  GASTOS_COM: 'Gastos de Comercialización',
  GASTOS_BANCARIOS: 'Gastos Bancarios',
  IMPUESTOS_CONTRIBUCIONES: 'Impuestos y Contribuciones',
  RESULTADOS_FINANCIEROS: 'Resultados Financieros',
  IMPUESTO_GANANCIAS: 'Impuesto a las Ganancias',
} as const satisfies Record<SeccionEERR, string>

export const SECCIONES_SSP = Object.keys(SECCION_SSP_LABELS) as [SeccionSSP, ...SeccionSSP[]]
export const SECCIONES_EERR = Object.keys(SECCION_EERR_LABELS) as [SeccionEERR, ...SeccionEERR[]]

/** Secciones EERR predefinidas que se muestran como columnas del Anexo III (gastos). */
export const SECCIONES_EERR_GASTO = [
  'GASTOS_ADM',
  'GASTOS_COM',
  'GASTOS_BANCARIOS',
  'IMPUESTOS_CONTRIBUCIONES',
] as const satisfies readonly SeccionEERR[]

export function esSeccionSSP(valor: string | null | undefined): valor is SeccionSSP {
  return !!valor && valor in SECCION_SSP_LABELS
}

export function esSeccionEERR(valor: string | null | undefined): valor is SeccionEERR {
  return !!valor && valor in SECCION_EERR_LABELS
}

/** Etiqueta legible de una sección SSP o EERR; si no se reconoce, devuelve el valor tal cual. */
export function labelSeccion(valor: string): string {
  if (esSeccionSSP(valor)) return SECCION_SSP_LABELS[valor]
  if (esSeccionEERR(valor)) return SECCION_EERR_LABELS[valor]
  return valor
}

/** Opciones `{ value, label }` para un `<select>`. */
export function opcionesSeccion<K extends string>(labels: Record<K, string>) {
  return (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }))
}
