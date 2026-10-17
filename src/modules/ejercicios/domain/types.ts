import type { EjercicioContable, EstadoEjercicio, AdopcionRT54, CriteriosBienesCambio, NivelComparativoSSP } from '@prisma/client'

export type EjercicioContableDTO = {
  id: string
  estudioId: string
  sociedadId: string
  auditorId: string | null
  auditorNombre: string | null
  ejercicioAnteriorId: string | null
  numeroEjercicio: number | null
  fechaInicio: Date
  fechaCierre: Date
  fechaInformeAuditor: Date | null
  denominacion: string
  estado: EstadoEjercicio
  clasificacionEntidad: string | null
  indiceInflacionAnterior: number | null
  indiceInflacionActual: number | null
  // Configuración Nota I
  adopcionRT54: AdopcionRT54 | null
  criteriosBienesCambio: CriteriosBienesCambio | null
  hechosPosterioress: boolean | null
  hechosPosterioressTexto: string | null
  pnConfirmado: boolean
  estadosConfirmado: boolean
  // Balance anterior
  balanceAnteriorDisponible: boolean
  nivelComparativoSSP: NivelComparativoSSP | null
  createdAt: Date
  updatedAt: Date
}

export const ESTADO_LABELS: Record<EstadoEjercicio, string> = {
  BORRADOR: 'Borrador',
  EN_PROCESO: 'En proceso',
  REVISION: 'En revisión',
  CERRADO: 'Cerrado',
}

export const ESTADO_BADGE_VARIANTS: Record<EstadoEjercicio, 'borrador' | 'proceso' | 'revision' | 'cerrado'> = {
  BORRADOR: 'borrador',
  EN_PROCESO: 'proceso',
  REVISION: 'revision',
  CERRADO: 'cerrado',
}

export const CLASIFICACION_ENTIDAD_OPTIONS = [
  'Entidad pequeña',
  'PyME pequeña',
  'PyME mediana',
  'Otra entidad',
]

type WithAuditor = EjercicioContable & {
  auditor?: { nombre: string; apellido: string } | null
}

export function toEjercicioDTO(e: WithAuditor): EjercicioContableDTO {
  return {
    id: e.id,
    estudioId: e.estudioId,
    sociedadId: e.sociedadId,
    auditorId: e.auditorId,
    auditorNombre: e.auditor ? `${e.auditor.apellido}, ${e.auditor.nombre}` : null,
    ejercicioAnteriorId: e.ejercicioAnteriorId,
    numeroEjercicio: e.numeroEjercicio,
    fechaInicio: e.fechaInicio,
    fechaCierre: e.fechaCierre,
    fechaInformeAuditor: e.fechaInformeAuditor,
    denominacion: e.denominacion,
    estado: e.estado,
    clasificacionEntidad: e.clasificacionEntidad,
    indiceInflacionAnterior: e.indiceInflacionAnterior != null ? Number(e.indiceInflacionAnterior) : null,
    indiceInflacionActual: e.indiceInflacionActual != null ? Number(e.indiceInflacionActual) : null,
    adopcionRT54: e.adopcionRT54,
    criteriosBienesCambio: e.criteriosBienesCambio,
    hechosPosterioress: e.hechosPosterioress,
    hechosPosterioressTexto: e.hechosPosterioressTexto,
    pnConfirmado: e.pnConfirmado ?? false,
    estadosConfirmado: e.estadosConfirmado ?? false,
    balanceAnteriorDisponible: e.balanceAnteriorDisponible ?? true,
    nivelComparativoSSP: e.nivelComparativoSSP ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}
