import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { toAuditorDTO, type AuditorDTO } from '../domain/types'
import type { CreateAuditorInput, UpdateAuditorInput } from '../schemas/auditor.schemas'

export async function findAuditoresByEstudio(estudioId: string): Promise<AuditorDTO[]> {
  const rows = await db.auditor.findMany({
    where: { estudioId },
    orderBy: [{ esDefault: 'desc' }, { apellido: 'asc' }, { nombre: 'asc' }],
  })
  return rows.map(toAuditorDTO)
}

export async function findAuditorById(id: string): Promise<AuditorDTO | null> {
  if (!esUuid(id)) return null
  const a = await db.auditor.findUnique({ where: { id } })
  return a ? toAuditorDTO(a) : null
}

export async function createAuditor(
  estudioId: string,
  input: CreateAuditorInput,
): Promise<AuditorDTO> {
  const data = {
    estudioId,
    ...input,
    tituloProfesional: input.tituloProfesional || null,
    matricula: input.matricula || null,
    consejoProfesional: input.consejoProfesional || null,
    universidad: input.universidad || null,
    localidadInforme: input.localidadInforme || null,
    textoFirma: input.textoFirma || null,
  }

  if (input.esDefault === true) {
    const a = await db.$transaction(async (tx) => {
      await tx.auditor.updateMany({ where: { estudioId }, data: { esDefault: false } })
      return tx.auditor.create({ data })
    })
    return toAuditorDTO(a)
  }

  const a = await db.auditor.create({ data })
  return toAuditorDTO(a)
}

/** Modifica un auditor solo si es de este estudio. Devuelve null si no lo encuentra. */
export async function updateAuditor(
  estudioId: string,
  id: string,
  input: UpdateAuditorInput,
): Promise<AuditorDTO | null> {
  if (!esUuid(id)) return null
  const existing = await db.auditor.findFirst({ where: { id, estudioId }, select: { id: true } })
  if (!existing) return null

  const data = {
    ...input,
    tituloProfesional: input.tituloProfesional || null,
    matricula: input.matricula || null,
    consejoProfesional: input.consejoProfesional || null,
    universidad: input.universidad || null,
    localidadInforme: input.localidadInforme || null,
    textoFirma: input.textoFirma || null,
  }

  if (input.esDefault === true) {
    const a = await db.$transaction(async (tx) => {
      await tx.auditor.updateMany({
        where: { estudioId, id: { not: id } },
        data: { esDefault: false },
      })
      return tx.auditor.update({ where: { id }, data })
    })
    return toAuditorDTO(a)
  }

  const a = await db.auditor.update({ where: { id }, data })
  return toAuditorDTO(a)
}

/** Activa o desactiva un auditor solo si es de este estudio. Devuelve si lo encontró. */
async function setActivo(estudioId: string, id: string, activo: boolean): Promise<boolean> {
  if (!esUuid(id)) return false
  const { count } = await db.auditor.updateMany({ where: { id, estudioId }, data: { activo } })
  return count > 0
}

export async function deactivateAuditor(estudioId: string, id: string): Promise<boolean> {
  return setActivo(estudioId, id, false)
}

export async function reactivateAuditor(estudioId: string, id: string): Promise<boolean> {
  return setActivo(estudioId, id, true)
}
