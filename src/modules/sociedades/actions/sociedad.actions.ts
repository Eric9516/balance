'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
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
    const existing = await findSociedadById(id)
    if (!existing) {
      return actionError({ tipo: 'TECNICO', severidad: 'ALTO', codigo: 'TECH-002', mensaje: 'Sociedad no encontrada' })
    }
    const sociedad = await updateSociedad(id, parsed.data)
    revalidatePath('/sociedades')
    return actionOk(sociedad)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'actualizar' }))
  }
}

export async function desactivarSociedad(id: string): Promise<ActionResult<void>> {
  try {
    await deactivateSociedad(id)
    revalidatePath('/sociedades')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'desactivar' }))
  }
}

export async function reactivarSociedad(id: string): Promise<ActionResult<void>> {
  try {
    await reactivateSociedad(id)
    revalidatePath('/sociedades')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'sociedades', operacion: 'reactivar' }))
  }
}
