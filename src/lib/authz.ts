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

export async function assertEjercicioBelongsToCurrentEstudio(ejercicioId: string): Promise<void> {
  if (!esUuid(ejercicioId)) throw unauthorized('No tenés permiso para modificar este ejercicio.')
  const estudioId = await getCurrentEstudioId()
  const ejercicio = await db.ejercicioContable.findFirst({
    where: { id: ejercicioId, estudioId },
    select: { id: true },
  })
  if (!ejercicio) {
    throw unauthorized('No tenés permiso para modificar este ejercicio.')
  }
}

export async function assertNotaBelongsToCurrentEstudio(notaId: string): Promise<void> {
  if (!esUuid(notaId)) throw unauthorized('No tenés permiso para modificar esta nota.')
  const estudioId = await getCurrentEstudioId()
  const nota = await db.notaEjercicio.findFirst({
    where: { id: notaId, ejercicio: { estudioId } },
    select: { id: true },
  })
  if (!nota) {
    throw unauthorized('No tenés permiso para modificar esta nota.')
  }
}

export async function assertDetalleNotaBelongsToCurrentEstudio(detalleId: string): Promise<void> {
  if (!esUuid(detalleId))
    throw unauthorized('No tenés permiso para modificar este detalle de nota.')
  const estudioId = await getCurrentEstudioId()
  const detalle = await db.detalleNota.findFirst({
    where: { id: detalleId, nota: { ejercicio: { estudioId } } },
    select: { id: true },
  })
  if (!detalle) {
    throw unauthorized('No tenés permiso para modificar este detalle de nota.')
  }
}
