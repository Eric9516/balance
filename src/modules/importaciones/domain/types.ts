import type { CuentaContable, ImportacionExcel, EstadoImportacion } from '@prisma/client'
import { importe } from '@/lib/importe'

// ─── Cuenta contable ──────────────────────────────────────────────────────────

export type CuentaContableDTO = {
  id: string
  ejercicioId: string
  codigo: string
  nombre: string
  saldoDeudor: number
  saldoAcreedor: number
  saldoFinal: number
  rubroBaseId: string | null
  rubroNombre: string | null
  notaEjercicioId: string | null
  clasificadaManual: boolean
  createdAt: Date
}

type WithRubro = CuentaContable & {
  rubroBase?: { nombre: string } | null
}

export function toCuentaDTO(c: WithRubro): CuentaContableDTO {
  return {
    id: c.id,
    ejercicioId: c.ejercicioId,
    codigo: c.codigo,
    nombre: c.nombre,
    saldoDeudor: importe(c.saldoDeudor),
    saldoAcreedor: importe(c.saldoAcreedor),
    saldoFinal: importe(c.saldoFinal),
    rubroBaseId: c.rubroBaseId,
    rubroNombre: c.rubroBase?.nombre ?? null,
    notaEjercicioId: c.notaEjercicioId,
    clasificadaManual: c.clasificadaManual,
    createdAt: c.createdAt,
  }
}

// ─── Importación ─────────────────────────────────────────────────────────────

export type ImportacionDTO = {
  id: string
  ejercicioId: string
  nombreArchivo: string
  estado: EstadoImportacion
  totalFilas: number | null
  filasImportadas: number | null
  filasError: number | null
  createdAt: Date
}

export function toImportacionDTO(i: ImportacionExcel): ImportacionDTO {
  return {
    id: i.id,
    ejercicioId: i.ejercicioId,
    nombreArchivo: i.nombreArchivo,
    estado: i.estado,
    totalFilas: i.totalFilas,
    filasImportadas: i.filasImportadas,
    filasError: i.filasError,
    createdAt: i.createdAt,
  }
}

// ─── Rubro simple (para clasificación) ───────────────────────────────────────

export type RubroBaseSimple = {
  id: string
  codigo: string
  nombre: string
  estadoDestino: 'SSP' | 'EERR' | 'PN'
  seccionSSP: string | null
  seccionEERR: string | null
  naturalezaEsperada: 'DEUDORA' | 'ACREEDORA'
  orden: number
  generaNotaInformativa: boolean
  textoNotaDefault: string | null
  rubroGrupoNombre: string | null
  rubroGrupoEsGasto: boolean
  /** Efectivo y equivalentes (Estado de Flujo de Efectivo). */
  esEfectivo: boolean
}

// ─── Resultado de importación ─────────────────────────────────────────────────

export type ResultadoImportacion = {
  importacionId: string
  importadas: number
  errores: number
  total: number
}
