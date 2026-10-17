import type { RubroBase } from '@prisma/client'

export type RubroBaseDTO = {
  id: string
  rubroGrupoId: string | null
  rubroGrupoNombre: string | null
  codigo: string
  nombre: string
  estadoDestino: 'SSP' | 'EERR' | 'PN'
  seccionSSP: string | null
  seccionEERR: string | null
  naturalezaEsperada: 'DEUDORA' | 'ACREEDORA'
  orden: number
  activo: boolean
}

type RubroBaseWithGrupo = RubroBase & { rubroGrupo?: { nombre: string; estadoDestino: string | null; seccionSSP: string | null; seccionEERR: string | null } | null }

export function toRubroBaseDTO(r: RubroBaseWithGrupo): RubroBaseDTO {
  return {
    id: r.id,
    rubroGrupoId: r.rubroGrupoId,
    rubroGrupoNombre: r.rubroGrupo?.nombre ?? null,
    codigo: r.codigo,
    nombre: r.nombre,
    estadoDestino: (r.estadoDestino ?? 'SSP') as 'SSP' | 'EERR' | 'PN',
    seccionSSP: r.seccionSSP,
    seccionEERR: r.seccionEERR,
    naturalezaEsperada: r.naturalezaEsperada as 'DEUDORA' | 'ACREEDORA',
    orden: r.orden,
    activo: r.activo,
  }
}

export const SECCION_SSP_LABELS: Record<string, string> = {
  ACTIVO_CORRIENTE: 'Activo Corriente',
  ACTIVO_NO_CORRIENTE: 'Activo No Corriente',
  PASIVO_CORRIENTE: 'Pasivo Corriente',
  PASIVO_NO_CORRIENTE: 'Pasivo No Corriente',
  PATRIMONIO_NETO: 'Patrimonio Neto',
}

export const SECCION_EERR_LABELS: Record<string, string> = {
  INGRESOS: 'Ingresos',
  COSTO_VENTAS: 'Costo de Ventas',
  GASTOS_ADM: 'Gastos de Administración',
  GASTOS_COM: 'Gastos de Comercialización',
  GASTOS_BANCARIOS: 'Gastos Bancarios',
  IMPUESTOS_CONTRIBUCIONES: 'Impuestos y Contribuciones',
  RESULTADOS_FINANCIEROS: 'Resultados Financieros',
  IMPUESTO_GANANCIAS: 'Impuesto a las Ganancias',
}

export function getSeccionLabel(r: RubroBaseDTO): string {
  if (r.seccionSSP) return SECCION_SSP_LABELS[r.seccionSSP] ?? r.seccionSSP
  if (r.seccionEERR) return SECCION_EERR_LABELS[r.seccionEERR] ?? r.seccionEERR
  return '—'
}
