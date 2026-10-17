'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import {
  createBienDeUso,
  updateBienDeUso,
  deleteBienDeUso,
  findBienesDeUso,
  updateNetoAnteriorManual,
} from '../repository/bienes-de-uso.repository'
import type { BienDeUsoDTO } from '../domain/types'

function revalPath(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/bienes-de-uso`)
}

export async function crearBienDeUsoAction(
  ejercicioId: string,
  sociedadId: string,
  categoria: string,
): Promise<ActionResult<BienDeUsoDTO>> {
  try {
    const existing = await findBienesDeUso(ejercicioId)
    const orden = existing.length + 1
    const row = await createBienDeUso(ejercicioId, categoria, orden)
    revalPath(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'crear_bien_de_uso' }),
    )
  }
}

export async function actualizarBienDeUsoAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
  data: {
    categoria?: string
    costoInicioReexpresado?: number
    costoAjusteInflacion?: number
    altas?: number
    bajas?: number
    depAcumInicio?: number
    depAjusteInflacion?: number
    depEjercicio?: number
    depBajas?: number
  },
): Promise<ActionResult<BienDeUsoDTO>> {
  try {
    const row = await updateBienDeUso(id, data)
    revalPath(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'actualizar_bien_de_uso' }),
    )
  }
}

export async function actualizarNetoAnteriorManualAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
  valor: number | null,
): Promise<ActionResult<BienDeUsoDTO>> {
  try {
    const row = await updateNetoAnteriorManual(id, valor)
    revalPath(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'actualizar_neto_anterior' }),
    )
  }
}

export async function eliminarBienDeUsoAction(
  id: string,
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await deleteBienDeUso(id)
    revalPath(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'eliminar_bien_de_uso' }),
    )
  }
}
