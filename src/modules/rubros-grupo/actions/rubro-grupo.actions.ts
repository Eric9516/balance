'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { CreateRubroGrupoSchema, type CreateRubroGrupoInput } from '../schemas/rubro-grupo.schemas'
import {
  createRubroGrupo,
  updateRubroGrupo,
  deleteRubroGrupo,
  findRubroGrupoById,
  findNextOrdenGrupo,
} from '../repository/rubro-grupo.repository'
import type { RubroGrupoDTO } from '../domain/types'

function revalidate() {
  revalidatePath('/configuracion/rubros')
}

export async function crearRubroGrupo(
  input: CreateRubroGrupoInput,
): Promise<ActionResult<RubroGrupoDTO>> {
  try {
    const parsed = CreateRubroGrupoSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const grupo = await createRubroGrupo(parsed.data)
    revalidate()
    return actionOk(grupo)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'crear-grupo' }))
  }
}

export async function actualizarRubroGrupo(
  id: string,
  input: CreateRubroGrupoInput,
): Promise<ActionResult<RubroGrupoDTO>> {
  try {
    const parsed = CreateRubroGrupoSchema.safeParse(input)
    if (!parsed.success) {
      return actionError({
        tipo: 'FORMULARIO',
        severidad: 'BAJO',
        codigo: 'FORM-001',
        mensaje: 'Datos inválidos',
        detalle: parsed.error.issues[0]?.message,
      })
    }
    const existing = await findRubroGrupoById(id)
    if (!existing)
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Sección no encontrada',
      })
    const grupo = await updateRubroGrupo(id, parsed.data)
    revalidate()
    return actionOk(grupo)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'rubros-base', operacion: 'actualizar-grupo' }),
    )
  }
}

export async function eliminarRubroGrupo(id: string): Promise<ActionResult<void>> {
  try {
    const existing = await findRubroGrupoById(id)
    if (!existing)
      return actionError({
        tipo: 'TECNICO',
        severidad: 'ALTO',
        codigo: 'TECH-002',
        mensaje: 'Sección no encontrada',
      })
    if (existing.totalRubros > 0) {
      return actionError({
        tipo: 'NEGOCIO',
        severidad: 'MEDIO',
        codigo: 'BIZ-001',
        mensaje: `No se puede eliminar: tiene ${existing.totalRubros} clasificación${existing.totalRubros !== 1 ? 'es' : ''} asignada${existing.totalRubros !== 1 ? 's' : ''}.`,
      })
    }
    await deleteRubroGrupo(id)
    revalidate()
    return actionOk(undefined)
  } catch (error) {
    return actionError(errorHandler(error, { modulo: 'rubros-base', operacion: 'eliminar-grupo' }))
  }
}

export async function getSiguienteOrdenGrupo(): Promise<number> {
  try {
    return await findNextOrdenGrupo()
  } catch {
    return 10
  }
}
