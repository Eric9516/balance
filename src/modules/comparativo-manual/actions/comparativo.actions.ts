'use server'

import { revalidatePath } from 'next/cache'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import type { ComparativoManualDTO, ModuloComparativo } from '../domain/types'
import {
  upsertComparativo,
  deleteComparativo,
  deleteAllComparativosByEjercicio,
} from '../repository/comparativo.repository'

function revalidate(sociedadId: string, ejercicioId: string) {
  revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
}

export async function guardarComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  modulo: ModuloComparativo,
  clave: string,
  label: string,
  valor: number,
  esHuerfano: boolean,
  orden: number,
): Promise<ActionResult<ComparativoManualDTO>> {
  try {
    const row = await upsertComparativo(ejercicioId, modulo, clave, label, valor, esHuerfano, orden)
    revalidate(sociedadId, ejercicioId)
    return actionOk(row)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'guardar_comparativo' }),
    )
  }
}

export async function eliminarComparativoAction(
  ejercicioId: string,
  sociedadId: string,
  modulo: ModuloComparativo,
  clave: string,
): Promise<ActionResult<void>> {
  try {
    await deleteComparativo(ejercicioId, modulo, clave)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'eliminar_comparativo' }),
    )
  }
}

export async function limpiarComparativosAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await deleteAllComparativosByEjercicio(ejercicioId)
    revalidate(sociedadId, ejercicioId)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'limpiar_comparativos' }),
    )
  }
}
