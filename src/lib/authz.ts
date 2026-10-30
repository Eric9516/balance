import { db } from '@/lib/db'
import { esUuid } from '@/lib/utils/uuid'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import type { AppError } from '@/modules/errores/types'

function unauthorized(message: string): AppError {
  return {
    tipo: 'AUTORIZACION',
    severidad: 'ALTO',
    codigo: 'AUTH-001',
    mensaje: message,
  }
}

/** Devuelve el estudio, para leer su catálogo sin otra consulta. */
export async function assertEjercicioBelongsToCurrentEstudio(ejercicioId: string): Promise<string> {
  if (!esUuid(ejercicioId)) throw unauthorized('No tenés permiso para modificar este ejercicio.')
  const estudioId = await getCurrentEstudioId()
  const ejercicio = await db.ejercicioContable.findFirst({
    where: { id: ejercicioId, estudioId },
    select: { id: true },
  })
  if (!ejercicio) {
    throw unauthorized('No tenés permiso para modificar este ejercicio.')
  }
  return estudioId
}
