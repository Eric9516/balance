'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import {
  CreateAuditorSchema,
  UpdateAuditorSchema,
  type CreateAuditorInput,
  type UpdateAuditorInput,
} from '../schemas/auditor.schemas'
import {
  createAuditor,
  updateAuditor,
  deactivateAuditor,
  reactivateAuditor,
  findAuditorById,
} from '../repository/auditor.repository'
import type { AuditorDTO } from '../domain/types'

export async function crearAuditor(input: CreateAuditorInput): Promise<ActionResult<AuditorDTO>> {
  try {
    const parsed = CreateAuditorSchema.safeParse(input)
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
    const auditor = await createAuditor(estudioId, parsed.data)
    revalidatePath('/auditores')
    return actionOk(auditor)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'auditores', operacion: 'crear' }))
  }
}

export async function actualizarAuditor(
  id: string,
  input: UpdateAuditorInput,
): Promise<ActionResult<AuditorDTO>> {
  try {
    const parsed = UpdateAuditorSchema.safeParse(input)
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
    const existing = await findAuditorById(id)
    if (!existing) {
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Auditor no encontrado',
      })
    }
    const auditor = await updateAuditor(id, parsed.data)
    revalidatePath('/auditores')
    return actionOk(auditor)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'auditores', operacion: 'actualizar' }))
  }
}

export async function desactivarAuditor(id: string): Promise<ActionResult<void>> {
  try {
    await deactivateAuditor(id)
    revalidatePath('/auditores')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'auditores', operacion: 'desactivar' }))
  }
}

export async function reactivarAuditor(id: string): Promise<ActionResult<void>> {
  try {
    await reactivateAuditor(id)
    revalidatePath('/auditores')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'auditores', operacion: 'reactivar' }))
  }
}
