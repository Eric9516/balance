'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
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

export async function crearRubroBase(input: CreateRubroBaseInput): Promise<ActionResult<RubroBaseDTO>> {
  try {
    const parsed = CreateRubroBaseSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({ tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje: 'Datos inválidos', detalle: parsed.error.issues[0]?.message })
    }
    const rubro = await createRubroBase(parsed.data)
    revalidatePath('/configuracion/rubros')
    return actionOk(rubro)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'crear' }))
  }
}

export async function actualizarRubroBase(id: string, input: CreateRubroBaseInput): Promise<ActionResult<RubroBaseDTO>> {
  try {
    const parsed = CreateRubroBaseSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({ tipo: 'FORMULARIO', severidad: 'BAJO', codigo: 'FORM-001', mensaje: 'Datos inválidos', detalle: parsed.error.issues[0]?.message })
    }
    const existing = await findRubroBaseById(id)
    if (!existing) return actionError({ tipo: 'TECNICO', severidad: 'ALTO', codigo: 'TECH-002', mensaje: 'Clasificación no encontrada' })
    const rubro = await updateRubroBase(id, parsed.data)
    revalidatePath('/configuracion/rubros')
    return actionOk(rubro)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'actualizar' }))
  }
}

export async function getSiguienteOrden(seccionSSP?: string, seccionEERR?: string): Promise<number> {
  try {
    return await findNextOrden(seccionSSP, seccionEERR)
  } catch {
    return 100
  }
}

export async function eliminarRubroBase(id: string): Promise<ActionResult<void>> {
  try {
    await deleteRubroBase(id)
    revalidatePath('/configuracion/rubros')
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'eliminar' }))
  }
}
