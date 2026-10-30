'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import { getCurrentEstudioId } from '@/lib/estudio-context'
import type { ActionResult } from '@/modules/errores/types'
import { CreateRubroBaseSchema, type CreateRubroBaseInput } from '../schemas/rubro-base.schemas'
import {
  createRubroBase,
  updateRubroBase,
  deleteRubroBase,
  findRubroBaseById,
  findNextOrden,
} from '../repository/rubro-base.repository'
import type { RubroBaseDTO } from '../domain/types'

const NO_ENCONTRADA = {
  tipo: 'TECNICO',
  severidad: 'ALTO',
  codigo: 'TECH-002',
  mensaje: 'Clasificación no encontrada',
} as const

export async function crearRubroBase(
  input: CreateRubroBaseInput,
): Promise<ActionResult<RubroBaseDTO>> {
  try {
    const parsed = CreateRubroBaseSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const rubro = await createRubroBase(await getCurrentEstudioId(), parsed.data)
    revalidatePath('/configuracion/rubros')
    return actionOk(rubro)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'crear' }))
  }
}

export async function actualizarRubroBase(
  id: string,
  input: CreateRubroBaseInput,
): Promise<ActionResult<RubroBaseDTO>> {
  try {
    const parsed = CreateRubroBaseSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const existing = await findRubroBaseById(await getCurrentEstudioId(), id)
    if (!existing) return actionError(NO_ENCONTRADA)
    const rubro = await updateRubroBase(id, parsed.data)
    revalidatePath('/configuracion/rubros')
    return actionOk(rubro)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'actualizar' }))
  }
}

export async function getSiguienteOrden(
  seccionSSP?: string,
  seccionEERR?: string,
): Promise<number> {
  try {
    return await findNextOrden(await getCurrentEstudioId(), seccionSSP, seccionEERR)
  } catch {
    return 100
  }
}

export async function eliminarRubroBase(id: string): Promise<ActionResult<void>> {
  try {
    const estudioId = await getCurrentEstudioId()
    if (!(await findRubroBaseById(estudioId, id))) return actionError(NO_ENCONTRADA)
    await deleteRubroBase(estudioId, id)
    revalidatePath('/configuracion/rubros')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'eliminar' }))
  }
}
