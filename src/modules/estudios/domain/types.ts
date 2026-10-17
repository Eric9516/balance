import type { Estudio, TipoPersona } from '@prisma/client'

export type EstudioDTO = {
  id: string
  nombre: string
  cuit: string
  razonSocial: string
  tipoPersona: TipoPersona
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export function toEstudioDTO(e: Estudio): EstudioDTO {
  return {
    id: e.id,
    nombre: e.nombre,
    cuit: e.cuit,
    razonSocial: e.razonSocial,
    tipoPersona: e.tipoPersona,
    domicilio: e.domicilio,
    localidad: e.localidad,
    provincia: e.provincia,
    telefono: e.telefono,
    email: e.email,
    activo: e.activo,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}
