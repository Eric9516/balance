'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import {
  CreateEjercicioSchema,
  UpdateEjercicioSchema,
  type CreateEjercicioInput,
  type UpdateEjercicioInput,
} from '../schemas/ejercicio.schemas'
import {
  createEjercicio,
  updateEjercicio,
  cambiarEstado,
  deleteEjercicio,
  findEjercicioById,
} from '../repository/ejercicio.repository'
import type { EjercicioContableDTO } from '../domain/types'
import type { EstadoEjercicio } from '@prisma/client'

const VALID_TRANSITIONS: Record<EstadoEjercicio, EstadoEjercicio[]> = {
  BORRADOR: ['EN_PROCESO'],
  EN_PROCESO: ['REVISION'],
  REVISION: ['CERRADO', 'EN_PROCESO'],
  CERRADO: [],
}

export async function crearEjercicio(
  sociedadId: string,
  input: CreateEjercicioInput,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    const parsed = CreateEjercicioSchema.safeParse(input)
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
    const ejercicio = await createEjercicio(sociedadId, estudioId, parsed.data)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'crear' }))
  }
}

export async function actualizarEjercicio(
  id: string,
  sociedadId: string,
  input: UpdateEjercicioInput,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    const parsed = UpdateEjercicioSchema.safeParse(input)
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
    const existing = await findEjercicioById(id)
    if (!existing) {
      return actionError({ tipo: 'TECNICO', severidad: 'ALTO', codigo: 'TECH-002', mensaje: 'Ejercicio no encontrado' })
    }
    const ejercicio = await updateEjercicio(id, parsed.data)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'actualizar' }))
  }
}

export async function avanzarEstadoEjercicio(
  id: string,
  sociedadId: string,
  estadoActual: EstadoEjercicio,
  nuevoEstado: EstadoEjercicio,
): Promise<ActionResult<EjercicioContableDTO>> {
  try {
    const validos = VALID_TRANSITIONS[estadoActual]
    if (!validos.includes(nuevoEstado)) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-001',
        mensaje: `Transición de estado inválida: ${estadoActual} → ${nuevoEstado}`,
      })
    }
    const ejercicio = await cambiarEstado(id, nuevoEstado)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(ejercicio)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'cambiar_estado' }))
  }
}

export async function eliminarEjercicio(
  id: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    const existing = await findEjercicioById(id)
    if (!existing) {
      return actionError({ tipo: 'TECNICO', severidad: 'ALTO', codigo: 'TECH-002', mensaje: 'Ejercicio no encontrado' })
    }
    if (existing.estado !== 'BORRADOR') {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'NEG-002',
        mensaje: 'Solo se pueden eliminar ejercicios en estado Borrador',
      })
    }
    await deleteEjercicio(id)
    revalidatePath(`/sociedades/${sociedadId}/ejercicios`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'ejercicios', operacion: 'eliminar' }))
  }
}
