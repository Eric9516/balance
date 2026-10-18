'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertEjercicioBelongsToCurrentEstudio } from '@/lib/authz'
import { actionOk, actionError } from '@/modules/errores/types'
import { errorHandler } from '@/modules/errores/handler'
import type { ActionResult } from '@/modules/errores/types'
import { compuertaAutorizacion } from '@/modules/ejercicios/services/autorizacion.service'

/**
 * Confirmar los estados contables = autorización final. Pasa por la compuerta RT 54:
 * modo del ejercicio anterior definido, categoría del ente, comparativo autorizado y
 * cuadrado (MANUAL) o anterior confirmado (VINCULADO).
 */
export async function confirmarEstadosAction(
  ejercicioId: string,
  sociedadId: string,
): Promise<ActionResult<void>> {
  try {
    await assertEjercicioBelongsToCurrentEstudio(ejercicioId)
    const bloqueo = await compuertaAutorizacion(ejercicioId)
    if (bloqueo) return actionError(bloqueo)

    await db.ejercicioContable.update({
      where: { id: ejercicioId },
      data: { estadosConfirmado: true },
    })
    revalidatePath(`/sociedades/${sociedadId}/ejercicios/${ejercicioId}/cuentas`)
    return actionOk(undefined)
  } catch (error) {
    return actionError(
      errorHandler(error, { modulo: 'ESTADOS_CONTABLES', operacion: 'confirmar_estados' }),
    )
  }
}
