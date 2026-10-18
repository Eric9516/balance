import { cache } from 'react'
import { db } from '@/lib/db'
import { normalizarCuit } from '@/lib/utils/cuit'
import { CATEGORIA_ENTE_LABELS } from '@/modules/ejercicios/domain/types'
import { toSociedadDTO, type SociedadDTO } from '../domain/types'
import type { CreateSociedadInput, UpdateSociedadInput } from '../schemas/sociedad.schemas'

function buildData(input: CreateSociedadInput) {
  return {
    ...input,
    cuit: normalizarCuit(input.cuit),
    tipoSocietario: input.tipoSocietario || null,
    condicionFiscal: input.condicionFiscal || null,
    domicilioLegal: input.domicilioLegal || null,
    localidad: input.localidad || null,
    provincia: input.provincia || null,
    codigoPostal: input.codigoPostal || null,
    actividadPpal: input.actividadPpal || null,
    actividadSecundaria: input.actividadSecundaria || null,
    categoriaEnte: input.categoriaEnte,
    // Texto legacy: se mantiene sincronizado con el enum para lectores que aún lo usan.
    clasificacionRT54: CATEGORIA_ENTE_LABELS[input.categoriaEnte],
    fechaInscripcion: input.fechaInscripcion ? new Date(input.fechaInscripcion) : null,
    matriculaPJ: input.matriculaPJ || null,
    plazoDuracion: input.plazoDuracion ? new Date(input.plazoDuracion) : null,
    composicionCapital: input.composicionCapital || null,
  }
}

export async function findSociedadesByEstudio(estudioId: string): Promise<SociedadDTO[]> {
  const rows = await db.sociedad.findMany({
    where: { estudioId },
    orderBy: { razonSocial: 'asc' },
  })
  return rows.map(toSociedadDTO)
}

/** Memoizado por request (React cache). */
export const findSociedadById = cache(async (id: string): Promise<SociedadDTO | null> => {
  const s = await db.sociedad.findUnique({ where: { id } })
  return s ? toSociedadDTO(s) : null
})

export async function createSociedad(
  estudioId: string,
  input: CreateSociedadInput,
): Promise<SociedadDTO> {
  const s = await db.sociedad.create({ data: { estudioId, ...buildData(input) } })
  return toSociedadDTO(s)
}

export async function updateSociedad(id: string, input: UpdateSociedadInput): Promise<SociedadDTO> {
  const s = await db.sociedad.update({ where: { id }, data: buildData(input) })
  return toSociedadDTO(s)
}

export async function deactivateSociedad(id: string): Promise<void> {
  await db.sociedad.update({ where: { id }, data: { activo: false } })
}

export async function reactivateSociedad(id: string): Promise<void> {
  await db.sociedad.update({ where: { id }, data: { activo: true } })
}
