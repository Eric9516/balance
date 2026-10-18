import type { Sociedad, TipoPersona, CategoriaEnteRT54 } from '@prisma/client'

export type SociedadDTO = {
  id: string
  estudioId: string
  razonSocial: string
  cuit: string
  tipoPersona: TipoPersona
  tipoSocietario: string | null
  condicionFiscal: string | null
  domicilioLegal: string | null
  localidad: string | null
  provincia: string | null
  codigoPostal: string | null
  actividadPpal: string | null
  actividadSecundaria: string | null
  clasificacionRT54: string | null
  categoriaEnte: CategoriaEnteRT54 | null
  fechaInscripcion: Date | null
  matriculaPJ: string | null
  plazoDuracion: Date | null
  composicionCapital: string | null
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export const TIPO_PERSONA_LABELS: Record<TipoPersona, string> = {
  JURIDICA: 'Persona jurídica',
  FISICA: 'Persona física',
}

export function toSociedadDTO(s: Sociedad): SociedadDTO {
  return {
    id: s.id,
    estudioId: s.estudioId,
    razonSocial: s.razonSocial,
    cuit: s.cuit,
    tipoPersona: s.tipoPersona,
    tipoSocietario: s.tipoSocietario,
    condicionFiscal: s.condicionFiscal,
    domicilioLegal: s.domicilioLegal,
    localidad: s.localidad,
    provincia: s.provincia,
    codigoPostal: s.codigoPostal,
    actividadPpal: s.actividadPpal,
    actividadSecundaria: s.actividadSecundaria,
    clasificacionRT54: s.clasificacionRT54,
    categoriaEnte: s.categoriaEnte ?? null,
    fechaInscripcion: s.fechaInscripcion,
    matriculaPJ: s.matriculaPJ,
    plazoDuracion: s.plazoDuracion,
    composicionCapital: s.composicionCapital,
    activo: s.activo,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}
