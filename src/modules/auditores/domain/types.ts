import type { Auditor } from '@prisma/client'

export type AuditorDTO = {
  id: string
  nombre: string
  apellido: string
  nombreCompleto: string
  tituloProfesional: string | null
  matricula: string | null
  consejoProfesional: string | null
  universidad: string | null
  localidadInforme: string | null
  textoFirma: string | null
  esDefault: boolean
  activo: boolean
  createdAt: Date
}

export function toAuditorDTO(a: Auditor): AuditorDTO {
  return {
    id: a.id,
    nombre: a.nombre,
    apellido: a.apellido,
    nombreCompleto: `${a.apellido}, ${a.nombre}`,
    tituloProfesional: a.tituloProfesional,
    matricula: a.matricula,
    consejoProfesional: a.consejoProfesional,
    universidad: a.universidad,
    localidadInforme: a.localidadInforme,
    textoFirma: a.textoFirma,
    esDefault: a.esDefault,
    activo: a.activo,
    createdAt: a.createdAt,
  }
}
