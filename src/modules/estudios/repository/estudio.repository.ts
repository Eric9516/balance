import { db } from '@/lib/db'
import { comoPlataforma, conEstudio } from '@/lib/contexto-base'
import { toEstudioDTO, type EstudioDTO } from '../domain/types'
import type { CreateEstudioInput, UpdateEstudioInput } from '../schemas/estudio.schemas'
import { normalizarCuit } from '@/lib/utils/cuit'

export async function findEstudioById(id: string): Promise<EstudioDTO | null> {
  const e = await db.estudio.findUnique({ where: { id } })
  return e ? toEstudioDTO(e) : null
}

/**
 * Si la base ya tiene algún estudio, de cualquiera (es un dato de toda la plataforma): el alta del
 * estudio desde la pantalla de inicio se hace una sola vez.
 */
export async function hayEstudios(): Promise<boolean> {
  const e = await comoPlataforma(() => db.estudio.findFirst({ select: { id: true } }))
  return e !== null
}

/**
 * El estudio nuevo se crea declarando su propio id: la base solo deja escribir filas del estudio
 * de la sesión, también al estudio y a su catálogo (que le copia un disparador).
 */
export async function createEstudio(input: CreateEstudioInput): Promise<EstudioDTO> {
  const [nuevo] = await db.$queryRaw<{ id: string }[]>`SELECT public.uuidv7() AS id`
  if (!nuevo) throw new Error('La base no generó el identificador del estudio.')
  const e = await conEstudio(nuevo.id, () =>
    db.estudio.create({
      data: {
        id: nuevo.id,
        ...input,
        cuit: normalizarCuit(input.cuit),
        domicilio: input.domicilio || null,
        localidad: input.localidad || null,
        provincia: input.provincia || null,
        telefono: input.telefono || null,
        email: input.email || null,
      },
    }),
  )
  return toEstudioDTO(e)
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
