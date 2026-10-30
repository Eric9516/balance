import { db } from '@/lib/db'
import { toEstudioDTO, type EstudioDTO } from '../domain/types'
import type { UpdateEstudioInput } from '../schemas/estudio.schemas'
import { normalizarCuit } from '@/lib/utils/cuit'

export async function findEstudioById(id: string): Promise<EstudioDTO | null> {
  const e = await db.estudio.findUnique({ where: { id } })
  return e ? toEstudioDTO(e) : null
}

export async function updateEstudio(id: string, input: UpdateEstudioInput): Promise<EstudioDTO> {
  const e = await db.estudio.update({
    where: { id },
    data: {
      ...input,
      cuit: normalizarCuit(input.cuit),
      domicilio: input.domicilio || null,
      localidad: input.localidad || null,
      provincia: input.provincia || null,
      telefono: input.telefono || null,
      email: input.email || null,
    },
  })
  return toEstudioDTO(e)
}
