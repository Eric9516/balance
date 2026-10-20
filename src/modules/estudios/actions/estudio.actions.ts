'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import {
  CreateEstudioSchema,
  UpdateEstudioSchema,
  type CreateEstudioInput,
  type UpdateEstudioInput,
} from '../schemas/estudio.schemas'
import { createEstudio, updateEstudio } from '../repository/estudio.repository'
import type { EstudioDTO } from '../domain/types'

export async function crearEstudio(input: CreateEstudioInput): Promise<ActionResult<EstudioDTO>> {
  try {
    const parsed = CreateEstudioSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
        campo: parsed.error.issues[0]?.path.join('.'),
      })
    }
    const estudio = await createEstudio(parsed.data)
    revalidatePath('/configuracion')
    return actionOk(estudio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'estudios', operacion: 'crear' }))
  }
}

export async function actualizarEstudio(
  id: string,
  input: UpdateEstudioInput,
): Promise<ActionResult<EstudioDTO>> {
  try {
    const parsed = UpdateEstudioSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
        campo: parsed.error.issues[0]?.path.join('.'),
      })
    }
    // Solo se modifica el estudio actual: el identificador viene de la pantalla.
    if (id !== (await getCurrentEstudioId())) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Estudio no encontrado. Recargá la página y volvé a intentar.',
      })
    }
    const estudio = await updateEstudio(id, parsed.data)
    revalidatePath('/configuracion')
    return actionOk(estudio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'estudios', operacion: 'actualizar' }))
  }
}
