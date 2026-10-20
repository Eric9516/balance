'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult, AppError } from '@/modules/errores/types'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import {
  CreateSociedadSchema,
  UpdateSociedadSchema,
  type CreateSociedadInput,
  type UpdateSociedadInput,
} from '../schemas/sociedad.schemas'
import {
  createSociedad,
  updateSociedad,
  deactivateSociedad,
  reactivateSociedad,
  findSociedadById,
} from '../repository/sociedad.repository'
import type { SociedadDTO } from '../domain/types'

const SOCIEDAD_NO_ENCONTRADA: AppError = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'Sociedad no encontrada en este estudio. Recargá la página y volvé a intentar.',
}

export async function crearSociedad(
  input: CreateSociedadInput,
): Promise<ActionResult<SociedadDTO>> {
  try {
    const parsed = CreateSociedadSchema.safeParse(input)
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
    const estudioId = await getCurrentEstudioId()
    const sociedad = await createSociedad(estudioId, parsed.data)
    revalidatePath('/sociedades')
    return actionOk(sociedad)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'crear' }))
  }
}

export async function actualizarSociedad(
  id: string,
  input: UpdateSociedadInput,
): Promise<ActionResult<SociedadDTO>> {
  try {
    const parsed = UpdateSociedadSchema.safeParse(input)
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
    // Solo una sociedad del estudio actual: el identificador viene de la pantalla.
    const [existing, estudioId] = await Promise.all([findSociedadById(id), getCurrentEstudioId()])
    if (!existing || existing.estudioId !== estudioId) return actionError(SOCIEDAD_NO_ENCONTRADA)
    const sociedad = await updateSociedad(id, parsed.data)
    revalidatePath('/sociedades')
    return actionOk(sociedad)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'actualizar' }))
  }
}

export async function desactivarSociedad(id: string): Promise<ActionResult<void>> {
  try {
    const estudioId = await getCurrentEstudioId()
    if (!(await deactivateSociedad(estudioId, id))) return actionError(SOCIEDAD_NO_ENCONTRADA)
    revalidatePath('/sociedades')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'desactivar' }))
  }
}

export async function reactivarSociedad(id: string): Promise<ActionResult<void>> {
  try {
    const estudioId = await getCurrentEstudioId()
    if (!(await reactivateSociedad(estudioId, id))) return actionError(SOCIEDAD_NO_ENCONTRADA)
    revalidatePath('/sociedades')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'reactivar' }))
  }
}
