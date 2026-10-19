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

export async function updateAuditor(id: string, input: UpdateAuditorInput): Promise<AuditorDTO> {
  const existing = await db.auditor.findUniqueOrThrow({
    where: { id },
    select: { estudioId: true },
  })

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
        where: { estudioId: existing.estudioId, id: { not: id } },
        data: { esDefault: false },
      })
      return tx.auditor.update({ where: { id }, data })
    })
    return toAuditorDTO(a)
  }

  const a = await db.auditor.update({ where: { id }, data })
  return toAuditorDTO(a)
}

export async function deactivateAuditor(id: string): Promise<void> {
  await db.auditor.update({ where: { id }, data: { activo: false } })
}

export async function reactivateAuditor(id: string): Promise<void> {
  await db.auditor.update({ where: { id }, data: { activo: true } })
}
